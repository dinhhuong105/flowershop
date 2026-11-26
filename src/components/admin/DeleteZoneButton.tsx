// Nút xóa khu vực giao hàng (Ngày 12 C1/C2 — theo mẫu
// DeleteCategoryButton). Khu vực đã có đơn thì nút thùng rác bị
// khóa, tooltip ghi rõ đã có đơn (AdminIconButton disabled vẫn hiện
// tooltip khi hover nhờ wrapper <span class="group">). Khu vực chưa
// có đơn: bấm mở hộp xác nhận <dialog> (căn giữa nhờ m-auto), xác
// nhận thì gửi Server Action xóa; máy chủ kiểm lại số đơn nên lỗi
// đồng thời (vừa có đơn mới) vẫn hiện trong hộp thoại.

"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteZoneAction } from "@/app/actions/admin";
import AdminIconButton, { TrashIcon } from "@/components/admin/AdminIconButton";

export default function DeleteZoneButton({
  zoneId,
  name,
  orderCount,
}: {
  zoneId: number;
  name: string;
  orderCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, dispatch] = useActionState(deleteZoneAction.bind(null, zoneId), {
    ok: false,
    error: null,
  });

  // Xóa xong: action đã revalidate danh sách — đóng hộp thoại.
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  if (orderCount > 0) {
    return (
      <AdminIconButton
        label={`Đã có ${orderCount} đơn, không xóa được`}
        icon={TrashIcon}
        disabled
        tooltipAlign="right"
        largeOnMobile
        className="border border-slate-200 bg-white text-slate-300"
      />
    );
  }

  return (
    <>
      <AdminIconButton
        label="Xóa khu vực"
        icon={TrashIcon}
        tooltipAlign="right"
        largeOnMobile
        onClick={() => dialogRef.current?.showModal()}
        className="border border-danger/40 bg-white text-danger hover:bg-danger/5"
      />
      <dialog
        ref={dialogRef}
        aria-label={`Xác nhận xóa khu vực ${name}`}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <form action={dispatch}>
          <p className="text-base font-bold text-slate-900">Xóa khu vực {name}?</p>
          <p className="mt-2 text-sm text-slate-500">
            Khu vực sẽ bị xóa hẳn và không khôi phục được. Khu vực này hiện chưa có đơn nào nên
            việc xóa là an toàn.
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
              Xóa khu vực
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
