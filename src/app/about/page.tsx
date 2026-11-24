import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description:
    "Hoa Tươi Demo — cửa hàng hoa trực tuyến: hoa tươi, lan hồ điệp, giỏ và hộp trái cây giao tận nơi.",
};

// Trang giới thiệu (Ngày 9, lộ trình gốc). Chỉ ghi điều có thật từ
// website đang chạy; không bịa lịch sử, quy mô hay cam kết. Chỗ nào
// chờ Henry thì ghi rõ "Đang cập nhật."
export default function AboutPage() {
  return (
    <div className="shell pb-12 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Giới thiệu
      </h1>

      <div className="mt-6 max-w-3xl space-y-6 text-sm leading-relaxed text-ink-soft sm:text-base">
        <p>
          Hoa Tươi Demo là cửa hàng hoa trực tuyến. Shop bán hoa tươi,
          lan hồ điệp, giỏ trái cây và hộp trái cây — để tặng sinh nhật,
          chúc mừng, khai trương, chia buồn, hay đơn giản là một món quà
          bất ngờ cho người thương.
        </p>

        <section aria-label="Chúng tôi bán gì">
          <h2 className="font-display text-2xl font-semibold text-ink">Chúng tôi bán gì</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Hoa tươi: bó hoa, giỏ hoa, lẵng hoa, kệ hoa theo dịp.</li>
            <li>Lan hồ điệp: chậu lan trắng, vàng, tím hồng.</li>
            <li>Giỏ trái cây và hộp trái cây: trái cây tươi chọn lọc.</li>
          </ul>
          <p className="mt-3">
            Xem toàn bộ sản phẩm ở{" "}
            <Link href="/" className="font-bold text-green-800 hover:underline">
              trang chủ
            </Link>
            .
          </p>
        </section>

        <section aria-label="Giao hàng">
          <h2 className="font-display text-2xl font-semibold text-ink">Giao hàng</h2>
          <p className="mt-3">
            Shop giao nhanh trong 2 giờ, giao trong ngày, hoặc hẹn ngày
            giờ theo lựa chọn của bạn ở bước thanh toán. Khu vực giao
            hàng, phí giao và giờ mở cửa: Đang cập nhật.
          </p>
        </section>

        <section aria-label="Liên hệ">
          <h2 className="font-display text-2xl font-semibold text-ink">Liên hệ</h2>
          <p className="mt-3">
            Số điện thoại, Zalo và địa chỉ cửa hàng: Đang cập nhật. Xem
            thêm ở trang{" "}
            <Link href="/contact" className="font-bold text-green-800 hover:underline">
              Liên hệ
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
