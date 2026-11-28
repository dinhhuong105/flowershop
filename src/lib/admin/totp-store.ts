// Tầng lưu trữ + xác minh TOTP (Ngày 19 Phần C, sửa A2 Ngày 20 bản
// sau Retry): đọc/ghi bảng admin_two_factor, mã khôi phục, nhật ký
// audit.
//
// - Bí mật chỉ tồn tại dạng mã hóa trong DB (decrypt ngay lúc
//   dùng, không lưu lại đâu khác, không đưa vào log/lỗi trả về).
// - Mã khôi phục: 10 mã, định dạng XXXXX-XXXXX (bảng chữ không
//   gây nhầm 0/O/1/I), lưu băm scrypt (tái dùng hashAdminPassword /
//   verifyAdminPassword của đăng nhập), dùng một lần (xóa khỏi mảng
//   khi đã dùng).
// - A2: 2FA đã bật mà KHÔNG giải mã được bí mật (thiếu/sai khóa,
//   bản mã hỏng) thì ĐÓNG — chỉ đăng nhập bằng mã khôi phục (băm
//   độc lập với khóa nên vẫn kiểm được) hoặc cờ thoát hiểm
//   ADMIN_TOTP_DISABLE=1; KHÔNG nhận mã 6 số; KHÔNG tự tắt 2FA.
//   isTotpLoginRequired() = đã bật VÀ không có thoát hiểm (không
//   còn phụ thuộc khóa khả dụng như Ngày 19).

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashAdminPassword, verifyAdminPassword } from "./password";
import {
  decryptTotpSecret,
  encryptTotpSecret,
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
  // A2: đã bật nhưng KHÔNG giải mã được bí mật (thiếu/sai khóa,
  // bản mã hỏng) → đăng nhập chỉ còn mã khôi phục / thoát hiểm.
  keyUnavailable: boolean;
  // Thoát hiểm đang bật không.
  escapeHatchOn: boolean;
};

export async function getTotpStatus(): Promise<TotpStatus> {
  const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
  const enabled = row !== null && row.enabledAt !== null;
  let keyUnavailable = false;
  if (enabled && row !== null) {
    try {
      decryptTotpSecret(row.encryptedSecret);
    } catch {
      keyUnavailable = true;
    }
  }
  return {
    configured: row !== null,
    enabled,
    enabledAt: row?.enabledAt ?? null,
    recoveryRemaining: row?.recoveryCodeHashes.length ?? 0,
    keyAvailable: isTotpAvailable(),
    keyUnavailable,
    escapeHatchOn: isTotpEscapeHatchOn(),
  };
}

// A2: 2FA đã bật nhưng không giải mã được bí mật (thiếu/sai khóa
// mã hóa, hoặc bản mã đã hỏng). Trả false khi chưa bật.
export async function isTotpKeyUnavailable(): Promise<boolean> {
  const status = await getTotpStatus();
  return status.enabled && status.keyUnavailable;
}

// 2FA có hiệu lực ở lần đăng nhập này không. A2: chỉ còn hai điều
// kiện — đã bật VÀ không có thoát hiểm. Thiếu/lệch khóa KHÔNG làm
// tắt tính năng nữa (xem isTotpKeyUnavailable): lúc đó chỉ còn
// mã khôi phục được chấp nhận ở verifyTotpOrRecoveryCode.
export async function isTotpLoginRequired(): Promise<boolean> {
  const status = await getTotpStatus();
  return status.enabled && !status.escapeHatchOn;
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
// recovery-regenerated | escape-used | key-unavailable.
export async function recordTotpAudit(action: string): Promise<void> {
  const detail: Record<string, string> = {
    enabled: "Đã bật xác thực hai bước",
    disabled: "Đã tắt xác thực hai bước",
    "recovery-used": "Đã dùng 1 mã khôi phục để đăng nhập",
    failed: "Xác minh mã sai",
    "recovery-regenerated": "Đã tạo lại 10 mã khôi phục",
    "escape-used": "Bỏ qua bước TOTP (ADMIN_TOTP_DISABLE=1)",
    "key-unavailable":
      "2FA đã bật nhưng khóa mã hóa không dùng được — chỉ đăng nhập được bằng mã khôi phục",
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

// A2: ghi audit `totp.key-unavailable`, giới hạn một dòng mỗi giờ
// (tránh spam nhật ký khi mọi trang admin đều phát hiện trạng thái
// này). Không bao giờ ném lỗi — nhật ký không được chặn đăng nhập
// hay hiển thị trang.
export async function recordTotpKeyUnavailableAudit(): Promise<void> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.settingsAudit.findFirst({
      where: { key: "totp.key-unavailable", createdAt: { gte: oneHourAgo } },
      select: { id: true },
    });
    if (recent) return;
    await recordTotpAudit("key-unavailable");
  } catch (error: unknown) {
    console.error(
      "[totp] Không ghi được nhật ký key-unavailable:",
      error instanceof Error ? error.message : error,
    );
  }
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
//
// A2: mã khôi phục được thử TRƯỚC và không phụ thuộc khóa mã hóa
// (băm độc lập với khóa nên vẫn kiểm được khi khóa thiếu/sai hay
// bản mã hỏng). Mã 6 số chỉ được thử khi giải mã được bí mật —
// khóa không dùng được thì mã 6 số luôn bị từ chối.
// ---------------------------------------------------------------------------

export type TotpCodeCheck = { ok: true; usedRecovery: boolean } | { ok: false };

export async function verifyTotpOrRecoveryCode(
  rawCode: string,
  now: Date = new Date(),
): Promise<TotpCodeCheck> {
  const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
  if (row === null || row.enabledAt === null) return { ok: false };

  // Mã khôi phục thử trước khi là TOTP (định dạng khác hẳn 6 số).
  // Không cần khóa mã hóa ở nhánh này.
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

  // Mã 6 số: cần giải mã được bí mật. Khóa thiếu/sai hay bản mã
  // hỏng → từ chối (không tự tắt 2FA, không nhận mã 6 số).
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
