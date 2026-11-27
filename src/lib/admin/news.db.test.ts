// Test CÓ DB thật (Ngày 18) — quản lý tin tức: tạo/sửa/xuất bản/
// về nháp/xóa, chặn trùng slug (tin khác, danh mục, trang tĩnh,
// đường dẫn cố định), publishedAt chỉ đặt khi xuất bản lần đầu,
// danh sách công khai chỉ có bài đã xuất bản, mới nhất trước,
// nhật ký "news:<slug>".
// Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo
// (slug có tiền tố "test-") rồi tự xóa, kể cả dòng audit.

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
  createAdminNews,
  deleteAdminNews,
  getPublishedNewsBySlug,
  listAdminNews,
  listPublishedNews,
  setAdminNewsPublished,
  updateAdminNews,
} from "./news";
import type { NewsFormValues } from "./news-validation";

const N = "test-ngay18";

function values(over: Partial<NewsFormValues> = {}): NewsFormValues {
  return {
    title: "Tin thử Ngày 18",
    slug: `${N}-tin-thu`,
    excerpt: "Tóm tắt tin thử.",
    content: "# Nội dung\n\nXin chào.",
    coverImage: "",
    author: "Hoa Tươi",
    seoTitle: "",
    seoDescription: "",
    isPublished: false,
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

describe("quản lý tin tức (Ngày 18)", () => {
  let newsId = 0;

  before(async () => {
    await db.settingsAudit.deleteMany({ where: { key: { startsWith: `news:${N}` } } });
    await db.newsArticle.deleteMany({ where: { slug: { startsWith: N } } });
  });

  after(async () => {
    if (newsId !== 0) {
      await db.newsArticle.deleteMany({ where: { id: newsId } });
    }
    await db.settingsAudit.deleteMany({ where: { key: { startsWith: `news:${N}` } } });
    await db.newsArticle.deleteMany({ where: { slug: { startsWith: N } } });
  });

  it("tạo bài nháp → không hiện ở shop, có dòng audit created", async () => {
    const created = await createAdminNews(values());
    assert.ok(!("conflict" in created));
    newsId = (created as { id: number }).id;
    assert.equal(await getPublishedNewsBySlug(`${N}-tin-thu`), null);
    const rows = await auditRows(`news:${N}-tin-thu`);
    assert.deepEqual(
      rows.map((r) => [r.key, r.oldValue, r.newValue, r.updatedBy]),
      [[`news:${N}-tin-thu`, null, "created", "admin"]],
    );
    const list = await listPublishedNews();
    assert.ok(list.rows.every((r) => r.slug !== `${N}-tin-thu`));
  });

  it("slug trùng bài khác / danh mục / trang tĩnh / đường dẫn cố định → conflict", async () => {
    const dup = await createAdminNews(values({ title: "Tin khác" }));
    assert.ok("conflict" in dup);
    assert.equal(dup.conflict.field, "slug");
    const cat = await createAdminNews(values({ slug: "hoa-tuoi" }));
    assert.ok("conflict" in cat);
    const page = await createAdminNews(values({ slug: "gioi-thieu" }));
    assert.ok("conflict" in page);
    const reserved = await createAdminNews(values({ slug: "tin-tuc" }));
    assert.ok("conflict" in reserved);
  });

  it("xuất bản lần đầu → publishedAt được đặt; về nháp rồi xuất bản lại → giữ ngày cũ", async () => {
    assert.deepEqual(await setAdminNewsPublished(newsId, true), { ok: true });
    const first = await db.newsArticle.findUnique({
      where: { id: newsId },
      select: { publishedAt: true },
    });
    assert.ok(first?.publishedAt instanceof Date);
    const rows = await auditRows(`news:${N}-tin-thu`);
    assert.ok(
      rows.some((r) => r.oldValue === "draft" && r.newValue === "news-published"),
      "xuất bản phải ghi dòng news-published",
    );
    assert.ok((await getPublishedNewsBySlug(`${N}-tin-thu`)) !== null);
    assert.deepEqual(await setAdminNewsPublished(newsId, false), { ok: true });
    assert.equal(await getPublishedNewsBySlug(`${N}-tin-thu`), null);
    assert.deepEqual(await setAdminNewsPublished(newsId, true), { ok: true });
    const second = await db.newsArticle.findUnique({
      where: { id: newsId },
      select: { publishedAt: true },
    });
    assert.equal(second?.publishedAt?.getTime(), first?.publishedAt?.getTime());
  });

  it("sửa tiêu đề → dòng audit updated; sửa slug trùng → conflict", async () => {
    const updated = await updateAdminNews(
      newsId,
      values({ title: "Tin thử đã đổi tên", isPublished: true }),
    );
    assert.ok(updated !== null && !("conflict" in updated));
    const rows = await auditRows(`news:${N}-tin-thu`);
    assert.ok(
      rows.some((r) => r.oldValue === "Tin thử Ngày 18" && r.newValue === "updated"),
      "sửa phải ghi dòng updated",
    );
    const clash = await updateAdminNews(newsId, values({ slug: "hoa-tuoi" }));
    assert.ok(clash !== null && "conflict" in clash);
  });

  it("danh sách công khai: chỉ bài đã xuất bản, mới nhất trước; lọc admin theo trạng thái + tìm kiếm", async () => {
    const second = await createAdminNews(
      values({ slug: `${N}-tin-thu-2`, title: "Tin thử 2", isPublished: true }),
    );
    assert.ok(!("conflict" in second));
    const secondId = (second as { id: number }).id;
    const list = await listPublishedNews();
    const ours = list.rows.filter((r) => r.slug.startsWith(N));
    assert.deepEqual(
      ours.map((r) => r.slug),
      [`${N}-tin-thu-2`, `${N}-tin-thu`],
      "mới xuất bản sau đứng trước (publishedAt DESC + id DESC)",
    );
    const published = await listAdminNews({ status: "published" });
    assert.ok(published.some((r) => r.id === newsId));
    const draft = await listAdminNews({ status: "draft" });
    assert.ok(draft.every((r) => r.id !== newsId));
    const found = await listAdminNews({ q: "đã đổi tên" });
    assert.ok(found.some((r) => r.id === newsId));
    const notFound = await listAdminNews({ q: "không có chuỗi này" });
    assert.equal(notFound.length, 0);
    await db.newsArticle.deleteMany({ where: { id: secondId } });
    await db.settingsAudit.deleteMany({
      where: { key: { startsWith: `news:${N}-tin-thu-2` } },
    });
  });

  it("xóa bài → dòng audit deleted, shop trả null", async () => {
    assert.deepEqual(await deleteAdminNews(newsId), { ok: true });
    assert.equal(await getPublishedNewsBySlug(`${N}-tin-thu`), null);
    const rows = await auditRows(`news:${N}-tin-thu`);
    assert.ok(
      rows.some((r) => r.oldValue === "Tin thử đã đổi tên" && r.newValue === "deleted"),
      "xóa phải ghi dòng deleted",
    );
    newsId = 0; // đã xóa trong test, after() không xóa lại
    assert.deepEqual(await deleteAdminNews(999999), {
      ok: false,
      reason: "not-found",
    });
    assert.deepEqual(await setAdminNewsPublished(999999, true), {
      ok: false,
      reason: "not-found",
    });
    assert.equal(await updateAdminNews(999999, values()), null);
  });
});

describe("tìm kiếm tin tức công khai (Ngày 18)", () => {
  const S = "test-ngay18-search";
  before(async () => {
    await db.newsArticle.deleteMany({ where: { slug: { startsWith: S } } });
  });
  after(async () => {
    await db.newsArticle.deleteMany({ where: { slug: { startsWith: S } } });
    await db.settingsAudit.deleteMany({ where: { key: { startsWith: `news:${S}` } } });
  });

  it("chỉ tìm thấy bài ĐÃ XUẤT BẢN, không phân biệt dấu, AND giữa các từ", async () => {
    const { searchNews } = await import("../search");
    await createAdminNews(
      values({
        slug: `${S}-hoa-hong`,
        title: "Cách cắm hoa hồng ngày Tết",
        excerpt: "Hoa hồng đỏ thắm.",
        content: "Nội dung về hoa hồng.",
        isPublished: true,
      }),
    );
    await createAdminNews(
      values({
        slug: `${S}-nhap`,
        title: "Bài nháp về hoa hồng",
        excerpt: "",
        content: "Hoa hồng trong bài nháp.",
        isPublished: false,
      }),
    );
    const hits = await searchNews("hoa hong");
    assert.ok(hits.some((h) => h.slug === `${S}-hoa-hong`), "phải tìm thấy bài đã xuất bản");
    assert.ok(!hits.some((h) => h.slug === `${S}-nhap`), "bài nháp không được lọt vào");
    // Không phân biệt dấu: "hoa hong" khớp "hoa hồng".
    assert.ok(hits.length >= 1);
    const none = await searchNews("hoa hong khong co tu nay");
    assert.equal(none.length, 0);
    assert.deepEqual(await searchNews(""), []);
  });
});
