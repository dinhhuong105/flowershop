import type { Metadata } from "next";
import Accordion from "@/components/ui/Accordion";

export const metadata: Metadata = {
  title: "Câu hỏi thường gặp",
  description:
    "Cách đặt hoa, giao hàng, thanh toán và theo dõi đơn hàng tại Hoa Tươi Demo.",
};

// Trang FAQ (Ngày 9, lộ trình gốc). Chỉ ghi điều đã xác nhận được
// từ cách website đang chạy; chỗ nào chờ Henry (khu vực/phí giao,
// chính sách đổi trả, hotline...) thì ghi rõ "Đang cập nhật." —
// không bịa cam kết hay con số.
const ITEMS = [
  {
    title: "Làm sao để đặt hoa trên website?",
    content:
      "Chọn sản phẩm rồi bấm “Thêm vào giỏ hàng” hoặc “Mua ngay”, điền thông tin người đặt và người nhận ở trang thanh toán rồi xác nhận. Sau khi đặt xong, bạn nhận được mã đơn hàng để theo dõi.",
  },
  {
    title: "Shop giao hàng như thế nào?",
    content:
      "Bạn chọn phương thức giao ở bước thanh toán: giao nhanh trong 2 giờ, giao trong ngày, hoặc hẹn ngày giờ. Khu vực giao hàng và phí giao: Đang cập nhật.",
  },
  {
    title: "Tôi có thể thanh toán bằng cách nào?",
    content:
      "Thanh toán khi nhận hàng (COD) hoặc chuyển khoản ngân hàng. Khi chọn chuyển khoản, trang đơn hàng hiển thị mã QR và nội dung chuyển khoản để bạn đối chiếu.",
  },
  {
    title: "Làm sao để theo dõi đơn hàng của tôi?",
    content:
      "Mở trang đơn hàng theo mã đơn bạn nhận được sau khi đặt (địa chỉ dạng /order/MÃĐƠN). Trang này hiện trạng thái đơn, thông tin giao hàng và tình trạng thanh toán.",
  },
  {
    title: "Shop có đổi trả hoa không?",
    content: "Đang cập nhật. Chính sách đổi trả đang chờ cửa hàng xác nhận.",
  },
  {
    title: "Làm sao để giữ hoa tươi lâu?",
    content:
      "Cắm hoa vào nước sạch, thay nước mỗi ngày, đặt hoa nơi mát, tránh nắng gắt và gió mạnh. Cắt ngắn cuống hoa một ít trước khi cắm giúp hoa hút nước tốt hơn.",
  },
  {
    title: "Liên hệ shop bằng cách nào?",
    content:
      "Số điện thoại, Zalo và địa chỉ cửa hàng: Đang cập nhật.",
  },
];

export default function FaqPage() {
  return (
    <div className="shell pb-12 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Câu hỏi thường gặp
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
        Những điều khách hàng hay hỏi khi đặt hoa. Mục nào ghi “Đang cập
        nhật.” là shop chưa xác nhận xong — sẽ bổ sung ngay khi có thông
        tin chính thức.
      </p>
      <div className="mt-8 max-w-3xl">
        <Accordion items={ITEMS} />
      </div>
    </div>
  );
}
