// Test thuần — module lưu ảnh (Ngày 11 B1.3): URL tuyệt đối,
// chọn adapter theo token, SVG an toàn, mock Blob.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { siteConfig } from "@/config/site";
import { isSafeSvgText } from "./admin/upload-rules";
import {
  createBlobAdapter,
  createDiskAdapter,
  diskFileNameFromUrl,
  resolveStorageKind,
  toAbsoluteImageUrl,
  type BlobClient,
} from "./storage";

describe("toAbsoluteImageUrl (quy tắc đường dẫn của Henry)", () => {
  it("đường dẫn tương đối → gắn domain shop", () => {
    assert.equal(
      toAbsoluteImageUrl("/uploads/abcdef012345.png"),
      `${siteConfig.url}/uploads/abcdef012345.png`,
    );
  });
  it("URL đã có domain (Blob) → giữ nguyên, không gắn thêm", () => {
    const blob = "https://abc123.public.blob.vercel-storage.com/uploads/abcdef012345.png";
    assert.equal(toAbsoluteImageUrl(blob), blob);
    const shop = `${siteConfig.url}/uploads/abcdef012345.png`;
    assert.equal(toAbsoluteImageUrl(shop), shop);
  });
  it("chuỗi rỗng → rỗng (không bịa URL)", () => {
    assert.equal(toAbsoluteImageUrl(""), "");
    assert.equal(toAbsoluteImageUrl("   "), "");
  });
});

describe("diskFileNameFromUrl", () => {
  it("tương đối và tuyệt đối cùng domain shop → tên file", () => {
    assert.equal(diskFileNameFromUrl("/uploads/abcdef012345.png"), "abcdef012345.png");
    assert.equal(
      diskFileNameFromUrl(`${siteConfig.url}/uploads/abcdef012345.jpg`),
      "abcdef012345.jpg",
    );
  });
  it("URL Blob, placeholder, tên lạ → null", () => {
    assert.equal(
      diskFileNameFromUrl("https://abc.public.blob.vercel-storage.com/uploads/abcdef012345.png"),
      null,
    );
    assert.equal(diskFileNameFromUrl("/images/placeholder.svg"), null);
    assert.equal(diskFileNameFromUrl("/uploads/../../etc/passwd"), null);
    assert.equal(diskFileNameFromUrl(""), null);
  });
});

describe("resolveStorageKind", () => {
  it("có token → blob; không có / rỗng / chỉ khoảng trắng → disk", () => {
    assert.equal(resolveStorageKind("vercel_blob_rw_xxx"), "blob");
    assert.equal(resolveStorageKind(undefined), "disk");
    assert.equal(resolveStorageKind(""), "disk");
    assert.equal(resolveStorageKind("   "), "disk");
  });
});

describe("isSafeSvgText", () => {
  it("SVG tĩnh → ok", () => {
    assert.equal(
      isSafeSvgText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'),
      true,
    );
    assert.equal(isSafeSvgText('<?xml version="1.0"?><svg><rect width="10" height="10"/></svg>'), true);
  });
  it("script / foreignObject / iframe / sự kiện on* / javascript: / @import → từ chối", () => {
    assert.equal(isSafeSvgText('<svg><script>alert(1)</script></svg>'), false);
    assert.equal(isSafeSvgText('<svg><foreignObject><div>hi</div></foreignObject></svg>'), false);
    assert.equal(isSafeSvgText('<svg><circle onclick="alert(1)"/></svg>'), false);
    assert.equal(isSafeSvgText('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>'), false);
    assert.equal(isSafeSvgText('<svg><style>@import "http://x.test/a.css"</style></svg>'), false);
    assert.equal(isSafeSvgText('<svg><iframe src="http://x.test"/></svg>'), false);
    assert.equal(isSafeSvgText('không phải svg'), false);
    assert.equal(isSafeSvgText('<html><body>hi</body></html>'), false);
  });
});

describe("blob adapter (mock provider)", () => {
  it("save trả URL mock; delete gọi del đúng URL", async () => {
    const calls: { put: Array<{ pathname: string; contentType: string }>; del: string[] } = {
      put: [],
      del: [],
    };
    const mock: BlobClient = {
      put: async (pathname, _body, options) => {
        calls.put.push({ pathname, contentType: options.contentType });
        return { url: `https://mock.public.blob.vercel-storage.com/${pathname}` };
      },
      del: async (url) => {
        calls.del.push(url);
      },
    };
    const adapter = createBlobAdapter(mock, "token-test");
    assert.equal(adapter.kind, "blob");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const url = await adapter.save(png, "png");
    assert.ok(url.startsWith("https://mock.public.blob.vercel-storage.com/uploads/"));
    assert.ok(url.endsWith(".png"));
    assert.equal(calls.put[0]?.contentType, "image/png");
    assert.equal(await adapter.remove(url), true);
    assert.deepEqual(calls.del, [url]);
  });
});

describe("disk adapter (thư mục tạm)", () => {
  let dir = "";
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "hoa-storage-test-"));
    process.env.UPLOAD_DIR = dir;
  });
  after(() => {
    delete process.env.UPLOAD_DIR;
    rmSync(dir, { recursive: true, force: true });
  });
  it("save → đường dẫn tương đối + file tồn tại; remove → xóa file", async () => {
    const adapter = createDiskAdapter();
    assert.equal(adapter.kind, "disk");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const url = await adapter.save(png, "png");
    assert.match(url, /^\/uploads\/[a-f0-9]{12}\.png$/);
    assert.equal(existsSync(join(dir, url.slice("/uploads/".length))), true);
    assert.equal(await adapter.remove(url), true);
    assert.equal(existsSync(join(dir, url.slice("/uploads/".length))), false);
    // Xóa lần nữa → false, không ném lỗi.
    assert.equal(await adapter.remove(url), false);
  });
});
