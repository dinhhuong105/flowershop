// Nội dung hero slider trang chủ (mục 5.1 phụ lục). Chữ trung tính,
// không khuyến mãi giả, không số liệu giả. Cả hai nút đều dẫn tới
// danh mục có thật. Slide 1 dùng khẩu hiệu "Trao hoa, gửi yêu thương".

export type HeroSlide = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export const heroSlides: HeroSlide[] = [
  {
    eyebrow: "Hoa tươi & quà tặng cao cấp",
    title: "Trao hoa,",
    titleAccent: "gửi yêu thương",
    description:
      "Hoa tươi tinh tế, quà tặng sang trọng — lựa chọn hoàn hảo cho mọi dịp đặc biệt.",
    primaryLabel: "Khám phá hoa tươi",
    primaryHref: "/hoa-tuoi",
    secondaryLabel: "Xem giỏ quà",
    secondaryHref: "/gio-trai-cay",
  },
  {
    eyebrow: "Lan hồ điệp",
    title: "Lan hồ điệp",
    titleAccent: "sang trọng",
    description:
      "Chậu lan tuyển chọn, quà tặng đẳng cấp cho khai trương và chúc mừng.",
    primaryLabel: "Xem lan hồ điệp",
    primaryHref: "/lan-ho-diep",
    secondaryLabel: "Khám phá hoa tươi",
    secondaryHref: "/hoa-tuoi",
  },
  {
    eyebrow: "Giỏ quà trái cây",
    title: "Giỏ quà trái cây",
    titleAccent: "tinh tế",
    description:
      "Trái cây tươi ngon, chọn lọc kỹ càng — quà tặng thiết thực và trang nhã.",
    primaryLabel: "Xem giỏ quà",
    primaryHref: "/gio-trai-cay",
    secondaryLabel: "Khám phá hoa tươi",
    secondaryHref: "/hoa-tuoi",
  },
];

// Mô tả ngắn dưới tên mỗi danh mục ở trang chủ (dữ liệu mẫu, trung tính).
export const categoryDescriptions: Record<string, string> = {
  "hoa-tuoi": "Hoa tươi tinh tế, rực rỡ cho mọi dịp đặc biệt.",
  "gio-trai-cay": "Giỏ quà sang trọng, gửi gắm lời chúc trọn vẹn.",
  "hop-trai-cay": "Trái cây tươi ngon, an toàn và giàu dinh dưỡng.",
  "lan-ho-diep": "Vẻ đẹp bền lâu, lưu giữ cảm xúc theo thời gian.",
};
