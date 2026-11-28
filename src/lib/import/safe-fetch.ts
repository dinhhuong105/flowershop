// Bộ tải an toàn cho feed/ảnh nhập sản phẩm (Ngày 20, phần C3).
// Một hàm duy nhất `safeFetch` dùng cho cả feed lẫn ảnh.
//
// Chống SSRF + DNS rebinding:
// - Chỉ `http:`/`https:`, cổng 80/443 (cổng mặc định theo scheme
//   hoặc ghi rõ 80/443; cổng khác → blocked). URL có username/
//   password → blocked; URL không parse được → invalid_url.
// - Phân giải DNS bằng hàm `resolve` (mặc định `dns/promises`
//   lookup(all, verbatim); cho phép truyền hàm khác qua opts để
//   test). Hostname đã là IP literal thì kiểm trực tiếp, không
//   phân giải.
// - Chặn loopback (127.0.0.0/8, ::1), riêng tư (10/8, 172.16/12,
//   192.168/16, fc00::/7), link-local (169.254/16 gồm
//   169.254.169.254, fe80::/10), đặc dụng (0.0.0.0/8, 100.64/10,
//   192.0.0.0/24, 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24,
//   240.0.0.0/4, 255.255.255.255), IPv4-mapped IPv6
//   (::ffff:127.0.0.1). Kiểm TẤT CẢ địa chỉ trả về — chỉ dùng địa
//   chỉ ĐẦU TIÊN hợp lệ; không có địa chỉ hợp lệ nào → blocked.
// - GHIM IP đã kiểm khi kết nối (lookup override của http/https.
//   request) để chống DNS rebinding; header `Host` = hostname gốc
//   (+cổng nếu khác mặc định, Node tự đặt); với https đặt
//   `servername` = hostname gốc (SNI + verify cert theo tên miền).
//   Không dùng global fetch.
// - Redirect tối đa 3, tự theo dõi bằng tay; mỗi lần redirect kiểm
//   lại TOÀN BỘ quy tắc (scheme/cổng/DNS/IP); không đi từ https
//   xuống http (downgrade → lỗi `redirect`); Location tương đối
//   resolve theo URL hiện tại; quá 3 → lỗi `redirect`.
//
// Tài nguyên:
// - Timeout TỔNG 10 s mặc định (opts.timeoutMs cho phép test truyền
//   nhỏ hơn) — hẹn giờ theo đồng hồ treo tường, nên phản hồi vô
//   hạn hay nhỏ giọt từng byte đều bị cắt.
// - Giới hạn đọc theo luồng: feed ≤ 5 MB, ảnh ≤ 3 MB (opts.
//   maxBytes, mặc định theo kind); vượt thì hủy stream ngay.
//   KHÔNG tin Content-Length (chỉ đếm byte thật nhận được).
// - Content-Type: feed chỉ nhận `application/json`, `text/csv`,
//   `text/plain`, `application/*+json` (kèm charset vẫn ok); ảnh
//   chỉ nhận `image/jpeg`, `image/png`, `image/webp`, `image/avif`
//   VÀ xác thực magic bytes trong 512 byte đầu (JPEG FF D8 FF,
//   PNG 89 50 4E 47, WebP RIFF....WEBP, AVIF ftyp avif); magic
//   bytes không khớp → bad_content_type.
//
// Header gửi đi: chỉ `User-Agent: FlowerShop-Import/1.0` + `Accept`
// phù hợp + `Host` (tự động). Không gửi cookie/header xác thực nào.
// Không in nội dung phản hồi vào log.
//
// `allowLoopbackForTest` CHỈ để test (cho phép loopback + cổng bất
// kỳ trên loopback để máy chủ giả local chạy được); KHÔNG dùng ở
// đâu khác.

import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import type { LookupFunction } from "node:net";

export const SAFE_FETCH_TIMEOUT_MS = 10_000;
export const FEED_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const MAX_REDIRECTS = 3;

export type SafeFetchErrorCode =
  | "blocked"
  | "timeout"
  | "too_large"
  | "bad_content_type"
  | "redirect"
  | "network"
  | "invalid_url";

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export type SafeFetchKind = "feed" | "image";

/** Hàm phân giải DNS: trả về danh sách địa chỉ của hostname. */
export type ResolveFn = (hostname: string) => Promise<string[]>;

export type SafeFetchOptions = {
  kind?: SafeFetchKind;
  timeoutMs?: number;
  maxBytes?: number;
  resolve?: ResolveFn;
  /** CHỈ DÙNG CHO TEST — xem ghi chú ở đầu file. */
  allowLoopbackForTest?: boolean;
};

export type SafeFetchResult = {
  status: number;
  contentType: string;
  body: Buffer;
};

// ---------------------------------------------------------------- IP ---

// IPv4 → số 32-bit (unsigned), hoặc null nếu không phải IPv4.
function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    num = num * 256 + value;
  }
  return num >>> 0;
}

function inV4Range(num: number, base: number, prefix: number): boolean {
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (num & mask) === (base & mask);
}

function isBlockedV4(num: number): boolean {
  return (
    inV4Range(num, 0x7f000000, 8) || // loopback 127.0.0.0/8
    inV4Range(num, 0x0a000000, 8) || // riêng tư 10/8
    inV4Range(num, 0xac100000, 12) || // riêng tư 172.16/12
    inV4Range(num, 0xc0a80000, 16) || // riêng tư 192.168/16
    inV4Range(num, 0xa9fe0000, 16) || // link-local 169.254/16
    inV4Range(num, 0x00000000, 8) || // đặc dụng 0.0.0.0/8
    inV4Range(num, 0x64400000, 10) || // CGNAT 100.64/10
    inV4Range(num, 0xc0000000, 24) || // 192.0.0.0/24
    inV4Range(num, 0xc0000200, 24) || // TEST-NET-1 192.0.2.0/24
    inV4Range(num, 0xc6336400, 24) || // TEST-NET-2 198.51.100.0/24
    inV4Range(num, 0xcb007100, 24) || // TEST-NET-3 203.0.113.0/24
    inV4Range(num, 0xf0000000, 4) // 240/4 (gồm 255.255.255.255)
  );
}

// IPv6 → 16 byte, hoặc null nếu không phải IPv6. Hỗ trợ `::` nén
// và IPv4 nhúng ở nhóm cuối (vd `::ffff:127.0.0.1`).
function parseIPv6(ip: string): Buffer | null {
  let text = ip;
  const dotAt = text.lastIndexOf(".");
  if (dotAt !== -1) {
    // Tách phần IPv4 nhúng thành 2 nhóm hex.
    const colonBefore = text.lastIndexOf(":", dotAt);
    if (colonBefore === -1) return null;
    const v4 = parseIPv4(text.slice(colonBefore + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    text = text.slice(0, colonBefore + 1) + hi + ":" + lo;
  }
  const doubleColon = text.indexOf("::");
  if (doubleColon !== -1 && text.indexOf("::", doubleColon + 1) !== -1) {
    return null; // hai lần `::` là sai
  }
  let left: string[];
  let right: string[];
  if (doubleColon !== -1) {
    const leftText = text.slice(0, doubleColon);
    const rightText = text.slice(doubleColon + 2);
    left = leftText === "" ? [] : leftText.split(":");
    right = rightText === "" ? [] : rightText.split(":");
    if (left.some((g) => g === "") || right.some((g) => g === "")) {
      return null;
    }
  } else {
    left = text.split(":");
    if (left.some((g) => g === "")) return null;
    right = [];
  }
  const groups = [...left, ...right];
  if (doubleColon === -1 && groups.length !== 8) return null;
  if (doubleColon !== -1 && groups.length >= 8) return null;
  const missing = 8 - groups.length;
  const all =
    doubleColon === -1
      ? groups
      : [...left, ...Array<string>(missing).fill("0"), ...right];
  if (all.length !== 8) return null;
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) {
    const group = all[i];
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    buf.writeUInt16BE(parseInt(group, 16), i * 2);
  }
  return buf;
}

function isBlockedV6(buf: Buffer): boolean {
  const isZero = (from: number, to: number): boolean => {
    for (let i = from; i < to; i++) if (buf[i] !== 0) return false;
    return true;
  };
  if (isZero(0, 16)) return true; // :: (unspecified)
  if (isZero(0, 15) && buf[15] === 1) return true; // ::1 loopback
  if ((buf[0] & 0xfe) === 0xfc) return true; // fc00::/7 (ULA)
  if (buf[0] === 0xfe && (buf[1] & 0xc0) === 0x80) return true; // fe80::/10
  // IPv4-mapped ::ffff:a.b.c.d — kiểm IPv4 nhúng.
  if (isZero(0, 10) && buf[10] === 0xff && buf[11] === 0xff) {
    const v4 =
      ((buf[12] * 256 + buf[13]) * 256 + buf[14]) * 256 + buf[15];
    return isBlockedV4(v4 >>> 0);
  }
  return false;
}

/** Địa chỉ IP có nằm trong dải bị chặn? Chuỗi không phải IP → chặn
 *  cho an toàn (fail-closed). */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedV4(v4);
  const v6 = parseIPv6(ip);
  if (v6 !== null) return isBlockedV6(v6);
  return true;
}

function isLoopbackIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return inV4Range(v4, 0x7f000000, 8);
  const v6 = parseIPv6(ip);
  if (v6 !== null) {
    for (let i = 0; i < 15; i++) if (v6[i] !== 0) return false;
    return v6[15] === 1;
  }
  return false;
}

/** Host đã là IP literal (đã bỏ `[]` nếu có) thì trả về nó,
 *  còn lại trả null. `URL.hostname` đã bỏ `[]` sẵn. */
export function parseIpLiteral(host: string): string | null {
  const text =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  return net.isIP(text) !== 0 ? text : null;
}

const defaultResolve: ResolveFn = async (hostname: string) => {
  const records = await dnsLookup(hostname, { all: true, verbatim: true });
  return records.map((r) => r.address);
};

// ---------------------------------------------------------- Content-Type ---

const FEED_CONTENT_TYPES = new Set([
  "application/json",
  "text/csv",
  "text/plain",
]);

function isFeedContentType(mediaType: string): boolean {
  if (FEED_CONTENT_TYPES.has(mediaType)) return true;
  // application/*+json (vd application/vnd.api+json).
  return mediaType.startsWith("application/") && mediaType.endsWith("+json");
}

const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

function imageMagicMinLength(mediaType: string): number {
  if (mediaType === "image/jpeg") return 3;
  if (mediaType === "image/png") return 8;
  return 12; // webp, avif
}

// Magic bytes có khớp với loại ảnh đã khai? Buffer ngắn hơn độ dài
// cần thiết → không khớp (ảnh bị cắt).
function imageMagicMatches(mediaType: string, buf: Buffer): boolean {
  if (mediaType === "image/jpeg") {
    return (
      buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    );
  }
  if (mediaType === "image/png") {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }
  if (mediaType === "image/webp") {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("latin1") === "RIFF" &&
      buf.subarray(8, 12).toString("latin1") === "WEBP"
    );
  }
  if (mediaType === "image/avif") {
    return (
      buf.length >= 12 &&
      buf.subarray(4, 8).toString("latin1") === "ftyp" &&
      buf.subarray(8, 12).toString("latin1") === "avif"
    );
  }
  return false;
}

// ------------------------------------------------------- Kiểm tra URL/DNS ---

type ValidatedTarget = {
  url: URL;
  pinnedIp: string;
  port: number;
};

type ValidateOptions = {
  resolve: ResolveFn;
  allowLoopbackForTest: boolean;
  isRedirect: boolean;
  previousWasHttps: boolean;
};

async function validateTarget(
  rawUrl: string,
  options: ValidateOptions,
): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("invalid_url", `URL không parse được: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError(
      "blocked",
      `chỉ cho phép http/https, nhận được ${url.protocol}`,
    );
  }
  if (
    options.isRedirect &&
    options.previousWasHttps &&
    url.protocol === "http:"
  ) {
    throw new SafeFetchError(
      "redirect",
      "không cho phép hạ cấp từ https xuống http",
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new SafeFetchError("blocked", "URL chứa thông tin đăng nhập");
  }
  if (url.hostname === "") {
    throw new SafeFetchError("invalid_url", "URL thiếu hostname");
  }

  const isHttps = url.protocol === "https:";
  const defaultPort = isHttps ? 443 : 80;

  // IP literal thì kiểm trực tiếp, không phân giải DNS.
  const literal = parseIpLiteral(url.hostname);
  let candidates: string[];
  if (literal !== null) {
    candidates = [literal];
  } else {
    try {
      candidates = await options.resolve(url.hostname);
    } catch (err) {
      throw new SafeFetchError(
        "network",
        `không phân giải được ${url.hostname}: ${err instanceof Error ? err.message : "lỗi DNS"}`,
      );
    }
  }

  // Chỉ dùng địa chỉ ĐẦU TIÊN hợp lệ trong danh sách trả về.
  const allowed = (ip: string): boolean =>
    options.allowLoopbackForTest
      ? isLoopbackIp(ip) || !isBlockedIp(ip)
      : !isBlockedIp(ip);
  const pinnedIp = candidates.find((ip) => allowed(ip));
  if (pinnedIp === undefined) {
    throw new SafeFetchError(
      "blocked",
      `không có địa chỉ hợp lệ cho ${url.hostname} (địa chỉ nội bộ/đặc dụng bị chặn)`,
    );
  }

  // Cổng: 80/443; khi test loopback thì cổng nào cũng được (máy chủ
  // giả local chạy cổng ngẫu nhiên).
  let port = defaultPort;
  if (url.port !== "") {
    port = Number(url.port);
    const loopbackTest =
      options.allowLoopbackForTest && isLoopbackIp(pinnedIp);
    if (!loopbackTest && port !== 80 && port !== 443) {
      throw new SafeFetchError(
        "blocked",
        `cổng ${port} không được phép (chỉ 80/443)`,
      );
    }
  }

  return { url, pinnedIp, port };
}

// ------------------------------------------------------------ Một request ---

type SingleResult =
  | { type: "ok"; status: number; contentType: string; body: Buffer }
  | { type: "redirect"; location: string };

function fetchOnce(
  target: ValidatedTarget,
  kind: SafeFetchKind,
  maxBytes: number,
  deadline: number,
): Promise<SingleResult> {
  return new Promise<SingleResult>((resolvePromise, rejectPromise) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const fail = (err: SafeFetchError): void => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectPromise(err);
    };
    const done = (value: SingleResult): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(value);
    };

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      fail(new SafeFetchError("timeout", "hết thời gian chờ"));
      return;
    }

    const isHttps = target.url.protocol === "https:";
    const lib = isHttps ? https : http;
    const hostname = target.url.hostname;
    const isIpHost = parseIpLiteral(hostname) !== null;
    const pinnedIp = target.pinnedIp;
    const family: 4 | 6 = net.isIP(pinnedIp) === 6 ? 6 : 4;
    // Ghim đúng IP đã kiểm: Node gọi lookup với { all: true }
    // (Happy Eyeballs) nên phải trả dạng mảng khi đó, dạng đơn khi
    // không. Nhờ vậy lần kết nối này không phân giải DNS lại.
    const lookup: LookupFunction = (_h, options, callback) => {
      if (options.all) {
        callback(null, [{ address: pinnedIp, family }], family);
      } else {
        callback(null, pinnedIp, family);
      }
    };
    const accept =
      kind === "feed"
        ? "application/json, text/csv, text/plain"
        : "image/jpeg, image/png, image/webp, image/avif";
    const requestOptions: http.RequestOptions & { servername?: string } = {
      protocol: target.url.protocol,
      hostname,
      port: target.port,
      path: target.url.pathname + target.url.search,
      method: "GET",
      headers: {
        "User-Agent": "FlowerShop-Import/1.0",
        Accept: accept,
      },
      lookup,
      // SNI + verify cert theo tên miền (không đặt khi host là IP).
      ...(isHttps && !isIpHost ? { servername: hostname } : {}),
    };
    const req = lib.request(requestOptions);

    // Hẹn giờ TỔNG theo đồng hồ treo tường: cắt cả phản hồi vô hạn
    // lẫn phản hồi nhỏ giọt từng byte (timeout của socket chỉ tính
    // lúc không có dữ liệu nên không đủ).
    timer = setTimeout(() => {
      fail(new SafeFetchError("timeout", "quá thời gian chờ"));
      req.destroy();
    }, remaining);

    req.on("response", (res) => {
      const status = res.statusCode ?? 0;

      // Redirect: trả Location về để vòng lặp ngoài kiểm tra lại
      // toàn bộ quy tắc rồi mới theo.
      if (status >= 300 && status < 400) {
        const location = res.headers.location;
        res.resume(); // xả body để giải phóng socket
        if (typeof location === "string" && location !== "") {
          done({ type: "redirect", location });
        } else {
          fail(
            new SafeFetchError(
              "redirect",
              `redirect HTTP ${status} nhưng thiếu Location`,
            ),
          );
        }
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        fail(new SafeFetchError("network", `máy chủ trả HTTP ${status}`));
        return;
      }

      // Kiểm Content-Type trước khi đọc body.
      const rawCt = res.headers["content-type"];
      const contentType = Array.isArray(rawCt)
        ? (rawCt[0] ?? "")
        : (rawCt ?? "");
      const mediaType =
        contentType.split(";")[0]?.trim().toLowerCase() ?? "";
      if (kind === "feed") {
        if (!isFeedContentType(mediaType)) {
          res.resume();
          fail(
            new SafeFetchError(
              "bad_content_type",
              `feed không nhận Content-Type: ${mediaType === "" ? "(trống)" : mediaType}`,
            ),
          );
          return;
        }
      } else if (!IMAGE_CONTENT_TYPES.has(mediaType)) {
        res.resume();
        fail(
          new SafeFetchError(
            "bad_content_type",
            `ảnh không nhận Content-Type: ${mediaType === "" ? "(trống)" : mediaType}`,
          ),
        );
        return;
      }

      // Đọc theo luồng, đếm byte THẬT (không tin Content-Length).
      const chunks: Buffer[] = [];
      let total = 0;
      let magicChecked = false;
      const minMagic = kind === "image" ? imageMagicMinLength(mediaType) : 0;
      res.on("data", (chunk: Buffer) => {
        if (settled) return;
        total += chunk.length;
        if (total > maxBytes) {
          fail(
            new SafeFetchError("too_large", `vượt giới hạn ${maxBytes} byte`),
          );
          req.destroy();
          return;
        }
        chunks.push(chunk);
        if (kind === "image" && !magicChecked) {
          const buf = Buffer.concat(chunks);
          if (buf.length >= minMagic) {
            magicChecked = true;
            if (!imageMagicMatches(mediaType, buf)) {
              fail(
                new SafeFetchError(
                  "bad_content_type",
                  "magic bytes không khớp Content-Type ảnh",
                ),
              );
              req.destroy();
              return;
            }
          }
        }
      });
      res.on("end", () => {
        if (settled) return;
        const body = Buffer.concat(chunks);
        if (kind === "image" && !magicChecked) {
          // Body ngắn hơn độ dài magic cần thiết → không xác thực được.
          if (!imageMagicMatches(mediaType, body)) {
            fail(
              new SafeFetchError(
                "bad_content_type",
                "magic bytes không khớp Content-Type ảnh",
              ),
            );
            return;
          }
        }
        done({ type: "ok", status, contentType, body });
      });
      res.on("error", (err) => {
        fail(
          new SafeFetchError("network", `lỗi đọc phản hồi: ${err.message}`),
        );
      });
    });

    req.on("error", (err) => {
      if (settled) return;
      fail(new SafeFetchError("network", `lỗi mạng: ${err.message}`));
    });
    req.end();
  });
}

// ------------------------------------------------------------------ Chính ---

export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const kind: SafeFetchKind = opts.kind ?? "feed";
  const timeoutMs = opts.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxBytes =
    opts.maxBytes ?? (kind === "feed" ? FEED_MAX_BYTES : IMAGE_MAX_BYTES);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs phải là số lớn hơn 0");
  }
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new TypeError("maxBytes phải là số không âm");
  }
  const resolve = opts.resolve ?? defaultResolve;
  const allowLoopbackForTest = opts.allowLoopbackForTest ?? false;

  const deadline = Date.now() + timeoutMs;
  let currentUrl = url;
  let previousWasHttps = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = await validateTarget(currentUrl, {
      resolve,
      allowLoopbackForTest,
      isRedirect: hop > 0,
      previousWasHttps,
    });
    const result = await fetchOnce(target, kind, maxBytes, deadline);
    if (result.type === "ok") {
      return {
        status: result.status,
        contentType: result.contentType,
        body: result.body,
      };
    }
    if (hop === MAX_REDIRECTS) {
      throw new SafeFetchError(
        "redirect",
        `quá ${MAX_REDIRECTS} lần redirect`,
      );
    }
    previousWasHttps = target.url.protocol === "https:";
    try {
      currentUrl = new URL(result.location, target.url).toString();
    } catch {
      throw new SafeFetchError(
        "redirect",
        `Location redirect không hợp lệ: ${result.location}`,
      );
    }
  }
  throw new SafeFetchError("redirect", `quá ${MAX_REDIRECTS} lần redirect`);
}
