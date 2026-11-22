"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import type { NavCategory } from "@/lib/queries";
import MegaMenu from "@/components/layout/MegaMenu";
import MobileMenu from "@/components/layout/MobileMenu";

// Header (mục 4.2 phụ lục): sticky; hàng 1 thu gọn + đổ bóng khi cuộn.
// Hàng 1: logo (icon tia nắng/lá sen vàng tự vẽ + tên Playfair + tagline)
// + khoảng trống chừa cho ô tìm kiếm (Ngày 6) + Giỏ hàng (icon + nhãn,
// chưa có số cho tới Ngày 4 nên KHÔNG hiện badge số 0 giả). Không render
// ô tìm kiếm, "Tài khoản", "Yêu thích". Hàng 2 (≥1024px): nút "Danh mục
// sản phẩm ▾" + "Trang chủ" + từng danh mục từ DB; chưa hiện "Giới thiệu" /
// "Liên hệ" (chưa có trang, Ngày 9 mới hiện), không hiện "Blog - Cẩm Nang".
function LogoMark() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-gold-500"
    >
      <circle cx="24" cy="24" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M24 4v7M24 37v7M4 24h7M37 24h7" />
        <path d="M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" />
      </g>
      <path
        d="M14 34c3 3 7 4.5 10 4.5S31 37 34 34c-3 1.5-6.5 2-10 2s-7-.5-10-2Z"
        fill="#0d6532"
      />
    </svg>
  );
}

export default function Header({
  categories,
  cartCount,
}: {
  categories: NavCategory[];
  cartCount: number;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Hiệu ứng bump (mục 4.4): khi cartCount TĂNG, biểu tượng giỏ scale
  // 1 → 1.25 → 1 trong 400ms (lớp animate-pop có sẵn) và huy hiệu pop.
  const prevCount = useRef(cartCount);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const id = window.setTimeout(() => setBump(false), 400);
      prevCount.current = cartCount;
      return () => window.clearTimeout(id);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLink = (href: string, label: string) => {
    const isActive = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`nav-underline flex min-h-11 items-center px-3 text-[15px] font-medium transition-colors duration-150 hover:text-green-800 ${
          isActive ? "is-active font-semibold text-green-800" : "text-ink"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-[0_4px_16px_rgba(8,56,42,0.10)]" : ""
      }`}
    >
      {/* Hàng 1: logo + (chỗ chừa cho tìm kiếm) + giỏ hàng. */}
      <div
        className={`shell flex items-center gap-3 transition-all duration-200 ${
          scrolled ? "py-1.5" : "py-3"
        }`}
      >
        {/* Không aria-label: tên truy cập = đúng chữ hiển thị
            ("Hoa Tươi Demo" + tagline), tránh axe label-content-name-mismatch. */}
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="leading-none">
            <span className="block font-display text-[22px] font-semibold tracking-tight text-green-900 sm:text-2xl">
              {siteConfig.name}
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-gold-text">
              {siteConfig.tagline}
            </span>
          </span>
        </Link>
        {/* Khoảng trống chừa cho ô tìm kiếm (Ngày 6) — giữ vị trí logo/giỏ. */}
        <div aria-hidden="true" className="hidden flex-1 lg:block" />
        <div className="ml-auto flex items-center gap-1 sm:gap-2 lg:ml-0">
          <Link
            href="/gio-hang"
            aria-label={cartCount > 0 ? `Giỏ hàng, ${cartCount} sản phẩm` : "Giỏ hàng"}
            className="relative flex min-h-11 items-center gap-2 rounded-[3px] px-2 text-ink transition-colors duration-150 hover:bg-cream-100 hover:text-green-800"
          >
            <span className={bump ? "animate-pop inline-flex" : "inline-flex"}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 7h12l1.2 13.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 7Z" />
                <path d="M9 10V6a3 3 0 0 1 6 0v4" />
              </svg>
            </span>
            <span className="hidden text-sm font-semibold sm:inline">Giỏ hàng</span>
            {cartCount > 0 ? (
              <span
                data-testid="cart-count"
                className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white ${
                  bump ? "animate-pop" : ""
                }`}
              >
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Link>
          <MobileMenu categories={categories} />
        </div>
      </div>
      {/* Hàng 2: menu chính (desktop ≥1024px). */}
      <div className="hidden border-t border-line lg:block">
        <nav aria-label="Danh mục chính" className="shell flex items-center gap-1 py-1.5">
          <MegaMenu categories={categories} />
          {navLink("/", "Trang chủ")}
          {categories.map((c) => navLink(`/${c.slug}`, c.name))}
        </nav>
      </div>
    </header>
  );
}
