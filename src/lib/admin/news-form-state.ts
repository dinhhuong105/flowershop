// Trạng thái trả về của Server Action tạo/sửa tin tức (Ngày 18):
// lỗi từng trường + giá trị đã nhập để biểu mẫu hiện đúng chỗ và
// giữ nguyên giá trị khi sửa lại. Module thuần (không có
// "use server") để cả action và component client đều import được.
import type { NewsFormErrors, NewsFormInput } from "./news-validation";

export type AdminNewsState = {
  ok: boolean;
  fieldErrors: NewsFormErrors;
  formError: string | null;
  values: NewsFormInput | null;
};

export const initialAdminNewsState: AdminNewsState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: null,
};
