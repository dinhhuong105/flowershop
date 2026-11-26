// Trạng thái trả về của Server Action tạo/sửa khu vực giao hàng
// (Ngày 12 C2): lỗi từng trường + giá trị đã nhập để biểu mẫu hiện
// đúng chỗ và giữ nguyên giá trị khi sửa lại. Module thuần (không
// có "use server") để cả action và component client đều import
// được. (Mẫu theo src/lib/admin/category-form-state.ts.)
import type { ZoneFormErrors, ZoneFormInput } from "./zone-validation";

export type AdminZoneState = {
  ok: boolean;
  fieldErrors: ZoneFormErrors;
  formError: string | null;
  values: ZoneFormInput | null;
};

export const initialAdminZoneState: AdminZoneState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: null,
};
