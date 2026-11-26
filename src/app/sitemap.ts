import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteConfig } from "@/config/site";

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
  const staticPages: MetadataRoute.Sitemap = [
    { url: base },
    { url: `${base}/faq` },
    { url: `${base}/about` },
    { url: `${base}/contact` },
    { url: `${base}/policy` },
  ];
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
  // Trang tĩnh đã xuất bản (Ngày 13 B4): chỉ trang đã xuất bản mới
  // vào sitemap; nháp không lộ.
  const pages = await db.page.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  return [
    ...staticPages,
    ...categories.map((c) => ({
      url: `${base}/${c.slug}`,
      lastModified: c.updatedAt,
    })),
    ...products.map((p) => ({
      url: `${base}/${p.category.slug}/${p.slug}`,
      lastModified: p.updatedAt,
    })),
    ...pages.map((p) => ({
      url: `${base}/trang/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
