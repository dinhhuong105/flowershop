import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getRelated } from "@/lib/product";
import { getDisplayPrice } from "@/lib/pricing";
import { siteConfig, telHref } from "@/config/site";
import { getSettings } from "@/lib/settings-cache";
import Breadcrumb from "@/components/catalog/Breadcrumb";
import UspStrip from "@/components/layout/UspStrip";
import Gallery from "@/components/product/Gallery";
import PriceBlock from "@/components/product/PriceBlock";
import AddToCartForm from "@/components/product/AddToCartForm";
import ProductTags from "@/components/product/ProductTags";
import CommitmentBlock from "@/components/product/CommitmentBlock";
import ProductAdvice from "@/components/product/ProductAdvice";
import ProductFaq from "@/components/product/ProductFaq";
import RelatedProducts from "@/components/product/RelatedProducts";
import StickyBuyBar from "@/components/product/StickyBuyBar";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string; product: string }>;
};

// Cắt mô tả ở ranh giới từ, tối đa 155 ký tự (D4-14).
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, product } = await params;
  const p = await getProduct(category, product);
  if (!p) notFound();
  // SEO riêng (Ngày 14 D2): có seoTitle/seoDescription thì dùng,
  // không thì như hiện nay (tên + mô tả cắt 155 ký tự). og:title
  // không chịu template của layout nên ghi đủ tên shop.
  const siteName = (await getSettings()).siteName;
  const title = p.seoTitle !== "" ? p.seoTitle : p.name;
  const description =
    p.seoDescription !== "" ? p.seoDescription : truncateAtWord(p.description, 155);
  return {
    title,
    description,
    alternates: { canonical: `/${p.categorySlug}/${p.slug}` },
    // Chưa có og:image cho đến khi có ảnh thật (không dùng SVG giữ chỗ
    // làm ảnh chia sẻ — mục 5.1 đặc tả Ngày 4).
    openGraph: {
      title: `${title} | ${siteName}`,
      description,
      type: "website",
      locale: "vi_VN",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { category, product } = await params;
  const p = await getProduct(category, product);
  // Hotline/Zalo/tên shop lấy từ Cài đặt shop (Ngày 11 B5).
  const settings = await getSettings();
  if (!p) notFound();
  const related = await getRelated(p);
  const price = getDisplayPrice(p);
  const zaloText = `Xin chào, tôi muốn đặt mua: ${p.name}${p.sku ? ` - [${p.sku}]` : ""}`;

  return (
    <>
      <div className="shell pb-12 pt-6">
        <Breadcrumb
          categoryName={p.categoryName}
          categorySlug={p.categorySlug}
          productName={p.name}
        />

        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          <Gallery
            images={p.images}
            name={p.name}
            isFastDelivery={p.isFastDelivery}
            discountPercent={price.discountPercent}
          />

          <div>
            <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gold-text">
              {p.categoryName}
            </span>
            <h1
              data-testid="pdp-title"
              className="mt-2 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl"
            >
              {p.name}
            </h1>

            <p
              data-testid="pdp-stock"
              className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink"
            >
              {p.inStock ? (
                <>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
                  Còn hàng
                </>
              ) : (
                <>
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-danger" />
                  Tạm hết hàng
                </>
              )}
            </p>

            <div className="mt-4">
              <PriceBlock current={price.current} original={price.original} />
            </div>

            {siteConfig.deliveryNotes.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                {siteConfig.deliveryNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 leading-relaxed text-ink-soft">{p.description}</p>

            <AddToCartForm productId={p.id} inStock={p.inStock} />

            {settings.hotline || settings.zalo ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {settings.zalo ? (
                  <a
                    href={`https://zalo.me/${settings.zalo}?text=${encodeURIComponent(zaloText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-[#0068ff] px-3 text-sm font-bold text-[#0068ff] transition-colors duration-150 hover:bg-[#0068ff]/5 active:scale-[0.97]"
                  >
                    Tư vấn Zalo
                  </a>
                ) : null}
                {settings.hotline ? (
                  <a
                    href={telHref(settings.hotline)}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-green-800 px-3 text-sm font-bold text-green-800 transition-colors duration-150 hover:bg-cream-100 active:scale-[0.97]"
                  >
                    Gọi {settings.hotline}
                  </a>
                ) : null}
              </div>
            ) : null}

            {p.sku ? (
              <p data-testid="pdp-sku" className="mt-4 text-sm text-muted">
                SKU: {p.sku}
              </p>
            ) : null}
            <ProductTags categorySlug={p.categorySlug} tags={p.tags} />
          </div>
        </div>

        <CommitmentBlock shopName={settings.siteName} />
        <ProductAdvice name={p.name} categorySlug={p.categorySlug} shopName={settings.siteName} />
        <ProductFaq categorySlug={p.categorySlug} categoryName={p.categoryName} />
        <RelatedProducts products={related} />

        <section
          aria-labelledby="cta-cuoi-trang"
          className="mt-12 rounded-[3px] bg-green-900 px-6 py-10 text-center text-white"
        >
          <h2 id="cta-cuoi-trang" className="font-display text-2xl font-semibold sm:text-3xl">
            Chọn thêm hoa cho dịp của bạn
          </h2>
          <Link
            href={`/${p.categorySlug}`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
          >
            Khám phá {p.categoryName}
          </Link>
        </section>
      </div>

      <UspStrip />
      <StickyBuyBar
        productId={p.id}
        current={price.current}
        original={price.original}
        inStock={p.inStock}
        hotline={settings.hotline}
        zalo={settings.zalo}
      />
    </>
  );
}
