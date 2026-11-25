import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminDashboardStats } from "@/lib/admin/dashboard";
import { formatVND } from "@/lib/format";
import { formatVnDateTime } from "@/lib/vn-datetime";

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

export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getAdminDashboardStats();

  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    href: string;
    linkLabel: string;
  }> = [
    {
      label: "Đơn cần xử lý",
      value: String(stats.pendingCount),
      hint: "Mới nhận, đã xác nhận, đang giao",
      href: "/admin/orders?tab=pending",
      linkLabel: "Xem danh sách →",
    },
    {
      label: "Đơn giao hôm nay",
      value: String(stats.todayDeliveryCount),
      hint: "Không tính đơn đã hủy",
      href: `/admin/orders?tab=all&date=${stats.todayVn}&exclude=CANCELLED`,
      linkLabel: "Xem danh sách →",
    },
    {
      label: "Chuyển khoản chưa thu",
      value: String(stats.unpaidBankTransferCount),
      hint: "Đơn chuyển khoản, chưa thanh toán",
      href: "/admin/orders?tab=all&payment=UNPAID&method=BANK_TRANSFER&exclude=CANCELLED",
      linkLabel: "Xem danh sách →",
    },
    {
      label: "Doanh thu hôm nay",
      value: formatVND(stats.revenueToday),
      hint: "Danh sách đơn đã giao",
      href: "/admin/orders?tab=COMPLETED",
      linkLabel: "Xem đơn đã giao →",
    },
    {
      label: "Doanh thu 7 ngày",
      value: formatVND(stats.revenue7Days),
      hint: "Danh sách đơn đã giao",
      href: "/admin/orders?tab=COMPLETED",
      linkLabel: "Xem đơn đã giao →",
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
                {c.linkLabel}
              </Link>
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
