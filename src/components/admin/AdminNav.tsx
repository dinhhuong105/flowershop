"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Menu dọc trong sidebar xanh navy (thiết kế lại admin lần 2,
// 25/11 — đúng màu/style ảnh mẫu của Henry: sidebar #0f1e33,
// mục đang mở nền xanh dương #2563eb bo tròn, chữ mục thường
// xám nhạt, nhãn nhóm chữ nhỏ in hoa xám). Nhóm theo ảnh mẫu
// ("Bảng điều khiển", "Quản lý nội dung", "Giao dịch",
// "Người dùng", "Cấu hình", "Cửa hàng").
// Mục "Sắp có": chưa làm nên hiển thị mờ + huy hiệu "Sắp có",
// KHÔNG bấm được — dùng <span aria-disabled>, KHÔNG dùng thẻ
// <a> (không link chết). onNavigate: đóng drawer mobile khi bấm
// một mục (desktop không cần).

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function Icon({ children }: { children: React.ReactNode }) {
  return <svg {...ICON_PROPS}>{children}</svg>;
}

const ICON_GRID = (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Icon>
);
const ICON_BOX = (
  <Icon>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </Icon>
);
const ICON_TAG = (
  <Icon>
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </Icon>
);
const ICON_NEWSPAPER = (
  <Icon>
    <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9" />
    <path d="M18 14h-8" />
    <path d="M15 18h-5" />
    <path d="M10 6h8" />
  </Icon>
);
const ICON_FILE = (
  <Icon>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </Icon>
);
const ICON_CLIPBOARD = (
  <Icon>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </Icon>
);
const ICON_MAIL = (
  <Icon>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </Icon>
);
const ICON_USERS = (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
const ICON_MESSAGE = (
  <Icon>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </Icon>
);
const ICON_USER = (
  <Icon>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);
const ICON_SHIELD = (
  <Icon>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </Icon>
);
const ICON_SETTINGS = (
  <Icon>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const ICON_CLOCK = (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
);
const ICON_EXTERNAL = (
  <Icon>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Icon>
);

type NavItem = {
  label: string;
  section: string;
  icon: React.ReactNode;
  href?: string;
  match?: (pathname: string) => boolean;
  soon?: boolean;
  // Nhóm con (Ngày 11 B3, Ngày 14 B2): mục cha là nút mở/đóng,
  // các mục con là link thật. Nhóm tự mở khi đang ở một mục con.
  collapsible?: boolean;
  children?: Array<{ label: string; href: string; match: (pathname: string) => boolean }>;
};

const ITEMS: NavItem[] = [
  { label: "Tổng quan", section: "dashboard", icon: ICON_GRID, href: "/admin", match: (p) => p === "/admin" },
  { label: "Sản phẩm", section: "content", icon: ICON_BOX, href: "/admin/products", match: (p) => p === "/admin/products" || p.startsWith("/admin/products/") },
  { label: "Danh mục", section: "content", icon: ICON_TAG, href: "/admin/categories", match: (p) => p === "/admin/categories" || p.startsWith("/admin/categories/") },
  { label: "Bài viết / Tin tức", section: "content", icon: ICON_NEWSPAPER, soon: true },
  { label: "Trang tĩnh", section: "content", icon: ICON_FILE, href: "/admin/pages", match: (p) => p === "/admin/pages" || p.startsWith("/admin/pages/") },
  { label: "Đơn hàng", section: "sales", icon: ICON_CLIPBOARD, href: "/admin/orders", match: (p) => p === "/admin/orders" || p.startsWith("/admin/orders/") },
  { label: "Yêu cầu liên hệ", section: "sales", icon: ICON_MAIL, soon: true },
  { label: "Khách hàng", section: "sales", icon: ICON_USERS, soon: true },
  { label: "Tin nhắn", section: "sales", icon: ICON_MESSAGE, soon: true },
  { label: "Tài khoản quản trị", section: "users", icon: ICON_USER, soon: true },
  { label: "Vai trò & phân quyền", section: "users", icon: ICON_SHIELD, soon: true },
  // Nhóm "Cài đặt" (Ngày 14 B2): một mục mở/đóng chứa 6 mục con —
  // Chung, Liên hệ, SEO, Khu vực & phí giao hàng, Ngân hàng & QR,
  // Telegram. URL các trang con KHÔNG đổi nên không cần chuyển hướng.
  // Nhóm tự mở khi đang ở một trang con; nút mở/đóng có
  // aria-expanded, bấm được bằng Enter/Space (button gốc).
  {
    label: "Cài đặt",
    section: "config",
    icon: ICON_SETTINGS,
    match: (p) =>
      p === "/admin/settings/general" ||
      p === "/admin/settings/contact" ||
      p === "/admin/settings/seo" ||
      p === "/admin/shipping-zones" ||
      p.startsWith("/admin/shipping-zones/") ||
      p === "/admin/settings/bank" ||
      p === "/admin/settings/telegram",
    collapsible: true,
    children: [
      { label: "Chung", href: "/admin/settings/general", match: (p) => p === "/admin/settings/general" },
      { label: "Liên hệ", href: "/admin/settings/contact", match: (p) => p === "/admin/settings/contact" },
      { label: "SEO", href: "/admin/settings/seo", match: (p) => p === "/admin/settings/seo" },
      { label: "Khu vực & phí giao hàng", href: "/admin/shipping-zones", match: (p) => p === "/admin/shipping-zones" || p.startsWith("/admin/shipping-zones/") },
      { label: "Ngân hàng & QR", href: "/admin/settings/bank", match: (p) => p === "/admin/settings/bank" },
      { label: "Telegram", href: "/admin/settings/telegram", match: (p) => p === "/admin/settings/telegram" },
    ],
  },
  { label: "Nhật ký hoạt động", section: "config", icon: ICON_CLOCK, soon: true },
  { label: "Xem shop ↗", section: "shop", icon: ICON_EXTERNAL, href: "/", match: () => false },
];

const SECTIONS: Array<{ key: string; label: string | null }> = [
  { key: "dashboard", label: null },
  { key: "content", label: "Quản lý nội dung" },
  { key: "sales", label: "Giao dịch" },
  { key: "users", label: "Người dùng" },
  { key: "config", label: "Cấu hình" },
  { key: "shop", label: "Cửa hàng" },
];

// Nhóm mục con có nút mở/đóng (Ngày 14 B2): nút có aria-expanded,
// bấm được bằng Enter/Space (button gốc). Nhóm tự mở khi đang ở
// một mục con — lúc đó nút luôn hiện mở (không đóng được để mục
// đang mở không biến mất khỏi menu, A4 Ngày 13 vẫn cuộn được tới
// mục đang mở).
function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groupActive = item.match ? item.match(pathname) : false;
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = groupActive || manuallyOpen;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setManuallyOpen((v) => !v)}
        className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold ${
          groupActive ? "text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="shrink-0" aria-hidden="true">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 text-left leading-snug">{item.label}</span>
        <span aria-hidden="true" className="shrink-0 text-xs">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <ul className="space-y-1">
          {item.children!.map((child) => {
            const childActive = child.match(pathname);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={childActive ? "page" : undefined}
                  onClick={onNavigate}
                  className={`flex min-h-11 items-center gap-3 rounded-lg py-2 pl-11 pr-3 text-sm font-semibold transition-colors duration-150 ${
                    childActive
                      ? "bg-[#2563eb] font-bold text-white"
                      : "text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export default function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);

  // A4 (Ngày 13): mục đang mở phải nằm trong vùng nhìn của menu
  // (trước đây mục cuối nhóm như "Ngân hàng & QR" bị nút Đăng xuất
  // che một phần ở viewport 900 px). Cuộn trong khung nav
  // (block: "nearest" — chỉ cuộn đủ để thấy mục, không cuộn cả trang).
  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <nav ref={navRef} aria-label="Quản trị" className="admin-nav-scroll mt-2 flex-1 overflow-y-auto px-3 py-2">
      {SECTIONS.map((section) => (
        <div key={section.key} className="mt-4 first:mt-0">
          {section.label ? (
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
              {section.label}
            </p>
          ) : null}
          <ul className="space-y-1">
            {ITEMS.filter((item) => item.section === section.key).map((item) => {
              if (item.children) {
                return (
                  <NavGroup
                    key={item.label}
                    item={item}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                );
              }
              if (item.soon || !item.href) {
                return (
                  <li key={item.label}>
                    <span
                      aria-disabled="true"
                      title={item.label}
                      className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-semibold text-slate-500"
                    >
                      <span className="shrink-0" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="min-w-0 leading-snug">{item.label}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                        Sắp có
                      </span>
                    </span>
                  </li>
                );
              }
              const active = item.match ? item.match(pathname) : false;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors duration-150 ${
                      active
                        ? "bg-[#2563eb] font-bold text-white"
                        : "text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
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
