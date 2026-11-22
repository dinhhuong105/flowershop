"use client";

import { useState } from "react";
import { addToCart, buyNow } from "@/app/actions/cart";
import QuantityStepper from "./QuantityStepper";

// Hộp mua hàng trang chi tiết (mục 5.2 + 4.4 đặc tả Ngày 4).
//
// - "Thêm vào giỏ hàng" (nút outline xanh): gọi RPC addToCart; thành
//   công → nút hiện "✓ Đã thêm" ~1,2 giây, phát sự kiện `cart:added`
//   để Toast hiện + Header bump; lỗi → hiện thông báo tiếng Việt.
// - "Mua ngay" (nút vàng): formAction buyNow, submit thường → redirect
//   /gio-hang (làm việc cả khi tắt JS).
// - Tắt JS: form POST thẳng tới action addToCart (form action mặc định),
//   trang tải lại; số lượng cố định 1 do stepper cần JS.
// - Hết hàng: cả hai nút + stepper đều vô hiệu hóa, hiện "Tạm hết hàng".
// - id="pdp-buy-box": sentinel để StickyBuyBar biết khi nào hộp mua
//   hàng đã cuộn khỏi màn hình.
export default function AddToCartForm({
  productId,
  inStock,
}: {
  productId: number;
  inStock: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    // Nút "Mua ngay" có formAction riêng → để submit mặc định (redirect).
    if (submitter?.getAttribute("data-buy") === "now") return;
    event.preventDefault();
    if (!inStock || pending) return;
    setPending(true);
    setError(null);
    const res = await addToCart(new FormData(event.currentTarget));
    setPending(false);
    if (res.ok) {
      setSuccess(true);
      window.dispatchEvent(new CustomEvent("cart:added", { detail: { count: res.count } }));
      window.setTimeout(() => setSuccess(false), 1200);
    } else {
      setError(res.error);
    }
  }

  return (
    <div id="pdp-buy-box">
      <form action={addToCart as unknown as (formData: FormData) => Promise<void>} onSubmit={handleSubmit} className="mt-5">
        <input type="hidden" name="productId" value={productId} />
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">Số lượng:</span>
          <QuantityStepper disabled={!inStock} />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={!inStock || pending}
            data-testid="add-to-cart"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[3px] border border-green-800 bg-white px-3 text-sm font-bold uppercase tracking-wide text-green-800 transition-all duration-150 hover:bg-cream-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-green-800/30 border-t-green-800"
              />
            ) : success ? (
              "✓ Đã thêm"
            ) : (
              "Thêm vào giỏ hàng"
            )}
          </button>
          <button
            type="submit"
            formAction={buyNow}
            data-buy="now"
            disabled={!inStock}
            data-testid="buy-now"
            className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] bg-gold-300 px-3 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mua ngay
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </form>
      {inStock ? null : (
        <p className="mt-3 text-sm font-semibold text-danger">Tạm hết hàng</p>
      )}
    </div>
  );
}
