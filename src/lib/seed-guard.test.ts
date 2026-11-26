import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProductionDatabaseUrl, shouldSeed } from "./seed-guard";

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

describe("isProductionDatabaseUrl (Ngày 11 A3)", () => {
  it("localhost / 127.0.0.1 / ::1 → không phải production", () => {
    assert.equal(
      isProductionDatabaseUrl("postgresql://hoa:xxx@localhost:5432/hoa_shop"),
      false,
    );
    assert.equal(
      isProductionDatabaseUrl("postgresql://hoa:xxx@127.0.0.1:5432/hoa_shop"),
      false,
    );
    assert.equal(
      isProductionDatabaseUrl("postgresql://hoa:xxx@[::1]:5432/hoa_shop"),
      false,
    );
  });
  it("host Neon (production) → production", () => {
    assert.equal(
      isProductionDatabaseUrl(
        "postgresql://u:p@ep-xxx-ap-southeast-1.aws.neon.tech/db?sslmode=require",
      ),
      true,
    );
  });
  it("trống / không đọc được → không phải production (an toàn: script từ chối vì thiếu URL)", () => {
    assert.equal(isProductionDatabaseUrl(undefined), false);
    assert.equal(isProductionDatabaseUrl(""), false);
    assert.equal(isProductionDatabaseUrl("không-phải-url"), false);
  });
});
