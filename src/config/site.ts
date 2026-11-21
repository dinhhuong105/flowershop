export const siteConfig = {
  name: process.env.SHOP_NAME ?? "Hoa Tươi Demo",
  url: process.env.SITE_URL ?? "http://localhost:3000",
  description: "Hoa tươi, lan hồ điệp và giỏ quà trái cây giao tận nơi.",
  strapline: "Giao hoa trong ngày · Cắm hoa theo yêu cầu",
  hotline: process.env.HOTLINE ?? "0900000000",
  zaloPhone: process.env.ZALO_PHONE ?? process.env.HOTLINE ?? "0900000000",
  address: process.env.SHOP_ADDRESS ?? "Địa chỉ cửa hàng (cập nhật sau)",
  openHours: process.env.OPEN_HOURS ?? "Thứ 2 – Chủ nhật: 7:30 – 21:00",
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
