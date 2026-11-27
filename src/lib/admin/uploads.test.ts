import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_DIMENSION,
  UPLOAD_NAME_RE,
  checkUploadContentLength,
  detectImageType,
  imageDimensions,
  uploadFileName,
} from "./uploads";

describe("detectImageType (magic bytes)", () => {
  it("JPEG FF D8 FF → jpg", () => {
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpg");
  });
  it("PNG 8 byte đầu → png", () => {
    assert.equal(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "png",
    );
  });
  it("RIFF....WEBP → webp", () => {
    const buf = Buffer.alloc(12);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    assert.equal(detectImageType(buf), "webp");
  });
  it("GIF, SVG, file chữ, file rỗng → null", () => {
    assert.equal(detectImageType(Buffer.from("GIF89a", "ascii")), null);
    assert.equal(detectImageType(Buffer.from("<svg", "ascii")), null);
    assert.equal(detectImageType(Buffer.from("hello world", "ascii")), null);
    assert.equal(detectImageType(Buffer.alloc(0)), null);
  });
  it("PNG giả đuôi .jpg (magic bytes PNG) → png theo magic bytes", () => {
    assert.equal(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "png",
    );
  });
});

describe("checkUploadContentLength (K-2)", () => {
  it("thiếu header → 411 (không đọc body chunked vào RAM)", () => {
    assert.deepEqual(checkUploadContentLength(null), {
      status: 411,
      error: "Thiếu Content-Length.",
    });
    assert.deepEqual(checkUploadContentLength(""), {
      status: 411,
      error: "Thiếu Content-Length.",
    });
  });
  it("không phải số hoặc âm → 411", () => {
    assert.equal(checkUploadContentLength("abc")?.status, 411);
    assert.equal(checkUploadContentLength("-5")?.status, 411);
  });
  it("> 2,5 MB → 413 (Ngày 17 S5: ảnh sản phẩm tối đa 2 MB)", () => {
    assert.deepEqual(checkUploadContentLength(String(3 * 1024 * 1024)), {
      status: 413,
      error: "File quá lớn (tối đa 2 MB/ảnh).",
    });
  });
  it("trong giới hạn → null (qua kiểm tra)", () => {
    assert.equal(checkUploadContentLength("0"), null);
    assert.equal(checkUploadContentLength("1024"), null);
    assert.equal(checkUploadContentLength(String(2 * 1024 * 1024)), null);
  });
});

describe("uploadFileName / UPLOAD_NAME_RE", () => {
  it("tên = 12 ký tự đầu sha256 + đuôi theo magic bytes", () => {
    const name = uploadFileName(Buffer.from("noi-dung-anh"), "jpg");
    assert.match(name, UPLOAD_NAME_RE);
    assert.ok(name.endsWith(".jpg"));
  });
  it("cùng nội dung → cùng tên (dùng lại file)", () => {
    assert.equal(
      uploadFileName(Buffer.from("abc"), "png"),
      uploadFileName(Buffer.from("abc"), "png"),
    );
  });
  it("tên lạ (path traversal, sai mẫu) không khớp regex", () => {
    assert.equal(UPLOAD_NAME_RE.test("../../x.png"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.jpeg"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.gif"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.jpg"), true);
  });
});

describe("imageDimensions (Ngày 17 S5)", () => {
  // PNG 1×1 tối thiểu: signature + IHDR (width/height BE).
  function pngBuf(width: number, height: number): Buffer {
    const b = Buffer.alloc(24);
    b.writeUInt8(0x89, 0);
    b.write("PNG\r\n\x1a\n", 1, "ascii");
    b.writeUInt32BE(13, 8);
    b.write("IHDR", 12, "ascii");
    b.writeUInt32BE(width, 16);
    b.writeUInt32BE(height, 20);
    return b;
  }
  function webpVp8xBuf(width: number, height: number): Buffer {
    const b = Buffer.alloc(30);
    b.write("RIFF", 0, "ascii");
    b.write("WEBP", 8, "ascii");
    b.write("VP8X", 12, "ascii");
    b.writeUIntLE(width - 1, 24, 3);
    b.writeUIntLE(height - 1, 27, 3);
    return b;
  }
  function jpegSofBuf(width: number, height: number): Buffer {
    // FFD8 + SOF0 (FFC0, len 17) + precision/height/width + FFD9.
    const b = Buffer.alloc(2 + 2 + 2 + 15 + 2);
    b[0] = 0xff;
    b[1] = 0xd8;
    b[2] = 0xff;
    b[3] = 0xc0;
    b.writeUInt16BE(17, 4);
    b.writeUInt8(8, 6);
    b.writeUInt16BE(height, 7);
    b.writeUInt16BE(width, 9);
    return b;
  }
  it("PNG đọc width/height từ IHDR", () => {
    assert.deepEqual(imageDimensions(pngBuf(800, 600)), { width: 800, height: 600 });
  });
  it("PNG 7000×100 → vượt giới hạn 6000 (route từ chối)", () => {
    const d = imageDimensions(pngBuf(7000, 100))!;
    assert.ok(d.width > MAX_IMAGE_DIMENSION);
  });
  it("WebP VP8X đọc width/height (cộng 1)", () => {
    assert.deepEqual(imageDimensions(webpVp8xBuf(1200, 900)), { width: 1200, height: 900 });
  });
  it("JPEG SOF0 đọc width/height", () => {
    assert.deepEqual(imageDimensions(jpegSofBuf(640, 480)), { width: 640, height: 480 });
  });
  it("file cắt ngang / không phải ảnh → null", () => {
    assert.equal(imageDimensions(Buffer.alloc(0)), null);
    assert.equal(imageDimensions(Buffer.from("hello world", "ascii")), null);
    assert.equal(imageDimensions(pngBuf(10, 10).subarray(0, 10)), null);
  });
});
