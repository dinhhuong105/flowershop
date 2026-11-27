import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listPublishedNews, newsDisplayDate } from "@/lib/admin/news";
import { formatVnDate } from "@/lib/vn-datetime";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức",
  description: "Tin tức, mẹo chăm hoa và câu chuyện từ shop Hoa Tươi.",
  alternates: { canonical: "/tin-tuc" },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Phân trang danh sách tin (cùng giao diện với Pagination của trang
// danh mục; liên kết giữ ?trang=). Component Pagination của danh mục
// gắn với buildCatalogHref nên không tái dùng trực tiếp ở đây —
// logic rút gọn trang (> 7 trang) giữ nguyên như bên đó.
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

function NewsPagination({ current, totalPages }: { current: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const linkClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] border border-line bg-white px-3 font-medium text-ink transition-colors duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.97]";
  const currentClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[3px] border border-green-800 bg-green-800 px-3 font-semibold text-white";
  const href = (p: number) => (p === 1 ? "/tin-tuc" : `/tin-tuc?trang=${p}`);
  return (
    <nav aria-label="Phân trang" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {current > 1 ? (
        <Link href={href(current - 1)} aria-label="Trang trước" className={linkClass}>
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
          <Link key={p} href={href(p)} aria-label={`Trang ${p}`} className={linkClass}>
            {p}
          </Link>
        ),
      )}
      {current < totalPages ? (
        <Link href={href(current + 1)} aria-label="Trang sau" className={linkClass}>
          Sau ›
        </Link>
      ) : null}
    </nav>
  );
}

export default async function NewsListPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawTrang = Array.isArray(params.trang) ? params.trang[0] : params.trang;
  let page = 1;
  if (rawTrang !== undefined && /^\d+$/.test(rawTrang)) {
    const n = Number(rawTrang);
    if (Number.isSafeInteger(n) && n >= 1) page = Math.min(n, 10000);
  }
  const data = await listPublishedNews(page);
  // Trang lớn hơn tổng số trang thì 404; nếu rỗng (0 bài) chỉ trang=1 hợp lệ.
  if (data.total === 0 ? page !== 1 : page > data.totalPages) {
    notFound();
  }

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Tin tức</h1>
        <p className="mt-3 text-base text-ink-soft">
          Mẹo chăm hoa, cách chọn hoa theo dịp và câu chuyện từ shop.
        </p>

        {data.total === 0 ? (
          <p className="mt-6 rounded-[3px] border border-line bg-white p-6 text-base text-ink-soft">
            Chưa có tin tức nào.
          </p>
        ) : (
          <>
            <p role="status" className="mt-6 text-base text-ink">
              Tìm thấy {data.total} bài
            </p>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.rows.map((a) => (
                <li
                  key={a.id}
                  data-testid="news-card"
                  className="overflow-hidden rounded-[3px] border border-line bg-white"
                >
                  <Link href={`/tin-tuc/${a.slug}`} aria-label={a.title}>
                    {a.coverImage !== "" ? (
                      <span className="relative block aspect-[16/9] w-full overflow-hidden bg-cream-100">
                        <Image
                          src={a.coverImage}
                          alt={a.title}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </span>
                    ) : null}
                  </Link>
                  <div className="p-4">
                    <p className="text-sm text-muted">
                      {formatVnDate(newsDisplayDate(a))}
                      {a.author !== "" ? ` · ${a.author}` : ""}
                    </p>
                    <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-ink">
                      <Link href={`/tin-tuc/${a.slug}`} className="hover:text-green-800 hover:underline">
                        {a.title}
                      </Link>
                    </h2>
                    {a.excerpt !== "" ? (
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a.excerpt}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <NewsPagination current={data.page} totalPages={data.totalPages} />
          </>
        )}
      </div>
      <UspStrip />
    </>
  );
}
