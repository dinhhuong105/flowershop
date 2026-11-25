import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ORDER_TABS,
  listAdminOrders,
  orderDayBadge,
  type OrderTab,
} from "@/lib/admin/orders";
import { formatVND } from "@/lib/format";
import { orderStatusLabel } from "@/lib/order-labels";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đơn hàng",
  robots: { index: false, follow: false },
};

// Danh sách đơn hàng quản trị (Ngày 8 §2.2): tab trạng thái có số đếm,
// lọc theo thanh toán/ngày giao, tìm theo mã/tên/SĐT (không dấu,
// +84 ↔ 0), 20/trang. "Cần xử lý" sắp xếp theo ngày giao rồi khung
// giờ; các tab còn lại theo mới nhất. Từ 768 px là bảng, dưới 768 px
// là thẻ.

function formatVnDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function paymentMethodLabel(method: string): string {
  return method === "BANK_TRANSFER" ? "Chuyển khoản" : "COD";
}

type BaseParams = {
  tab: string;
  q: string;
  payment: string;
  method: string;
  exclude: string;
  date: string;
};

function tabHref(base: BaseParams, tab: OrderTab): string {
  const parts: string[] = [`tab=${tab}`];
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.payment !== "all") parts.push(`payment=${encodeURIComponent(base.payment)}`);
  if (base.method !== "all") parts.push(`method=${encodeURIComponent(base.method)}`);
  if (base.exclude !== "") parts.push(`exclude=${encodeURIComponent(base.exclude)}`);
  if (base.date !== "") parts.push(`date=${encodeURIComponent(base.date)}`);
  return `/admin/orders?${parts.join("&")}`;
}

function pageHref(base: BaseParams, page: number): string {
  const parts: string[] = [];
  if (base.tab !== "pending") parts.push(`tab=${encodeURIComponent(base.tab)}`);
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.payment !== "all") parts.push(`payment=${encodeURIComponent(base.payment)}`);
  if (base.method !== "all") parts.push(`method=${encodeURIComponent(base.method)}`);
  if (base.exclude !== "") parts.push(`exclude=${encodeURIComponent(base.exclude)}`);
  if (base.date !== "") parts.push(`date=${encodeURIComponent(base.date)}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `/admin/orders?${parts.join("&")}` : "/admin/orders";
}

// Link bỏ bộ lọc loại trạng thái (mục 3 verdict Ngày 10): giống
// pageHref nhưng KHÔNG giữ exclude — giữ nguyên tab, tìm kiếm,
// thanh toán, phương thức, ngày giao và trang hiện tại.
function clearExcludeHref(base: BaseParams, page: number): string {
  const parts: string[] = [];
  if (base.tab !== "pending") parts.push(`tab=${encodeURIComponent(base.tab)}`);
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.payment !== "all") parts.push(`payment=${encodeURIComponent(base.payment)}`);
  if (base.method !== "all") parts.push(`method=${encodeURIComponent(base.method)}`);
  if (base.date !== "") parts.push(`date=${encodeURIComponent(base.date)}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `/admin/orders?${parts.join("&")}` : "/admin/orders";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    payment?: string;
    method?: string;
    exclude?: string;
    date?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tab: OrderTab = ORDER_TABS.some((t) => t.id === params.tab)
    ? (params.tab as OrderTab)
    : "pending";
  const q = (params.q ?? "").trim();
  const payment =
    params.payment === "UNPAID" || params.payment === "PAID" ? params.payment : "all";
  // Bộ lọc phương thức (Ngày 10 D10-2): chỉ nhận đúng 2 giá trị
  // trong enum PaymentMethod, còn lại coi như "all" (bỏ qua).
  const method =
    params.method === "BANK_TRANSFER" || params.method === "COD" ? params.method : "all";
  // Loại trạng thái (Ngày 10 D10-2): chỉ nhận đúng 1 trạng thái hợp
  // lệ trong enum OrderStatus, còn lại bỏ qua (không loại gì).
  const exclude: OrderStatus | "" =
    params.exclude === "NEW" ||
    params.exclude === "CONFIRMED" ||
    params.exclude === "PREPARING" ||
    params.exclude === "DELIVERING" ||
    params.exclude === "COMPLETED" ||
    params.exclude === "CANCELLED"
      ? params.exclude
      : "";
  const date = (params.date ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const list = await listAdminOrders({
    tab,
    q,
    payment,
    method,
    exclude: exclude === "" ? undefined : exclude,
    date,
    page,
  });
  const base: BaseParams = { tab, q, payment, method, exclude, date };
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink">Đơn hàng</h1>
      </div>
      <p role="status" className="mt-2 text-sm text-ink-soft">
        Tìm thấy {list.total} đơn
        {list.totalPages > 1 ? ` — trang ${list.page}/${list.totalPages}` : ""}
      </p>

      {/* Chip báo đang loại trạng thái (mục 3 verdict Ngày 10): từ
          thẻ dashboard sang với exclude=CANCELLED, tab hiện
          "Đã hủy (0)" và "Tất cả (7)" trong khi DB có đơn hủy thật
          mà không có dấu hiệu nào cho biết đang loại — chủ shop dễ
          hiểu nhầm. Chip này cho biết đang loại gì; bấm ✕ để bỏ
          lọc và hiện lại tất cả các đơn (kể cả đơn đã hủy). */}
      {exclude !== "" ? (
        <p className="mt-3">
          <Link
            href={clearExcludeHref(base, list.page)}
            data-testid="exclude-chip"
            aria-label={`Bỏ lọc loại đơn ${orderStatusLabel(exclude)} — hiện lại tất cả các đơn`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold-300 bg-gold-300 px-4 text-sm font-bold text-green-900 transition-colors hover:opacity-90"
          >
            Không tính đơn {orderStatusLabel(exclude).toLowerCase()} ✕
          </Link>
        </p>
      ) : null}

      <nav aria-label="Lọc theo trạng thái" className="mt-4 flex flex-wrap gap-2">
        {ORDER_TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(base, t.id)}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full border px-4 text-sm font-bold transition-colors ${
              t.id === tab
                ? "border-green-800 bg-green-800 text-white"
                : "border-line bg-white text-ink hover:border-green-800 hover:text-green-800"
            }`}
          >
            {t.label} ({list.counts[t.id]})
          </Link>
        ))}
      </nav>

      <form
        method="get"
        action="/admin/orders"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-[3px] border border-line bg-white p-4 shadow-[0_1px_2px_rgba(8,56,42,.06)]"
      >
        <input type="hidden" name="tab" value={tab} />
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-order-q" className="block text-sm font-semibold text-ink">
            Tìm theo mã đơn, tên, SĐT
          </label>
          <input
            id="admin-order-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Ví dụ: QAFNN907ZY, Hoa, 0900..."
            className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
          />
        </div>
        <div>
          <label htmlFor="admin-order-payment" className="block text-sm font-semibold text-ink">
            Thanh toán
          </label>
          <select
            id="admin-order-payment"
            name="payment"
            defaultValue={payment}
            className="mt-1 block min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
          >
            <option value="all">Tất cả</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
          </select>
        </div>
        {/* Phương thức thanh toán (Ngày 10 D10-2): thẻ dashboard
            "Chuyển khoản chưa thu" trỏ tới đây với
            method=BANK_TRANSFER; ô chọn để chủ shop tự lọc tay. */}
        <div>
          <label htmlFor="admin-order-method" className="block text-sm font-semibold text-ink">
            Phương thức
          </label>
          <select
            id="admin-order-method"
            name="method"
            defaultValue={method}
            className="mt-1 block min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
          >
            <option value="all">Tất cả</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="COD">COD</option>
          </select>
        </div>
        {/* Giữ lại tham số loại trạng thái (vd exclude=CANCELLED từ
            thẻ dashboard) khi bấm "Lọc" — form GET chỉ gửi các
            trường trong form, không giữ thì mất bộ lọc. */}
        {exclude !== "" ? <input type="hidden" name="exclude" value={exclude} /> : null}
        <div>
          <label htmlFor="admin-order-date" className="block text-sm font-semibold text-ink">
            Ngày giao
          </label>
          <input
            id="admin-order-date"
            name="date"
            type="date"
            defaultValue={date}
            className="mt-1 block min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
          />
        </div>
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 px-5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
        >
          Lọc
        </button>
      </form>

      {list.orders.length === 0 ? (
        <p className="mt-6 rounded-[3px] border border-line bg-white p-6 text-sm text-ink-soft">
          Không tìm thấy đơn hàng nào.
        </p>
      ) : (
        <>
          {/* Bảng từ 768 px */}
          <div className="mt-6 hidden overflow-x-auto rounded-[3px] border border-line bg-white shadow-[0_1px_2px_rgba(8,56,42,.06)] md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-cream-50 text-ink-soft">
                  <th scope="col" className="px-4 py-3 font-semibold">Mã đơn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Người đặt</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Người nhận / Khu vực</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Ngày giao</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tổng tiền</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Thanh toán</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.orders.map((o) => {
                  const badge =
                    o.status !== "COMPLETED" && o.status !== "CANCELLED"
                      ? orderDayBadge(o.deliveryDate, now)
                      : null;
                  return (
                    <tr key={o.code} data-testid="admin-order-row" className="border-b border-line last:border-b-0 hover:bg-cream-50/70">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${o.code}`}
                          className="inline-flex min-h-11 items-center font-bold text-ink hover:text-green-800 hover:underline"
                        >
                          {o.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{o.senderName}</td>
                      <td className="px-4 py-3">
                        {o.receiverName}
                        <span className="block text-xs text-muted">{o.area}</span>
                      </td>
                      <td className="px-4 py-3">
                        {formatVnDate(o.deliveryDate)}
                        <span className="block text-xs text-muted">{o.deliverySlot}</span>
                        {badge === "today" ? (
                          <span className="mt-1 inline-flex items-center rounded-full border border-gold-300 bg-gold-300 px-2 py-0.5 text-xs font-bold text-green-900">
                            Hôm nay
                          </span>
                        ) : badge === "overdue" ? (
                          <span className="mt-1 inline-flex items-center rounded-full border border-danger bg-danger px-2 py-0.5 text-xs font-bold text-white">
                            Quá hạn
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-bold text-ink">{formatVND(o.total)}</td>
                      <td className="px-4 py-3">
                        {paymentMethodLabel(o.paymentMethod)}
                        <span className="block text-xs text-muted">
                          {o.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {list.orders.map((o) => {
              const badge =
                o.status !== "COMPLETED" && o.status !== "CANCELLED"
                  ? orderDayBadge(o.deliveryDate, now)
                  : null;
              return (
                <li key={o.code} data-testid="admin-order-row" className="rounded-[3px] border border-line bg-white p-4 shadow-[0_1px_2px_rgba(8,56,42,.06)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/orders/${o.code}`}
                      className="inline-flex min-h-11 items-center font-bold text-ink hover:text-green-800 hover:underline"
                    >
                      {o.code}
                    </Link>
                    <span className="ml-auto">
                      <OrderStatusBadge status={o.status} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {o.senderName} → {o.receiverName} · {o.area}
                  </p>
                  <p className="mt-1 text-sm">
                    Giao {formatVnDate(o.deliveryDate)} · {o.deliverySlot}
                    {badge === "today" ? (
                      <span className="ml-2 inline-flex items-center rounded-full border border-gold-300 bg-gold-300 px-2 py-0.5 text-xs font-bold text-green-900">
                        Hôm nay
                      </span>
                    ) : badge === "overdue" ? (
                      <span className="ml-2 inline-flex items-center rounded-full border border-danger bg-danger px-2 py-0.5 text-xs font-bold text-white">
                        Quá hạn
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-bold text-ink">{formatVND(o.total)}</span>
                    {" · "}
                    {paymentMethodLabel(o.paymentMethod)}
                    {" · "}
                    {o.paymentStatus === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}
                  </p>
                </li>
              );
            })}
          </ul>

          {list.totalPages > 1 ? (
            <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3">
              {list.page > 1 ? (
                <Link
                  href={pageHref(base, list.page - 1)}
                  className="flex min-h-11 items-center justify-center rounded-[3px] border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream-100"
                >
                  ← Trang trước
                </Link>
              ) : null}
              <span className="text-sm text-ink-soft">
                Trang {list.page}/{list.totalPages}
              </span>
              {list.page < list.totalPages ? (
                <Link
                  href={pageHref(base, list.page + 1)}
                  className="flex min-h-11 items-center justify-center rounded-[3px] border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream-100"
                >
                  Trang sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
