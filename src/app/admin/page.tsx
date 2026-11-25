import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/auth";
import {
  getAdminDashboardStats,
  getOrderStatusCounts,
  getRecentOrders,
} from "@/lib/admin/dashboard";
import { formatVND } from "@/lib/format";
import { formatVnDateTime } from "@/lib/vn-datetime";
import { orderStatusLabel } from "@/lib/order-labels";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tổng quan",
  robots: { index: false, follow: false },
};

// Trang tổng quan quản trị (Ngày 9 D9-8): số đơn cần xử lý, đơn giao
// hôm nay, chuyển khoản chưa thu, doanh thu đơn COMPLETED hôm nay và
// 7 ngày. Mọi số lấy trực tiếp từ DB (không cache): trang force-dynamic
// + header no-store cho /admin (next.config.ts).
//
// QUYẾT ĐỊNH (Ngày 9): sau đăng nhập vào ĐÂY (/admin), không vào
// /admin/orders nữa — tổng quan trước, rồi bấm vào từng mục để xem
// danh sách đơn. Ba chỗ chuyển sau đăng nhập (route /api/admin/login,
// /login, LoginForm) đều đổi theo.
//
// D10-2: link thẻ phải ra đúng số trên thẻ — thẻ "Đơn giao hôm nay"
// thêm exclude=CANCELLED (trước đây lẫn 1 đơn hủy, danh sách ra 12
// trong khi thẻ ghi 11); thẻ "Chuyển khoản chưa thu" thêm
// method=BANK_TRANSFER + exclude=CANCELLED (trước đây lẫn cả COD
// chưa thu, danh sách ra 24 trong khi thẻ ghi 7). Hai thẻ doanh thu
// KHÔNG thể khớp số đơn với số tiền (doanh thu tính theo ngày hoàn
// tất, danh sách lọc theo ngày giao) nên đổi nhãn thành "Xem đơn đã
// giao" — không hứa danh sách khớp tổng tiền — và dòng phụ thành
// "Danh sách đơn đã giao".
//
// THIẾT KẾ LẠI 25/11 (theo ảnh mẫu của Henry): 5 thẻ số liệu kiểu
// ảnh mẫu (ô icon màu + nhãn + số lớn + dòng phụ + link), rồi bên
// dưới là cột trái "Đơn mới nhất" và cột phải "Tiến độ đơn hàng" +
// "Thống kê theo trạng thái" (biểu đồ tròn vẽ bằng conic-gradient,
// không thêm thư viện). Mọi số trong cột phải/lấy từ DB (đếm theo
// trạng thái, 5 đơn mới nhất) — không bịa phần trăm tăng trưởng như
// ảnh mẫu (ảnh mẫu có "↑12%" so với tháng trước; shop chưa có số
// liệu đó nên KHÔNG hiện).

// Màu từng trạng thái cho thanh tiến độ + biểu đồ tròn (giữ token
// xanh lá/vàng của shop + màu ngữ nghĩa đã có).
const STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "#0d6532",
  CONFIRMED: "#b8862b",
  PREPARING: "#5d6b63",
  DELIVERING: "#db9b3a",
  COMPLETED: "#15803d",
  CANCELLED: "#b91c1c",
};

const ICON_CLIPBOARD = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </svg>
);
const ICON_TRUCK = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18h-5" />
    <path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-2" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </svg>
);
const ICON_BANKNOTE = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);
const ICON_CHART = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 14v3" />
    <path d="M12 10v7" />
    <path d="M17 6v11" />
  </svg>
);

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [stats, statusCounts, recentOrders] = await Promise.all([
    getAdminDashboardStats(),
    getOrderStatusCounts(),
    getRecentOrders(5),
  ]);
  const totalOrders = statusCounts.reduce((sum, row) => sum + row.count, 0);

  // Biểu đồ tròn: conic-gradient từ số đếm theo trạng thái. Tổng 0
  // đơn thì vẽ vòng xám trơn (không chia phần trăm cho số 0).
  let acc = 0;
  const donutBackground =
    totalOrders > 0
      ? `conic-gradient(${statusCounts
          .filter((row) => row.count > 0)
          .map((row) => {
            const from = ((acc / totalOrders) * 100).toFixed(2);
            acc += row.count;
            const to = ((acc / totalOrders) * 100).toFixed(2);
            return `${STATUS_COLORS[row.status]} ${from}% ${to}%`;
          })
          .join(", ")})`
      : "#e8e2d6";

  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    href: string;
    linkLabel: string;
    icon: React.ReactNode;
    iconClass: string;
  }> = [
    {
      label: "Đơn cần xử lý",
      value: String(stats.pendingCount),
      hint: "Mới nhận, đã xác nhận, đang giao",
      href: "/admin/orders?tab=pending",
      linkLabel: "Xem danh sách →",
      icon: ICON_CLIPBOARD,
      iconClass: "bg-cream-100 text-green-800",
    },
    {
      label: "Đơn giao hôm nay",
      value: String(stats.todayDeliveryCount),
      hint: "Không tính đơn đã hủy",
      href: `/admin/orders?tab=all&date=${stats.todayVn}&exclude=CANCELLED`,
      linkLabel: "Xem danh sách →",
      icon: ICON_TRUCK,
      iconClass: "bg-cream-100 text-green-800",
    },
    {
      label: "Chuyển khoản chưa thu",
      value: String(stats.unpaidBankTransferCount),
      hint: "Đơn chuyển khoản, chưa thanh toán",
      href: "/admin/orders?tab=all&payment=UNPAID&method=BANK_TRANSFER&exclude=CANCELLED",
      linkLabel: "Xem danh sách →",
      icon: ICON_BANKNOTE,
      iconClass: "bg-cream-100 text-green-800",
    },
    {
      label: "Doanh thu hôm nay",
      value: formatVND(stats.revenueToday),
      hint: "Danh sách đơn đã giao",
      href: "/admin/orders?tab=COMPLETED",
      linkLabel: "Xem đơn đã giao →",
      icon: ICON_CHART,
      iconClass: "bg-gold-300/20 text-gold-text",
    },
    {
      label: "Doanh thu 7 ngày",
      value: formatVND(stats.revenue7Days),
      hint: "Danh sách đơn đã giao",
      href: "/admin/orders?tab=COMPLETED",
      linkLabel: "Xem đơn đã giao →",
      icon: ICON_CHART,
      iconClass: "bg-gold-300/20 text-gold-text",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Tổng quan</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Cập nhật lúc {formatVnDateTime(new Date())}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <section
            key={c.label}
            aria-label={c.label}
            className="rounded-[3px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(8,56,42,.06)]"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[3px] ${c.iconClass}`}
              >
                {c.icon}
              </span>
              <h2 className="min-w-0 text-sm font-semibold text-ink-soft">{c.label}</h2>
            </div>
            {/* Số nằm ở hàng riêng, full chiều rộng thẻ, cỡ text-2xl:
                số tiền VND dài ("4.130.000 ₫") ở text-3xl sẽ tràn
                khỏi thẻ khi 5 thẻ xếp 1 hàng (nội dung thẻ chỉ ~139
                px ở 1280 px) — đã thấy tràn ở ảnh kiểm đầu. Vì vậy
                lưới thẻ là 3 cột (3+2) thay vì 5 thẻ 1 hàng như ảnh
                mẫu (số trong ảnh mẫu ngắn: "48", "87%"). */}
            <p data-testid="dashboard-stat" className="mt-3 whitespace-nowrap font-display text-2xl font-bold text-ink">
              {c.value}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{c.hint}</p>
            <p className="mt-3">
              <Link
                href={c.href}
                className="inline-flex min-h-11 items-center text-sm font-bold text-green-800 hover:underline"
              >
                {c.linkLabel}
              </Link>
            </p>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label="Đơn mới nhất"
          className="rounded-[3px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(8,56,42,.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">Đơn mới nhất</h2>
            <Link
              href="/admin/orders"
              className="inline-flex min-h-11 items-center text-sm font-bold text-green-800 hover:underline"
            >
              Xem tất cả đơn →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Chưa có đơn hàng nào.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recentOrders.map((o) => (
                <li key={o.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/admin/orders/${o.code}`}
                    className="inline-flex min-h-11 items-center font-bold text-ink hover:text-green-800 hover:underline"
                  >
                    {o.code}
                  </Link>
                  <span className="text-sm text-ink-soft">
                    {o.senderName} → {o.receiverName}
                  </span>
                  <span className="ml-auto text-sm font-bold text-ink">{formatVND(o.total)}</span>
                  <OrderStatusBadge status={o.status} />
                  <span className="w-full text-xs text-muted">
                    {formatVnDateTime(o.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section
            aria-label="Tiến độ đơn hàng"
            className="rounded-[3px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(8,56,42,.06)]"
          >
            <h2 className="font-display text-xl font-semibold text-ink">Tiến độ đơn hàng</h2>
            {totalOrders === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">Chưa có đơn hàng nào.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {statusCounts.map((row) => {
                  const pct = Math.round((row.count / totalOrders) * 100);
                  return (
                    <li key={row.status}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-ink">
                          {orderStatusLabel(row.status)}
                        </span>
                        <span className="font-bold text-ink">
                          {row.count} đơn · {pct}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STATUS_COLORS[row.status],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            aria-label="Thống kê theo trạng thái"
            className="rounded-[3px] border border-line bg-white p-5 shadow-[0_1px_2px_rgba(8,56,42,.06)]"
          >
            <h2 className="font-display text-xl font-semibold text-ink">
              Thống kê theo trạng thái
            </h2>
            <div className="mt-4 flex items-center justify-center">
              <div
                role="img"
                aria-label={`Tổng ${totalOrders} đơn: ${statusCounts
                  .map((row) => `${orderStatusLabel(row.status)} ${row.count}`)
                  .join(", ")}`}
                className="relative h-44 w-44 shrink-0 rounded-full"
                style={{ background: donutBackground }}
              >
                <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="font-display text-3xl font-bold text-ink">{totalOrders}</span>
                  <span className="text-xs text-muted">Tổng đơn</span>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {statusCounts.map((row) => {
                const pct =
                  totalOrders > 0 ? Math.round((row.count / totalOrders) * 100) : 0;
                return (
                  <li key={row.status} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[row.status] }}
                    />
                    <span className="text-ink-soft">{orderStatusLabel(row.status)}</span>
                    <span className="ml-auto font-bold text-ink">
                      {pct}% ({row.count})
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
