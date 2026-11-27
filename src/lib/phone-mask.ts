// Che một phần số điện thoại khi hiển thị công khai (Ngày 17 S7):
// giữ 3 ký tự đầu + 3 ký tự cuối, giữa thay bằng "****".
// Ví dụ: "0901234567" → "090****567". Hàm thuần, có test.

export function maskPhone(raw: string): string {
  const phone = (raw ?? "").trim();
  if (phone.length >= 7) {
    return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
  }
  if (phone.length >= 2) {
    return `${phone.slice(0, 1)}****${phone.slice(-1)}`;
  }
  return "****";
}
