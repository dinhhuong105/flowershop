import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  getPublishedNewsBySlugCached,
  newsDisplayDate,
} from "@/lib/admin/news";
import { articleJsonLd } from "@/lib/news-jsonld";
import { escapeJsonForScript } from "@/lib/security-headers";
import { getSettings } from "@/lib/settings-cache";
import { renderMarkdown } from "@/lib/markdown";
import { formatVnDate } from "@/lib/vn-datetime";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedNewsBySlugCached(slug);
  if (!article) notFound();
  const settings = await getSettings();
  // SEO riêng: có seoTitle/seoDescription thì dùng, không thì tiêu đề
  // + tóm tắt của bài (không thì mô tả mặc định của shop).
  const title = article.seoTitle !== "" ? article.seoTitle : article.title;
  const description =
    article.seoDescription !== ""
      ? article.seoDescription
      : article.excerpt !== ""
        ? article.excerpt
        : settings.defaultDescription;
  return {
    title,
    description,
    alternates: { canonical: `/tin-tuc/${article.slug}` },
    // OG image = ảnh đại diện khi có (không dùng ảnh giữ chỗ làm
    // ảnh chia sẻ — cùng quy tắc như trang sản phẩm).
    openGraph: {
      title: `${title} | ${settings.siteName}`,
      description,
      type: "article",
      locale: "vi_VN",
      ...(article.coverImage !== "" ? { images: [{ url: article.coverImage }] } : {}),
    },
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedNewsBySlugCached(slug);
  // Nháp/không tồn tại → 404 (không lộ nội dung nháp).
  if (!article) notFound();
  // Nonce CSP do middleware sinh mỗi request (cùng cách layout gốc
  // gắn nonce cho JSON-LD Organization).
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <>
      {/* JSON-LD Article (Ngày 19 A1): chỉ trường có dữ liệu —
          tác giả trống thì bỏ author (A2); thoát <, > và & để
          không thoát khỏi thẻ script (S3). */}
      <script
        type="application/ld+json"
        nonce={nonce === "" ? undefined : nonce}
        dangerouslySetInnerHTML={{
          __html: escapeJsonForScript(JSON.stringify(articleJsonLd(article))),
        }}
      />
      <div className="shell pb-12 pt-6">
        <p>
          <Link href="/tin-tuc" className="inline-flex min-h-11 items-center text-sm font-semibold text-green-800 hover:underline">
            ← Tin tức
          </Link>
        </p>
        <article data-testid="news-article" className="mx-auto mt-2 max-w-3xl">
          <h1 className="font-display text-3xl font-semibold leading-snug text-ink sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-sm text-muted">
            Ngày đăng {formatVnDate(newsDisplayDate(article))}
            {article.author !== "" ? ` · Tác giả: ${article.author}` : ""}
          </p>
          {article.coverImage !== "" ? (
            <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-[3px] bg-cream-100">
              <Image
                src={article.coverImage}
                alt={article.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : null}
          {article.excerpt !== "" ? (
            <p className="mt-6 text-base font-medium leading-relaxed text-ink">
              {article.excerpt}
            </p>
          ) : null}
          <div
            className="mt-6 max-w-none text-sm leading-relaxed text-ink-soft sm:text-base [&_a]:font-bold [&_a]:text-green-800 [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink [&_h4]:mt-4 [&_h4]:font-semibold [&_h4]:text-ink [&_ol]:mt-3 [&_ol_li]:list-decimal [&_ol_li]:ml-5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul_li]:list-disc [&_ul_li]:ml-5"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          />
        </article>
      </div>
      <UspStrip />
    </>
  );
}
