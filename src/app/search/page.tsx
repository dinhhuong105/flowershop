import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getNavCategories } from "@/lib/queries";
import { searchNews, searchProducts, tokenizeSearchQuery } from "@/lib/search";
import {
  buildSearchHref,
  parseSearchParams,
  type SearchPageParams,
} from "@/lib/search-params";
import ProductGrid from "@/components/catalog/ProductGrid";
import SortForm from "@/components/catalog/SortForm";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const parsed = parseSearchParams(await searchParams);
  const q = parsed.q.trim();
  return {
    title: q === "" ? "Tìm kiếm" : `Tìm kiếm “${parsed.q}”`,
    description:
      q === ""
        ? "Tìm hoa, quà tặng, dịp đặc biệt."
        : `Kết quả tìm kiếm cho “${parsed.q}”.`,
    robots: { index: false, follow: true },
  };
}

// Phân trang trang tìm kiếm (cùng giao diện với Pagination của trang
// danh mục; liên kết giữ q và sx qua buildSearchHref).
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

function SearchPagination({
  params,
  totalPages,
}: {
  params: SearchPageParams;
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
          href={buildSearchHref(params, { trang: current - 1 })}
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
            href={buildSearchHref(params, { trang: p })}
            aria-label={`Trang ${p}`}
            className={linkClass}
          >
            {p}
          </Link>
        ),
      )}
      {current < totalPages ? (
        <Link
          href={buildSearchHref(params, { trang: current + 1 })}
          aria-label="Trang sau"
          className={linkClass}
        >
          Sau ›
        </Link>
      ) : null}
    </nav>
  );
}

// Liên kết tới các danh mục (dùng cho trạng thái rỗng và khi q rỗng).
// getNavCategories đã được layout gọi — React cache nên không thêm
// truy vấn nào.
async function CategoryLinks() {
  const categories = await getNavCategories();
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/${c.slug}`}
            className="inline-flex min-h-11 items-center rounded-[3px] border border-green-800 px-4 text-sm font-semibold text-green-800 transition-colors duration-150 hover:bg-cream-100"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const parsed = parseSearchParams(await searchParams);
  const words = tokenizeSearchQuery(parsed.q);

  // q rỗng hoặc chỉ khoảng trắng: trang 200 với ô tìm (trên header) và
  // liên kết danh mục — KHÔNG truy vấn DB cho tìm kiếm.
  if (words.length === 0) {
    return (
      <>
        <div className="shell pb-12 pt-6">
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Tìm kiếm</h1>
          <p className="mt-3 text-base text-ink-soft">
            Nhập từ khóa vào ô tìm kiếm phía trên — ví dụ “hoa hồng”, “khai trương” hay mã
            sản phẩm “HT-005”.
          </p>
          <p className="mt-6 font-semibold text-ink">Hoặc xem theo danh mục:</p>
          <CategoryLinks />
        </div>
        <UspStrip />
      </>
    );
  }

  const data = await searchProducts(parsed.q, { sort: parsed.sx, page: parsed.trang });
  // Tin tức (Ngày 18): tìm trong tiêu đề/tóm tắt/nội dung của bài
  // ĐÃ XUẤT BẢN; tối đa 5 bài, mới nhất trước. q ≤ 100 ký tự vẫn
  // giữ như tìm sản phẩm (tokenizeSearchQuery cắt ở 80 ký tự).
  const news = await searchNews(parsed.q);
  // trang lớn hơn tổng số trang thì 404; nếu rỗng (0 trang) chỉ trang=1 hợp lệ.
  if (data.totalPages === 0 ? parsed.trang !== 1 : parsed.trang > data.totalPages) {
    notFound();
  }
  const { products, total, totalPages } = data;

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Tìm kiếm “{parsed.q}”
        </h1>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p data-testid="result-count" data-total={total} className="text-base text-ink">
            {total === 0
              ? `Không tìm thấy sản phẩm phù hợp với “${parsed.q}”`
              : `Tìm thấy ${total} sản phẩm cho “${parsed.q}”`}
          </p>
          <SortForm dip={null} gia={null} sx={parsed.sx} q={parsed.q} />
        </div>
        {total === 0 ? (
          <div className="mt-6">
            <p className="text-base text-ink-soft">
              Kiểm tra lại chính tả, thử từ khóa ngắn hơn hoặc khác — ví dụ “hoa hồng”, “lan”,
              “khai trương”.
            </p>
            <p className="mt-6 font-semibold text-ink">Hoặc xem theo danh mục:</p>
            <CategoryLinks />
          </div>
        ) : (
          <div className="mt-6">
            <ProductGrid products={products} />
          </div>
        )}
        {/* Kết quả tin tức (Ngày 18): chỉ hiện khi có bài khớp; kể
            cả khi không có sản phẩm nào khớp. */}
        {news.length > 0 ? (
          <section aria-label="Tin tức" data-testid="search-news" className="mt-10">
            <h2 className="font-display text-2xl font-semibold text-ink">Tin tức</h2>
            <ul className="mt-4 space-y-4">
              {news.map((n) => (
                <li key={n.slug} className="rounded-[3px] border border-line bg-white p-4">
                  <Link
                    href={`/tin-tuc/${n.slug}`}
                    className="font-display text-lg font-semibold text-ink hover:text-green-800 hover:underline"
                  >
                    {n.title}
                  </Link>
                  {n.excerpt !== "" ? (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{n.excerpt}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <SearchPagination params={parsed} totalPages={totalPages} />
      </div>
      <UspStrip />
    </>
  );
}
