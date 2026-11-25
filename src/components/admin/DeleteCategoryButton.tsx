// Nút xóa danh mục (25/11 — trang quản lý Danh mục). Danh mục còn
// sản phẩm thì nút thùng rác bị khóa, tooltip ghi rõ còn bao nhiêu
// sản phẩm (AdminIconButton disabled vẫn hiện tooltip khi hover nhờ
// wrapper <span class="group">). Danh mục trống: bấm mở hộp xác
// nhận <dialog> (căn giữa nhờ m-auto — lỗi popup lệch góc 25/11),
// xác nhận thì gửi Server Action xóa; máy chủ kiểm lại số sản phẩm
// nên lỗi đồng thời (vừa có sản phẩm mới) vẫn hiện trong hộp thoại.

"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteCategoryAction } from "@/app/actions/admin";
import AdminIconButton, { TrashIcon } from "@/components/admin/AdminIconButton";

export default function DeleteCategoryButton({
  categoryId,
  name,
  productCount,
}: {
  categoryId: number;
  name: string;
  productCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, dispatch] = useActionState(
    deleteCategoryAction.bind(null, categoryId),
    { ok: false, error: null },
  );

  // Xóa xong: action đã revalidate danh sách — đóng hộp thoại.
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  if (productCount > 0) {
    return (
      <AdminIconButton
        label={`Còn ${productCount} sản phẩm, không xóa được`}
        icon={TrashIcon}
        disabled
        tooltipAlign="right"
        className="border border-slate-200 bg-white text-slate-300"
      />
    );
  }

  return (
    <>
      <AdminIconButton
        label="Xóa danh mục"
        icon={TrashIcon}
        tooltipAlign="right"
        onClick={() => dialogRef.current?.showModal()}
        className="border border-danger/40 bg-white text-danger hover:bg-danger/5"
      />
      <dialog
        ref={dialogRef}
        aria-label={`Xác nhận xóa danh mục ${name}`}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <form action={dispatch}>
          <p className="text-base font-bold text-slate-900">Xóa danh mục {name}?</p>
          <p className="mt-2 text-sm text-slate-500">
            Danh mục sẽ bị xóa hẳn và không khôi phục được. Sản phẩm trong danh mục này
            hiện không có nên việc xóa là an toàn.
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
              Xóa danh mục
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
