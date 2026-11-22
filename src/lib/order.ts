// Tạo đơn hàng trong MỘT giao dịch DB (mục 6.3 đặc tả Ngày 5).
// Mọi số tiền tính lại từ dữ liệu máy chủ, không nhận số tiền nào từ
// trình duyệt. Gửi Telegram KHÔNG ở đây mà ở Server Action, sau khi
// giao dịch đã commit (mục 9).

import { randomInt } from "node:crypto";
import type { DeliveryMethod, PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { deliveryConfig } from "@/config/delivery";
import { getDisplayPrice } from "@/lib/pricing";

export class EmptyCartError extends Error {
  constructor() {
    super("Giỏ hàng trống.");
  }
}

export class DuplicateOrderError extends Error {
  readonly code: string | null;
  constructor(code: string | null) {
    super("Đơn này đã được đặt.");
    this.code = code;
  }
}

export class UnavailableProductsError extends Error {
  readonly names: string[];
  constructor(names: string[]) {
    super(`Có sản phẩm không còn bán: ${names.join(", ")}.`);
    this.names = names;
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Bạn đã đặt quá nhiều đơn trong thời gian ngắn, vui lòng thử lại sau.");
  }
}

export type CreateOrderInput = {
  cartId: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string | null;
  receiverName: string;
  receiverPhone: string;
  address: string;
  zoneId: number;
  deliveryMethod: DeliveryMethod;
  deliveryDate: string; // YYYY-MM-DD
  deliverySlot: string;
  cardMessage: string | null;
  note: string | null;
  paymentMethod: PaymentMethod;
};

export type CreatedOrder = { code: string; id: number; total: number };

// Mã đơn 10 ký tự Crockford base32 (không dùng I, L, O, U để tránh
// nhầm khi đọc), sinh bằng crypto.randomInt — KHÔNG dùng Math.random.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateOrderCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += CROCKFORD[randomInt(CROCKFORD.length)];
  }
  return code;
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  // Chống lạm dụng: tối đa perPhone đơn cho một số điện thoại (người
  // đặt HOẶC người nhận) trong windowMinutes (mục 6.1/6.3, D5-17).
  // Kiểm tra trước giao dịch; điều kiện UPDATE bên trong giao dịch
  // vẫn chặn đặt trùng dù hai yêu cầu chạy song song.
  const windowStart = new Date(
    Date.now() - deliveryConfig.orderRateLimit.windowMinutes * 60 * 1000,
  );
  const recent = await db.order.count({
    where: {
      OR: [{ senderPhone: input.senderPhone }, { receiverPhone: input.receiverPhone }],
      createdAt: { gte: windowStart },
    },
  });
  if (recent >= deliveryConfig.orderRateLimit.perPhone) {
    throw new RateLimitError();
  }

  return db.$transaction(async (tx) => {
    // (2) Chuyển giỏ ACTIVE → CONVERTED có điều kiện: 0 dòng cập nhật
    // nghĩa là một yêu cầu khác đã đặt trước → trùng đơn, không tạo
    // đơn thứ hai (D5-14).
    const converted = await tx.$executeRaw`
      UPDATE "carts" SET status = 'CONVERTED', "updatedAt" = NOW()
      WHERE id = ${input.cartId} AND status = 'ACTIVE'`;
    if (converted === 0) {
      const existing = await tx.order.findFirst({
        where: { cartId: input.cartId },
        select: { code: true },
        orderBy: { createdAt: "desc" },
      });
      throw new DuplicateOrderError(existing?.code ?? null);
    }

    // (3) Đọc dòng giỏ + sản phẩm hiện tại; món nào ngừng bán hoặc
    // hết hàng thì hủy cả giao dịch, giỏ giữ nguyên ACTIVE (D5-15).
    const lines = await tx.cartItem.findMany({
      where: { cartId: input.cartId },
      include: { product: true },
      orderBy: { id: "asc" },
    });
    if (lines.length === 0) throw new EmptyCartError();
    const unavailable = lines
      .filter((line) => !line.product.isActive || !line.product.inStock)
      .map((line) => line.product.name);
    if (unavailable.length > 0) throw new UnavailableProductsError(unavailable);

    // (4) Tính lại toàn bộ số tiền từ dữ liệu máy chủ: giá khóa (giá
    // sale nếu có) × số lượng; phí ship là phí khu vực tại thời điểm
    // đặt; phụ phí lấy từ cấu hình phương thức giao.
    const subtotal = lines.reduce(
      (sum, line) => sum + getDisplayPrice(line.product).current * line.quantity,
      0,
    );
    const zone = await tx.shippingZone.findUnique({ where: { id: input.zoneId } });
    if (!zone || !zone.isActive) {
      throw new Error("Khu vực giao hàng không khả dụng.");
    }
    const method = deliveryConfig.methods.find((m) => m.id === input.deliveryMethod);
    const deliverySurcharge = method?.surcharge ?? 0;
    const shippingFee = zone.fee;
    const total = subtotal + shippingFee + deliverySurcharge;

    // (6) Mã đơn: sinh trong giao dịch, kiểm tra trùng trong DB,
    // sinh lại khi trùng (tối đa 10 lần).
    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateOrderCode();
      const clash = await tx.order.findUnique({ where: { code }, select: { id: true } });
      if (!clash) break;
      if (attempt === 9) throw new Error("Không tạo được mã đơn, vui lòng thử lại.");
    }

    // (5) Tạo đơn + dòng đơn (bản chụp: tên, giá đã chốt, số lượng,
    // ảnh đầu tiên tại thời điểm đặt). deliveryDate lưu dạng Date
    // (cột @db.Date).
    const order = await tx.order.create({
      data: {
        code,
        cartId: input.cartId,
        senderName: input.senderName,
        senderPhone: input.senderPhone,
        senderEmail: input.senderEmail,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        address: input.address,
        area: zone.name,
        deliveryMethod: input.deliveryMethod,
        deliveryDate: new Date(`${input.deliveryDate}T00:00:00Z`),
        deliverySlot: input.deliverySlot,
        cardMessage: input.cardMessage,
        note: input.note,
        subtotal,
        shippingFee,
        deliverySurcharge,
        total,
        paymentMethod: input.paymentMethod,
        paymentStatus: "UNPAID",
        status: "NEW",
        items: {
          create: lines.map((line) => ({
            productId: line.productId,
            name: line.product.name,
            price: getDisplayPrice(line.product).current,
            quantity: line.quantity,
            image: line.product.images[0] ?? null,
          })),
        },
      },
    });
    return { code: order.code, id: order.id, total: order.total };
  });
}
