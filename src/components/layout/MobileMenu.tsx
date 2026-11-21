"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { siteConfig, telHref, zaloHref } from "@/config/site";

type CategoryLink = {
  name: string;
  slug: string;
};

export default function MobileMenu({ categories }: { categories: CategoryLink[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-di-dong"
        aria-label={open ? "Đóng menu" : "Mở menu"}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-cream hover:text-brand"
      >
        {open ? (
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
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
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
        )}
      </button>
      {open ? (
        <div
          id="menu-di-dong"
          className="absolute inset-x-0 top-full border-b border-line bg-card shadow-lg"
        >
          <nav aria-label="Menu di động" className="mx-auto max-w-[1200px] px-4 py-3">
            <ul>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center border-b border-line py-2 font-medium text-ink transition-colors hover:text-brand"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 py-3">
              <a
                href={telHref(siteConfig.hotline)}
                className="flex min-h-11 items-center justify-center rounded-full bg-brand font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Gọi {siteConfig.hotline}
              </a>
              <a
                href={zaloHref(siteConfig.zaloPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center rounded-full border border-brand font-semibold text-brand transition-colors hover:bg-cream"
              >
                Nhắn Zalo
              </a>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
