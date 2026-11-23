// Thông tin ngân hàng nhận chuyển khoản (mục 4 đặc tả Ngày 5).
// Đọc từ biến môi trường BANK_BIN, BANK_NAME, BANK_ACCOUNT,
// BANK_ACCOUNT_NAME. Chưa cấu hình đầy đủ → ẩn lựa chọn "Chuyển
// khoản" (không dùng số tài khoản giả ở bất cứ đâu).
//
// K-9 — tên hiển thị lấy từ BIN (bảng dưới), không lấy từ BANK_NAME
// khi BIN đã biết: 970415 là VietinBank (không phải Vietcombank như
// cấu hình thử Ngày 6 đã ghi), Vietcombank là 970436. Bảng này chỉ
// gồm các BIN đã kiểm chứng chéo từ danh mục VietQR/NAPAS
// (vietqr.io, thư viện vnqr, vietqr_gen — cả ba khớp nhau). BIN chưa
// có trong bảng → dùng BANK_NAME như trước. Vì vậy tên hiển thị và
// BIN trong mã QR luôn cùng một ngân hàng (tên chủ tài khoản trong
// QR do app ngân hàng tra qua NAPAS theo BIN + số tài khoản).

export const BANK_NAMES: Record<string, string> = {
  "970405": "Agribank",
  "970407": "Techcombank",
  "970409": "Bac A Bank",
  "970415": "VietinBank",
  "970416": "ACB",
  "970418": "BIDV",
  "970421": "VRB",
  "970422": "MBBank",
  "970423": "TPBank",
  "970425": "ABBANK",
  "970428": "Nam A Bank",
  "970432": "VPBank",
  "970436": "Vietcombank",
  "970438": "Bao Viet Bank",
};

// Tên ngân hàng theo BIN, null khi BIN chưa có trong bảng.
export function bankNameForBin(bin: string): string | null {
  return BANK_NAMES[bin] ?? null;
}

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
  // Tên hiển thị ưu tiên theo BIN (K-9); BANK_NAME chỉ là dự phòng
  // cho BIN chưa có trong bảng. Khi BIN đã biết, BANK_NAME khác
  // (ví dụ BIN 970415 mà ghi Vietcombank) được bỏ qua — tên theo BIN
  // mới là ngân hàng nhận tiền thật.
  const displayName = bankNameForBin(bin) ?? name;
  if (displayName === "") return null;
  if (!/^\d{6,19}$/.test(account)) return null;
  if (accountName === "") return null;
  return { bin, name: displayName, account, accountName };
}

export function isBankConfigured(): boolean {
  return getBankInfo() !== null;
}

// Nội dung chuyển khoản hiển thị và đưa vào QR: "DH " + mã đơn
// (13 ký tự ASCII, trong giới hạn 25 ký tự của VietQR).
export function transferContent(orderCode: string): string {
  return `DH ${orderCode}`;
}
