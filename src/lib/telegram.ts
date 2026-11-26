// Báo đơn qua Telegram (mục 9 đặc tả Ngày 5). Gọi sendMessage sau
// khi giao dịch tạo đơn đã commit. Thiếu TELEGRAM_BOT_TOKEN hoặc
// TELEGRAM_CHAT_ID → bỏ qua im lặng (chỉ log một dòng), đơn vẫn tạo
// bình thường. Lỗi/chậm (timeout 5 giây) không được làm hỏng hay làm
// chậm việc đặt hàng quá ~6 giây. KHÔNG BAO GIỜ log token.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deliveryConfig } from "@/config/delivery";
import { formatVND } from "@/lib/format";
import { readSettingsFromDb } from "./settings";
import { formatVnDateTime } from "./vn-datetime";

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

// Giới hạn độ dài thông báo Telegram (H-4c, đặc tả Ngày 5 mục 9):
// cắt ở 4000 ký tự (dưới giới hạn 4096 của Telegram).
export const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

// KHÁC ĐẶC TẢ (H-4b, Claude chấp nhận): code dùng parse_mode "HTML"
// trong khi đặc tả nói văn bản thuần. Chấp nhận vì mọi dữ liệu khách
// nhập đều đi qua escapeHtml — test dưới đây kiểm chứng tên/địa chỉ/
// lời nhắn chứa <b>, &, </a> đều được thoát đúng.

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
  const itemLines = order.items.map(
    (item) =>
      `- ${escapeHtml(item.name)} × ${item.quantity} — ${formatVND(item.price * item.quantity)}`,
  );
  const head = [
    `<b>Đơn hàng mới ${escapeHtml(order.code)}</b>`,
    `${formatVnTime(order.createdAt)} ngày ${formatVnDate(order.createdAt)}`,
    "",
  ];
  const tail = [
    `Tạm tính: ${formatVND(order.subtotal)}`,
    `Phí giao hàng: ${formatVND(order.shippingFee)}`,
  ];
  if (order.deliverySurcharge > 0) {
    tail.push(`Phụ phí giao hàng: ${formatVND(order.deliverySurcharge)}`);
  }
  tail.push(
    `<b>Tổng cộng: ${formatVND(order.total)}</b>`,
    "",
    `Người đặt: ${escapeHtml(order.senderName)} (${escapeHtml(order.senderPhone)})`,
    `Người nhận: ${escapeHtml(order.receiverName)} (${escapeHtml(order.receiverPhone)})`,
    `Địa chỉ: ${escapeHtml(order.address)} — ${escapeHtml(order.area)}`,
    `Giao hàng: ${escapeHtml(deliveryMethodLabel(order.deliveryMethod))} — ${formatVnDate(order.deliveryDate)}, ${escapeHtml(order.deliverySlot)}`,
    `Thanh toán: ${escapeHtml(paymentMethodLabel(order.paymentMethod))}`,
  );
  if (order.cardMessage) {
    tail.push(`Lời nhắn trên thiệp: ${escapeHtml(order.cardMessage)}`);
  }
  if (order.note) {
    tail.push(`Ghi chú: ${escapeHtml(order.note)}`);
  }
  // Cắt ở 4000 ký tự (H-4c): rút gọn danh sách dòng, luôn giữ phần
  // tổng và thông tin giao. Bỏ dần dòng cuối, ghi số món còn lại.
  const joinAll = (lines: string[], dropped: number): string => {
    const middle =
      dropped > 0 ? [...lines, `… và còn ${dropped} món khác`] : lines;
    return [...head, ...middle, ...tail].join("\n");
  };
  let lines = itemLines;
  let message = joinAll(lines, 0);
  if (message.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
    while (lines.length > 0) {
      lines = lines.slice(0, -1);
      message = joinAll(lines, itemLines.length - lines.length);
      if (message.length <= MAX_TELEGRAM_MESSAGE_LENGTH) break;
    }
    if (message.length > MAX_TELEGRAM_MESSAGE_LENGTH) {
      message = message.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH);
    }
  }
  return message;
}

// Gửi báo đơn cho một đơn đã tạo. Trả true khi Telegram nhận (đã set
// notifiedAt), false khi bỏ qua (thiếu cấu hình) hoặc gửi lỗi. Không
// bao giờ throw — lỗi nào cũng chỉ log tên lỗi, không log token hay URL.
export async function sendOrderNotification(orderId: number): Promise<boolean> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) return false;
  const sent = await sendTelegramForOrder(order);
  if (!sent) return false;
  await db.order.update({
    where: { id: orderId },
    data: { notifiedAt: new Date() },
  });
  return true;
}

// Gửi THUẦN tin nhắn Telegram cho một đơn (không ghi DB). Dùng cho
// gửi lại từ quản trị (Ngày 8): phía gọi tự cập nhật notifiedAt có
// điều kiện (notifiedAt IS NULL) để không gửi trùng khi bấm đúp.
// Trả false khi chưa cấu hình hoặc Telegram lỗi; không bao giờ throw.
export async function sendTelegramForOrder(order: OrderWithItems): Promise<boolean> {
  const result = await sendTelegramMessage(buildTelegramMessage(order));
  return result.ok;
}

// ---- Cấu hình Telegram từ Ngày 12 (D1/D3) ----
// Token bot CHỈ ở biến môi trường (Henry đặt trên Vercel), không bao
// giờ lưu vào DB, không hiện ra giao diện/log. Chat id lưu trong
// cài đặt (nhóm telegram); chưa có thì fallback về env
// TELEGRAM_CHAT_ID (để không mất thông báo khi chuyển).
export function getTelegramToken(): string {
  return (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
}

export async function getTelegramChatId(): Promise<string> {
  try {
    const settings = await readSettingsFromDb();
    if (settings.telegramChatId && settings.telegramChatId.trim() !== "") {
      return settings.telegramChatId.trim();
    }
  } catch {
    // DB lỗi thì rơi về env (thông báo đơn vẫn có cơ hội gửi).
  }
  return (process.env.TELEGRAM_CHAT_ID ?? "").trim();
}

export async function isTelegramConfigured(): Promise<boolean> {
  return getTelegramToken() !== "" && (await getTelegramChatId()) !== "";
}

// Gửi một tin nhắn văn bản thuần qua Telegram (D2 gửi thử, B3 báo
// đổi ngân hàng). Trả { ok, error? } — error đã làm sạch (chỉ mã
// HTTP hoặc tên lỗi), KHÔNG BAO GIỜ chứa token hay URL. Không throw.
export async function sendTelegramMessage(
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = getTelegramToken();
  const chatId = await getTelegramChatId();
  if (!token || !chatId) {
    return { ok: false, error: "Chưa cấu hình token bot hoặc chat id Telegram." };
  }
  const base = (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      // Đọc mô tả lỗi của Telegram (không chứa token) để hiện cho
      // admin; lỗi đọc body thì chỉ báo mã HTTP.
      let detail = `HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { description?: unknown };
        if (typeof data.description === "string" && data.description !== "") {
          detail = data.description;
        }
      } catch {
        // Giữ mã HTTP.
      }
      console.error(`[telegram] sendMessage lỗi ${detail}.`);
      return { ok: false, error: `Telegram trả lỗi: ${detail}` };
    }
    return { ok: true };
  } catch (error) {
    // Chỉ log tên lỗi — message/URL có thể chứa token.
    console.error(
      `[telegram] Gửi tin lỗi: ${error instanceof Error ? error.name : "unknown"}.`,
    );
    return { ok: false, error: "Không gửi được tin Telegram, vui lòng thử lại." };
  }
}

// Báo chủ shop khi nhóm bank đổi (B3): chỉ báo giờ đổi, KHÔNG kèm
// số tài khoản hay số đầy đủ nào.
export async function sendBankChangeNotification(): Promise<{ ok: boolean; error?: string }> {
  return sendTelegramMessage(
    `Thông tin ngân hàng vừa được thay đổi lúc ${formatVnDateTime(new Date())}.`,
  );
}
