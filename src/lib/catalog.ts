import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import { PAGE_SIZE, priceRanges, tagLabels } from "@/config/catalog";
import type { CatalogParams } from "./catalog-params";
import type { ProductSummary } from "./queries";

export type CategoryPageData = {
  category: {
    id: number;
    name: string;
    slug: string;
    // SEO riêng (Ngày 14 D1/D2): rỗng = dùng tên/mô tả như hiện nay.
    seoTitle: string;
    seoDescription: string;
  };
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
  const range = priceRanges.find((r) => r.slug === params.gia) ?? null;

  // Mọi giá trị đi vào SQL đều đã qua allowlist ở catalog-params; dip, min,
  // max, limit, offset đều truyền bằng tham số. Hướng sắp xếp chỉ chọn giữa
  // các đoạn SQL cố định dưới đây, không nối chuỗi từ dữ liệu người dùng.
  // Danh mục được nối qua JOIN theo slug (c."slug" = $slug) thay vì
  // categoryId lấy từ truy vấn riêng — nhờ đó cả 3 truy vấn dưới đây
  // độc lập nhau và chạy song song trong 1 vòng RTT (Ngày 20 A4):
  //  - Q1: danh mục theo slug (tên + SEO cho metadata/trang).
  //  - Q2: chi tiết SP đã lọc/sắp xếp/phân trang + tổng số
  //    (COUNT(*) OVER()) trong MỘT truy vấn — trước đây tách thành
  //    "lấy id" rồi "lấy chi tiết theo id" (2 vòng nối tiếp).
  //  - Q3: tag dịp thực sự có trong danh mục (DISTINCT unnest).
  const conditions: Prisma.Sql[] = [
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

  type CategoryRow = {
    id: number;
    name: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
  };
  type ProductRow = {
    id: number;
    name: string;
    slug: string;
    price: number;
    salePrice: number | null;
    images: string[];
    isFastDelivery: boolean;
    inStock: boolean;
    sku: string | null;
    total: bigint;
  };
  const [category, productRows, tagRows] = await Promise.all([
    db.category.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, seoTitle: true, seoDescription: true },
    }) as Promise<CategoryRow | null>,
    db.$queryRaw<Array<ProductRow>>(Prisma.sql`
      SELECT p."id", p."name", p."slug", p."price", p."salePrice",
        p."images", p."isFastDelivery", p."inStock", p."sku",
        COUNT(*) OVER() AS "total"
      FROM "products" AS p
      JOIN "categories" AS c ON c."id" = p."categoryId"
      WHERE c."slug" = ${slug}
        AND ${Prisma.join(conditions, " AND ")}
      ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${(params.trang - 1) * PAGE_SIZE}
    `),
    db.$queryRaw<Array<{ tag: string }>>(Prisma.sql`
      SELECT DISTINCT unnest(p."tags") AS "tag"
      FROM "products" AS p
      JOIN "categories" AS c ON c."id" = p."categoryId"
      WHERE c."slug" = ${slug} AND p."isActive" = true
    `),
  ]);
  if (!category) return null;

  const total = productRows.length > 0 ? Number(productRows[0].total) : 0;
  const products: ProductSummary[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    categorySlug: category.slug,
    categoryName: category.name,
    price: p.price,
    salePrice: p.salePrice,
    images: p.images,
    isFastDelivery: p.isFastDelivery,
    inStock: p.inStock,
    sku: p.sku,
  }));

  const tagSet = new Set(tagRows.map((r) => r.tag));
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
