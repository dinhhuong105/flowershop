// Các đường dẫn cấp 1 cố định, không được dùng làm slug danh mục
// (vì sẽ đụng với trang giỏ hàng, thanh toán, quản trị...).
// Ngày 7 (quyết định của Henry 23/11): URL cố định dùng tiếng Anh —
// /cart, /checkout, /order, /search, /admin, /login. Slug danh mục/
// sản phẩm lấy từ DB vẫn giữ tiếng Việt.
export const RESERVED_SLUGS: string[] = [
  "cart",
  "checkout",
  "order",
  "search",
  "faq",
  "about",
  "contact",
  "policy",
  // "trang" giữ trong danh sách cấm dù route /trang/[slug] đã bỏ
  // (Ngày 14, lệnh Henry): tránh slug "trang" gây nhầm với tiền tố
  // cũ; không còn URL /trang/... nào được tạo ra nữa.
  "trang",
  "van-chuyen",
  "doi-tra",
  "bao-mat",
  "lien-he",
  "admin",
  "login",
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
