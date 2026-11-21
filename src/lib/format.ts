// Định dạng số tiền VND, ví dụ 2169000 -> "2.169.000 ₫".
export function formatVND(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} ₫`;
}
