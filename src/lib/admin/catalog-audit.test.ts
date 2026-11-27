// Test thuần — helper audit sản phẩm/danh mục/khu vực (Ngày 17 P5).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_AUDIT_VALUE_MAX,
  catalogAuditValue,
  changedFieldAudits,
  lifecycleAuditRow,
  truncateCatalogAuditValue,
} from "./catalog-audit";

describe("catalog audit helper (Ngày 17 P5)", () => {
  it("catalogAuditValue: null → null; số → chuỗi; mảng → nối phẩy; dài → cắt 200", () => {
    assert.equal(catalogAuditValue(null), null);
    assert.equal(catalogAuditValue(undefined), null);
    assert.equal(catalogAuditValue(890000), "890000");
    assert.equal(catalogAuditValue(true), "true");
    assert.equal(catalogAuditValue(["a", "b"]), "a, b");
    assert.equal(catalogAuditValue(""), "");
    const long = "x".repeat(250);
    const cut = catalogAuditValue(long) as string;
    assert.equal(cut.length, CATALOG_AUDIT_VALUE_MAX);
    assert.ok(cut.endsWith("…"));
  });
  it("truncateCatalogAuditValue: ≤200 giữ nguyên", () => {
    assert.equal(truncateCatalogAuditValue("ngắn"), "ngắn");
    assert.equal(truncateCatalogAuditValue("x".repeat(200)).length, 200);
  });
  it("changedFieldAudits: chỉ dòng đã đổi; null → giá trị là đổi; bằng nhau thì không ghi", () => {
    const rows = changedFieldAudits("product:12", [
      { field: "price", oldValue: 890000, newValue: 950000 },
      { field: "name", oldValue: "Bó Hồng", newValue: "Bó Hồng" },
      { field: "salePrice", oldValue: null, newValue: 800000 },
      { field: "sku", oldValue: "HT-001", newValue: null },
    ]);
    assert.deepEqual(rows, [
      { key: "product:12.price", oldValue: "890000", newValue: "950000" },
      { key: "product:12.salePrice", oldValue: null, newValue: "800000" },
      { key: "product:12.sku", oldValue: "HT-001", newValue: "" },
    ]);
  });
  it("lifecycleAuditRow: created/deleted/updated đúng khóa + token", () => {
    assert.deepEqual(lifecycleAuditRow("product:12", null, "created"), {
      key: "product:12",
      oldValue: null,
      newValue: "created",
    });
    assert.deepEqual(lifecycleAuditRow("category:3", "Hoa tươi", "deleted"), {
      key: "category:3",
      oldValue: "Hoa tươi",
      newValue: "deleted",
    });
  });
});
