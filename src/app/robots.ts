import type { MetadataRoute } from "next";

// robots.txt hợp lệ (Lighthouse SEO: /robots.txt trước đây trả về trang 404).
// Chưa có sitemap — thêm khi có trang tĩnh đầy đủ (Ngày 9).
// Trang giỏ / thanh toán / đơn hàng không cho bot lập chỉ mục (Ngày 4).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/gio-hang", "/thanh-toan", "/don-hang"],
    },
  };
}
