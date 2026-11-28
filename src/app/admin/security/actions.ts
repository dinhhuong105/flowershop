// Server Actions cho trang Bảo mật /admin/security (Ngày 19 Phần C):
// bật/tắt 2FA TOTP, tạo lại mã khôi phục. Chỉ quản trị
// (requireAdmin() đầu tiên — chưa đăng nhập thì redirect /login).
// Bí mật/mã khôi phục dạng rõ CHỈ trả về trong state của đúng
// action tạo ra chúng (hiện một lần duy nhất ở giao diện), không
// bao giờ ghi log. Khi bật/tắt 2FA: buộc đăng nhập lại mọi phiên
// đầy đủ khác (chỉ giữ phiên đang thao tác).
"use server";

import { requireAdmin, getAdminConfig, revokeOtherAdminSessions } from "@/lib/admin/auth";
import { verifyAdminPassword } from "@/lib/admin/password";
import { getSettings } from "@/lib/settings-cache";
import { buildOtpAuthUrl } from "@/lib/admin/totp";
import { isTotpAvailable } from "@/lib/admin/totp-crypto";
import {
  confirmTotpSetup,
  disableTotp,
  getTotpStatus,
  regenerateRecoveryCodes,
  startTotpSetup,
  verifyTotpOrRecoveryCode,
} from "@/lib/admin/totp-store";

export type TotpStartState = {
  ok: boolean;
  message: string;
  otpauthUrl: string;
  manualKey: string;
};

export type TotpConfirmState = {
  ok: boolean;
  message: string;
  recoveryCodes: string[];
};

export type TotpSimpleState = {
  ok: boolean;
  message: string;
  recoveryCodes: string[];
};

function formDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const EMPTY_START: TotpStartState = { ok: false, message: "", otpauthUrl: "", manualKey: "" };

// Bước 1 bật 2FA: sinh bí mật mới (mã hóa rồi mới lưu), trả URL
// otpauth + khóa nhập tay để giao diện vẽ QR. Bí mật cũ (nếu có
// bước cài đặt dở) bị thay bằng bí mật mới.
export async function startTotpSetupAction(): Promise<TotpStartState> {
  await requireAdmin();
  const status = await getTotpStatus();
  if (status.enabled) {
    return { ...EMPTY_START, message: "Xác thực hai bước đã bật rồi." };
  }
  if (!isTotpAvailable()) {
    return {
      ...EMPTY_START,
      message:
        "Chưa cấu hình khóa mã hóa (AUTH_ENCRYPTION_KEY) nên không bật được 2FA. " +
        "Đặt khóa trong biến môi trường rồi thử lại — xem hướng dẫn vận hành.",
    };
  }
  try {
    const { secret } = await startTotpSetup();
    const settings = await getSettings();
    const config = getAdminConfig();
    const otpauthUrl = buildOtpAuthUrl({
      issuer: settings.siteName || "Hoa Tươi",
      account: config?.username ?? "admin",
      secret,
    });
    return { ok: true, message: "", otpauthUrl, manualKey: secret };
  } catch {
    return { ...EMPTY_START, message: "Không tạo được bí mật 2FA, vui lòng thử lại sau." };
  }
}

// Bước 2 bật 2FA: nhập mã từ app xác thực để xác nhận bí mật vừa
// quét. Đúng → bật + trả 10 mã khôi phục (hiện MỘT lần duy nhất).
// Sai → thông báo chung, không đổi gì.
export async function confirmTotpSetupAction(
  _prevState: TotpConfirmState,
  formData: FormData,
): Promise<TotpConfirmState> {
  const session = await requireAdmin();
  const code = formDataString(formData, "code");
  const result = await confirmTotpSetup(code);
  if (!result.ok) {
    return { ok: false, message: "Mã xác thực không đúng, chưa bật 2FA.", recoveryCodes: [] };
  }
  await revokeOtherAdminSessions(session.id);
  return { ok: true, message: "Đã bật xác thực hai bước.", recoveryCodes: result.recoveryCodes };
}

// Tắt 2FA: cần nhập lại mật khẩu + mã (TOTP hoặc mã khôi phục).
// Xong thì bí mật + mã khôi phục cũ biến mất; các phiên đầy đủ
// khác bị buộc đăng nhập lại.
export async function disableTotpAction(
  _prevState: TotpSimpleState,
  formData: FormData,
): Promise<TotpSimpleState> {
  const session = await requireAdmin();
  const password = formDataString(formData, "password");
  const code = formDataString(formData, "code");
  const config = getAdminConfig();
  const passwordOk =
    config !== null &&
    password !== "" &&
    (await verifyAdminPassword(password, config.passwordHash));
  if (!passwordOk) {
    return { ok: false, message: "Mật khẩu không đúng, chưa tắt 2FA.", recoveryCodes: [] };
  }
  const codeOk = code !== "" && (await verifyTotpOrRecoveryCode(code)).ok;
  if (!codeOk) {
    return { ok: false, message: "Mã xác thực không đúng, chưa tắt 2FA.", recoveryCodes: [] };
  }
  await disableTotp();
  await revokeOtherAdminSessions(session.id);
  return { ok: true, message: "Đã tắt xác thực hai bước. Đăng nhập chỉ còn cần mật khẩu.", recoveryCodes: [] };
}

// Tạo lại 10 mã khôi phục: cần nhập lại mật khẩu + mã. Mã cũ hết
// hiệu lực ngay; mã mới hiện MỘT lần duy nhất.
export async function regenerateRecoveryCodesAction(
  _prevState: TotpSimpleState,
  formData: FormData,
): Promise<TotpSimpleState> {
  await requireAdmin();
  const password = formDataString(formData, "password");
  const code = formDataString(formData, "code");
  const config = getAdminConfig();
  const passwordOk =
    config !== null &&
    password !== "" &&
    (await verifyAdminPassword(password, config.passwordHash));
  if (!passwordOk) {
    return { ok: false, message: "Mật khẩu không đúng, chưa tạo lại mã.", recoveryCodes: [] };
  }
  const codeOk = code !== "" && (await verifyTotpOrRecoveryCode(code)).ok;
  if (!codeOk) {
    return { ok: false, message: "Mã xác thực không đúng, chưa tạo lại mã.", recoveryCodes: [] };
  }
  const codes = await regenerateRecoveryCodes();
  return { ok: true, message: "Đã tạo lại 10 mã khôi phục.", recoveryCodes: codes };
}
