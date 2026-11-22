import { siteConfig } from "@/config/site";

// Khối cam kết trang chi tiết (mục 5.2 đặc tả Ngày 4): CHỈ hiện khi
// siteConfig.commitments có dữ liệu thật do Henry cung cấp. Mặc định
// mảng rỗng → ẩn cả khối (không bịa cam kết như "Miễn phí giao",
// "Đổi trả 7 ngày" khi chưa có chính sách thật).
export default function CommitmentBlock() {
  const items = siteConfig.commitments;
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Cam kết của cửa hàng"
      data-testid="commitment-block"
      className="mt-10 rounded-[3px] border border-line bg-cream-50 p-5"
    >
      <h2 className="text-xl text-ink">Cam kết của {siteConfig.name}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((c) => (
          <li key={c.title}>
            <p className="font-semibold text-ink">{c.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
