import Link from "next/link";
import { siteConfig, zaloHref } from "@/config/site";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-[#fbe4ea] to-[#fffaf7]">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-12 text-center sm:py-16">
        <h1 className="mx-auto max-w-3xl text-3xl font-bold leading-tight text-ink sm:text-4xl lg:text-5xl">
          Gửi yêu thương bằng những đóa hoa tươi
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          Hoa tươi, lan hồ điệp và giỏ quà trái cây — chọn hoa mỗi ngày, giao
          tận nơi trong ngày.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/hoa-tuoi"
            className="flex min-h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Xem hoa tươi
          </Link>
          <a
            href={zaloHref(siteConfig.zaloPhone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-full border border-brand bg-card px-6 font-semibold text-brand transition-colors hover:bg-cream"
          >
            Tư vấn qua Zalo
          </a>
        </div>
      </div>
    </section>
  );
}
