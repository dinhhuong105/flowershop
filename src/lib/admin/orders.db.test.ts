// Test CÓ DB thật (Ngày 9 D9-6) — chạy riêng, KHÔNG nằm trong
// `npm test` (unit test thường vẫn chạy không cần DB).
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại file báo lỗi
// rõ và dừng (không bao giờ chạy lên DB production).
// Các ca kiểm: truy vấn danh sách/lọc/đếm tab trên Postgres thật,
// hồi quy lỗi enum 42883 của D8-3 (tham số text so cột enum → 500),
// thông báo lỗi chuyển trạng thái dùng nhãn tiếng Việt, số liệu
// dashboard. Dữ liệu tự tạo (mã DBTST00001/02) rồi tự xóa.

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
  listAdminOrders,
  transitionOrder,
} from "./orders";
import { getAdminDashboardStats } from "./dashboard";

const CODE_A = "DBTST00001"; // NEW, COD, UNPAID
const CODE_B = "DBTST00002"; // CONFIRMED, BANK_TRANSFER, PAID

async function createTestOrder(code: string, status: "NEW" | "CONFIRMED") {
  const product = await db.product.findFirst({
    where: { id: 1 },
    select: { id: true, name: true, salePrice: true, price: true },
  });
  assert.ok(product, "cần sản phẩm id 1 (chạy seed gốc trước)");
  const unitPrice = product.salePrice ?? product.price;
  return db.order.create({
    data: {
      code,
      senderName: "DB Test",
      senderPhone: "0900000011",
      senderEmail: null,
      receiverName: "Người Nhận DB",
      receiverPhone: "0900000012",
      address: "1 đường DB Test",
      area: "Khu vực trung tâm",
      deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      deliverySlot: "08:00 – 10:00",
      deliveryMethod: "SCHEDULED",
      deliverySurcharge: 0,
      subtotal: unitPrice,
      shippingFee: 25000,
      total: unitPrice + 25000,
      paymentMethod: status === "NEW" ? "COD" : "BANK_TRANSFER",
      paymentStatus: status === "NEW" ? "UNPAID" : "PAID",
      paidAt: status === "NEW" ? null : new Date(),
      status,
      items: {
        create: [
          {
            productId: product.id,
            name: product.name,
            price: unitPrice,
            quantity: 1,
            image: null,
          },
        ],
      },
    },
  });
}

before(async () => {
  await db.order.deleteMany({
    where: { code: { in: [CODE_A, CODE_B] } },
  });
  await createTestOrder(CODE_A, "NEW");
  await createTestOrder(CODE_B, "CONFIRMED");
});

after(async () => {
  await db.order.deleteMany({
    where: { code: { in: [CODE_A, CODE_B] } },
  });
  await db.$disconnect();
});

describe("listAdminOrders trên Postgres thật (Ngày 9 D9-6)", () => {
  // Hồi quy lỗi D8-3: lọc payment và tab trạng thái từng trả HTTP 500
  // (tham số text so cột enum, Postgres 42883) vì thiếu ép kiểu
  // ::"PaymentStatus" / ::"OrderStatus". Nếu ép kiểu mất đi, các
  // gọi dưới đây ném lỗi ngay — test này bắt đúng lỗi đó.
  it("lọc payment + tab trạng thái không ném 42883", async () => {
    const byPayment = await listAdminOrders({ payment: "PAID", q: "DBTST" });
    assert.equal(byPayment.total, 1);
    assert.equal(byPayment.orders[0].code, CODE_B);
    const unpaid = await listAdminOrders({ payment: "UNPAID", q: "DBTST" });
    assert.equal(unpaid.total, 1);
    assert.equal(unpaid.orders[0].code, CODE_A);
    const tabNew = await listAdminOrders({ tab: "NEW", q: "DBTST" });
    assert.equal(tabNew.total, 1);
    assert.equal(tabNew.orders[0].code, CODE_A);
    const tabConfirmed = await listAdminOrders({ tab: "CONFIRMED", q: "DBTST" });
    assert.equal(tabConfirmed.total, 1);
    assert.equal(tabConfirmed.orders[0].code, CODE_B);
  });

  it("tìm theo mã + số đếm tab khớp dữ liệu", async () => {
    const all = await listAdminOrders({ tab: "all", q: "DBTST" });
    assert.equal(all.total, 2);
    assert.equal(all.counts.NEW, 1);
    assert.equal(all.counts.CONFIRMED, 1);
    assert.equal(all.counts.all, 2);
    assert.equal(all.counts.CANCELLED, 0);
    const one = await listAdminOrders({ q: CODE_A });
    assert.equal(one.total, 1);
    assert.equal(one.orders[0].code, CODE_A);
  });

  it("phân trang: page=99 trả 0 đơn, giữ nguyên tổng", async () => {
    const page99 = await listAdminOrders({ tab: "all", q: "DBTST", page: 99 });
    assert.equal(page99.orders.length, 0);
    assert.equal(page99.total, 2);
    assert.equal(page99.totalPages, 1);
    assert.equal(page99.page, 99);
  });
});

describe("thông báo lỗi dùng nhãn tiếng Việt (Ngày 9 D9-5)", () => {
  it("chuyển sai bước: 'Đã tiếp nhận' → 'Đã giao', không có mã enum", async () => {
    const result = await transitionOrder(CODE_A, "COMPLETED", "NEW");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(
        result.error,
        "Không thể chuyển đơn từ Đã tiếp nhận sang Đã giao.",
      );
      assert.ok(!result.error.includes("NEW"));
      assert.ok(!result.error.includes("COMPLETED"));
    }
  });
});

describe("số liệu dashboard trên DB thật (Ngày 9 D9-8)", () => {
  it("getAdminDashboardStats trả số, đơn cần xử lý ≥ 2 đơn test", async () => {
    const stats = await getAdminDashboardStats();
    assert.equal(typeof stats.pendingCount, "number");
    assert.equal(typeof stats.todayDeliveryCount, "number");
    assert.equal(typeof stats.unpaidBankTransferCount, "number");
    assert.equal(typeof stats.revenueToday, "number");
    assert.equal(typeof stats.revenue7Days, "number");
    assert.ok(stats.pendingCount >= 2, `pendingCount = ${stats.pendingCount}`);
    assert.ok(stats.revenue7Days >= stats.revenueToday);
  });
});
