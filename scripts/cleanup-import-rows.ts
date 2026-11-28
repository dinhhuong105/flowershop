// Dọn dữ liệu tạm của lô nhập (B2, bản sau Retry): đặt
// `import_rows.payload` thành NULL cho các lô đã tạo hơn 7 ngày.
//
// Lý do giữ 7 ngày thay vì xóa ngay khi nhập xong: trang lịch sử /
// chi tiết lô cần dữ liệu từng hàng để hiện kết quả; đặc tả cho
// phép "xóa sau 7 ngày hoặc khi nhập xong". Sau 7 ngày, hàng đã
// chạy xong không còn cần payload (trạng thái + message + productId
// vẫn còn trên hàng).
//
// Chạy tay (không gắn cron — DB nhỏ, chạy khi cần):
//   npx tsx scripts/cleanup-import-rows.ts [--dry-run]
//
// --dry-run chỉ in số hàng sẽ dọn, không ghi DB.
process.loadEnvFile(".env");

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const DAYS = 7;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const before = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const batches = await db.importBatch.findMany({
    where: { createdAt: { lt: before } },
    select: { id: true },
  });
  if (batches.length === 0) {
    console.log("Không có lô nhập nào quá 7 ngày.");
    return;
  }
  const ids = batches.map((b) => b.id);
  const rows = await db.importRow.count({
    where: { batchId: { in: ids }, payload: { not: Prisma.DbNull } },
  });
  console.log(
    `Lô quá 7 ngày: ${batches.length} lô, ${rows} hàng còn payload.`,
  );
  if (dryRun) {
    console.log("--dry-run: không ghi DB.");
    return;
  }
  const { count } = await db.importRow.updateMany({
    where: { batchId: { in: ids }, payload: { not: Prisma.DbNull } },
    data: { payload: Prisma.DbNull },
  });
  console.log(`Đã dọn payload của ${count} hàng.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
