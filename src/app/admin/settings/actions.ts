// Server Actions lưu cài đặt shop (Ngày 11 B3/B4): chỉ quản trị
// (requireAdmin() đầu tiên — chưa đăng nhập thì redirect /login).
// Kiểm hợp lệ ở máy chủ (validate*Values), chỉ ghi khóa đã đổi,
// ghi nhật ký từng khóa, rồi revalidateTag("site-settings") để mặt
// shop cập nhật ngay + revalidate layout để mọi trang đọc lại.
// Trả về state cho useActionState (lỗi từng trường, giữ giá trị
// đã nhập nhờ defaultValue ở form).
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin, clientIpFromHeaders, getAdminConfig } from "@/lib/admin/auth";
import { verifyAdminPassword } from "@/lib/admin/password";
import {
  hashIp,
  isAdminLoginRateLimited,
  recordAdminLoginAttempt,
} from "@/lib/admin/rate-limit";
import {
  recordSettingsAudit,
  saveSettingsToDb,
  validateBankValues,
  validateContactValues,
  validateGeneralValues,
  validateSeoValues,
  validateTelegramValues,
} from "@/lib/settings";
import { getSettings } from "@/lib/settings-cache";
import { sendBankChangeNotification, sendTelegramMessage } from "@/lib/telegram";
import { countUnpaidBankTransferOrders } from "@/lib/admin/orders";
import { bankSaveSuccessMessage } from "@/lib/admin/bank-warning";
import { formatVnDateTime } from "@/lib/vn-datetime";
import type { SettingsFormState } from "@/lib/admin/settings-form-state";

function formDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formDataBoolean(formData: FormData, key: string): boolean {
  // Checkbox: chỉ gửi khi được chọn ("on"); radio "true"/"false".
  const value = formData.get(key);
  return value === "on" || value === "true";
}

export async function saveGeneralSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  const { values, errors } = validateGeneralValues({
    siteName: formDataString(formData, "siteName"),
    slogan: formDataString(formData, "slogan"),
    logo: formDataString(formData, "logo"),
    favicon: formDataString(formData, "favicon"),
  });
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Kiểm tra lại các trường tô đỏ.", errors };
  }
  await saveSettingsToDb("general", values, "admin");
  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã lưu cài đặt chung.", errors: {} };
}

export async function saveContactSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  const { values, errors } = validateContactValues({
    hotline: formDataString(formData, "hotline"),
    zalo: formDataString(formData, "zalo"),
    email: formDataString(formData, "email"),
    address: formDataString(formData, "address"),
    openHours: formDataString(formData, "openHours"),
    facebook: formDataString(formData, "facebook"),
    instagram: formDataString(formData, "instagram"),
    tiktok: formDataString(formData, "tiktok"),
  });
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Kiểm tra lại các trường tô đỏ.", errors };
  }
  await saveSettingsToDb("contact", values, "admin");
  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã lưu thông tin liên hệ.", errors: {} };
}

export async function saveBankSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  // B3: lưu bank đòi nhập lại mật khẩu admin (đúng hàm xác thực của
  // đăng nhập). Thử sai ghi vào cùng bảng giới hạn đăng nhập
  // (admin_login_attempts): quá 5 lần sai/15 phút theo IP (hoặc 20
  // lần toàn hệ thống) thì bị chặn cả đăng nhập — đúng "cơ chế sẵn có".
  const confirmPassword = formDataString(formData, "confirmPassword");
  const headersList = await headers();
  const ipHash = hashIp(clientIpFromHeaders(headersList));
  if (await isAdminLoginRateLimited(ipHash)) {
    return {
      ok: false,
      message: "Quá nhiều lần thử sai, vui lòng thử lại sau 15 phút.",
      errors: {},
    };
  }
  const config = getAdminConfig();
  const passwordOk =
    config !== null &&
    confirmPassword !== "" &&
    (await verifyAdminPassword(confirmPassword, config.passwordHash));
  if (!passwordOk) {
    await recordAdminLoginAttempt(ipHash);
    return { ok: false, message: "Mật khẩu không đúng, chưa lưu thay đổi.", errors: {} };
  }
  const { values, errors } = validateBankValues({
    bankCode: formDataString(formData, "bankCode"),
    accountNumber: formDataString(formData, "accountNumber"),
    accountName: formDataString(formData, "accountName"),
    transferNoteTemplate: formDataString(formData, "transferNoteTemplate"),
    bankEnabled: formDataBoolean(formData, "bankEnabled"),
  });
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Kiểm tra lại các trường tô đỏ.", errors };
  }
  const saved = await saveSettingsToDb("bank", values, "admin");
  let message = "Đã lưu thông tin ngân hàng.";
  if (saved.length > 0) {
    // B5 (Ngày 14): N đơn chuyển khoản chưa thu tại thời điểm lưu —
    // ghi vào thông báo sau khi lưu và tin Telegram báo đổi ngân hàng.
    const unpaidCount = await countUnpaidBankTransferOrders();
    // B3: báo chủ shop 1 tin Telegram mỗi khi nhóm bank đổi (không
    // kèm số đầy đủ). Telegram lỗi thì KHÔNG chặn lưu — ghi nhận
    // vào nhật ký để Henry thấy trong audit.
    const notify = await sendBankChangeNotification(unpaidCount);
    await recordSettingsAudit(
      "bank.notify",
      null,
      notify.ok ? "sent" : `failed: ${notify.error ?? "unknown"}`,
      "admin",
    );
    // B4 (Ngày 15): chỉ tắt "Bật thanh toán chuyển khoản" thì câu
    // cảnh báo khác (QR biến mất, không phải QR mới).
    const onlyDisabled =
      saved.length === 1 && saved[0] === "bank.enabled" && values.bankEnabled === false;
    message = bankSaveSuccessMessage(unpaidCount, !notify.ok, onlyDisabled);
  }
  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  return { ok: true, message, errors: {} };
}

export async function saveTelegramSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  const { values, errors } = validateTelegramValues({
    telegramChatId: formDataString(formData, "telegramChatId"),
    telegramEnabled: formDataBoolean(formData, "telegramEnabled"),
  });
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Kiểm tra lại các trường tô đỏ.", errors };
  }
  await saveSettingsToDb("telegram", values, "admin");
  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã lưu cài đặt Telegram.", errors: {} };
}

// Trạng thái nút "Gửi thử" (D2): form riêng, không dùng
// SettingsFormState (không có lỗi từng trường).
export type TelegramTestState = { ok: boolean; message: string };

export async function saveSeoSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();
  const { values, errors } = validateSeoValues({
    titleTemplate: formDataString(formData, "titleTemplate"),
    defaultDescription: formDataString(formData, "defaultDescription"),
    defaultOgImage: formDataString(formData, "defaultOgImage"),
    metaKeywords: formDataString(formData, "metaKeywords"),
    allowIndexing: formDataBoolean(formData, "allowIndexing"),
  });
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Kiểm tra lại các trường tô đỏ.", errors };
  }
  await saveSettingsToDb("seo", values, "admin");
  revalidateTag("site-settings");
  revalidatePath("/", "layout");
  return { ok: true, message: "Đã lưu cài đặt SEO.", errors: {} };
}

export async function sendTelegramTestAction(): Promise<TelegramTestState> {
  await requireAdmin();
  const settings = await getSettings();
  const chatId = settings.telegramChatId.trim();
  if (chatId === "") {
    return { ok: false, message: "Chưa nhập chat id — lưu chat id trước rồi bấm Gửi thử." };
  }
  const result = await sendTelegramMessage(
    `[TEST] Tin thử từ shop ${settings.siteName} — ${formatVnDateTime(new Date())}.`,
  );
  if (result.ok) {
    return { ok: true, message: "Đã gửi tin thử, kiểm tra Telegram." };
  }
  return { ok: false, message: result.error ?? "Không gửi được tin Telegram." };
}
