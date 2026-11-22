import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCart } from "@/lib/cart";
import { isBankConfigured } from "@/lib/bank";
import Steps from "@/components/checkout/Steps";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

// Trang thanh toán KHÔNG cho lập chỉ mục (mục 5 đặc tả Ngày 5).
export const metadata: Metadata = {
  // Chỉ đặt "Thanh toán"; layout có template "%s | Hoa Tươi Demo".
  title: "Thanh toán",
  robots: { index: false },
};

export default async function CheckoutPage() {
  const cart = await getCart();
  // Giỏ trống → quay lại giỏ hàng (mục 5, D5-8).
  if (cart.count === 0) redirect("/gio-hang");
  const zones = await db.shippingZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, fee: true },
  });
  const bankConfigured = isBankConfigured();

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Thanh toán</h1>
        <Steps current={1} />
        <CheckoutForm cart={cart} zones={zones} bankConfigured={bankConfigured} />
      </div>
      <UspStrip />
    </>
  );
}
