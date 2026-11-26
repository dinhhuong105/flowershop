import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPage } from "@/lib/admin/pages";
import { updatePageAction } from "@/app/actions/admin";
import PageForm from "@/components/admin/PageForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup sửa trang tĩnh (intercepting route, Ngày 13 B3): chỉ render
// khi điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/pages/[id]. Vào trực tiếp URL thì trang
// /admin/pages/[id] đầy đủ hiện thay (không phải popup này).
export default async function AdminEditPageModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) notFound();
  const page = await getAdminPage(pageId);
  if (!page) notFound();
  return (
    <ProductModal title={`Sửa trang: ${page.title}`}>
      <PageForm
        mode="edit"
        action={updatePageAction.bind(null, page.id)}
        onSuccess="back"
        originalSlug={page.slug}
        originalPublished={page.isPublished}
        initial={{
          title: page.title,
          slug: page.slug,
          content: page.content,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          sortOrder: String(page.sortOrder),
          isPublished: page.isPublished,
          showInFooter: page.showInFooter,
            legacyPath: page.legacyPath ?? "",
            // Không tick sẵn (Ngày 15 B2): xem trang trực tiếp.
            confirmReplace: false,
        }}
      />
    </ProductModal>
  );
}
