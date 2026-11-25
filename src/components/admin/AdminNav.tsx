"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu dọc trong sidebar tối (thiết kế lại admin 25/11 theo ảnh mẫu
// của Henry): mục đang mở (aria-current="page") nền xanh đậm + chữ
// trắng, giống ô đang chọn màu xanh trong ảnh mẫu nhưng giữ token
// xanh lá/vàng của shop. Chia theo nhóm như ảnh mẫu ("Tổng quan",
// "Quản lý", "Cửa hàng"). Giữ đủ 4 mục như quyết định Ngày 7/D10-1.
// onNavigate: đóng drawer mobile khi bấm một mục (desktop không cần).
const LINKS: Array<{
  href: string;
  label: string;
  section: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
}> = [
  {
    href: "/admin",
    label: "Tổng quan",
    section: "Tổng quan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/products",
    label: "Sản phẩm",
    section: "Quản lý",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
    match: (p) => p === "/admin/products" || p.startsWith("/admin/products/"),
  },
  {
    href: "/admin/orders",
    label: "Đơn hàng",
    section: "Quản lý",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </svg>
    ),
    match: (p) => p === "/admin/orders" || p.startsWith("/admin/orders/"),
  },
  {
    href: "/",
    label: "Xem shop ↗",
    section: "Cửa hàng",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
    ),
    match: () => false,
  },
];

const SECTIONS = ["Tổng quan", "Quản lý", "Cửa hàng"];

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Quản trị" className="mt-2 flex-1 px-3 py-2">
      {SECTIONS.map((section) => (
        <div key={section} className="mt-4 first:mt-0">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">
            {section}
          </p>
          <ul className="space-y-1">
            {LINKS.filter((link) => link.section === section).map((link) => {
              const active = link.match(pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex min-h-11 items-center gap-3 rounded-[3px] px-3 text-sm font-semibold transition-colors duration-150 ${
                      active
                        ? "bg-green-800 font-bold text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="shrink-0" aria-hidden="true">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
