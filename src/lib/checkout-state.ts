// Trạng thái khởi đầu của form thanh toán (dùng chung cho Server Action
// placeOrder và CheckoutForm). Đặt ở module thường, KHÔNG đặt trong
// file "use server" — Next.js chỉ cho file đó export hàm async, các
// export const khác sẽ thành undefined ở client (lỗi 500 trang
// /thanh-toan ngày 22/11: useActionState nhận initialState undefined).

import type { CheckoutFormValues } from "./checkout-validation";

export type CheckoutState = {
  ok: boolean;
  fieldErrors: Partial<Record<keyof CheckoutFormValues, string>>;
  formError: string | null;
  values: CheckoutFormValues;
  duplicateCode: string | null;
};

export const emptyCheckoutValues: CheckoutFormValues = {
  senderName: "",
  senderPhone: "",
  senderEmail: "",
  sameAsSender: true,
  receiverName: "",
  receiverPhone: "",
  address: "",
  zoneId: "",
  deliveryMethod: "",
  deliveryDate: "",
  deliverySlot: "",
  cardMessage: "",
  note: "",
  paymentMethod: "",
};

export const initialCheckoutState: CheckoutState = {
  ok: false,
  fieldErrors: {},
  formError: null,
  values: emptyCheckoutValues,
  duplicateCode: null,
};
