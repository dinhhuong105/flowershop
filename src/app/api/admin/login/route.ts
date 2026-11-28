import { NextResponse } from "next/server";
import {
  clientIpFromHeaders,
  createAdminPendingSession,
  createAdminSession,
  getAdminConfig,
  verifyAdminCredentials,
} from "@/lib/admin/auth";
import {
  isTotpEscapeHatchActive,
  isTotpLoginRequired,
  recordTotpAudit,
} from "@/lib/admin/totp-store";
import {
  cleanupAdminLoginAttempts,
  checkAdminLoginLimit,
  hashIp,
  recordAdminLoginAttempt,
} from "@/lib/admin/rate-limit";

// Đăng nhập quản trị (Ngày 7 §2): TÀI KHOẢN + MẬT KHẨU.
// Ngoại lệ có chủ đích với D7-5: route này KHÔNG gọi requireAdmin()
// vì nó TẠO phiên (giống như trang đăng nhập là cửa vào).
//
// Hai dạng gọi:
// - JSON (fetch từ form đăng nhập): trả { ok } + mã 200/401/429/503.
// - Form thường (không JS): redirect 303 về /admin khi đúng,
//   về /login?error=... khi sai (giữ lại tên đăng nhập đã nhập).
// (Ngày 9: /admin là trang tổng quan, thay /admin/orders.)
// Lỗi luôn là thông báo chung, không lộ tài khoản hay mật khẩu sai
// chỗ nào. Quá 5 lần sai/15 phút theo IP (hoặc 20 lần toàn hệ thống)
// → 429 kể cả khi nhập đúng (D7-7).

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Tên đăng nhập hoặc mật khẩu không đúng.";

// Redirect về đúng host trình duyệt đang dùng: request.url của máy
// chủ standalone dựng từ địa chỉ listen (0.0.0.0:3000) nên phải thay
// host bằng header Host (xem sửa tương tự ở route upload).
function redirectUrl(request: Request, path: string): URL {
  const url = new URL(path, request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url;
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let username = "";
  let password = "";
  if (isJson) {
    const body: unknown = await request.json().catch(() => null);
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      username = typeof b.username === "string" ? b.username : "";
      password = typeof b.password === "string" ? b.password : "";
    }
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      const u = form.get("username");
      const p = form.get("password");
      username = typeof u === "string" ? u : "";
      password = typeof p === "string" ? p : "";
    }
  }

  if (!getAdminConfig()) {
    if (isJson) {
      return NextResponse.json(
        { ok: false, error: "Chưa cấu hình quản trị." },
        { status: 503 },
      );
    }
    return new Response("Chưa cấu hình quản trị", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ipHash = hashIp(clientIpFromHeaders(request.headers));
  // Ngày 19 A4: bộ đếm DB lỗi → ĐÓNG (429 "Thử lại sau"), không
  // cho đăng nhập khi không đếm được lần sai.
  const loginLimit = await checkAdminLoginLimit(ipHash);
  if (loginLimit.limited) {
    const error = loginLimit.unavailable
      ? "Hệ thống đang bận, vui lòng thử lại sau."
      : "Quá nhiều lần đăng nhập sai, vui lòng thử lại sau 15 phút.";
    if (isJson) {
      return NextResponse.json(
        { ok: false, error },
        {
          status: 429,
          headers: { "Retry-After": loginLimit.unavailable ? "60" : "900" },
        },
      );
    }
    return NextResponse.redirect(
      redirectUrl(request, `/login?error=rate&u=${encodeURIComponent(username)}`),
    );
  }

  const ok = await verifyAdminCredentials(username, password);
  if (!ok) {
    // Ghi lần sai vào bộ đếm; ghi lỗi thì chỉ log (đăng nhập vốn
    // đã bị từ chối 401 — không để lỗi ghi bộ đếm biến thành 500).
    await recordAdminLoginAttempt(ipHash).catch((error: unknown) => {
      console.error(
        "[admin login] Không ghi được lần sai vào bộ đếm:",
        error instanceof Error ? error.message : error,
      );
    });
    if (isJson) {
      return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
    }
    return NextResponse.redirect(
      redirectUrl(request, `/login?error=1&u=${encodeURIComponent(username)}`),
    );
  }

  // Ngày 19 Phần C — TOTP: đúng mật khẩu nhưng 2FA đang bật thì
  // chỉ tạo phiên "chờ xác minh" (cookie riêng, hạn 5 phút), CHƯA
  // tạo phiên đầy đủ; client chuyển sang /login/verify để nhập mã.
  if (await isTotpLoginRequired()) {
    await createAdminPendingSession();
    await cleanupAdminLoginAttempts().catch(() => undefined);
    if (isJson) return NextResponse.json({ ok: true, totpRequired: true });
    return NextResponse.redirect(redirectUrl(request, "/login/verify"), {
      status: 303,
    });
  }
  // Thoát hiểm: 2FA đã bật nhưng ADMIN_TOTP_DISABLE=1 → bỏ qua
  // bước TOTP lần này, ghi nhật ký mỗi lần dùng.
  if (await isTotpEscapeHatchActive()) {
    await recordTotpAudit("escape-used");
  }

  await createAdminSession();
  await cleanupAdminLoginAttempts().catch(() => undefined);
  if (isJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(redirectUrl(request, "/admin"), {
    status: 303,
  });
}
