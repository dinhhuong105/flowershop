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

function renderLinks(escapedText: string): string {
  // Quét tuyến tính thay cho regex (Ngày 17 S3 — ReDoS): regex cũ
  // /\[([^\]]+)\]\(((?:[^()\s]+|\([^()\s]*\))+)\)/g backtrack hàm mũ
  // trên chuỗi "[a](https://x.test/" lặp lại (5,7 KB → 2,8 giây).
  // Quét này chỉ tiến về trước, mỗi ký tự xét tối đa một lần.
  // Ngữ nghĩa giữ nguyên: [chữ](url), url được phép chứa một cấp
  // ngoặc tròn cân bằng; url không hợp lệ → chỉ hiện chữ.
  let out = "";
  let i = 0;
  while (i < escapedText.length) {
    const open = escapedText.indexOf("[", i);
    if (open === -1) {
      out += escapedText.slice(i);
      break;
    }
    const closeBracket = escapedText.indexOf("]", open + 1);
    if (closeBracket === -1) {
      // Không còn "]" nào nữa → không thể có link nào sau đây.
      out += escapedText.slice(i);
      break;
    }
    if (closeBracket === open + 1) {
      out += escapedText.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    if (escapedText[closeBracket + 1] !== "(") {
      // "]" này không mở link: mọi "[" trước nó đều có "]" đầu
      // tiên là chính "]" này nên cũng không thành link — chép
      // nguyên đoạn tới hết "]" rồi nhảy qua (giữ quét tuyến tính).
      out += escapedText.slice(i, closeBracket + 1);
      i = closeBracket + 1;
      continue;
    }
    // Tìm ")" đóng, cho một cấp ngoặc lồng; khoảng trắng kết thúc URL.
    let j = closeBracket + 2;
    let depth = 0;
    let end = -1;
    let hitEnd = false;
    while (j < escapedText.length) {
      const c = escapedText[j]!;
      if (c === "(") depth += 1;
      else if (c === ")") {
        if (depth === 0) {
          end = j;
          break;
        }
        depth -= 1;
      } else if (/\s/.test(c)) {
        break;
      }
      j += 1;
    }
    if (j >= escapedText.length && end === -1) hitEnd = true;
    if (end === -1) {
      // Không có ")" đóng sau đây: nếu đã quét tới cuối chuỗi thì
      // không link nào sau này đóng được nữa → chép phần còn lại.
      if (hitEnd) {
        out += escapedText.slice(i);
        break;
      }
      out += escapedText.slice(i, open + 1);
      i = open + 1;
      continue;
    }
    const text = escapedText.slice(open + 1, closeBracket);
    const url = escapedText.slice(closeBracket + 2, end);
    // URL không hợp lệ (ký tự lạ hoặc scheme cấm) → chỉ hiện chữ,
    // giống hành vi regex cũ.
    if (!LINK_URL_RE.test(url) || !isAllowedLinkUrl(unescapeHtml(url))) {
      out += escapedText.slice(i, open);
      out += text;
      i = end + 1;
      continue;
    }
    const rawUrl = unescapeHtml(url);
    const rel = isExternalUrl(rawUrl) ? ' rel="noopener noreferrer"' : "";
    out += escapedText.slice(i, open);
    out += `<a href="${url}"${rel}>${text}</a>`;
    i = end + 1;
  }
  return out;
}

function renderInline(escapedText: string): string {
  // Liên kết trước, rồi đậm, rồi nghiêng.
  let out = renderLinks(escapedText);
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
