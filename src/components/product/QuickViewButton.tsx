"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ProductSummary } from "@/lib/queries";
import type { QuickViewData } from "./QuickViewDialog";

// Nút "Xem nhanh" trên thẻ sản phẩm (mục 3.1 + 3.3 đặc tả Ngày 6).
//
// Bản thân nút là một liên kết thật tới trang chi tiết (<a href>)
// nên khi tắt JS hoặc JS chưa tải, bấm vào vẫn vào trang chi tiết
// (không có nút chết — D6-19). Khi JS bật, click bị chặn và mở cửa
// sổ <dialog>. Dữ liệu nạp trước khi di chuột/focus vào nút (máy
// tính) và giữ trong bộ nhớ đệm phiên theo c/p để mở tức thì. Cửa sổ
// tải lười (next/dynamic, chỉ tải khi người dùng tương tác lần đầu)
// để không tăng First Load JS.
const QuickViewDialog = dynamic(() => import("./QuickViewDialog"), {
  ssr: false,
});

// Bộ nhớ đệm trong phiên theo c/p + yêu cầu đang bay (tránh gọi trùng).
const quickViewCache = new Map<string, QuickViewData>();
const quickViewInflight = new Map<string, Promise<QuickViewData>>();

async function fetchQuickView(categorySlug: string, productSlug: string): Promise<QuickViewData> {
  const key = `${categorySlug}/${productSlug}`;
  const cached = quickViewCache.get(key);
  if (cached) return cached;
  const inflight = quickViewInflight.get(key);
  if (inflight) return inflight;
  const promise = fetch(
    `/api/quick-view?c=${encodeURIComponent(categorySlug)}&p=${encodeURIComponent(productSlug)}`,
  )
    .then((res) => {
      if (!res.ok) throw new Error(`quick-view ${res.status}`);
      return res.json() as Promise<QuickViewData>;
    })
    .then((data) => {
      quickViewCache.set(key, data);
      quickViewInflight.delete(key);
      return data;
    })
    .catch((error: unknown) => {
      quickViewInflight.delete(key);
      throw error;
    });
  quickViewInflight.set(key, promise);
  return promise;
}

export default function QuickViewButton({ product }: { product: ProductSummary }) {
  const buttonRef = useRef<HTMLAnchorElement | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [data, setData] = useState<QuickViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const detailHref = `/${product.categorySlug}/${product.slug}`;

  const load = useCallback(async () => {
    const key = `${product.categorySlug}/${product.slug}`;
    if (quickViewCache.has(key)) {
      setData(quickViewCache.get(key) ?? null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const quickData = await fetchQuickView(product.categorySlug, product.slug);
      setData(quickData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [product.categorySlug, product.slug]);

  // Nạp trước khi di chuột/focus vào nút (máy tính) để mở tức thì.
  const preload = () => {
    void load();
  };

  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setShowDialog(true);
    void load();
  };

  // Đóng cửa sổ → trả focus về nút "Xem nhanh" đã bấm (mục 3.3).
  const close = () => {
    setShowDialog(false);
    buttonRef.current?.focus();
  };

  return (
    <>
      <a
        ref={buttonRef}
        href={detailHref}
        aria-label={`Xem nhanh ${product.name}`}
        onClick={open}
        onMouseEnter={preload}
        onFocus={preload}
        className="flex min-h-11 flex-1 items-center justify-center rounded-[3px] border border-green-800 px-2 text-sm font-bold text-green-800 transition-colors duration-150 hover:bg-cream-100 active:scale-[0.97]"
      >
        Xem nhanh
      </a>
      {showDialog ? (
        <QuickViewDialog
          data={data}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          onClose={close}
          detailHref={detailHref}
        />
      ) : null}
    </>
  );
}
