import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedPageBySlug } from "@/lib/admin/pages";
import { getSettings } from "@/lib/settings-cache";
import { renderMarkdown } from "@/lib/markdown";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

// Trang tĩnh công khai (Ngày 13 B4): chỉ trang đã xuất bản trả 200;
// nháp hoặc không tồn tại trả 404.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();
  const settings = await getSettings();
  return {
    title: page.seoTitle !== "" ? page.seoTitle : page.title,
    description:
      page.seoDescription !== "" ? page.seoDescription : settings.defaultDescription,
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();
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
