// Nút xóa trang tĩnh (Ngày 13 B3 — theo mẫu DeleteZoneButton).
// Bấm mở hộp xác nhận <dialog> (căn giữa nhờ m-auto), xác nhận thì
// gửi Server Action xóa; máy chủ kiểm lại tồn tại nên lỗi đồng thời
// vẫn hiện trong hộp thoại.
"use client";

import { useActionState, useEffect, useRef } from "react";
import { deletePageAction } from "@/app/actions/admin";
import AdminIconButton, { TrashIcon } from "@/components/admin/AdminIconButton";

export default function DeletePageButton({
  pageId,
  title,
}: {
  pageId: number;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, dispatch] = useActionState(deletePageAction.bind(null, pageId), {
    ok: false,
    error: null,
  });

  // Xóa xong: action đã revalidate danh sách — đóng hộp thoại.
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  return (
    <>
      <AdminIconButton
        label="Xóa trang"
        icon={TrashIcon}
        tooltipAlign="right"
        largeOnMobile
        onClick={() => dialogRef.current?.showModal()}
        className="border border-danger/40 bg-white text-danger hover:bg-danger/5"
      />
      <dialog
        ref={dialogRef}
        aria-label={`Xác nhận xóa trang ${title}`}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <form action={dispatch}>
          <p className="text-base font-bold text-slate-900">Xóa trang {title}?</p>
          <p className="mt-2 text-sm text-slate-500">
            Trang sẽ bị xóa hẳn và không khôi phục được. Link /trang của trang này sẽ báo
            404 sau khi xóa.
          </p>
          {state.error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {state.error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              className="flex min-h-11 items-center justify-center rounded-lg bg-danger px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Xóa trang
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              Hủy
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
