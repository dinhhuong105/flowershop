// Các đường dẫn cố định cũ của shop (Ngày 14 C0/C1): bốn trang
// cứng /about, /policy, /faq, /contact. Một trang tĩnh mới có thể
// "thay thế" một trong các đường dẫn này — khi trang mới được xuất
// bản, đường dẫn cũ chuyển hướng vĩnh viễn sang trang mới.
// Không thêm đường dẫn cũ mới vào danh sách này nếu không có quyết
// định của Henry (Override 2 Ngày 14: không thêm phân cấp cố định).

export const LEGACY_PATHS = ["/about", "/policy", "/faq", "/contact"] as const;

export type LegacyPath = (typeof LEGACY_PATHS)[number];

export const LEGACY_PATH_LABELS: Record<LegacyPath, string> = {
  "/about": "/about — Giới thiệu",
  "/policy": "/policy — Chính sách",
  "/faq": "/faq — Câu hỏi thường gặp",
  "/contact": "/contact — Liên hệ",
};

export function isLegacyPath(value: string): value is LegacyPath {
  return (LEGACY_PATHS as readonly string[]).includes(value);
}

/** /policy gộp Giao hàng, Thanh toán, Đổi trả, Bảo mật — chỉ nên
 * thay khi trang mới bao gồm đủ các nội dung đó (đặc tả C1). */
export const LEGACY_POLICY_WARNING =
  "Trang cũ này gồm Giao hàng, Thanh toán, Đổi trả, Bảo mật. Chỉ nên thay khi trang mới bao gồm đủ các nội dung đó.";

/** Cảnh báo khi thay /contact (Ngày 15 B2, chép nguyên văn đặc tả). */
export const LEGACY_CONTACT_WARNING =
  "Trang liên hệ cũ tự lấy hotline, Zalo, giờ làm việc từ Cài đặt liên hệ. Trang mới là văn bản tĩnh, không tự cập nhật khi đổi liên hệ.";

/** Cảnh báo khi thay /faq (Ngày 15 B2, chép nguyên văn đặc tả). */
export const LEGACY_FAQ_WARNING =
  "Trang câu hỏi thường gặp cũ hiển thị dạng mở/gập. Trang mới là văn bản liên tục.";

// Ba đường dẫn cũ cần tick "Tôi hiểu" trước khi lưu (Ngày 15 B2).
// /about không cần xác nhận — trang cũ chỉ là văn bản tĩnh.
export const LEGACY_REPLACE_CONFIRM_PATHS = ["/contact", "/faq", "/policy"] as const;

export type LegacyReplaceConfirmPath =
  (typeof LEGACY_REPLACE_CONFIRM_PATHS)[number];

export function needsReplaceConfirm(path: string): path is LegacyReplaceConfirmPath {
  return (LEGACY_REPLACE_CONFIRM_PATHS as readonly string[]).includes(path);
}

/** Câu cảnh báo hiển thị khi thay một đường dẫn cũ; /about → null
 * (không cần cảnh báo, không cần xác nhận). */
export function legacyReplaceWarning(path: LegacyPath): string | null {
  switch (path) {
    case "/contact":
      return LEGACY_CONTACT_WARNING;
    case "/faq":
      return LEGACY_FAQ_WARNING;
    case "/policy":
      return LEGACY_POLICY_WARNING;
    default:
      return null;
  }
}

/**
 * Đổi liên kết trỏ tới đường dẫn cũ thành trang tĩnh thay thế
 * (nếu có). replacements: map đường dẫn cũ → slug trang mới đã
 * xuất bản. Đường dẫn không có trang thay thế thì giữ nguyên.
 */
export function resolveLegacyLink(
  href: string,
  replacements: ReadonlyMap<string, string>,
): string {
  const slug = replacements.get(href);
  return slug !== undefined ? `/${slug}` : href;
}
