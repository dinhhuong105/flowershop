// Cảnh báo khi lưu Ngân hàng & QR (Ngày 14 B5): các đơn chuyển
// khoản chưa thu sẽ hiển thị QR mới (vì QR từng đơn dựng từ thông
// tin ngân hàng hiện hành). Hàm thuần để test được trực tiếp.

/** Câu cảnh báo dùng cả trong hộp vàng trên form lẫn tin nhắn sau khi lưu.
 * onlyDisabled = true: thay đổi DUY NHẤT là tắt "Bật thanh toán chuyển
 * khoản" (Ngày 15 B4) — các đơn chưa thu không còn hiển thị mã QR nữa
 * (không phải "hiển thị QR mới"), nên dùng câu khác. */
export function bankChangeWarningText(unpaidCount: number, onlyDisabled = false): string {
  if (onlyDisabled) {
    return `${unpaidCount} đơn chuyển khoản chưa thu sẽ không còn hiển thị mã QR`;
  }
  return `${unpaidCount} đơn chuyển khoản chưa thu sẽ hiển thị QR mới`;
}

/** Thông báo sau khi lưu: ghi lại N tại thời điểm lưu (N = 0 thì không nhắc). */
export function bankSaveSuccessMessage(
  unpaidCount: number,
  telegramFailed: boolean,
  onlyDisabled = false,
): string {
  const base = "Đã lưu thông tin ngân hàng.";
  const affected =
    unpaidCount > 0 ? ` ${bankChangeWarningText(unpaidCount, onlyDisabled)}.` : "";
  const note = telegramFailed
    ? " Lưu ý: không gửi được thông báo Telegram, đã ghi vào nhật ký."
    : "";
  return `${base}${affected}${note}`;
}
