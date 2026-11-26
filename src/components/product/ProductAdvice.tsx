import { productAdvice } from "@/config/product-copy";

// Khối "Tư vấn chọn {tên}" trang chi tiết (mục 5.2 đặc tả Ngày 4).
// Nội dung chữ lấy từ src/config/product-copy.ts — BẢN NHÁP chờ Henry
// duyệt (xem đầu file đó). Không bịa chính sách/chỉ số.
export default function ProductAdvice({
  name,
  categorySlug,
  shopName,
}: {
  name: string;
  categorySlug: string;
  shopName: string;
}) {
  const intro = productAdvice.intro(name, shopName);
  const categoryNote = productAdvice.byCategory[categorySlug];
  const steps = productAdvice.orderSteps(name, shopName);
  return (
    <section aria-labelledby="tu-van-chon" className="mt-10">
      <h2 id="tu-van-chon" className="text-2xl text-ink sm:text-3xl">
        Tư vấn chọn {name}
      </h2>
      <p className="mt-3 leading-relaxed text-ink-soft">
        {intro}
        {categoryNote ? ` ${categoryNote}` : ""}
      </p>
      <h3 className="mt-6 text-lg font-bold text-ink">Chọn theo người nhận</h3>
      <p className="mt-2 leading-relaxed text-ink-soft">{productAdvice.recipient(name)}</p>
      <h3 className="mt-6 text-lg font-bold text-ink">Chọn thời điểm trao tặng</h3>
      <p className="mt-2 leading-relaxed text-ink-soft">{productAdvice.timing(name)}</p>
      <h3 className="mt-6 text-lg font-bold text-ink">
        Đặt {name} tại {shopName}
      </h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 leading-relaxed text-ink-soft">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}
