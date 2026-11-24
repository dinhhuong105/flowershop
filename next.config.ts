import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Đảm bảo query engine của Prisma được đưa vào bản standalone.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/.prisma/client/**/*"],
  },
  // F-6 (thử): trả HTML đầy đủ cho bot chỉ cần HTML — Lighthouse dùng
  // user-agent Chrome-Lighthouse nên trang /hoa-tuoi (và trang chi tiết)
  // có thể được đo SEO đúng hơn. Regex = danh sách mặc định của Next
  // (xem node_modules/next/dist/server/config-shared.d.ts) + thêm
  // Chrome-Lighthouse. CHỈ ở cấp cao nhất của NextConfig, KHÔNG nằm
  // trong `experimental` (Next 15.5 đặt ở đây). Kết quả đo ở báo cáo
  // Ngày 4 (D4-30/F-6).
  htmlLimitedBots:
    /Mediapartners-Google|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Chrome-Lighthouse/i,
  // Trang đơn hàng chứa thông tin cá nhân: không cho cache (mục 7 Ngày 5).
  // Trang quản trị đơn cũng vậy (Ngày 8 D8-11).
  async headers() {
    return [
      {
        source: "/order/:code",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/admin",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/admin/orders",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/admin/orders/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  // URL cũ (tiếng Việt) → URL mới (tiếng Anh), 301 vĩnh viễn —
  // quyết định của Henry 23/11 (Ngày 7, xem "Khác đặc tả" báo cáo
  // Ngày 7). Đặt trong src/middleware.ts (redirects() của Next.js
  // trả 308, không đúng 301 yêu cầu). Đây là chỗ DUY NHẤT trong code
  // còn nhắc URL cũ.
};

export default nextConfig;
