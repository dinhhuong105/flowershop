import Image from "next/image";
import Link from "next/link";
import { formatVND } from "@/lib/format";
import { getDisplayPrice } from "@/lib/pricing";
import type { FeaturedProduct } from "@/lib/queries";

export default function ProductCard({ product }: { product: FeaturedProduct }) {
  const price = getDisplayPrice(product);
  const image = product.images[0] ?? "/images/placeholder.svg";
  return (
    <Link
      href={`/${product.categorySlug}/${product.slug}`}
      data-testid="product-card"
      className="group block overflow-hidden rounded-2xl border border-line bg-card transition-shadow hover:shadow-lg"
    >
      <span className="relative block aspect-[4/5] w-full overflow-hidden bg-cream">
        <Image
          src={image}
          alt={product.name}
          width={400}
          height={500}
          loading="lazy"
          unoptimized
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.isFastDelivery ? (
            <span className="rounded-full bg-fast px-2 py-1 text-xs font-semibold text-white">
              Giao nhanh
            </span>
          ) : null}
          {price.discountPercent !== null ? (
            <span className="rounded-full bg-brand px-2 py-1 text-xs font-semibold text-white">
              -{price.discountPercent}%
            </span>
          ) : null}
        </span>
      </span>
      <span className="block p-3">
        <span className="block min-h-12 text-base font-medium leading-snug text-ink line-clamp-2">
          {product.name}
        </span>
        <span className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-brand">{formatVND(price.current)}</span>
          {price.original !== null ? (
            <span className="text-sm text-muted line-through">{formatVND(price.original)}</span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
