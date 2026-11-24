import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/admin-auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

// Layout quản trị RIÊNG (Ngày 7 §2): không Header/Footer của shop,
// không truy vấn giỏ. Layout KHÔNG kiểm tra đăng nhập — mỗi trang và
// action tự gọi requireAdmin() ở câu lệnh đầu tiên.
//
// ĐẦU TRANG KIỂU NGÀY 7 (Ngày 10 D10-1, quyết định của Henry 24/11
// ~23:12: "Khôi phục kiểu Ngày 7, giữ đủ 4 mục menu"): thương hiệu
// hiện đầy đủ "Quản trị — Hoa Tươi Demo" (không rút gọn dưới sm),
// menu tự xuống dòng (flex-wrap) để thấy hết các mục, KHÔNG cuộn
// ngang, KHÔNG vệt mờ mask. Giữ đủ 4 mục (Tổng quan, Sản phẩm, Đơn
// hàng, Xem shop); thương hiệu vẫn trỏ về /admin (trang tổng quan,
// quyết định Ngày 9 giữ nguyên).
// ĐÁNH ĐỔI ĐÃ ĐƯỢC HENRY DUYỆT: đầu trang trên mobile cao ~2 hàng
// thay vì 1 hàng 69 px — tiêu chí "header một hàng ≤ 69 px" trong
// đặc tả D10-1 không còn giữ được (ưu tiên thấy đủ menu hơn giữ
// header 1 hàng). Đo thực tế ở 390 px xem báo cáo Ngày 10.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50 text-ink">
      <header className="border-b border-line bg-white">
        <div className="shell flex flex-wrap items-center gap-3 py-3">
          <Link
            href="/admin"
            className="flex min-h-11 shrink-0 items-center whitespace-nowrap font-display text-xl font-semibold text-green-900"
          >
            Quản trị — Hoa Tươi Demo
          </Link>
          <AdminNav />
          <form action={logoutAction} className="ml-auto shrink-0">
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
