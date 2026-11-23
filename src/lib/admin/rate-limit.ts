import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Giới hạn thử sai đăng nhập quản trị (Ngày 7 §2): quá 5 lần sai
// trong 15 phút theo IP → 429 (kể cả khi nhập đúng); quá 20 lần sai
// trong 15 phút toàn hệ thống → 429. Chỉ đếm lần SAI (chỉ ghi khi
// xác thực thất bại).

export const ADMIN_LOGIN_MAX_PER_IP = 5;
export const ADMIN_LOGIN_MAX_GLOBAL = 20;
export const ADMIN_LOGIN_WINDOW_MINUTES = 15;

// Chỉ lưu hash sha256 của IP, không lưu IP thô.
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function recordAdminLoginAttempt(ipHash: string): Promise<void> {
  await db.adminLoginAttempt.create({ data: { ipHash } });
}

export async function isAdminLoginRateLimited(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - ADMIN_LOGIN_WINDOW_MINUTES * 60 * 1000);
  const [perIp, global] = await Promise.all([
    db.adminLoginAttempt.count({
      where: { ipHash, createdAt: { gte: since } },
    }),
    db.adminLoginAttempt.count({ where: { createdAt: { gte: since } } }),
  ]);
  return perIp >= ADMIN_LOGIN_MAX_PER_IP || global >= ADMIN_LOGIN_MAX_GLOBAL;
}

// Dọn các lần thử đã quá cửa sổ 15 phút (gọi khi đăng nhập thành công).
export async function cleanupAdminLoginAttempts(): Promise<void> {
  const since = new Date(Date.now() - ADMIN_LOGIN_WINDOW_MINUTES * 60 * 1000);
  await db.adminLoginAttempt.deleteMany({ where: { createdAt: { lt: since } } });
}
