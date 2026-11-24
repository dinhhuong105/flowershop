"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu quản trị kiểu Ngày 7 (Ngày 10 D10-1, quyết định của Henry
// 24/11 ~23:12: "Khôi phục kiểu Ngày 7, giữ đủ 4 mục menu"):
// flex-wrap để thấy hết các mục, KHÔNG cuộn ngang, KHÔNG vệt mờ
// mask. Mục đang mở (aria-current="page") có dấu hiệu nhìn thấy
// (gạch chân + chữ đậm xanh). Yêu cầu "tự cuộn vào vùng nhìn" trong
// đặc tả không còn cần vì không còn cuộn ngang.
//
// basis-[220px]: ngưỡng để menu xuống hàng của nó ở mobile — rộng
// hơn phần còn lại sau thương hiệu (343 - 247 - 12 = 84 px) nên menu
// không bị ép chung hàng 1 với thương hiệu; ở hàng 2 nó giãn
// (flex-1) vừa đủ để nút Đăng xuất cùng hàng (menu ~225 px, các mục
// vẫn xếp được 2 dòng). Không có basis này, menu (flex-1, basis 0)
// sẽ bị ép dẹt vào hàng 1 và các mục tràn khỏi khung.
const LINKS: Array<{
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/admin",
    label: "Tổng quan",
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/products",
    label: "Sản phẩm",
    match: (p) => p === "/admin/products" || p.startsWith("/admin/products/"),
  },
  {
    href: "/admin/orders",
    label: "Đơn hàng",
    match: (p) => p === "/admin/orders" || p.startsWith("/admin/orders/"),
  },
  {
    href: "/",
    label: "Xem shop ↗",
    match: () => false,
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quản trị"
      className="flex min-w-0 flex-1 basis-[220px] flex-wrap items-center gap-1"
    >
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[3px] px-3 text-sm font-semibold transition-colors hover:bg-cream-100 hover:text-green-800 ${
              active
                ? "font-bold text-green-800 underline decoration-2 underline-offset-4"
                : "text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
