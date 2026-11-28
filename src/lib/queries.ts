import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export type NavCategory = {
  id: number;
  name: string;
  slug: string;
};

export type HomeCategory = {
  id: number;
  name: string;
  slug: string;
  productCount: number;
};

// Tóm tắt sản phẩm dùng chung cho thẻ sản phẩm (trang chủ, danh mục).
// Ngày 4 thêm inStock, sku (để thẻ hiện "Tạm hết hàng" và vô hiệu hóa
// "Mua ngay" khi hết hàng).
export type ProductSummary = {
  id: number;
  name: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  salePrice: number | null;
  images: string[];
  isFastDelivery: boolean;
  inStock: boolean;
  sku: string | null;
};

export type FeaturedProduct = ProductSummary;

// Danh mục cho menu điều hướng, theo sortOrder, chỉ lấy id/name/slug.
// Cache hai lớp (Ngày 19 B2): unstable_cache tag "nav-categories"
// (qua các request; action sửa danh mục gọi revalidateTag) + React
// cache() (gộp các lần gọi trong cùng request — layout và trang chủ
// dùng chung một lần đọc). Trước đây menu và trang chủ mỗi nơi một
// truy vấn danh mục giống hệt nhau.
const cachedNavCategories = unstable_cache(
  async (): Promise<NavCategory[]> =>
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ["nav-categories"],
  { tags: ["nav-categories"] },
);

// Ngoài runtime Next (test tsx, script): unstable_cache ném
// "incrementalCache missing" — đọc thẳng DB, không cache. Trong
// request Next thì dùng cache như thường.
async function readNavCategories(): Promise<NavCategory[]> {
  try {
    return await cachedNavCategories();
  } catch {
    return db.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });
  }
}

export const getNavCategories = cache(
  async (): Promise<NavCategory[]> => readNavCategories(),
);

// Dữ liệu trang chủ: mỗi danh mục kèm tối đa 4 sản phẩm đầu theo
// sortOrder (chỉ isActive). Danh mục không có sản phẩm thì mảng rỗng
// và trang chủ không hiện khối đó (mục 5.1 phụ lục).
export type HomeCategorySection = HomeCategory & {
  products: ProductSummary[];
};

export async function getHomeData(): Promise<{
  categories: HomeCategorySection[];
}> {
  // Hai lần đọc độc lập chạy song song (Ngày 19 B2): danh mục (đã
  // cache, ấm = 0 truy vấn) + toàn bộ SP đang bán. Trước đây nối tiếp
  // 4 truy vấn: danh mục menu, danh mục trang chủ (trùng), id SP theo
  // danh mục, toàn bộ SP + nạp lại danh mục cho quan hệ SP.
  // productCount đếm từ cùng mảng SP (mọi SP đang bán đều nằm trong
  // đó) nên không cần truy vấn đếm riêng; slug/tên danh mục của SP
  // lấy từ map danh mục trong JS, không select quan hệ category nữa.
  const [categories, products] = await Promise.all([
    getNavCategories(),
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
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
      },
    }),
  ]);
  const counts = new Map<number, number>();
  for (const p of products) {
    counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  }

  const homeCategories: HomeCategorySection[] = categories.map((c) => {
    const firstFour = products
      .filter((p) => p.categoryId === c.id)
      .slice(0, 4)
      .map(
        (p): ProductSummary => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          categorySlug: c.slug,
          categoryName: c.name,
          price: p.price,
          salePrice: p.salePrice,
          images: p.images,
          isFastDelivery: p.isFastDelivery,
          inStock: p.inStock,
          sku: p.sku,
        }),
      );
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: counts.get(c.id) ?? 0,
      products: firstFour,
    };
  });

  return { categories: homeCategories };
}
