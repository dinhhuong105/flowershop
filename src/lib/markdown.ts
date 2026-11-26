// Render Markdown đơn giản phía server (Ngày 13 B2): tiêu đề (#,
// ##, ###), đậm (**x**), nghiêng (*x*), danh sách (- / 1.),
// đoạn, liên kết. KHÔNG cho HTML thô: toàn bộ nguồn được thoát
// trước khi áp quy tắc Markdown nên <script>, javascript:,
// onerror=, HTML lồng trong Markdown đều bị vô hiệu hóa. Liên kết
// chỉ nhận https:, tel:, mailto: hoặc đường dẫn nội bộ (/...);
// liên kết ngoài có rel="noopener noreferrer".
// Thuần (không import node:*) nên dùng được cả ở server lẫn xem
// trước phía client trong form quản trị.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

// URL liên kết được phép: https:, tel:, mailto:, hoặc đường dẫn
// nội bộ bắt đầu "/" (không "//" — đường dẫn tương đối theo giao
// thức). Không khoảng trắng, không dấu nháy, không <>. http:,
// javascript:, data:, ftp:... đều bị từ chối.
function isAllowedLinkUrl(rawUrl: string): boolean {
  if (rawUrl === "" || /[\s"<>]/.test(rawUrl)) return false;
  if (rawUrl.startsWith("/") && !rawUrl.startsWith("//")) return true;
  if (/^https:/i.test(rawUrl)) return true;
  if (/^tel:/i.test(rawUrl)) return true;
  if (/^mailto:/i.test(rawUrl)) return true;
  return false;
}

function isExternalUrl(rawUrl: string): boolean {
  return /^https:/i.test(rawUrl);
}

// Ký tự cho phép trong URL của liên kết Markdown: RFC 3986 trừ "*"
// (để `*` không bị quy tắc nghiêng ăn mất trong href) và "`".
const LINK_URL_RE = /^[A-Za-z0-9\-._~:/?#@!$&'()+,;=%]+$/;

function renderInline(escapedText: string): string {
  // Liên kết trước: [chữ](url). URL được phép chứa một cấp dấu
  // ngoặc tròn cân bằng (vd javascript:alert(1)) để phần còn lại
  // của URL không rớt ra ngoài thành ký tự lẻ. URL không hợp lệ
  // → chỉ hiện chữ (không tạo thẻ <a>).
  let out = escapedText.replace(
    /\[([^\]]+)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g,
    (_match, text: string, url: string) => {
      if (!LINK_URL_RE.test(url)) return text;
      const rawUrl = unescapeHtml(url);
      if (!isAllowedLinkUrl(rawUrl)) return text;
      const rel = isExternalUrl(rawUrl) ? ' rel="noopener noreferrer"' : "";
      return `<a href="${url}"${rel}>${text}</a>`;
    },
  );
  // Đậm rồi nghiêng (đậm trước để **x** không bị ăn thành nghiêng).
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    // Đoạn: gom các dòng liên tiếp không trống, nối bằng khoảng trắng.
    const parts: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i] ?? "") &&
      !/^[-*]\s+/.test(lines[i] ?? "") &&
      !/^\d+\.\s+/.test(lines[i] ?? "")
    ) {
      parts.push((lines[i] ?? "").trim());
      i += 1;
    }
    blocks.push({ type: "p", text: parts.join(" ") });
  }
  return blocks;
}

// Render Markdown thành HTML an toàn. Trang đã có <h1> riêng
// (tiêu đề trang) nên # → <h2>, ## → <h3>, ### → <h4>.
export function renderMarkdown(source: string): string {
  const blocks = parseBlocks(source ?? "");
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading": {
          const tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return `<${tag}>${renderInline(escapeHtml(block.text))}</${tag}>`;
        }
        case "ul":
          return `<ul>${block.items.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join("")}</ul>`;
        case "ol":
          return `<ol>${block.items.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join("")}</ol>`;
        case "p":
          return `<p>${renderInline(escapeHtml(block.text))}</p>`;
      }
    })
    .join("\n");
}
