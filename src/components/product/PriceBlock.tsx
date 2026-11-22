import { formatVND } from "@/lib/format";

// Khối giá trang chi tiết (mục 5.2 đặc tả Ngày 4): giá hiện tại lớn,
// giá gốc gạch ngang + "Tiết kiệm X" khi có khuyến mãi thật.
export default function PriceBlock({
  current,
  original,
}: {
  current: number;
  original: number | null;
}) {
  return (
    <div>
      <p data-testid="pdp-price" className="text-3xl font-bold text-ink">
        {formatVND(current)}
      </p>
      {original !== null ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-3">
          <span
            data-testid="pdp-original-price"
            className="text-lg text-muted line-through"
          >
            {formatVND(original)}
          </span>
          <span data-testid="pdp-saving" className="text-base font-semibold text-danger">
            Tiết kiệm {formatVND(original - current)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
