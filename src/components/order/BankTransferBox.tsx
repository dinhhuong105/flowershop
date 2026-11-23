// Khối chuyển khoản trên trang đơn hàng (mục 7 + 8 đặc tả Ngày 5):
// mã QR VietQR tự dựng tại máy chủ (không gọi dịch vụ ngoài — ảnh QR
// là SVG sinh từ chuỗi payload), kèm tên ngân hàng, số tài khoản, chủ
// tài khoản, số tiền, nội dung chuyển khoản. Mỗi trường có nút sao chép.

import QRCode from "qrcode";
import { buildVietQrPayload } from "@/lib/vietqr";
import { formatVND } from "@/lib/format";
import type { BankInfo } from "@/lib/bank";
import CopyButton from "./CopyButton";

export default async function BankTransferBox({
  bank,
  amount,
  content,
}: {
  bank: BankInfo;
  amount: number;
  content: string;
}) {
  const payload = buildVietQrPayload({
    bin: bank.bin,
    account: bank.account,
    amount,
    content,
  });
  const svg = await QRCode.toString(payload, { type: "svg", margin: 1, width: 240 });
  const rows: Array<{ label: string; value: string; nowrap?: boolean }> = [
    { label: "Ngân hàng", value: bank.name },
    { label: "Số tài khoản", value: bank.account },
    { label: "Chủ tài khoản", value: bank.accountName },
    { label: "Số tiền", value: formatVND(amount) },
    // K-7: nội dung chuyển khoản không được ngắt dòng (mã dài từng
    // xuống 3 dòng ở 390 px) — giá trị này luôn một dòng.
    { label: "Nội dung chuyển khoản", value: content, nowrap: true },
  ];
  return (
    <section
      aria-label="Thông tin chuyển khoản"
      className="rounded-[3px] border border-line bg-white p-5"
    >
      <h2 className="text-xl text-ink">Chuyển khoản ngân hàng</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Quét mã QR bằng ứng dụng ngân hàng để chuyển khoản đúng số tiền và nội dung.
      </p>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div
          data-testid="vietqr-svg"
          className="w-60 shrink-0 [&>svg]:h-auto [&>svg]:w-full"
          // SVG do thư viện qrcode sinh từ chuỗi payload của chính mình.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <dl className="w-full min-w-0 space-y-3 text-sm">
          {rows.map((row) => (
            // K-7: dưới 640 px mỗi hàng xếp dọc — nhãn trên một dòng,
            // giá trị + nút "Sao chép" dưới một dòng (không ngắt);
            // từ 640 px giữ bố cục cũ (nhãn trái, giá trị phải).
            <div
              key={row.label}
              className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
            >
              <dt className="shrink-0 text-ink-soft">{row.label}</dt>
              <dd className="flex min-w-0 items-center gap-2 font-bold text-ink sm:text-right">
                <span className={row.nowrap ? "whitespace-nowrap" : "break-all"}>
                  {row.value}
                </span>
                <CopyButton text={row.value} label="Sao chép" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
