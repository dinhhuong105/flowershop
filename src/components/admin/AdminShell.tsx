"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/admin-auth";
import AdminNav from "@/components/admin/AdminNav";

// Khung admin kiểu ảnh mẫu của Henry (thiết kế lại admin lần 2,
// 25/11 — ĐÚNG màu/style ảnh mẫu, chỉ trang admin; mặt shop bán
// hàng giữ nguyên xanh lá/vàng):
// - Sidebar trái xanh navy đậm #0f1e33, logo ô xanh dương #2563eb
//   + huy hiệu "Admin", mục đang mở nền #2563eb bo tròn.
// - Nền trang xám nhạt #f1f5f9 (slate-100), chữ navy #0f172a,
//   font sans mặc định (KHÔNG dùng font serif Playfair trong admin).
// - Thanh trên trắng: ô tìm kiếm (nền xám nhạt, bo tròn), chuông
//   báo THẬT (số = đơn cần xử lý, bấm ra /admin/orders?tab=pending
//   — tab mặc định của trang đơn, cùng link thẻ "Đơn cần xử lý"),
//   tên quản trị + avatar tròn xanh dương.
// Trên mobile (< lg) sidebar thành drawer trượt từ trái (mẫu
// MobileMenu của shop: translateX 300 ms, nền mờ fade 200 ms,
// đóng bằng Esc / bấm nền mờ / bấm liên kết, khóa cuộn nền, trả
// focus về nút mở). Ô tìm kiếm hiện cả trên mobile: thành hàng
// thứ hai của thanh trên (order-3, w-full dưới sm).
//
// Ô tìm kiếm trên thanh trên là tìm kiếm THẬT (không phải trang
// trí): gửi GET tới /admin/orders với tab=all, dùng đúng logic tìm
// theo mã đơn/tên/SĐT sẵn có của trang đơn hàng.
// Trang in phiếu (print): sidebar + topbar + drawer đều ẩn
// (print:hidden; topbar là <header> nên CSS @media print của trang
// in vốn đã ẩn <header>); <main id="noi-dung-chinh"> giữ nguyên để
// rule làm trắng nền kem của trang in vẫn trúng.
export default function AdminShell({
  children,
  pendingCount,
  modal,
}: {
  children: React.ReactNode;
  pendingCount: number;
  // Slot popup (intercepting route @modal, 25/11): render trong
  // .admin-shell để giữ font sans, nhưng ngoài <main> để không
  // dính hiệu ứng vào trang của nội dung chính.
  modal?: React.ReactNode;
}) {
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-lg font-bold text-white"
        >
          H
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold leading-tight text-white">
            Hoa Tươi Demo
          </span>
          <span className="mt-0.5 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-300">
            Admin
          </span>
        </span>
      </div>
      <AdminNav onNavigate={() => setOpen(false)} />
      <div className="shrink-0 p-4">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center justify-center rounded-lg border border-white/20 px-4 text-sm font-bold text-slate-300 transition-colors duration-150 hover:border-white/40 hover:text-white"
          >
            Đăng xuất
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="admin-shell min-h-dvh bg-slate-100 text-slate-900 lg:flex">
      {/* Sidebar desktop: dính đầu trang, cao đúng màn hình. */}
      <aside
        aria-label="Menu quản trị"
        className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col bg-[#0f1e33] lg:flex print:hidden"
      >
        {sidebarBody}
      </aside>

      {/* Nền mờ của drawer mobile. */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-[#0f1e33]/50 transition-opacity duration-200 lg:hidden print:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />
      {/* Drawer mobile. */}
      <aside
        aria-label="Menu quản trị"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-[#0f1e33] shadow-xl transition-transform duration-300 ease-out lg:hidden print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarBody}
      </aside>

      {/* Cột nội dung. */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-2 sm:px-6 print:hidden">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-label={open ? "Đóng menu" : "Mở menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-slate-900 transition-colors duration-150 hover:bg-slate-100 lg:hidden"
          >
            <svg
              width="18"
              height="18"
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
            className="order-3 w-full min-w-0 sm:order-none sm:w-auto sm:max-w-xl sm:flex-1"
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
              className="block h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </form>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
            {/* Chuông báo THẬT: số = đơn cần xử lý (NEW + CONFIRMED
                + DELIVERING, lấy từ hàm dashboard sẵn có, layout
                truyền xuống); bấm ra danh sách đơn cần xử lý. */}
            <Link
              href="/admin/orders?tab=pending"
              aria-label={
                pendingCount > 0
                  ? `Có ${pendingCount} đơn cần xử lý — xem danh sách`
                  : "Không có đơn nào cần xử lý — xem danh sách"
              }
              className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {pendingCount > 0 ? (
                <span
                  data-testid="admin-bell-count"
                  // ĐỢT 4 — 25/11: badge lệch ra ngoài góc trên-phải
                  // (-top-1 -right-1) và nhỏ lại (16 px). Trước đây
                  // badge 20 px đặt trong góc (right-0.5 top-0.5)
                  // che 79% chuông (đo bằng CDP ở 1440 px và 390 px:
                  // giao nhau 256/324 px²) — Claude nhận xét đúng.
                  // Sau sửa, giao nhau còn ~11%, chuông nhìn rõ.
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
            <span className="hidden min-w-0 text-right sm:block">
              <span className="block truncate text-sm font-bold text-slate-900">Quản trị viên</span>
              <span className="block text-xs text-slate-500">admin</span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
            >
              Q
            </span>
            <form action={logoutAction} className="shrink-0 lg:hidden">
              <button
                type="submit"
                className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-600"
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
      {modal}
    </div>
  );
}
