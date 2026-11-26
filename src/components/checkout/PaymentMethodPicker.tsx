// Chọn phương thức thanh toán (mục 5 đặc tả Ngày 5): COD luôn có;
// "Chuyển khoản" chỉ hiện khi ngân hàng đã cấu hình trong cài đặt
// (không có số tài khoản giả). Viền thẻ đổi màu trong 150ms khi chọn.

import { FieldError, RequiredMark } from "./PersonFields";

export default function PaymentMethodPicker({
  value,
  onChange,
  bankConfigured,
  error,
}: {
  value: string;
  onChange: (id: string) => void;
  bankConfigured: boolean;
  error?: string;
}) {
  const options = [
    {
      id: "COD",
      label: "Thanh toán khi nhận hàng (COD)",
      description: "Thanh toán bằng tiền mặt khi nhận hoa.",
    },
    ...(bankConfigured
      ? [
          {
            id: "BANK_TRANSFER",
            label: "Chuyển khoản ngân hàng",
            description: "Quét mã QR VietQR trên trang xác nhận đơn hàng.",
          },
        ]
      : []),
  ];
  return (
    <fieldset>
      <legend className="text-lg font-semibold text-ink">
        Phương thức thanh toán
        <RequiredMark />
      </legend>
      <div className="mt-3 space-y-3" role="radiogroup" aria-required="true">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={`block cursor-pointer rounded-[3px] border-2 bg-white p-4 transition-colors duration-150 ${
                selected ? "border-green-800" : "border-line"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.id}
                  checked={selected}
                  onChange={() => onChange(option.id)}
                  aria-describedby={error ? "error-paymentMethod" : undefined}
                  className="mt-1 h-4 w-4 shrink-0 accent-green-800"
                />
                <span>
                  <span className="block font-bold text-ink">{option.label}</span>
                  <span className="block text-sm text-ink-soft">{option.description}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id="error-paymentMethod" message={error} />
    </fieldset>
  );
}
