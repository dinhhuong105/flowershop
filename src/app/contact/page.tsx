import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Liên hệ",
  description:
    "Liên hệ Hoa Tươi Demo — số điện thoại, Zalo, địa chỉ và giờ mở cửa.",
};

// Trang liên hệ (Ngày 9, lộ trình gốc). Hotline, Zalo, địa chỉ và
// giờ mở cửa trong .env hiện là số giữ chỗ / giá trị tạm chưa được
// Henry xác nhận nên chỉ ghi "Đang cập nhật." — không hiển thị số
// giữ chỗ 0900000000 hay địa chỉ "(cập nhật sau)".
export default function ContactPage() {
  return (
    <div className="shell pb-12 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Liên hệ
      </h1>

      <div className="mt-6 max-w-3xl space-y-6 text-sm leading-relaxed text-ink-soft sm:text-base">
        <dl className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Hotline:</dt>
            <dd>Đang cập nhật.</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Zalo:</dt>
            <dd>Đang cập nhật.</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Địa chỉ cửa hàng:</dt>
            <dd>Đang cập nhật.</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold text-ink">Giờ mở cửa:</dt>
            <dd>Đang cập nhật.</dd>
          </div>
        </dl>

        <p>
          Để kiểm tra đơn hàng đã đặt, mở trang đơn theo mã đơn của bạn
          (địa chỉ dạng /order/MÃĐƠN). Câu hỏi thường gặp xem ở trang{" "}
          <Link href="/faq" className="font-bold text-green-800 hover:underline">
            Câu hỏi thường gặp
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
