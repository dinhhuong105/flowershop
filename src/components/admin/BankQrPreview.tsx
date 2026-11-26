// Xem trước QR VietQR từ dữ liệu đang nhập (Ngày 12 B2): chạy
// HOÀN TOÀN ở trình duyệt (buildVietQrPayload dùng TextEncoder,
// không dùng Buffer — xem vietqr.ts; qrcode sinh SVG tại chỗ).
// Không gọi dịch vụ ngoài. Số tiền mẫu 100.000 ₫, mã đơn mẫu
// 0123456789 — nhãn ghi rõ QR mẫu, không dùng để thu tiền.
"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BANK_NAMES, bankNameForBin } from "@/lib/bank";
import { renderTransferContent } from "@/lib/settings";
import { buildVietQrPayload } from "@/lib/vietqr";
import { formatVND } from "@/lib/format";

export const SAMPLE_ORDER_CODE = "0123456789";
export const SAMPLE_AMOUNT = 100_000;

export default function BankQrPreview({
  bankCode,
  accountNumber,
  accountName,
  transferNoteTemplate,
}: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  transferNoteTemplate: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const binOk = /^\d{6}$/.test(bankCode.trim());
  const accountOk = /^\d{6,19}$/.test(accountNumber.trim());
  const nameOk = accountName.trim() !== "";
  const content = renderTransferContent(
    transferNoteTemplate.trim() || "DH {ORDER_CODE}",
    SAMPLE_ORDER_CODE,
  );
  const contentOk = content.length >= 1 && content.length <= 25;
  const ready = binOk && accountOk && nameOk && contentOk;

  useEffect(() => {
    if (!ready) {
      setSvg(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload = buildVietQrPayload({
          bin: bankCode.trim(),
          account: accountNumber.trim(),
          amount: SAMPLE_AMOUNT,
          content,
        });
        const next = await QRCode.toString(payload, { type: "svg", margin: 1, width: 240 });
        if (!cancelled) {
          setSvg(next);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setSvg(null);
          setError("Không tạo được QR mẫu từ dữ liệu đang nhập.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, bankCode, accountNumber, content]);

  const bankName = bankCode.trim()
    ? (bankNameForBin(bankCode.trim()) ?? `Ngân hàng ${bankCode.trim()}`)
    : "—";

  return (
    <section aria-label="Xem trước QR mẫu" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">QR mẫu — không dùng để thu tiền</h2>
      <p className="mt-1 text-sm text-slate-500">
        QR dưới đây dựng từ chính dữ liệu đang nhập, với số tiền mẫu {formatVND(SAMPLE_AMOUNT)}{" "}
        và mã đơn mẫu {SAMPLE_ORDER_CODE}. Quét thử chỉ để kiểm tra hiển thị, không chuyển tiền
        thật bằng mã này.
      </p>
      {!ready ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Nhập đủ ngân hàng, số tài khoản (6–19 chữ số), tên chủ tài khoản và mẫu nội dung hợp lệ
          (kết quả cuối tối đa 25 ký tự) để xem QR mẫu.
        </p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {error}
        </p>
      ) : svg ? (
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div
            data-testid="bank-qr-preview-svg"
            className="w-60 shrink-0 [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <dl className="w-full min-w-0 space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Ngân hàng</dt>
              <dd className="font-bold text-slate-900 sm:text-right">{bankName}</dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Số tài khoản</dt>
              <dd className="break-all font-bold text-slate-900 sm:text-right">
                {accountNumber.trim()}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Chủ tài khoản</dt>
              <dd className="break-all font-bold text-slate-900 sm:text-right">
                {accountName.trim()}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Số tiền</dt>
              <dd className="font-bold text-slate-900 sm:text-right">
                {formatVND(SAMPLE_AMOUNT)}
              </dd>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <dt className="shrink-0 text-slate-500">Nội dung chuyển khoản</dt>
              <dd className="whitespace-nowrap font-bold text-slate-900 sm:text-right">{content}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Đang tạo QR mẫu…</p>
      )}
      {/* Gợi ý chọn ngân hàng: danh sách 14 BIN đã kiểm chứng (BANK_NAMES). */}
      <p className="mt-4 text-xs text-slate-500">
        Ngân hàng trong danh sách: {Object.values(BANK_NAMES).join(", ")}.
      </p>
    </section>
  );
}
