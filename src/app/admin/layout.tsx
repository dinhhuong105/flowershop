import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/admin-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

// Layout quản trị RIÊNG (Ngày 7 §2): không Header/Footer của shop,
// không truy vấn giỏ. Layout KHÔNG kiểm tra đăng nhập — mỗi trang và
// action tự gọi requireAdmin() ở câu lệnh đầu tiên.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50 text-ink">
      {/* Header quản trị gọn trên mobile (Ngày 9 D9-7): trước đây
          flex-wrap làm header cao ~167 px ở 390 px (nhiều hàng).
          Giờ là một hàng: thương hiệu + menu cuộn ngang + đăng xuất. */}
      <header className="border-b border-line bg-white">
        <div className="shell flex items-center gap-3 py-3">
          <Link
            href="/admin"
            className="flex min-h-11 shrink-0 items-center whitespace-nowrap font-display text-xl font-semibold text-green-900"
          >
            {/* Tên đầy đủ tràn 4 px ở 390 px (thương hiệu ~264 px +
                2 khoảng cách + nút Đăng xuất 106 px > 358 px nội dung):
                mobile chỉ hiện "Quản trị", từ sm trở lên hiện đủ. */}
            <span className="sm:hidden">Quản trị</span>
            <span className="hidden sm:inline">Quản trị — Hoa Tươi Demo</span>
          </Link>
          <nav aria-label="Quản trị" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <Link
              href="/admin"
              className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Tổng quan
            </Link>
            <Link
              href="/admin/products"
              className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Sản phẩm
            </Link>
            <Link
              href="/admin/orders"
              className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Đơn hàng
            </Link>
            <Link
              href="/"
              className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Xem shop ↗
            </Link>
          </nav>
          <form action={logoutAction} className="shrink-0">
            <button
              type="submit"
              className="flex min-h-11 items-center whitespace-nowrap rounded-[3px] border border-line bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-green-800 hover:text-green-800"
            >
              Đăng xuất
            </button>
          </form>
        </div>
      </header>
      <main className="shell py-6">{children}</main>
    </div>
  );
}
