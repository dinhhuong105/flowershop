import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { getAdminProduct, listAdminCategories } from "@/lib/admin/products";
import { updateProductAction } from "@/app/actions/admin";
import ProductForm from "@/components/admin/ProductForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup sửa sản phẩm (intercepting route, 25/11): chỉ render khi
// điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/products/[id]. Vào trực tiếp URL thì trang
// /admin/products/[id] đầy đủ hiện thay (không phải popup này).
export default async function AdminEditProductModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();
  const [product, categories, settings] = await Promise.all([
    getAdminProduct(productId),
    listAdminCategories(),
    getSettings(),
  ]);
  if (!product) notFound();
  return (
    <ProductModal title={`Sửa sản phẩm: ${product.name}`}>
      <ProductForm
        mode="edit"
        categories={categories}
        action={updateProductAction.bind(null, product.id)}
        onSuccess="back"
        originalSlug={product.slug}
        productId={product.id}
        siteName={settings.siteName}
        urlPath={`/${product.categorySlug}/${product.slug}`}
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
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
        }}
      />
    </ProductModal>
  );
}
