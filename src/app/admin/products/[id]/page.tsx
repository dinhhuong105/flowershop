import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminProduct, listAdminCategories } from "@/lib/admin/products";
import { updateProductAction } from "@/app/actions/admin";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sửa sản phẩm",
  robots: { index: false, follow: false },
};

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();
  const [product, categories] = await Promise.all([
    getAdminProduct(productId),
    listAdminCategories(),
  ]);
  if (!product) notFound();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Sửa sản phẩm</h1>
      <p className="mt-2 text-sm text-slate-500">
        {product.name}
        {product.sku ? ` · SKU: ${product.sku}` : ""}
      </p>
      <div className="mt-6">
        <ProductForm
          mode="edit"
          categories={categories}
          action={updateProductAction.bind(null, product.id)}
          originalSlug={product.slug}
          productId={product.id}
          initial={{
            name: product.name,
            slug: product.slug,
            sku: product.sku ?? "",
            categoryId: String(product.categoryId),
            price: String(product.price),
            salePrice: product.salePrice === null ? "" : String(product.salePrice),
            description: product.description,
            tags: product.tags.join(", "),
            sortOrder: String(product.sortOrder),
            isActive: product.isActive,
            inStock: product.inStock,
            isFastDelivery: product.isFastDelivery,
            images: product.images,
          }}
        />
      </div>
    </div>
  );
}
