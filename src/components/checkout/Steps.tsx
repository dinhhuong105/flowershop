// Thanh bước 3 bước dùng chung cho giỏ hàng / thanh toán / đơn hàng
// (mục 5 đặc tả Ngày 5; G-8b): bước hiện tại tô đậm, các bước khác mờ.
// Ở di động (390px) chỉ hiện NHÃN của bước hiện tại, các bước còn lại
// chỉ hiện số — để cả thanh nằm một dòng, mũi tên không rơi xuống dòng
// sau (trước đây thanh bị xuống dòng ở 390px). Từ sm trở lên hiện đủ
// nhãn cả 3 bước.
// current = null (Ngày 9 D9-4): không tô bước nào — dùng cho đơn đã
// hủy, tránh tô sáng bước "Hoàn tất" cho đơn không hoàn tất.
const STEPS = ["Giỏ hàng", "Thanh toán", "Hoàn tất"];

export default function Steps({ current }: { current: number | null }) {
  return (
    <ol aria-label="Các bước đặt hàng" className="mt-5 flex items-center gap-x-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex min-w-0 items-center gap-2">
          {i > 0 ? (
            <span aria-hidden="true" className="shrink-0 text-muted">
              →
            </span>
          ) : null}
          <span
            aria-current={i === current ? "step" : undefined}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${
              i === current ? "bg-green-800 text-white" : "border border-line text-muted"
            }`}
          >
            {i + 1}
          </span>
          <span
            className={
              i === current
                ? "truncate whitespace-nowrap font-bold text-ink"
                : "hidden whitespace-nowrap text-muted sm:inline"
            }
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
