// Chi tiết đơn hàng (mục 7 đặc tả Ngày 5): các dòng sản phẩm, tạm
// tính, phí giao hàng, phụ phí (khi > 0), tổng cộng, thông tin người
// nhận và thời gian giao. Mọi giá trị lấy từ bản chụp của đơn — không
// bao giờ lấy giá sản phẩm hiện tại.

import type { Prisma } from "@prisma/client";
import { formatVND } from "@/lib/format";

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function OrderDetails({ order }: { order: OrderWithItems }) {
  return (
    <section
      aria-label="Chi tiết đơn hàng"
      className="rounded-[3px] border border-line bg-white p-5"
    >
      <h2 className="text-xl text-ink">Chi tiết đơn hàng</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="text-ink-soft">
              {item.name} × {item.quantity}
            </span>
            <span className="font-bold text-ink">{formatVND(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Tạm tính</dt>
          <dd className="font-bold text-ink">{formatVND(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Phí giao hàng ({order.area})</dt>
          <dd className="font-bold text-ink">{formatVND(order.shippingFee)}</dd>
        </div>
        {order.deliverySurcharge > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Phụ phí giao hàng</dt>
            <dd className="font-bold text-ink">{formatVND(order.deliverySurcharge)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
          <dt className="font-bold text-ink">Tổng cộng</dt>
          <dd data-testid="order-total" className="font-bold text-ink">
            {formatVND(order.total)}
          </dd>
        </div>
      </dl>
      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Người nhận</dt>
          <dd className="text-right font-bold text-ink">
            {order.receiverName} ({order.receiverPhone})
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Địa chỉ</dt>
          <dd className="text-right font-bold text-ink">{order.address}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Thời gian giao</dt>
          <dd className="text-right font-bold text-ink">
            {formatVnDate(order.deliveryDate)} — {order.deliverySlot}
          </dd>
        </div>
        {order.cardMessage ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Lời nhắn trên thiệp</dt>
            <dd className="text-right font-bold text-ink">{order.cardMessage}</dd>
          </div>
        ) : null}
        {order.note ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Ghi chú</dt>
            <dd className="text-right font-bold text-ink">{order.note}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
