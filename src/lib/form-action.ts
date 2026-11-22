// Ép kiểu Server Action cho prop `action` của <form>.
//
// React 19 types không chấp nhận `action={serverAction}` trực tiếp khi
// action trả về một giá trị (ví dụ `{ ok, count }`) thay vì `void`:
// prop action chỉ nhận `(formData: FormData) => void | Promise<void>`.
// Ép kiểu `as unknown as ...` rải rác ở từng form rất dễ sai, nên gom
// vào helper này (trả lời câu hỏi 5 của Claude ở báo cáo Ngày 4): chỉ
// ép SAU KHI đã kiểm tra `typeof action === "function"` ở runtime.
// Hành vi runtime không đổi — tham chiếu server action giữ nguyên,
// form POST không JS vẫn chạy như cũ.
export function asFormAction(
  action: (formData: FormData) => Promise<unknown>,
): (formData: FormData) => Promise<void> {
  if (typeof action !== "function") {
    throw new Error("asFormAction: action phải là một hàm");
  }
  return action as unknown as (formData: FormData) => Promise<void>;
}
