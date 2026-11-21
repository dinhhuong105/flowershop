import Image from "next/image";
import Link from "next/link";
import { formatVND } from "@/lib/format";
import { getDisplayPrice } from "@/lib/pricing";
import type { FeaturedProduct } from "@/lib/queries";

// ProductCard (mục 5.3 phụ lục): khung ảnh 4:5 nền kem; huy hiệu góc
// trái-trên, mỗi badge 1 dòng: "GIAO NHANH" (green-900) và
// "ƯU ĐÃI -{n}%" (danger, n = % giảm thật). Không badge "MỚI" (chưa có
// dữ liệu). Dưới ảnh: nhãn danh mục uppercase gold-text 12px, tên tối đa
// 2 dòng (sans đậm 16px), giá hiện tại ink đậm 18px + giá gốc gạch ngang.
// KHÔNG nút "Xem nhanh"/"Mua ngay" (Ngày 4/6 mới có). Hover: nâng -6px,
// ảnh scale 1.06 (CSS .product-card trong globals.css).
export default function ProductCard({ product }: { product: FeaturedProduct }) {
  const price = getDisplayPrice(product);
  const image = product.images[0] ?? "/images/placeholder.svg";
  return (
    <Link
      href={`/${product.categorySlug}/${product.slug}`}
      data-testid="product-card"
      // Trang chi tiết chưa có (Ngày 4) — prefetch mặc định sẽ tải 8 lần
      // trang 404 (console error + tốn main-thread). Tắt prefetch cho tới
      // khi route chi tiết tồn tại; link danh mục vẫn giữ prefetch mặc định
      // theo quyết định Ngày 2 của Claude.
      prefetch={false}
      className="product-card group block h-full overflow-hidden rounded-[3px] border border-line bg-white"
    >
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-cream-100">
        <Image
          src={image}
          alt={product.name}
          width={400}
          height={500}
          loading="lazy"
          unoptimized
          className="product-card-img animate-fade-in h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.isFastDelivery ? (
            <span className="rounded-[2px] bg-green-900 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Giao nhanh
            </span>
          ) : null}
          {price.discountPercent !== null ? (
            <span className="rounded-[2px] bg-danger px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Ưu đãi -{price.discountPercent}%
            </span>
          ) : null}
        </span>
      </span>
      <span className="block p-3">
        <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gold-text">
          {product.categoryName}
        </span>
        <span className="mt-1 block min-h-12 text-base font-bold leading-snug text-ink line-clamp-2">
          {product.name}
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{formatVND(price.current)}</span>
          {price.original !== null ? (
            <span className="text-sm text-muted line-through">{formatVND(price.original)}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
