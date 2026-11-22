import Link from "next/link";

// Trạng thái giỏ trống (mục 7 đặc tả Ngày 4): hình minh họa SVG nhỏ
// tự vẽ (giỏ hoa), câu "Giỏ hàng của bạn đang trống" và nút tới danh
// mục đầu tiên.
export default function CartEmpty({
  categorySlug,
  categoryName,
}: {
  categorySlug: string;
  categoryName: string;
}) {
  return (
    <div className="py-16 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        stroke="#0d6532"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto"
      >
        {/* Giỏ hoa: quai xách + thân giỏ + bông hoa */}
        <path d="M38 44a22 22 0 0 1 44 0" />
        <path d="M28 44h64l-8 48a6 6 0 0 1-6 5H42a6 6 0 0 1-6-5l-8-48Z" />
        <path d="M48 44v26M60 44v30M72 44v26" />
        <circle cx="60" cy="26" r="7" fill="#db9b3a" stroke="none" />
        <circle cx="60" cy="26" r="2.5" fill="#01321f" stroke="none" />
      </svg>
      <p className="mt-6 text-xl font-bold text-ink">Giỏ hàng của bạn đang trống</p>
      <p className="mx-auto mt-2 max-w-md text-ink-soft">
        Chọn một bó hoa ưng ý để bắt đầu nhé.
      </p>
      <Link
        href={`/${categorySlug}`}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 px-6 text-sm font-bold uppercase tracking-wide text-white transition-all duration-150 hover:bg-green-700 active:scale-[0.97]"
      >
        Xem {categoryName}
      </Link>
    </div>
  );
}
