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
import { requireAdmin } from "@/lib/admin/auth";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategory,
  updateAdminCategory,
} from "@/lib/admin/categories";
import {
  createAdminProduct,
  getAdminProduct,
  setProductActive,
  updateAdminProduct,
} from "@/lib/admin/products";
import {
  validateCategoryForm,
  type CategoryFormErrors,
  type CategoryFormInput,
} from "@/lib/admin/category-validation";
import type { AdminCategoryState } from "@/lib/admin/category-form-state";
import {
  validateProductForm,
  type ProductFormErrors,
  type ProductFormInput,
} from "@/lib/admin/product-validation";
import type { AdminProductState } from "@/lib/admin/product-form-state";
import {
  createAdminZone,
  deleteAdminZone,
  getAdminZone,
  setAdminZoneActive,
  updateAdminZone,
} from "@/lib/admin/zones";
import {
  createAdminPage,
  deleteAdminPage,
  getAdminPage,
  setAdminPagePublished,
  updateAdminPage,
} from "@/lib/admin/pages";
import {
  validatePageForm,
  type PageFormErrors,
  type PageFormInput,
} from "@/lib/admin/page-validation";
import type { AdminPageState } from "@/lib/admin/page-form-state";
import {
  validateZoneForm,
  type ZoneFormErrors,
  type ZoneFormInput,
} from "@/lib/admin/zone-validation";
import type { AdminZoneState } from "@/lib/admin/zone-form-state";

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
    seoTitle: get("seoTitle"),
    seoDescription: get("seoDescription"),
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
  // 25/11: không redirect nữa — form tự điều hướng theo onSuccess
  // ("back" đóng popup, "list" về danh sách). Xem ProductForm.
  return { ok: true, fieldErrors: {}, formError: null, values: null };
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
  // 25/11: không redirect nữa — form tự điều hướng theo onSuccess
  // ("back" đóng popup, "list" về danh sách). Xem ProductForm.
  return { ok: true, fieldErrors: {}, formError: null, values: null };
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

// ---- Danh mục (25/11 — trang quản lý Danh mục) ----

function categoryFormDataToInput(formData: FormData): CategoryFormInput {
  const get = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    name: get("name"),
    slug: get("slug"),
    sortOrder: get("sortOrder"),
    seoTitle: get("seoTitle"),
    seoDescription: get("seoDescription"),
  };
}

function categoryFail(
  fieldErrors: CategoryFormErrors,
  input: CategoryFormInput,
  formError: string | null = null,
): AdminCategoryState {
  return { ok: false, fieldErrors, formError, values: input };
}

export async function createCategoryAction(
  prevState: AdminCategoryState,
  formData: FormData,
): Promise<AdminCategoryState> {
  await requireAdmin();
  const input = categoryFormDataToInput(formData);
  const { errors, values } = validateCategoryForm(input);
  if (!values) return categoryFail(errors, input);
  const result = await createAdminCategory(values);
  if ("conflict" in result) {
    const fieldErrors: CategoryFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return categoryFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  // 25/11: không redirect nữa — form tự điều hướng theo onSuccess
  // ("back" đóng popup, "list" về danh sách). Xem CategoryForm.
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export async function updateCategoryAction(
  id: number,
  prevState: AdminCategoryState,
  formData: FormData,
): Promise<AdminCategoryState> {
  await requireAdmin();
  const input = categoryFormDataToInput(formData);
  const existing = await getAdminCategory(id);
  if (!existing) {
    return categoryFail({}, input, "Không tìm thấy danh mục.");
  }
  const { errors, values } = validateCategoryForm(input);
  if (!values) return categoryFail(errors, input);
  const result = await updateAdminCategory(id, values);
  if (result === null) {
    return categoryFail({}, input, "Không tìm thấy danh mục.");
  }
  if ("conflict" in result) {
    const fieldErrors: CategoryFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return categoryFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export type DeleteCategoryState = { ok: boolean; error: string | null };

// Xóa danh mục — chỉ khi không còn sản phẩm. Máy chủ kiểm lại số
// sản phẩm trong deleteAdminCategory (không tin con số từ giao diện).
export async function deleteCategoryAction(
  id: number,
): Promise<DeleteCategoryState> {
  await requireAdmin();
  const result = await deleteAdminCategory(id);
  if (!result.ok && result.reason === "not-found") {
    return { ok: false, error: "Không tìm thấy danh mục." };
  }
  if (!result.ok && result.reason === "has-products") {
    return {
      ok: false,
      error: `Danh mục còn ${result.productCount} sản phẩm, không xóa được.`,
    };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/categories");
  return { ok: true, error: null };
}

// ---- Khu vực & phí giao hàng (Ngày 12 C1/C2 — theo mẫu Danh mục) ----

function zoneFormDataToInput(formData: FormData): ZoneFormInput {
  const get = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    name: get("name"),
    fee: get("fee"),
    sortOrder: get("sortOrder"),
    // Checkbox "Đang bật": chỉ gửi khi được chọn ("on").
    isActive: formData.get("isActive") === "on" ? "on" : "false",
  };
}

function zoneFail(
  fieldErrors: ZoneFormErrors,
  input: ZoneFormInput,
  formError: string | null = null,
): AdminZoneState {
  return { ok: false, fieldErrors, formError, values: input };
}

export async function createZoneAction(
  prevState: AdminZoneState,
  formData: FormData,
): Promise<AdminZoneState> {
  await requireAdmin();
  const input = zoneFormDataToInput(formData);
  const { errors, values } = validateZoneForm(input);
  if (!values) return zoneFail(errors, input);
  const result = await createAdminZone(values);
  if ("conflict" in result) {
    const fieldErrors: ZoneFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return zoneFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/shipping-zones");
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export async function updateZoneAction(
  id: number,
  prevState: AdminZoneState,
  formData: FormData,
): Promise<AdminZoneState> {
  await requireAdmin();
  const input = zoneFormDataToInput(formData);
  const existing = await getAdminZone(id);
  if (!existing) {
    return zoneFail({}, input, "Không tìm thấy khu vực.");
  }
  const { errors, values } = validateZoneForm(input);
  if (!values) return zoneFail(errors, input);
  const result = await updateAdminZone(id, values);
  if (result === null) {
    return zoneFail({}, input, "Không tìm thấy khu vực.");
  }
  if ("conflict" in result) {
    const fieldErrors: ZoneFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return zoneFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/shipping-zones");
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export type ToggleZoneState = { ok: boolean; error: string | null };

// Bật/tắt khu vực (đổi isActive). Không có xóa cứng. Dùng cho nút
// icon + toast Hoàn tác (theo mẫu ToggleActiveButton của sản phẩm).
export async function toggleZoneAction(
  prevState: ToggleZoneState,
  formData: FormData,
): Promise<ToggleZoneState> {
  await requireAdmin();
  const id = Number(formData.get("zoneId"));
  const nextActive = formData.get("isActive") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Không tìm thấy khu vực." };
  }
  const changed = await setAdminZoneActive(id, nextActive);
  if (!changed) return { ok: false, error: "Không tìm thấy khu vực." };
  revalidatePath("/", "layout");
  revalidatePath("/admin/shipping-zones");
  return { ok: true, error: null };
}

export type DeleteZoneState = { ok: boolean; error: string | null };

// Xóa khu vực — chỉ khi chưa có đơn. Máy chủ kiểm lại số đơn
// trong deleteAdminZone (không tin con số từ giao diện).
export async function deleteZoneAction(id: number): Promise<DeleteZoneState> {
  await requireAdmin();
  const result = await deleteAdminZone(id);
  if (result === "not-found") {
    return { ok: false, error: "Không tìm thấy khu vực." };
  }
  if (result === "has-orders") {
    return { ok: false, error: "Khu vực đã có đơn, không xóa được." };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/shipping-zones");
  return { ok: true, error: null };
}

// ---- Trang tĩnh & Chính sách (Ngày 13 B1–B3 — theo mẫu Danh mục) ----

function pageFormDataToInput(formData: FormData): PageFormInput {
  const get = (name: string): string => {
    const v = formData.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    title: get("title"),
    slug: get("slug"),
    content: get("content"),
    seoTitle: get("seoTitle"),
    seoDescription: get("seoDescription"),
    sortOrder: get("sortOrder"),
    // Checkbox: chỉ gửi khi được chọn ("on").
    isPublished: formData.get("isPublished") === "on",
    showInFooter: formData.get("showInFooter") === "on",
    legacyPath: get("legacyPath"),
    // Tick "Tôi hiểu" khi thay /contact, /faq, /policy (Ngày 15 B2).
    confirmReplace: formData.get("confirmReplace") === "on",
  };
}

function pageFail(
  fieldErrors: PageFormErrors,
  input: PageFormInput,
  formError: string | null = null,
): AdminPageState {
  return { ok: false, fieldErrors, formError, values: input };
}

export async function createPageAction(
  prevState: AdminPageState,
  formData: FormData,
): Promise<AdminPageState> {
  await requireAdmin();
  const input = pageFormDataToInput(formData);
  const { errors, values } = validatePageForm(input);
  if (!values) return pageFail(errors, input);
  const result = await createAdminPage(values);
  if ("conflict" in result) {
    const fieldErrors: PageFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return pageFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export async function updatePageAction(
  id: number,
  prevState: AdminPageState,
  formData: FormData,
): Promise<AdminPageState> {
  await requireAdmin();
  const input = pageFormDataToInput(formData);
  const existing = await getAdminPage(id);
  if (!existing) {
    return pageFail({}, input, "Không tìm thấy trang.");
  }
  const { errors, values } = validatePageForm(input);
  if (!values) return pageFail(errors, input);
  const result = await updateAdminPage(id, values);
  if (result === null) {
    return pageFail({}, input, "Không tìm thấy trang.");
  }
  if ("conflict" in result) {
    const fieldErrors: PageFormErrors = {
      [result.conflict.field]: result.conflict.message,
    };
    return pageFail(fieldErrors, input);
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true, fieldErrors: {}, formError: null, values: null };
}

export type TogglePageState = { ok: boolean; error: string | null };

// Bật/tắt xuất bản trang (đổi isPublished). Không có hộp xác nhận —
// đảo ngược được bằng một lần bấm nữa, kèm toast Hoàn tác (theo mẫu
// ToggleZoneButton).
export async function togglePageAction(
  prevState: TogglePageState,
  formData: FormData,
): Promise<TogglePageState> {
  await requireAdmin();
  const id = Number(formData.get("pageId"));
  const nextPublished = formData.get("isPublished") === "true";
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Không tìm thấy trang." };
  }
  const result = await setAdminPagePublished(id, nextPublished);
  if (!result.ok && result.reason === "slug-clash") {
    return {
      ok: false,
      error: "Đường dẫn này đã dùng cho một danh mục, không xuất bản được.",
    };
  }
  if (!result.ok) return { ok: false, error: "Không tìm thấy trang." };
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true, error: null };
}

export type DeletePageState = { ok: boolean; error: string | null };

// Xóa trang tĩnh — luôn được phép (trang không có đơn hàng hay sản
// phẩm ràng buộc); máy chủ kiểm lại tồn tại trong deleteAdminPage.
export async function deletePageAction(id: number): Promise<DeletePageState> {
  await requireAdmin();
  const result = await deleteAdminPage(id);
  if (!result.ok) {
    return { ok: false, error: "Không tìm thấy trang." };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/pages");
  return { ok: true, error: null };
}
