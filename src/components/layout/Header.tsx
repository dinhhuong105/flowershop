import Link from "next/link";
import { getNavCategories } from "@/lib/queries";
import { siteConfig, zaloHref } from "@/config/site";
import MobileMenu from "@/components/layout/MobileMenu";

export default async function Header() {
  const categories = await getNavCategories();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card">
      <div className="relative mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex min-h-11 items-center text-xl font-bold tracking-tight text-brand"
        >
          {siteConfig.name}
        </Link>
        <nav aria-label="Danh mục chính" className="hidden items-center md:flex">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="flex min-h-11 items-center px-3 font-medium text-ink transition-colors hover:text-brand"
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={zaloHref(siteConfig.zaloPhone)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center rounded-full bg-brand px-4 font-semibold text-white transition-colors hover:bg-brand-hover md:inline-flex"
          >
            Tư vấn Zalo
          </a>
          <Link
            href="/gio-hang"
            aria-label="Giỏ hàng"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-cream hover:text-brand"
          >
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
          </Link>
          <MobileMenu categories={categories} />
        </div>
      </div>
    </header>
  );
}
