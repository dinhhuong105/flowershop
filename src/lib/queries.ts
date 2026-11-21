import { cache } from "react";
import { db } from "@/lib/db";

export type NavCategory = {
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
};

export type FeaturedProduct = ProductSummary;

// Danh mục cho menu điều hướng, theo sortOrder, chỉ lấy name và slug.
// Bọc bằng React cache để header và footer dùng chung một truy vấn trong
// một lần tải trang.
export const getNavCategories = cache(async (): Promise<NavCategory[]> => {
  return db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { name: true, slug: true },
  });
});

// Dữ liệu trang chủ: mỗi danh mục kèm tối đa 4 sản phẩm đầu theo
// sortOrder (chỉ isActive). Danh mục không có sản phẩm thì mảng rỗng
// và trang chủ không hiện khối đó (mục 5.1 phụ lục).
export type HomeCategorySection = HomeCategory & {
  products: ProductSummary[];
};

export async function getHomeData(): Promise<{
  categories: HomeCategorySection[];
}> {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      products: { where: { isActive: true }, select: { id: true } },
    },
  });
  const products = await db.product.findMany({
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
      categoryId: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const homeCategories: HomeCategorySection[] = categories.map((c) => {
    const firstFour = products
      .filter((p) => p.categoryId === c.id)
      .slice(0, 4)
      .map(
        (p): ProductSummary => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          categorySlug: p.category.slug,
          categoryName: p.category.name,
          price: p.price,
          salePrice: p.salePrice,
          images: p.images,
          isFastDelivery: p.isFastDelivery,
        }),
      );
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c.products.length,
      products: firstFour,
    };
  });

  return { categories: homeCategories };
}
