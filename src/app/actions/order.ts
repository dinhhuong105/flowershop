// Server Action đặt hàng (mục 6 đặc tả Ngày 5). Dùng với
// useActionState (giữ lại giá trị đã nhập khi lỗi) và cả form thường
// khi tắt JS. Mọi số tiền tính lại ở máy chủ — không nhận số tiền nào
// từ trình duyệt (D5-16).

"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { CART_COOKIE } from "@/config/cart";
import { deliveryConfig } from "@/config/delivery";
import { getValidCartId } from "@/lib/cart";
import {
  effectiveReceiver,
  validateCheckoutForm,
  type CheckoutFormValues,
} from "@/lib/checkout-validation";
import { initialCheckoutState, type CheckoutState } from "@/lib/checkout-state";
import { resolveDelivery } from "@/lib/delivery-rules";
import {
  createOrder,
  DuplicateOrderError,
  EmptyCartError,
  RateLimitError,
  UnavailableProductsError,
} from "@/lib/order";
import { isBankConfigured } from "@/lib/bank";
import { sendOrderNotification } from "@/lib/telegram";

export type { CheckoutState } from "@/lib/checkout-state";

// Trạng thái khởi đầu (initialCheckoutState, emptyCheckoutValues) nằm
// ở @/lib/checkout-state — file "use server" chỉ được export hàm async.

function formDataToRecord(formData: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

function fail(
  values: CheckoutFormValues,
  fieldErrors: CheckoutState["fieldErrors"],
  formError: string | null = null,
): CheckoutState {
  return { ok: false, fieldErrors, formError, values, duplicateCode: null };
}

// prevState là FormData khi form thường (tắt JS) gọi trực tiếp,
// là CheckoutState khi dùng useActionState.
export async function placeOrder(
  prevState: CheckoutState | FormData,
  formData?: FormData,
): Promise<CheckoutState> {
  const data = formData ?? (prevState as FormData);

  // Honeypot chống bot (mục 6.1): có giá trị thì bỏ qua yêu cầu —
  // không tạo đơn, không báo lỗi.
  if ((data.get("website")?.toString() ?? "") !== "") {
    return initialCheckoutState;
  }

  const input = formDataToRecord(data);
  const { fieldErrors, values } = validateCheckoutForm(input);
  if (Object.keys(fieldErrors).length > 0) {
    return fail(values, fieldErrors);
  }

  const cartId = await getValidCartId();
  if (!cartId) redirect("/gio-hang");

  const now = new Date();
  const zoneId = Number(values.zoneId);
  const zone = Number.isInteger(zoneId)
    ? await db.shippingZone.findUnique({ where: { id: zoneId } })
    : null;
  if (!zone || !zone.isActive) {
    return fail(values, { zoneId: "Khu vực giao hàng không khả dụng, vui lòng chọn lại." });
  }
  const method = deliveryConfig.methods.find((m) => m.id === values.deliveryMethod);
  if (!method || !method.enabled) {
    return fail(values, { deliveryMethod: "Phương thức giao hàng không khả dụng, vui lòng chọn lại." });
  }
  const resolved = resolveDelivery(
    method.id,
    values.deliveryMethod === "SCHEDULED" ? values.deliveryDate : null,
    values.deliveryMethod === "SCHEDULED" ? values.deliverySlot : null,
    now,
  );
  if (!resolved) {
    return fail(values, {
      deliveryDate: "Ngày hoặc khung giờ giao đã chọn không còn khả dụng, vui lòng chọn lại.",
    });
  }
  if (values.paymentMethod !== "COD" && values.paymentMethod !== "BANK_TRANSFER") {
    return fail(values, { paymentMethod: "Phương thức thanh toán không hợp lệ." });
  }
  if (values.paymentMethod === "BANK_TRANSFER" && !isBankConfigured()) {
    return fail(values, { paymentMethod: "Chuyển khoản hiện chưa khả dụng, vui lòng chọn thanh toán khi nhận hàng." });
  }

  const receiver = effectiveReceiver(values);
  let order;
  try {
    order = await createOrder({
      cartId,
      senderName: values.senderName,
      senderPhone: values.senderPhone,
      senderEmail: values.senderEmail === "" ? null : values.senderEmail,
      receiverName: receiver.name,
      receiverPhone: receiver.phone,
      address: values.address,
      zoneId: zone.id,
      deliveryMethod: method.id,
      deliveryDate: resolved.deliveryDate,
      deliverySlot: resolved.deliverySlot,
      cardMessage: values.cardMessage === "" ? null : values.cardMessage,
      note: values.note === "" ? null : values.note,
      paymentMethod: values.paymentMethod as "COD" | "BANK_TRANSFER",
    });
  } catch (error) {
    if (error instanceof DuplicateOrderError) {
      return {
        ok: false,
        fieldErrors: {},
        formError: "Đơn này đã được đặt.",
        values,
        duplicateCode: error.code,
      };
    }
    if (error instanceof UnavailableProductsError) {
      return fail(
        values,
        {},
        `Sản phẩm ${error.names.join(", ")} hiện không còn bán, vui lòng kiểm tra lại giỏ hàng.`,
      );
    }
    if (error instanceof RateLimitError) {
      return fail(values, {}, error.message);
    }
    if (error instanceof EmptyCartError) {
      redirect("/gio-hang");
    }
    console.error("[placeOrder] Lỗi không lường trước:", error instanceof Error ? error.message : error);
    return fail(values, {}, "Đã có lỗi xảy ra, vui lòng thử lại.");
  }

  // Sau khi giao dịch commit: xóa cookie giỏ, làm mới huy hiệu giỏ,
  // rồi chuyển tới trang đơn hàng NGAY — báo Telegram gửi nền bằng
  // after() (H-4a), không chờ trong lúc đặt hàng (trước đây await
  // sendOrderNotification làm khách đợi tới ~5 giây khi Telegram chậm).
  // redirect() là câu cuối — không đặt trong try.
  const store = await cookies();
  store.delete(CART_COOKIE);
  revalidatePath("/", "layout");
  after(() => sendOrderNotification(order.id));
  redirect(`/don-hang/${order.code}`);
}
