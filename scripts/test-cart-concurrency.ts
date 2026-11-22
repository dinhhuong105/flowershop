// Kiểm tra tính nguyên tử của addItem (D4-26 đặc tả Ngày 4).
// Tạo một giỏ thử, chạy 10 lệnh addItem(cartId, productId, 1) ĐỒNG THỜI,
// rồi thêm 30 lệnh nữa. Kỳ vọng: vẫn 1 hàng cart_items, quantity = 10
// sau lần 1 và = 20 sau lần 2 (kẹp ở MAX_QTY), không lỗi vi phạm unique.
// Xóa giỏ thử sau khi xong. In PASS/FAIL và thoát mã 0/1.
// Chạy: npx tsx scripts/test-cart-concurrency.ts
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addItem } from "../src/lib/cart";

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

async function main(): Promise<boolean> {
  const productId = 1; // Bó Hồng Đỏ Tình Yêu
  const cart = await db.cart.create({
    data: {
      token: `test-concurrency-${randomBytes(8).toString("hex")}`,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 60_000),
    },
    select: { id: true },
  });
  try {
    await Promise.all(
      Array.from({ length: 10 }, () => addItem(cart.id, productId, 1)),
    );
    const afterFirst = await db.cartItem.findMany({ where: { cartId: cart.id } });
    console.log(
      `Sau 10 lệnh song song: ${afterFirst.length} hàng, quantity = ${afterFirst[0]?.quantity ?? "?"}`,
    );
    await Promise.all(
      Array.from({ length: 30 }, () => addItem(cart.id, productId, 1)),
    );
    const afterSecond = await db.cartItem.findMany({ where: { cartId: cart.id } });
    console.log(
      `Sau thêm 30 lệnh song song: ${afterSecond.length} hàng, quantity = ${afterSecond[0]?.quantity ?? "?"}`,
    );
    const pass =
      afterFirst.length === 1 &&
      afterFirst[0]?.quantity === 10 &&
      afterSecond.length === 1 &&
      afterSecond[0]?.quantity === 20;
    console.log(pass ? "PASS" : "FAIL");
    return pass;
  } finally {
    await db.cart.delete({ where: { id: cart.id } });
  }
}

main()
  .then((pass) => {
    process.exit(pass ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
