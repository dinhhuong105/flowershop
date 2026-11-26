// Mẫu tiêu đề SEO (Ngày 14 B1): "%s | {siteName}".
// Mẫu hợp lệ: chứa %s đúng một lần, {siteName} tối đa một lần,
// mọi {...} khác bị từ chối, tối đa 80 ký tự (tính trên mẫu thô).
// Thay thế MỘT LƯỢT (không lồng): quét từ trái sang phải, đoạn đã
// thay không được quét lại — tên shop chứa "%s" hay "{siteName}"
// vẫn chèn nguyên văn, không làm hỏng kết quả.

export const MAX_TITLE_TEMPLATE_LENGTH = 80;

/** Trả null khi mẫu hợp lệ, còn không thì trả thông báo lỗi. */
export function validateTitleTemplate(template: string): string | null {
  const t = template.trim();
  if (t === "") return "Nhập mẫu tiêu đề.";
  const placeholderCount = t.split("%s").length - 1;
  if (placeholderCount !== 1) return "Mẫu tiêu đề phải chứa đúng một lần %s.";
  if (t.length > MAX_TITLE_TEMPLATE_LENGTH) return "Mẫu tiêu đề tối đa 80 ký tự.";
  const siteNameCount = t.split("{siteName}").length - 1;
  if (siteNameCount > 1) return "Mẫu tiêu đề chỉ được chứa một lần {siteName}.";
  // Mọi {...} khác (kể cả "{" không đóng) đều bị từ chối.
  const rest = t.split("{siteName}").join("");
  if (/\{[^}]*\}?/.test(rest)) {
    return "Mẫu tiêu đề chỉ được dùng {siteName}, không dùng dấu ngoặc khác.";
  }
  return null;
}

/**
 * Áp mẫu vào một tiêu đề trang: thay %s đầu tiên bằng tên trang,
 * {siteName} đầu tiên bằng tên shop. Quét một lượt duy nhất nên
 * tên shop chứa "%s" hay "{siteName}" vẫn giữ nguyên văn.
 */
export function applyTitleTemplate(
  template: string,
  pageTitle: string,
  siteName: string,
): string {
  let out = "";
  let i = 0;
  let replacedTitle = false;
  let replacedSite = false;
  while (i < template.length) {
    if (!replacedTitle && template.startsWith("%s", i)) {
      out += pageTitle;
      replacedTitle = true;
      i += 2;
      continue;
    }
    if (!replacedSite && template.startsWith("{siteName}", i)) {
      out += siteName;
      replacedSite = true;
      i += 10;
      continue;
    }
    out += template[i];
    i += 1;
  }
  return out;
}

/**
 * Mẫu đưa cho Next (title.template): chỉ thay {siteName}, giữ
 * nguyên %s để Next thay bằng tên trang lúc render.
 * Next thay %s theo mẫu toàn cục /%s/g — nên tên shop chứa "%s"
 * được chèn thêm ký tự zero-width sau "%" (không nhìn thấy, không
 * đổi cách đọc) để phép thay đó không nhầm với chỗ giữ %s.
 */
export function resolveTitleTemplateForNext(template: string, siteName: string): string {
  // "\u200b" là ký tự zero-width (viết tường minh để không ai vô
  // tình xóa mất ký tự vô hình trong mã nguồn).
  const guarded = siteName.replace(/%s/g, "%\u200bs");
  return template.replace("{siteName}", () => guarded);
}
