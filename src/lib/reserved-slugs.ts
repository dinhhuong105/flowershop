// Các đường dẫn cấp 1 cố định, không được dùng làm slug danh mục
// (vì sẽ đụng với trang giỏ hàng, thanh toán, quản trị...).
export const RESERVED_SLUGS: string[] = [
  "gio-hang",
  "thanh-toan",
  "don-hang",
  "tim-kiem",
  "faq",
  "van-chuyen",
  "doi-tra",
  "bao-mat",
  "lien-he",
  "quan-tri",
  "api",
  "_next",
  "images",
  "uploads",
  "sitemap.xml",
  "robots.txt",
  "favicon.ico",
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug);
}
