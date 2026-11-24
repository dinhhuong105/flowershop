// Server Actions quản trị đơn hàng (Ngày 8 §2).
//
// MỌI action ở đây mở đầu bằng `await requireAdmin()` (D8-2).
// Chỉ nhận các trường cho phép trong FormData — code, trạng thái đang
// hiển thị, lý do hủy, ghi chú. Trạng thái đích KHÔNG tin mù: phải
// nằm trong bước hợp lệ tiếp theo của trạng thái đang hiển thị (kiểm
// bằng bảng chuyển trong lib), và cập nhật có điều kiện theo trạng
// thái đang hiển thị (chống bấm đúp/hai tab).

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import {
  isValidOrderTransition,
  markOrderPaid,
  resendOrderNotification,
  saveInternalNote,
  transitionOrder,
  validateCancelReason,
  validateInternalNote,
  type OrderMutationResult,
} from "@/lib/admin/orders";
import type { OrderStatus } from "@prisma/client";

export type AdminOrderActionState = { ok: boolean; error: string | null };

function fail(error: string): AdminOrderActionState {
  return { ok: false, error };
}

function getStr(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

const ORDER_STATUSES: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "DELIVERING",
  "COMPLETED",
  "CANCELLED",
];

function parseStatus(raw: string): OrderStatus | null {
  return (ORDER_STATUSES as string[]).includes(raw) ? (raw as OrderStatus) : null;
}

// Chuyển trạng thái sang bước hợp lệ tiếp theo (kể cả hủy — lý do bắt
// buộc, xem cancelOrderAction riêng). FormData: code, from (trạng thái
// đang hiển thị), to (trạng thái đích).
export async function advanceOrderAction(
  prevState: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  await requireAdmin();
  const code = getStr(formData, "code");
  const from = parseStatus(getStr(formData, "from"));
  const to = parseStatus(getStr(formData, "to"));
  if (!from || !to) return fail("Trạng thái không hợp lệ.");
  if (!isValidOrderTransition(from, to)) {
    return fail(`Không thể chuyển đơn từ ${from} sang ${to}.`);
  }
  const result: OrderMutationResult = await transitionOrder(code, to, from);
  if (!result.ok) return fail(result.error);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${code}`);
  redirect(`/admin/orders/${code}`);
}

// Hủy đơn: bắt buộc lý do 3–200 ký tự. FormData: code, from, reason.
export async function cancelOrderAction(
  prevState: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  await requireAdmin();
  const code = getStr(formData, "code");
  const from = parseStatus(getStr(formData, "from"));
  const reason = getStr(formData, "reason");
  if (!from) return fail("Trạng thái không hợp lệ.");
  const reasonError = validateCancelReason(reason);
  if (reasonError) return fail(reasonError);
  if (!isValidOrderTransition(from, "CANCELLED")) {
    return fail("Đơn này không thể hủy ở trạng thái hiện tại.");
  }
  const result: OrderMutationResult = await transitionOrder(code, "CANCELLED", from, {
    reason,
  });
  if (!result.ok) return fail(result.error);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${code}`);
  redirect(`/admin/orders/${code}`);
}

// Đánh dấu đã thanh toán (idempotent — bấm lại cũng ok). FormData: code.
export async function markPaidOrderAction(
  prevState: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  await requireAdmin();
  const code = getStr(formData, "code");
  const result: OrderMutationResult = await markOrderPaid(code);
  if (!result.ok) return fail(result.error);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${code}`);
  redirect(`/admin/orders/${code}`);
}

// Lưu ghi chú nội bộ (≤ 500 ký tự). FormData: code, note.
export async function saveNoteOrderAction(
  prevState: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  await requireAdmin();
  const code = getStr(formData, "code");
  const note = getStr(formData, "note");
  const noteError = validateInternalNote(note);
  if (noteError) return fail(noteError);
  const result: OrderMutationResult = await saveInternalNote(code, note);
  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/orders/${code}`);
  redirect(`/admin/orders/${code}`);
}

// Gửi lại thông báo Telegram (chỉ khi notifiedAt NULL và đã cấu hình
// Telegram; chống gửi trùng khi bấm đúp — xem lib). FormData: code.
export async function resendNotificationAction(
  prevState: AdminOrderActionState,
  formData: FormData,
): Promise<AdminOrderActionState> {
  await requireAdmin();
  const code = getStr(formData, "code");
  const result: OrderMutationResult = await resendOrderNotification(code);
  if (!result.ok) return fail(result.error);
  revalidatePath(`/admin/orders/${code}`);
  redirect(`/admin/orders/${code}`);
}
