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
