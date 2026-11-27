import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { hashIp } from "@/lib/admin/rate-limit";
import { clientIpFromHeaders } from "@/lib/admin/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBankInfoFromSettings, getTransferContent } from "@/lib/bank";
import { getSettings } from "@/lib/settings-cache";
import Steps from "@/components/checkout/Steps";
import OrderStatusBadge from "@/components/order/OrderStatusBadge";
import CopyButton from "@/components/order/CopyButton";
import BankTransferBox from "@/components/order/BankTransferBox";
import OrderDetails from "@/components/order/OrderDetails";
import UspStrip from "@/components/layout/UspStrip";

export const dynamic = "force-dynamic";

// Trang đơn hàng KHÔNG cho lập chỉ mục; header Cache-Control: no-store
// đặt trong next.config.ts (thông tin cá nhân, mục 7 đặc tả Ngày 5).
export const metadata: Metadata = {
  title: "Đặt hàng thành công",
  robots: { index: false },
};

// Mã đơn: 10 ký tự Crockford base32 (mục 7) — sai định dạng → 404.
const ORDER_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

// Ngày 17 S7: giới hạn tra cứu theo IP — 30 lần/phút, dùng module
// rate-limit chung (S9), khóa là IP đã băm (không lưu IP thô).
// Kiểm TRƯỚC cả kiểm định dạng mã để cơn flood mã sai định dạng
// cũng bị chặn, không chỉ mã đúng định dạng. Lỗi DB của bộ đếm thì
// cho qua (fail-open, có log) để trang tra cứu không sập vì bộ đếm.
// Khi bị chặn: hiện thông báo (không lộ dữ liệu đơn). Lưu ý: page
// trong App Router không đặt được mã trạng thái 429 — thông báo này
// trả kèm 200; việc chặn nằm ở chỗ không còn truy vấn DB nữa (kẻ
// dò mã không lấy được thêm thông tin).
async function isLookupRateLimited(): Promise<boolean> {
  try {
    const ip = clientIpFromHeaders(await headers());
    const result = await checkRateLimit({
      key: `lookup:ip:${hashIp(ip)}`,
      limit: 30,
      windowMs: 60 * 1000,
    });
    return !result.allowed;
  } catch (error) {
    console.error(
      "[order lookup] Lỗi kiểm tra giới hạn tốc độ, cho qua:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (await isLookupRateLimited()) {
    return (
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          Tra cứu quá nhiều lần
        </h1>
        <p role="alert" className="mt-6 max-w-2xl rounded-[3px] border border-line bg-white p-5 text-sm text-ink-soft">
          Bạn đã tra cứu quá nhiều lần trong thời gian ngắn. Vui lòng
          đợi một lát rồi thử lại.
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity duration-150 hover:opacity-90"
          >
            Về trang chủ
          </Link>
        </p>
      </div>
    );
  }
  if (!ORDER_CODE_RE.test(code)) notFound();
  const order = await db.order.findUnique({
    where: { code },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) notFound();

  // B4: QR + nội dung chuyển khoản dựng từ cài đặt ngân hàng (nhóm
  // bank). Lưu ý: đơn KHÔNG lưu sẵn thông tin ngân hàng (không có
  // cột bank trên orders) nên đổi STK trong admin sẽ đổi QR hiển thị
  // trên đơn cũ — xem "Độ lệch" báo cáo Ngày 12.
  const settings = await getSettings();
  const bank = getBankInfoFromSettings(settings);
  const showBankBox =
    order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "UNPAID" && bank !== null;

  return (
    <>
      <div className="shell pb-12 pt-6">
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {order.status === "CANCELLED" ? "Đơn đã hủy" : "Đặt hàng thành công"}
        </h1>
        {/* Đơn đã hủy: ẨN HẲN thanh bước (sửa 12 mục verdict Ngày 9,
            mục 5) — thanh 1→2→3 không tô bước nào thì vô nghĩa, trước
            đây truyền current={null} vẫn hiện thanh. Đơn chưa hủy vẫn
            hiện thanh như cũ (bước hiện tại = 2). */}
        {order.status === "CANCELLED" ? null : <Steps current={2} />}

        {order.status === "CANCELLED" ? (
          <p role="alert" className="mt-6 max-w-2xl rounded-[3px] border border-danger bg-white p-5 text-sm font-medium text-danger">
            Đơn đã hủy.
            {/* Chỉ hiện lời nhắn hoàn tiền khi đơn chuyển khoản và đã
                trả tiền (Ngày 9 D9-4: trước sửa, đơn COD hủy cũng hiện
                câu này). */}
            {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PAID"
              ? " Nếu bạn đã chuyển khoản cho đơn này, vui lòng liên hệ shop để được hỗ trợ hoàn tiền."
              : null}
          </p>
        ) : null}

        <div className="mt-6 max-w-2xl space-y-6">
          <section
            aria-label="Mã đơn hàng"
            className="rounded-[3px] border border-line bg-white p-5"
          >
            <p className="text-sm text-ink-soft">Mã đơn hàng của bạn</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p data-testid="order-code" className="font-display text-3xl font-bold tracking-wider text-ink">
                {order.code}
              </p>
              <CopyButton text={order.code} label="Sao chép mã" />
            </div>
            <p className="mt-3">
              <OrderStatusBadge status={order.status} />
            </p>
            {/* Dòng trạng thái (sửa 12 mục verdict Ngày 9, mục 5):
                đơn đã hủy thì KHÔNG hiện dòng "Đơn đã hủy" nữa — chữ
                "đã hủy" đã có ở tiêu đề, alert và huy hiệu, lặp lần
                thứ tư là thừa. Đơn chưa hủy vẫn hiện như cũ. */}
            {order.status === "CANCELLED" ? null : (
              <p className="mt-3 text-sm text-ink-soft">
                {order.paymentStatus === "PAID"
                  ? "Đã nhận thanh toán"
                  : order.paymentMethod === "COD"
                    ? "Thanh toán khi nhận hàng"
                    : "Chờ chuyển khoản"}
              </p>
            )}
          </section>

          {showBankBox && bank ? (
            <BankTransferBox
              bank={bank}
              amount={order.total}
              content={getTransferContent(settings, order.code)}
            />
          ) : null}

          <OrderDetails order={order} />

          <p>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity duration-150 hover:opacity-90"
            >
              Tiếp tục mua sắm
            </Link>
          </p>
        </div>
      </div>
      <UspStrip />
    </>
  );
}
