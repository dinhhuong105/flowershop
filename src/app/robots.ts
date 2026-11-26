import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getSettings } from "@/lib/settings-cache";

// robots.txt hợp lệ (Lighthouse SEO: /robots.txt trước đây trả về trang 404).
// Sitemap thêm ở Ngày 9 (trang tĩnh + danh mục + sản phẩm đang bán).
// Trang giỏ / thanh toán / đơn hàng không cho bot lập chỉ mục (Ngày 4).
// Ngày 13 C3: tắt allowIndexing trong Cài đặt SEO thì chặn toàn site
// (Disallow /) — sitemap vẫn liệt kê để khi bật lại không phải sửa.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  const sitemap = `${siteConfig.url.replace(/\/$/, "")}/sitemap.xml`;
  if (!settings.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
      sitemap,
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/order", "/search", "/admin", "/login", "/api/"],
    },
    sitemap,
  };
}
