// Chọn phương thức giao hàng: 3 thẻ radio (mục 5 + 6.2 đặc tả Ngày
// 5). Viền thẻ đổi màu trong 150ms khi chọn.

import { deliveryConfig } from "@/config/delivery";
import { formatVND } from "@/lib/format";
import { FieldError, RequiredMark } from "./PersonFields";

export default function DeliveryMethodPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const methods = deliveryConfig.methods.filter((m) => m.enabled);
  return (
    <fieldset>
      <legend className="text-lg font-semibold text-ink">
        Phương thức giao hàng
        <RequiredMark />
      </legend>
      <div className="mt-3 space-y-3" role="radiogroup" aria-required="true">
        {methods.map((method) => {
          const selected = value === method.id;
          return (
            <label
              key={method.id}
              className={`block cursor-pointer rounded-[3px] border-2 bg-white p-4 transition-colors duration-150 ${
                selected ? "border-green-800" : "border-line"
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value={method.id}
                  checked={selected}
                  onChange={() => onChange(method.id)}
                  aria-describedby={error ? "error-deliveryMethod" : undefined}
                  className="mt-1 h-4 w-4 shrink-0 accent-green-800"
                />
                <span>
                  <span className="block font-bold text-ink">{method.label}</span>
                  <span className="block text-sm text-ink-soft">{method.description}</span>
                  {method.surcharge > 0 ? (
                    <span className="block text-sm font-semibold text-ink">
                      Phụ phí {formatVND(method.surcharge)}
                    </span>
                  ) : null}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id="error-deliveryMethod" message={error} />
    </fieldset>
  );
}
