import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminNews } from "@/lib/admin/news";
import { formatVnDateTimeLocal } from "@/lib/vn-datetime";
import { updateNewsAction } from "@/app/actions/admin";
import NewsForm from "@/components/admin/NewsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sửa bài tin tức",
  robots: { index: false, follow: false },
};

// Trang sửa bài tin tức đầy đủ (Ngày 18 — theo mẫu trang tĩnh):
// chỉ hiện khi vào trực tiếp URL /admin/news/[id] — bấm từ danh
// sách thì popup (intercepting route @modal) hiện thay.
export default async function AdminEditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isInteger(newsId) || newsId <= 0) notFound();
  const article = await getAdminNews(newsId);
  if (!article) notFound();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Sửa bài: {article.title}</h1>
      <div className="mt-6">
        <NewsForm
          mode="edit"
          action={updateNewsAction.bind(null, article.id)}
          onSuccess="list"
          originalSlug={article.slug}
          originalPublished={article.isPublished}
          initial={{
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            content: article.content,
            coverImage: article.coverImage,
            author: article.author,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            publishedAt: formatVnDateTimeLocal(article.publishedAt),
            isPublished: article.isPublished,
          }}
        />
      </div>
    </div>
  );
}
