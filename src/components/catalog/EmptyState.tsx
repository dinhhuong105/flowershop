import Link from "next/link";

export default function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="mt-6 rounded-[3px] border border-line bg-white px-4 py-12 text-center">
      <p className="text-lg font-medium text-ink">Chưa có sản phẩm phù hợp với bộ lọc</p>
      <p className="mt-2 text-muted">Thử đổi dịp hoặc khoảng giá khác, hoặc xem toàn bộ danh mục.</p>
      <Link
        href={`/${slug}`}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 px-6 text-sm font-bold uppercase tracking-wide text-white transition-all duration-150 hover:bg-green-700 active:scale-[0.97]"
      >
        Xóa bộ lọc
      </Link>
    </div>
  );
}
