import { cache } from "react";
import { db } from "@/lib/db";
import { rankRelated } from "./related";
import { getNavCategories } from "./queries";
import type { ProductSummary } from "./queries";

// Truy xuất trang chi tiết sản phẩm (mục 5.1 đặc tả Ngày 4).

export type ProductDetail = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  images: string[];
  tags: string[];
  isFastDelivery: boolean;
  isActive: boolean;
  inStock: boolean;
  sku: string | null;
  sortOrder: number;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  // SEO riêng (Ngày 14 D1/D2): rỗng = dùng tên/mô tả như hiện nay.
  seoTitle: string;
  seoDescription: string;
};

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  salePrice: true,
  images: true,
  tags: true,
  isFastDelivery: true,
  isActive: true,
  inStock: true,
  sku: true,
  sortOrder: true,
  categoryId: true,
  seoTitle: true,
  seoDescription: true,
  // Không select quan hệ category (Ngày 19 B2): Prisma tốn thêm 1
  // truy vấn nạp quan hệ; slug danh mục đã có từ tham số URL, tên
  // danh mục tra từ danh mục menu (đã cache) trong JS bên dưới.
} as const;

// Tìm theo cặp (slug danh mục, slug sản phẩm), chỉ sản phẩm isActive
// và không chờ duyệt. Sai danh mục → null (trang gọi notFound, không
// chuyển hướng).
export const getProduct = cache(
  async (categorySlug: string, productSlug: string): Promise<ProductDetail | null> => {
    const p = await db.product.findFirst({
      where: { slug: productSlug, isActive: true, needsReview: false, category: { slug: categorySlug } },
      select: productSelect,
    });
    if (!p) return null;
    const categories = await getNavCategories();
    const categoryName =
      categories.find((c) => c.id === p.categoryId)?.name ?? categorySlug;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      salePrice: p.salePrice,
      images: p.images,
      tags: p.tags,
      isFastDelivery: p.isFastDelivery,
      isActive: p.isActive,
      inStock: p.inStock,
      sku: p.sku,
      sortOrder: p.sortOrder,
      categoryId: p.categoryId,
      categorySlug,
      categoryName,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
    };
  },
);

// 4 sản phẩm liên quan theo quy tắc rankRelated (mục 5.3).
export async function getRelated(product: ProductDetail): Promise<ProductSummary[]> {
  // Không select quan hệ category (Ngày 19 B2): Prisma tốn thêm 1
  // truy vấn nạp quan hệ; slug/tên danh mục tra từ menu (đã cache).
  const [candidates, categories] = await Promise.all([
    db.product.findMany({
      where: { isActive: true, needsReview: false, id: { not: product.id } },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        salePrice: true,
        images: true,
        tags: true,
        isFastDelivery: true,
        isActive: true,
        inStock: true,
        sku: true,
        sortOrder: true,
        categoryId: true,
      },
    }),
    getNavCategories(),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const withCategory = candidates.map((p) => ({
    ...p,
    category: {
      slug: byId.get(p.categoryId)?.slug ?? product.categorySlug,
      name: byId.get(p.categoryId)?.name ?? product.categoryName,
    },
  }));
  const ranked = rankRelated(product, withCategory);
  return ranked.map((p) => ({
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
  }));
}
