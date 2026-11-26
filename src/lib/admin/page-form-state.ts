// Trạng thái trả về của Server Action tạo/sửa trang tĩnh (Ngày 13
// B3): lỗi từng trường + giá trị đã nhập để biểu mẫu hiện đúng chỗ
// và giữ nguyên giá trị khi sửa lại. Module thuần (không có
// "use server") để cả action và component client đều import được.
import type { PageFormErrors, PageFormInput } from "./page-validation";

export type AdminPageState = {
  ok: boolean;
  fieldErrors: PageFormErrors;
  formError: string | null;
  values: PageFormInput | null;
};

export const initialAdminPageState: AdminPageState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: null,
};
