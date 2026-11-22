// Kiểm tra đầu vào thanh toán (mục 6.1 đặc tả Ngày 5). Hàm thuần, có
// test. Thông báo lỗi bằng tiếng Việt, không lộ chi tiết kỹ thuật.

export function cleanString(value: string): string {
  // Chỉ bỏ ký tự điều khiển (\x00–\x1F, \x7F), giữ nguyên chữ có dấu
  // tiếng Việt và dấu câu; gộp khoảng trắng thừa thành một khoảng.
  return value
    .replace(/[\x00-\x1F\x7F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Chuẩn hóa số điện thoại: bỏ khoảng trắng, dấu chấm, gạch; đổi tiền tố
// +84/84 thành 0.
export function normalizePhone(raw: string): string {
  let s = raw.replace(/[\s.\-]/g, "");
  if (s.startsWith("+84")) s = `0${s.slice(3)}`;
  else if (s.startsWith("84") && s.length === 11) s = `0${s.slice(2)}`;
  return s;
}

// Hợp lệ khi khớp ^(0[35789]\d{8}|02\d{9})$: di động 10 số hoặc cố
// định 11 số (đầu 02).
export function isValidPhone(raw: string): boolean {
  return /^(0[35789]\d{8}|02\d{9})$/.test(normalizePhone(raw));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type CheckoutFormValues = {
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  sameAsSender: boolean;
  receiverName: string;
  receiverPhone: string;
  address: string;
  zoneId: string;
  deliveryMethod: string;
  deliveryDate: string;
  deliverySlot: string;
  cardMessage: string;
  note: string;
  paymentMethod: string;
};

export type CheckoutValidation = {
  fieldErrors: Partial<Record<keyof CheckoutFormValues, string>>;
  values: CheckoutFormValues;
};

// Kiểm tra các trường không cần DB (khu vực tồn tại/đang bật, phương
// thức giao đang bật, phương thức thanh toán khả dụng và quy tắc ngày
// giờ giao do Server Action kiểm tra thêm).
export function validateCheckoutForm(input: Record<string, string>): CheckoutValidation {
  const values: CheckoutFormValues = {
    senderName: cleanString(input.senderName ?? ""),
    senderPhone: normalizePhone(input.senderPhone ?? ""),
    senderEmail: cleanString(input.senderEmail ?? ""),
    sameAsSender: input.sameAsSender === "on" || input.sameAsSender === "true",
    receiverName: cleanString(input.receiverName ?? ""),
    receiverPhone: normalizePhone(input.receiverPhone ?? ""),
    address: cleanString(input.address ?? ""),
    zoneId: (input.zoneId ?? "").trim(),
    deliveryMethod: (input.deliveryMethod ?? "").trim(),
    deliveryDate: (input.deliveryDate ?? "").trim(),
    deliverySlot: (input.deliverySlot ?? "").trim(),
    cardMessage: cleanString(input.cardMessage ?? ""),
    note: cleanString(input.note ?? ""),
    paymentMethod: (input.paymentMethod ?? "").trim(),
  };
  const fieldErrors: Partial<Record<keyof CheckoutFormValues, string>> = {};

  if (values.senderName.length < 2 || values.senderName.length > 60) {
    fieldErrors.senderName = "Họ tên người đặt phải từ 2 đến 60 ký tự.";
  }
  if (!isValidPhone(input.senderPhone ?? "")) {
    fieldErrors.senderPhone = "Số điện thoại người đặt không hợp lệ.";
  }
  if (values.senderEmail !== "" && (!isValidEmail(values.senderEmail) || values.senderEmail.length > 120)) {
    fieldErrors.senderEmail = "Email không đúng định dạng.";
  }
  // Khi "Giống người đặt" bật, người nhận lấy tên + số của người đặt
  // nên không kiểm tra riêng hai trường người nhận.
  if (!values.sameAsSender) {
    if (values.receiverName.length < 2 || values.receiverName.length > 60) {
      fieldErrors.receiverName = "Họ tên người nhận phải từ 2 đến 60 ký tự.";
    }
    if (!isValidPhone(input.receiverPhone ?? "")) {
      fieldErrors.receiverPhone = "Số điện thoại người nhận không hợp lệ.";
    }
  }
  if (values.address.length < 5 || values.address.length > 200) {
    fieldErrors.address = "Địa chỉ nhận hàng phải từ 5 đến 200 ký tự.";
  }
  if (values.zoneId === "") {
    fieldErrors.zoneId = "Vui lòng chọn khu vực giao hàng.";
  }
  if (values.deliveryMethod === "") {
    fieldErrors.deliveryMethod = "Vui lòng chọn phương thức giao hàng.";
  } else if (values.deliveryMethod === "SCHEDULED") {
    if (values.deliveryDate === "") {
      fieldErrors.deliveryDate = "Vui lòng chọn ngày giao hàng.";
    }
    if (values.deliverySlot === "") {
      fieldErrors.deliverySlot = "Vui lòng chọn khung giờ giao hàng.";
    }
  }
  if (values.cardMessage.length > 200) {
    fieldErrors.cardMessage = "Lời nhắn trên thiệp tối đa 200 ký tự.";
  }
  if (values.note.length > 300) {
    fieldErrors.note = "Ghi chú tối đa 300 ký tự.";
  }
  if (values.paymentMethod === "") {
    fieldErrors.paymentMethod = "Vui lòng chọn phương thức thanh toán.";
  }

  return { fieldErrors, values };
}

// Tên + số người nhận thực tế dùng khi tạo đơn (đã tính "Giống người đặt").
export function effectiveReceiver(values: CheckoutFormValues): { name: string; phone: string } {
  return {
    name: values.sameAsSender ? values.senderName : values.receiverName,
    phone: values.sameAsSender ? values.senderPhone : values.receiverPhone,
  };
}
