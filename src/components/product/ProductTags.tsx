import Link from "next/link";
import { tagLabels } from "@/config/catalog";

// Chip tag trang chi tiết (mục 5.2 đặc tả Ngày 4): mỗi tag là liên kết
// tới trang danh mục lọc theo dịp đó. Giữ ĐÚNG thứ tự tags của sản phẩm
// (không sắp theo tagLabels); tag không có nhãn thì bỏ qua.
export default function ProductTags({
  categorySlug,
  tags,
}: {
  categorySlug: string;
  tags: string[];
}) {
  // Giữ ĐÚNG thứ tự tags của sản phẩm (không sắp theo tagLabels); tag
  // không có nhãn thì bỏ qua.
  const shown: Array<{ slug: string; label: string }> = [];
  for (const slug of tags) {
    const found = tagLabels.find((t) => t.slug === slug);
    if (found) shown.push({ slug, label: found.label });
  }
  if (shown.length === 0) return null;
  return (
    <p data-testid="pdp-tags" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-ink">Tag:</span>
      {shown.map((t) => (
        <Link
          key={t.slug}
          href={`/${categorySlug}?dip=${t.slug}`}
          className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-green-800 hover:text-green-800"
        >
          {t.label}
        </Link>
      ))}
    </p>
  );
}
