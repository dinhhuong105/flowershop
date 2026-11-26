// Test CÓ DB thật (Ngày 14 C1/C4) — legacyPath: tạo/sửa/xung đột/
// nhật ký, tra cứu trang thay thế. Chỉ chạy khi DATABASE_URL trỏ
// localhost. Dữ liệu tự tạo (slug trang-thay-*-test) rồi tự xóa.

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
  createAdminPage,
  updateAdminPage,
  getPublishedPageByLegacyPath,
  getLegacyReplacements,
} from "./pages";

const SLUG_A = "trang-thay-about-test";
const SLUG_B = "trang-thay-faq-test";

function values(slug: string, legacyPath: string | null, isPublished = true) {
  return {
    title: `Trang thay thế ${slug}`,
    slug,
    content: "Nội dung thử.",
    seoTitle: "",
    seoDescription: "",
    sortOrder: 99,
    isPublished,
    showInFooter: false,
    legacyPath,
  };
}

describe("legacyPath (Ngày 14 C1/C4)", () => {
  let idA = 0;

  before(async () => {
    await db.page.deleteMany({
      where: { slug: { in: [SLUG_A, SLUG_B] } },
    });
    await db.settingsAudit.deleteMany({
      where: { key: { in: [`page:${SLUG_A}`, `page:${SLUG_B}`] } },
    });
  });

  after(async () => {
    await db.page.deleteMany({
      where: { slug: { in: [SLUG_A, SLUG_B] } },
    });
    await db.settingsAudit.deleteMany({
      where: { key: { in: [`page:${SLUG_A}`, `page:${SLUG_B}`] } },
    });
  });

  it("tạo trang thay /about đã xuất bản → tra được theo đường dẫn cũ", async () => {
    const created = await createAdminPage(values(SLUG_A, "/about", true));
    assert.ok(!("conflict" in created));
    idA = (created as { id: number }).id;
    const found = await getPublishedPageByLegacyPath("/about");
    assert.equal(found?.slug, SLUG_A);
    const replacements = await getLegacyReplacements();
    assert.equal(replacements.get("/about"), SLUG_A);
  });

  it("trang thứ hai cùng thay /about → xung đột legacyPath", async () => {
    const result = await createAdminPage(values(SLUG_B, "/about", true));
    assert.ok("conflict" in result);
    if ("conflict" in result) {
      assert.equal(result.conflict.field, "legacyPath");
      assert.ok(result.conflict.message.includes(SLUG_A));
    }
  });

  it("đổi legacyPath sang /faq → tra theo mới được, cũ hết; nhật ký ghi lại", async () => {
    const updated = await updateAdminPage(idA, values(SLUG_A, "/faq", true));
    assert.ok(updated !== null && !("conflict" in updated));
    assert.equal((await getPublishedPageByLegacyPath("/about"))?.slug, undefined);
    assert.equal((await getPublishedPageByLegacyPath("/faq"))?.slug, SLUG_A);
    const audit = await db.settingsAudit.findMany({
      where: { key: `page:${SLUG_A}`, newValue: "thay thế /faq" },
    });
    assert.equal(audit.length, 1);
  });

  it("gỡ xuất bản → không còn trang thay thế /faq", async () => {
    const updated = await updateAdminPage(idA, values(SLUG_A, "/faq", false));
    assert.ok(updated !== null && !("conflict" in updated));
    assert.equal(await getPublishedPageByLegacyPath("/faq"), null);
    const replacements = await getLegacyReplacements();
    assert.equal(replacements.has("/faq"), false);
  });
});
