// Header bảo mật (Ngày 17 S10) — xây chuỗi CSP và các header khác
// ở dạng thuần để test được; middleware áp dụng cho mọi phản hồi.
//
// CSP: script-src nonce (không 'unsafe-inline' cho script — xem
// ghi chú ở middleware: layout đọc nonce từ header x-nonce và gắn
// vào 2 thẻ <script> nội tuyến duy nhất của shop; script của chính
// Next.js cũng dùng nonce này qua header x-nonce).
// style-src giữ 'unsafe-inline' vì React dùng thuộc tính style=
// nội tuyến ở nhiều component (Gallery, Toast...) và Tailwind v4
// chèn <style> nội tuyến — bỏ 'unsafe-inline' cho style sẽ vỡ giao
// diện; rủi ro style-injection thấp hơn script-injection và không
// cho phép chạy mã.
// img-src: 'self' + data: (QR code dạng data-URI ở trang thanh
// toán) + blob: (xem trước ảnh client) + domain Vercel Blob
// (ảnh sản phẩm/logo trên production).
// frame-ancestors 'none': admin và /login không bị iframe bao.

export const BLOB_IMAGE_HOST = "*.public.blob.vercel-storage.com";

export function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://${BLOB_IMAGE_HOST}`,
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ];
  return directives.join("; ");
}

export type SecurityHeadersOpts = {
  nonce: string;
  // Chỉ bật HSTS ở production (header qua HTTP bị trình duyệt bỏ qua).
  isProduction: boolean;
};

export function buildSecurityHeaders(opts: SecurityHeadersOpts): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(opts.nonce),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Tắt camera/mic/geolocation và các API nhạy cảm khác.
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    "X-Frame-Options": "DENY",
  };
  if (opts.isProduction) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

// JSON an toàn để nhúng trong <script type="application/ld+json">:
// JSON.stringify không thoát "<" nên tên shop chứa "</script>"
// sẽ thoát khỏi thẻ script (XSS lưu qua cài đặt — Ngày 17 S3).
// Thoát <, > và & thành \uXXXX (JSON vẫn parse đúng).
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
