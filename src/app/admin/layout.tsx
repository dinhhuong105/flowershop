import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { getAdminDashboardStats } from "@/lib/admin/dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

// Layout quản trị RIÊNG (Ngày 7 §2): không Header/Footer của shop,
// không truy vấn giỏ. Layout KHÔNG kiểm tra đăng nhập — mỗi trang và
// action tự gọi requireAdmin() ở câu lệnh đầu tiên.
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
// memo xuyên test). Layout KHÔNG kiểm tra đăng nhập — mỗi trang
// tự gọi requireAdmin() và chuyển về /login nếu chưa đăng nhập,
// nên số này không lộ ra ngoài khi chưa đăng nhập.
//
// Slot `modal` (25/11): intercepting route @modal — thêm/sửa sản
// phẩm mở dạng popup trên nền danh sách thay vì chuyển trang.
// Vào trực tiếp URL /admin/products/new (hoặc /[id]) thì slot
// không khớp, hiện trang form đầy đủ như cũ.
export default async function AdminLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const stats = await getAdminDashboardStats();
  return (
    <AdminShell pendingCount={stats.pendingCount} modal={modal}>
      {children}
    </AdminShell>
  );
}
