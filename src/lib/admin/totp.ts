// TOTP cho admin (Ngày 19 Phần C) — RFC 6238, HMAC-SHA1, 6 chữ số,
// bước 30 giây, tương thích Google Authenticator / Authy /
// 1Password. Cài đặt bằng node:crypto, KHÔNG thêm gói.
//
// File THUẦN (không chạm DB, không đọc process.env trực tiếp ngoài
// hàm tiện ích): mọi hàm nhận rõ đầu vào để test được bằng vector
// kiểm thử của RFC 6238 (xem totp.test.ts).
//
// Cửa sổ chấp nhận ±1 bước (đồng hồ lệch); chống dùng lại mã bằng
// lastUsedStep (bước đã dùng thì từ chối dù mã còn đúng); so sánh
// mã bằng timingSafeEqual (không so chuỗi thường).

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW_STEPS = 1;

// ---------------------------------------------------------------------------
// Base32 (RFC 4648, bảng chữ A–Z2–7). Khóa bí mật hiển thị cho người
// dùng ở dạng này (app Authenticator quét QR hoặc nhập tay).
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(data: Buffer): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function base32Decode(input: string): Buffer | null {
  const clean = input.trim().toUpperCase().replace(/=+$/, "").replace(/[\s-]/g, "");
  if (clean.length === 0) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Sinh bí mật mới: 20 byte ngẫu nhiên (160 bit, đúng độ dài khóa
// trong vector kiểm thử RFC 6238) → base32 (32 ký tự).
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

// ---------------------------------------------------------------------------
// HOTP/TOTP (RFC 4226 §5.4 + RFC 6238).
// ---------------------------------------------------------------------------

// Bước thời gian (số nguyên) tại một thời điểm.
export function totpStepAt(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
}

// Mã 6 chữ số của một bước cho trước (secret dạng base32).
// Secret sai định dạng → null (không ném — tầng gọi trả lỗi chung).
export function totpCodeAtStep(secretBase32: string, step: number): string | null {
  const secret = base32Decode(secretBase32);
  if (secret === null) return null;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCodeAt(secretBase32: string, now: Date = new Date()): string | null {
  return totpCodeAtStep(secretBase32, totpStepAt(now));
}

// Chuẩn hóa mã người dùng nhập: bỏ khoảng trắng, phải đúng 6 chữ số.
export function normalizeTotpCodeInput(raw: string): string | null {
  const code = (raw ?? "").trim().replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

export type TotpVerifyResult = { ok: true; step: number } | { ok: false };

// Kiểm mã trong cửa sổ ±1 bước quanh `now`. Từ chối:
// - mã sai / quá cũ / quá mới (ngoài cửa sổ);
// - mã của bước đã dùng rồi (step <= lastUsedStep — chống dùng lại).
// So sánh bằng timingSafeEqual. lastUsedStep null = chưa dùng mã nào.
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  now: Date = new Date(),
  lastUsedStep: number | null = null,
): TotpVerifyResult {
  const normalized = normalizeTotpCodeInput(code);
  if (normalized === null) return { ok: false };
  const current = totpStepAt(now);
  for (let step = current - TOTP_WINDOW_STEPS; step <= current + TOTP_WINDOW_STEPS; step++) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = totpCodeAtStep(secretBase32, step);
    if (expected === null) return { ok: false };
    const a = Buffer.from(normalized, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

// ---------------------------------------------------------------------------
// otpauth:// URL cho mã QR (quét bằng app Authenticator).
// Tên shop lấy từ cài đặt (issuer + nhãn); tài khoản là tên đăng
// nhập admin. Không bao giờ đưa URL này vào log (chứa bí mật).
// ---------------------------------------------------------------------------

export function buildOtpAuthUrl(opts: { issuer: string; account: string; secret: string }): string {
  const label = `${opts.issuer}:${opts.account}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
