// Server Actions quản trị sản phẩm (Ngày 7 §3).
//
// MỌI action ở đây mở đầu bằng `await requireAdmin()` (D7-5).
// Chỉ nhận các trường cho phép trong FormData — id, createdAt...
// gửi kèm đều bị bỏ qua (xem formDataToInput). Lỗi trả về từng
// trường để biểu mẫu hiện đúng chỗ và giữ nguyên giá trị đã nhập;
// lưu thành công thì chuyển về danh sách (trang công khai hiện dữ
// liệu mới ngay vì layout là force-dynamic).

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  createAdminProduct,
  getAdminProduct,
  setProductActive,
  updateAdminProduct,
} from "@/lib/admin/products";
import {
  validateProductForm,
  type ProductFormErrors,
  type ProductFormInput,
} from "@/lib/admin/product-validation";
import type { AdminProductState } from "@/lib/admin/product-form-state";

// Chỉ đọc các trường cho phép — mọi trường thừa (id, createdAt...)
// trong FormData đều bị bỏ qua.
function formDataToInput(formData: FormData): ProductFormInput {
  const get = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    name: get("name"),
    slug: get("slug"),
    sku: get("sku"),
    categoryId: get("categoryId"),
    price: get("price"),
    salePrice: get("salePrice"),
    description: get("description"),
    tags: get("tags"),
    sortOrder: get("sortOrder"),
    isActive: formData.get("isActive") === "on",
    inStock: formData.get("inStock") === "on",
    isFastDelivery: formData.get("isFastDelivery") === "on",
    images: formData
      .getAll("images")
      .filter((v): v is string => typeof v === "string"),
  };
}

function fail(
  fieldErrors: ProductFormErrors,
  input: ProductFormInput,
  formError: string | null = null,
): AdminProductState {
  return { ok: false, fieldErrors, formError, values: input };
}

export async function createProductAction(
  prevState: AdminProductState,
  formData: FormData,
): Promise<AdminProductState> {
  await requireAdmin();
  const input = formDataToInput(formData);
  const { errors, values } = validateProductForm(input);
  if (!values) return fail(errors, input);
  const result = await createAdminProduct(values);
  if ("conflict" in result) {
    const fieldErrors: ProductFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return fail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function updateProductAction(
  id: number,
  prevState: AdminProductState,
  formData: FormData,
): Promise<AdminProductState> {
  await requireAdmin();
  const input = formDataToInput(formData);
  const existing = await getAdminProduct(id);
  if (!existing) {
    return fail({}, input, "Không tìm thấy sản phẩm.");
  }
  // Ảnh đã có của sản phẩm được giữ nguyên khi sửa (xem
  // validateProductForm — ảnh mẫu /images/placeholder.svg).
  const { errors, values } = validateProductForm(input, existing.images);
  if (!values) return fail(errors, input);
  const result = await updateAdminProduct(id, values);
  if (result === null) {
    return fail({}, input, "Không tìm thấy sản phẩm.");
  }
  if ("conflict" in result) {
    const fieldErrors: ProductFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return fail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export type ToggleProductState = { ok: boolean; error: string | null };

// Ẩn/hiện sản phẩm (đổi isActive). Không có xóa cứng.
export async function toggleProductAction(
  prevState: ToggleProductState,
  formData: FormData,
): Promise<ToggleProductState> {
  await requireAdmin();
  const id = Number(formData.get("productId"));
  const nextActive = formData.get("isActive") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Không tìm thấy sản phẩm." };
  }
  const changed = await setProductActive(id, nextActive);
  if (!changed) return { ok: false, error: "Không tìm thấy sản phẩm." };
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return { ok: true, error: null };
}
