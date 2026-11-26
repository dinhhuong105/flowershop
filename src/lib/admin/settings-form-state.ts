// Trạng thái ban đầu của biểu mẫu Cài đặt shop (Ngày 11 B3).
// Đặt ở module lib thuần (KHÔNG phải file "use server"): file
// "use server" chỉ được export hàm async — export một object từ
// đó sẽ bị Next biến thành server reference (hàm), khiến
// useActionState nhận hàm làm trạng thái ban đầu và biểu mẫu vỡ
// ("Cannot read properties of undefined (reading 'siteName')").
// (Mẫu theo src/lib/admin/category-form-state.ts.)
import type { SettingsFieldErrors } from "@/lib/settings";

export type SettingsFormState = {
  ok: boolean;
  message: string | null;
  errors: SettingsFieldErrors;
};

export const initialSettingsFormState: SettingsFormState = {
  ok: false,
  message: null,
  errors: {},
};
