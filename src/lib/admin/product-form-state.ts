// Trạng thái trả về của Server Action tạo/sửa sản phẩm (Ngày 7 §3):
// lỗi từng trường + giá trị đã nhập để biểu mẫu hiện đúng chỗ và
// giữ nguyên giá trị khi sửa lại. Module thuần (không có "use server")
// để cả action và component client đều import được — file "use
// server" chỉ được export hàm async, không được export giá trị.
import type {
  ProductFormErrors,
  ProductFormInput,
} from "./product-validation";

export type AdminProductState = {
  ok: boolean;
  fieldErrors: ProductFormErrors;
  formError: string | null;
  values: ProductFormInput | null;
};

export const initialAdminProductState: AdminProductState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: null,
};
