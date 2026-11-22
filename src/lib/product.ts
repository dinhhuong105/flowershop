import { cache } from "react";
import { db } from "@/lib/db";
import { rankRelated } from "./related";
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
  category: { select: { slug: true, name: true } },
} as const;

// Tìm theo cặp (slug danh mục, slug sản phẩm), chỉ sản phẩm isActive.
// Sai danh mục → null (trang gọi notFound, không chuyển hướng).
export const getProduct = cache(
  async (categorySlug: string, productSlug: string): Promise<ProductDetail | null> => {
    const p = await db.product.findFirst({
      where: { slug: productSlug, isActive: true, category: { slug: categorySlug } },
      select: productSelect,
    });
    if (!p) return null;
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
      categorySlug: p.category.slug,
      categoryName: p.category.name,
    };
  },
);

// 4 sản phẩm liên quan theo quy tắc rankRelated (mục 5.3).
export async function getRelated(product: ProductDetail): Promise<ProductSummary[]> {
  const candidates = await db.product.findMany({
    where: { isActive: true, id: { not: product.id } },
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
      category: { select: { slug: true, name: true } },
    },
  });
  const ranked = rankRelated(product, candidates);
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
