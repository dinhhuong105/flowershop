// Tạo 45 đơn test để diễn phân trang (Ngày 9 D9-3).
//   npx tsx scripts/seed-test-orders.ts
// Chỉ chạy khi DB ở localhost (kiểm tra host của DATABASE_URL) và
// NODE_ENV khác production — không bao giờ seed vào DB thật.
// Dấu hiệu nhận diện: mã SEED000001..SEED000045 + người đặt
// "Seed Phân Trang" (tìm q=Seed ra đúng 45 đơn → 3 trang 20/20/5).
// Phân bố: 20 NEW, 10 CONFIRMED, 5 DELIVERING, 5 COMPLETED,
// 5 CANCELLED (trong đó 1 chuyển khoản + PAID để kiểm lời nhắn hoàn
// tiền ở trang công khai, 1 COD chưa trả để kiểm phiếu giao đơn hủy).
// Đơn COMPLETED có sự kiện STATUS_CHANGE → COMPLETED (để kiểm doanh
// thu ở dashboard). Chạy lại sẽ bỏ qua mã đã có (không tạo trùng).
// Xóa bằng: npx tsx scripts/clean-test-data.ts --delete

import { db } from "../src/lib/db";
import { deliveryConfig } from "../src/config/delivery";

export const SEED_ORDER_PREFIX = "SEED";
export const SEED_SENDER_NAME = "Seed Phân Trang";
const SEED_COUNT = 45;

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

function seedCode(i: number): string {
  return `SEED${String(i).padStart(6, "0")}`;
}

const SLOT_LABELS = [
  ...deliveryConfig.slots.map((s) => s.label),
  "Trong 2 giờ kể từ khi shop xác nhận",
  "Trước 18:00",
];

function statusFor(i: number): "NEW" | "CONFIRMED" | "DELIVERING" | "COMPLETED" | "CANCELLED" {
  if (i <= 20) return "NEW";
  if (i <= 30) return "CONFIRMED";
  if (i <= 35) return "DELIVERING";
  if (i <= 40) return "COMPLETED";
  return "CANCELLED";
}

async function main(): Promise<void> {
  process.loadEnvFile(".env");
  if (process.env.NODE_ENV === "production") {
    console.error("[seed-test-orders] Từ chối chạy khi NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }
  if (!dbHostIsLocalhost()) {
    console.error(
      "[seed-test-orders] Từ chối chạy: DATABASE_URL không phải localhost.",
    );
    process.exitCode = 1;
    return;
  }
  const product = await db.product.findFirst({
    where: { id: 1 },
    select: { id: true, name: true, salePrice: true, price: true },
  });
  if (!product) {
    console.error("[seed-test-orders] Không thấy sản phẩm id 1 — chạy seed gốc trước.");
    process.exitCode = 1;
    return;
  }
  const unitPrice = product.salePrice ?? product.price;
  const today = new Date();
  const vnDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: deliveryConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
  const base = new Date(`${vnDay}T00:00:00Z`);

  let created = 0;
  let skipped = 0;
  for (let i = 1; i <= SEED_COUNT; i++) {
    const code = seedCode(i);
    const exists = await db.order.findUnique({ where: { code }, select: { id: true } });
    if (exists) {
      skipped++;
      continue;
    }
    const status = statusFor(i);
    // Đơn 44: COD chưa trả + đã hủy (kiểm phiếu giao). Đơn 45:
    // chuyển khoản + PAID + đã hủy (kiểm lời nhắn hoàn tiền).
    const paymentMethod = i === 45 ? "BANK_TRANSFER" : i % 3 === 0 ? "BANK_TRANSFER" : "COD";
    // Đơn 44 giữ COD + UNPAID để kiểm phiếu giao đơn hủy (trước sửa,
    // "Thu hộ" của đơn này hiện bằng tổng tiền).
    const paymentStatus =
      i === 44
        ? "UNPAID"
        : status === "COMPLETED" || i === 45
          ? "PAID"
          : i % 2 === 0
            ? "PAID"
            : "UNPAID";
    const deliveryDate = new Date(base.getTime() + ((i - 1) % 5) * 24 * 60 * 60 * 1000);
    const deliverySlot = SLOT_LABELS[(i - 1) % SLOT_LABELS.length];
    const now = new Date();
    await db.order.create({
      data: {
        code,
        senderName: SEED_SENDER_NAME,
        senderPhone: "0900000001",
        senderEmail: null,
        receiverName: `Người Nhận ${String(i).padStart(2, "0")}`,
        receiverPhone: "0900000002",
        address: `${i} đường Seed, phường Kiểm Thử`,
        area: "Khu vực trung tâm",
        deliveryDate,
        deliverySlot,
        deliveryMethod: "SCHEDULED",
        deliverySurcharge: 0,
        subtotal: unitPrice,
        shippingFee: 25000,
        total: unitPrice + 25000,
        paymentMethod,
        paymentStatus,
        paidAt: paymentStatus === "PAID" ? now : null,
        status,
        items: {
          create: [
            {
              productId: product.id,
              name: product.name,
              price: unitPrice,
              quantity: 1,
              image: null,
            },
          ],
        },
        events: {
          create:
            status === "COMPLETED"
              ? [
                  {
                    type: "STATUS_CHANGE",
                    fromStatus: "DELIVERING",
                    toStatus: "COMPLETED",
                    note: null,
                    createdAt: now,
                  },
                ]
              : status === "CANCELLED"
                ? [
                    {
                      type: "STATUS_CHANGE",
                      fromStatus: "NEW",
                      toStatus: "CANCELLED",
                      note: "Seed test phân trang (Ngày 9).",
                      createdAt: now,
                    },
                  ]
                : [],
        },
      },
    });
    created++;
  }
  const total = await db.order.count({ where: { code: { startsWith: SEED_ORDER_PREFIX } } });
  console.log(
    `[seed-test-orders] Tạo ${created} đơn mới, bỏ qua ${skipped} mã đã có. Tổng đơn seed: ${total}/45.`,
  );
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[seed-test-orders] Lỗi:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exitCode = 1;
});
