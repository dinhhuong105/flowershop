import ProductCard from "@/components/product/ProductCard";
import type { FeaturedProduct } from "@/lib/queries";

export default function FeaturedProducts({ products }: { products: FeaturedProduct[] }) {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <h2 className="text-2xl font-bold text-ink">Sản phẩm nổi bật</h2>
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
