// Form thanh toán một trang (mục 5 đặc tả Ngày 5): dùng
// useActionState với Server Action placeOrder — lỗi thì giữ lại giá
// trị đã nhập và focus vào trường lỗi đầu tiên. Tắt JS vẫn đặt được:
// nút gửi chỉ bị vô hiệu hóa sau khi hydration (mounted), khối
// ngày/giờ mặc định mở, máy chủ kiểm tra lại toàn bộ.

"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { availableSlotsForDate } from "@/lib/delivery-rules";
import { deliveryConfig } from "@/config/delivery";
import { formatVND } from "@/lib/format";
import type { CartData } from "@/lib/cart";
import {
  placeOrder,
} from "@/app/actions/order";
import { initialCheckoutState, type CheckoutState } from "@/lib/checkout-state";
import type { CheckoutFormValues } from "@/lib/checkout-validation";
import PersonFields, { FieldError, RequiredMark, inputClass } from "./PersonFields";
import DeliveryMethodPicker from "./DeliveryMethodPicker";
import SlotPicker from "./SlotPicker";
import PaymentMethodPicker from "./PaymentMethodPicker";
import OrderSummary from "./OrderSummary";

export type ZoneOption = { id: number; name: string; fee: number };

const FIELD_ORDER: Array<keyof CheckoutFormValues> = [
  "senderName",
  "senderPhone",
  "senderEmail",
  "receiverName",
  "receiverPhone",
  "address",
  "zoneId",
  "deliveryMethod",
  "deliveryDate",
  "deliverySlot",
  "cardMessage",
  "note",
  "paymentMethod",
];

export default function CheckoutForm({
  cart,
  zones,
  bankConfigured,
}: {
  cart: CartData;
  zones: ZoneOption[];
  bankConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState<CheckoutState, FormData>(
    placeOrder,
    initialCheckoutState,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Giá trị các trường (controlled) — đồng bộ từ state sau mỗi lần
  // gửi, để giá trị đã nhập không mất khi máy chủ trả lỗi.
  const [v, setV] = useState<CheckoutFormValues>(state.values);
  useEffect(() => {
    setV(state.values);
  }, [state]);

  // Focus vào trường lỗi đầu tiên sau một lần gửi lỗi (D5-11).
  useEffect(() => {
    const first = FIELD_ORDER.find((f) => state.fieldErrors[f]);
    if (first) {
      document.getElementById(`field-${first}`)?.focus();
    }
  }, [state]);

  const errors = state.fieldErrors;
  const hasErrors = state.formError !== null || Object.keys(errors).length > 0;

  const update = (field: keyof CheckoutFormValues, value: string | boolean) => {
    setV((prev) => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (date: string) => {
    setV((prev) => {
      const next = { ...prev, deliveryDate: date };
      if (
        date !== "" &&
        prev.deliverySlot !== "" &&
        !availableSlotsForDate(date, new Date()).includes(prev.deliverySlot)
      ) {
        next.deliverySlot = "";
      }
      return next;
    });
  };

  // Nút gửi chỉ bật khi đã chọn đủ khu vực + phương thức giao +
  // phương thức thanh toán (+ ngày/khung giờ nếu hẹn giao). Chưa
  // hydration thì nút luôn bật để tắt JS vẫn gửi được.
  const ready =
    v.zoneId !== "" &&
    v.deliveryMethod !== "" &&
    v.paymentMethod !== "" &&
    (v.deliveryMethod !== "SCHEDULED" || (v.deliveryDate !== "" && v.deliverySlot !== ""));
  const dateSlotOpen = !mounted || v.deliveryMethod === "" || v.deliveryMethod === "SCHEDULED";

  return (
    <form action={formAction} className="mt-6">
      {/* Honeypot chống bot (mục 6.1): ẩn khỏi màn hình, bot điền vào
          thì yêu cầu bị bỏ qua, không tạo đơn, không báo lỗi. */}
      <input
        type="text"
        name="website"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden="true"
        defaultValue=""
        className="absolute -left-[9999px] h-px w-px opacity-0"
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          {hasErrors ? (
            <div role="alert" className="rounded-[3px] border border-danger bg-white p-4">
              <p className="font-bold text-danger">Vui lòng kiểm tra lại thông tin đặt hàng:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-danger">
                {state.formError ? <li>{state.formError}</li> : null}
                {FIELD_ORDER.filter((f) => errors[f]).map((f) => (
                  <li key={f}>{errors[f]}</li>
                ))}
              </ul>
              {state.duplicateCode ? (
                <p className="mt-2 text-sm">
                  <Link
                    href={`/don-hang/${state.duplicateCode}`}
                    className="font-semibold text-green-800 hover:underline"
                  >
                    Xem đơn hàng đã đặt →
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <PersonFields values={v} errors={errors} onChange={update} />

          <div>
            <label htmlFor="field-zoneId" className="block text-sm font-semibold text-ink">
              Khu vực giao hàng
              <RequiredMark />
            </label>
            <select
              id="field-zoneId"
              name="zoneId"
              value={v.zoneId}
              onChange={(e) => update("zoneId", e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.zoneId}
              aria-describedby={errors.zoneId ? "error-zoneId" : undefined}
              className={inputClass(!!errors.zoneId)}
            >
              <option value="">— Chọn khu vực giao hàng —</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} – {formatVND(zone.fee)}
                </option>
              ))}
            </select>
            <FieldError id="error-zoneId" message={errors.zoneId} />
          </div>

          <DeliveryMethodPicker
            value={v.deliveryMethod}
            onChange={(id) => update("deliveryMethod", id)}
            error={errors.deliveryMethod}
          />

          {/* Khối ngày/khung giờ: mở bằng grid-template-rows 250ms khi
              chọn SCHEDULED (hoặc chưa chọn gì); thu lại khi chọn
              phương thức khác. SSR luôn mở để tắt JS vẫn thấy đủ trường;
              máy chủ bỏ qua ngày/giờ khi không phải SCHEDULED. */}
          <div
            className="grid transition-[grid-template-rows] duration-[250ms]"
            style={{ gridTemplateRows: dateSlotOpen ? "1fr" : "0fr" }}
          >
            <div className="min-h-0 overflow-hidden" inert={!dateSlotOpen ? true : undefined}>
              <SlotPicker
                date={v.deliveryDate}
                slot={v.deliverySlot}
                onDateChange={handleDateChange}
                onSlotChange={(slot) => update("deliverySlot", slot)}
                dateError={errors.deliveryDate}
                slotError={errors.deliverySlot}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="field-cardMessage" className="block text-sm font-semibold text-ink">
                Lời nhắn trên thiệp (không bắt buộc)
              </label>
              <textarea
                id="field-cardMessage"
                name="cardMessage"
                rows={3}
                maxLength={200}
                value={v.cardMessage}
                onChange={(e) => update("cardMessage", e.target.value)}
                aria-invalid={!!errors.cardMessage}
                aria-describedby={
                  errors.cardMessage ? "error-cardMessage" : "cardMessage-count"
                }
                className={inputClass(!!errors.cardMessage)}
              />
              <p id="cardMessage-count" className="mt-1 text-right text-xs text-muted">
                {v.cardMessage.length}/200 ký tự
              </p>
              <FieldError id="error-cardMessage" message={errors.cardMessage} />
            </div>
            <div>
              <label htmlFor="field-note" className="block text-sm font-semibold text-ink">
                Ghi chú cho shop (không bắt buộc)
              </label>
              <textarea
                id="field-note"
                name="note"
                rows={2}
                maxLength={300}
                value={v.note}
                onChange={(e) => update("note", e.target.value)}
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "error-note" : "note-count"}
                className={inputClass(!!errors.note)}
              />
              <p id="note-count" className="mt-1 text-right text-xs text-muted">
                {v.note.length}/300 ký tự
              </p>
              <FieldError id="error-note" message={errors.note} />
            </div>
          </div>

          <PaymentMethodPicker
            value={v.paymentMethod}
            onChange={(id) => update("paymentMethod", id)}
            bankConfigured={bankConfigured}
            error={errors.paymentMethod}
          />

          <button
            type="submit"
            disabled={(mounted && !ready) || isPending}
            className="flex min-h-12 w-full items-center justify-center rounded-[3px] bg-gold-300 px-4 text-base font-bold uppercase tracking-wide text-green-900 transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Đang đặt hàng..." : "Tiến hành đặt hàng"}
          </button>
          <p className="text-center text-xs text-muted">
            Giỏ hàng của bạn sẽ được giữ nguyên nếu thông tin chưa đúng — hãy kiểm tra lại và gửi
            lại.
          </p>
        </div>

        <OrderSummary cart={cart} zones={zones} zoneId={v.zoneId} methodId={v.deliveryMethod} />
      </div>
      <p className="sr-only">
        Giờ làm việc {deliveryConfig.openTime} – {deliveryConfig.closeTime}. Giao trong ngày trước{" "}
        {deliveryConfig.sameDayDeliverBy}.
      </p>
    </form>
  );
}
