// Số giữ chỗ trong .env mẫu — KHÔNG phải số thật, không được hiển thị
// hay gắn tel: link. Khi Henry cung cấp số thật, đổi giá trị env là đủ.
const PLACEHOLDER_PHONE = "0900000000";
const PLACEHOLDER_ADDRESS = "Địa chỉ cửa hàng (cập nhật sau)";

function realPhone(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v || v === PLACEHOLDER_PHONE) return "";
  return v;
}

function realAddress(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v || v === PLACEHOLDER_ADDRESS) return "";
  return v;
}

export const siteConfig = {
  name: process.env.SHOP_NAME ?? "Hoa Tươi Demo",
  url: process.env.SITE_URL ?? "http://localhost:3000",
  description: "Hoa tươi, lan hồ điệp và giỏ quà trái cây giao tận nơi.",
  strapline: "Giao hoa trong ngày · Cắm hoa theo yêu cầu",
  // Dòng nhỏ dưới tên shop ở header (mục 4.2 phụ lục).
  tagline: "HOA TƯƠI & QUÀ TẶNG CAO CẤP",
  // Chỉ có giá trị thật mới khác rỗng: số 0900000000 và địa chỉ
  // "(cập nhật sau)" trong .env mẫu bị lọc thành "" ở đây.
  hotline: realPhone(process.env.HOTLINE),
  zaloPhone: realPhone(process.env.ZALO_PHONE ?? process.env.HOTLINE),
  address: realAddress(process.env.SHOP_ADDRESS),
  openHours: process.env.OPEN_HOURS ?? "Thứ 2 – Chủ nhật: 7:30 – 21:00",
  // Top bar: 3 mục, mục cuối là "Hỗ trợ tư vấn" (gắn tel: chỉ khi có số thật).
  topBar: [
    "Ưu đãi và quà tặng dành cho khách hàng",
    "Khám phá bộ sưu tập hoa và giỏ quà cao cấp",
    "Hỗ trợ tư vấn",
  ],
  // Dải USP: đúng 4 mục theo mục 4.3 phụ lục, mô tả trung tính
  // (không hứa con số 24/7, 2–4h hay miễn phí giao hàng).
  usp: [
    {
      title: "Giao hoa nhanh trong ngày",
      text: "Đặt hoa và nhận hoa tận nơi trong ngày.",
      icon: "truck",
    },
    {
      title: "Hoa được tuyển chọn",
      text: "Hoa tươi mới mỗi ngày, chỉ chọn những cành đẹp nhất.",
      icon: "flower",
    },
    {
      title: "Hỗ trợ tận tâm",
      text: "Tư vấn chọn hoa theo dịp và ngân sách của bạn.",
      icon: "chat",
    },
    {
      title: "Thanh toán an toàn",
      text: "Thanh toán khi nhận hàng hoặc chuyển khoản.",
      icon: "shield",
    },
  ],
  // Chưa có URL mạng xã hội thật nào → mảng rỗng, footer không render icon.
  socialLinks: [] as Array<{ label: string; href: string }>,

  // Nhãn huy hiệu "Giao nhanh" trên ảnh sản phẩm (Ngày 4).
  fastDeliveryLabel: "Giao nhanh",

  // Dòng phụ về giao hàng trên trang chi tiết (Ngày 4, vd "Giao trong 4h",
  // "Hỗ trợ phí giao"): mặc định RỖNG → không hiện dòng nào, vì chưa có
  // chính sách thật do Henry xác nhận.
  deliveryNotes: [] as string[],

  // Khối cam kết trên trang chi tiết (Ngày 4): mặc định RỖNG → ẩn cả khối.
  // Khi Henry cung cấp nội dung thật, điền mảng { title, text } vào đây.
  commitments: [] as Array<{ title: string; text: string }>,
};

// Dịp tặng hoa dùng cho trang chủ (liên kết tới /hoa-tuoi?dip=<slug>, trang đó làm ở Ngày 3)
export const occasions = [
  { slug: "sinh-nhat", label: "Sinh nhật" },
  { slug: "khai-truong", label: "Khai trương" },
  { slug: "chuc-mung", label: "Chúc mừng" },
  { slug: "tinh-yeu", label: "Tình yêu" },
  { slug: "chia-buon", label: "Chia buồn" },
] as const;

export function telHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}
export function zaloHref(phone: string) {
  return `https://zalo.me/${phone.replace(/\s+/g, "")}`;
}
