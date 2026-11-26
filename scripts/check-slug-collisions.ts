// Liệt kê các cặp slug trùng giữa danh mục và trang tĩnh
// (Ngày 15 B1.4) — CHỈ ĐỌC, không sửa dữ liệu.
//   npx tsx scripts/check-slug-collisions.ts
// Từ chối chạy khi NODE_ENV=production HOẶC khi host của
// DATABASE_URL không phải localhost (theo mẫu clean-test-data.ts).
// Dự kiến 0 cặp: hai chiều đều bị chặn lúc lưu (danh mục trùng
// trang → từ chối; trang trùng danh mục → từ chối; xuất bản trang
// trùng danh mục → từ chối). Nếu vẫn có cặp trùng (dữ liệu cũ),
// route gốc ưu tiên trang tĩnh đã xuất bản (xem README "Trang tĩnh
// và danh mục — quy tắc ưu tiên slug").

process.loadEnvFile(".env");

import { db } from "../src/lib/db";

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

  const [categories, pages] = await Promise.all([
    db.category.findMany({ select: { slug: true }, orderBy: { slug: "asc" } }),
    db.page.findMany({
      select: { slug: true, isPublished: true },
      orderBy: { slug: "asc" },
    }),
  ]);
  const pageBySlug = new Map(pages.map((p) => [p.slug, p.isPublished]));
  const clashes = categories.filter((c) => pageBySlug.has(c.slug));
  if (clashes.length === 0) {
    console.log(
      `0 cặp trùng slug giữa danh mục (${categories.length}) và trang tĩnh (${pages.length}).`,
    );
  } else {
    console.log(`${clashes.length} cặp trùng slug giữa danh mục và trang tĩnh:`);
    for (const c of clashes) {
      console.log(
        `- ${c.slug} (trang ${pageBySlug.get(c.slug) ? "đã xuất bản" : "nháp"} — route gốc ưu tiên trang tĩnh)`,
      );
    }
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
