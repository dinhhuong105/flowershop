// Unit test logic thuần theo dõi đơn mới (Ngày 17 N5).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NEW_ORDER_BASE_TITLE,
  hasNewOrders,
  newOrderDelta,
  newOrderTitle,
  newOrderToastMessage,
  parseNewOrderCountResponse,
} from "./new-orders";

describe("newOrderDelta", () => {
  it("tăng: trả đúng số đơn mới", () => {
    assert.equal(newOrderDelta(0, 1), 1);
    assert.equal(newOrderDelta(2, 5), 3);
  });
  it("không đổi hoặc giảm: 0 (không báo đơn mới)", () => {
    assert.equal(newOrderDelta(3, 3), 0);
    assert.equal(newOrderDelta(5, 2), 0);
  });
  it("đầu vào không phải số: 0", () => {
    assert.equal(newOrderDelta(Number.NaN, 2), 0);
    assert.equal(newOrderDelta(1, Number.NaN), 0);
  });
});

describe("hasNewOrders", () => {
  it("tăng → true; không tăng → false", () => {
    assert.equal(hasNewOrders(1, 2), true);
    assert.equal(hasNewOrders(2, 2), false);
    assert.equal(hasNewOrders(2, 1), false);
  });
});

describe("newOrderToastMessage", () => {
  it("1 đơn và nhiều đơn", () => {
    assert.equal(newOrderToastMessage(1), "Có 1 đơn mới");
    assert.equal(newOrderToastMessage(3), "Có 3 đơn mới");
  });
});

describe("newOrderTitle", () => {
  it("có đơn mới: (N) Hoa Tươi Demo — Quản trị", () => {
    assert.equal(newOrderTitle(1), "(1) Hoa Tươi Demo — Quản trị");
    assert.equal(newOrderTitle(2), "(2) Hoa Tươi Demo — Quản trị");
  });
  it("không có đơn mới: tiêu đề gốc", () => {
    assert.equal(newOrderTitle(0), NEW_ORDER_BASE_TITLE);
    assert.equal(newOrderTitle(0), "Hoa Tươi Demo — Quản trị");
  });
});

describe("parseNewOrderCountResponse", () => {
  it("đúng hình dạng 2 trường → nhận", () => {
    assert.deepEqual(parseNewOrderCountResponse({ pendingCount: 2, latestCode: "ABC1234567" }), {
      pendingCount: 2,
      latestCode: "ABC1234567",
    });
    assert.deepEqual(parseNewOrderCountResponse({ pendingCount: 0, latestCode: null }), {
      pendingCount: 0,
      latestCode: null,
    });
  });
  it("hình dạng sai → null (trình duyệt bỏ qua lần hỏi đó)", () => {
    assert.equal(parseNewOrderCountResponse(null), null);
    assert.equal(parseNewOrderCountResponse("x"), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: -1, latestCode: null }), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: 1.5, latestCode: null }), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: "2", latestCode: null }), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: 2 }), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: 2, latestCode: "" }), null);
    assert.equal(parseNewOrderCountResponse({ pendingCount: 2, latestCode: 5 }), null);
  });
});
