export const PAGE_SIZE = 8;

// Thứ tự hiển thị tab dịp; tab chỉ hiện nếu danh mục có ít nhất một sản phẩm mang tag đó.
export const tagLabels = [
  { slug: "sinh-nhat", label: "Sinh nhật" },
  { slug: "khai-truong", label: "Khai trương" },
  { slug: "chuc-mung", label: "Chúc mừng" },
  { slug: "tinh-yeu", label: "Tình yêu" },
  { slug: "chia-buon", label: "Chia buồn" },
  { slug: "tham-benh", label: "Thăm bệnh" },
  { slug: "qua-tang", label: "Quà tặng" },
] as const;

export const priceRanges = [
  { slug: "duoi-1tr", label: "Dưới 1 triệu", min: null, max: 1_000_000 }, // giá < max
  { slug: "1-2tr", label: "1 – 2 triệu", min: 1_000_000, max: 2_000_000 }, // min <= giá < max
  { slug: "tren-2tr", label: "Trên 2 triệu", min: 2_000_000, max: null }, // giá >= min
] as const;

export const sortOptions = [
  { slug: "gia-tang", label: "Giá tăng dần" },
  { slug: "gia-giam", label: "Giá giảm dần" },
] as const;
