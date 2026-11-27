// Dọn dữ liệu test khỏi DB local (Ngày 8 K-8, mở rộng Ngày 9 D9-3).
//   npx tsx scripts/clean-test-data.ts                         # chỉ liệt kê (dry-run)
//   npx tsx scripts/clean-test-data.ts --delete               # xóa thật
//   npx tsx scripts/clean-test-data.ts --only=seed,sessions --delete
//     → Ngày 9: chỉ xóa đơn seed phân trang + phiên admin, GIỮ 3 đơn
//     Ngày 7 + SP 21 làm dữ liệu mẫu.
//   npx tsx scripts/clean-test-data.ts --only=sessions --delete
// Mặc định KHÔNG xóa gì (an toàn). Chỉ khớp đúng:
//   - đơn test: mã trong TEST_ORDER_CODES (3 đơn Ngày 7)
//   - đơn seed phân trang: mã bắt đầu "SEED" (45 đơn Ngày 9)
//   - sản phẩm test: SKU bắt đầu "TEST-"
//   - bài tin tức test (Ngày 18): slug bắt đầu "test-"
//   - sự kiện rate-limit (local): mọi dòng rate_limit_events —
//     đây là nhật ký test (vd các lần poll /api/admin/orders/new-count
//     và tra cứu đơn trong probe/security-live-check), không phải dữ
//     liệu nghiệp vụ; dọn để DB cuối đợt về 0.
// Từ chối chạy khi NODE_ENV=production HOẶC khi host của DATABASE_URL
// không phải localhost (Ngày 9 D9-3: chỉ kiểm NODE_ENV thì ai đó trỏ
// DATABASE_URL vào DB production mà không đặt NODE_ENV vẫn chạy được).
// Xóa đơn trước, rồi mới xét sản phẩm: sản phẩm TEST- còn đơn (kể cả
// đơn không phải test) thì GIỮ LẠI và báo rõ, không xóa mù — vì xóa
// sản phẩm sẽ gỡ liên kết productId của dòng đơn.
// Ngày 8: xóa 5 phiên admin test (--only=sessions --delete), GIỮ SP 21
// + 3 đơn test làm dữ liệu mẫu. Ngày 11: --delete (xóa hết) trước khi
// mở bán.

import { db } from "../src/lib/db";

// Mã 3 đơn test tạo ở Ngày 7 (giữ nguyên trong báo cáo Ngày 8).
export const TEST_ORDER_CODES = ["QAFNN907ZY", "0Z2DZBQNTJ", "1N0PEZH0J7"];
export const SEED_ORDER_PREFIX = "SEED";
export const TEST_SKU_PREFIX = "TEST-";
export const TEST_NEWS_SLUG_PREFIX = "test-";

function dbHostIsLocalhost(): boolean {
  const raw = (process.env.DATABASE_URL ?? "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

type Scope = "sessions" | "orders" | "products" | "seed" | "news" | "ratelimit";

function parseOnly(): Scope[] | null {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const parts = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Scope => s === "sessions" || s === "orders" || s === "products" || s === "seed" || s === "news" || s === "ratelimit");
  return parts.length > 0 ? parts : null;
}

async function main(): Promise<void> {
  process.loadEnvFile(".env");
  if (process.env.NODE_ENV === "production") {
    console.error("[clean-test-data] Từ chối chạy khi NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }
  if (!dbHostIsLocalhost()) {
    console.error(
      "[clean-test-data] Từ chối chạy: host của DATABASE_URL không phải localhost.",
    );
    process.exitCode = 1;
    return;
  }
  const shouldDelete = process.argv.includes("--delete");
  const only = parseOnly();
  const inScope = (s: Scope): boolean => only === null || only.includes(s);

  // 1. Đơn test (mã khớp đúng danh sách) và đơn seed (mã bắt đầu "SEED").
  let testOrders: Array<{ code: string }> = [];
  let seedOrders: Array<{ code: string }> = [];
  if (inScope("orders")) {
    testOrders = await db.order.findMany({
      where: { code: { in: TEST_ORDER_CODES } },
      select: { code: true },
      orderBy: { code: "asc" },
    });
    console.log(
      `[đơn test] ${testOrders.length} đơn: ${testOrders.map((o) => o.code).join(", ") || "(không có)"}`,
    );
  }
  if (inScope("seed")) {
    seedOrders = await db.order.findMany({
      where: { code: { startsWith: SEED_ORDER_PREFIX } },
      select: { code: true },
      orderBy: { code: "asc" },
    });
    console.log(`[đơn seed] ${seedOrders.length} đơn bắt đầu "SEED".`);
  }

  // 2. Sản phẩm test (SKU bắt đầu TEST-).
  let testProducts: Array<{ id: number; sku: string | null }> = [];
  if (inScope("products")) {
    testProducts = await db.product.findMany({
      where: { sku: { startsWith: TEST_SKU_PREFIX } },
      select: { id: true, sku: true },
      orderBy: { id: "asc" },
    });
    console.log(
      `[sản phẩm test] ${testProducts.length} sản phẩm: ${testProducts.map((p) => `${p.id} (${p.sku})`).join(", ") || "(không có)"}`,
    );
  }

  // 3. Phiên admin (ở local chỉ có phiên test).
  let sessions = 0;
  if (inScope("sessions")) {
    sessions = await db.adminSession.count();
    console.log(`[phiên admin] ${sessions} phiên`);
  }

  // 4. Bài tin tức test (Ngày 18): slug bắt đầu "test-" — test tự
  // dọn sau mỗi lần chạy, đây là lưới an toàn khi test chết giữa
  // chừng. Dòng audit news:test-* đi kèm cũng được dọn.
  let testNews: Array<{ slug: string }> = [];
  if (inScope("news")) {
    testNews = await db.newsArticle.findMany({
      where: { slug: { startsWith: TEST_NEWS_SLUG_PREFIX } },
      select: { slug: true },
      orderBy: { slug: "asc" },
    });
    console.log(
      `[tin tức test] ${testNews.length} bài: ${testNews.map((n) => n.slug).join(", ") || "(không có)"}`,
    );
  }

  // 5. Sự kiện rate-limit (local): nhật ký test, dọn hết.
  let rateLimitEvents = 0;
  if (inScope("ratelimit")) {
    rateLimitEvents = await db.rateLimitEvent.count();
    console.log(`[rate-limit] ${rateLimitEvents} sự kiện`);
  }

  if (!shouldDelete) {
    console.log("[dry-run] Chưa xóa gì. Thêm --delete để xóa thật.");
    await db.$disconnect();
    return;
  }

  // Xóa đơn trước (dòng đơn xóa theo cascade).
  if (inScope("orders") && testOrders.length > 0) {
    const deleted = await db.order.deleteMany({
      where: { code: { in: TEST_ORDER_CODES } },
    });
    console.log(`[đã xóa] ${deleted.count} đơn test.`);
  }
  if (inScope("seed") && seedOrders.length > 0) {
    const deleted = await db.order.deleteMany({
      where: { code: { startsWith: SEED_ORDER_PREFIX } },
    });
    console.log(`[đã xóa] ${deleted.count} đơn seed.`);
  }
  // Sản phẩm TEST- còn đơn thì giữ lại, báo rõ.
  if (inScope("products")) {
    for (const p of testProducts) {
      const used = await db.orderItem.count({ where: { productId: p.id } });
      if (used > 0) {
        console.log(
          `[giữ lại] Sản phẩm ${p.id} (${p.sku}) còn ${used} dòng đơn — không xóa.`,
        );
        continue;
      }
      await db.product.delete({ where: { id: p.id } });
      console.log(`[đã xóa] Sản phẩm ${p.id} (${p.sku}).`);
    }
  }
  if (inScope("sessions") && sessions > 0) {
    const deleted = await db.adminSession.deleteMany({});
    console.log(`[đã xóa] ${deleted.count} phiên admin.`);
  }
  if (inScope("news") && testNews.length > 0) {
    const deleted = await db.newsArticle.deleteMany({
      where: { slug: { startsWith: TEST_NEWS_SLUG_PREFIX } },
    });
    const deletedAudit = await db.settingsAudit.deleteMany({
      where: { key: { startsWith: `news:${TEST_NEWS_SLUG_PREFIX}` } },
    });
    console.log(`[đã xóa] ${deleted.count} bài tin tức test + ${deletedAudit.count} dòng audit.`);
  }
  if (inScope("ratelimit") && rateLimitEvents > 0) {
    const deleted = await db.rateLimitEvent.deleteMany({});
    console.log(`[đã xóa] ${deleted.count} sự kiện rate-limit.`);
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[clean-test-data] Lỗi:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exitCode = 1;
});
