import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import Reveal from "@/components/ui/Reveal";
import { categoryDescriptions } from "@/config/home";
import type { HomeCategorySection } from "@/lib/queries";

// Một khối danh mục trên trang chủ (mục 5.1 phụ lục): icon + tên Playfair
// + mô tả ngắn + "Xem tất cả →" tới /<slug>; lưới tối đa 4 sản phẩm đầu
// theo sortOrder. Danh mục không có sản phẩm thì trang chủ không render
// khối này (lọc ở page.tsx).
export default function CategorySection({
  category,
  products,
}: {
  category: HomeCategorySection;
  products: HomeCategorySection["products"];
}) {
  return (
    <section className="shell py-10" data-testid="category-block">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl text-ink sm:text-3xl">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="shrink-0 text-gold-500"
              >
                <circle cx="12" cy="8" r="3.5" />
                <circle cx="12" cy="16" r="3.5" />
                <circle cx="8" cy="12" r="3.5" />
                <circle cx="16" cy="12" r="3.5" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
              </svg>
              {category.name}
            </h2>
            <p className="mt-1 text-ink-soft">
              {categoryDescriptions[category.slug] ??
                `${category.name} tươi đẹp, giao tận nơi trong ngày.`}
            </p>
          </div>
          <Link
            href={`/${category.slug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-green-800 px-5 text-sm font-bold uppercase tracking-wide text-green-800 transition-all duration-150 hover:bg-green-800 hover:text-white active:scale-[0.97]"
          >
            Xem tất cả →
          </Link>
        </div>
      </Reveal>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p, i) => (
          <Reveal key={p.id} index={i} className="h-full">
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
