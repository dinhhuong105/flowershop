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
//   - phiên admin: mọi dòng admin_sessions (ở local chỉ có phiên test)
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

type Scope = "sessions" | "orders" | "products" | "seed";

function parseOnly(): Scope[] | null {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const parts = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is Scope => s === "sessions" || s === "orders" || s === "products" || s === "seed");
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
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[clean-test-data] Lỗi:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exitCode = 1;
});
