// Theo dõi đơn mới không cần Telegram/email (Ngày 17 Phần N).
//
// N1: trình duyệt hỏi GET /api/admin/orders/new-count mỗi 60 giây
//   (tạm dừng khi tab ẩn) để lấy số đơn "cần xử lý" và mã đơn mới
//   nhất. Route chỉ trả đúng 2 trường này, yêu cầu phiên admin,
//   Cache-Control: no-store, giới hạn tốc độ (module rate-limit
//   dùng chung), không trả dữ liệu khách.
// N2: khi số đơn tăng so với lần trước → chuông + tiêu đề tab +
//   toast + (tùy chọn) âm báo / thông báo trình duyệt.
// N3: số đơn cần xử lý đã quá hạn giao (ngày giao trước hôm nay
//   theo giờ VN, chưa giao/chưa hủy).
//
// File này chứa logic THUẦN (để unit test) + truy vấn DB cho route
// và thẻ tổng quan. "Cần xử lý" = NEW + CONFIRMED + DELIVERING
// (khớp dashboard.ts và tab "pending" trong orders.ts —
// PREPARING là trạng thái dự trữ, không tính).

import { db } from "@/lib/db";
import { vnDayBounds } from "@/lib/admin/dashboard";

// Chu kỳ hỏi máy chủ (N1): 60 giây.
export const NEW_ORDER_POLL_INTERVAL_MS = 60_000;

// Giới hạn tốc độ cho route new-count (N1/S9): 30 lần/phút theo IP
// đã băm — đủ cho nhiều tab admin cùng mở (mỗi tab 1 lần/phút),
// chặn lạm dụng quét liên tục.
export const NEW_ORDER_COUNT_RATE_LIMIT = 30;
export const NEW_ORDER_COUNT_RATE_WINDOW_MS = 60_000;

// Tiêu đề tab khi có đơn mới chưa xem (N2): "(N) Hoa Tươi Demo — Quản trị".
export const NEW_ORDER_BASE_TITLE = "Hoa Tươi Demo — Quản trị";

export type NewOrderCount = {
  pendingCount: number;
  latestCode: string | null;
};

// Số đơn mới tăng thêm so với lần hỏi trước (không bao giờ âm:
// đơn được xử lý/hủy làm số giảm thì không phải "đơn mới").
export function newOrderDelta(previousCount: number, nextCount: number): number {
  if (!Number.isFinite(previousCount) || !Number.isFinite(nextCount)) return 0;
  return Math.max(0, Math.floor(nextCount) - Math.floor(previousCount));
}

// Có đơn mới không (để quyết định báo hiệu).
export function hasNewOrders(previousCount: number, nextCount: number): boolean {
  return newOrderDelta(previousCount, nextCount) > 0;
}

// Thông điệp toast khi có đơn mới (N2): "Có N đơn mới".
export function newOrderToastMessage(newCount: number): string {
  return `Có ${newCount} đơn mới`;
}

// Tiêu đề tab (N2): có đơn mới chưa xem thì "(N) Hoa Tươi Demo —
// Quản trị", không thì tiêu đề gốc.
export function newOrderTitle(newCount: number): string {
  return newCount > 0
    ? `(${newCount}) ${NEW_ORDER_BASE_TITLE}`
    : NEW_ORDER_BASE_TITLE;
}

// Kiểm tra hình dạng phản hồi của route new-count: chỉ chấp nhận
// đúng 2 trường, pendingCount là số nguyên ≥ 0, latestCode là
// chuỗi mã đơn hoặc null. Trả null khi hình dạng sai (trình duyệt
// bỏ qua lần hỏi đó, không báo hiệu sai).
export function parseNewOrderCountResponse(value: unknown): NewOrderCount | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const pendingCount = v.pendingCount;
  const latestCode = v.latestCode;
  if (
    typeof pendingCount !== "number" ||
    !Number.isInteger(pendingCount) ||
    pendingCount < 0
  ) {
    return null;
  }
  if (latestCode !== null && typeof latestCode !== "string") return null;
  if (typeof latestCode === "string" && latestCode === "") return null;
  return { pendingCount, latestCode };
}

// Số đơn cần xử lý + mã đơn mới nhất trong số đó (mới nhất theo
// createdAt, khóa phụ id — cùng thứ tự ổn định như listAdminOrders).
export async function getNewOrderCount(): Promise<NewOrderCount> {
  const [pendingCount, latest] = await Promise.all([
    db.order.count({
      where: { status: { in: ["NEW", "CONFIRMED", "DELIVERING"] } },
    }),
    db.order.findFirst({
      where: { status: { in: ["NEW", "CONFIRMED", "DELIVERING"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { code: true },
    }),
  ]);
  return { pendingCount, latestCode: latest?.code ?? null };
}

// Số đơn cần xử lý đã QUÁ HẠN giao (N3): ngày giao trước hôm nay
// theo giờ VN, trạng thái còn cần xử lý (chưa giao/chưa hủy).
// Mốc ngày lấy theo vnDayBounds (giờ VN, như dashboard).
export async function getOverduePendingCount(now: Date = new Date()): Promise<number> {
  const { day } = vnDayBounds(now);
  return db.order.count({
    where: {
      status: { in: ["NEW", "CONFIRMED", "DELIVERING"] },
      deliveryDate: { lt: new Date(`${day}T00:00:00Z`) },
    },
  });
}
