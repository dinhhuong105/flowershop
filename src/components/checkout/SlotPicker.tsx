// Chọn ngày + khung giờ giao cho phương thức SCHEDULED (mục 5 +
// 6.2 đặc tả Ngày 5). Khung đã qua trong ngày hôm nay bị vô hiệu hóa;
// đổi ngày mà khung đang chọn không còn khả dụng thì xóa lựa chọn đó.

import { addDays, availableSlotsForDate, vnNow } from "@/lib/delivery-rules";
import { deliveryConfig } from "@/config/delivery";
import { FieldError, RequiredMark, inputClass } from "./PersonFields";

export default function SlotPicker({
  date,
  slot,
  onDateChange,
  onSlotChange,
  dateError,
  slotError,
}: {
  date: string;
  slot: string;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string) => void;
  dateError?: string;
  slotError?: string;
}) {
  const now = new Date();
  const today = vnNow(now).date;
  const maxDate = addDays(today, deliveryConfig.maxAdvanceDays);
  const available = date === "" ? deliveryConfig.slots.map((s) => s.id) : availableSlotsForDate(date, now);
  return (
    <div className="mt-3 space-y-4">
      <div>
        <label htmlFor="field-deliveryDate" className="block text-sm font-semibold text-ink">
          Ngày giao hàng
          <RequiredMark />
        </label>
        <input
          id="field-deliveryDate"
          name="deliveryDate"
          type="date"
          min={today}
          max={maxDate}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          aria-required="true"
          aria-invalid={!!dateError}
          aria-describedby={dateError ? "error-deliveryDate" : undefined}
          className={inputClass(!!dateError)}
        />
        <FieldError id="error-deliveryDate" message={dateError} />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          Khung giờ giao hàng
          <RequiredMark />
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-required="true">
          {deliveryConfig.slots.map((s) => {
            const disabled = !available.includes(s.id);
            const selected = slot === s.id;
            return (
              <label
                key={s.id}
                className={`cursor-pointer rounded-[3px] border-2 px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                  disabled
                    ? "cursor-not-allowed border-line bg-cream-100 text-muted line-through"
                    : selected
                      ? "border-green-800 bg-green-800 text-white"
                      : "border-line bg-white text-ink hover:border-green-800"
                }`}
              >
                <input
                  type="radio"
                  name="deliverySlot"
                  value={s.id}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onSlotChange(s.id)}
                  aria-describedby={slotError ? "error-deliverySlot" : undefined}
                  className="sr-only"
                />
                {s.label}
                {disabled ? " (đã qua)" : ""}
              </label>
            );
          })}
        </div>
        <FieldError id="error-deliverySlot" message={slotError} />
      </fieldset>
    </div>
  );
}
