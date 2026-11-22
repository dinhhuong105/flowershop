// Báo đơn qua Telegram (mục 9 đặc tả Ngày 5). Gọi sendMessage sau
// khi giao dịch tạo đơn đã commit. Thiếu TELEGRAM_BOT_TOKEN hoặc
// TELEGRAM_CHAT_ID → bỏ qua im lặng (chỉ log một dòng), đơn vẫn tạo
// bình thường. Lỗi/chậm (timeout 5 giây) không được làm hỏng hay làm
// chậm việc đặt hàng quá ~6 giây. KHÔNG BAO GIỜ log token.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deliveryConfig } from "@/config/delivery";
import { formatVND } from "@/lib/format";

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function deliveryMethodLabel(method: string): string {
  return deliveryConfig.methods.find((m) => m.id === method)?.label ?? method;
}

function paymentMethodLabel(method: string): string {
  return method === "BANK_TRANSFER" ? "Chuyển khoản" : "Thanh toán khi nhận hàng (COD)";
}

function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: deliveryConfig.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatVnTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: deliveryConfig.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function buildTelegramMessage(order: OrderWithItems): string {
  const lines = order.items
    .map(
      (item) =>
        `- ${escapeHtml(item.name)} × ${item.quantity} — ${formatVND(item.price * item.quantity)}`,
    )
    .join("\n");
  const parts = [
    `<b>Đơn hàng mới ${escapeHtml(order.code)}</b>`,
    `${formatVnTime(order.createdAt)} ngày ${formatVnDate(order.createdAt)}`,
    "",
    lines,
    `Tạm tính: ${formatVND(order.subtotal)}`,
    `Phí giao hàng: ${formatVND(order.shippingFee)}`,
  ];
  if (order.deliverySurcharge > 0) {
    parts.push(`Phụ phí giao hàng: ${formatVND(order.deliverySurcharge)}`);
  }
  parts.push(
    `<b>Tổng cộng: ${formatVND(order.total)}</b>`,
    "",
    `Người đặt: ${escapeHtml(order.senderName)} (${escapeHtml(order.senderPhone)})`,
    `Người nhận: ${escapeHtml(order.receiverName)} (${escapeHtml(order.receiverPhone)})`,
    `Địa chỉ: ${escapeHtml(order.address)} — ${escapeHtml(order.area)}`,
    `Giao hàng: ${escapeHtml(deliveryMethodLabel(order.deliveryMethod))} — ${formatVnDate(order.deliveryDate)}, ${escapeHtml(order.deliverySlot)}`,
    `Thanh toán: ${escapeHtml(paymentMethodLabel(order.paymentMethod))}`,
  );
  if (order.cardMessage) {
    parts.push(`Lời nhắn trên thiệp: ${escapeHtml(order.cardMessage)}`);
  }
  if (order.note) {
    parts.push(`Ghi chú: ${escapeHtml(order.note)}`);
  }
  return parts.join("\n");
}

// Gửi báo đơn cho một đơn đã tạo. Trả true khi Telegram nhận (đã set
// notifiedAt), false khi bỏ qua (thiếu cấu hình) hoặc gửi lỗi. Không
// bao giờ throw — lỗi nào cũng chỉ log tên lỗi, không log token hay URL.
export async function sendOrderNotification(orderId: number): Promise<boolean> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chatId) {
    console.log("[telegram] Chưa cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID, bỏ qua báo đơn.");
    return false;
  }
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) return false;
  const base = (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramMessage(order),
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[telegram] sendMessage lỗi HTTP ${res.status} cho đơn ${order.code}.`);
      return false;
    }
    await db.order.update({
      where: { id: orderId },
      data: { notifiedAt: new Date() },
    });
    return true;
  } catch (error) {
    // Chỉ log tên lỗi — message/URL có thể chứa token.
    console.error(`[telegram] Gửi báo đơn ${order.code} lỗi: ${error instanceof Error ? error.name : "unknown"}.`);
    return false;
  }
}
