import { requireAdmin } from "@/lib/admin/auth";
import { createNewsAction } from "@/app/actions/admin";
import NewsForm from "@/components/admin/NewsForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup thêm bài tin tức (intercepting route, Ngày 18 — theo mẫu
// trang tĩnh): chỉ render khi điều hướng tới từ trong admin — danh
// sách ở dưới vẫn hiện, URL đổi thành /admin/news/new. Vào trực
// tiếp URL thì trang /admin/news/new đầy đủ hiện thay (không phải
// popup này). Tái dùng ProductModal (dialog gốc, đã căn giữa) vì nó
// nhận mọi nội dung con, không riêng gì sản phẩm.
export default async function AdminNewNewsModal() {
  await requireAdmin();
  return (
    <ProductModal title="Thêm bài tin tức">
      <NewsForm
        mode="create"
        action={createNewsAction}
        onSuccess="back"
        initial={{
          title: "",
          slug: "",
          excerpt: "",
          content: "",
          coverImage: "",
          author: "",
          seoTitle: "",
          seoDescription: "",
          isPublished: false,
        }}
      />
    </ProductModal>
  );
}
