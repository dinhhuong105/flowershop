import type { Metadata } from "next";
import Link from "next/link";
import UspStrip from "@/components/layout/UspStrip";

// Tiêu đề tab khi trang không tìm thấy (kể cả khi notFound() được gọi
// từ một trang có metadata riêng như /order/[code] — trước đây tab
// vẫn giữ tiêu đề "Đặt hàng thành công" của trang đơn hàng).
export const metadata: Metadata = {
  title: "Không tìm thấy trang",
};

export default function NotFound() {
  return (
    <>
      <div className="shell py-16 text-center">
        <h1 className="text-ink">Không tìm thấy trang</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Trang bạn tìm không còn ở đây hoặc chưa được tạo. Bạn có thể quay lại
          trang chủ để xem hoa tươi và giỏ quà.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 px-6 text-sm font-bold uppercase tracking-wide text-white transition-all duration-150 hover:bg-green-700 active:scale-[0.97]"
        >
          Về trang chủ
        </Link>
      </div>
      <UspStrip />
    </>
  );
}
