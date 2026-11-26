// Dọn dữ liệu test khỏi DB PRODUCTION (Ngày 11 A2) — chạy tay,
// KHÔNG chạy trong build. Mặc định dry-run (chỉ liệt kê).
//   npx tsx scripts/clean-production.ts --orders=CODE1,CODE2 --skus=SKU1
//   npx tsx scripts/clean-production.ts --orders=... --confirm --i-know-this-is-production --snapshot=<vị trí snapshot>
// Chỉ xóa khi có --confirm; một transaction; in số dòng đã xóa từng
// bảng. Chỉ xóa đơn khớp tiêu chí (tên người đặt bắt đầu "[TEST]"
// hoặc mã trong --orders) và sản phẩm có SKU trong --skus. Từ chối
// nếu >20 đơn khớp hoặc có đơn COMPLETED+PAID (trừ --allow-paid).
// Production (DATABASE_URL không phải localhost) yêu cầu thêm
// --i-know-this-is-production. Xóa thật (--confirm) yêu cầu thêm
// --snapshot=<vị trí/tên snapshot> (A0): không snapshot thì không
// xóa — snapshot phải chụp TRƯỚC bằng pg_dump hoặc snapshot của nhà
// cung cấp, máy này không có quyền pg_dump production.
// Sản phẩm còn dòng đơn thì GIỮ LẠI và báo rõ (giống
// clean-test-data.ts) — xóa sản phẩm sẽ gỡ liên kết productId của
// dòng đơn; đơn đã xóa trước đó nên dòng đơn của đơn test đã đi
// theo (cascade). Không bao giờ bỏ ràng buộc khóa ngoại.

import { db } from "../src/lib/db";
import { selectProductionCleanup } from "../src/lib/admin/clean-production";
import { isProductionDatabaseUrl } from "../src/lib/seed-guard";

function parseList(flag: string): string[] {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!arg) return [];
  return arg
    .slice(flag.length + 1)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

async function main(): Promise<void> {
  process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("[clean-production] Từ chối chạy: thiếu DATABASE_URL.");
    process.exitCode = 1;
    return;
  }
  const isProd = isProductionDatabaseUrl(url);
  const shouldDelete = process.argv.includes("--confirm");
  const allowPaid = process.argv.includes("--allow-paid");
  const confirmProd = process.argv.includes("--i-know-this-is-production");
  const snapshot = parseList("--snapshot")[0] ?? "";
  if (isProd && !confirmProd) {
    console.error(
      "[clean-production] Từ chối chạy: DATABASE_URL trỏ production — chạy lại với --i-know-this-is-production.",
    );
    process.exitCode = 1;
    return;
  }
  if (shouldDelete && !snapshot) {
    console.error(
      "[clean-production] Từ chối xóa thật: chưa ghi snapshot (A0) — chụp snapshot production trước, rồi chạy lại với --snapshot=<vị trí/tên snapshot>.",
    );
    process.exitCode = 1;
    return;
  }

  const orderCodes = parseList("--orders");
  const productSkus = parseList("--skus");
  const orders = await db.order.findMany({
    select: { code: true, senderName: true, status: true, paymentStatus: true },
    orderBy: { code: "asc" },
  });
  const products = await db.product.findMany({
    select: { id: true, sku: true },
    orderBy: { id: "asc" },
  });
  const selection = selectProductionCleanup(
    { orders, products },
    { orderCodes, productSkus, allowPaid },
  );
  console.log(
    `[đơn] ${selection.orders.length} đơn sẽ xóa: ${selection.orders.map((o) => o.code).join(", ") || "(không có)"}`,
  );
  console.log(
    `[sản phẩm] ${selection.products.length} sản phẩm sẽ xóa: ${selection.products.map((p) => `${p.id} (${p.sku})`).join(", ") || "(không có)"}`,
  );
  if (selection.refused.length > 0) {
    for (const reason of selection.refused) {
      console.error(`[từ chối] ${reason}`);
    }
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }
  if (!shouldDelete) {
    console.log("[dry-run] Chưa xóa gì. Thêm --confirm để xóa thật.");
    await db.$disconnect();
    return;
  }

  console.log(`[snapshot] ${snapshot}`);
  // Một transaction: xóa đơn trước (dòng đơn đi theo cascade),
  // rồi xét sản phẩm — sản phẩm còn dòng đơn thì giữ lại, báo rõ.
  const result = await db.$transaction(async (tx) => {
    const deletedOrders = await tx.order.deleteMany({
      where: { code: { in: selection.orders.map((o) => o.code) } },
    });
    let deletedProducts = 0;
    const kept: Array<{ id: number; sku: string | null; used: number }> = [];
    for (const p of selection.products) {
      const used = await tx.orderItem.count({ where: { productId: p.id } });
      if (used > 0) {
        kept.push({ id: p.id, sku: p.sku, used });
        continue;
      }
      await tx.product.delete({ where: { id: p.id } });
      deletedProducts += 1;
    }
    return { deletedOrders: deletedOrders.count, deletedProducts, kept };
  });
  console.log(`[đã xóa] ${result.deletedOrders} đơn, ${result.deletedProducts} sản phẩm.`);
  for (const k of result.kept) {
    console.log(
      `[giữ lại] Sản phẩm ${k.id} (${k.sku}) còn ${k.used} dòng đơn — không xóa.`,
    );
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[clean-production] Lỗi:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exitCode = 1;
});
