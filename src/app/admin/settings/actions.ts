// Server Actions lưu cài đặt shop (Ngày 11 B3/B4): chỉ quản trị
// (requireAdmin() đầu tiên — chưa đăng nhập thì redirect /login).
// Kiểm hợp lệ ở máy chủ (validate*Values), chỉ ghi khóa đã đổi,
// ghi nhật ký từng khóa, rồi revalidateTag("site-settings") để mặt
// shop cập nhật ngay + revalidate layout để mọi trang đọc lại.
// Trả về state cho useActionState (lỗi từng trường, giữ giá trị
// đã nhập nhờ defaultValue ở form).
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import {
  saveSettingsToDb,
  validateContactValues,
  validateGeneralValues,
} from "@/lib/settings";
import type { SettingsFormState } from "@/lib/admin/settings-form-state";

function formDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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
