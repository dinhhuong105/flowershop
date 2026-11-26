import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { PAGE_SIZE } from "@/config/catalog";
import { getCategoryPage } from "@/lib/catalog";
import { hasActiveFilter, parseCatalogParams } from "@/lib/catalog-params";
import { CATEGORY_DESCRIPTIONS } from "@/lib/category-descriptions";
import { getPublishedPageBySlug } from "@/lib/admin/pages";
import { getSettings } from "@/lib/settings-cache";
import { renderMarkdown } from "@/lib/markdown";
import Breadcrumb from "@/components/catalog/Breadcrumb";
import FilterBar from "@/components/catalog/FilterBar";
import ProductGrid from "@/components/catalog/ProductGrid";
import Pagination from "@/components/catalog/Pagination";
import EmptyState from "@/components/catalog/EmptyState";
import SortForm from "@/components/catalog/SortForm";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  // Trang tĩnh ở slug gốc (Ngày 14, lệnh Henry 26/11: bỏ /trang):
  // slug trùng trang tĩnh ĐÃ XUẤT BẢN thì trả metadata của trang đó
  // (không tạo route /[slug] riêng — Next cấm hai đoạn động cùng cấp).
  // Trang nháp/không có thì đi tiếp sang danh mục như trước.
  const page = await getPublishedPageBySlug(slug);
  if (page) {
    const settings = await getSettings();
    return {
      title: page.seoTitle !== "" ? page.seoTitle : page.title,
      description:
        page.seoDescription !== "" ? page.seoDescription : settings.defaultDescription,
      alternates: { canonical: `/${slug}` },
    };
  }
  const parsed = parseCatalogParams(await searchParams);
  const data = await getCategoryPage(slug, parsed);
  // notFound() ở đây để HTTP trả đúng 404. LƯU Ý (Ngày 4): Next 15.5.29
  // + `loading.tsx` trong cây route làm notFound() chỉ render giao diện
  // 404 với HTTP 200 (đã đo: chỉ cần MỘT loading.tsx là mọi notFound()
  // trong cây đó đều trả 200). Vì vậy đã GỠ src/app/loading.tsx và
  // src/app/[category]/loading.tsx; trang chi tiết giữ skeleton nhờ
  // layout [product]/layout.tsx kiểm tra sản phẩm trước (xem file đó).
  if (!data) notFound();
  if (data.totalPages === 0 ? parsed.trang !== 1 : parsed.trang > data.totalPages) {
    notFound();
  }
  const { category } = data;
  const canonical =
    parsed.trang > 1 && !hasActiveFilter(parsed) ? `/${slug}?trang=${parsed.trang}` : `/${slug}`;
  // SEO riêng (Ngày 14 D2): có seoTitle/seoDescription thì dùng,
  // không thì như hiện nay. Chỉ thêm openGraph khi có SEO riêng —
  // không thì <head> phải y hệt baseline (og:title mặc định của
  // layout, không tự ghi đè).
  const defaultDescription =
    CATEGORY_DESCRIPTIONS[slug] ??
    `Mua ${category.name.toLowerCase()} tươi đẹp, giao tận nơi trong ngày.`;
  const hasSeo = category.seoTitle !== "" || category.seoDescription !== "";
  const title = category.seoTitle !== "" ? category.seoTitle : category.name;
  const description =
    category.seoDescription !== "" ? category.seoDescription : defaultDescription;
  return {
    title,
    description,
    alternates: { canonical },
    ...(hasActiveFilter(parsed) ? { robots: { index: false, follow: true } } : {}),
    ...(hasSeo
      ? {
          openGraph: {
            title: `${title} | ${(await getSettings()).siteName}`,
            description,
            type: "website",
            locale: "vi_VN",
          },
        }
      : {}),
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params;
  // Trang tĩnh ở slug gốc (Ngày 14, lệnh Henry 26/11: bỏ /trang):
  // kiểm tra trang đã xuất bản TRƯỚC danh mục. Slug trang không
  // được trùng slug danh mục (findSlugClash chặn lúc lưu) nên hai
  // nhánh không bao giờ tranh nhau.
  const page = await getPublishedPageBySlug(slug);
  if (page) {
    return (
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {page.title}
        </h1>
        <div
          className="mt-6 max-w-3xl text-sm leading-relaxed text-ink-soft sm:text-base [&_a]:font-bold [&_a]:text-green-800 [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:font-semibold [&_h4]:text-ink [&_ol]:mt-3 [&_ol_li]:list-decimal [&_ol_li]:ml-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul_li]:list-disc [&_ul_li]:ml-5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
        />
      </div>
    );
  }
  const parsed = parseCatalogParams(await searchParams);
  const data = await getCategoryPage(slug, parsed);
  if (!data) notFound();
  // trang lớn hơn tổng số trang thì 404; nếu rỗng (0 trang) chỉ trang=1 hợp lệ.
  if (data.totalPages === 0 ? parsed.trang !== 1 : parsed.trang > data.totalPages) {
    notFound();
  }
  const { category, products, total, totalPages, availableTags } = data;
  const from = total === 0 ? 0 : (parsed.trang - 1) * PAGE_SIZE + 1;
  const to = Math.min(parsed.trang * PAGE_SIZE, total);

  return (
    <>
      {/* Banner danh mục (mục 5.2 phụ lục): nền xanh đậm ~160px, breadcrumb
          + tiêu đề Playfair trắng + mô tả ngắn; họa tiết lá vàng SVG bên
          trái, hình hoa cách điệu bên phải. */}
      <section className="relative overflow-hidden bg-green-900 text-white" data-testid="category-banner">
        <svg
          width="220"
          height="220"
          viewBox="0 0 220 220"
          fill="none"
          aria-hidden="true"
          className="absolute -left-8 -top-10 hidden text-gold-500/70 sm:block"
        >
          <path
            d="M30 200C30 120 90 50 180 30c-10 90-70 150-150 170Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M40 190C70 130 120 90 170 60" stroke="currentColor" strokeWidth="2" />
          <path d="M60 170c20-30 50-55 85-70M80 150c15-25 40-45 70-55" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <Image
          src="/images/hero-flower.svg"
          alt=""
          width={360}
          height={360}
          unoptimized
          className="absolute -right-6 top-1/2 hidden h-[130%] w-auto -translate-y-1/2 opacity-90 md:block"
        />
        <div className="shell relative py-10 sm:py-12">
          <Breadcrumb categoryName={category.name} tone="dark" />
          <h1 className="mt-4 text-white">{category.name}</h1>
          <p className="mt-2 max-w-2xl text-base text-white/85">
            {CATEGORY_DESCRIPTIONS[slug] ??
              `Mua ${category.name.toLowerCase()} tươi đẹp, giao tận nơi trong ngày.`}
          </p>
        </div>
      </section>
      <div className="shell pb-12">
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p data-testid="result-count" data-total={total} className="text-base text-ink">
            Hiển thị {from} – {to} của {total} sản phẩm
          </p>
          <SortForm dip={parsed.dip} gia={parsed.gia} sx={parsed.sx} />
        </div>
        <FilterBar slug={slug} params={parsed} availableTags={availableTags} />
        {total === 0 ? (
          <EmptyState slug={slug} />
        ) : (
          <ProductGrid products={products} />
        )}
        <Pagination slug={slug} params={parsed} totalPages={totalPages} />
      </div>
      {/* Dải USP trên footer (F-2; trang chủ đã có USP riêng dưới hero). */}
      <UspStrip />
    </>
  );
}
