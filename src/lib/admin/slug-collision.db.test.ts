// Test CÓ DB thật (Ngày 15 B1) — va chạm slug giữa danh mục và
// trang tĩnh, cả hai chiều + xuất bản lại + quy tắc ưu tiên.
// Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo rồi tự
// xóa; trang seed "gioi-thieu" được xuất bản tạm rồi trả về nháp.

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
import { createAdminCategory } from "./categories";
import {
  getPublishedPageBySlug,
  setAdminPagePublished,
} from "./pages";

const COLLIDE_SLUG = "hoa-tuoi"; // slug danh mục thật trong seed
const SEED_PAGE_SLUG = "gioi-thieu"; // trang seed (nháp)
const TEST_PAGE_SLUG = "trang-va-cham-test";

function categoryValues(slug: string) {
  return { name: `Danh mục ${slug}`, slug, sortOrder: 99, seoTitle: "", seoDescription: "" };
}

function pageValues(slug: string, isPublished: boolean) {
  return {
    title: `Trang ${slug}`,
    slug,
    content: "Nội dung thử.",
    seoTitle: "",
    seoDescription: "",
    sortOrder: 99,
    isPublished,
    showInFooter: false,
    legacyPath: null,
    confirmReplace: false,
  };
}

describe("va chạm slug danh mục ↔ trang tĩnh (Ngày 15 B1)", () => {
  let seedTitle = "";

  before(async () => {
    await db.page.deleteMany({ where: { slug: { in: [TEST_PAGE_SLUG, COLLIDE_SLUG] } } });
    await db.category.deleteMany({ where: { slug: SEED_PAGE_SLUG } });
    await db.settingsAudit.deleteMany({
      where: { key: { in: [`page:${TEST_PAGE_SLUG}`, `page:${SEED_PAGE_SLUG}`] } },
    });
    // Giữ tiêu đề gốc của trang seed để trả lại sau test (không đổi
    // dữ liệu seed ngoài cờ xuất bản).
    seedTitle =
      (await db.page.findUnique({
        where: { slug: SEED_PAGE_SLUG },
        select: { title: true },
      }))?.title ?? "";
  });

  after(async () => {
    await db.page.deleteMany({ where: { slug: { in: [TEST_PAGE_SLUG, COLLIDE_SLUG] } } });
    await db.category.deleteMany({ where: { slug: SEED_PAGE_SLUG } });
    // Trả trang seed về nháp + tiêu đề gốc (trạng thái gốc của DB local).
    await db.page.updateMany({
      where: { slug: SEED_PAGE_SLUG },
      data: { isPublished: false, ...(seedTitle !== "" ? { title: seedTitle } : {}) },
    });
    await db.settingsAudit.deleteMany({
      where: { key: { in: [`page:${TEST_PAGE_SLUG}`, `page:${SEED_PAGE_SLUG}`] } },
    });
  });

  it("tạo danh mục trùng slug trang NHÁP → từ chối", async () => {
    const result = await createAdminCategory(categoryValues(SEED_PAGE_SLUG));
    assert.ok("conflict" in result, "phải trả conflict");
    assert.equal(result.conflict.field, "slug");
    assert.match(result.conflict.message, /trang tĩnh/);
  });

  it("tạo danh mục trùng slug trang ĐÃ XUẤT BẢN → từ chối", async () => {
    const seed = await db.page.findUnique({
      where: { slug: SEED_PAGE_SLUG },
      select: { id: true },
    });
    assert.ok(seed, "trang seed gioi-thieu phải có");
    // Xuất bản bằng nút bật/tắt (chỉ đổi cờ, không đụng tiêu đề).
    const published = await setAdminPagePublished(seed.id, true);
    assert.deepEqual(published, { ok: true });
    const result = await createAdminCategory(categoryValues(SEED_PAGE_SLUG));
    assert.ok("conflict" in result, "phải trả conflict");
    assert.equal(result.conflict.field, "slug");
    assert.match(result.conflict.message, /trang tĩnh/);
  });

  it("xuất bản trang có slug trùng danh mục → từ chối (nút mắt)", async () => {
    // Tạo thẳng bằng db (bỏ qua kiểm tra của lib) để giả lập dữ
    // liệu cũ: trang nháp có slug trùng danh mục thật.
    const created = await db.page.create({
      data: {
        slug: COLLIDE_SLUG,
        title: "Trang trùng danh mục",
        content: "Nội dung thử.",
        isPublished: false,
        sortOrder: 99,
        showInFooter: false,
      },
      select: { id: true },
    });
    const result = await setAdminPagePublished(created.id, true);
    assert.deepEqual(result, { ok: false, reason: "slug-clash" });
    const stillDraft = await db.page.findUnique({
      where: { id: created.id },
      select: { isPublished: true },
    });
    assert.equal(stillDraft?.isPublished, false, "trang phải ở lại nháp");
  });

  it("quy tắc ưu tiên: trang ĐÃ XUẤT BẢN thắng danh mục ở tra slug gốc", async () => {
    // Trang trùng slug danh mục (tạo ở test trên, hoặc tự tạo nếu
    // chạy riêng) → xuất bản thẳng bằng db để giả lập dữ liệu cũ,
    // rồi kiểm tra hàm tra mà route [category] dùng trước tiên.
    let pageRow = await db.page.findUnique({
      where: { slug: COLLIDE_SLUG },
      select: { id: true },
    });
    if (!pageRow) {
      pageRow = await db.page.create({
        data: {
          slug: COLLIDE_SLUG,
          title: "Trang trùng danh mục",
          content: "Nội dung thử.",
          isPublished: false,
          sortOrder: 99,
          showInFooter: false,
        },
        select: { id: true },
      });
    }
    await db.page.update({
      where: { id: pageRow.id },
      data: { isPublished: true },
    });
    const page = await getPublishedPageBySlug(COLLIDE_SLUG);
    assert.ok(page, "tra slug phải trả về trang tĩnh");
    assert.equal(page.slug, COLLIDE_SLUG);
    assert.equal(page.title, "Trang trùng danh mục");
    const category = await db.category.findUnique({
      where: { slug: COLLIDE_SLUG },
      select: { id: true },
    });
    assert.ok(category, "danh mục cùng slug vẫn tồn tại (dữ liệu cũ trùng)");
  });
});
