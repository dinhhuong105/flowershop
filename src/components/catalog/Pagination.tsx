import Link from "next/link";
import { buildCatalogHref } from "@/lib/catalog-params";
import type { CatalogParams } from "@/lib/catalog-params";

// Rút gọn khi totalPages > 7: luôn hiện trang đầu, trang cuối và trang
// hiện tại ±1, các khoảng còn lại thành dấu "…".
function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

export default function Pagination({
  slug,
  params,
  totalPages,
}: {
  slug: string;
  params: CatalogParams;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const current = params.trang;
  const linkClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] border border-line bg-white px-3 font-medium text-ink transition-colors duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.97]";
  const currentClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] border border-green-800 bg-green-800 px-3 font-semibold text-white";
  return (
    <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {current > 1 ? (
        <Link
          href={buildCatalogHref(slug, params, { trang: current - 1 })}
          aria-label="Trang trước"
          className={linkClass}
        >
          ‹ Trước
        </Link>
      ) : null}
      {pageNumbers(current, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
            …
          </span>
        ) : p === current ? (
          <span key={p} aria-current="page" className={currentClass}>
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildCatalogHref(slug, params, { trang: p })}
            aria-label={`Trang ${p}`}
            className={linkClass}
          >
            {p}
          </Link>
        ),
      )}
      {current < totalPages ? (
        <Link
          href={buildCatalogHref(slug, params, { trang: current + 1 })}
          aria-label="Trang sau"
          className={linkClass}
        >
          Sau ›
        </Link>
      ) : null}
    </nav>
  );
}
