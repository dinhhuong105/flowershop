// Unit test JSON-LD Article (Ngày 19 A1 + A2) — thuần, không cần DB.
// Kiểm: chỉ trường có dữ liệu mới đưa vào; tác giả trống thì bỏ
// author (không lấy tên admin); escape an toàn để nhúng vào script
// (JSON parse lại vẫn đúng, không thoát khỏi thẻ script).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { articleJsonLd } from "./news-jsonld";
import { escapeJsonForScript } from "./security-headers";

function article(over: Record<string, unknown> = {}) {
  return {
    title: "Cách giữ hoa tươi lâu",
    excerpt: "Vài mẹo nhỏ.",
    coverImage: "",
    author: "Hoa Tươi",
    publishedAt: new Date("2026-11-27T01:00:00.000Z"),
    createdAt: new Date("2026-11-26T10:00:00.000Z"),
    updatedAt: new Date("2026-11-27T02:00:00.000Z"),
    seoDescription: "",
    ...over,
  };
}

describe("articleJsonLd", () => {
  it("đủ trường: Article + headline + ngày + description + image + author", () => {
    const ld = articleJsonLd(
      article({ coverImage: "/uploads/abc123.png", seoDescription: "Mô tả SEO." }),
    );
    assert.equal(ld["@type"], "Article");
    assert.equal(ld.headline, "Cách giữ hoa tươi lâu");
    assert.equal(ld.datePublished, "2026-11-27T01:00:00.000Z");
    assert.equal(ld.dateModified, "2026-11-27T02:00:00.000Z");
    assert.equal(ld.description, "Mô tả SEO.");
    assert.ok(typeof ld.image === "string" && ld.image.endsWith("/uploads/abc123.png"));
    assert.deepEqual(ld.author, { "@type": "Person", name: "Hoa Tươi" });
  });

  it("tác giả trống → KHÔNG có author; không ảnh → không có image; không mô tả → không có description (A2)", () => {
    const ld = articleJsonLd(article({ author: "", excerpt: "" }));
    assert.ok(!("author" in ld), "không được bịa author từ tên admin");
    assert.ok(!("image" in ld));
    assert.ok(!("description" in ld));
  });

  it("chưa hẹn giờ (publishedAt null) → datePublished lấy createdAt", () => {
    const ld = articleJsonLd(article({ publishedAt: null }));
    assert.equal(ld.datePublished, "2026-11-26T10:00:00.000Z");
  });

  it("seoDescription trống thì description lấy excerpt", () => {
    const ld = articleJsonLd(article({ seoDescription: "" }));
    assert.equal(ld.description, "Vài mẹo nhỏ.");
  });

  it("escape an toàn: tiêu đề/tác giả chứa </script> không thoát khỏi thẻ script, JSON parse lại đúng", () => {
    const evil = article({
      title: 'Mẹo hay </script><script>alert(1)</script>',
      author: 'A </script><script>alert(2)</script>',
    });
    const json = escapeJsonForScript(JSON.stringify(articleJsonLd(evil)));
    assert.ok(!json.includes("</script>"), "không còn chuỗi đóng thẻ script");
    const parsed = JSON.parse(json) as { headline: string; author: { name: string } };
    assert.equal(parsed.headline, 'Mẹo hay </script><script>alert(1)</script>');
    assert.equal(parsed.author.name, 'A </script><script>alert(2)</script>');
  });
});
