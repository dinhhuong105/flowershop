// IP client từ header do reverse proxy đặt (Ngày 7 + sửa Ngày 8 K-1).
// File thuần (không import node:* ngoài process.env) nên test được
// trực tiếp. Quy tắc:
//
// - `X-Forwarded-For` là danh sách IP các proxy nối thêm, theo thứ tự
//   client → proxy gần client nhất → ... → proxy gần máy chủ nhất.
//   Chỉ tin `TRUSTED_PROXY_HOPS` phần tử CUỐI (mặc định 1): phần tử
//   cuối do proxy đáng tin gần nhất thêm vào; các phần tử đầu do
//   client tự đặt được. Lấy phần tử đầu (như Ngày 7) là sai: kẻ tấn
//   công đổi header mỗi lần là né được giới hạn 5 lần sai/IP.
// - Thiếu header → `X-Real-IP` → "unknown".
// - `TRUSTED_PROXY_HOPS` = 1 đúng cho Vercel (1 proxy) và nginx/Caddy
//   tự cấu hình (1 proxy). Nhiều proxy nối tiếp thì đặt bằng số proxy
//   đáng tin thật sự; đặt SAI (lớn hơn số proxy thật) thì lại tin IP
//   do client đặt — xem README.

export function trustedProxyHops(): number {
  const raw = Number((process.env.TRUSTED_PROXY_HOPS ?? "1").trim());
  return Number.isInteger(raw) && raw >= 1 ? raw : 1;
}

export function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    const ip = parts[parts.length - trustedProxyHops()];
    if (ip) return ip;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
