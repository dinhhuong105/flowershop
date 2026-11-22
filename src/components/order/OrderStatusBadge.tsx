// Nhãn trạng thái đơn hàng bằng tiếng Việt (mục 7 đặc tả Ngày 5;
// D5-19: đơn mới là "Đã tiếp nhận", không phải "Chờ xác nhận").

import type { OrderStatus } from "@prisma/client";

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Đã tiếp nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  DELIVERING: "Đang giao",
  COMPLETED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status];
}

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
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
