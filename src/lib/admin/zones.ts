// Truy vấn + ghi khu vực giao hàng cho trang quản trị (Ngày 12
// C1/C2 — theo mẫu trang Danh mục). Danh sách kèm số đơn mỗi khu
// vực (để khóa xóa khi đã có đơn). Xóa chỉ cho phép khi khu vực
// chưa có đơn; không có xóa cưỡng bức (đơn lưu tên khu vực tại lúc
// đặt — orders.area; xóa khu vực đã có đơn sẽ làm mất gốc tra cứu
// phí của đơn cũ).
// Lưu ý: isActive đã có sẵn từ migration khởi tạo (mặc định true)
// nên C1 không cần migration mới — xem "Độ lệch" báo cáo Ngày 12.

import { db } from "../db";
import type { ZoneFormValues } from "./zone-validation";
import {
  changedFieldAudits,
  lifecycleAuditRow,
  writeCatalogAudits,
} from "./catalog-audit";

export type AdminZoneRow = {
  id: number;
  name: string;
  fee: number;
  sortOrder: number;
  isActive: boolean;
  orderCount: number;
};

export type AdminZoneDetail = AdminZoneRow;

export async function listAdminZonesWithCounts(): Promise<AdminZoneRow[]> {
  const rows = await db.shippingZone.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, fee: true, sortOrder: true, isActive: true },
  });
  const counts = await db.order.groupBy({
    by: ["area"],
    _count: { _all: true },
  });
  const byArea = new Map(counts.map((c) => [c.area, c._count._all]));
  return rows.map((r) => ({ ...r, orderCount: byArea.get(r.name) ?? 0 }));
}

export async function getAdminZone(id: number): Promise<AdminZoneDetail | null> {
  const row = await db.shippingZone.findUnique({
    where: { id },
    select: { id: true, name: true, fee: true, sortOrder: true, isActive: true },
  });
  if (!row) return null;
  const orderCount = await db.order.count({ where: { area: row.name } });
  return { ...row, orderCount };
}

// Lỗi trùng lặp tên — trả về trường lỗi để biểu mẫu hiện đúng chỗ,
// không ném lỗi 500.
export type ZoneSaveConflict = { field: "name"; message: string };

export async function createAdminZone(
  values: ZoneFormValues,
): Promise<{ id: number } | { conflict: ZoneSaveConflict }> {
  const nameClash = await db.shippingZone.findFirst({
    where: { name: { equals: values.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (nameClash) {
    return {
      conflict: { field: "name", message: "Tên khu vực này đã dùng cho một khu vực khác." },
    };
  }
  const created = await db.$transaction(async (tx) => {
    const row = await tx.shippingZone.create({
      data: {
        name: values.name,
        fee: values.fee,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      },
      select: { id: true },
    });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(`zone:${row.id}`, null, "created"),
    ]);
    return row;
  });
  return { id: created.id };
}

export async function updateAdminZone(
  id: number,
  values: ZoneFormValues,
): Promise<{ id: number } | { conflict: ZoneSaveConflict } | null> {
  const existing = await db.shippingZone.findUnique({ where: { id } });
  if (!existing) return null;
  const nameClash = await db.shippingZone.findFirst({
    where: { name: { equals: values.name, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (nameClash) {
    return {
      conflict: { field: "name", message: "Tên khu vực này đã dùng cho một khu vực khác." },
    };
  }
  const prefix = `zone:${id}`;
  const fieldRows = changedFieldAudits(prefix, [
    { field: "name", oldValue: existing.name, newValue: values.name },
    { field: "fee", oldValue: existing.fee, newValue: values.fee },
    { field: "sortOrder", oldValue: existing.sortOrder, newValue: values.sortOrder },
    {
      field: "isActive",
      oldValue: existing.isActive ? "Đang bật" : "Đã tắt",
      newValue: values.isActive ? "Đang bật" : "Đã tắt",
    },
  ]);
  const auditRows =
    fieldRows.length > 0
      ? fieldRows
      : [lifecycleAuditRow(prefix, existing.name, "updated")];
  await db.$transaction(async (tx) => {
    await tx.shippingZone.update({
      where: { id },
      data: {
        name: values.name,
        fee: values.fee,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      },
    });
    await writeCatalogAudits(tx, auditRows);
  });
  return { id };
}

// Đổi trạng thái bật/tắt (đặt đúng giá trị đích — không cần xác
// nhận, kèm toast Hoàn tác ở phía giao diện, theo mẫu
// setProductActive/ToggleActiveButton của sản phẩm). Ghi nhật ký
// zone:<id>.isActive ("Đang bật" ↔ "Đã tắt", P5); bấm lại cùng
// trạng thái thì không ghi dòng thừa.
export async function setAdminZoneActive(id: number, isActive: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.shippingZone.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!existing) return false;
    if (existing.isActive === isActive) return true;
    await tx.shippingZone.update({ where: { id }, data: { isActive } });
    await writeCatalogAudits(
      tx,
      changedFieldAudits(`zone:${id}`, [
        {
          field: "isActive",
          oldValue: existing.isActive ? "Đang bật" : "Đã tắt",
          newValue: isActive ? "Đang bật" : "Đã tắt",
        },
      ]),
    );
    return true;
  });
}

// Xóa: chỉ khi khu vực chưa có đơn (kiểm lại số đơn ngay trong
// transaction để không xóa nhầm khi có đơn mới vào giữa chừng).
export async function deleteAdminZone(
  id: number,
): Promise<"ok" | "not-found" | "has-orders"> {
  return db.$transaction(async (tx) => {
    const zone = await tx.shippingZone.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!zone) return "not-found";
    const orderCount = await tx.order.count({ where: { area: zone.name } });
    if (orderCount > 0) return "has-orders";
    await tx.shippingZone.delete({ where: { id } });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(`zone:${id}`, zone.name, "deleted"),
    ]);
    return "ok";
  });
}
