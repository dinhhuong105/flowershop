import Link from "next/link";
import Accordion from "@/components/ui/Accordion";
import { productFaq } from "@/config/product-copy";

// Khối "Giải đáp trước khi đặt hàng" trang chi tiết (mục 5.2 đặc tả
// Ngày 4): 4 câu hỏi chung qua Accordion, kèm liên kết "Xem thêm
// {tên danh mục}" về trang danh mục. Nội dung FAQ lấy từ
// src/config/product-copy.ts — BẢN NHÁP chờ Henry duyệt.
export default function ProductFaq({
  categorySlug,
  categoryName,
}: {
  categorySlug: string;
  categoryName: string;
}) {
  return (
    <section data-testid="pdp-faq" aria-labelledby="giai-dap" className="mt-10">
      <h2 id="giai-dap" className="text-2xl text-ink sm:text-3xl">
        Giải đáp trước khi đặt hàng
      </h2>
      <div className="mt-4">
        <Accordion items={productFaq.map((f) => ({ title: f.q, content: f.a }))} />
      </div>
      <p className="mt-4">
        <Link
          href={`/${categorySlug}`}
          className="font-semibold text-green-800 transition-colors duration-150 hover:underline"
        >
          Xem thêm {categoryName} →
        </Link>
      </p>
    </section>
  );
}
