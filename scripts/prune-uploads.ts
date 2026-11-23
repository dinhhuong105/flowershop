// Dọn ảnh mồ côi trong UPLOAD_DIR (Ngày 7 §4): file không được sản
// phẩm nào dùng và cũ hơn 24 giờ.
//   npx tsx scripts/prune-uploads.ts           # chỉ liệt kê
//   npx tsx scripts/prune-uploads.ts --delete  # xóa thật
// Mặc định KHÔNG xóa gì (an toàn). File vừa tải lên nhưng chưa lưu
// vào sản phẩm (chưa bấm "Lưu") được giữ lại trong 24 giờ.

import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { getUploadDir, listUploadFiles } from "../src/lib/admin/uploads";

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  // Nạp .env khi chạy ngoài Next (Prisma Client không tự đọc .env).
  process.loadEnvFile(".env");
  const shouldDelete = process.argv.includes("--delete");
  const dir = getUploadDir();
  const files = await listUploadFiles();
  const products = await db.product.findMany({ select: { images: true } });
  const used = new Set(
    products.flatMap((p) => p.images.map((u) => path.basename(u))),
  );
  const now = Date.now();
  const orphans: string[] = [];
  for (const file of files) {
    if (used.has(file)) continue;
    const info = await stat(path.join(dir, file)).catch(() => null);
    if (!info) continue;
    if (now - info.mtimeMs < ORPHAN_AGE_MS) continue;
    orphans.push(file);
  }
  if (orphans.length === 0) {
    console.log("Không có file mồ côi cũ hơn 24 giờ.");
    return;
  }
  for (const file of orphans) {
    if (shouldDelete) {
      await unlink(path.join(dir, file));
      console.log(`Đã xóa: ${file}`);
    } else {
      console.log(`Mồ côi: ${file}`);
    }
  }
  if (!shouldDelete) {
    console.log(
      `\n${orphans.length} file mồ côi (chưa xóa). Chạy với --delete để xóa.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
