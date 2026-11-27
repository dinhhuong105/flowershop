// Test thuần — Markdown an toàn (Ngày 13 B2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("tiêu đề # → h2, ## → h3, ### → h4 (trang đã có h1 riêng)", () => {
    assert.equal(renderMarkdown("# Giới thiệu"), "<h2>Giới thiệu</h2>");
    assert.equal(renderMarkdown("## Mục lớn"), "<h3>Mục lớn</h3>");
    assert.equal(renderMarkdown("### Mục nhỏ"), "<h4>Mục nhỏ</h4>");
  });
  it("đậm + nghiêng + đoạn", () => {
    assert.equal(
      renderMarkdown("Chào **thế giới** và *bạn* nhé."),
      "<p>Chào <strong>thế giới</strong> và <em>bạn</em> nhé.</p>",
    );
  });
  it("danh sách không thứ tự + có thứ tự", () => {
    assert.equal(
      renderMarkdown("- Một\n- Hai"),
      "<ul><li>Một</li><li>Hai</li></ul>",
    );
    assert.equal(
      renderMarkdown("1. Một\n2. Hai"),
      "<ol><li>Một</li><li>Hai</li></ol>",
    );
  });
  it("liên kết https ngoài có rel; nội bộ/tel/mailto không rel", () => {
    assert.equal(
      renderMarkdown("[Shop](https://example.com)"),
      '<p><a href="https://example.com" rel="noopener noreferrer">Shop</a></p>',
    );
    assert.equal(
      renderMarkdown("[Liên hệ](/contact)"),
      '<p><a href="/contact">Liên hệ</a></p>',
    );
    assert.equal(
      renderMarkdown("[Gọi](tel:0901234567)"),
      '<p><a href="tel:0901234567">Gọi</a></p>',
    );
    assert.equal(
      renderMarkdown("[Mail](mailto:shop@example.com)"),
      '<p><a href="mailto:shop@example.com">Mail</a></p>',
    );
  });
  it("javascript: + http: + data: bị vô hiệu hóa (chỉ còn chữ, không có thẻ a)", () => {
    assert.equal(renderMarkdown("[X](javascript:alert(1))"), "<p>X</p>");
    assert.equal(renderMarkdown("[X](http://example.com)"), "<p>X</p>");
    assert.equal(renderMarkdown("[X](data:text/html,<b>hi</b>)"), "<p>X</p>");
    assert.equal(renderMarkdown("[X](//example.com)"), "<p>X</p>");
  });
  it("<script>, onerror=, HTML lồng đều bị thoát (không chạy được)", () => {
    const out = renderMarkdown('<script>alert(1)</script>');
    assert.ok(!out.includes("<script>"));
    assert.ok(out.includes("&lt;script&gt;"));
    const out2 = renderMarkdown('<img src="x" onerror="alert(1)">');
    assert.ok(!out2.includes("<img"));
    assert.ok(out2.includes("&lt;img"));
    const out3 = renderMarkdown("Chữ <b>đậm giả</b> cuối.");
    assert.ok(!out3.includes("<b>"));
    assert.ok(out3.includes("&lt;b&gt;"));
  });
  it("nhiều khối + dòng trống phân tách đúng", () => {
    assert.equal(
      renderMarkdown("# Tựa\n\nĐoạn một.\n\n- A\n- B\n\nĐoạn hai."),
      "<h2>Tựa</h2>\n<p>Đoạn một.</p>\n<ul><li>A</li><li>B</li></ul>\n<p>Đoạn hai.</p>",
    );
  });
  it("chuỗi rỗng → rỗng; khoảng trắng thừa được dọn", () => {
    assert.equal(renderMarkdown(""), "");
    assert.equal(renderMarkdown("   \n\n  "), "");
  });
});

describe("renderMarkdown — chống ReDoS (Ngày 17 S3)", () => {
  // Ngân sách ~50 ms/đầu vào (đặc tả S3). Regex link cũ backtrack
  // hàm mũ: "[a](https://x.test/" ×300 mất 2,8 giây trước khi sửa.
  //
  // Sửa flaky Ngày 17 (Phần D): đo MỘT lần rồi so với 50 ms là đo
  // cả nhiễu lập lịch — máy tải nặng đã đo 66 ms cho ca đầu dù bản
  // thân render chỉ ~0,5 ms. Đo 5 lần lấy MIN (kèm 1 lần khởi động):
  // min loại nhiễu lập lịch/JIT nhưng vẫn bắt được ReDoS thật — bản
  // regex cũ mất 2.800 ms, gấp 56 lần ngân sách, nên min của nó vẫn
  // vượt 50 ms với biên độ lớn. Ngân sách 50 ms KHÔNG đổi, test
  // không bị làm yếu.
  function fastestMs(input: string): number {
    renderMarkdown(input); // khởi động (JIT)
    let min = Infinity;
    for (let i = 0; i < 5; i += 1) {
      const t0 = performance.now();
      renderMarkdown(input);
      min = Math.min(min, performance.now() - t0);
    }
    return min;
  }
  it("chuỗi link chưa đóng dài → < 50 ms, không có thẻ a", () => {
    const input = "[a](https://x.test/".repeat(300) + ")";
    const ms = fastestMs(input);
    const out = renderMarkdown(input);
    assert.ok(ms < 50, `mất ${ms.toFixed(2)} ms (min 5 lần)`);
    assert.ok(!out.includes("<a "));
  });
  it("5000 dấu [ liên tiếp → < 50 ms", () => {
    const input = "[".repeat(5000) + "]x";
    const ms = fastestMs(input);
    assert.ok(ms < 50, `mất ${ms.toFixed(2)} ms (min 5 lần)`);
  });
  it("đầu vào lớn 95 KB (nhiều khối) → < 50 ms", () => {
    const input = ("# Tieu de\n\n" + "**dam** ".repeat(2000) + "\n\n" + "- muc ".repeat(500) + "\n").repeat(5);
    const ms = fastestMs(input);
    assert.ok(ms < 50, `mất ${ms.toFixed(2)} ms (min 5 lần)`);
  });
  it("link ngoặc lồng một cấp vẫn render đúng", () => {
    assert.equal(
      renderMarkdown("[a](https://x.test/a_(b))"),
      '<p><a href="https://x.test/a_(b)" rel="noopener noreferrer">a</a></p>',
    );
  });
  it("URL chứa ký tự lạ → chỉ hiện chữ (như regex cũ)", () => {
    assert.equal(renderMarkdown("[a](https://x.test/a*b)"), "<p>a</p>");
  });
});
