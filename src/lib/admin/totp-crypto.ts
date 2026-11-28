// Mã hóa bí mật TOTP (Ngày 19 Phần C): AES-256-GCM, khóa từ biến
// môi trường AUTH_ENCRYPTION_KEY (32 byte, base64).
//
// - Thiếu khóa hoặc khóa sai độ dài → tính năng 2FA TỰ TẮT
//   (isTotpAvailable() = false; tầng gọi báo rõ lý do, không bao
//   giờ lưu bí mật ở dạng rõ).
// - Định dạng bản mã: base64( iv[12] || tag[16] || ciphertext ).
//   Sửa 1 bit bất kỳ → giải mã thất bại do GCM xác thực tag.
// - KHÔNG BAO GIỜ in khóa/bí mật/bản mã ra log, báo cáo hay file.
//   Hàm này chỉ nhận/trả chuỗi trong bộ nhớ của tiến trình server.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Thoát hiểm (Ngày 19 C1): ADMIN_TOTP_DISABLE=1 tạm vô hiệu bước
// TOTP (chủ sở hữu Vercel mới đặt được). Mỗi lần dùng phải ghi
// nhật ký (xem totp-store.recordTotpAudit "escape-used").
export function isTotpEscapeHatchOn(): boolean {
  return (process.env.ADMIN_TOTP_DISABLE ?? "").trim() === "1";
}

// Khóa mã hóa 32 byte từ env; null khi thiếu/sai định dạng.
// Đọc process.env mỗi lần gọi (để test đổi env được + server đọc
// lại sau khi Henry đặt biến trên Vercel rồi redeploy).
export function getTotpEncryptionKey(): Buffer | null {
  const raw = (process.env.AUTH_ENCRYPTION_KEY ?? "").trim();
  if (raw === "") return null;
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    return null;
  }
  // base64 hợp lệ nhưng giải mã không đủ 32 byte → không dùng.
  if (key.length !== 32) return null;
  // Chuỗi base64 phải mã hóa lại đúng chính nó (chống chuỗi rác
  // giải mã "may mắn" thành 32 byte — kiểm rẻ, không lộ khóa).
  if (key.toString("base64") !== raw.replace(/[\r\n\s]/g, "")) return null;
  return key;
}

export function isTotpAvailable(): boolean {
  return getTotpEncryptionKey() !== null;
}

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

export function encryptTotpSecret(plainSecret: string): string {
  const key = getTotpEncryptionKey();
  if (key === null) {
    throw new Error("totp: thiếu AUTH_ENCRYPTION_KEY, không mã hóa được bí mật");
  }
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  if (tag.length !== GCM_TAG_BYTES) throw new Error("totp: tag GCM sai độ dài");
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

// Giải mã; ném lỗi khi bản mã sai định dạng, khóa sai, hoặc dữ liệu
// đã bị sửa (GCM xác thực tag thất bại). Tầng gọi bắt lỗi và trả
// thông báo chung (không lộ lý do chi tiết cho client).
export function decryptTotpSecret(encrypted: string): string {
  const key = getTotpEncryptionKey();
  if (key === null) {
    throw new Error("totp: thiếu AUTH_ENCRYPTION_KEY, không giải mã được bí mật");
  }
  const raw = Buffer.from(encrypted, "base64");
  if (raw.length < GCM_IV_BYTES + GCM_TAG_BYTES + 1) {
    throw new Error("totp: bản mã quá ngắn");
  }
  const iv = raw.subarray(0, GCM_IV_BYTES);
  const tag = raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_TAG_BYTES);
  const ciphertext = raw.subarray(GCM_IV_BYTES + GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
