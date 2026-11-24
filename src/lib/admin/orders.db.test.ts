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
const CODE_C = "DBTST00003"; // COMPLETED, sự kiện hoàn tất cách đây 3 ngày
const CODE_D = "DBTST00004"; // COMPLETED, sự kiện hoàn tất cách đây 8 ngày
const CODE_E = "DBTST00005"; // COMPLETED, HAI sự kiện hoàn tất cùng lúc
const CODE_F = "DBTST00006"; // NEW, BANK_TRANSFER, UNPAID, giao hôm nay
const CODE_G = "DBTST00007"; // CANCELLED, BANK_TRANSFER, UNPAID, giao hôm nay
const TEST_CODES = [CODE_A, CODE_B, CODE_C, CODE_D, CODE_E, CODE_F, CODE_G];

// Tạo đơn COMPLETED với các sự kiện STATUS_CHANGE → COMPLETED tại
// đúng thời điểm cho trước (sửa 12 mục verdict Ngày 9, mục 9+10).
// Trả về đơn đã tạo (kèm total để test đối chiếu delta doanh thu).
async function createCompletedTestOrder(code: string, eventDates: Date[]) {
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
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      paidAt: null,
      status: "COMPLETED",
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
      events: {
        create: eventDates.map((createdAt) => ({
          type: "STATUS_CHANGE" as const,
          fromStatus: "DELIVERING" as const,
          toStatus: "COMPLETED" as const,
          note: null,
          createdAt,
        })),
      },
    },
  });
}

const daysAgo = (n: number): Date =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

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

// Đơn test cho link thẻ dashboard (Ngày 10 D10-2): chuyển khoản chưa
// thu + trạng thái + ngày giao tùy chọn — để kiểm số đếm dashboard
// khớp total danh sách đích khi dùng bộ lọc mới (method + exclude).
async function createLinkTestOrder(
  code: string,
  status: "NEW" | "CANCELLED",
  deliveryDate: Date,
) {
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
      deliveryDate,
      deliverySlot: "08:00 – 10:00",
      deliveryMethod: "SCHEDULED",
      deliverySurcharge: 0,
      subtotal: unitPrice,
      shippingFee: 25000,
      total: unitPrice + 25000,
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "UNPAID",
      paidAt: null,
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
    where: { code: { in: TEST_CODES } },
  });
  await createTestOrder(CODE_A, "NEW");
  await createTestOrder(CODE_B, "CONFIRMED");
});

after(async () => {
  await db.order.deleteMany({
    where: { code: { in: TEST_CODES } },
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

  // Ranh giới ngày (sửa 12 mục verdict Ngày 9, mục 9): trước đây
  // seed đặt cả 5 sự kiện COMPLETED ở "now" nên doanh thu hôm nay
  // luôn bằng doanh thu 7 ngày — test này chưa chứng minh được ranh
  // giới. Đơn hoàn tất 3 ngày trước chỉ tính vào 7 ngày (không tính
  // vào hôm nay); đơn hoàn tất 8 ngày trước bị loại khỏi cả hai.
  // Đối chiếu bằng delta trước/sau để không phụ thuộc dữ liệu có sẵn
  // trong DB (vd đơn mẫu Ngày 7).
  it("ranh giới ngày: đơn 3 ngày trước chỉ vào 7 ngày, đơn 8 ngày trước bị loại", async () => {
    const before = await getAdminDashboardStats();
    const threeDays = await createCompletedTestOrder(CODE_C, [daysAgo(3)]);
    // Đơn 8 ngày trước chỉ cần tồn tại (không cộng vào đâu) nên không
    // cần giữ biến.
    await createCompletedTestOrder(CODE_D, [daysAgo(8)]);
    try {
      const afterStats = await getAdminDashboardStats();
      assert.equal(
        afterStats.revenueToday,
        before.revenueToday,
        "đơn 3 ngày và 8 ngày trước không được tính vào hôm nay",
      );
      assert.equal(
        afterStats.revenue7Days,
        before.revenue7Days + threeDays.total,
        "chỉ đơn 3 ngày trước cộng vào 7 ngày, đơn 8 ngày trước bị loại",
      );
      assert.ok(
        afterStats.revenue7Days > afterStats.revenueToday,
        "sau khi thêm đơn 3 ngày trước, doanh thu 7 ngày phải lớn hơn hôm nay",
      );
    } finally {
      await db.order.deleteMany({
        where: { code: { in: [CODE_C, CODE_D] } },
      });
    }
  });

  // Hồi quy tính trùng doanh thu (sửa 12 mục verdict Ngày 9, mục 10):
  // trước sửa, dashboard cộng theo từng sự kiện STATUS_CHANGE →
  // COMPLETED nên một đơn hoàn tất 2 lần bị tính 2 lần. Sau sửa phải
  // gom theo orderId, chỉ tính 1 lần.
  it("một đơn có 2 sự kiện COMPLETED chỉ tính doanh thu 1 lần", async () => {
    const before = await getAdminDashboardStats();
    const now = new Date();
    const order = await createCompletedTestOrder(CODE_E, [now, now]);
    try {
      const afterStats = await getAdminDashboardStats();
      assert.equal(
        afterStats.revenueToday,
        before.revenueToday + order.total,
        "đơn có 2 sự kiện hoàn tất cùng lúc chỉ cộng 1 lần vào hôm nay",
      );
      assert.equal(
        afterStats.revenue7Days,
        before.revenue7Days + order.total,
        "đơn có 2 sự kiện hoàn tất cùng lúc chỉ cộng 1 lần vào 7 ngày",
      );
    } finally {
      await db.order.deleteMany({ where: { code: CODE_E } });
    }
  });
});

describe("link thẻ dashboard khớp số trên thẻ (Ngày 10 D10-2)", () => {
  // Trước sửa, 2 link thẻ sai: "Đơn giao hôm nay" trỏ tới
  // ?tab=all&date=... (lẫn đơn hủy, danh sách ra 12 trong khi thẻ
  // ghi 11); "Chuyển khoản chưa thu" trỏ tới ?tab=all&payment=UNPAID
  // (lẫn cả COD chưa thu, danh sách ra 24 trong khi thẻ ghi 7).
  // Sau sửa, link mới thêm method=BANK_TRANSFER + exclude=CANCELLED
  // (thẻ giao hôm nay chỉ thêm exclude). Test so delta số đếm
  // dashboard với delta total danh sách đích — dùng delta để không
  // phụ thuộc dữ liệu có sẵn trong DB.
  it("số đếm dashboard (delta) = total danh sách đích (delta) với bộ lọc mới", async () => {
    const before = await getAdminDashboardStats();
    const today = new Date(`${before.todayVn}T00:00:00Z`);
    const listBefore = {
      bank: await listAdminOrders({
        tab: "all",
        payment: "UNPAID",
        method: "BANK_TRANSFER",
        exclude: "CANCELLED",
        q: "DBTST",
      }),
      today: await listAdminOrders({
        tab: "all",
        date: before.todayVn,
        exclude: "CANCELLED",
        q: "DBTST",
      }),
      pending: await listAdminOrders({ tab: "pending", q: "DBTST" }),
    };
    // Đơn F (NEW, chuyển khoản chưa thu, giao hôm nay) cộng vào cả 3
    // số; đơn G (đã hủy, cùng phương thức + ngày giao) không cộng
    // vào đâu.
    await createLinkTestOrder(CODE_F, "NEW", today);
    await createLinkTestOrder(CODE_G, "CANCELLED", today);
    try {
      const after = await getAdminDashboardStats();
      assert.equal(
        after.pendingCount - before.pendingCount,
        1,
        "chỉ đơn F (NEW) cộng vào cần xử lý, đơn G đã hủy không cộng",
      );
      assert.equal(
        after.todayDeliveryCount - before.todayDeliveryCount,
        1,
        "chỉ đơn F cộng vào giao hôm nay, đơn G đã hủy không cộng",
      );
      assert.equal(
        after.unpaidBankTransferCount - before.unpaidBankTransferCount,
        1,
        "chỉ đơn F cộng vào chuyển khoản chưa thu, đơn G đã hủy không cộng",
      );
      const bankAfter = await listAdminOrders({
        tab: "all",
        payment: "UNPAID",
        method: "BANK_TRANSFER",
        exclude: "CANCELLED",
        q: "DBTST",
      });
      assert.equal(
        bankAfter.total - listBefore.bank.total,
        after.unpaidBankTransferCount - before.unpaidBankTransferCount,
        "link chuyển khoản chưa thu: delta danh sách = delta số trên thẻ",
      );
      const todayAfter = await listAdminOrders({
        tab: "all",
        date: after.todayVn,
        exclude: "CANCELLED",
        q: "DBTST",
      });
      assert.equal(
        todayAfter.total - listBefore.today.total,
        after.todayDeliveryCount - before.todayDeliveryCount,
        "link giao hôm nay: delta danh sách = delta số trên thẻ",
      );
      const pendingAfter = await listAdminOrders({ tab: "pending", q: "DBTST" });
      assert.equal(
        pendingAfter.total - listBefore.pending.total,
        after.pendingCount - before.pendingCount,
        "link cần xử lý: delta danh sách = delta số trên thẻ",
      );
      // Hồi quy link cũ (chỉ payment=UNPAID, không method, không
      // loại hủy): link này hiện nhiều hơn số trên thẻ (lẫn đơn COD
      // A và đơn hủy G) nên không được dùng nữa.
      const oldLink = await listAdminOrders({
        tab: "all",
        payment: "UNPAID",
        q: "DBTST",
      });
      assert.ok(
        oldLink.total >
          after.unpaidBankTransferCount - before.unpaidBankTransferCount,
        "link cũ payment=UNPAID hiện nhiều hơn số trên thẻ (lẫn COD + đơn hủy)",
      );
    } finally {
      await db.order.deleteMany({
        where: { code: { in: [CODE_F, CODE_G] } },
      });
    }
  });
});
