// Logic thuần cho toast hoàn tác Ẩn/Hiện sản phẩm (Đợt 4 — 25/11,
// theo nhận xét của Claude: bỏ hộp xác nhận thì phải có Hoàn tác).
// Tách riêng để kiểm bằng unit test, không lẫn vào component.

export type AdminToastDetail = {
  message: string;
  actionLabel?: string;
  /** Liên kết trong toast (vd: toast đơn mới → danh sách đơn). */
  linkHref?: string;
  linkLabel?: string;
  /** Thời gian toast hiện (ms). Mặc định 5000 cho toast hoàn tác. */
  durationMs?: number;
  /** Gọi khi bấm nút hành động (vd: Hoàn tác). */
  onAction?: () => void;
  tone?: "success" | "error";
};

/** Thông báo sau khi bấm Ẩn/Hiện: wasActive = trạng thái TRƯỚC khi bấm. */
export function toggleToastMessage(wasActive: boolean): string {
  return wasActive ? "Đã ẩn sản phẩm" : "Đã hiện lại sản phẩm";
}

/** FormData để hoàn tác: đặt lại đúng trạng thái trước khi bấm. */
export function undoToggleFormData(
  productId: number,
  wasActive: boolean,
): FormData {
  const formData = new FormData();
  formData.set("productId", String(productId));
  formData.set("isActive", String(wasActive));
  return formData;
}

/** Thông báo sau khi bấm Bật/Tắt khu vực (Ngày 12 C2): wasActive = trạng thái TRƯỚC khi bấm. */
export function toggleZoneToastMessage(wasActive: boolean): string {
  return wasActive ? "Đã tắt khu vực" : "Đã bật lại khu vực";
}

/** FormData để hoàn tác Bật/Tắt khu vực: đặt lại đúng trạng thái trước khi bấm. */
export function undoToggleZoneFormData(zoneId: number, wasActive: boolean): FormData {
  const formData = new FormData();
  formData.set("zoneId", String(zoneId));
  formData.set("isActive", String(wasActive));
  return formData;
}

/** Thông báo sau khi bấm Xuất bản/Chuyển về nháp (Ngày 13 B3): wasPublished = trạng thái TRƯỚC khi bấm. */
export function togglePageToastMessage(wasPublished: boolean): string {
  return wasPublished ? "Đã chuyển trang về nháp" : "Đã xuất bản trang";
}

/** FormData để hoàn tác Xuất bản/Nháp: đặt lại đúng trạng thái trước khi bấm. */
export function undoTogglePageFormData(pageId: number, wasPublished: boolean): FormData {
  const formData = new FormData();
  formData.set("pageId", String(pageId));
  formData.set("isPublished", String(wasPublished));
  return formData;
}
