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

export type FeaturedProduct = {
  id: number;
  name: string;
  slug: string;
  categorySlug: string;
  price: number;
  salePrice: number | null;
  images: string[];
  isFastDelivery: boolean;
};

// Danh mục cho menu điều hướng, theo sortOrder, chỉ lấy name và slug.
export async function getNavCategories(): Promise<NavCategory[]> {
  return db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { name: true, slug: true },
  });
}

// Dữ liệu trang chủ: danh mục kèm số sản phẩm đang bán, và 8 sản phẩm
// nổi bật (2 sản phẩm đầu theo sortOrder, chỉ isActive, của mỗi danh mục).
export async function getHomeData(): Promise<{
  categories: HomeCategory[];
  featured: FeaturedProduct[];
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
      category: { select: { slug: true } },
    },
  });

  const homeCategories: HomeCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c.products.length,
  }));

  const featured: FeaturedProduct[] = [];
  for (const category of categories) {
    const firstTwo = products.filter((p) => p.categoryId === category.id).slice(0, 2);
    for (const p of firstTwo) {
      featured.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        categorySlug: p.category.slug,
        price: p.price,
        salePrice: p.salePrice,
        images: p.images,
        isFastDelivery: p.isFastDelivery,
      });
    }
  }

  return { categories: homeCategories, featured };
}
