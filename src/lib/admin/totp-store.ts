// Tầng lưu trữ + xác minh TOTP (Ngày 19 Phần C): đọc/ghi bảng
// admin_two_factor, mã khôi phục, nhật ký audit.
//
// - Bí mật chỉ tồn tại dạng mã hóa trong DB (decrypt ngay lúc
//   dùng, không lưu lại đâu khác, không đưa vào log/lỗi trả về).
// - Mã khôi phục: 10 mã, định dạng XXXXX-XXXXX (bảng chữ không
//   gây nhầm 0/O/1/I), lưu băm scrypt (tái dùng hashAdminPassword /
//   verifyAdminPassword của đăng nhập), dùng một lần (xóa khỏi mảng
//   khi đã dùng).
// - isTotpLoginRequired(): 2FA có hiệu lực ở lần đăng nhập này =
//   đã bật (enabledAt != null) VÀ có khóa mã hóa VÀ không có thoát
//   hiểm. Thiếu khóa → tính năng tự tắt (không chặn đăng nhập).

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashAdminPassword, verifyAdminPassword } from "./password";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  getTotpEncryptionKey,
  isTotpAvailable,
  isTotpEscapeHatchOn,
} from "./totp-crypto";
import { generateTotpSecret, verifyTotpCode } from "./totp";
import { recordSettingsAudit } from "@/lib/settings";

export const TOTP_ROW_ID = 1;
export const TOTP_RECOVERY_CODE_COUNT = 10;

export type TotpStatus = {
  // Đã có dòng bí mật trong DB (đang cài đặt hoặc đã bật).
  configured: boolean;
  // Đã bật (đã xác nhận bằng mã).
  enabled: boolean;
  enabledAt: Date | null;
  // Số mã khôi phục còn hiệu lực.
  recoveryRemaining: number;
  // Có khóa mã hóa để dùng tính năng không.
  keyAvailable: boolean;
  // Thoát hiểm đang bật không.
  escapeHatchOn: boolean;
};

export async function getTotpStatus(): Promise<TotpStatus> {
  const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
  return {
    configured: row !== null,
    enabled: row !== null && row.enabledAt !== null,
    enabledAt: row?.enabledAt ?? null,
    recoveryRemaining: row?.recoveryCodeHashes.length ?? 0,
    keyAvailable: isTotpAvailable(),
    escapeHatchOn: isTotpEscapeHatchOn(),
  };
}

// 2FA có hiệu lực ở lần đăng nhập này không.
export async function isTotpLoginRequired(): Promise<boolean> {
  const status = await getTotpStatus();
  return status.enabled && status.keyAvailable && !status.escapeHatchOn;
}

// Thoát hiểm đang có hiệu lực không: 2FA đã bật NHƯNG
// ADMIN_TOTP_DISABLE=1 (chủ sở hữu Vercel mới đặt được). Tầng gọi
// ghi nhật ký "escape-used" mỗi lần dùng cơ chế này.
export async function isTotpEscapeHatchActive(): Promise<boolean> {
  const status = await getTotpStatus();
  return status.enabled && status.escapeHatchOn;
}

// Ghi nhật ký audit 2FA (không lưu bí mật/mã — chỉ hành động).
// action: enabled | disabled | recovery-used | failed |
// recovery-regenerated | escape-used.
export async function recordTotpAudit(action: string): Promise<void> {
  const detail: Record<string, string> = {
    enabled: "Đã bật xác thực hai bước",
    disabled: "Đã tắt xác thực hai bước",
    "recovery-used": "Đã dùng 1 mã khôi phục để đăng nhập",
    failed: "Xác minh mã sai",
    "recovery-regenerated": "Đã tạo lại 10 mã khôi phục",
    "escape-used": "Bỏ qua bước TOTP (ADMIN_TOTP_DISABLE=1)",
  };
  await recordSettingsAudit(`totp.${action}`, null, detail[action] ?? action, "admin").catch(
    (error: unknown) => {
      console.error(
        "[totp] Không ghi được nhật ký audit:",
        error instanceof Error ? error.message : error,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Mã khôi phục.
// ---------------------------------------------------------------------------

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomRecoveryCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function generateRecoveryCodes(count: number = TOTP_RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomRecoveryCode());
  return [...codes];
}

// Chuẩn hóa mã khôi phục nhập vào: bỏ gạch/khoảng trắng, in hoa.
// Đúng định dạng = 10 ký tự trong bảng chữ (không phân biệt hoa/thường).
export function normalizeRecoveryCodeInput(raw: string): string | null {
  const code = (raw ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== 10) return null;
  for (const char of code) {
    if (!RECOVERY_ALPHABET.includes(char)) return null;
  }
  return code;
}

async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  const hashes: string[] = [];
  for (const code of codes) {
    // Băm dạng đã chuẩn hóa (không gạch nối) — đúng dạng mà lúc xác
    // minh chuẩn hóa ra (normalizeRecoveryCodeInput); băm dạng hiển
    // thị có gạch thì lúc xác minh không bao giờ khớp.
    const normalized = normalizeRecoveryCodeInput(code);
    if (normalized === null) throw new Error("totp: mã khôi phục sai định dạng");
    hashes.push(await hashAdminPassword(normalized));
  }
  return hashes;
}

// ---------------------------------------------------------------------------
// Xác minh một mã (TOTP 6 số hoặc mã khôi phục) khi 2FA đang bật.
// Trả { ok, usedRecovery }. Thành công bằng mã TOTP → cập nhật
// lastUsedStep (chống dùng lại); bằng mã khôi phục → xóa mã đó
// khỏi mảng (dùng một lần). Thất bại → không đổi gì trong DB.
// ---------------------------------------------------------------------------

export type TotpCodeCheck = { ok: true; usedRecovery: boolean } | { ok: false };

export async function verifyTotpOrRecoveryCode(
  rawCode: string,
  now: Date = new Date(),
): Promise<TotpCodeCheck> {
  const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
  if (row === null || row.enabledAt === null) return { ok: false };
  if (getTotpEncryptionKey() === null) return { ok: false };

  // Mã khôi phục thử trước khi là TOTP (định dạng khác hẳn 6 số).
  const recovery = normalizeRecoveryCodeInput(rawCode);
  if (recovery !== null) {
    for (const hash of row.recoveryCodeHashes) {
      if (await verifyAdminPassword(recovery, hash)) {
        await db.adminTwoFactor.update({
          where: { id: TOTP_ROW_ID },
          data: { recoveryCodeHashes: row.recoveryCodeHashes.filter((h) => h !== hash) },
        });
        await recordTotpAudit("recovery-used");
        return { ok: true, usedRecovery: true };
      }
    }
    return { ok: false };
  }

  let secret: string;
  try {
    secret = decryptTotpSecret(row.encryptedSecret);
  } catch {
    return { ok: false };
  }
  const result = verifyTotpCode(secret, rawCode, now, row.lastUsedStep);
  if (!result.ok) return { ok: false };
  await db.adminTwoFactor.update({
    where: { id: TOTP_ROW_ID },
    data: { lastUsedStep: result.step },
  });
  return { ok: true, usedRecovery: false };
}

// ---------------------------------------------------------------------------
// Bắt đầu cài đặt: sinh bí mật mới, mã hóa, lưu (chưa bật —
// enabledAt null cho tới khi xác nhận bằng mã). Trả bí mật DẠNG RÕ
// để tầng gọi hiện QR/khóa nhập tay MỘT LẦN trong bước cài đặt
// (không ghi log, không lưu lại đâu khác). Thiếu khóa → ném lỗi
// (tầng gọi báo "chưa cấu hình khóa mã hóa").
// ---------------------------------------------------------------------------

export async function startTotpSetup(): Promise<{ secret: string }> {
  if (!isTotpAvailable()) {
    throw new Error("totp: thiếu AUTH_ENCRYPTION_KEY");
  }
  const secret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(secret);
  await db.adminTwoFactor.upsert({
    where: { id: TOTP_ROW_ID },
    create: {
      id: TOTP_ROW_ID,
      encryptedSecret,
      enabledAt: null,
      lastUsedStep: null,
      recoveryCodeHashes: [],
    },
    update: {
      encryptedSecret,
      enabledAt: null,
      lastUsedStep: null,
      recoveryCodeHashes: [],
    },
  });
  return { secret };
}

// Xác nhận bật: mã đúng → bật (enabledAt), sinh 10 mã khôi phục,
// trả mã khôi phục DẠNG RÕ để hiện MỘT LẦN DUY NHẤT. Mã sai →
// { ok: false } (không đổi DB, không lộ lý do).
export async function confirmTotpSetup(
  rawCode: string,
  now: Date = new Date(),
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false }> {
  const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
  if (row === null || row.enabledAt !== null) return { ok: false };
  let secret: string;
  try {
    secret = decryptTotpSecret(row.encryptedSecret);
  } catch {
    return { ok: false };
  }
  const result = verifyTotpCode(secret, rawCode, now, null);
  if (!result.ok) return { ok: false };
  const recoveryCodes = generateRecoveryCodes();
  const hashes = await hashRecoveryCodes(recoveryCodes);
  await db.adminTwoFactor.update({
    where: { id: TOTP_ROW_ID },
    data: {
      enabledAt: now,
      lastUsedStep: result.step,
      recoveryCodeHashes: hashes,
    },
  });
  await recordTotpAudit("enabled");
  return { ok: true, recoveryCodes };
}

// Tắt 2FA: xóa dòng (bí mật + mã khôi phục biến mất cùng lúc).
export async function disableTotp(): Promise<void> {
  await db.adminTwoFactor.deleteMany({ where: { id: TOTP_ROW_ID } });
  await recordTotpAudit("disabled");
}

// Tạo lại 10 mã khôi phục (mã cũ hết hiệu lực ngay).
export async function regenerateRecoveryCodes(): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const hashes = await hashRecoveryCodes(codes);
  await db.adminTwoFactor.update({
    where: { id: TOTP_ROW_ID },
    data: { recoveryCodeHashes: hashes },
  });
  await recordTotpAudit("recovery-regenerated");
  return codes;
}
