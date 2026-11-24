-- Quản lý đơn hàng (Ngày 8): thêm paidAt + ghi chú nội bộ cho đơn,
-- bảng nhật ký order_events. Không đổi enum OrderStatus (PREPARING
-- vẫn giữ — schema hiện có thắng đặc tả, xem "Khác đặc tả" báo cáo
-- Ngày 8); không động vào dữ liệu đơn cũ.
ALTER TABLE "orders" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "internalNote" TEXT;

CREATE TYPE "OrderEventType" AS ENUM ('STATUS_CHANGE', 'PAYMENT', 'NOTIFY');

CREATE TABLE "order_events" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
