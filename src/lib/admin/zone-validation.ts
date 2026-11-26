// Kiểm tra dữ liệu biểu mẫu khu vực giao hàng quản trị (Ngày 12
// C1/C2). Kiểm ở MÁY CHỦ, lỗi từng trường, giữ nguyên giá trị đã
// nhập. File này chỉ chứa quy tắc thuần (không truy vấn DB); kiểm
// tra duy nhất (tên) nằm ở src/lib/admin/zones.ts.
// Lưu ý: đơn lưu tên khu vực tại lúc đặt (orders.area = tên khu
// vực, xem B0/C0) nên tên là khóa tra cứu đơn — đổi tên khu vực
// không đổi tên khu vực đã lưu trên đơn cũ.

// Dữ liệu thô từ FormData (mọi trường đều là chuỗi).
export type ZoneFormInput = {
  name: string;
  fee: string;
  sortOrder: string;
  isActive: string;
};

export type ZoneFormValues = {
  name: string;
  fee: number;
  sortOrder: number;
  isActive: boolean;
};

export type ZoneFormErrors = Partial<Record<"name" | "fee" | "sortOrder" | "isActive", string>>;

export const MAX_ZONE_NAME_LENGTH = 80;
export const MIN_ZONE_NAME_LENGTH = 2;
export const MAX_ZONE_FEE = 1_000_000;
export const MAX_ZONE_SORT_ORDER = 9999;

// Đọc một trường số nguyên từ chuỗi: "1.5", "abc", "" → null.
function parseIntField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateZoneForm(input: ZoneFormInput): {
  errors: ZoneFormErrors;
  values: ZoneFormValues | null;
} {
  const errors: ZoneFormErrors = {};

  const name = input.name.trim();
  if (name.length < MIN_ZONE_NAME_LENGTH || name.length > MAX_ZONE_NAME_LENGTH) {
    errors.name = "Tên khu vực phải từ 2 đến 80 ký tự.";
  }

  const fee = parseIntField(input.fee);
  if (fee === null || fee < 0 || fee > MAX_ZONE_FEE) {
    errors.fee = "Phí giao hàng phải là số nguyên từ 0 đến 1.000.000 ₫.";
  }

  const sortOrder = parseIntField(input.sortOrder);
  if (sortOrder === null || sortOrder < 0 || sortOrder > MAX_ZONE_SORT_ORDER) {
    errors.sortOrder = "Thứ tự phải là số nguyên từ 0 đến 9.999.";
  }

  const isActive = input.isActive === "on" || input.isActive === "true";

  if (Object.keys(errors).length > 0) {
    return { errors, values: null };
  }
  return { errors, values: { name, fee: fee as number, sortOrder: sortOrder as number, isActive } };
}
