import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { listAdminCategories } from "@/lib/admin/products";
import { createProductAction } from "@/app/actions/admin";
import ProductForm from "@/components/admin/ProductForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup thêm sản phẩm (intercepting route, 25/11): chỉ render khi
// điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/products/new. Vào trực tiếp URL thì trang
// /admin/products/new đầy đủ hiện thay (không phải popup này).
export default async function AdminNewProductModal() {
  await requireAdmin();
  const [categories, settings] = await Promise.all([
    listAdminCategories(),
    getSettings(),
  ]);
  return (
    <ProductModal title="Thêm sản phẩm">
      <ProductForm
        mode="create"
        categories={categories}
        action={createProductAction}
        onSuccess="back"
        siteName={settings.siteName}
        initial={{
          name: "",
          slug: "",
          sku: "",
          categoryId: "",
          price: "",
          salePrice: "",
          description: "",
          tags: "",
          sortOrder: "0",
          isActive: true,
          inStock: true,
          isFastDelivery: false,
          images: [],
          seoTitle: "",
          seoDescription: "",
        }}
      />
    </ProductModal>
  );
}
