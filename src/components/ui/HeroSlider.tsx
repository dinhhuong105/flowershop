"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HeroSlide } from "@/config/home";

// Hero slider 3 slide (mục 3.3 phụ lục): tự chuyển mỗi 6000ms, dừng khi
// hover/focus/chạm và khi tab ẩn; mũi tên, chấm (chấm đang chọn giãn
// thành thanh 24px), phím ←/→, vuốt trên cảm ứng. Reduced motion: không
// tự chạy, chuyển tức thời (CSS). Một <h1> duy nhất, đổi nội dung theo
// slide đang hiện nên không có 3 thẻ h1 trùng nhau trong DOM.
export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const total = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback(
    (index: number) => setActive(((index % total) + total) % total),
    [total],
  );
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused || reducedMotion || total <= 1) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((a) => (a + 1) % total);
    }, 6000);
    const onVisibility = () => {
      if (document.hidden) window.clearInterval(id);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused, reducedMotion, total]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  };

  const onTouchStart = (event: React.TouchEvent) => {
    touchX.current = event.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const startX = touchX.current;
    touchX.current = null;
    setPaused(false);
    if (startX === null) return;
    const delta = event.changedTouches[0].clientX - startX;
    if (delta < -50) next();
    else if (delta > 50) prev();
  };

  const slide = slides[active];
  const arrowClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-green-900/40 text-white transition-all duration-150 hover:scale-[1.08] hover:bg-green-900/70 active:scale-[0.97]";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Hoa nổi bật"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="relative overflow-hidden bg-green-900 text-white"
    >
      {/* Hình hoa SVG cách điệu bên phải, crossfade + thu scale theo slide. */}
      {slides.map((s, i) => (
        <div
          key={s.primaryHref + s.title}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} / ${total}`}
          aria-hidden={i !== active}
          className={`hero-slide pointer-events-none absolute inset-0 ${i === active ? "is-active" : ""}`}
        >
          <Image
            src="/images/hero-flower.svg"
            alt=""
            width={520}
            height={520}
            priority={i === 0}
            unoptimized
            className="hero-slide-art absolute -right-10 top-1/2 hidden h-[130%] w-auto -translate-y-1/2 opacity-90 md:block"
          />
        </div>
      ))}

      <div className="shell relative flex min-h-[440px] items-center py-12 md:min-h-[520px]">
        <div key={active} className="hero-anim max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">
            {slide.eyebrow}
          </p>
          <h1 className="mt-3 text-white">
            {slide.title}{" "}
            <em className="text-gold-300">{slide.titleAccent}</em>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">{slide.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={slide.primaryHref}
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:-translate-y-px hover:shadow-lg active:scale-[0.97]"
            >
              {slide.primaryLabel}
            </Link>
            <Link
              href={slide.secondaryHref}
              className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-white/70 px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:border-white hover:bg-white/10 active:scale-[0.97]"
            >
              {slide.secondaryLabel} →
            </Link>
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Slide trước"
        onClick={prev}
        className={`${arrowClass} absolute left-3 top-1/2 hidden -translate-y-1/2 sm:flex`}
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Slide sau"
        onClick={next}
        className={`${arrowClass} absolute right-3 top-1/2 hidden -translate-y-1/2 sm:flex`}
      >
        ›
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Tới slide ${i + 1}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => goTo(i)}
            // Vùng chạm 44×44 (UI-19); chấm tròn trực quan vẫn 8px / 24px.
            className="group flex h-11 w-11 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`h-2 rounded-full transition-all duration-200 ${
                i === active ? "w-6 bg-gold-300" : "w-2 bg-white/50 group-hover:bg-white/80"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
