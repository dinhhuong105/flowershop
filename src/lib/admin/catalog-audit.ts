// Ghi nhật ký sản phẩm/danh mục/khu vực vào settings_audit
// (Ngày 17 P5 = E2), theo mẫu trang tĩnh (pages.ts): cùng transaction
// với thay đổi, updatedBy "admin" (admin duy nhất), không có đường
// xóa/sửa trong giao diện (xem activity.ts).
//
// Quy ước khóa (để /admin/activity lọc được theo khu vực):
//   product:<id>            — vòng đời (created/deleted/updated)
//   product:<id>.<trường>   — đổi từng trường (vd product:12.price)
//   category:<id>[.<trường>], zone:<id>[.<trường>] — tương tự.
// Giá trị nhạy cảm: sản phẩm/danh mục/khu vực không có STK/token;
// giá/phí là số VND công khai trên shop nên ghi số thô. Mô tả/ảnh
// dài thì cắt 200 ký tự lúc ghi để nhật ký không phình.

import type { Prisma } from "@prisma/client";

export type CatalogAuditTx = Prisma.TransactionClient;

export type CatalogAuditRow = {
  key: string;
  oldValue: string | null;
  newValue: string;
};

export const CATALOG_AUDIT_UPDATED_BY = "admin";

// Cắt giá trị dài lúc ghi (200 ký tự, kể dấu "…").
export const CATALOG_AUDIT_VALUE_MAX = 200;

export function truncateCatalogAuditValue(value: string): string {
  if (value.length <= CATALOG_AUDIT_VALUE_MAX) return value;
  return `${value.slice(0, CATALOG_AUDIT_VALUE_MAX - 1)}…`;
}

// Một trường thành chuỗi ghi nhật ký: null → null (hiển thị
// "(trống)"), số → số thập phân, mảng → nối ", ", chuỗi dài → cắt.
export function catalogAuditValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    return truncateCatalogAuditValue(value.map((v) => String(v)).join(", "));
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return truncateCatalogAuditValue(String(value));
}

// So sánh từng trường cũ → mới, chỉ trả các dòng ĐÃ ĐỔI (so sánh
// sau khi chuẩn hóa qua catalogAuditValue, nên null và "" là khác
// nhau — giống quy tắc "đã đổi" của saveSettingsToDb).
export function changedFieldAudits(
  prefix: string,
  fields: Array<{ field: string; oldValue: unknown; newValue: unknown }>,
): CatalogAuditRow[] {
  const rows: CatalogAuditRow[] = [];
  for (const f of fields) {
    const oldV = catalogAuditValue(f.oldValue);
    const newV = catalogAuditValue(f.newValue);
    if (oldV === newV) continue;
    rows.push({ key: `${prefix}.${f.field}`, oldValue: oldV, newValue: newV ?? "" });
  }
  return rows;
}

// Ghi một dòng vòng đời (created/deleted/updated): newValue là
// token tiếng Anh thô để formatActivityChange đổi thành nhãn Việt
// ("Đã tạo"/"Đã xóa"/"Cập nhật") như trang tĩnh.
export function lifecycleAuditRow(
  prefix: string,
  oldValue: string | null,
  lifecycle: "created" | "deleted" | "updated",
): CatalogAuditRow {
  return { key: prefix, oldValue, newValue: lifecycle };
}

export async function writeCatalogAudits(
  tx: CatalogAuditTx,
  rows: CatalogAuditRow[],
): Promise<void> {
  for (const row of rows) {
    await tx.settingsAudit.create({
      data: {
        key: row.key,
        oldValue: row.oldValue,
        newValue: row.newValue,
        updatedBy: CATALOG_AUDIT_UPDATED_BY,
      },
    });
  }
}
