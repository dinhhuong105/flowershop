// Giờ hiện tại theo giờ VN, dạng "HH:mm, dd/MM/yyyy" (Ngày 10 D10-3):
// dòng phụ dashboard cũ viết "lấy trực tiếp từ cơ sở dữ liệu" là
// ngôn ngữ kỹ thuật — đổi thành giờ cập nhật, tính lúc render.
// (Chuyển từ src/app/admin/page.tsx sang đây để unit test được —
// page.tsx import next/link nên không test trực tiếp bằng node --test.)
// Múi giờ tường minh Asia/Ho_Chi_Minh ở cả giờ và ngày: trên Vercel
// (chạy UTC) lúc 00:00–07:00 giờ VN, ngày UTC còn lùi một ngày so với
// ngày VN — không được để giờ lấy theo múi giờ máy chủ.
export function formatVnDateTime(now: Date): string {
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  return `${time}, ${date}`;
}

// Ngày theo giờ VN, dạng "dd/MM/yyyy" (Ngày 18 — ngày đăng bài
// tin tức). Múi giờ tường minh Asia/Ho_Chi_Minh như các hàm trên.
export function formatVnDate(now: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
}

// Ngày 19 A1 — hẹn giờ xuất bản tin tức (múi giờ VN).
//
// Ô datetime-local của trình duyệt gửi "YYYY-MM-DDTHH:mm" theo giờ
// TƯỜNG (giờ VN, không kèm múi giờ). VN cố định UTC+7, không có
// giờ mùa hè, nên đổi sang UTC bằng cách trừ đúng 7 giờ — không
// dùng `new Date(str)` (múi giờ máy chủ: local là UTC, Vercel
// cũng UTC, sẽ lệch 7 giờ).
// Ngược lại: Date → chuỗi "YYYY-MM-DDTHH:mm" theo giờ VN để làm
// defaultValue cho ô datetime-local khi sửa bài đã hẹn giờ.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const VN_DATETIME_LOCAL_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// "YYYY-MM-DDTHH:mm" (giờ VN) → Date (UTC) hoặc null khi sai định
// dạng / ngày-giờ không tồn tại (vd tháng 13, 25:00, 30/02).
export function parseVnDateTimeLocal(value: string): Date | null {
  const m = VN_DATETIME_LOCAL_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - VN_OFFSET_MS;
  const date = new Date(utcMs);
  // Kiểm lại từng thành phần theo giờ VN để loại ngày không tồn tại
  // (vd 30/02 bị Date.UTC tràn sang 02/03).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : -1;
  };
  if (
    get("year") !== year ||
    get("month") !== month ||
    get("day") !== day ||
    get("hour") !== hour ||
    get("minute") !== minute
  ) {
    return null;
  }
  return date;
}

// Date → "YYYY-MM-DDTHH:mm" theo giờ VN (null → "").
export function formatVnDateTimeLocal(date: Date | null): string {
  if (date === null) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string): string => {
    const p = parts.find((x) => x.type === type);
    return p ? p.value : "";
  };
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Giờ cho nhật ký hoạt động (Ngày 15 C1): dạng "dd/MM/yyyy HH:mm"
// (ngày trước, giờ sau — khác formatVnDateTime ở trên).
export function formatVnActivityTime(now: Date): string {
  const date = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${date} ${time}`;
}
