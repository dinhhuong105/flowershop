// Nhãn trạng thái đơn hàng bằng tiếng Việt (mục 7 đặc tả Ngày 5;
// D5-19: đơn mới là "Đã tiếp nhận", không phải "Chờ xác nhận").
// Nhãn lấy từ src/lib/order-labels.ts — một nguồn duy nhất cho cả
// tab quản trị, huy hiệu và trang công khai (Ngày 9 D9-5).

import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUS_LABEL } from "@/lib/order-labels";

const STATUS_LABEL: Record<OrderStatus, string> = ORDER_STATUS_LABEL;

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

// Huy hiệu trạng thái kiểu ảnh mẫu (mềm, nền pastel, không viền):
// xanh dương / tím / hổ phách / xanh lá / xám. Chỉ dùng trong
// admin (variant="admin"); mặc định "shop" giữ màu xanh lá của
// shop cho trang công khai /order/[code].
const ADMIN_TONE: Record<OrderStatus, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONFIRMED: "bg-violet-100 text-violet-700",
  PREPARING: "bg-slate-100 text-slate-600",
  DELIVERING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function OrderStatusBadge({
  status,
  variant = "shop",
}: {
  status: OrderStatus;
  variant?: "shop" | "admin";
}) {
  if (variant === "admin") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${ADMIN_TONE[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
    );
  }
  const tone =
    status === "CANCELLED"
      ? "border-danger text-danger"
      : status === "COMPLETED"
        ? "border-green-800 bg-green-800 text-white"
        : "border-green-800 text-green-800";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${tone}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
