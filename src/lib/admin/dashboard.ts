// Số liệu tổng quan quản trị (Ngày 9 D9-8). Mọi số lấy trực tiếp từ
// DB (không cache, không đọc từ bộ nhớ): trang /admin là force-dynamic
// + header no-store (next.config.ts).
//
// - Đơn cần xử lý: NEW + CONFIRMED + DELIVERING.
// - Đơn giao hôm nay: ngày giao = hôm nay theo giờ VN, chưa hủy.
// - Chuyển khoản chưa thu: BANK_TRANSFER + UNPAID, chưa hủy.
// - Doanh thu: tổng tiền các đơn COMPLETED trong khoảng, theo ngày
//   hoàn tất (sự kiện STATUS_CHANGE → COMPLETED trong order_events),
//   không theo ngày đặt hay ngày thanh toán.

import { db } from "@/lib/db";
import { deliveryConfig } from "@/config/delivery";

export type AdminDashboardStats = {
  pendingCount: number;
  todayDeliveryCount: number;
  unpaidBankTransferCount: number;
  revenueToday: number;
  revenue7Days: number;
  todayVn: string; // YYYY-MM-DD theo giờ VN
};

// Ranh giới ngày theo giờ VN (00:00 VN = 17:00 UTC hôm trước).
function vnDayBounds(now: Date): { day: string; start: Date; end: Date } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: deliveryConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, -7, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { day, start, end };
}

export async function getAdminDashboardStats(
  now: Date = new Date(),
): Promise<AdminDashboardStats> {
  const { day, start, end } = vnDayBounds(now);
  const weekStart = new Date(start.getTime() - 6 * 24 * 60 * 60 * 1000);
  const [pendingCount, todayDeliveryCount, unpaidBankTransferCount, completedToday, completedWeek] =
    await Promise.all([
      db.order.count({
        where: { status: { in: ["NEW", "CONFIRMED", "DELIVERING"] } },
      }),
      db.order.count({
        where: {
          deliveryDate: new Date(`${day}T00:00:00Z`),
          status: { not: "CANCELLED" },
        },
      }),
      db.order.count({
        where: {
          paymentMethod: "BANK_TRANSFER",
          paymentStatus: "UNPAID",
          status: { not: "CANCELLED" },
        },
      }),
      db.orderEvent.findMany({
        where: {
          type: "STATUS_CHANGE",
          toStatus: "COMPLETED",
          createdAt: { gte: start, lt: end },
        },
        select: { order: { select: { total: true } } },
      }),
      db.orderEvent.findMany({
        where: {
          type: "STATUS_CHANGE",
          toStatus: "COMPLETED",
          createdAt: { gte: weekStart, lt: end },
        },
        select: { order: { select: { total: true } } },
      }),
    ]);
  const sum = (rows: Array<{ order: { total: number } }>): number =>
    rows.reduce((acc, r) => acc + r.order.total, 0);
  return {
    pendingCount,
    todayDeliveryCount,
    unpaidBankTransferCount,
    revenueToday: sum(completedToday),
    revenue7Days: sum(completedWeek),
    todayVn: day,
  };
}
