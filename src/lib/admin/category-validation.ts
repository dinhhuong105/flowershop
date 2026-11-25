// Kiểm tra dữ liệu biểu mẫu danh mục quản trị (25/11 — trang
// quản lý Danh mục). Kiểm ở MÁY CHỦ, lỗi từng trường, giữ nguyên
// giá trị đã nhập. File này chỉ chứa quy tắc thuần (không truy
// vấn DB); kiểm tra duy nhất (slug) nằm ở src/lib/admin/categories.ts.
// Tái dùng slugifyName + PRODUCT_SLUG_RE của sản phẩm (Ngày 7).

import { isReservedSlug } from "@/lib/reserved-slugs";
import {
  MAX_PRODUCT_NAME_LENGTH,
  MAX_PRODUCT_SLUG_LENGTH,
  MAX_PRODUCT_SORT_ORDER,
  MIN_PRODUCT_SORT_ORDER,
  PRODUCT_SLUG_RE,
  slugifyName,
} from "./product-validation";

// Dữ liệu thô từ FormData (mọi trường đều là chuỗi).
export type CategoryFormInput = {
  name: string;
  slug: string;
  sortOrder: string;
};

export type CategoryFormValues = {
  name: string;
  slug: string;
  sortOrder: number;
};

export type CategoryFormErrors = Partial<
  Record<"name" | "slug" | "sortOrder", string>
>;

// Đọc một trường số nguyên từ chuỗi: "1.5", "abc", "" → null.
function parseIntField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateCategoryForm(input: CategoryFormInput): {
  errors: CategoryFormErrors;
  values: CategoryFormValues | null;
} {
  const errors: CategoryFormErrors = {};

  const name = input.name.trim();
  if (name.length < 3 || name.length > MAX_PRODUCT_NAME_LENGTH) {
    errors.name = "Tên danh mục phải từ 3 đến 120 ký tự.";
  }

  // Slug trống → tự sinh từ tên; slug nhập tay phải đúng mẫu, ≤ 80,
  // và không được trùng đường dẫn cố định của hệ thống.
  const slug = input.slug.trim() === "" ? slugifyName(name) : input.slug.trim();
  if (slug === "" || slug.length > MAX_PRODUCT_SLUG_LENGTH) {
    errors.slug = "Đường dẫn phải từ 1 đến 80 ký tự.";
  } else if (!PRODUCT_SLUG_RE.test(slug)) {
    errors.slug =
      "Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối, không bắt đầu/kết thúc bằng dấu gạch nối.";
  } else if (isReservedSlug(slug)) {
    errors.slug = "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.";
  }

  const sortOrder = input.sortOrder.trim() === "" ? 0 : parseIntField(input.sortOrder);
  if (sortOrder === null) {
    errors.sortOrder = "Thứ tự sắp xếp phải là số nguyên.";
  } else if (sortOrder < MIN_PRODUCT_SORT_ORDER || sortOrder > MAX_PRODUCT_SORT_ORDER) {
    errors.sortOrder = "Thứ tự sắp xếp phải từ 0 đến 9999.";
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      name,
      slug,
      sortOrder: sortOrder as number,
    },
  };
}
