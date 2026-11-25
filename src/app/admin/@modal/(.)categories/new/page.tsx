import { requireAdmin } from "@/lib/admin/auth";
import { createCategoryAction } from "@/app/actions/admin";
import CategoryForm from "@/components/admin/CategoryForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup thêm danh mục (intercepting route, 25/11): chỉ render khi
// điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/categories/new. Vào trực tiếp URL thì trang
// /admin/categories/new đầy đủ hiện thay (không phải popup này).
// Tái dùng ProductModal (dialog gốc, đã căn giữa) vì nó nhận mọi
// nội dung con, không riêng gì sản phẩm.
export default async function AdminNewCategoryModal() {
  await requireAdmin();
  return (
    <ProductModal title="Thêm danh mục">
      <CategoryForm
        mode="create"
        action={createCategoryAction}
        onSuccess="back"
        initial={{ name: "", slug: "", sortOrder: "0" }}
      />
    </ProductModal>
  );
}
