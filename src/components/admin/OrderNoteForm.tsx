// Form ghi chú nội bộ trên chi tiết đơn (Ngày 8 §2.2): tùy chọn,
// tối đa 500 ký tự, văn bản thuần (React thoát khi hiển thị).

"use client";

import { useActionState } from "react";
import {
  saveNoteOrderAction,
  type AdminOrderActionState,
} from "@/app/actions/admin-orders";

export default function OrderNoteForm({
  code,
  initialNote,
}: {
  code: string;
  initialNote: string | null;
}) {
  const [state, dispatch] = useActionState<AdminOrderActionState, FormData>(
    saveNoteOrderAction,
    { ok: false, error: null },
  );
  return (
    <form action={dispatch} className="mt-3">
      <input type="hidden" name="code" value={code} />
      <label htmlFor="internal-note" className="block text-sm font-semibold text-slate-900">
        Ghi chú nội bộ (tối đa 500 ký tự)
      </label>
      <textarea
        id="internal-note"
        name="note"
        rows={3}
        maxLength={500}
        defaultValue={initialNote ?? ""}
        className="mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900"
      />
      {state.error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="mt-3 flex min-h-11 items-center justify-center rounded-lg border border-blue-600 bg-white px-5 text-sm font-bold text-blue-600 transition-colors hover:bg-slate-100"
      >
        Lưu ghi chú
      </button>
    </form>
  );
}
