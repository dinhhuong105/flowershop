// Thông tin ngân hàng nhận chuyển khoản (mục 4 đặc tả Ngày 5).
// HAI ĐƯỜNG ĐỌC (Ngày 12 B4):
// - Đường env (getBankInfo/isBankConfigured, dưới đây): CHỈ còn
//   dùng cho test + làm giá trị mặc định khi seed cài đặt
//   (defaultBankFromEnv trong settings.ts đọc env trực tiếp).
//   Mặt shop KHÔNG đọc env nữa.
// - Đường cài đặt (getBankInfoFromSettings/...FromSettings, cuối
//   file): nguồn thật duy nhất của mặt shop — đọc từ getSettings().
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

// ---- Nguồn thật từ Ngày 12 (B4): cài đặt shop ----
// Mặt shop đọc ngân hàng từ getSettings(), KHÔNG đọc env trực tiếp
// nữa. Hai hàm dưới là thuần (nhận settings đã đọc sẵn) để dùng
// được cả ở Server Component lẫn test. Tên hiển thị theo BIN (K-9);
// BIN ngoài bảng 14 ngân hàng → "Ngân hàng <BIN>" (dropdown ở
// trang admin chỉ có 14 ngân hàng đã kiểm chứng nên đường này
// không tới được qua giao diện; đường env ở trên vẫn giữ fallback
// BANK_NAME cho cấu hình cũ).

import type { ShopSettings } from "./settings";
import { renderTransferContent } from "./settings";

export function getBankInfoFromSettings(settings: ShopSettings): BankInfo | null {
  if (!settings.bankEnabled) return null;
  const bin = settings.bankCode.trim();
  const account = settings.accountNumber.trim();
  const accountName = settings.accountName.trim();
  if (!/^\d{6}$/.test(bin)) return null;
  if (!/^\d{6,19}$/.test(account)) return null;
  if (accountName === "") return null;
  return { bin, name: bankNameForBin(bin) ?? `Ngân hàng ${bin}`, account, accountName };
}

export function isBankConfiguredFromSettings(settings: ShopSettings): boolean {
  return getBankInfoFromSettings(settings) !== null;
}

// Nội dung chuyển khoản từ mẫu trong cài đặt (B1): mẫu chứa
// {ORDER_CODE}, mặc định "DH {ORDER_CODE}" (đúng nội dung hiện
// hành từ Ngày 5).
export function getTransferContent(settings: ShopSettings, orderCode: string): string {
  const template = settings.transferNoteTemplate.trim() || "DH {ORDER_CODE}";
  return renderTransferContent(template, orderCode);
}
