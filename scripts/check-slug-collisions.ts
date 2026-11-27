// Liệt kê các cặp slug trùng giữa danh mục, trang tĩnh và tin tức
// (Ngày 15 B1.4, mở rộng Ngày 18 sang tin tức) — CHỈ ĐỌC, không
// sửa dữ liệu.
//   npx tsx scripts/check-slug-collisions.ts
// Từ chối chạy khi NODE_ENV=production HOẶC khi host của
// DATABASE_URL không phải localhost (theo mẫu clean-test-data.ts).
// Dự kiến 0 cặp: hai chiều đều bị chặn lúc lưu (danh mục trùng
// trang → từ chối; trang trùng danh mục → từ chối; xuất bản trang
// trùng danh mục → từ chối; tin tức trùng danh mục/trang tĩnh →
// từ chối; slug cấm "tin-tuc" và các đường dẫn cố định khác bị chặn
// ở tầng validate của cả ba loại). Nếu vẫn có cặp trùng (dữ liệu
// cũ), route gốc ưu tiên trang tĩnh đã xuất bản (xem README "Trang
// tĩnh và danh mục — quy tắc ưu tiên slug").
// Kiểm cả hai chiều với slug cấm (RESERVED_SLUGS): slug danh mục/
// trang tĩnh/bài tin tức nào trùng đường dẫn cố định đều được liệt
// kê — dữ liệu cũ tạo trước khi có quy tắc chặn có thể còn sót.

process.loadEnvFile(".env");

import { db } from "../src/lib/db";
import { isReservedSlug } from "../src/lib/reserved-slugs";

async function main(): Promise<void> {
  const dbHost = (() => {
    try {
      return new URL((process.env.DATABASE_URL ?? "").trim()).hostname;
    } catch {
      return "";
    }
  })();
  if (
    process.env.NODE_ENV === "production" ||
    (dbHost !== "localhost" && dbHost !== "127.0.0.1" && dbHost !== "::1")
  ) {
    console.error(
      `[check-slug-collisions] Từ chối chạy: chỉ chạy ở local (NODE_ENV=${process.env.NODE_ENV ?? "(trống)"}, host: ${dbHost || "(trống)"}).`,
    );
    process.exit(2);
  }

  const [categories, pages, news] = await Promise.all([
    db.category.findMany({ select: { slug: true }, orderBy: { slug: "asc" } }),
    db.page.findMany({
      select: { slug: true, isPublished: true },
      orderBy: { slug: "asc" },
    }),
    db.newsArticle.findMany({
      select: { slug: true, isPublished: true },
      orderBy: { slug: "asc" },
    }),
  ]);
  const pageBySlug = new Map(pages.map((p) => [p.slug, p.isPublished]));
  const categorySlugs = new Set(categories.map((c) => c.slug));

  const lines: string[] = [];
  // Danh mục ↔ trang tĩnh (như trước).
  for (const c of categories) {
    if (pageBySlug.has(c.slug)) {
      lines.push(
        `- ${c.slug} (danh mục ↔ trang tĩnh ${pageBySlug.get(c.slug) ? "đã xuất bản" : "nháp"} — route gốc ưu tiên trang tĩnh)`,
      );
    }
  }
  // Tin tức ↔ danh mục / trang tĩnh (Ngày 18).
  for (const n of news) {
    if (categorySlugs.has(n.slug)) {
      lines.push(`- ${n.slug} (tin tức ↔ danh mục)`);
    }
    if (pageBySlug.has(n.slug)) {
      lines.push(
        `- ${n.slug} (tin tức ↔ trang tĩnh ${pageBySlug.get(n.slug) ? "đã xuất bản" : "nháp"})`,
      );
    }
  }
  // Slug cấm hai chiều: bất kỳ slug nào trong ba bảng trùng đường
  // dẫn cố định (kể cả "tin-tuc") đều liệt kê.
  for (const [kind, slugs] of [
    ["danh mục", categories.map((c) => c.slug)],
    ["trang tĩnh", pages.map((p) => p.slug)],
    ["tin tức", news.map((n) => n.slug)],
  ] as const) {
    for (const slug of slugs) {
      if (isReservedSlug(slug)) {
        lines.push(`- ${slug} (${kind} trùng đường dẫn cố định)`);
      }
    }
  }
  if (lines.length === 0) {
    console.log(
      `0 cặp trùng slug giữa danh mục (${categories.length}), trang tĩnh (${pages.length}) và tin tức (${news.length}); 0 slug trùng đường dẫn cố định.`,
    );
  } else {
    console.log(`${lines.length} va chạm slug:`);
    for (const line of lines) console.log(line);
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(
    "[check-slug-collisions] Lỗi:",
    error instanceof Error ? error.message : error,
  );
  await db.$disconnect();
  process.exitCode = 1;
});
