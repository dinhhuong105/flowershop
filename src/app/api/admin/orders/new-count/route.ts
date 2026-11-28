import { NextResponse } from "next/server";
import {
  AdminNotConfiguredError,
  clientIpFromHeaders,
  requireAdmin,
} from "@/lib/admin/auth";
import { hashIp } from "@/lib/admin/rate-limit";
import { checkRateLimitFailClosed } from "@/lib/rate-limit";
import {
  NEW_ORDER_COUNT_RATE_LIMIT,
  NEW_ORDER_COUNT_RATE_WINDOW_MS,
  getNewOrderCount,
} from "@/lib/admin/new-orders";

// Kiểm tra đơn mới định kỳ (Ngày 17 N1): trình duyệt admin hỏi mỗi
// 60 giây số đơn "cần xử lý" và mã đơn mới nhất. Chỉ trả đúng 2
// trường đó — không trả dữ liệu khách (tên, SĐT, địa chỉ, tổng
// tiền). Yêu cầu phiên admin (S1), Cache-Control: no-store, giới
// hạn tốc độ theo IP đã băm (S9, module dùng chung).
//
// Thứ tự kiểm tra: requireAdmin → giới hạn tốc độ → DB. Chưa đăng
// nhập → 401 (không tiêu hao lượt giới hạn); quá giới hạn → 429
// kèm Retry-After.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// redirect() trong requireAdmin() ném lỗi có digest NEXT_REDIRECT —
// bắt để trả 401 thay vì redirect (route handler không nên redirect;
// mẫu theo src/app/api/admin/upload/route.ts).
function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "Chưa cấu hình quản trị." },
        { status: 503, headers: NO_STORE },
      );
    }
    if (isRedirectError(error)) {
      return NextResponse.json(
        { ok: false, error: "Chưa đăng nhập." },
        { status: 401, headers: NO_STORE },
      );
    }
    throw error;
  }

  const ipHash = hashIp(clientIpFromHeaders(request.headers));
  // Ngày 19 A4: bộ đếm DB lỗi → ĐÓNG (429 "Thử lại sau"), không
  // trả 500 và không cho qua khi không đếm được.
  const limited = await checkRateLimitFailClosed({
    key: `new-count:ip:${ipHash}`,
    limit: NEW_ORDER_COUNT_RATE_LIMIT,
    windowMs: NEW_ORDER_COUNT_RATE_WINDOW_MS,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: limited.counterUnavailable
          ? "Hệ thống đang bận, vui lòng thử lại sau."
          : "Quá nhiều yêu cầu, vui lòng thử lại sau.",
      },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(limited.retryAfterSeconds),
        },
      },
    );
  }

  const { pendingCount, latestCode } = await getNewOrderCount();
  return NextResponse.json(
    { pendingCount, latestCode },
    { headers: NO_STORE },
  );
}
