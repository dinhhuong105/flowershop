// Nút Ẩn/Hiện sản phẩm trong danh sách quản trị (Ngày 7 §3).
// Bấm lần đầu mở hộp xác nhận <dialog> gốc; xác nhận mới gửi.
// Không JS: form gửi thẳng (không có hộp xác nhận) — vẫn đổi được.

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminIconButton, {
  EyeIcon,
  EyeOffIcon,
} from "@/components/admin/AdminIconButton";
import {
  toggleProductAction,
  type ToggleProductState,
} from "@/app/actions/admin";

export default function ToggleActiveButton({
  productId,
  productName,
  isActive,
}: {
  productId: number;
  productName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const confirmedRef = useRef(false);
  const [state, dispatch] = useActionState<ToggleProductState, FormData>(
    toggleProductAction,
    { ok: false, error: null },
  );

  useEffect(() => {
    if (state.ok) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state.ok, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Lần gửi từ nút xác nhận trong dialog → cho đi. Lần bấm nút
    // ngoài → chặn lại, mở dialog xác nhận.
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return;
    }
    event.preventDefault();
    dialogRef.current?.showModal();
  }

  const label = isActive ? "Ẩn sản phẩm" : "Hiện lại";
  return (
    <>
      <form ref={formRef} action={dispatch} onSubmit={handleSubmit}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
        {/* Nút kích hoạt dạng icon (25/11): tooltip = đúng nhãn cũ. */}
        <AdminIconButton
          type="submit"
          label={label}
          icon={isActive ? EyeOffIcon : EyeIcon}
          className="border border-slate-200 bg-white text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-600"
        />
      </form>
      <dialog
        ref={dialogRef}
        aria-label={`Xác nhận ${label.toLowerCase()}`}
        className="w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <p className="text-base font-bold text-slate-900">
          {isActive
            ? `Ẩn sản phẩm "${productName}"?`
            : `Hiện lại sản phẩm "${productName}"?`}
        </p>
        {isActive ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Sản phẩm sẽ biến khỏi trang chủ, danh mục, tìm kiếm, gợi ý và
            Xem nhanh. Giỏ hàng đang chứa sản phẩm này sẽ không đặt được
            đơn cho tới khi xóa dòng đó.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Sản phẩm sẽ hiện lại trên trang công khai.
          </p>
        )}
        {state.error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              confirmedRef.current = true;
              formRef.current?.requestSubmit();
            }}
            className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Xác nhận
          </button>
        </div>
      </dialog>
    </>
  );
}
