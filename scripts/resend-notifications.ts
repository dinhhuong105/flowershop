// Gửi lại báo Telegram cho các đơn chưa được báo (mục 9 đặc tả Ngày 5).
// Gửi lại mọi đơn có notifiedAt = NULL khi TELEGRAM_* đã cấu hình; in
// số đơn đã gửi / gửi lỗi. Chạy: npm run resend:notifications
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Nạp biến môi trường từ .env khi chạy ngoài Next (Prisma Client và
// sendOrderNotification không tự đọc .env). Khi chạy trong container,
// biến môi trường đã có sẵn thì không đụng tới .env.
function loadEnv(): void {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const needed = ["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_API_BASE"];
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && needed.includes(m[1]) && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const db = new PrismaClient();

async function main(): Promise<void> {
  // Import sau loadEnv để TELEGRAM_* có giá trị khi module đọc env.
  // (Import động trong main vì top-level await không chạy được với
  // output CJS của tsx khi package.json không có "type": "module".)
  const { sendOrderNotification } = await import("../src/lib/telegram");
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.log("Chưa cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID — không gửi lại đơn nào.");
    return;
  }
  const pending = await db.order.findMany({
    where: { notifiedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true },
  });
  let sent = 0;
  let failed = 0;
  for (const order of pending) {
    const ok = await sendOrderNotification(order.id);
    if (ok) {
      sent++;
      console.log(`Đã gửi lại báo đơn ${order.code}.`);
    } else {
      failed++;
      console.log(`Gửi lại báo đơn ${order.code} lỗi.`);
    }
  }
  console.log(`Xong: đã gửi ${sent}, lỗi ${failed}, tổng ${pending.length} đơn chưa báo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
