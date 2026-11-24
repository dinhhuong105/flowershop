// Tạo lại dữ liệu test của Ngày 7 sau khi VM bị thay mới
// (PostgreSQL + /var/lib bị xóa cùng máy ảo).
//   npx tsx scripts/recreate-test-data.ts
// Chỉ chạy khi DB ở localhost (kiểm tra host của DATABASE_URL) và
// NODE_ENV khác production. Tạo lại đúng giá trị báo cáo Ngày 7:
//   - SP 21 "Bó Hoa Đồng Tiền Thử Nghiệm" (SKU TEST-001, giá 450.000,
//     KM 340.000, thứ tự 99)
//   - QAFNN907ZY: chuyển khoản, 3 × SP 21 @360.000, tổng 1.105.000
//   - 0Z2DZBQNTJ: COD, kịch bản S Ngày 5 (2×801.000 + 1×750.000),
//     tổng 2.377.000, đã gửi Telegram
//   - 1N0PEZH0J7: COD, cùng kịch bản S, tổng 2.377.000, chưa gửi
// Cả 3 giao 24/11/2026 khung "08:00 – 10:00", khu "Khu vực trung
// tâm", trạng thái ban đầu NEW/UNPAID. Chạy lại sẽ bỏ qua dữ liệu
// đã có (không tạo trùng).

import { db } from "../src/lib/db";

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

async function main(): Promise<void> {
  process.loadEnvFile(".env");
  if (process.env.NODE_ENV === "production") {
    console.error("[recreate-test-data] Từ chối chạy khi NODE_ENV=production.");
    process.exitCode = 1;
    return;
  }
  if (!dbHostIsLocalhost()) {
    console.error("[recreate-test-data] Từ chối chạy: DATABASE_URL không phải localhost.");
    process.exitCode = 1;
    return;
  }
  const category = await db.category.findUnique({ where: { slug: "hoa-tuoi" } });
  if (!category) {
    console.error("[recreate-test-data] Không thấy danh mục hoa-tuoi — chạy seed gốc trước.");
    process.exitCode = 1;
    return;
  }
  let product21 = await db.product.findUnique({ where: { sku: "TEST-001" } });
  if (!product21) {
    product21 = await db.product.create({
      data: {
        categoryId: category.id,
        name: "Bó Hoa Đồng Tiền Thử Nghiệm",
        slug: "bo-hoa-dong-tien-thu-nghiem",
        description: "Sản phẩm test (Ngày 7).",
        price: 450000,
        salePrice: 340000,
        images: [],
        tags: [],
        isFastDelivery: false,
        isActive: true,
        sku: "TEST-001",
        inStock: true,
        sortOrder: 99,
      },
    });
    console.log("[recreate-test-data] Đã tạo SP 21 (TEST-001).");
  } else {
    console.log("[recreate-test-data] SP 21 đã có, bỏ qua.");
  }
  const p1 = await db.product.findFirst({ where: { id: 1 } });
  const p2 = await db.product.findFirst({ where: { id: 2 } });
  if (!p1 || !p2) {
    console.error("[recreate-test-data] Không thấy sản phẩm id 1/2 — chạy seed gốc trước.");
    process.exitCode = 1;
    return;
  }
  const orders = [
    {
      code: "QAFNN907ZY",
      paymentMethod: "BANK_TRANSFER" as const,
      notifiedAt: null as Date | null,
      items: [{ productId: product21.id, name: product21.name, price: 360000, quantity: 3 }],
      subtotal: 1080000,
    },
    {
      code: "0Z2DZBQNTJ",
      paymentMethod: "COD" as const,
      notifiedAt: new Date("2026-11-24T10:00:00+07:00"),
      items: [
        { productId: p1.id, name: p1.name, price: 801000, quantity: 2 },
        { productId: p2.id, name: p2.name, price: 750000, quantity: 1 },
      ],
      subtotal: 2352000,
    },
    {
      code: "1N0PEZH0J7",
      paymentMethod: "COD" as const,
      notifiedAt: null as Date | null,
      items: [
        { productId: p1.id, name: p1.name, price: 801000, quantity: 2 },
        { productId: p2.id, name: p2.name, price: 750000, quantity: 1 },
      ],
      subtotal: 2352000,
    },
  ];
  for (const o of orders) {
    const exists = await db.order.findUnique({ where: { code: o.code }, select: { id: true } });
    if (exists) {
      console.log(`[recreate-test-data] Đơn ${o.code} đã có, bỏ qua.`);
      continue;
    }
    await db.order.create({
      data: {
        code: o.code,
        senderName: "Người Đặt Test",
        senderPhone: "0900000000",
        senderEmail: null,
        receiverName: "Người Nhận Test",
        receiverPhone: "0900000001",
        address: "1 đường Test",
        area: "Khu vực trung tâm",
        deliveryDate: new Date("2026-11-24T00:00:00Z"),
        deliverySlot: "08:00 – 10:00",
        deliveryMethod: "SCHEDULED",
        deliverySurcharge: 0,
        subtotal: o.subtotal,
        shippingFee: 25000,
        total: o.subtotal + 25000,
        paymentMethod: o.paymentMethod,
        paymentStatus: "UNPAID",
        status: "NEW",
        notifiedAt: o.notifiedAt,
        items: { create: o.items },
      },
    });
    console.log(`[recreate-test-data] Đã tạo đơn ${o.code} (${o.subtotal + 25000} ₫).`);
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[recreate-test-data] Lỗi:", error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exitCode = 1;
});
