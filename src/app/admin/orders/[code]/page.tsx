import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminOrder, nextOrderStatuses } from "@/lib/admin/orders";
import { transferContent } from "@/lib/bank";
import { formatVND } from "@/lib/format";
import OrderStatusBadge, { orderStatusLabel } from "@/components/order/OrderStatusBadge";
import OrderDetailActions from "@/components/admin/OrderDetailActions";
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
          className="inline-flex min-h-11 items-center text-sm font-bold text-green-800 hover:underline"
        >
          ← Danh sách đơn hàng
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Đơn {order.code}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-2 text-sm text-ink-soft">
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
        className="mt-6 rounded-[3px] border border-line bg-white p-5"
      >
        <h2 className="text-xl text-ink">Thao tác</h2>
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
          <Link
            href={`/admin/orders/${order.code}/print`}
            className="inline-flex min-h-11 items-center rounded-[3px] border border-line bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-green-800 hover:text-green-800"
          >
            In phiếu giao hàng
          </Link>
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section
          aria-label="Người đặt và người nhận"
          className="rounded-[3px] border border-line bg-white p-5"
        >
          <h2 className="text-xl text-ink">Người đặt và người nhận</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Người đặt</dt>
              <dd className="text-right font-bold text-ink">
                {order.senderName} (
                <a
                  href={`tel:${order.senderPhone}`}
                  className="inline-flex min-h-11 items-center text-green-800 hover:underline"
                >
                  {order.senderPhone}
                </a>
                )
              </dd>
            </div>
            {order.senderEmail ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Email người đặt</dt>
                <dd className="text-right font-bold text-ink">{order.senderEmail}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Người nhận</dt>
              <dd className="text-right font-bold text-ink">
                {order.receiverName} (
                <a
                  href={`tel:${order.receiverPhone}`}
                  className="inline-flex min-h-11 items-center text-green-800 hover:underline"
                >
                  {order.receiverPhone}
                </a>
                )
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Địa chỉ</dt>
              <dd className="text-right font-bold text-ink">{order.address}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Khu vực</dt>
              <dd className="text-right font-bold text-ink">{order.area}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Phí giao hàng</dt>
              <dd className="text-right font-bold text-ink">{formatVND(order.shippingFee)}</dd>
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
                <dt className="text-ink-soft">Ghi chú của khách</dt>
                <dd className="text-right font-bold text-ink">{order.note}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section
          aria-label="Sản phẩm và thanh toán"
          className="rounded-[3px] border border-line bg-white p-5"
        >
          <h2 className="text-xl text-ink">Sản phẩm và thanh toán</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
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
              <dt className="text-ink-soft">Phí giao hàng</dt>
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
              <dd className="font-bold text-ink">{formatVND(order.total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Nội dung chuyển khoản</dt>
              <dd className="font-bold text-ink">{transferContent(order.code)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-soft">Thông báo Telegram</dt>
              <dd className="text-right font-bold text-ink">
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
        className="mt-6 rounded-[3px] border border-line bg-white p-5"
      >
        <h2 className="text-xl text-ink">Dòng thời gian</h2>
        {order.events.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Chưa có thay đổi nào được ghi lại.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {order.events.map((e, i) => (
              <li key={i} className="border-l-2 border-green-800 pl-3">
                <p className="font-bold text-ink">{eventText(e)}</p>
                <p className="text-ink-soft">{formatVnDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
