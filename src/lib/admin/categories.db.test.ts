// Test CÓ DB thật — danh mục quản trị (25/11). Chạy riêng, KHÔNG
// nằm trong `npm test`:
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại file báo lỗi
// rõ và dừng (không bao giờ chạy lên DB production).
// Các ca kiểm: tạo danh mục, sửa tên/slug, xóa bị chặn khi còn sản
// phẩm, xóa được khi trống. Dữ liệu tự tạo (slug dbtst-*) rồi tự xóa.

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
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategory,
  listAdminCategoriesWithCounts,
  updateAdminCategory,
} from "./categories";

const TEST_SLUG = "dbtst-danh-muc";
const TEST_SLUG_2 = "dbtst-danh-muc-2";

async function cleanupTestCategories() {
  // Xóa sản phẩm thử nếu còn (không nên có), rồi xóa danh mục thử.
  await db.product.deleteMany({ where: { category: { slug: { startsWith: "dbtst-" } } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "dbtst-" } } });
}

describe("admin categories (DB)", () => {
  before(async () => {
    await cleanupTestCategories();
  });

  after(async () => {
    await cleanupTestCategories();
  });

  it("tạo danh mục mới rồi đọc lại được trong danh sách", async () => {
    const created = await createAdminCategory({
      name: "DB Test Danh Mục",
      slug: TEST_SLUG,
      sortOrder: 99,
    });
    assert.ok(!("conflict" in created), "không được trùng slug");
    const rows = await listAdminCategoriesWithCounts();
    const found = rows.find((r) => r.slug === TEST_SLUG);
    assert.ok(found, "danh mục mới phải có trong danh sách");
    assert.equal(found.name, "DB Test Danh Mục");
    assert.equal(found.productCount, 0);
    assert.equal(found.sortOrder, 99);
  });

  it("tạo trùng slug → conflict, không tạo thêm", async () => {
    const result = await createAdminCategory({
      name: "DB Test Trùng",
      slug: TEST_SLUG,
      sortOrder: 1,
    });
    assert.ok("conflict" in result, "phải trả conflict");
    assert.equal(result.conflict.field, "slug");
    const count = await db.category.count({ where: { slug: TEST_SLUG } });
    assert.equal(count, 1);
  });

  it("sửa tên + slug của danh mục", async () => {
    const row = await db.category.findFirst({
      where: { slug: TEST_SLUG },
      select: { id: true },
    });
    assert.ok(row, "cần danh mục thử đã tạo ở ca trước");
    const updated = await updateAdminCategory(row.id, {
      name: "DB Test Đã Sửa",
      slug: TEST_SLUG_2,
      sortOrder: 5,
    });
    assert.ok(updated !== null && !("conflict" in updated), "sửa phải thành công");
    const after = await getAdminCategory(row.id);
    assert.equal(after?.name, "DB Test Đã Sửa");
    assert.equal(after?.slug, TEST_SLUG_2);
    assert.equal(after?.sortOrder, 5);
  });

  it("xóa bị chặn khi danh mục còn sản phẩm", async () => {
    const row = await db.category.findFirst({
      where: { slug: TEST_SLUG_2 },
      select: { id: true },
    });
    assert.ok(row, "cần danh mục thử");
    await db.product.create({
      data: {
        name: "DB Test Sản Phẩm",
        slug: "dbtst-san-pham",
        categoryId: row.id,
        price: 100000,
        salePrice: null,
        description: "",
        tags: [],
        images: [],
        sortOrder: 0,
        isActive: true,
        inStock: true,
        isFastDelivery: false,
      },
    });
    const result = await deleteAdminCategory(row.id);
    assert.equal(result.ok, false);
    assert.equal(
      (result as { reason: string }).reason,
      "has-products",
    );
    assert.equal((result as { productCount: number }).productCount, 1);
    const stillThere = await getAdminCategory(row.id);
    assert.ok(stillThere, "danh mục còn sản phẩm không được xóa");
    await db.product.deleteMany({ where: { categoryId: row.id } });
  });

  it("xóa được khi danh mục trống", async () => {
    const row = await db.category.findFirst({
      where: { slug: TEST_SLUG_2 },
      select: { id: true },
    });
    assert.ok(row, "cần danh mục thử");
    const result = await deleteAdminCategory(row.id);
    assert.deepEqual(result, { ok: true });
    const gone = await getAdminCategory(row.id);
    assert.equal(gone, null);
  });

  it("xóa danh mục không tồn tại → not-found", async () => {
    const result = await deleteAdminCategory(999999);
    assert.deepEqual(result, { ok: false, reason: "not-found" });
  });
});
