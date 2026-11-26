// Test CÓ DB thật (Ngày 14 D1/D3) — lưu/đọc SEO riêng của sản phẩm
// và danh mục. Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự
// tạo (slug seo-test-*) rồi tự xóa.

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
import { createAdminProduct, updateAdminProduct } from "./products";
import { createAdminCategory, updateAdminCategory, getAdminCategory } from "./categories";
import { getProduct } from "../product";

const PRODUCT_SLUG = "seo-test-bo-hoa";
const PRODUCT_SKU = "SEO-TEST-01";
const CATEGORY_SLUG = "seo-test-danh-muc";

describe("SEO riêng sản phẩm/danh mục (Ngày 14 D1/D3)", () => {
  let productId = 0;
  let categoryId = 0;

  before(async () => {
    await db.product.deleteMany({ where: { slug: PRODUCT_SLUG } });
    await db.category.deleteMany({ where: { slug: CATEGORY_SLUG } });
  });

  after(async () => {
    if (productId !== 0) await db.product.deleteMany({ where: { id: productId } });
    if (categoryId !== 0) await db.category.deleteMany({ where: { id: categoryId } });
    await db.product.deleteMany({ where: { slug: PRODUCT_SLUG } });
    await db.category.deleteMany({ where: { slug: CATEGORY_SLUG } });
  });

  it("tạo sản phẩm có SEO → mặt shop đọc được đúng giá trị", async () => {
    const created = await createAdminProduct({
      name: "Bó Hoa SEO Test",
      slug: PRODUCT_SLUG,
      sku: PRODUCT_SKU,
      categoryId: 1,
      price: 500000,
      salePrice: null,
      description: "Mô tả sản phẩm kiểm thử SEO.",
      tags: [],
      sortOrder: 0,
      isActive: true,
      inStock: true,
      isFastDelivery: false,
      images: [],
      seoTitle: "Bó Hoa Đẹp Tặng Sinh Nhật",
      seoDescription: "Bó hoa tươi đẹp, giao trong ngày.",
    });
    assert.ok(!("conflict" in created));
    productId = (created as { id: number }).id;
    const shop = await getProduct("hoa-tuoi", PRODUCT_SLUG);
    assert.equal(shop?.seoTitle, "Bó Hoa Đẹp Tặng Sinh Nhật");
    assert.equal(shop?.seoDescription, "Bó hoa tươi đẹp, giao trong ngày.");
  });

  it("sửa SEO sản phẩm → đọc lại đúng; xóa SEO → về rỗng", async () => {
    const updated = await updateAdminProduct(productId, {
      name: "Bó Hoa SEO Test",
      slug: PRODUCT_SLUG,
      sku: PRODUCT_SKU,
      categoryId: 1,
      price: 500000,
      salePrice: null,
      description: "Mô tả sản phẩm kiểm thử SEO.",
      tags: [],
      sortOrder: 0,
      isActive: true,
      inStock: true,
      isFastDelivery: false,
      images: [],
      seoTitle: "Tiêu đề SEO mới",
      seoDescription: "Mô tả SEO mới.",
    });
    assert.ok(updated !== null && !("conflict" in updated));
    assert.equal((await getProduct("hoa-tuoi", PRODUCT_SLUG))?.seoTitle, "Tiêu đề SEO mới");
    const cleared = await updateAdminProduct(productId, {
      name: "Bó Hoa SEO Test",
      slug: PRODUCT_SLUG,
      sku: PRODUCT_SKU,
      categoryId: 1,
      price: 500000,
      salePrice: null,
      description: "Mô tả sản phẩm kiểm thử SEO.",
      tags: [],
      sortOrder: 0,
      isActive: true,
      inStock: true,
      isFastDelivery: false,
      images: [],
      seoTitle: "",
      seoDescription: "",
    });
    assert.ok(cleared !== null && !("conflict" in cleared));
    assert.equal((await getProduct("hoa-tuoi", PRODUCT_SLUG))?.seoTitle, "");
  });

  it("tạo/sửa danh mục có SEO → đọc lại đúng", async () => {
    const created = await createAdminCategory({
      name: "Danh Mục SEO Test",
      slug: CATEGORY_SLUG,
      sortOrder: 99,
      seoTitle: "Danh mục SEO Test",
      seoDescription: "Mô tả danh mục kiểm thử.",
    });
    assert.ok(!("conflict" in created));
    categoryId = (created as { id: number }).id;
    assert.equal((await getAdminCategory(categoryId))?.seoTitle, "Danh mục SEO Test");
    const updated = await updateAdminCategory(categoryId, {
      name: "Danh Mục SEO Test",
      slug: CATEGORY_SLUG,
      sortOrder: 99,
      seoTitle: "Tiêu đề danh mục mới",
      seoDescription: "",
    });
    assert.ok(updated !== null && !("conflict" in updated));
    const after = await getAdminCategory(categoryId);
    assert.equal(after?.seoTitle, "Tiêu đề danh mục mới");
    assert.equal(after?.seoDescription, "");
  });
});
