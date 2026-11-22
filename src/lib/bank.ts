// Thông tin ngân hàng nhận chuyển khoản (mục 4 đặc tả Ngày 5).
// Đọc từ biến môi trường BANK_BIN, BANK_NAME, BANK_ACCOUNT,
// BANK_ACCOUNT_NAME. Chưa cấu hình đầy đủ → ẩn lựa chọn "Chuyển
// khoản" (không dùng số tài khoản giả ở bất cứ đâu).

export type BankInfo = {
  bin: string;
  name: string;
  account: string;
  accountName: string;
};

export function getBankInfo(): BankInfo | null {
  const bin = (process.env.BANK_BIN ?? "").trim();
  const name = (process.env.BANK_NAME ?? "").trim();
  const account = (process.env.BANK_ACCOUNT ?? "").trim();
  const accountName = (process.env.BANK_ACCOUNT_NAME ?? "").trim();
  if (!/^\d{6}$/.test(bin)) return null;
  if (name === "") return null;
  if (!/^\d{6,19}$/.test(account)) return null;
  if (accountName === "") return null;
  return { bin, name, account, accountName };
}

export function isBankConfigured(): boolean {
  return getBankInfo() !== null;
}

// Nội dung chuyển khoản hiển thị và đưa vào QR: "DH " + mã đơn
// (13 ký tự ASCII, trong giới hạn 25 ký tự của VietQR).
export function transferContent(orderCode: string): string {
  return `DH ${orderCode}`;
}
