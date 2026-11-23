"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart, buyNow } from "@/app/actions/cart";
import { asFormAction } from "@/lib/form-action";
import { formatVND } from "@/lib/format";
import QuantityStepper from "./QuantityStepper";

export type QuickViewData = {
  id: number;
  name: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  salePrice: number | null;
  images: string[];
  description: string;
  sku: string | null;
  inStock: boolean;
  isFastDelivery: boolean;
};

// Cửa sổ "Xem nhanh" (mục 3.3 đặc tả Ngày 6): phần tử <dialog> gốc
// (showModal), không tự xây khóa focus. Mở → focus vào nút đóng,
// khóa cuộn nền; đóng bằng Esc, bấm nền mờ, nút đóng — và trả focus
// về nút "Xem nhanh" đã bấm (bên QuickViewButton). Đóng có hoạt ảnh
// 150 ms nên requestClose đợi hết hoạt ảnh mới gọi dialog.close().
export default function QuickViewDialog({
  data,
  loading,
  error,
  onRetry,
  onClose,
  detailHref,
}: {
  data: QuickViewData | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
  detailHref: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const addedTimerRef = useRef<number | null>(null);
  // K-5: KHÔNG phát sự kiện toast lúc thêm (toast bị cửa sổ che,
  // khách chỉ thấy ~1,6 giây). Ghi lại số lượng, phát sự kiện khi
  // cửa sổ đã đóng hẳn (trong cleanup khi unmount) để toast hiện
  // đủ 3 giây sau khi đóng. Huy hiệu giỏ vẫn bump lúc thêm nhờ
  // router.refresh() bên dưới (không chờ đóng cửa sổ).
  const toastPendingRef = useRef<number | null>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    closeBtnRef.current?.focus();
    // Khóa cuộn nền (D6-15): chỉ overflow:hidden trên <html>/<body>
    // KHÔNG đủ — Chrome vẫn cho window.scrollTo() cuộn (đã đo:
    // wheel bị chặn nhưng scrollTo +500 vẫn chạy). Dùng kỹ thuật
    // body position:fixed + top = -scrollY (chuẩn cho modal), khôi
    // phục vị trí cuộn khi đóng.
    const scrollY = window.scrollY;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      window.scrollTo(0, scrollY);
      // K-5: cửa sổ đã đóng hẳn — phát sự kiện toast (nếu vừa thêm
      // vào giỏ) để toast bắt đầu đếm từ lúc này, hiện đủ 3 giây.
      if (toastPendingRef.current !== null) {
        const count = toastPendingRef.current;
        toastPendingRef.current = null;
        window.dispatchEvent(new CustomEvent("cart:added", { detail: { count } }));
      }
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    };
  }, []);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (!dialog || closingRef.current) return;
    closingRef.current = true;
    dialog.classList.add("closing");
    closeTimerRef.current = window.setTimeout(() => {
      if (dialog.open) dialog.close();
      onClose();
    }, 150);
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) requestClose();
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    // Nút "Mua ngay" có formAction riêng → để submit mặc định (redirect).
    if (submitter?.getAttribute("data-buy") === "now") return;
    event.preventDefault();
    if (!data || !data.inStock || pending) return;
    setPending(true);
    setAddError(null);
    const res = await addToCart(new FormData(event.currentTarget));
    setPending(false);
    if (res.ok) {
      setAdded(true);
      // K-5: hoãn toast tới khi cửa sổ đóng (xem toastPendingRef);
      // chỉ làm mới huy hiệu giỏ NGAY lúc thêm để bump chạy lúc thêm.
      toastPendingRef.current = res.count;
      // Huy hiệu giỏ ở header là dữ liệu máy chủ (layout): làm mới
      // để số lượng cập nhật ngay trên cùng trang (D6-16). Cửa sổ
      // vẫn mở (client component giữ trạng thái).
      router.refresh();
      // Nút đổi "✓ ĐÃ THÊM" khoảng 1,2 giây rồi tự đóng cửa sổ.
      addedTimerRef.current = window.setTimeout(() => requestClose(), 1200);
    } else {
      setAddError(res.error);
    }
  }

  const image = data?.images[0] ?? "/images/placeholder.svg";
  const current = data ? (data.salePrice !== null && data.salePrice > 0 && data.salePrice < data.price ? data.salePrice : data.price) : 0;

  return (
    <dialog
      ref={dialogRef}
      data-testid="quick-view-dialog"
      aria-label={data ? `Xem nhanh ${data.name}` : "Xem nhanh sản phẩm"}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={handleBackdropClick}
      className="quick-view m-auto max-h-[90vh] w-[min(92vw,880px)] rounded-[3px] border-0 bg-white p-0 shadow-[0_24px_64px_rgba(1,50,31,0.35)] max-md:m-0 max-md:mt-auto max-md:max-h-[92dvh] max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-[12px]"
    >
      <div className="qv-panel relative max-h-[90vh] overflow-y-auto max-md:max-h-[92dvh]">
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Đóng xem nhanh"
          onClick={requestClose}
          className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-[3px] bg-white/90 text-lg text-ink shadow-sm transition-colors duration-150 hover:bg-cream-100"
        >
          ✕
        </button>

        {error ? (
          <div className="p-6 text-center sm:p-8">
            <p role="alert" className="text-base font-semibold text-ink">
              Không tải được thông tin sản phẩm.
            </p>
            <p className="mt-2 text-sm text-muted">Kiểm tra lại kết nối mạng rồi thử lại.</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-11 items-center justify-center rounded-[3px] bg-gold-300 px-5 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity duration-150 hover:opacity-90"
              >
                Thử lại
              </button>
              <Link
                href={detailHref}
                className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-green-800 px-5 text-sm font-bold text-green-800 transition-colors duration-150 hover:bg-cream-100"
              >
                Xem chi tiết sản phẩm →
              </Link>
            </div>
          </div>
        ) : loading || !data ? (
          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6" aria-busy="true">
            <div className="animate-shimmer aspect-[4/5] w-full rounded-[3px] max-md:aspect-auto max-md:h-[32dvh]" />
            <div className="space-y-3">
              <div className="animate-shimmer h-4 w-24 rounded-[2px]" />
              <div className="animate-shimmer h-7 w-3/4 rounded-[2px]" />
              <div className="animate-shimmer h-8 w-40 rounded-[2px]" />
              <div className="animate-shimmer h-4 w-full rounded-[2px]" />
              <div className="animate-shimmer h-4 w-2/3 rounded-[2px]" />
              <div className="animate-shimmer h-11 w-full rounded-[3px]" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
            {/* K-6: di động ảnh cao tối đa ~32dvh (trước đây aspect 4/5
                chiếm quá nửa bảng, che mất hai nút mua). */}
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[3px] bg-cream-100 max-md:aspect-auto max-md:h-[32dvh]">
              <Image
                src={image}
                alt={data.name}
                width={600}
                height={750}
                unoptimized
                className="h-full w-full object-cover"
              />
              {data.isFastDelivery ? (
                <span className="absolute left-2 top-2 rounded-[2px] bg-green-900 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Giao nhanh
                </span>
              ) : null}
              {!data.inStock ? (
                <span className="absolute right-2 top-2 rounded-[2px] bg-danger px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  Tạm hết hàng
                </span>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gold-text">
                {data.categoryName}
              </span>
              <h2 className="mt-1 text-xl font-bold leading-snug text-ink sm:text-2xl">
                {data.name}
              </h2>
              <div className="mt-3">
                <p data-testid="quick-price" className="text-3xl font-bold text-ink">
                  {formatVND(current)}
                </p>
                {data.salePrice !== null && data.salePrice > 0 && data.salePrice < data.price ? (
                  <p className="mt-1 flex flex-wrap items-baseline gap-3">
                    <span
                      data-testid="quick-original-price"
                      className="text-lg text-muted line-through"
                    >
                      {formatVND(data.price)}
                    </span>
                    <span
                      data-testid="quick-saving"
                      className="text-base font-semibold text-danger"
                    >
                      Tiết kiệm {formatVND(data.price - current)}
                    </span>
                  </p>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">
                {data.inStock ? "Còn hàng" : "Tạm hết hàng"}
              </p>
              {data.description ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{data.description}</p>
              ) : null}
              {data.sku ? <p className="mt-2 text-sm text-muted">SKU: {data.sku}</p> : null}
              {/* K-6: di động thanh hành động (số lượng + 2 nút) dính
                  đáy bảng để tên, giá và cả hai nút luôn thấy mà không
                  cần cuộn; phần mô tả cuộn phía dưới thanh này. */}
              <form
                action={asFormAction(addToCart)}
                onSubmit={handleSubmit}
                className="mt-5 max-md:sticky max-md:bottom-0 max-md:-mx-5 max-md:border-t max-md:border-line max-md:bg-white max-md:px-5 max-md:pb-2 max-md:pt-3"
              >
                <input type="hidden" name="productId" value={data.id} />
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink">Số lượng:</span>
                  <QuantityStepper disabled={!data.inStock} />
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="submit"
                    disabled={!data.inStock || pending}
                    data-testid="quick-add-to-cart"
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[3px] border border-green-800 bg-white px-2 text-[13px] font-bold uppercase text-green-800 transition-all duration-150 hover:bg-cream-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pending ? (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-green-800/30 border-t-green-800"
                      />
                    ) : added ? (
                      "✓ ĐÃ THÊM"
                    ) : (
                      "Thêm vào giỏ hàng"
                    )}
                  </button>
                  <button
                    type="submit"
                    formAction={buyNow}
                    data-buy="now"
                    disabled={!data.inStock}
                    data-testid="quick-buy-now"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] bg-gold-300 px-3 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Mua ngay
                  </button>
                </div>
                {addError ? (
                  <p role="alert" className="mt-3 text-sm font-medium text-danger">
                    {addError}
                  </p>
                ) : null}
              </form>
              {!data.inStock ? (
                <p className="mt-3 text-sm font-semibold text-danger">Tạm hết hàng</p>
              ) : null}
              <p className="mt-4">
                <Link
                  href={detailHref}
                  className="text-sm font-bold text-green-800 hover:underline"
                >
                  Xem chi tiết sản phẩm →
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
