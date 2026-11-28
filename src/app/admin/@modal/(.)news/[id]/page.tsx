import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminNews } from "@/lib/admin/news";
import { formatVnDateTimeLocal } from "@/lib/vn-datetime";
import { updateNewsAction } from "@/app/actions/admin";
import NewsForm from "@/components/admin/NewsForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup sửa bài tin tức (intercepting route, Ngày 18 — theo mẫu
// trang tĩnh): chỉ render khi điều hướng tới từ trong admin — danh
// sách ở dưới vẫn hiện, URL đổi thành /admin/news/[id]. Vào trực
// tiếp URL thì trang /admin/news/[id] đầy đủ hiện thay (không phải
// popup này).
export default async function AdminEditNewsModal({
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
    <ProductModal title={`Sửa bài: ${article.title}`}>
      <NewsForm
        mode="edit"
        action={updateNewsAction.bind(null, article.id)}
        onSuccess="back"
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
    </ProductModal>
  );
}
