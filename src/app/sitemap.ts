import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteConfig } from "@/config/site";
import { getCachedLegacyReplacements as getLegacyReplacements } from "@/lib/pages-cache";

// Sitemap (Ngày 9, lộ trình gốc): trang tĩnh + danh mục + sản phẩm
// đang bán. force-dynamic để không truy vấn DB lúc `next build`
// (layout cũng đọc DB nên đã force-dynamic).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  // Trang tĩnh KHÔNG có lastmod (sửa 12 mục verdict Ngày 9, mục 12):
  // trước đây lastModified: now đổi mỗi lần request, Google dần bỏ
  // qua tín hiệu này. Danh mục/sản phẩm giữ lastmod thật theo
  // updatedAt trong DB.
  // Đường dẫn cũ đã có trang thay thế thì KHÔNG vào sitemap
  // (Ngày 14 C3) — chỉ trang mới được lập chỉ mục.
  const replacements = await getLegacyReplacements();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base },
    { url: `${base}/faq` },
    { url: `${base}/about` },
    { url: `${base}/contact` },
    { url: `${base}/policy` },
  ].filter((entry) => {
    const path = entry.url.slice(base.length);
    return !replacements.has(path);
  });
  const categories = await db.category.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { sortOrder: "asc" },
  });
  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      slug: true,
      updatedAt: true,
      category: { select: { slug: true } },
    },
    orderBy: { id: "asc" },
  });
  // Trang tĩnh đã xuất bản (Ngày 13 B4, Ngày 14: ở slug gốc, bỏ
  // /trang theo lệnh Henry 26/11): chỉ trang đã xuất bản mới vào
  // sitemap; nháp không lộ.
  const pages = await db.page.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  // Trang tin tức (Ngày 18): /tin-tuc + các bài đã xuất bản
  // (lastmod theo updatedAt); nháp không lộ. Ngày 19 A1: bài hẹn
  // giờ tương lai cũng không lộ.
  const news = await db.newsArticle.findMany({
    where: {
      isPublished: true,
      OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    },
    select: { slug: true, updatedAt: true },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
  });
  return [
    ...staticPages,
    { url: `${base}/tin-tuc` },
    ...news.map((n) => ({
      url: `${base}/tin-tuc/${n.slug}`,
      lastModified: n.updatedAt,
    })),
    ...categories.map((c) => ({
      url: `${base}/${c.slug}`,
      lastModified: c.updatedAt,
    })),
    ...products.map((p) => ({
      url: `${base}/${p.category.slug}/${p.slug}`,
      lastModified: p.updatedAt,
    })),
    ...pages.map((p) => ({
      url: `${base}/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
