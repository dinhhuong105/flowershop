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
