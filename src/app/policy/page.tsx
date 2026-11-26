import type { Metadata } from "next";
import { redirectIfReplaced } from "@/lib/legacy-redirect";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Chuyển vĩnh viễn sang trang tĩnh thay thế khi Henry đã xuất bản
// (Ngày 14 C2); chưa thay thì hiện trang cũ như thường.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await redirectIfReplaced("/policy", await searchParams);
  return {
    title: "Chính sách",
    description:
      "Chính sách giao hàng, thanh toán, đổi trả và bảo mật thông tin của Hoa Tươi Demo.",
  };
}

// Trang chính sách (Ngày 9, lộ trình gốc). Chỉ ghi điều đã xác nhận
// được từ cách website đang chạy; mọi chi tiết chính sách cụ thể
// (phí, thời hạn, điều kiện đổi trả) đều ghi rõ "Đang cập nhật." —
// không bịa cam kết hay con số.
export default async function PolicyPage({ searchParams }: Props) {
  await redirectIfReplaced("/policy", await searchParams);
  return (
    <div className="shell pb-12 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Chính sách
      </h1>

      <div className="mt-6 max-w-3xl space-y-8 text-sm leading-relaxed text-ink-soft sm:text-base">
        <section aria-label="Giao hàng">
          <h2 className="font-display text-2xl font-semibold text-ink">Giao hàng</h2>
          <p className="mt-3">
            Bạn chọn phương thức giao ở bước thanh toán: giao nhanh trong
            2 giờ, giao trong ngày, hoặc hẹn ngày giờ. Khu vực giao
            hàng, phí giao và khung giờ cụ thể: Đang cập nhật.
          </p>
        </section>

        <section aria-label="Thanh toán">
          <h2 className="font-display text-2xl font-semibold text-ink">Thanh toán</h2>
          <p className="mt-3">
            Shop nhận thanh toán khi nhận hàng (COD) và chuyển khoản ngân
            hàng. Khi chọn chuyển khoản, trang đơn hàng hiển thị mã QR và
            nội dung chuyển khoản để bạn đối chiếu.
          </p>
        </section>

        <section aria-label="Đổi trả">
          <h2 className="font-display text-2xl font-semibold text-ink">Đổi trả</h2>
          <p className="mt-3">
            Đang cập nhật. Chính sách đổi trả đang chờ cửa hàng xác nhận.
          </p>
        </section>

        <section aria-label="Bảo mật thông tin">
          <h2 className="font-display text-2xl font-semibold text-ink">Bảo mật thông tin</h2>
          <p className="mt-3">
            Thông tin bạn điền khi đặt hàng (tên, số điện thoại, địa
            chỉ) chỉ dùng để chuẩn bị và giao đơn, và để liên hệ với bạn
            về đơn hàng đó. Trang đơn hàng không cho công cụ tìm kiếm
            lập chỉ mục và không được lưu trong bộ nhớ đệm của trình
            duyệt hay máy chủ trung gian.
          </p>
        </section>
      </div>
    </div>
  );
}
