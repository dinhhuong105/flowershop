import type { Metadata } from "next";
import { getCart } from "@/lib/cart";
import { getNavCategories } from "@/lib/queries";
import CartLines from "@/components/cart/CartLines";
import CartSummary from "@/components/cart/CartSummary";
import CartEmpty from "@/components/cart/CartEmpty";
import Steps from "@/components/checkout/Steps";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

// Trang giỏ KHÔNG cho lập chỉ mục (mục 7 đặc tả Ngày 4).
export const metadata: Metadata = {
  // G-1: chỉ đặt "Giỏ hàng"; layout có template "%s | Hoa Tươi Demo".
  title: "Giỏ hàng",
  robots: { index: false },
};

export default async function CartPage() {
  const cart = await getCart();
  const categories = await getNavCategories();
  const first = categories[0];

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Giỏ hàng</h1>

        <Steps current={0} />

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
