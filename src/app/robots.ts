import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

// robots.txt hợp lệ (Lighthouse SEO: /robots.txt trước đây trả về trang 404).
// Sitemap thêm ở Ngày 9 (trang tĩnh + danh mục + sản phẩm đang bán).
// Trang giỏ / thanh toán / đơn hàng không cho bot lập chỉ mục (Ngày 4).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/order", "/search", "/admin", "/login", "/api/"],
    },
    sitemap: `${siteConfig.url.replace(/\/$/, "")}/sitemap.xml`,
  };
}
