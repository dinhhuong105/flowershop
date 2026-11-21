import type { MetadataRoute } from "next";

// robots.txt hợp lệ (Lighthouse SEO: /robots.txt trước đây trả về trang 404).
// Chưa có sitemap — thêm khi có trang tĩnh đầy đủ (Ngày 9).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
