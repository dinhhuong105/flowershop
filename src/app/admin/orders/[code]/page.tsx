import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrder, nextOrderStatuses } from "@/lib/admin/orders";
import { transferContent } from "@/lib/bank";
import { formatVND } from "@/lib/format";
import OrderStatusBadge, { orderStatusLabel } from "@/components/order/OrderStatusBadge";
import OrderDetailActions from "@/components/admin/OrderDetailActions";
import AdminIconButton, { PrinterIcon } from "@/components/admin/AdminIconButton";
import OrderNoteForm from "@/components/admin/OrderNoteForm";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chi tiết đơn hàng",
  robots: { index: false, follow: false },
};

// Chi tiết đơn hàng quản trị (Ngày 8 §2.2): người đặt, người nhận,
// địa chỉ, khu vực, phí ship, ngày/khung giờ giao, lời nhắn/thiệp,
// danh sách sản phẩm với GIÁ ĐÃ CHỐT, tạm tính/ship/tổng, phương thức
// thanh toán, nội dung chuyển khoản, trạng thái báo Telegram, ghi chú
// nội bộ, dòng thời gian. Chỉ hiện nút của bước hợp lệ tiếp theo.

function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatVnDateTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "Xác nhận đơn",
  DELIVERING: "Bắt đầu giao",
  COMPLETED: "Hoàn tất giao",
  CANCELLED: "Hủy đơn",
};

function eventText(e: {
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  note: string | null;
}): string {
  if (e.type === "STATUS_CHANGE") {
    const from = e.fromStatus ? orderStatusLabel(e.fromStatus) : "?";
    const to = e.toStatus ? orderStatusLabel(e.toStatus) : "?";
    return `Đổi trạng thái: ${from} → ${to}${e.note ? ` — ${e.note}` : ""}`;
  }
  if (e.type === "PAYMENT") {
    return e.note ?? "Đánh dấu đã thanh toán.";
  }
  if (e.type === "NOTIFY") {
    return "Gửi lại thông báo Telegram.";
  }
  return e.type;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireAdmin();
  const { code } = await params;
  const order = await getAdminOrder(code);
  if (!order) notFound();
  const telegramConfigured =
    (process.env.TELEGRAM_BOT_TOKEN ?? "").trim() !== "" &&
    (process.env.TELEGRAM_CHAT_ID ?? "").trim() !== "";
  const nextSteps = nextOrderStatuses(order.status).map((to) => ({
    to,
    label: NEXT_ACTION_LABEL[to] ?? orderStatusLabel(to),
  }));

  return (
    <div>
      <p>
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center text-sm font-bold text-blue-600 hover:underline"
        >
          ← Danh sách đơn hàng
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">
          Đơn {order.code}
        </h1>
        <OrderStatusBadge status={order.status} variant="admin" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Đặt lúc {formatVnDateTime(order.createdAt)}
        {" · "}
        {order.paymentMethod === "COD" ? "Thanh toán khi nhận hàng (COD)" : "Chuyển khoản"}
        {" · "}
        {order.paymentStatus === "PAID"
          ? `Đã thanh toán${order.paidAt ? ` lúc ${formatVnDateTime(order.paidAt)}` : ""}`
          : "Chưa thanh toán"}
      </p>

      <section
        aria-label="Thao tác"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-xl font-bold text-slate-900">Thao tác</h2>
        <div className="mt-3">
          <OrderDetailActions
            code={order.code}
            status={order.status}
            paymentStatus={order.paymentStatus}
            notifiedAt={order.notifiedAt}
            telegramConfigured={telegramConfigured}
            nextSteps={nextSteps}
          />
        </div>
        <p className="mt-4">
          <AdminIconButton
            href={`/admin/orders/${order.code}/print`}
            label="In phiếu giao hàng"
            icon={PrinterIcon}
            className="border border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:text-blue-600"
          />
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section
          aria-label="Người đặt và người nhận"
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-xl font-bold text-slate-900">Người đặt và người nhận</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Người đặt</dt>
              <dd className="text-right font-bold text-slate-900">
                {order.senderName} (
                <a
                  href={`tel:${order.senderPhone}`}
                  className="inline-flex min-h-11 items-center text-blue-600 hover:underline"
                >
                  {order.senderPhone}
                </a>
                )
              </dd>
            </div>
            {order.senderEmail ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Email người đặt</dt>
                <dd className="text-right font-bold text-slate-900">{order.senderEmail}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Người nhận</dt>
              <dd className="text-right font-bold text-slate-900">
                {order.receiverName} (
                <a
                  href={`tel:${order.receiverPhone}`}
                  className="inline-flex min-h-11 items-center text-blue-600 hover:underline"
                >
                  {order.receiverPhone}
                </a>
                )
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Địa chỉ</dt>
              <dd className="text-right font-bold text-slate-900">{order.address}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Khu vực</dt>
              <dd className="text-right font-bold text-slate-900">{order.area}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Phí giao hàng</dt>
              <dd className="text-right font-bold text-slate-900">{formatVND(order.shippingFee)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Thời gian giao</dt>
              <dd className="text-right font-bold text-slate-900">
                {formatVnDate(order.deliveryDate)} — {order.deliverySlot}
              </dd>
            </div>
            {order.cardMessage ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Lời nhắn trên thiệp</dt>
                <dd className="text-right font-bold text-slate-900">{order.cardMessage}</dd>
              </div>
            ) : null}
            {order.note ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Ghi chú của khách</dt>
                <dd className="text-right font-bold text-slate-900">{order.note}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section
          aria-label="Sản phẩm và thanh toán"
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-xl font-bold text-slate-900">Sản phẩm và thanh toán</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {item.name} × {item.quantity}
                </span>
                <span className="font-bold text-slate-900">{formatVND(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Tạm tính</dt>
              <dd className="font-bold text-slate-900">{formatVND(order.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Phí giao hàng</dt>
              <dd className="font-bold text-slate-900">{formatVND(order.shippingFee)}</dd>
            </div>
            {order.deliverySurcharge > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Phụ phí giao hàng</dt>
                <dd className="font-bold text-slate-900">{formatVND(order.deliverySurcharge)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-base">
              <dt className="font-bold text-slate-900">Tổng cộng</dt>
              <dd className="font-bold text-slate-900">{formatVND(order.total)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Nội dung chuyển khoản</dt>
              <dd className="font-bold text-slate-900">{transferContent(order.code)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Thông báo Telegram</dt>
              <dd className="text-right font-bold text-slate-900">
                {order.notifiedAt
                  ? `Đã gửi lúc ${formatVnDateTime(order.notifiedAt)}`
                  : "Chưa gửi"}
              </dd>
            </div>
          </dl>
          <OrderNoteForm code={order.code} initialNote={order.internalNote} />
        </section>
      </div>

      <section
        aria-label="Dòng thời gian"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-xl font-bold text-slate-900">Dòng thời gian</h2>
        {order.events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có thay đổi nào được ghi lại.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {order.events.map((e, i) => (
              <li key={i} className="border-l-2 border-blue-600 pl-3">
                <p className="font-bold text-slate-900">{eventText(e)}</p>
                <p className="text-slate-500">{formatVnDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
