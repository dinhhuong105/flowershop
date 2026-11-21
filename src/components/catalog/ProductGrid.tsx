import ProductCard from "@/components/product/ProductCard";
import Reveal from "@/components/ui/Reveal";
import type { ProductSummary } from "@/lib/queries";

// Lưới sản phẩm trang danh mục (logic Ngày 3 không đổi): 2 cột di động,
// 3 cột từ 768px, 4 cột từ 1024px. Thẻ vào có Reveal so le 60ms.
export default function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="mt-6 grid scroll-mt-32 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <Reveal key={p.id} index={i} className="h-full">
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}
