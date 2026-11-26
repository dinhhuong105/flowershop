import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createPageAction } from "@/app/actions/admin";
import PageForm from "@/components/admin/PageForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thêm trang tĩnh",
  robots: { index: false, follow: false },
};

// Trang thêm trang tĩnh đầy đủ (Ngày 13 B3): chỉ hiện khi vào trực
// tiếp URL /admin/pages/new — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminNewPagePage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Thêm trang tĩnh</h1>
      <div className="mt-6">
        <PageForm
          mode="create"
          action={createPageAction}
          onSuccess="list"
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
            confirmReplace: false,
          }}
        />
      </div>
    </div>
  );
}
