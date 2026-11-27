import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildSecurityHeaders } from "./lib/security-headers";
import { isValidAdminPasswordHash } from "./lib/admin/config-format";

// Middleware làm bốn việc:
// 1. Redirect 301 URL shop cũ (tiếng Việt) sang URL mới (tiếng Anh) —
//    quyết định của Henry 23/11 (Ngày 7). Đặt ở middleware (không
//    dùng next.config.ts) vì redirects() của Next.js trả 308, còn
//    yêu cầu là 301 chính xác. Query string giữ nguyên. Slug danh
//    mục/sản phẩm (lấy từ DB) không đổi.
// 2. Cửa 503 khi chưa cấu hình quản trị (Ngày 7 §2/D7-4): không có
//    ADMIN_PASSWORD_HASH hoặc sai định dạng → mọi /admin/* và /login
//    trả 503 "Chưa cấu hình quản trị", không bao giờ cho vào.
// 3. Đánh dấu khu vực quản trị bằng header x-admin-area để layout
//    gốc bỏ Header/Footer/giỏ của shop trên các trang này (Ngày 7 §2:
//    layout quản trị riêng, không truy vấn giỏ).
// 4. Header bảo mật (Ngày 17 S10) cho MỌI phản hồi: CSP dùng nonce
//    sinh mới mỗi request (đặt vào header request x-nonce để layout
//    gốc đọc và gắn vào thẻ <script> nội tuyến; script của chính
//    Next.js cũng dùng nonce này), HSTS ở production, nosniff,
//    Referrer-Policy, Permissions-Policy, X-Frame-Options.
//
// Xác thực KHÔNG dựa vào middleware: mỗi Server Action, route handler
// và trang quản trị tự gọi requireAdmin() ở câu lệnh đầu tiên.
const LEGACY_REDIRECTS: Record<string, string> = {
  "/gio-hang": "/cart",
  "/thanh-toan": "/checkout",
  "/tim-kiem": "/search",
  "/don-hang": "/order",
};

function isAdminAreaPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /don-hang/[mã] → /order/[mã] (giữ nguyên phần mã).
  if (pathname === "/don-hang" || pathname.startsWith("/don-hang/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/order${pathname.slice("/don-hang".length)}`;
    return NextResponse.redirect(url, 301);
  }
  const destination = LEGACY_REDIRECTS[pathname];
  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return NextResponse.redirect(url, 301);
  }

  const isAdminArea = isAdminAreaPath(pathname);
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (isAdminArea && !isValidAdminPasswordHash(hash)) {
    return new NextResponse("Chưa cấu hình quản trị", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Nonce CSP mới mỗi request (Web Crypto — middleware chạy Edge
  // runtime nên không import được node:crypto); layout gốc đọc qua headers().
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  if (isAdminArea) requestHeaders.set("x-admin-area", "1");

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const securityHeaders = buildSecurityHeaders({
    nonce,
    isProduction: process.env.NODE_ENV === "production",
  });
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    // Mọi route trừ tài nguyên tĩnh (/_next/static, /_next/image,
    // favicon) — header bảo mật phải có cả ở trang shop lẫn admin.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
