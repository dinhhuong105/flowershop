import ProductCard from "@/components/product/ProductCard";
import Carousel from "@/components/ui/Carousel";
import type { ProductSummary } from "@/lib/queries";

// "Những thiết kế đồng điệu" trang chi tiết (mục 5.3 đặc tả Ngày 4):
// tối đa 4 sản phẩm liên quan (đã xếp hạng ở lib/related.ts). Lưới 4
// cột từ 768px (gridOnDesktop), cuộn ngang snap dưới 768px. Không có
// sản phẩm liên quan → ẩn cả khối.
export default function RelatedProducts({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null;
  return (
    <section data-testid="related-products" aria-label="Những thiết kế đồng điệu" className="mt-12">
      <Carousel title="Những thiết kế đồng điệu" ariaLabel="Sản phẩm liên quan" gridOnDesktop>
        {products.map((p) => (
          <div key={p.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto">
            <ProductCard product={p} testId="related-card" secondaryAction="detail" />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
