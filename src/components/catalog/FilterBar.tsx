import Link from "next/link";
import { priceRanges, tagLabels } from "@/config/catalog";
import { buildCatalogHref } from "@/lib/catalog-params";
import type { CatalogParams } from "@/lib/catalog-params";

// Hai nhóm chip lọc (dịp, khoảng giá). Nhóm sắp xếp đã chuyển thành form
// <select> ở gói UI-1 (xem SortForm); chip lọc giữ nguyên logic Ngày 3.
export default function FilterBar({
  slug,
  params,
  availableTags,
}: {
  slug: string;
  params: CatalogParams;
  availableTags: string[];
}) {
  const chipBase =
    "inline-flex min-h-11 shrink-0 items-center rounded-[3px] border px-4 text-sm font-medium transition-colors duration-150 active:scale-[0.97]";
  const chipIdle = "border-line bg-white text-ink hover:border-green-800 hover:text-green-800";
  const chipActive = "border-green-800 bg-green-800 font-semibold text-white";

  const shownTags = tagLabels.filter((t) => availableTags.includes(t.slug));

  return (
    <div className="mt-5 space-y-4">
      <div role="group" aria-label="Dịp">
        <p className="mb-2 text-sm font-semibold text-ink">Dịp</p>
        <div className="chip-scroll flex gap-2 overflow-x-auto pb-1">
          <Link
            href={buildCatalogHref(slug, params, { dip: null })}
            aria-current={params.dip === null ? "true" : undefined}
            className={`${chipBase} ${params.dip === null ? chipActive : chipIdle}`}
          >
            Tất cả
          </Link>
          {shownTags.map((t) => (
            <Link
              key={t.slug}
              href={buildCatalogHref(slug, params, { dip: t.slug })}
              aria-current={params.dip === t.slug ? "true" : undefined}
              className={`${chipBase} ${params.dip === t.slug ? chipActive : chipIdle}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <div role="group" aria-label="Khoảng giá">
        <p className="mb-2 text-sm font-semibold text-ink">Khoảng giá</p>
        <div className="chip-scroll flex gap-2 overflow-x-auto pb-1">
          <Link
            href={buildCatalogHref(slug, params, { gia: null })}
            aria-current={params.gia === null ? "true" : undefined}
            className={`${chipBase} ${params.gia === null ? chipActive : chipIdle}`}
          >
            Mọi mức giá
          </Link>
          {priceRanges.map((r) => (
            <Link
              key={r.slug}
              href={buildCatalogHref(slug, params, { gia: r.slug })}
              aria-current={params.gia === r.slug ? "true" : undefined}
              className={`${chipBase} ${params.gia === r.slug ? chipActive : chipIdle}`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
