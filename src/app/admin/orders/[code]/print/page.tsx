import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import { formatVND } from "@/lib/format";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phiếu giao hàng",
  robots: { index: false, follow: false },
};

// Phiếu giao hàng (Ngày 8 §2.2): HTML + CSS @media print, khổ A5
// dọc, không JS thư viện. "Thu hộ": COD chưa thanh toán = tổng tiền;
// đã thanh toán = 0 ₫; chuyển khoản = 0 ₫ (khách trả bằng chuyển
// khoản, không thu tiền mặt — quyết định của Henry, xem "Khác đặc
// tả" báo cáo Ngày 8). Nav quản trị và nút "In" ẩn khi in.

function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function AdminOrderPrintPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireAdmin();
  const { code } = await params;
  const order = await getAdminOrder(code);
  if (!order) notFound();
  // "Thu hộ": COD chưa thanh toán = tổng tiền; đã thanh toán = 0 ₫;
  // chuyển khoản = 0 ₫. Đơn đã hủy → 0 ₫ (Ngày 9 D9-4: trước sửa,
  // đơn hủy COD chưa trả vẫn hiện "Thu hộ" bằng tổng tiền).
  const cod =
    order.status === "CANCELLED"
      ? 0
      : order.paymentMethod === "COD" && order.paymentStatus === "UNPAID"
        ? order.total
        : 0;

  return (
    <div>
      <style>{`
        @page { size: A5 portrait; margin: 12mm; }
        @media print {
          header, .no-print { display: none !important; }
          body { background: #fff !important; }
          main { padding: 0 !important; }
        }
      `}</style>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PrintButton />
        <p className="no-print text-sm text-ink-soft">
          Phiếu in khổ A5 dọc — bấm “In” rồi chọn máy in hoặc lưu thành PDF.
        </p>
      </div>

      <section
        aria-label="Phiếu giao hàng"
        className="mx-auto max-w-[148mm] rounded-[3px] border border-line bg-white p-6 text-ink"
      >
        {order.status === "CANCELLED" ? (
          <p
            role="alert"
            data-testid="print-cancelled-banner"
            className="mb-4 rounded-[3px] border border-danger bg-danger px-4 py-3 text-center text-base font-bold text-white"
          >
            ĐƠN ĐÃ HỦY — KHÔNG GIAO
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-semibold">Phiếu giao hàng</h1>
        <p className="mt-1 text-sm">
          Mã đơn: <strong data-testid="print-order-code">{order.code}</strong>
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Người nhận</dt>
            <dd className="text-right font-bold">{order.receiverName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Số điện thoại</dt>
            <dd className="text-right font-bold">{order.receiverPhone}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Địa chỉ</dt>
            <dd className="text-right font-bold">{order.address}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Khu vực</dt>
            <dd className="text-right font-bold">{order.area}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Thời gian giao</dt>
            <dd className="text-right font-bold">
              {formatVnDate(order.deliveryDate)} — {order.deliverySlot}
            </dd>
          </div>
          {order.cardMessage ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Lời nhắn trên thiệp</dt>
              <dd className="text-right font-bold">{order.cardMessage}</dd>
            </div>
          ) : null}
        </dl>

        <h2 className="mt-5 text-base font-bold">Sản phẩm</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span className="font-bold">{formatVND(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Tạm tính</dt>
            <dd className="font-bold">{formatVND(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-soft">Phí giao hàng</dt>
            <dd className="font-bold">{formatVND(order.shippingFee)}</dd>
          </div>
          {order.deliverySurcharge > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Phụ phí giao hàng</dt>
              <dd className="font-bold">{formatVND(order.deliverySurcharge)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
            <dt className="font-bold">Tổng cộng</dt>
            <dd className="font-bold">{formatVND(order.total)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-line pt-3 text-base">
            <dt className="font-bold">Thu hộ</dt>
            <dd data-testid="print-cod" className="font-bold">
              {formatVND(cod)}
            </dd>
          </div>
        </dl>
        <p className="mt-5 text-sm text-ink-soft">
          {order.paymentMethod === "COD"
            ? "Thanh toán khi nhận hàng (COD)."
            : "Chuyển khoản ngân hàng."}
        </p>
      </section>
    </div>
  );
}
