// Nhóm trường người đặt + người nhận (mục 5 đặc tả Ngày 5).
// "Giống người đặt" bật mặc định: hai ô người nhận bị vô hiệu hóa và
// hiển thị tên + số của người đặt (máy chủ cũng dùng giá trị người đặt
// khi ô này bật); tắt đi thì nhập riêng tên + số + địa chỉ.

import type { CheckoutFormValues } from "@/lib/checkout-validation";

export type FieldErrors = Partial<Record<keyof CheckoutFormValues, string>>;

export const inputClass = (hasError: boolean) =>
  `mt-1 w-full rounded-[3px] border bg-white px-3 py-2.5 text-ink placeholder:text-muted focus:outline-none ${
    hasError ? "border-danger" : "border-line focus:border-green-800"
  }`;

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-danger">
      {" "}
      *
    </span>
  );
}

export default function PersonFields({
  values,
  errors,
  onChange,
}: {
  values: CheckoutFormValues;
  errors: FieldErrors;
  onChange: (field: keyof CheckoutFormValues, value: string | boolean) => void;
}) {
  const same = values.sameAsSender;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-lg font-semibold text-ink">Người đặt hàng</legend>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="field-senderName" className="block text-sm font-semibold text-ink">
              Họ tên người đặt
              <RequiredMark />
            </label>
            <input
              id="field-senderName"
              name="senderName"
              type="text"
              autoComplete="name"
              value={values.senderName}
              onChange={(e) => onChange("senderName", e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.senderName}
              aria-describedby={errors.senderName ? "error-senderName" : undefined}
              className={inputClass(!!errors.senderName)}
            />
            <FieldError id="error-senderName" message={errors.senderName} />
          </div>
          <div>
            <label htmlFor="field-senderPhone" className="block text-sm font-semibold text-ink">
              Số điện thoại người đặt
              <RequiredMark />
            </label>
            <input
              id="field-senderPhone"
              name="senderPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.senderPhone}
              onChange={(e) => onChange("senderPhone", e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.senderPhone}
              aria-describedby={errors.senderPhone ? "error-senderPhone" : undefined}
              className={inputClass(!!errors.senderPhone)}
            />
            <FieldError id="error-senderPhone" message={errors.senderPhone} />
          </div>
          <div>
            <label htmlFor="field-senderEmail" className="block text-sm font-semibold text-ink">
              Email (không bắt buộc)
            </label>
            <input
              id="field-senderEmail"
              name="senderEmail"
              type="email"
              autoComplete="email"
              value={values.senderEmail}
              onChange={(e) => onChange("senderEmail", e.target.value)}
              aria-invalid={!!errors.senderEmail}
              aria-describedby={errors.senderEmail ? "error-senderEmail" : undefined}
              className={inputClass(!!errors.senderEmail)}
            />
            <FieldError id="error-senderEmail" message={errors.senderEmail} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-ink">Người nhận hoa</legend>
        <div className="mt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="sameAsSender"
              value="on"
              checked={same}
              onChange={(e) => onChange("sameAsSender", e.target.checked)}
              className="h-4 w-4 accent-green-800"
            />
            Giống người đặt
          </label>
        </div>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor="field-receiverName" className="block text-sm font-semibold text-ink">
              Họ tên người nhận
              <RequiredMark />
            </label>
            <input
              id="field-receiverName"
              name="receiverName"
              type="text"
              autoComplete="name"
              value={same ? values.senderName : values.receiverName}
              onChange={(e) => onChange("receiverName", e.target.value)}
              disabled={same}
              aria-required="true"
              aria-invalid={!!errors.receiverName}
              aria-describedby={errors.receiverName ? "error-receiverName" : undefined}
              className={`${inputClass(!!errors.receiverName)} ${same ? "bg-cream-100 text-muted" : ""}`}
            />
            <FieldError id="error-receiverName" message={errors.receiverName} />
          </div>
          <div>
            <label htmlFor="field-receiverPhone" className="block text-sm font-semibold text-ink">
              Số điện thoại người nhận
              <RequiredMark />
            </label>
            <input
              id="field-receiverPhone"
              name="receiverPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={same ? values.senderPhone : values.receiverPhone}
              onChange={(e) => onChange("receiverPhone", e.target.value)}
              disabled={same}
              aria-required="true"
              aria-invalid={!!errors.receiverPhone}
              aria-describedby={errors.receiverPhone ? "error-receiverPhone" : undefined}
              className={`${inputClass(!!errors.receiverPhone)} ${same ? "bg-cream-100 text-muted" : ""}`}
            />
            <FieldError id="error-receiverPhone" message={errors.receiverPhone} />
          </div>
          <div>
            <label htmlFor="field-address" className="block text-sm font-semibold text-ink">
              Địa chỉ nhận hàng
              <RequiredMark />
            </label>
            <input
              id="field-address"
              name="address"
              type="text"
              autoComplete="street-address"
              value={values.address}
              onChange={(e) => onChange("address", e.target.value)}
              aria-required="true"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? "error-address" : undefined}
              className={inputClass(!!errors.address)}
            />
            <FieldError id="error-address" message={errors.address} />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
