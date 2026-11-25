// Các nút thao tác trên chi tiết đơn (Ngày 8 §2.2): chuyển trạng thái
// sang bước hợp lệ tiếp theo, hủy đơn (bắt buộc lý do, hộp xác nhận),
// đánh dấu đã thanh toán, gửi lại thông báo Telegram. Chỉ hiện nút
// của bước hợp lệ tiếp theo; mọi nút cao ≥ 44 px. Lỗi từ Server Action
// hiện ngay dưới nhóm nút (role=alert).

"use client";

import { useActionState, useRef, useState } from "react";
import {
  advanceOrderAction,
  cancelOrderAction,
  markPaidOrderAction,
  resendNotificationAction,
  type AdminOrderActionState,
} from "@/app/actions/admin-orders";
import type { OrderStatus } from "@prisma/client";
import AdminIconButton, {
  ArrowRightIcon,
  BanknoteIcon,
  SendIcon,
  TrashIcon,
} from "@/components/admin/AdminIconButton";

const INITIAL_STATE: AdminOrderActionState = { ok: false, error: null };

export default function OrderDetailActions({
  code,
  status,
  paymentStatus,
  notifiedAt,
  telegramConfigured,
  nextSteps,
}: {
  code: string;
  status: OrderStatus;
  paymentStatus: string;
  notifiedAt: Date | null;
  telegramConfigured: boolean;
  nextSteps: Array<{ to: OrderStatus; label: string }>;
}) {
  const [advanceState, advanceDispatch] = useActionState(
    advanceOrderAction,
    INITIAL_STATE,
  );
  const [cancelState, cancelDispatch] = useActionState(
    cancelOrderAction,
    INITIAL_STATE,
  );
  const [paidState, paidDispatch] = useActionState(
    markPaidOrderAction,
    INITIAL_STATE,
  );
  const [resendState, resendDispatch] = useActionState(
    resendNotificationAction,
    INITIAL_STATE,
  );
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [reason, setReason] = useState("");

  const error = advanceState.error ?? cancelState.error ?? paidState.error ?? resendState.error;
  const showMarkPaid = paymentStatus === "UNPAID" && status !== "CANCELLED";
  const showResend = notifiedAt === null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {nextSteps
          .filter((s) => s.to !== "CANCELLED")
          .map((step) => (
            <form key={step.to} action={advanceDispatch}>
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="from" value={status} />
              <input type="hidden" name="to" value={step.to} />
              {/* Nút bước tiếp theo dạng icon (25/11): tooltip = đúng nhãn bước. */}
              <AdminIconButton
                type="submit"
                label={step.label}
                icon={ArrowRightIcon}
                className="bg-blue-600 text-white hover:opacity-90"
              />
            </form>
          ))}
        {nextSteps.some((s) => s.to === "CANCELLED") ? (
          <AdminIconButton
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            label="Hủy đơn"
            icon={TrashIcon}
            className="border border-red-600 bg-white text-red-600 hover:bg-red-50"
          />
        ) : null}
        {showMarkPaid ? (
          <form action={paidDispatch}>
            <input type="hidden" name="code" value={code} />
            <AdminIconButton
              type="submit"
              label="Đánh dấu đã thanh toán"
              icon={BanknoteIcon}
              className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
            />
          </form>
        ) : null}
        {showResend ? (
          <form action={resendDispatch}>
            <input type="hidden" name="code" value={code} />
            {/* Khi chưa cấu hình Telegram nút vẫn hiện tooltip
                "Chưa cấu hình Telegram" (nhờ wrapper group). */}
            <AdminIconButton
              type="submit"
              disabled={!telegramConfigured}
              label={
                telegramConfigured
                  ? "Gửi lại thông báo Telegram"
                  : "Chưa cấu hình Telegram"
              }
              icon={SendIcon}
              className="border border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </form>
        ) : null}
      </div>
      {showResend && !telegramConfigured ? (
        <p className="mt-2 text-sm text-slate-500">
          Chưa cấu hình Telegram nên không gửi được thông báo.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label="Xác nhận hủy đơn"
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <form action={cancelDispatch}>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="from" value={status} />
          <p className="text-base font-bold text-slate-900">Hủy đơn {code}?</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Đơn đã hủy không thể chuyển trạng thái được nữa. Lý do hủy là
            bắt buộc và sẽ lưu vào nhật ký đơn.
          </p>
          <label htmlFor="cancel-reason" className="mt-4 block text-sm font-semibold text-slate-900">
            Lý do hủy (3–200 ký tự)
          </label>
          <textarea
            id="cancel-reason"
            name="reason"
            required
            minLength={3}
            maxLength={200}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900"
          />
          {cancelState.error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {cancelState.error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              Không hủy
            </button>
            <button
              type="submit"
              className="flex min-h-11 items-center justify-center rounded-lg bg-danger px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Xác nhận hủy
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
