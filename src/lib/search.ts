import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { PAGE_SIZE } from "@/config/catalog";
import type { ProductSummary } from "./queries";

// Tìm kiếm không phân biệt dấu (mục 2 đặc tả Ngày 6).
//
// Quy tắc (2.1): tìm trong tên, SKU, tên danh mục và tag (dấu `-`
// trong tag đổi thành khoảng trắng); không tìm trong mô tả. Mỗi từ
// phải xuất hiện dưới dạng chuỗi con trong "văn bản tìm kiếm" (phép
// AND). Xếp hạng: tên chứa đủ mọi từ đứng trước, rồi sortOrder danh
// mục, rồi sortOrder sản phẩm, rồi id. Chỉ isActive = true.
// An toàn: mọi từ truyền bằng tham số (Prisma.sql), so khớp bằng
// strpos (không dùng LIKE nên `%`, `_`, `\` không phải ký tự đặc
// biệt); cấm nối chuỗi SQL từ dữ liệu người dùng.

// Tối đa 80 ký tự và tối đa 6 từ (phần thừa bị bỏ).
export const MAX_SEARCH_QUERY_LENGTH = 80;
export const MAX_SEARCH_WORDS = 6;

// Tách từ khóa: chuẩn hoá NFC trước (K-8: chuỗi NFD dán từ một số
// ứng dụng/bàn phím — ví dụ "o" + U+0302 + U+0300 — phải về dạng tổ
// hợp "ồ" trước khi tách), cắt khoảng trắng đầu/cuối, gộp khoảng trắng
// thừa, bỏ ký tự điều khiển và ký tự độ rộng bằng không, tối đa 80 ký
// tự đầu và tối đa 6 từ đầu.
export function tokenizeSearchQuery(raw: string): string[] {
  const cleaned = raw
    .normalize("NFC")
    .replace(/[\x00-\x1F\x7F]+/g, " ")
    .replace(/[\u200B-\u200D\uFEFF\u2060]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_QUERY_LENGTH)
    .trim();
  if (cleaned === "") return [];
  return cleaned.split(" ").slice(0, MAX_SEARCH_WORDS);
}

// Giá hiện tại = salePrice khi hợp lệ (> 0 và < price), nếu không thì price.
const currentPriceSql = Prisma.sql`CASE WHEN p."salePrice" IS NOT NULL AND p."salePrice" > 0 AND p."salePrice" < p."price" THEN p."salePrice" ELSE p."price" END`;

export type SearchResult = {
  products: ProductSummary[];
  total: number;
  totalPages: number;
  words: string[];
};

export async function searchProducts(
  q: string,
  opts: { sort?: string | null; page?: number } = {},
): Promise<SearchResult> {
  const words = tokenizeSearchQuery(q);
  // Không có từ khóa → không truy vấn DB (mục 2.3: q rỗng trả trang 200
  // với ô tìm và liên kết danh mục).
  if (words.length === 0) {
    return { products: [], total: 0, totalPages: 0, words };
  }
  const page = opts.page !== undefined && opts.page >= 1 ? opts.page : 1;
  const sort = opts.sort ?? null;

  const searchText = Prisma.sql`vi_unaccent(p."name" || ' ' || coalesce(p."sku", '') || ' ' || c."name" || ' ' || replace(array_to_string(p."tags", ' '), '-', ' '))`;
  const wordConds = words.map(
    (w) => Prisma.sql`strpos(${searchText}, vi_unaccent(${w})) > 0`,
  );
  const nameConds = words.map(
    (w) => Prisma.sql`strpos(vi_unaccent(p."name"), vi_unaccent(${w})) > 0`,
  );
  const nameMatch = Prisma.sql`(${Prisma.join(nameConds, " AND ")})`;
  const orderBy =
    sort === "gia-tang"
      ? Prisma.sql`ORDER BY ${currentPriceSql} ASC, c."sortOrder" ASC, p."sortOrder" ASC, p."id" ASC`
      : sort === "gia-giam"
        ? Prisma.sql`ORDER BY ${currentPriceSql} DESC, c."sortOrder" ASC, p."sortOrder" ASC, p."id" ASC`
        : Prisma.sql`ORDER BY ${nameMatch} DESC, c."sortOrder" ASC, p."sortOrder" ASC, p."id" ASC`;

  // Truy vấn 1: id đã lọc, xếp hạng, phân trang + tổng số (COUNT(*) OVER()).
  const rows = await db.$queryRaw<Array<{ id: number; total: bigint }>>(Prisma.sql`
    SELECT p."id", COUNT(*) OVER() AS "total"
    FROM "products" AS p
    JOIN "categories" AS c ON c."id" = p."categoryId"
    WHERE p."isActive" = true AND ${Prisma.join(wordConds, " AND ")}
    ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);

  // Truy vấn 2: chi tiết sản phẩm theo id, giữ nguyên thứ tự của ids.
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
        inStock: true,
        sku: true,
        categoryId: true,
        category: { select: { slug: true, name: true } },
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
          categorySlug: p.category.slug,
          categoryName: p.category.name,
          price: p.price,
          salePrice: p.salePrice,
          images: p.images,
          isFastDelivery: p.isFastDelivery,
          inStock: p.inStock,
          sku: p.sku,
        },
      ];
    });
  }

  return {
    products,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
    words,
  };
}

// Gợi ý tìm kiếm (mục 2.5): tối đa 5 sản phẩm, cùng quy tắc tìm và
// xếp hạng ở 2.1. q ngắn hơn 2 ký tự hoặc rỗng → [].
export type SearchSuggestion = {
  name: string;
  slug: string;
  categorySlug: string;
  price: number;
  salePrice: number | null;
  image: string | null;
};

export async function searchSuggestions(q: string): Promise<SearchSuggestion[]> {
  const words = tokenizeSearchQuery(q);
  if (words.length === 0) return [];
  if (q.trim().length < 2) return [];
  const { products } = await searchProducts(q, { page: 1 });
  return products.slice(0, 5).map((p) => ({
    name: p.name,
    slug: p.slug,
    categorySlug: p.categorySlug,
    price: p.price,
    salePrice: p.salePrice,
    image: p.images[0] ?? null,
  }));
}
