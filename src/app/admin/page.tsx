import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminDashboardStats } from "@/lib/admin/dashboard";
import { formatVND } from "@/lib/format";

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

function formatVnDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getAdminDashboardStats();

  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    href: string;
  }> = [
    {
      label: "Đơn cần xử lý",
      value: String(stats.pendingCount),
      hint: "Mới nhận, đã xác nhận, đang giao",
      href: "/admin/orders?tab=pending",
    },
    {
      label: "Đơn giao hôm nay",
      value: String(stats.todayDeliveryCount),
      hint: formatVnDate(stats.todayVn),
      href: `/admin/orders?tab=all&date=${stats.todayVn}`,
    },
    {
      label: "Chuyển khoản chưa thu",
      value: String(stats.unpaidBankTransferCount),
      hint: "Đơn chuyển khoản, chưa thanh toán",
      href: "/admin/orders?tab=all&payment=UNPAID",
    },
    {
      label: "Doanh thu hôm nay",
      value: formatVND(stats.revenueToday),
      hint: "Đơn hoàn tất hôm nay",
      href: "/admin/orders?tab=COMPLETED",
    },
    {
      label: "Doanh thu 7 ngày",
      value: formatVND(stats.revenue7Days),
      hint: "Đơn hoàn tất 7 ngày gần nhất",
      href: "/admin/orders?tab=COMPLETED",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold text-ink">Tổng quan</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Số liệu ngày {formatVnDate(stats.todayVn)} — lấy trực tiếp từ cơ sở dữ liệu.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <section
            key={c.label}
            aria-label={c.label}
            className="rounded-[3px] border border-line bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-ink-soft">{c.label}</h2>
            <p data-testid="dashboard-stat" className="mt-2 font-display text-3xl font-bold text-ink">
              {c.value}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{c.hint}</p>
            <p className="mt-3">
              <Link
                href={c.href}
                className="inline-flex min-h-11 items-center text-sm font-bold text-green-800 hover:underline"
              >
                Xem danh sách →
              </Link>
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
