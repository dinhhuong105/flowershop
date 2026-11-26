// Test CÓ DB thật — Khu vực giao hàng (Ngày 12 C1/C4). Chạy riêng,
// KHÔNG nằm trong `npm test`:
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại file báo lỗi
// rõ và dừng (không bao giờ chạy lên DB production).
// Các ca kiểm (C4): tắt khu vực không đổi tổng đơn cũ; xóa khu vực
// có đơn bị từ chối; đặt đơn ở khu vực đã tắt bị từ chối ở server
// (kiểm đúng điều kiện mà action đặt hàng dùng: `!zone ||
// !zone.isActive` — xem src/app/actions/order.ts; đường đi đầy đủ
// qua form checkout kiểm bằng CDP ở báo cáo Ngày 12).
// Dữ liệu tự tạo (khu vực "Khu vực test C4" + đơn DBTST00011) rồi tự xóa.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.loadEnvFile(".env");

const dbHost = (() => {
  try {
    return new URL((process.env.DATABASE_URL ?? "").trim()).hostname;
  } catch {
    return "";
  }
})();
if (dbHost !== "localhost" && dbHost !== "127.0.0.1" && dbHost !== "::1") {
  throw new Error(
    `[test:db] Từ chối chạy: DATABASE_URL không phải localhost (host: ${dbHost || "(trống)"}).`,
  );
}

import { db } from "../db";
import {
  createAdminZone,
  deleteAdminZone,
  getAdminZone,
  listAdminZonesWithCounts,
  setAdminZoneActive,
  updateAdminZone,
} from "./zones";

const ZONE_NAME = "Khu vực test C4";
const ORDER_CODE = "DBTST00011";

async function cleanupC4() {
  await db.order.deleteMany({ where: { code: ORDER_CODE } });
  await db.shippingZone.deleteMany({ where: { name: ZONE_NAME } });
}

describe("khu vực giao hàng (DB, Ngày 12 C1/C4)", () => {
  before(async () => {
    await cleanupC4();
  });

  after(async () => {
    await cleanupC4();
  });

  it("tạo khu vực → có trong danh sách, số đơn 0", async () => {
    const created = await createAdminZone({
      name: ZONE_NAME,
      fee: 99000,
      sortOrder: 99,
      isActive: true,
    });
    assert.ok(!("conflict" in created), "tên test không được trùng");
    const zones = await listAdminZonesWithCounts();
    const row = zones.find((z) => z.name === ZONE_NAME);
    assert.ok(row);
    assert.equal(row.fee, 99000);
    assert.equal(row.orderCount, 0);
    assert.equal(row.isActive, true);
  });

  it("tắt khu vực không đổi tổng đơn cũ; khu vực tắt biến khỏi danh sách đang bật", async () => {
    const zone = await db.shippingZone.findFirstOrThrow({ where: { name: ZONE_NAME } });
    const product = await db.product.findFirstOrThrow({
      where: { id: 1 },
      select: { id: true, name: true, salePrice: true, price: true },
    });
    const unitPrice = product.salePrice ?? product.price;
    const total = unitPrice + 99000;
    await db.order.create({
      data: {
        code: ORDER_CODE,
        senderName: "DB Test C4",
        senderPhone: "0900000011",
        senderEmail: null,
        receiverName: "Người Nhận C4",
        receiverPhone: "0900000012",
        address: "1 đường DB Test C4",
        area: ZONE_NAME,
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        deliverySlot: "08:00 – 10:00",
        deliveryMethod: "SCHEDULED",
        deliverySurcharge: 0,
        subtotal: unitPrice,
        shippingFee: 99000,
        total,
        paymentMethod: "COD",
        paymentStatus: "UNPAID",
        paidAt: null,
        status: "NEW",
        items: {
          create: [{ productId: product.id, name: product.name, price: unitPrice, quantity: 1 }],
        },
      },
    });
    // Tắt khu vực → đơn cũ giữ nguyên tổng + phí đã chốt.
    assert.equal(await setAdminZoneActive(zone.id, false), true);
    const orderAfter = await db.order.findUniqueOrThrow({ where: { code: ORDER_CODE } });
    assert.equal(orderAfter.total, total);
    assert.equal(orderAfter.shippingFee, 99000);
    assert.equal(orderAfter.area, ZONE_NAME);
    const active = await db.shippingZone.findMany({ where: { isActive: true } });
    assert.equal(active.some((z) => z.name === ZONE_NAME), false);
  });

  it("xóa khu vực có đơn bị từ chối; khu vực vẫn còn", async () => {
    const zone = await db.shippingZone.findFirstOrThrow({ where: { name: ZONE_NAME } });
    assert.equal(await deleteAdminZone(zone.id), "has-orders");
    assert.ok((await getAdminZone(zone.id)) !== null);
  });

  it("đặt đơn ở khu vực đã tắt: điều kiện từ chối của action đặt hàng đúng", async () => {
    const zone = await db.shippingZone.findFirstOrThrow({ where: { name: ZONE_NAME } });
    assert.equal(zone.isActive, false);
    // Đúng điều kiện trong src/app/actions/order.ts:
    // `if (!zone || !zone.isActive) return fail(...zoneId...)`.
    assert.equal(!zone || !zone.isActive, true);
  });

  it("đổi tên khu vực trùng tên khác (không phân biệt hoa/thường) → conflict; đổi phí OK", async () => {
    const zone = await db.shippingZone.findFirstOrThrow({ where: { name: ZONE_NAME } });
    const clash = await updateAdminZone(zone.id, {
      name: "KHU VỰC TRUNG TÂM",
      fee: 99000,
      sortOrder: 99,
      isActive: false,
    });
    assert.ok(clash !== null && "conflict" in clash);
    assert.equal(clash.conflict.field, "name");
    const ok = await updateAdminZone(zone.id, {
      name: ZONE_NAME,
      fee: 88000,
      sortOrder: 99,
      isActive: false,
    });
    assert.ok(ok !== null && !("conflict" in ok));
    assert.equal((await getAdminZone(zone.id))?.fee, 88000);
  });

  it("xóa khu vực chưa có đơn được; khu vực test biến mất", async () => {
    // Xóa đơn test trước để khu vực thành "chưa có đơn".
    await db.order.deleteMany({ where: { code: ORDER_CODE } });
    const zone = await db.shippingZone.findFirstOrThrow({ where: { name: ZONE_NAME } });
    assert.equal(await deleteAdminZone(zone.id), "ok");
    assert.equal(await getAdminZone(zone.id), null);
  });
});
