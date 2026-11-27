// Test CÓ DB thật (Ngày 17 P1–P5) — cột Nguồn, lọc theo nguồn,
// thao tác hàng loạt ẩn/hiện, SKU duy nhất, và nhật ký
// sản phẩm/danh mục/khu vực (P5 = E2) vào settings_audit.
// Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo
// (slug/tên có tiền tố "p5-") rồi tự xóa, kể cả dòng audit.

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
import { listActivity } from "./activity";
import {
  createAdminCategory,
  deleteAdminCategory,
  listAdminCategoriesWithCounts,
  updateAdminCategory,
} from "./categories";
import {
  createAdminProduct,
  listAdminProducts,
  setProductActive,
  setProductsActiveBulk,
  updateAdminProduct,
} from "./products";
import {
  createAdminZone,
  deleteAdminZone,
  setAdminZoneActive,
  updateAdminZone,
} from "./zones";

const P5 = "p5-test";

function productValues(over: Record<string, unknown> = {}) {
  return {
    name: "Bó Hoa P5 Test",
    slug: `${P5}-bo-hoa`,
    sku: "P5-TEST-01",
    categoryId: 1,
    price: 500000,
    salePrice: null,
    description: "Mô tả sản phẩm kiểm thử P5.",
    tags: [],
    sortOrder: 0,
    isActive: true,
    inStock: true,
    isFastDelivery: false,
    images: [],
    seoTitle: "",
    seoDescription: "",
    ...over,
  };
}

async function auditRows(keyPrefix: string) {
  return db.settingsAudit.findMany({
    where: { key: { startsWith: keyPrefix } },
    orderBy: { id: "asc" },
    select: { key: true, oldValue: true, newValue: true, updatedBy: true },
  });
}

describe("cột Nguồn + nhật ký sản phẩm/danh mục/khu vực (Ngày 17 P1–P5)", () => {
  let productId = 0;
  let product2Id = 0;
  let categoryId = 0;
  let zoneId = 0;
  // Id đã xóa trong test (after() vẫn phải dọn dòng audit của chúng).
  let deletedCategoryId = 0;
  let deletedZoneId = 0;

  before(async () => {
    await db.product.deleteMany({ where: { slug: { startsWith: P5 } } });
    await db.category.deleteMany({ where: { slug: { startsWith: P5 } } });
    await db.shippingZone.deleteMany({ where: { name: { startsWith: "Khu vực P5" } } });
  });

  after(async () => {
    if (productId !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: "product:P5-TEST-01" } },
      });
      await db.product.deleteMany({ where: { id: productId } });
    }
    if (product2Id !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: "product:P5-TEST-02" } },
      });
      await db.product.deleteMany({ where: { id: product2Id } });
    }
    if (categoryId !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: `category:${categoryId}` } },
      });
      await db.category.deleteMany({ where: { id: categoryId } });
    }
    if (zoneId !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: `zone:${zoneId}` } },
      });
      await db.shippingZone.deleteMany({ where: { id: zoneId } });
    }
    if (deletedCategoryId !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: `category:${deletedCategoryId}` } },
      });
    }
    if (deletedZoneId !== 0) {
      await db.settingsAudit.deleteMany({
        where: { key: { startsWith: `zone:${deletedZoneId}` } },
      });
    }
    await db.product.deleteMany({ where: { slug: { startsWith: P5 } } });
    await db.category.deleteMany({ where: { slug: { startsWith: P5 } } });
    await db.shippingZone.deleteMany({ where: { name: { startsWith: "Khu vực P5" } } });
  });

  it("P1: tạo sản phẩm trong admin → nguồn manual + dòng audit created", async () => {
    const created = await createAdminProduct(productValues());
    assert.ok(!("conflict" in created));
    productId = (created as { id: number }).id;
    const row = await db.product.findUnique({
      where: { id: productId },
      select: { source: true },
    });
    assert.equal(row?.source, "manual");
    const rows = await auditRows("product:P5-TEST-01");
    assert.deepEqual(
      rows.map((r) => [r.key, r.oldValue, r.newValue, r.updatedBy]),
      [["product:P5-TEST-01", null, "created", "admin"]],
    );
  });

  it("P1: sản phẩm seed có nguồn seed; lọc theo nguồn tách đúng 2 nhóm", async () => {
    const seed = await listAdminProducts({ source: "seed" });
    const manual = await listAdminProducts({ source: "manual" });
    assert.ok(seed.total >= 20, `seed phải có ≥20 SP mẫu, được ${seed.total}`);
    assert.ok(seed.products.every((p) => p.source === "seed"));
    assert.ok(manual.products.some((p) => p.id === productId));
    assert.ok(manual.products.every((p) => p.source === "manual"));
    assert.ok(!manual.products.some((p) => p.source === "seed"));
  });

  it("P4: SKU trùng → từ chối (conflict sku), không tạo thêm sản phẩm", async () => {
    const dup = await createAdminProduct(
      productValues({ slug: `${P5}-bo-hoa-trung-sku` }),
    );
    assert.ok("conflict" in dup);
    assert.equal(dup.conflict.field, "sku");
    const count = await db.product.count({ where: { sku: "P5-TEST-01" } });
    assert.equal(count, 1);
  });

  it("P5: sửa giá sản phẩm → chỉ dòng audit price cũ → mới; trường không đổi không ghi", async () => {
    const updated = await updateAdminProduct(
      productId,
      productValues({ price: 550000 }),
    );
    assert.ok(updated !== null && !("conflict" in updated));
    const rows = await auditRows("product:P5-TEST-01.price");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].oldValue, "500000");
    assert.equal(rows[0].newValue, "550000");
    assert.equal(rows[0].updatedBy, "admin");
    const nameRows = await auditRows("product:P5-TEST-01.name");
    assert.equal(nameRows.length, 0, "tên không đổi thì không ghi dòng name");
  });

  it("P5: ẩn sản phẩm → dòng audit isActive; bấm lại cùng trạng thái → không ghi thừa", async () => {
    assert.equal(await setProductActive(productId, false), true);
    const rows = await auditRows("product:P5-TEST-01.isActive");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].oldValue, "Đang bán");
    assert.equal(rows[0].newValue, "Đã ẩn");
    assert.equal(await setProductActive(productId, false), true);
    assert.equal((await auditRows("product:P5-TEST-01.isActive")).length, 1);
    assert.equal(await setProductActive(productId, true), true);
    assert.equal((await auditRows("product:P5-TEST-01.isActive")).length, 2);
  });

  it("P3: thao tác hàng loạt ẩn 2 sản phẩm → updated 2, mỗi SP một dòng audit; id lạ báo missing", async () => {
    const created2 = await createAdminProduct(
      productValues({
        slug: `${P5}-bo-hoa-2`,
        sku: "P5-TEST-02",
        name: "Bó Hoa P5 Test 2",
      }),
    );
    assert.ok(!("conflict" in created2));
    product2Id = (created2 as { id: number }).id;
    const result = await setProductsActiveBulk([productId, product2Id, 999999], false);
    assert.deepEqual(result, { updated: 2, missing: [999999] });
    for (const [id, sku] of [[productId, "P5-TEST-01"], [product2Id, "P5-TEST-02"]] as const) {
      const rows = await auditRows(`product:${sku}.isActive`);
      assert.ok(
        rows.some((r) => r.oldValue === "Đang bán" && r.newValue === "Đã ẩn"),
        `SP ${id} phải có dòng audit ẩn từ thao tác hàng loạt`,
      );
      assert.equal(
        (await db.product.findUnique({ where: { id }, select: { isActive: true } }))
          ?.isActive,
        false,
      );
    }
    // Trả lại trạng thái ban đầu cho 2 SP test.
    const back = await setProductsActiveBulk([productId, product2Id], true);
    assert.equal(back.updated, 2);
  });

  it("P1+P5: danh mục — tạo nguồn manual, lọc nguồn, sửa tên ghi audit, xóa ghi deleted", async () => {
    const created = await createAdminCategory({
      name: "Danh Mục P5 Test",
      slug: `${P5}-danh-muc`,
      sortOrder: 99,
      seoTitle: "",
      seoDescription: "",
    });
    assert.ok(!("conflict" in created));
    categoryId = (created as { id: number }).id;
    const row = await db.category.findUnique({
      where: { id: categoryId },
      select: { source: true },
    });
    assert.equal(row?.source, "manual");
    const manualCats = await listAdminCategoriesWithCounts({ source: "manual" });
    assert.ok(manualCats.some((c) => c.id === categoryId));
    const seedCats = await listAdminCategoriesWithCounts({ source: "seed" });
    assert.equal(seedCats.length, 4, "4 danh mục seed mẫu");
    assert.ok(seedCats.every((c) => c.source === "seed"));
    const updated = await updateAdminCategory(categoryId, {
      name: "Danh Mục P5 Đã Đổi Tên",
      slug: `${P5}-danh-muc`,
      sortOrder: 99,
      seoTitle: "",
      seoDescription: "",
    });
    assert.ok(updated !== null && !("conflict" in updated));
    const nameRows = await auditRows(`category:${categoryId}.name`);
    assert.equal(nameRows.length, 1);
    assert.equal(nameRows[0].oldValue, "Danh Mục P5 Test");
    assert.equal(nameRows[0].newValue, "Danh Mục P5 Đã Đổi Tên");
    const deleted = await deleteAdminCategory(categoryId);
    assert.deepEqual(deleted, { ok: true });
    const delRows = await auditRows(`category:${categoryId}`);
    assert.ok(
      delRows.some((r) => r.newValue === "deleted" && r.oldValue === "Danh Mục P5 Đã Đổi Tên"),
      "xóa danh mục phải ghi dòng deleted",
    );
    categoryId = 0; // đã xóa trong test, after() không xóa lại
    deletedCategoryId = (created as { id: number }).id;
  });

  it("P5: khu vực — tạo/sửa phí/bật-tắt/xóa đều ghi audit", async () => {
    const created = await createAdminZone({
      name: "Khu vực P5 Test",
      fee: 10000,
      sortOrder: 99,
      isActive: true,
    });
    assert.ok(!("conflict" in created));
    zoneId = (created as { id: number }).id;
    assert.deepEqual(
      (await auditRows(`zone:${zoneId}`)).map((r) => r.newValue),
      ["created"],
    );
    const updated = await updateAdminZone(zoneId, {
      name: "Khu vực P5 Test",
      fee: 15000,
      sortOrder: 99,
      isActive: true,
    });
    assert.ok(updated !== null && !("conflict" in updated));
    const feeRows = await auditRows(`zone:${zoneId}.fee`);
    assert.equal(feeRows.length, 1);
    assert.equal(feeRows[0].oldValue, "10000");
    assert.equal(feeRows[0].newValue, "15000");
    assert.equal(await setAdminZoneActive(zoneId, false), true);
    const activeRows = await auditRows(`zone:${zoneId}.isActive`);
    assert.equal(activeRows.length, 1);
    assert.equal(activeRows[0].oldValue, "Đang bật");
    assert.equal(activeRows[0].newValue, "Đã tắt");
    assert.equal(await deleteAdminZone(zoneId), "ok");
    const delRows = await auditRows(`zone:${zoneId}`);
    assert.ok(delRows.some((r) => r.newValue === "deleted"));
    deletedZoneId = zoneId;
    zoneId = 0; // đã xóa trong test
  });

  it("P5: /admin/activity lọc được theo khu vực Sản phẩm/Danh mục/Khu vực", async () => {
    const productList = await listActivity({ area: "product" });
    assert.ok(productList.total >= 1, "phải có ít nhất 1 dòng audit sản phẩm");
    assert.ok(productList.rows.every((r) => r.key.startsWith("product:")));
    assert.ok(
      productList.rows.some((r) => r.key === "product:P5-TEST-01.price"),
      "lọc Sản phẩm phải thấy dòng đổi giá vừa tạo",
    );
    const categoryList = await listActivity({ area: "category" });
    assert.ok(categoryList.rows.every((r) => r.key.startsWith("category:")));
    const zoneList = await listActivity({ area: "zone" });
    assert.ok(zoneList.rows.every((r) => r.key.startsWith("zone:")));
  });
});
