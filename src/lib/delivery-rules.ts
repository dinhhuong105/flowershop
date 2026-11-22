// Quy tắc thời gian giao hàng (mục 6.2 đặc tả Ngày 5). Hàm thuần, có
// test. Mọi tính toán dùng GIỜ VIỆT NAM (Asia/Ho_Chi_Minh) bất kể múi
// giờ máy chủ (container thường chạy UTC) — xem D5-6.

import { deliveryConfig, type DeliveryMethodId } from "@/config/delivery";

export type VnDateTime = {
  date: string; // YYYY-MM-DD theo giờ VN
  minutes: number; // số phút từ 00:00 theo giờ VN
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Lấy ngày + phút trong ngày theo giờ VN từ một Date.
export function vnNow(date: Date): VnDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: deliveryConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// Cộng/trừ ngày trên lịch (tính theo ngày UTC để không phụ thuộc TZ máy chủ).
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Giao nhanh 2 giờ: khả dụng khi openTime ≤ t và t + minLead ≤ closeTime
// (tức 07:30 ≤ t ≤ 19:00).
export function isExpressAvailable(now: Date): boolean {
  const { minutes } = vnNow(now);
  return (
    minutes >= toMinutes(deliveryConfig.openTime) &&
    minutes + deliveryConfig.minLeadMinutes <= toMinutes(deliveryConfig.closeTime)
  );
}

// Giao trong ngày: khả dụng khi openTime ≤ t và t + minLead ≤
// sameDayDeliverBy (tức 07:30 ≤ t ≤ 16:00).
export function isSameDayAvailable(now: Date): boolean {
  const { minutes } = vnNow(now);
  return (
    minutes >= toMinutes(deliveryConfig.openTime) &&
    minutes + deliveryConfig.minLeadMinutes <= toMinutes(deliveryConfig.sameDayDeliverBy)
  );
}

// Hẹn ngày giờ: luôn chọn được; ngày từ hôm nay tới hôm nay +
// maxAdvanceDays; nếu là hôm nay thì khung giờ phải bắt đầu sau
// t + minLeadMinutes — NGOẠI LỆ theo bảng mục 6.2: lúc 15:00
// (t + 120 đúng bằng 17:00) khung cuối ngày 17:00 vẫn chọn được,
// trong khi lúc 11:00 (t + 120 đúng bằng 13:00) khung 13:00 KHÔNG
// chọn được. Bảng là tiêu chí nghiệm thu (D5-5) nên hàm này khớp bảng
// đúng từng ca; điểm không nhất quán này đã ghi trong báo cáo Ngày 5
// để Claude xác nhận.
export function availableSlotsToday(now: Date): string[] {
  const { minutes } = vnNow(now);
  const ready = minutes + deliveryConfig.minLeadMinutes;
  const slots = deliveryConfig.slots;
  return slots
    .filter((slot, index) => {
      const start = toMinutes(slot.start);
      if (start > ready) return true;
      if (start === ready && index === slots.length - 1) return true;
      return false;
    })
    .map((slot) => slot.id);
}

// Ngày giao hợp lệ: đúng định dạng YYYY-MM-DD, là ngày có thật, từ hôm
// nay tới hôm nay + maxAdvanceDays.
export function isValidDeliveryDate(dateStr: string, now: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Ngày không có thật (ví dụ 2026-02-30) bị Date lăn sang tháng sau.
  if (d.toISOString().slice(0, 10) !== dateStr) return false;
  const today = vnNow(now).date;
  return dateStr >= today && dateStr <= addDays(today, deliveryConfig.maxAdvanceDays);
}

// Khung giờ còn chọn được cho một ngày giao: ngày khác hôm nay thì đủ
// 5 khung; hôm nay thì lọc theo availableSlotsToday.
export function availableSlotsForDate(dateStr: string, now: Date): string[] {
  if (!isValidDeliveryDate(dateStr, now)) return [];
  if (dateStr !== vnNow(now).date) {
    return deliveryConfig.slots.map((slot) => slot.id);
  }
  return availableSlotsToday(now);
}

export function slotLabel(slotId: string): string | null {
  return deliveryConfig.slots.find((s) => s.id === slotId)?.label ?? null;
}

// Ngày giao + khung giờ lưu vào đơn theo phương thức (mục 6.2/6.3):
// EXPRESS_2H → hôm nay, "trong 2 giờ"; SAME_DAY → hôm nay, "trong
// ngày"; SCHEDULED → ngày và khung giờ khách chọn (lưu nhãn khung giờ).
// Trả null khi lựa chọn không hợp lệ tại thời điểm now.
export function resolveDelivery(
  method: DeliveryMethodId,
  dateStr: string | null,
  slotId: string | null,
  now: Date,
): { deliveryDate: string; deliverySlot: string } | null {
  const today = vnNow(now).date;
  if (method === "EXPRESS_2H") {
    if (!isExpressAvailable(now)) return null;
    return { deliveryDate: today, deliverySlot: "trong 2 giờ" };
  }
  if (method === "SAME_DAY") {
    if (!isSameDayAvailable(now)) return null;
    return { deliveryDate: today, deliverySlot: "trong ngày" };
  }
  if (!dateStr || !slotId) return null;
  if (!availableSlotsForDate(dateStr, now).includes(slotId)) return null;
  const label = slotLabel(slotId);
  if (!label) return null;
  return { deliveryDate: dateStr, deliverySlot: label };
}
