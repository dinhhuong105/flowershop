import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminPage } from "@/lib/admin/pages";
import { updatePageAction } from "@/app/actions/admin";
import PageForm from "@/components/admin/PageForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sửa trang tĩnh",
  robots: { index: false, follow: false },
};

// Trang sửa trang tĩnh đầy đủ (Ngày 13 B3): chỉ hiện khi vào trực
// tiếp URL /admin/pages/[id] — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminEditPagePage({
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
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Sửa trang {page.title}</h1>
      <div className="mt-6">
        <PageForm
          mode="edit"
          action={updatePageAction.bind(null, page.id)}
          onSuccess="list"
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
          }}
        />
      </div>
    </div>
  );
}
