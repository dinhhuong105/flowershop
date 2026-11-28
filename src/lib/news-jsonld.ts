// JSON-LD Article cho trang chi tiết tin tức (Ngày 19 A1).
// Module thuần (không import next/*) để unit test được.
//
// Quy tắc: CHỈ trường có dữ liệu mới đưa vào (không bịa author,
// image, description); tác giả trống thì BỎ author (A2 — không
// lấy tên admin, không dùng "admin"). Thoát an toàn khi nhúng vào
// <script type="application/ld+json"> bằng escapeJsonForScript
// (xem trang chi tiết) — JSON.stringify không thoát "<" nên tên/
// tóm tắt chứa "</script>" sẽ thoát khỏi thẻ script (S3).
import { toAbsoluteImageUrl } from "./storage";
import type { PublishedNewsArticle } from "./admin/news";

export function articleJsonLd(
  article: Pick<
    PublishedNewsArticle,
    | "title"
    | "excerpt"
    | "coverImage"
    | "author"
    | "publishedAt"
    | "createdAt"
    | "updatedAt"
    | "seoDescription"
  >, // seoTitle chỉ dùng cho <title>, không vào JSON-LD
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
  };
  const description =
    article.seoDescription !== "" ? article.seoDescription : article.excerpt;
  if (description !== "") ld.description = description;
  if (article.coverImage !== "") {
    ld.image = toAbsoluteImageUrl(article.coverImage);
  }
  // A2: tác giả trống → không có author (không lấy tên admin).
  if (article.author !== "") {
    ld.author = { "@type": "Person", name: article.author };
  }
  return ld;
}
