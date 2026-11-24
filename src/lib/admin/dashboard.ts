// Số liệu tổng quan quản trị (Ngày 9 D9-8). Mọi số lấy trực tiếp từ
// DB (không cache, không đọc từ bộ nhớ): trang /admin là force-dynamic
// + header no-store (next.config.ts).
//
// - Đơn cần xử lý: NEW + CONFIRMED + DELIVERING. PREPARING KHÔNG
//   tính ở đây (sửa 12 mục verdict Ngày 9, mục 6): PREPARING là trạng
//   thái dự trữ trong enum, hiện không dùng trong luồng (không có bước
//   chuyển nào vào/ra, không có tab riêng) nên đơn ở trạng thái này
//   chỉ thấy trong tab "Tất cả". Muốn dùng thì phải thêm vào pending
//   ở cả src/lib/admin/orders.ts lẫn ở đây, đồng thời thêm tab.
// - Đơn giao hôm nay: ngày giao = hôm nay theo giờ VN, chưa hủy.
// - Chuyển khoản chưa thu: BANK_TRANSFER + UNPAID, chưa hủy.
// - Doanh thu: tổng tiền các đơn COMPLETED trong khoảng, theo ngày
//   hoàn tất (sự kiện STATUS_CHANGE → COMPLETED trong order_events),
//   không theo ngày đặt hay ngày thanh toán. Mỗi đơn chỉ tính MỘT
//   lần dù có nhiều sự kiện hoàn tất (gom theo orderId — sửa 12 mục
//   verdict Ngày 9, mục 10; trước đây cộng theo từng sự kiện nên đơn
//   hoàn tất lại sẽ bị tính 2 lần).

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
// Số -7 là độ lệch UTC+7 của Asia/Ho_Chi_Minh (deliveryConfig.
// timezone) — Việt Nam không có giờ mùa hè nên -7 là hằng số đúng
// quanh năm (sửa 12 mục verdict Ngày 9, mục 11: chỉ ghi chú, không
// đổi hành vi). Nếu đổi timezone trong deliveryConfig thì phải đổi
// số này theo, không thì ranh giới ngày sẽ lệch.
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
        select: { orderId: true, order: { select: { total: true } } },
      }),
      db.orderEvent.findMany({
        where: {
          type: "STATUS_CHANGE",
          toStatus: "COMPLETED",
          createdAt: { gte: weekStart, lt: end },
        },
        select: { orderId: true, order: { select: { total: true } } },
      }),
    ]);
  // Cộng doanh thu theo ĐƠN (distinct theo orderId), không cộng theo
  // sự kiện (sửa 12 mục verdict Ngày 9, mục 10): một đơn hoàn tất,
  // đảo trạng thái rồi hoàn tất lại sẽ có 2 sự kiện COMPLETED — cộng
  // theo sự kiện sẽ tính trùng 2 lần.
  const sumDistinct = (
    rows: Array<{ orderId: number; order: { total: number } }>,
  ): number => {
    const byOrder = new Map<number, number>();
    for (const r of rows) {
      if (!byOrder.has(r.orderId)) byOrder.set(r.orderId, r.order.total);
    }
    return [...byOrder.values()].reduce((acc, total) => acc + total, 0);
  };
  return {
    pendingCount,
    todayDeliveryCount,
    unpaidBankTransferCount,
    revenueToday: sumDistinct(completedToday),
    revenue7Days: sumDistinct(completedWeek),
    todayVn: day,
  };
}
