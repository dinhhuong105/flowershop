import { NextResponse } from "next/server";
import {
  clientIpFromHeaders,
  createAdminSession,
  destroyAdminPendingSession,
  getAdminPendingSession,
} from "@/lib/admin/auth";
import { hashIp } from "@/lib/admin/rate-limit";
import { checkRateLimitFailClosed, resetRateLimit } from "@/lib/rate-limit";
import {
  isTotpEscapeHatchActive,
  isTotpLoginRequired,
  recordTotpAudit,
  verifyTotpOrRecoveryCode,
} from "@/lib/admin/totp-store";

// Xác minh mã TOTP / mã khôi phục sau khi đăng nhập đúng mật khẩu
// (Ngày 19 Phần C). Ngoại lệ có chủ đích với S1: route này KHÔNG
// gọi requireAdmin() vì nó ĐỔI phiên "chờ xác minh" thành phiên
// đầy đủ (giống route login tạo phiên).
//
// Hai dạng gọi:
// - JSON (fetch từ form xác minh): trả { ok } + mã 200/401/403/429.
// - Form thường (không JS): redirect 303 về /admin khi đúng,
//   về /login/verify?error=... khi sai.
// Tham số chuyển hướng sau xác minh KHÔNG nhận từ client (luôn về
// /admin) nên không có open redirect. Lỗi luôn chung chung ("Mã
// xác thực không đúng") — không nói sai mã TOTP hay mã khôi phục,
// không nói mã đã dùng rồi hay hết hạn.
// Giới hạn: 5 lần sai/15 phút theo IP (totp:ip:<hash>) và toàn hệ
// thống (totp:admin), dùng checkRateLimitFailClosed — bộ đếm DB lỗi
// → ĐÓNG (429 "Thử lại sau").

export const dynamic = "force-dynamic";

const TOTP_RATE_LIMIT = 5;
const TOTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const GENERIC_ERROR = "Mã xác thực không đúng.";
const RATE_ERROR = "Quá nhiều lần thử sai, vui lòng thử lại sau 15 phút.";
const UNAVAILABLE_ERROR = "Hệ thống đang bận, vui lòng thử lại sau.";
const EXPIRED_ERROR = "Phiên xác minh đã hết hạn, vui lòng đăng nhập lại.";

function redirectUrl(request: Request, path: string): URL {
  const url = new URL(path, request.url);
  const host = request.headers.get("host");
  if (host) url.host = host;
  return url;
}

// Origin phải trùng Host (chống CSRF) — thiếu hoặc lạ → 403.
// (Mẫu như route upload: không dùng new URL(request.url).host vì
// máy chủ standalone dựng request.url từ địa chỉ listen.)
function originMatches(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  return originHost === host;
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let code = "";
  if (isJson) {
    const body: unknown = await request.json().catch(() => null);
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      code = typeof b.code === "string" ? b.code : "";
    }
  } else {
    const form = await request.formData().catch(() => null);
    if (form) {
      const c = form.get("code");
      code = typeof c === "string" ? c : "";
    }
  }

  if (!originMatches(request)) {
    if (isJson) {
      return NextResponse.json({ ok: false, error: "Yêu cầu không hợp lệ." }, { status: 403 });
    }
    return NextResponse.redirect(redirectUrl(request, "/login/verify?error=1"), { status: 303 });
  }

  // Không có phiên chờ xác minh (hết 5 phút / đã đăng xuất) →
  // bắt đăng nhập lại từ đầu.
  const pending = await getAdminPendingSession();
  if (!pending) {
    if (isJson) {
      return NextResponse.json({ ok: false, error: EXPIRED_ERROR }, { status: 401 });
    }
    return NextResponse.redirect(redirectUrl(request, "/login?error=expired"), { status: 303 });
  }

  // 2FA không còn hiệu lực (đã tắt / thiếu khóa / thoát hiểm) →
  // phiên chờ đủ điều kiện thành phiên đầy đủ (mật khẩu đã đúng).
  // Thoát hiểm thì ghi nhật ký mỗi lần dùng.
  if (!(await isTotpLoginRequired())) {
    if (await isTotpEscapeHatchActive()) {
      await recordTotpAudit("escape-used");
    }
    await destroyAdminPendingSession();
    await createAdminSession();
    if (isJson) return NextResponse.json({ ok: true });
    return NextResponse.redirect(redirectUrl(request, "/admin"), { status: 303 });
  }

  const ipHash = hashIp(clientIpFromHeaders(request.headers));
  const ipKey = `totp:ip:${ipHash}`;
  const adminKey = "totp:admin";
  // Ngày 19 A4: bộ đếm DB lỗi → ĐÓNG (429 "Thử lại sau"), không
  // cho xác minh khi không đếm được lần sai.
  const [ipLimit, adminLimit] = await Promise.all([
    checkRateLimitFailClosed({ key: ipKey, limit: TOTP_RATE_LIMIT, windowMs: TOTP_RATE_WINDOW_MS }),
    checkRateLimitFailClosed({ key: adminKey, limit: TOTP_RATE_LIMIT, windowMs: TOTP_RATE_WINDOW_MS }),
  ]);
  const blocked = !ipLimit.allowed || !adminLimit.allowed;
  if (blocked) {
    const unavailable = ipLimit.counterUnavailable || adminLimit.counterUnavailable;
    const retryAfter = unavailable
      ? 60
      : Math.max(ipLimit.retryAfterSeconds, adminLimit.retryAfterSeconds);
    const error = unavailable ? UNAVAILABLE_ERROR : RATE_ERROR;
    if (isJson) {
      return NextResponse.json(
        { ok: false, error },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    return NextResponse.redirect(redirectUrl(request, "/login/verify?error=rate"), {
      status: 303,
    });
  }

  const result = await verifyTotpOrRecoveryCode(code);
  if (!result.ok) {
    await recordTotpAudit("failed");
    if (isJson) {
      return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
    }
    return NextResponse.redirect(redirectUrl(request, "/login/verify?error=1"), { status: 303 });
  }

  await destroyAdminPendingSession();
  await createAdminSession();
  await resetRateLimit(ipKey).catch(() => undefined);
  await resetRateLimit(adminKey).catch(() => undefined);
  if (isJson) return NextResponse.json({ ok: true });
  return NextResponse.redirect(redirectUrl(request, "/admin"), { status: 303 });
}
