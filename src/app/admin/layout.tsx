import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quản trị",
  robots: { index: false, follow: false },
};

// Layout quản trị RIÊNG (Ngày 7 §2): không Header/Footer của shop,
// không truy vấn giỏ. Layout KHÔNG kiểm tra đăng nhập — mỗi trang và
// action tự gọi requireAdmin() ở câu lệnh đầu tiên.
//
// THIẾT KẾ LẠI 25/11 (theo ảnh mẫu của Henry, phạm vi toàn bộ admin
// đã duyệt): đầu trang ngang kiểu Ngày 7 (thương hiệu đầy đủ +
// menu 2 hàng, quyết định 24/11 ~23:12) được THAY bằng sidebar trái
// màu xanh đậm + thanh trên có ô tìm kiếm + Đăng xuất — đánh đổi
// Henry đã duyệt khi chọn "Làm toàn bộ admin". Đủ 4 mục (Tổng quan,
// Sản phẩm, Đơn hàng, Xem shop) như cũ, chỉ chuyển vào sidebar;
// trên mobile sidebar thành drawer trượt. <main id="noi-dung-chinh">
// giữ nguyên để CSS in phiếu (làm trắng nền kem) vẫn trúng; trang
// in phiếu KHÔNG đổi.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
