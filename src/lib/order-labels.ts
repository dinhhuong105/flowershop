// Nhãn trạng thái đơn hàng bằng tiếng Việt — MỘT nguồn duy nhất
// (Ngày 9 D9-5: thống nhất giữa tab quản trị, huy hiệu và trang công
// khai). Quyết định:
// - NEW = "Đã tiếp nhận" (D5-19: đơn mới là "Đã tiếp nhận", không phải
//   "Chờ xác nhận"; tab Ngày 8 ghi "Mới" đã đổi theo).
// - COMPLETED = "Đã giao" (huy hiệu Ngày 5; tab Ngày 8 ghi "Hoàn tất"
//   đã đổi theo).
// Module thuần (không import DB) nên cả component lẫn lib đều dùng được.

import type { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: "Đã tiếp nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  DELIVERING: "Đang giao",
  COMPLETED: "Đã giao",
  CANCELLED: "Đã hủy",
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status];
}
