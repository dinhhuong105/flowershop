import Link from "next/link";
import { getNavCategories } from "@/lib/queries";
import { siteConfig, telHref, zaloHref } from "@/config/site";

export default async function Footer() {
  const categories = await getNavCategories();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 bg-ink text-white">
      <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold">{siteConfig.name}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            {siteConfig.description}
          </p>
        </div>
        <nav aria-label="Bộ sưu tập">
          <p className="font-semibold">Bộ sưu tập</p>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}`}
                  className="text-white/80 transition-colors hover:text-white hover:underline"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Chăm sóc khách hàng">
          <p className="font-semibold">Chăm sóc khách hàng</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/faq" className="text-white/80 transition-colors hover:text-white hover:underline">
                Câu hỏi thường gặp
              </Link>
            </li>
            <li>
              <Link href="/van-chuyen" className="text-white/80 transition-colors hover:text-white hover:underline">
                Vận chuyển
              </Link>
            </li>
            <li>
              <Link href="/doi-tra" className="text-white/80 transition-colors hover:text-white hover:underline">
                Đổi trả
              </Link>
            </li>
            <li>
              <Link href="/bao-mat" className="text-white/80 transition-colors hover:text-white hover:underline">
                Bảo mật
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="font-semibold">Liên hệ</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>{siteConfig.address}</li>
            <li>
              Hotline:{" "}
              <a href={telHref(siteConfig.hotline)} className="text-white hover:underline">
                {siteConfig.hotline}
              </a>
            </li>
            <li>
              Zalo:{" "}
              <a
                href={zaloHref(siteConfig.zaloPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline"
              >
                {siteConfig.zaloPhone}
              </a>
            </li>
            <li>{siteConfig.openHours}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto w-full max-w-[1200px] px-4 py-4 text-center text-sm text-white/70">
          © {year} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
