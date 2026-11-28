// Giới hạn tốc độ dùng chung (Ngày 17 S9): bộ đếm trong DB
// (môi trường serverless không giữ bộ nhớ nên không dùng Map
// trong tiến trình). Agent làm đơn hàng / tra cứu đơn / tìm kiếm
// / nhập sản phẩm / liên hệ DÙNG module này — không tự viết
// bộ đếm riêng.
//
// Cách dùng:
//   const r = await checkRateLimit({ key: "login:ip:<hash>", limit: 5, windowMs: 15*60*1000 });
//   if (!r.allowed) → trả 429 (Retry-After: r.retryAfterSeconds).
//   await resetRateLimit(key) → mở khóa sớm (vd sau khi đăng nhập đúng).
//   await pruneRateLimitEvents() → dọn hàng cũ (gọi kèm khi ghi thành công).
//
// Khóa: chuỗi đã chuẩn hóa, KHÔNG chứa IP thô hay PII — tầng gọi
// băm IP trước (xem hashIp trong ./admin/rate-limit.ts). Tiền tố
// gợi ý: "login:ip:", "order:ip:", "lookup:ip:", "search:ip:",
// "import:ip:", "contact:ip:", "login:global", "order:global".
// Cửa sổ trượt: đếm sự kiện trong [now - window, now]; mỗi lần
// check thành công ghi 1 sự kiện (kể cả lần bị chặn? KHÔNG —
// lần bị chặn không ghi, để khóa tự mở khi cửa sổ trôi qua).

import { db } from "./db";

export const DEFAULT_RATE_LIMIT_PRUNE_AFTER_MS = 24 * 60 * 60 * 1000; // dọn hàng > 24h

// Chuẩn hóa khóa: cắt khoảng trắng, tối đa 200 ký tự, chỉ cho
// chữ/số và : - _ . / — ký tự lạ (kể cả NUL) bị thay bằng "_".
export function normalizeRateLimitKey(raw: string): string {
  return (raw ?? "")
    .trim()
    .slice(0, 200)
    .replace(/[^A-Za-z0-9:._\-/]/g, "_");
}

// Đầu cửa sổ trượt (thuần, để test được): now - windowMs.
export function rateLimitWindowStart(now: Date, windowMs: number): Date {
  return new Date(now.getTime() - windowMs);
}

export type RateLimitCheck = {
  allowed: boolean;
  // Số lượt còn lại trong cửa sổ SAU lần này (0 khi bị chặn).
  remaining: number;
  // Giây phải chờ trước khi thử lại (0 khi được phép).
  retryAfterSeconds: number;
  // Thời điểm cửa sổ hiện tại hết hạn (để đặt header Retry-After / X-RateLimit-Reset).
  resetAt: Date;
};

// Kiểm tra + ghi sự kiện khi được phép. Hai lần gọi đồng thời
// có thể cùng thấy count < limit (đua nhẹ) — chấp nhận được cho
// giới hạn chống lạm dụng (không phải đếm tiền); giới hạn đăng
// nhập 5 lần/15 phút vẫn giữ nguyên qua module cũ (xem
// ./admin/rate-limit.ts) cho tới khi agent sau chuyển hẳn sang đây.
export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitCheck> {
  const key = normalizeRateLimitKey(opts.key);
  if (key === "") throw new Error("rate-limit: khóa trống");
  if (!Number.isInteger(opts.limit) || opts.limit < 1) {
    throw new Error("rate-limit: limit phải là số nguyên ≥ 1");
  }
  if (!Number.isFinite(opts.windowMs) || opts.windowMs <= 0) {
    throw new Error("rate-limit: windowMs phải > 0");
  }
  const now = opts.now ?? new Date();
  const since = rateLimitWindowStart(now, opts.windowMs);
  const count = await db.rateLimitEvent.count({
    where: { key, createdAt: { gte: since } },
  });
  if (count >= opts.limit) {
    // Lần bị chặn: tìm sự kiện CŨ NHẤT trong cửa sổ để tính thời
    // điểm mở khóa (sự kiện đó rời cửa sổ đầu tiên).
    const oldest = await db.rateLimitEvent.findFirst({
      where: { key, createdAt: { gte: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const resetAt = oldest
      ? new Date(oldest.createdAt.getTime() + opts.windowMs)
      : new Date(now.getTime() + opts.windowMs);
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
    );
    return { allowed: false, remaining: 0, retryAfterSeconds, resetAt };
  }
  await db.rateLimitEvent.create({ data: { key } });
  return {
    allowed: true,
    remaining: opts.limit - count - 1,
    retryAfterSeconds: 0,
    resetAt: new Date(now.getTime() + opts.windowMs),
  };
}

// Mở khóa sớm cho một khóa (vd đăng nhập đúng → xóa lần sai).
export async function resetRateLimit(key: string): Promise<number> {
  const { count } = await db.rateLimitEvent.deleteMany({
    where: { key: normalizeRateLimitKey(key) },
  });
  return count;
}

// Dọn hàng cũ hơn ngưỡng (mặc định 24h) — gọi kèm khi ghi thành
// công hoặc từ cron dọn dẹp. Trả số hàng đã xóa.
export async function pruneRateLimitEvents(
  olderThanMs: number = DEFAULT_RATE_LIMIT_PRUNE_AFTER_MS,
): Promise<number> {
  const before = new Date(Date.now() - olderThanMs);
  const { count } = await db.rateLimitEvent.deleteMany({
    where: { createdAt: { lt: before } },
  });
  return count;
}

// ---------------------------------------------------------------------------
// Ngày 19 A4 — lỗi bộ đếm DB: ĐÓNG hay MỞ tùy nhóm.
//
// `checkRateLimit` gốc NÉM lỗi khi DB bộ đếm lỗi; tầng gọi trước đây
// tự chọn fail-open (tra cứu, đặt hàng) hay không bắt gì cả. Từ
// Ngày 19, chính sách tập trung ở đây — tầng gọi chỉ chọn một trong
// hai hàm dưới, không tự try/catch lén:
//
// - `checkRateLimitFailClosed`: ĐÓNG khi bộ đếm lỗi (trả allowed:
//   false + counterUnavailable: true). Dùng cho: đăng nhập, đặt
//   hàng, tra cứu đơn, nhập sản phẩm, TOTP (Phần C: khóa
//   "totp:ip:<hash>" / "totp:admin", vd limit 5/15 phút — dùng đúng
//   hàm này, không viết bộ đếm riêng).
// - `checkRateLimitFailOpen`: MỞ khi bộ đếm lỗi (trả allowed: true
//   + counterUnavailable: true). CHỈ dùng cho tìm kiếm công khai.
//
// Cả hai đều ghi log lỗi (để S12 thấy bộ đếm sập) và KHÔNG ném.
export type RateLimitCheckWithAvailability = RateLimitCheck & {
  // true khi bộ đếm DB lỗi và kết quả là giá trị dự phòng.
  counterUnavailable: boolean;
};

function rateLimitUnavailableFallback(opts: {
  limit: number;
  windowMs: number;
  now: Date;
  allowed: boolean;
}): RateLimitCheckWithAvailability {
  return {
    allowed: opts.allowed,
    remaining: opts.allowed ? opts.limit : 0,
    // Cho phép thử lại sau 60 s khi bộ đếm sập (tầng gọi đặt
    // Retry-After theo số này).
    retryAfterSeconds: opts.allowed ? 0 : 60,
    resetAt: new Date(opts.now.getTime() + opts.windowMs),
    counterUnavailable: true,
  };
}

export async function checkRateLimitFailClosed(opts: {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitCheckWithAvailability> {
  const now = opts.now ?? new Date();
  try {
    return { ...(await checkRateLimit(opts)), counterUnavailable: false };
  } catch (error) {
    console.error(
      "[rate-limit] Bộ đếm DB lỗi, ĐÓNG (fail-closed):",
      error instanceof Error ? error.message : error,
    );
    return rateLimitUnavailableFallback({
      limit: opts.limit,
      windowMs: opts.windowMs,
      now,
      allowed: false,
    });
  }
}

export async function checkRateLimitFailOpen(opts: {
  key: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitCheckWithAvailability> {
  const now = opts.now ?? new Date();
  try {
    return { ...(await checkRateLimit(opts)), counterUnavailable: false };
  } catch (error) {
    console.error(
      "[rate-limit] Bộ đếm DB lỗi, MỞ (fail-open, chỉ tìm kiếm công khai):",
      error instanceof Error ? error.message : error,
    );
    return rateLimitUnavailableFallback({
      limit: opts.limit,
      windowMs: opts.windowMs,
      now,
      allowed: true,
    });
  }
}
