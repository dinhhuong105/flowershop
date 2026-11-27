import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createNewsAction } from "@/app/actions/admin";
import NewsForm from "@/components/admin/NewsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thêm bài tin tức",
  robots: { index: false, follow: false },
};

// Trang thêm bài tin tức đầy đủ (Ngày 18 — theo mẫu trang tĩnh):
// chỉ hiện khi vào trực tiếp URL /admin/news/new — bấm từ danh sách
// thì popup (intercepting route @modal) hiện thay.
export default async function AdminNewNewsPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Thêm bài tin tức</h1>
      <div className="mt-6">
        <NewsForm
          mode="create"
          action={createNewsAction}
          onSuccess="list"
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
      </div>
    </div>
  );
}
