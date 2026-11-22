// Tóm tắt đơn hàng bên phải trang thanh toán (mục 5 đặc tả Ngày 5):
// các dòng (chỉ đọc), tạm tính, phí giao hàng ("Chọn khu vực để xem
// phí" khi chưa chọn khu vực), phụ phí (khi > 0), tổng cộng cập nhật
// ngay khi đổi khu vực/phương thức giao.

import type { CartData } from "@/lib/cart";
import { deliveryConfig } from "@/config/delivery";
import { formatVND } from "@/lib/format";
import type { ZoneOption } from "./CheckoutForm";

export default function OrderSummary({
  cart,
  zones,
  zoneId,
  methodId,
}: {
  cart: CartData;
  zones: ZoneOption[];
  zoneId: string;
  methodId: string;
}) {
  const zone = zones.find((z) => String(z.id) === zoneId);
  const method = deliveryConfig.methods.find((m) => m.id === methodId);
  const shippingFee = zone?.fee ?? null;
  const surcharge = method?.surcharge ?? 0;
  const total = cart.subtotal + (shippingFee ?? 0) + surcharge;
  return (
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="h-fit rounded-[3px] border border-line bg-cream-50 p-5 lg:sticky lg:top-24"
    >
      <h2 className="text-xl text-ink">Tóm tắt đơn hàng</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {cart.items
          .filter((item) => !item.unavailable)
          .map((item) => (
            <li key={item.itemId} className="flex justify-between gap-3">
              <span className="text-ink-soft">
                {item.name} × {item.quantity}
              </span>
              <span className="font-bold text-ink">{formatVND(item.lineTotal)}</span>
            </li>
          ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Tạm tính</dt>
          <dd data-testid="checkout-subtotal" className="font-bold text-ink">
            {formatVND(cart.subtotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Phí giao hàng{zone ? ` (${zone.name})` : ""}</dt>
          <dd data-testid="checkout-shipping" className="font-bold text-ink">
            {shippingFee === null ? "Chọn khu vực để xem phí" : formatVND(shippingFee)}
          </dd>
        </div>
        {surcharge > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Phụ phí giao hàng</dt>
            <dd data-testid="checkout-surcharge" className="font-bold text-ink">
              {formatVND(surcharge)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
          <dt className="font-bold text-ink">Tổng cộng</dt>
          <dd data-testid="checkout-total" className="font-bold text-ink">
            {formatVND(total)}
          </dd>
        </div>
      </dl>
    </aside>
  );
}
