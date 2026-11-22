import type { Metadata } from "next";
import { getCart } from "@/lib/cart";
import { getNavCategories } from "@/lib/queries";
import { siteConfig } from "@/config/site";
import CartLines from "@/components/cart/CartLines";
import CartSummary from "@/components/cart/CartSummary";
import CartEmpty from "@/components/cart/CartEmpty";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

// Trang giỏ KHÔNG cho lập chỉ mục (mục 7 đặc tả Ngày 4).
export const metadata: Metadata = {
  title: `Giỏ hàng | ${siteConfig.name}`,
  robots: { index: false },
};

const STEPS = ["Giỏ hàng", "Thanh toán", "Hoàn tất"];

export default async function CartPage() {
  const cart = await getCart();
  const categories = await getNavCategories();
  const first = categories[0];

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Giỏ hàng</h1>

        <ol aria-label="Các bước đặt hàng" className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 ? (
                <span aria-hidden="true" className="text-muted">
                  →
                </span>
              ) : null}
              <span
                aria-current={i === 0 ? "step" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                  i === 0 ? "bg-green-800 text-white" : "border border-line text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "font-bold text-ink" : "text-muted"}>{label}</span>
            </li>
          ))}
        </ol>

        {cart.items.length === 0 ? (
          <CartEmpty
            categorySlug={first?.slug ?? "hoa-tuoi"}
            categoryName={first?.name ?? "Hoa tươi"}
          />
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
            <CartLines items={cart.items} />
            <CartSummary count={cart.count} subtotal={cart.subtotal} />
          </div>
        )}
      </div>
      <UspStrip />
    </>
  );
}
