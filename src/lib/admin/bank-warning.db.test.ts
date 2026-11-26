// Test CÓ DB thật (Ngày 14 B5) — đếm đơn chuyển khoản chưa thu.
// Chỉ chạy khi DATABASE_URL trỏ localhost (giống các file *.db.test.ts).
// Dữ liệu tự tạo (mã B5TST...) rồi tự xóa.

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
import { countUnpaidBankTransferOrders } from "./orders";

const CODE_UNPAID_BANK = "B5TST00001"; // BANK_TRANSFER, UNPAID, NEW → tính
const CODE_UNPAID_COD = "B5TST00002"; // COD, UNPAID → không tính
const CODE_PAID_BANK = "B5TST00003"; // BANK_TRANSFER, PAID → không tính
const CODE_CANCELLED_BANK = "B5TST00004"; // BANK_TRANSFER, UNPAID, CANCELLED → không tính
const TEST_CODES = [CODE_UNPAID_BANK, CODE_UNPAID_COD, CODE_PAID_BANK, CODE_CANCELLED_BANK];

async function createTestOrder(
  code: string,
  paymentMethod: "COD" | "BANK_TRANSFER",
  paymentStatus: "UNPAID" | "PAID",
  status: "NEW" | "CANCELLED",
) {
  return db.order.create({
    data: {
      code,
      senderName: "DB Test B5",
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
      subtotal: 100000,
      shippingFee: 25000,
      total: 125000,
      paymentMethod,
      paymentStatus,
      paidAt: null,
      status,
    },
  });
}

describe("countUnpaidBankTransferOrders (Ngày 14 B5)", () => {
  before(async () => {
    await db.order.deleteMany({ where: { code: { in: TEST_CODES } } });
    await createTestOrder(CODE_UNPAID_BANK, "BANK_TRANSFER", "UNPAID", "NEW");
    await createTestOrder(CODE_UNPAID_COD, "COD", "UNPAID", "NEW");
    await createTestOrder(CODE_PAID_BANK, "BANK_TRANSFER", "PAID", "NEW");
    await createTestOrder(CODE_CANCELLED_BANK, "BANK_TRANSFER", "UNPAID", "CANCELLED");
  });

  after(async () => {
    await db.order.deleteMany({ where: { code: { in: TEST_CODES } } });
  });

  it("chỉ đếm chuyển khoản chưa thu, không tính COD/đã trả/đã hủy", async () => {
    // Đơn B5TST00001 tạo ở before; các đơn khác không được tính.
    // Đếm tuyệt đối vì DB local có thể đã có đơn khác: so delta.
    const before = await countUnpaidBankTransferOrders();
    await db.order.deleteMany({ where: { code: CODE_UNPAID_BANK } });
    const afterDelete = await countUnpaidBankTransferOrders();
    assert.equal(before - afterDelete, 1);
    await createTestOrder(CODE_UNPAID_BANK, "BANK_TRANSFER", "UNPAID", "NEW");
    assert.equal(await countUnpaidBankTransferOrders(), before);
  });
});
