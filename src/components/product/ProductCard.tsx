import Image from "next/image";
import Link from "next/link";
import { formatVND } from "@/lib/format";
import { getDisplayPrice } from "@/lib/pricing";
import { buyNow } from "@/app/actions/cart";
import { asFormAction } from "@/lib/form-action";
import type { FeaturedProduct } from "@/lib/queries";
import QuickViewButton from "./QuickViewButton";

// Thẻ sản phẩm (Ngày 4, theo M12/M14 + mục 3.3 phụ lục).
//
// Bố cục: ảnh 4/5 (hover zoom 1.06, 400ms — CSS .product-card trong
// globals.css), huy hiệu "Giao nhanh" và "-{n}%" góc trái trên, "Tạm
// hết hàng" góc phải trên khi inStock = false; tên danh mục, tên sản
// phẩm (tối đa 2 dòng), giá; hàng nút "Xem chi tiết" + "Mua ngay".
// Tên sản phẩm là stretched link (lớp .stretched-link phủ toàn thẻ):
// bấm vào đâu trên thẻ cũng vào trang chi tiết, TRỪ hai nút (hai nút
// nằm trên lớp phủ nhờ relative + z-10).
//
// KHÁC ĐẶC TẢ NHỎ: nút "Thêm vào giỏ" (icon, form addToCart) không có
// trong thẻ — thêm vào giỏ chỉ có trên trang chi tiết; thẻ chỉ có
// "Xem chi tiết" (đi tới trang chi tiết) và "Mua ngay". Lý do: thêm
// vào giỏ từ thẻ sẽ cần toast + số lượng mặc định, nhưng trên thẻ
// không có chỗ chọn số lượng; đưa người dùng tới trang chi tiết rồi
// thêm là rõ ràng hơn. Ghi rõ ở báo cáo Ngày 4.
//
// prefetch BẬT LẠI (F-6/D4-30): không còn prefetch={false}; trang chi
// tiết đã tồn tại nên prefetch không còn 404.
export default function ProductCard({
  product,
  testId = "product-card",
  // Ngày 6 (mục 3.1): nút phụ mặc định là "Xem nhanh" (mở cửa sổ);
  // khối "Những thiết kế đồng điệu" ở trang chi tiết giữ "Xem chi
  // tiết" (đúng cách EdenGift).
  secondaryAction = "quick",
}: {
  product: FeaturedProduct;
  testId?: string;
  secondaryAction?: "quick" | "detail";
}) {
  const price = getDisplayPrice(product);
  const image = product.images[0] ?? "/images/placeholder.svg";
  const detailHref = `/${product.categorySlug}/${product.slug}`;
  return (
    <article
      data-testid={testId}
      className="product-card group relative flex h-full flex-col overflow-hidden rounded-[3px] border border-line bg-white"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream-100">
        <Image
          src={image}
          alt={product.name}
          width={400}
          height={500}
          loading="lazy"
          unoptimized
          className="product-card-img animate-fade-in h-full w-full object-cover"
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
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
        </div>
        {product.inStock ? null : (
          <span className="absolute right-2 top-2 rounded-[2px] bg-danger px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            Tạm hết hàng
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gold-text">
          {product.categoryName}
        </span>
        <h3 className="mt-1 min-h-12 text-base font-bold leading-snug text-ink line-clamp-2">
          <Link
            href={detailHref}
            className="stretched-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800 focus-visible:ring-offset-2"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{formatVND(price.current)}</span>
          {price.original !== null ? (
            <span className="text-sm text-muted line-through">{formatVND(price.original)}</span>
          ) : null}
        </p>
        <div className="relative z-10 mt-auto flex gap-2 pt-3">
          {/* G-8a: aria-label riêng từng thẻ ("Xem chi tiết {tên}") vì
              nhiều liên kết cùng nhãn "Xem chi tiết" trên một trang.
              Ngày 6: mặc định là "Xem nhanh" (QuickViewButton — liên kết
              thật tới trang chi tiết, JS chặn và mở cửa sổ); khối liên
              quan ở trang chi tiết giữ "Xem chi tiết". */}
          {secondaryAction === "quick" ? (
            <QuickViewButton product={product} />
          ) : (
            <Link
              href={detailHref}
              aria-label={`Xem chi tiết ${product.name}`}
              className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-green-800 px-2 text-sm font-bold text-green-800 transition-colors duration-150 hover:bg-cream-100 active:scale-[0.97]"
            >
              Xem chi tiết
            </Link>
          )}
          <form action={asFormAction(buyNow)} className="flex-1">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="quantity" value={1} />
            <button
              type="submit"
              disabled={!product.inStock}
              aria-label={
                product.inStock ? `Mua ngay ${product.name}` : `${product.name} tạm hết hàng`
              }
              className="flex min-h-11 w-full items-center justify-center rounded-[3px] bg-gold-300 px-2 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mua ngay
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
