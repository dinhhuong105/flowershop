import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldSeed } from "./seed-guard";

describe("chặn seed hồi sinh dữ liệu demo (mục 1 verdict Ngày 10)", () => {
  it("DB trống cả 3 bảng → seed", () => {
    assert.equal(
      shouldSeed({ categories: 0, products: 0, shippingZones: 0 }, false),
      true,
    );
  });
  it("chỉ 1 bảng có dòng → không seed", () => {
    assert.equal(
      shouldSeed({ categories: 0, products: 1, shippingZones: 0 }, false),
      false,
    );
    assert.equal(
      shouldSeed({ categories: 0, products: 0, shippingZones: 1 }, false),
      false,
    );
    assert.equal(
      shouldSeed({ categories: 4, products: 21, shippingZones: 4 }, false),
      false,
    );
  });
  it("--force → seed kể cả khi DB đã có dữ liệu", () => {
    assert.equal(
      shouldSeed({ categories: 4, products: 21, shippingZones: 4 }, true),
      true,
    );
  });
});
