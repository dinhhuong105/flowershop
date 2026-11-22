// Kiểm thử giới hạn chống lạm dụng (D5-17 đặc tả Ngày 5): đặt 6 đơn
// liên tiếp bằng cùng một số điện thoại trong 1 giờ — 5 đơn đầu thành
// công, đơn thứ 6 bị từ chối (RateLimitError). Dọn sạch đơn + giỏ thử
// nghiệm trước và sau khi chạy để DB không bị bẩn.
// Chạy: npx tsx scripts/test-order-limit.ts
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const TEST_PHONE = "0909999888";
const TEST_PRODUCT_ID = 1;

async function cleanup(): Promise<void> {
  await db.order.deleteMany({ where: { senderPhone: TEST_PHONE } });
}

async function makeCart(): Promise<string> {
  const cart = await db.cart.create({
    data: {
      token: `test-limit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  await db.cartItem.create({
    data: { cartId: cart.id, productId: TEST_PRODUCT_ID, quantity: 1 },
  });
  return cart.id;
}

async function main(): Promise<void> {
  // Import động trong main vì top-level await không chạy được với
  // output CJS của tsx khi package.json không có "type": "module".
  const { createOrder, RateLimitError } = await import("../src/lib/order");
  await cleanup();
  const results: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const cartId = await makeCart();
    try {
      const order = await createOrder({
        cartId,
        senderName: "Người Thử Giới Hạn",
        senderPhone: TEST_PHONE,
        senderEmail: null,
        receiverName: "Người Thử Giới Hạn",
        receiverPhone: "0908888777",
        address: "123 Đường Thử Nghiệm, Quận 1",
        zoneId: 2,
        deliveryMethod: "SCHEDULED",
        deliveryDate: "2026-11-23",
        deliverySlot: "10:00 – 12:00",
        cardMessage: null,
        note: null,
        paymentMethod: "COD",
      });
      results.push(`Đơn ${i}: THÀNH CÔNG (${order.code})`);
    } catch (error) {
      if (error instanceof RateLimitError) {
        results.push(`Đơn ${i}: BỊ TỪ CHỐI (giới hạn 5 đơn/giờ)`);
      } else {
        results.push(`Đơn ${i}: LỖI KHÁC: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  for (const line of results) console.log(line);
  const ok = results.slice(0, 5).every((r) => r.includes("THÀNH CÔNG")) && results[5].includes("BỊ TỪ CHỐI");
  await cleanup();
  // Xóa cả các giỏ thử nghiệm (đơn đã xóa nên giỏ không còn gắn đơn).
  await db.cart.deleteMany({ where: { token: { startsWith: "test-limit-" } } });
  console.log(ok ? "KẾT QUẢ: ĐẠT — 5 đơn đầu thành công, đơn thứ 6 bị từ chối." : "KẾT QUẢ: KHÔNG ĐẠT.");
  if (!ok) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
