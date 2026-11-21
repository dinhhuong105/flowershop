import Link from "next/link";
import type { HomeCategory } from "@/lib/queries";

export default function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <h2 className="text-2xl font-bold text-ink">Danh mục</h2>
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/${c.slug}`}
            data-testid="category-card"
            className="block rounded-2xl border border-line bg-card p-5 transition-shadow hover:shadow-lg"
          >
            <span className="block text-lg font-semibold text-ink">{c.name}</span>
            <span className="mt-1 block text-sm text-muted">{c.productCount} sản phẩm</span>
            <span className="mt-3 block text-sm font-medium text-brand">Xem ngay →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
