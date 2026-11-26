import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCart } from "@/lib/cart";
import { isBankConfiguredFromSettings } from "@/lib/bank";
import { getSettings } from "@/lib/settings-cache";
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
  if (cart.count === 0) redirect("/cart");
  const zones = await db.shippingZone.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, fee: true },
  });
  // B4: "Chuyển khoản" chỉ hiện khi ngân hàng đã cấu hình trong cài
  // đặt (nhóm bank, enabled = true) — không còn đọc env trực tiếp.
  const settings = await getSettings();
  const bankConfigured = isBankConfiguredFromSettings(settings);

  // C3: không còn khu vực nào bật thì chặn đặt hàng bằng thông báo
  // thân thiện (không lỗi 500, không hiện biểu mẫu đặt hàng).
  if (zones.length === 0) {
    return (
      <>
        <div className="shell pb-12 pt-6">
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Thanh toán</h1>
          <Steps current={1} />
          <p role="alert" className="mt-6 max-w-2xl rounded-[3px] border border-gold-300 bg-white p-5 text-sm leading-relaxed text-ink">
            Hiện shop chưa có khu vực giao hàng nào đang hoạt động nên chưa thể đặt hàng.
            Vui lòng quay lại sau hoặc liên hệ shop để được hỗ trợ.
          </p>
          <p className="mt-4">
            <Link
              href="/cart"
              className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity duration-150 hover:opacity-90"
            >
              Quay lại giỏ hàng
            </Link>
          </p>
        </div>
        <UspStrip />
      </>
    );
  }

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
