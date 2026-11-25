"use client";

import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/admin-auth";
import AdminNav from "@/components/admin/AdminNav";

// Khung admin kiểu ảnh mẫu của Henry (thiết kế lại admin 25/11):
// sidebar trái màu xanh đậm (token green-900 của shop) + thanh trên
// có ô tìm kiếm + tên quản trị + Đăng xuất. Trên mobile (< lg)
// sidebar thành drawer trượt từ trái (mẫu MobileMenu của shop:
// translateX 300 ms, nền mờ fade 200 ms, đóng bằng Esc / bấm nền mờ
// / bấm liên kết, khóa cuộn nền, trả focus về nút mở).
//
// Ô tìm kiếm trên thanh trên là tìm kiếm THẬT (không phải trang
// trí): gửi GET tới /admin/orders với tab=all, dùng đúng logic tìm
// theo mã đơn/tên/SĐT sẵn có của trang đơn hàng. Ẩn dưới sm (ô tìm
// kiếm riêng của trang đơn vẫn dùng được).
// Trang in phiếu (print): sidebar + topbar + drawer đều ẩn
// (print:hidden; topbar là <header> nên CSS @media print của trang
// in vốn đã ẩn <header>); <main id="noi-dung-chinh"> giữ nguyên để
// rule làm trắng nền kem của trang in vẫn trúng.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      button?.focus();
    };
  }, [open ]);

  const sidebarBody = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] bg-gold-300 font-display text-lg font-bold text-green-900"
        >
          H
        </span>
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-semibold leading-tight text-white">
            Hoa Tươi Demo
          </span>
          <span className="mt-0.5 inline-flex items-center rounded-full bg-gold-300 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-900">
            Quản trị
          </span>
        </span>
      </div>
      <AdminNav onNavigate={() => setOpen(false)} />
      <div className="shrink-0 p-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center rounded-[3px] border border-white/20 px-4 text-sm font-bold text-white/80 transition-colors duration-150 hover:border-white/40 hover:text-white"
          >
            Đăng xuất
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh bg-cream-50 text-ink lg:flex">
      {/* Sidebar desktop: dính đầu trang, cao đúng màn hình. */}
      <aside
        aria-label="Menu quản trị"
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-green-900 lg:flex print:hidden"
      >
        {sidebarBody}
      </aside>

      {/* Nền mờ của drawer mobile. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-green-900/50 transition-opacity duration-200 lg:hidden print:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />
      {/* Drawer mobile. */}
      <aside
        aria-label="Menu quản trị"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-green-900 shadow-xl transition-transform duration-300 ease-out lg:hidden print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarBody}
      </aside>

      {/* Cột nội dung. */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6 print:hidden">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-label={open ? "Đóng menu" : "Mở menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] text-ink transition-colors duration-150 hover:bg-cream-100 hover:text-green-800 lg:hidden"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <form
            method="get"
            action="/admin/orders"
            role="search"
            className="hidden min-w-0 max-w-xl flex-1 sm:block"
          >
            <input type="hidden" name="tab" value="all" />
            <label htmlFor="admin-top-search" className="sr-only">
              Tìm đơn hàng theo mã đơn, tên, SĐT
            </label>
            <input
              id="admin-top-search"
              name="q"
              type="search"
              placeholder="Tìm mã đơn, tên, SĐT…"
              className="block h-11 w-full rounded-[3px] border border-line bg-cream-50 px-4 text-sm text-ink placeholder:text-muted"
            />
          </form>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
            <span className="hidden min-w-0 text-right sm:block">
              <span className="block truncate text-sm font-bold text-ink">Quản trị viên</span>
              <span className="block text-xs text-muted">admin</span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-800 text-sm font-bold text-white"
            >
              Q
            </span>
            <form action={logoutAction} className="shrink-0 lg:hidden">
              <button
                type="submit"
                className="flex min-h-11 items-center rounded-[3px] border border-line bg-white px-3 text-sm font-bold text-ink transition-colors hover:border-green-800 hover:text-green-800"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </header>
        <main id="noi-dung-chinh" className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
