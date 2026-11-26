import { requireAdmin } from "@/lib/admin/auth";
import { createPageAction } from "@/app/actions/admin";
import PageForm from "@/components/admin/PageForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup thêm trang tĩnh (intercepting route, Ngày 13 B3): chỉ render
// khi điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/pages/new. Vào trực tiếp URL thì trang
// /admin/pages/new đầy đủ hiện thay (không phải popup này).
// Tái dùng ProductModal (dialog gốc, đã căn giữa) vì nó nhận mọi
// nội dung con, không riêng gì sản phẩm.
export default async function AdminNewPageModal() {
  await requireAdmin();
  return (
    <ProductModal title="Thêm trang tĩnh">
      <PageForm
        mode="create"
        action={createPageAction}
        onSuccess="back"
        initial={{
          title: "",
          slug: "",
          content: "",
          seoTitle: "",
          seoDescription: "",
          sortOrder: "0",
          isPublished: false,
          showInFooter: false,
            legacyPath: "",
        }}
      />
    </ProductModal>
  );
}
