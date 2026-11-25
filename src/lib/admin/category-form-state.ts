// Trạng thái trả về của Server Action tạo/sửa danh mục (25/11):
// lỗi từng trường + giá trị đã nhập để biểu mẫu hiện đúng chỗ và
// giữ nguyên giá trị khi sửa lại. Module thuần (không có "use server")
// để cả action và component client đều import được.
import type {
  CategoryFormErrors,
  CategoryFormInput,
} from "./category-validation";

export type AdminCategoryState = {
  ok: boolean;
  fieldErrors: CategoryFormErrors;
  formError: string | null;
  values: CategoryFormInput | null;
};

export const initialAdminCategoryState: AdminCategoryState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: null,
};
