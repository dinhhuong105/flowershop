import Link from "next/link";
import { formatVND } from "@/lib/format";

// Tóm tắt đơn hàng trang giỏ (mục 7 đặc tả Ngày 4): "Tạm tính ({count}
// sản phẩm)", dòng "Phí giao hàng: tính ở bước thanh toán" (không hiển
// thị số phí), tổng tạm tính. Nút "Tiến hành thanh toán" ở Ngày 4 là
// nút VÔ HIỆU HÓA kèm chú thích (Ngày 5 bật lên). Liên kết "Tiếp tục
// mua sắm" về trang chủ.
export default function CartSummary({
  count,
  subtotal,
}: {
  count: number;
  subtotal: number;
}) {
  return (
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="h-fit rounded-[3px] border border-line bg-cream-50 p-5 lg:sticky lg:top-24"
    >
      <h2 className="text-xl text-ink">Tóm tắt đơn hàng</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Tạm tính ({count} sản phẩm)</dt>
          <dd data-testid="cart-subtotal" className="font-bold text-ink">
            {formatVND(subtotal)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-soft">Phí giao hàng</dt>
          <dd className="text-ink-soft">Tính ở bước thanh toán</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
          <dt className="font-bold text-ink">Tổng tạm tính</dt>
          <dd className="font-bold text-ink">{formatVND(subtotal)}</dd>
        </div>
      </dl>
      <Link
        href="/checkout"
        className="mt-5 flex min-h-11 w-full items-center justify-center rounded-[3px] bg-gold-300 px-3 text-sm font-bold uppercase tracking-wide text-green-900"
      >
        Tiến hành thanh toán
      </Link>
      <p className="mt-4 text-center">
        <Link
          href="/"
          className="font-semibold text-green-800 transition-colors duration-150 hover:underline"
        >
          Tiếp tục mua sắm →
        </Link>
      </p>
    </aside>
  );
}
