// Script dọn giỏ hết hạn (mục 8 đặc tả Ngày 4).
// Xóa các giỏ ACTIVE đã hết hạn VÀ chưa gắn đơn hàng nào (dòng giỏ bị
// xóa theo nhờ onDelete: Cascade), in số giỏ đã xóa. Giỏ còn hạn và giỏ
// đã gắn đơn (CONVERTED) không bị đụng tới.
// Chạy: npm run cleanup:carts   (Ngày 10 sẽ đặt lịch chạy)
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Nạp DATABASE_URL từ .env khi chạy ngoài Next (Prisma Client không tự
// đọc .env). Khi chạy trong container, biến môi trường đã có sẵn thì
// không đụng tới .env.
function loadEnv(): void {
  if (process.env.DATABASE_URL) return;
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
      return;
    }
  }
}

loadEnv();

const db = new PrismaClient();

async function main(): Promise<void> {
  const result = await db.cart.deleteMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date() },
      order: { is: null },
    },
  });
  console.log(`Đã xóa ${result.count} giỏ hết hạn.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
