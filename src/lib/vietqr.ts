// Mã QR chuyển khoản VietQR (mục 8 đặc tả Ngày 5): tự dựng chuỗi
// payload theo EMVCo/NAPAS 247 và tính CRC16-CCITT-FALSE — KHÔNG gọi
// dịch vụ bên ngoài. Cấu trúc đã đối chiếu với tài liệu công khai
// VietQR/NAPAS (vietqr_gen, vietnam-qr-pay, VietQR.Core) và được
// kiểm chứng bằng CRC của hai payload mẫu (xem vietqr.test.ts):
// 00 "01", 01 "12" (QR động), 38 [00 "A000000727", 01 [00 BIN,
// 01 tài khoản], 02 "QRIBFTTA"], 53 "704", 54 số tiền, 58 "VN",
// 62 [08 nội dung], 63 CRC. LƯU Ý: "02 08 QRIBFTTA" là trường con
// của 38 (cùng cấp với 01 beneficiary), KHÔNG nằm trong 01 — bản
// nháp đầu của hàm này đặt sai vị trí này, đã sửa theo tài liệu.

export type VietQrInput = {
  bin: string; // mã BIN ngân hàng, đúng 6 chữ số
  account: string; // số tài khoản, 6–19 chữ số
  amount: number; // số tiền VND, số nguyên dương, không dấu phân cách
  content: string; // nội dung chuyển khoản, ASCII, 1–25 ký tự
};

// CRC16-CCITT-FALSE: đa thức 0x1021, giá trị đầu 0xFFFF, tính trên
// bytes UTF-8 (dùng TextEncoder thay Buffer để hàm chạy được cả ở
// client — trang Ngân hàng & QR xem trước QR ngay trong trình duyệt
// từ dữ liệu đang nhập, Ngày 12 B2). Test vector:
// CRC16("123456789") = "29B1".
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function buildVietQrPayload(input: VietQrInput): string {
  const { bin, account, amount, content } = input;
  if (!/^\d{6}$/.test(bin)) {
    throw new Error("Mã BIN ngân hàng phải gồm đúng 6 chữ số.");
  }
  if (!/^\d{6,19}$/.test(account)) {
    throw new Error("Số tài khoản phải gồm 6–19 chữ số.");
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Số tiền phải là số nguyên dương.");
  }
  if (!/^[\x20-\x7E]*$/.test(content)) {
    throw new Error("Nội dung chuyển khoản chỉ gồm ký tự ASCII.");
  }
  if (content.length === 0 || content.length > 25) {
    throw new Error("Nội dung chuyển khoản tối đa 25 ký tự.");
  }
  const beneficiary = tlv("00", bin) + tlv("01", account);
  const payload =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA")) +
    tlv("53", "704") +
    tlv("54", String(amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", content)) +
    "6304";
  return payload + crc16CcittFalse(payload);
}

export type ParsedVietQr = {
  bin: string;
  account: string;
  amount: number | null; // null với QR tĩnh (không có trường 54)
  content: string | null; // null khi không có trường 62
  crc: string;
};

function parseTlv(input: string): Array<{ id: string; value: string }> {
  const out: Array<{ id: string; value: string }> = [];
  let i = 0;
  while (i + 4 <= input.length) {
    const id = input.slice(i, i + 2);
    const len = Number(input.slice(i + 2, i + 4));
    if (!Number.isInteger(len) || i + 4 + len > input.length) break;
    out.push({ id, value: input.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

// Phân tích ngược payload (dùng cho test D5-22 và kiểm tra lại CRC).
export function parseVietQrPayload(payload: string): ParsedVietQr | null {
  const top = parseTlv(payload);
  const field38 = top.find((f) => f.id === "38")?.value;
  if (!field38) return null;
  const sub38 = parseTlv(field38);
  // 02 "QRIBFTTA" là trường con của 38 (cùng cấp với 01).
  if (sub38.find((f) => f.id === "02")?.value !== "QRIBFTTA") return null;
  const beneficiary = sub38.find((f) => f.id === "01")?.value;
  if (!beneficiary) return null;
  const ben = parseTlv(beneficiary);
  const bin = ben.find((f) => f.id === "00")?.value;
  const account = ben.find((f) => f.id === "01")?.value;
  const amountRaw = top.find((f) => f.id === "54")?.value;
  const amount = amountRaw === undefined ? null : Number(amountRaw);
  const field62 = top.find((f) => f.id === "62")?.value;
  const content = field62 ? (parseTlv(field62).find((f) => f.id === "08")?.value ?? null) : null;
  const crc = top.find((f) => f.id === "63")?.value;
  if (!bin || !account || !crc) {
    return null;
  }
  return { bin, account, amount, content, crc };
}
