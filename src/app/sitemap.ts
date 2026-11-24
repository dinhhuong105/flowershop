import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { siteConfig } from "@/config/site";

// Sitemap (Ngày 9, lộ trình gốc): trang tĩnh + danh mục + sản phẩm
// đang bán. force-dynamic để không truy vấn DB lúc `next build`
// (layout cũng đọc DB nên đã force-dynamic).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now },
    { url: `${base}/faq`, lastModified: now },
    { url: `${base}/about`, lastModified: now },
    { url: `${base}/contact`, lastModified: now },
    { url: `${base}/policy`, lastModified: now },
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
  ];
}
