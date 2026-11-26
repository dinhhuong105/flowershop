// Test thuần — chọn bản ghi dọn production (Ngày 11 A2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectProductionCleanup } from "./clean-production";

const order = (code: string, senderName: string, status = "NEW", paymentStatus = "UNPAID") => ({
  code,
  senderName,
  status,
  paymentStatus,
});

describe("selectProductionCleanup", () => {
  it("đơn tên [TEST] khớp; đơn thường không khớp", () => {
    const s = selectProductionCleanup(
      {
        orders: [order("AAA", "[TEST] Nguyễn Văn A"), order("BBB", "Nguyễn Văn B")],
        products: [],
      },
      { orderCodes: [], productSkus: [], allowPaid: false },
    );
    assert.deepEqual(s.orders.map((o) => o.code), ["AAA"]);
    assert.deepEqual(s.refused, []);
  });
  it("mã trong --orders và SKU trong --skus khớp dù tên không phải [TEST]", () => {
    const s = selectProductionCleanup(
      {
        orders: [order("CCC", "Khách Thật")],
        products: [
          { id: 1, sku: "TEST-001" },
          { id: 2, sku: "HOA-001" },
        ],
      },
      { orderCodes: ["CCC"], productSkus: ["TEST-001"], allowPaid: false },
    );
    assert.deepEqual(s.orders.map((o) => o.code), ["CCC"]);
    assert.deepEqual(s.products.map((p) => p.id), [1]);
  });
  it("> 20 đơn khớp → từ chối", () => {
    const orders = Array.from({ length: 21 }, (_, i) => order(`T${i}`, "[TEST] X"));
    const s = selectProductionCleanup(
      { orders, products: [] },
      { orderCodes: [], productSkus: [], allowPaid: false },
    );
    assert.equal(s.refused.length, 1);
    assert.match(s.refused[0] ?? "", /21 đơn/);
  });
  it("đơn COMPLETED+PAID khớp → từ chối khi thiếu --allow-paid, qua khi có", () => {
    const input = {
      orders: [order("DDD", "[TEST] X", "COMPLETED", "PAID")],
      products: [],
    };
    const refused = selectProductionCleanup(input, {
      orderCodes: [],
      productSkus: [],
      allowPaid: false,
    });
    assert.equal(refused.refused.length, 1);
    assert.match(refused.refused[0] ?? "", /DDD/);
    const allowed = selectProductionCleanup(input, {
      orderCodes: [],
      productSkus: [],
      allowPaid: true,
    });
    assert.deepEqual(allowed.refused, []);
    assert.deepEqual(allowed.orders.map((o) => o.code), ["DDD"]);
  });
  it("không khớp gì → danh sách rỗng, không từ chối", () => {
    const s = selectProductionCleanup(
      {
        orders: [order("EEE", "Khách Thật", "COMPLETED", "PAID")],
        products: [{ id: 3, sku: "HOA-002" }],
      },
      { orderCodes: [], productSkus: [], allowPaid: false },
    );
    assert.deepEqual(s.orders, []);
    assert.deepEqual(s.products, []);
    assert.deepEqual(s.refused, []);
  });
});
