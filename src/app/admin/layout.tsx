import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminDashboardStats } from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

// Layout quản trị RIÊNG (Ngày 7 §2): không Header/Footer của shop,
// không truy vấn giỏ. Layout KIỂM TRA đăng nhập trước khi đọc số
// liệu (Ngày 17 S1 — trước đây layout gọi getAdminDashboardStats()
// mà không requireAdmin: tuy trang con cũng kiểm tra và redirect
// thắng, layout vẫn truy vấn dữ liệu admin trước khi xác thực).
//
// THIẾT KẾ LẠI LẦN 2, 25/11 (đúng màu/style ảnh mẫu của Henry):
// sidebar navy #0f1e33 + thanh trên trắng có ô tìm kiếm + chuông
// báo (số = đơn cần xử lý) + Đăng xuất. <main
// id="noi-dung-chinh"> giữ nguyên để CSS in phiếu (làm trắng nền
// kem) vẫn trúng; trang in phiếu KHÔNG đổi.
//
// Layout lấy số đơn cần xử lý để truyền cho chuông ở AdminShell
// (hàm dashboard sẵn có; trang tổng quan cũng gọi hàm này —
// trùng một lượt đếm rẻ, không cache để khỏi làm test:db sai do
// memo xuyên test). requireAdmin() ở đây là cửa chính; mỗi trang
// vẫn tự gọi requireAdmin() ở câu lệnh đầu tiên.
export default async function AdminLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  await requireAdmin();
  const stats = await getAdminDashboardStats();
  return (
    <AdminShell
      pendingCount={stats.pendingCount}
      latestPendingCode={stats.latestPendingCode}
      modal={modal}
    >
      {children}
    </AdminShell>
  );
}
