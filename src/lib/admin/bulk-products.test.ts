// Test thuần — kiểm hợp lệ thao tác hàng loạt (Ngày 17 P3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BULK_PRODUCTS_MAX, parseBulkToggleInput } from "./bulk-products";

describe("parseBulkToggleInput (Ngày 17 P3)", () => {
  it("hợp lệ: ids số, isActive true/false", () => {
    assert.deepEqual(parseBulkToggleInput(["1", "2"], "true"), {
      ids: [1, 2],
      isActive: true,
      error: null,
    });
    assert.deepEqual(parseBulkToggleInput(["3"], "false"), {
      ids: [3],
      isActive: false,
      error: null,
    });
  });
  it("lọc id lạ/trùng/không phải số; rỗng → lỗi chưa chọn", () => {
    assert.deepEqual(parseBulkToggleInput(["1", "1", "abc", "0", "-2", "2.5", 5], "true"), {
      ids: [1],
      isActive: true,
      error: null,
    });
    assert.deepEqual(parseBulkToggleInput([], "true"), {
      ids: [],
      isActive: false,
      error: "Chưa chọn sản phẩm nào.",
    });
    assert.deepEqual(parseBulkToggleInput(["abc"], "true"), {
      ids: [],
      isActive: false,
      error: "Chưa chọn sản phẩm nào.",
    });
  });
  it("isActive lạ → lỗi thao tác; quá 50 id → lỗi giới hạn", () => {
    assert.equal(parseBulkToggleInput(["1"], "yes").error, "Thao tác không hợp lệ.");
    assert.equal(parseBulkToggleInput(["1"], null).error, "Thao tác không hợp lệ.");
    const many = Array.from({ length: BULK_PRODUCTS_MAX + 1 }, (_, i) => String(i + 1));
    assert.equal(
      parseBulkToggleInput(many, "true").error,
      `Tối đa ${BULK_PRODUCTS_MAX} sản phẩm mỗi lần.`,
    );
    const fifty = Array.from({ length: BULK_PRODUCTS_MAX }, (_, i) => String(i + 1));
    assert.equal(parseBulkToggleInput(fifty, "true").error, null);
  });
});
