// Test thuần — cột Nguồn sản phẩm/danh mục (Ngày 17 P1).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCT_SOURCES,
  isProductSource,
  productSourceLabel,
} from "./product-source";

describe("product source (Ngày 17 P1)", () => {
  it("ba giá trị hợp lệ: seed / manual / import", () => {
    assert.deepEqual([...PRODUCT_SOURCES], ["seed", "manual", "import"]);
    for (const s of PRODUCT_SOURCES) assert.equal(isProductSource(s), true);
  });
  it("giá trị lạ → không phải nguồn hợp lệ", () => {
    assert.equal(isProductSource(""), false);
    assert.equal(isProductSource("SEED"), false);
    assert.equal(isProductSource("nhap-tay"), false);
    assert.equal(isProductSource("seed "), false);
  });
  it("nhãn hiển thị đúng từng nguồn; lạ/null → Không rõ", () => {
    assert.equal(productSourceLabel("seed"), "Hệ thống");
    assert.equal(productSourceLabel("manual"), "Hệ thống");
    assert.equal(productSourceLabel("import"), "Nhập từ ngoài");
    assert.equal(productSourceLabel("la"), "Không rõ");
    assert.equal(productSourceLabel(null), "Không rõ");
    assert.equal(productSourceLabel(undefined), "Không rõ");
  });
});
