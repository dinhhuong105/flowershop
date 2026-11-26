"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { telHref, zaloHref } from "@/config/site";
import type { ShopSettings } from "@/lib/settings";

type CategoryLink = {
  name: string;
  slug: string;
};

// Menu di động (mục 3.3 phụ lục): ngăn kéo trượt từ trái
// translateX(-100%→0) 300ms, nền mờ fade 200ms, các mục vào so le 40ms.
// Đóng bằng Esc, bấm nền mờ, bấm liên kết. Khóa cuộn nền; trả focus về
// nút mở. Chỉ hiện nút Gọi/Zalo khi có số thật trong Cài đặt shop
// (Ngày 11 B5) qua prop settings.
export default function MobileMenu({
  categories,
  settings,
}: {
  categories: CategoryLink[];
  settings: ShopSettings;
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

  const links = [{ name: "Trang chủ", slug: "" }, ...categories];

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="menu-di-dong"
        aria-label={open ? "Đóng menu" : "Mở menu"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-[3px] text-ink transition-colors duration-150 hover:bg-cream-100 hover:text-green-800"
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
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-green-900/50 transition-opacity duration-200 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />
      <div
        id="menu-di-dong"
        role="dialog"
        data-testid="mobile-menu"
        aria-label="Menu di động"
        aria-hidden={!open}
        // inert khi đóng: các link bên trong không focus được khi menu ẩn
        // (axe: aria-hidden-focus) và bàn phím không tab vào menu đã đóng.
        inert={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-[320px] max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-display text-lg font-semibold text-green-900">
            {settings.siteName}
          </span>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-[3px] text-ink transition-colors duration-150 hover:bg-cream-100"
          >
            ✕
          </button>
        </div>
        <nav aria-label="Menu di động" className="flex-1 overflow-y-auto px-4 py-3">
          <ul>
            {links.map((c, i) => (
              <li
                key={c.slug || "trang-chu"}
                style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                className={`transition-all duration-300 ${
                  open ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"
                }`}
              >
                <Link
                  href={c.slug ? `/${c.slug}` : "/"}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center border-b border-line py-2 font-medium text-ink transition-colors duration-150 hover:text-green-800"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          {settings.hotline || settings.zalo ? (
            <div className="flex flex-col gap-2 py-4">
              {settings.hotline ? (
                <a
                  href={telHref(settings.hotline)}
                  className="flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 font-semibold text-white transition-colors duration-150 hover:bg-green-700"
                >
                  Gọi {settings.hotline}
                </a>
              ) : null}
              {settings.zalo ? (
                <a
                  href={zaloHref(settings.zalo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center rounded-[3px] border border-green-800 font-semibold text-green-800 transition-colors duration-150 hover:bg-cream-100"
                >
                  Nhắn Zalo
                </a>
              ) : null}
            </div>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
