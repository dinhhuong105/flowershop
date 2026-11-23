import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isValidAdminPasswordHash } from "./lib/admin/config-format";

// Middleware làm ba việc:
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
//
// Xác thực KHÔNG dựa vào middleware: mỗi Server Action, route handler
// và trang quản trị tự gọi requireAdmin() ở câu lệnh đầu tiên.
const LEGACY_REDIRECTS: Record<string, string> = {
  "/gio-hang": "/cart",
  "/thanh-toan": "/checkout",
  "/tim-kiem": "/search",
  "/don-hang": "/order",
};

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
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!isValidAdminPasswordHash(hash)) {
    return new NextResponse("Chưa cấu hình quản trị", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const headers = new Headers(request.headers);
  headers.set("x-admin-area", "1");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/gio-hang",
    "/thanh-toan",
    "/tim-kiem",
    "/don-hang",
    "/don-hang/:path*",
  ],
};
