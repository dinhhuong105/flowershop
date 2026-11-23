import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isValidAdminPasswordHash } from "./config-format";
import { verifyAdminPassword } from "./password";

// Đăng nhập và phiên quản trị (Ngày 7 §2, với chỉnh sửa của Henry:
// đăng nhập bằng TÀI KHOẢN + MẬT KHẨU, không phải chỉ một mật khẩu).
// URL quản trị dùng tiếng Anh: /login, /admin, /admin/products...
// (đặc tả ghi URL quản trị tiếng Việt — Henry đổi, xem "Khác đặc tả"
// báo cáo Ngày 7).

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 giờ tuyệt đối

export class AdminNotConfiguredError extends Error {
  constructor() {
    super("Chưa cấu hình quản trị");
    this.name = "AdminNotConfiguredError";
  }
}

export type AdminConfig = { username: string; passwordHash: string };

// ADMIN_USERNAME mặc định "admin"; ADMIN_PASSWORD_HASH phải đúng
// định dạng scrypt$<saltHex>$<hashHex> — thiếu hoặc sai định dạng
// thì coi như chưa cấu hình (mọi /admin/* trả 503).
export function getAdminConfig(): AdminConfig | null {
  const username = (process.env.ADMIN_USERNAME ?? "").trim() || "admin";
  const passwordHash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim();
  if (!isValidAdminPasswordHash(passwordHash)) return null;
  return { username, passwordHash };
}

export function isAdminConfigured(): boolean {
  return getAdminConfig() !== null;
}

// Secure khi NODE_ENV=production; ADMIN_COOKIE_SECURE=false chỉ để
// thử qua HTTP (README ghi KHÔNG tắt trên VPS thật).
function isCookieSecure(): boolean {
  const flag = (process.env.ADMIN_COOKIE_SECURE ?? "").trim().toLowerCase();
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// IP từ header do reverse proxy đặt (xem README): X-Forwarded-For
// lấy phần tử đầu; dự phòng X-Real-IP; không có thì "unknown".
export function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

// Tạo phiên + ghi cookie; dọn phiên hết hạn trước.
export async function createAdminSession(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.adminSession.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(now.getTime() + ADMIN_SESSION_TTL_MS),
    },
  });
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: isCookieSecure(),
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  });
  return token;
}

// Đọc phiên từ cookie; null khi không có cookie, sai token, hoặc hết
// hạn (dòng hết hạn bị xóa). Cập nhật lastSeenAt mỗi lần dùng được.
export async function getAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.adminSession.delete({ where: { id: session.id } });
    return null;
  }
  await db.adminSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  return session;
}

// Đăng xuất: xóa dòng phiên trong DB và cookie.
export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    await db.adminSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
  store.delete(ADMIN_SESSION_COOKIE);
}

// Xác thực tài khoản + mật khẩu. Cả hai đều so khớp bằng
// timingSafeEqual (qua hash sha256) nên lỗi luôn là thông báo chung,
// không lộ tài khoản hay mật khẩu sai chỗ nào. Cả hai phép so khớp
// đều chạy dù một bên đã sai (tránh rò rỉ qua thời gian).
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const config = getAdminConfig();
  if (!config) return false;
  const usernameHash = createHash("sha256").update(username).digest();
  const expectedUsernameHash = createHash("sha256")
    .update(config.username)
    .digest();
  const usernameOk =
    usernameHash.length === expectedUsernameHash.length &&
    timingSafeEqual(usernameHash, expectedUsernameHash);
  const passwordOk = await verifyAdminPassword(password, config.passwordHash);
  return usernameOk && passwordOk;
}

// Bắt buộc đăng nhập quản trị — câu lệnh đầu tiên của mọi Server
// Action và route handler quản trị (và mọi trang quản trị). Chưa cấu
// hình → ném AdminNotConfiguredError (middleware trả 503 trước khi
// tới trang; route handler bắt lỗi này để trả 503). Chưa đăng nhập →
// redirect về /login (trang/action); route handler bắt redirect để
// trả 401 (xem src/app/api/admin/upload/route.ts).
export async function requireAdmin() {
  if (!isAdminConfigured()) throw new AdminNotConfiguredError();
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}
