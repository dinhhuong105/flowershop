import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { PAGE_SIZE, priceRanges, tagLabels } from "@/config/catalog";
import type { CatalogParams } from "./catalog-params";
import type { ProductSummary } from "./queries";

export type CategoryPageData = {
  category: { id: number; name: string; slug: string };
  products: ProductSummary[]; // tối đa PAGE_SIZE, đã lọc/sắp xếp/phân trang, kèm categorySlug
  total: number; // tổng sản phẩm khớp bộ lọc (trước phân trang)
  totalPages: number; // Math.ceil(total / PAGE_SIZE), 0 nếu rỗng
  availableTags: string[]; // tag dịp thực sự có trong danh mục, theo thứ tự tagLabels
};

// Giá hiện tại = salePrice khi hợp lệ (> 0 và < price), nếu không thì price.
const currentPriceSql = Prisma.sql`CASE WHEN p."salePrice" IS NOT NULL AND p."salePrice" > 0 AND p."salePrice" < p."price" THEN p."salePrice" ELSE p."price" END`;

async function fetchCategoryPage(
  slug: string,
  params: CatalogParams,
): Promise<CategoryPageData | null> {
  // Truy vấn 1: danh mục theo slug.
  const category = await db.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!category) return null;

  const range = priceRanges.find((r) => r.slug === params.gia) ?? null;

  // Mọi giá trị đi vào SQL đều đã qua allowlist ở catalog-params; dip, min,
  // max, limit, offset đều truyền bằng tham số. Hướng sắp xếp chỉ chọn giữa
  // các đoạn SQL cố định dưới đây, không nối chuỗi từ dữ liệu người dùng.
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."categoryId" = ${category.id}`,
    Prisma.sql`p."isActive" = true`,
  ];
  if (params.dip) conditions.push(Prisma.sql`${params.dip} = ANY(p."tags")`);
  if (range) {
    if (range.min !== null)
      conditions.push(Prisma.sql`${currentPriceSql} >= ${range.min}`);
    if (range.max !== null)
      conditions.push(Prisma.sql`${currentPriceSql} < ${range.max}`);
  }
  const orderBy =
    params.sx === "gia-tang"
      ? Prisma.sql`ORDER BY ${currentPriceSql} ASC, p."sortOrder" ASC, p."id" ASC`
      : params.sx === "gia-giam"
        ? Prisma.sql`ORDER BY ${currentPriceSql} DESC, p."sortOrder" ASC, p."id" ASC`
        : Prisma.sql`ORDER BY p."sortOrder" ASC, p."id" ASC`;

  // Truy vấn 2: id đã lọc, sắp xếp, phân trang + tổng số (COUNT(*) OVER()).
  const rows = await db.$queryRaw<Array<{ id: number; total: bigint }>>(Prisma.sql`
    SELECT p."id", COUNT(*) OVER() AS "total"
    FROM "products" AS p
    WHERE ${Prisma.join(conditions, " AND ")}
    ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${(params.trang - 1) * PAGE_SIZE}
  `);
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);

  // Truy vấn 3: chi tiết sản phẩm theo id, giữ nguyên thứ tự của ids.
  // Không select quan hệ category (Prisma sẽ tốn thêm 1 truy vấn nạp quan
  // hệ): mọi sản phẩm ở đây đều thuộc cùng danh mục đã lấy ở truy vấn 1.
  let products: ProductSummary[] = [];
  if (ids.length > 0) {
    const found = await db.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        salePrice: true,
        images: true,
        isFastDelivery: true,
      },
    });
    const byId = new Map(found.map((p) => [p.id, p]));
    products = ids.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      return [
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          categorySlug: category.slug,
          categoryName: category.name,
          price: p.price,
          salePrice: p.salePrice,
          images: p.images,
          isFastDelivery: p.isFastDelivery,
        },
      ];
    });
  }

  // Truy vấn 4: tag dịp thực sự có trong danh mục (không phụ thuộc bộ lọc).
  const tagRows = await db.product.findMany({
    where: { categoryId: category.id, isActive: true },
    select: { tags: true },
  });
  const tagSet = new Set(tagRows.flatMap((r) => r.tags));
  const availableTags = tagLabels
    .filter((t) => tagSet.has(t.slug))
    .map((t) => t.slug);

  return {
    category,
    products,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
    availableTags,
  };
}

// Bọc bằng React cache để generateMetadata và page dùng chung 4 truy vấn
// trong một lần tải trang. React cache() so sánh tham số bằng tham chiếu,
// mà generateMetadata và page mỗi nơi tự parseCatalogParams một object mới
// (khác tham chiếu, cùng nội dung) nên cache sẽ trượt và chạy lại toàn bộ
// nếu truyền thẳng object params — đã đo thực tế: 10 truy vấn/trang thay vì
// 5. Vì vậy cache theo (slug, JSON params) là chuỗi — hai nơi gọi cùng
// chuỗi khóa thì trúng cache. Prisma còn tự gộp 2 findUnique đồng thời
// thành 1 truy vấn `slug IN (...)` nên càng không được dựa vào cache cũ.
const fetchCategoryPageCached = cache(
  async (slug: string, paramsKey: string): Promise<CategoryPageData | null> =>
    fetchCategoryPage(slug, JSON.parse(paramsKey) as CatalogParams),
);

export function getCategoryPage(
  slug: string,
  params: CatalogParams,
): Promise<CategoryPageData | null> {
  return fetchCategoryPageCached(slug, JSON.stringify(params));
}
