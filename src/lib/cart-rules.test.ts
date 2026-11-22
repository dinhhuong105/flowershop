import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampQuantity, isValidQuantity } from "./cart-rules";

describe("clampQuantity", () => {
  it("giữ nguyên số nguyên trong [1, 20]", () => {
    assert.equal(clampQuantity(1), 1);
    assert.equal(clampQuantity(5), 5);
    assert.equal(clampQuantity(20), 20);
  });

  it("kẹp hai đầu", () => {
    assert.equal(clampQuantity(0), 1);
    assert.equal(clampQuantity(-3), 1);
    assert.equal(clampQuantity(21), 20);
    assert.equal(clampQuantity(25), 20);
    assert.equal(clampQuantity(1000), 20);
  });

  it("làm tròn xuống số thập phân", () => {
    assert.equal(clampQuantity(1.5), 1);
    assert.equal(clampQuantity(19.9), 19);
  });

  it("không phải số hữu hạn thành 1", () => {
    assert.equal(clampQuantity(NaN), 1);
    assert.equal(clampQuantity(Infinity), 1);
    assert.equal(clampQuantity("5"), 1);
    assert.equal(clampQuantity(null), 1);
    assert.equal(clampQuantity(undefined), 1);
  });
});

describe("isValidQuantity", () => {
  it("chấp nhận số nguyên 1..20", () => {
    for (const n of [1, 2, 10, 20]) assert.equal(isValidQuantity(n), true, `${n}`);
  });

  it("từ chối giá trị ngoài khoảng hoặc không nguyên", () => {
    for (const bad of [0, -1, 21, 25, 1.5, NaN, Infinity]) {
      assert.equal(isValidQuantity(bad), false, `${bad}`);
    }
  });

  it("từ chối kiểu không phải number", () => {
    for (const bad of ["1", "abc", "", null, undefined, {}, []]) {
      assert.equal(isValidQuantity(bad), false, `${String(bad)}`);
    }
  });
});
