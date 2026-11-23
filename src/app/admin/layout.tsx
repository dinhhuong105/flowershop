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
      <header className="border-b border-line bg-white">
        <div className="shell flex flex-wrap items-center gap-3 py-3">
          <Link
            href="/admin/products"
            className="font-display text-xl font-semibold text-green-900"
          >
            Quản trị — Hoa Tươi Demo
          </Link>
          <nav aria-label="Quản trị" className="flex items-center gap-1">
            <Link
              href="/admin/products"
              className="flex min-h-11 items-center rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Sản phẩm
            </Link>
            <Link
              href="/"
              className="flex min-h-11 items-center rounded-[3px] px-3 text-sm font-semibold text-ink transition-colors hover:bg-cream-100 hover:text-green-800"
            >
              Xem shop ↗
            </Link>
          </nav>
          <form action={logoutAction} className="ml-auto">
            <button
              type="submit"
              className="flex min-h-11 items-center rounded-[3px] border border-line bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-green-800 hover:text-green-800"
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
