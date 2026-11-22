"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatVND } from "@/lib/format";
import { MAX_QTY } from "@/config/cart";
import { removeItem, updateQuantity } from "@/app/actions/cart";
import { asFormAction } from "@/lib/form-action";
import type { CartLine } from "@/lib/cart";

// Một dòng giỏ hàng (mục 7 đặc tả Ngày 4): ảnh, tên (liên kết tới trang
// chi tiết), nhãn danh mục, đơn giá (kèm giá gốc gạch ngang nếu giảm),
// ô số lượng −/số/+, thành tiền, nút xóa.
//
// - Đổi số lượng: mỗi nút −/+ là một form riêng với số lượng đích đã
//   tính sẵn (qty−1 / qty+1) nên hoạt động cả khi tắt JS; khi có JS,
//   onSubmit chặn lại để gọi RPC, nút tạm vô hiệu trong lúc chờ, số
//   trượt dọc 150 ms khi tổng cập nhật (key={quantity} +
//   animate-qty-slide).
// - Xóa dòng: với JS, dòng thu gọn (opacity + grid-template-rows)
//   250 ms rồi mới gọi RPC gỡ; không JS thì form submit thường, dòng
//   gỡ ngay.
// - Dòng unavailable (isActive = false hoặc inStock = false): nhãn
//   "Sản phẩm hiện không còn bán", mờ đi, không tính vào tạm tính,
//   ẩn ô số lượng, chỉ cho xóa.
function Line({ item }: { item: CartLine }) {
  const [pending, setPending] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailHref = `/${item.categorySlug}/${item.slug}`;
  const stepButton =
    "flex h-11 w-11 items-center justify-center border border-line bg-white text-lg text-ink transition-all duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.9] disabled:pointer-events-none disabled:opacity-40";

  async function changeQty(form: HTMLFormElement) {
    setPending(true);
    setError(null);
    const res = await updateQuantity(new FormData(form));
    setPending(false);
    if (!res.ok) setError(res.error);
  }

  async function onRemove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || collapsing) return;
    // Lấy form NGAY (event.currentTarget thành null sau await — React
    // chỉ giữ currentTarget trong lúc dispatch sự kiện).
    const form = event.currentTarget;
    setCollapsing(true);
    setError(null);
    // Thu gọn 250 ms rồi mới gỡ (mục 7 đặc tả).
    await new Promise((resolve) => setTimeout(resolve, 250));
    const res = await removeItem(new FormData(form));
    if (!res.ok) {
      setCollapsing(false);
      setError(res.error);
    }
  }

  return (
    <li data-testid="cart-line" className={item.unavailable ? "opacity-60" : undefined}>
      <div
        className={`grid transition-all duration-250 ease-out ${
          collapsing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap gap-4 border-b border-line py-4">
            <Link
              href={detailHref}
              className="block h-[120px] w-24 shrink-0 overflow-hidden rounded-[3px] border border-line bg-cream-100"
            >
              <Image
                src={item.image}
                alt={item.name}
                width={96}
                height={120}
                loading="lazy"
                unoptimized
                className="h-full w-full object-cover"
              />
            </Link>

            <div className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gold-text">
                {item.categoryName}
              </span>
              <h2 className="mt-1 text-base font-bold leading-snug text-ink">
                <Link href={detailHref} className="hover:text-green-800 hover:underline">
                  {item.name}
                </Link>
              </h2>
              <p className="mt-1 flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-bold text-ink">{formatVND(item.price)}</span>
                {item.originalPrice !== null ? (
                  <span className="text-muted line-through">{formatVND(item.originalPrice)}</span>
                ) : null}
              </p>
              {item.unavailable ? (
                <p className="mt-2 text-sm font-semibold text-danger">
                  Sản phẩm hiện không còn bán
                </p>
              ) : null}
              {item.sku ? <p className="mt-1 text-xs text-muted">SKU: {item.sku}</p> : null}
            </div>

            <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:flex-col sm:items-end sm:justify-center">
              {item.unavailable ? (
                <span className="text-sm font-bold text-ink">—</span>
              ) : (
                <>
                  <div className="flex items-stretch">
                    <form
                      action={asFormAction(updateQuantity)}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!pending) void changeQty(event.currentTarget);
                      }}
                    >
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <input type="hidden" name="quantity" value={item.quantity - 1} />
                      <button
                        type="submit"
                        disabled={pending || item.quantity <= 1}
                        aria-label={`Giảm số lượng ${item.name}`}
                        className={`${stepButton} rounded-l-[3px]`}
                      >
                        −
                      </button>
                    </form>
                    <span
                      key={item.quantity}
                      aria-live="polite"
                      data-testid="cart-line-qty"
                      className="animate-qty-slide flex h-11 min-w-12 items-center justify-center border-y border-line bg-white px-2 text-base font-semibold text-ink"
                    >
                      {item.quantity}
                    </span>
                    <form
                      action={asFormAction(updateQuantity)}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!pending) void changeQty(event.currentTarget);
                      }}
                    >
                      <input type="hidden" name="itemId" value={item.itemId} />
                      <input type="hidden" name="quantity" value={item.quantity + 1} />
                      <button
                        type="submit"
                        disabled={pending || item.quantity >= MAX_QTY}
                        aria-label={`Tăng số lượng ${item.name}`}
                        className={`${stepButton} rounded-r-[3px]`}
                      >
                        +
                      </button>
                    </form>
                  </div>
                  <p className="text-base font-bold text-ink">{formatVND(item.lineTotal)}</p>
                </>
              )}
              <form action={asFormAction(removeItem)} onSubmit={onRemove}>
                <input type="hidden" name="itemId" value={item.itemId} />
                <button
                  type="submit"
                  disabled={pending || collapsing}
                  aria-label={`Xóa ${item.name} khỏi giỏ`}
                  className="flex min-h-11 items-center justify-center rounded-[3px] px-3 text-sm font-semibold text-danger transition-colors duration-150 hover:bg-danger/5 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
                >
                  Xóa
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {error ? (
        <p role="alert" className="py-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export default function CartLines({ items }: { items: CartLine[] }) {
  return (
    <ul aria-label="Các sản phẩm trong giỏ" className="border-t border-line">
      {items.map((item) => (
        <Line key={item.itemId} item={item} />
      ))}
    </ul>
  );
}
