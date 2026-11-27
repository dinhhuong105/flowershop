// Kiểm động bảo mật (Ngày 17 S1–S5, S9, S10, S12) — chạy bằng tsx
// trên server standalone LOCAL (không đụng production):
//   npx tsx scripts/security-live-check.ts [base-url]
// Server phải đang chạy (npm run test:security tự khởi động).
// Tự mint phiên admin trực tiếp trong DB local (token ngẫu nhiên
// 256-bit, băm sha256 — giống createAdminSession) rồi tự dọn;
// KHÔNG cần mật khẩu admin, KHÔNG đổi dữ liệu thật (upload test
// xóa file ngay; lần đăng nhập sai test được dọn khỏi bảng).
import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let pass = 0;
let fail = 0;
const failedNames: string[] = [];

async function check(name: string, fn: () => Promise<boolean | void>) {
  try {
    const r = await fn();
    if (r === false) throw new Error("assertion false");
    pass += 1;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    fail += 1;
    failedNames.push(name);
    console.log(`  FAIL: ${name} — ${e instanceof Error ? e.message : String(e)}`);
  }
}
function assert(cond: unknown, msg = "assert failed"): asserts cond {
  if (!cond) throw new Error(msg);
}
function assertEq(a: unknown, b: unknown, msg = "") {
  if (a !== b) throw new Error(`kỳ vọng ${JSON.stringify(b)}, được ${JSON.stringify(a)} ${msg}`);
}
async function fetchNoRedirect(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, redirect: "manual" });
}

// Mint phiên admin trong DB; trả { token, id }.
async function mintSession(opts?: { expiresAt?: Date; lastSeenAt?: Date }) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const row = await db.adminSession.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: opts?.expiresAt ?? new Date(now.getTime() + 12 * 60 * 60 * 1000),
      lastSeenAt: opts?.lastSeenAt ?? now,
    },
  });
  return { token, id: row.id };
}
const cookie = (token: string) => `admin_session=${token}`;

// PNG 1×1 hợp lệ (đủ để qua magic bytes + đọc kích thước).
function tinyPng(width = 1, height = 1): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt8(0x89, 0);
  b.write("PNG\r\n\x1a\n", 1, "ascii");
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

const createdSessionIds: number[] = [];
const uploadedFiles: string[] = [];

async function main() {
  console.log(`security-live-check: ${BASE}`);

  // Dọn lần đăng nhập sai cũ để test giới hạn không bị nhiễu.
  await db.adminLoginAttempt.deleteMany({});

  console.log("S1 — phân quyền (động):");
  await check("không đăng nhập: /admin → 307 /login, không dữ liệu", async () => {
    const r = await fetchNoRedirect(`${BASE}/admin`);
    assertEq(r.status, 307);
    assert((r.headers.get("location") ?? "").startsWith("/login"), "Location phải về /login");
    const body = await r.text();
    assert(!/Đơn cần xử lý|Doanh thu|pendingCount/i.test(body), "redirect không được chứa dữ liệu admin");
  });
  for (const p of ["/admin/products", "/admin/orders", "/admin/settings/general", "/admin/activity", "/admin/categories", "/admin/pages", "/admin/shipping-zones", "/admin/news", "/admin/news/new", "/admin/news/1"]) {
    await check(`không đăng nhập: ${p} → 307`, async () => {
      const r = await fetchNoRedirect(`${BASE}${p}`);
      assert(r.status === 307 || r.status === 401 || r.status === 403, `status ${r.status}`);
    });
  }
  await check("cookie giả → 307", async () => {
    const r = await fetchNoRedirect(`${BASE}/admin`, { headers: { cookie: cookie("gia-ma-token") } });
    assertEq(r.status, 307);
  });
  await check("phiên hết hạn tuyệt đối → 307 + dòng bị xóa", async () => {
    const s = await mintSession({ expiresAt: new Date(Date.now() - 1000) });
    createdSessionIds.push(s.id);
    const r = await fetchNoRedirect(`${BASE}/admin`, { headers: { cookie: cookie(s.token) } });
    assertEq(r.status, 307);
    assertEq(await db.adminSession.findUnique({ where: { id: s.id } }), null);
  });
  await check("phiên idle 31 phút → 307 + dòng bị xóa (S2)", async () => {
    const s = await mintSession({ lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) });
    createdSessionIds.push(s.id);
    const r = await fetchNoRedirect(`${BASE}/admin`, { headers: { cookie: cookie(s.token) } });
    assertEq(r.status, 307);
    assertEq(await db.adminSession.findUnique({ where: { id: s.id } }), null);
  });
  await check("phiên idle 29 phút → vẫn vào được", async () => {
    const s = await mintSession({ lastSeenAt: new Date(Date.now() - 29 * 60 * 1000) });
    createdSessionIds.push(s.id);
    const r = await fetchNoRedirect(`${BASE}/admin`, { headers: { cookie: cookie(s.token) } });
    assertEq(r.status, 200);
  });

  const good = await mintSession();
  createdSessionIds.push(good.id);
  const authHeaders = { cookie: cookie(good.token) };

  await check("đã đăng nhập: /admin → 200", async () => {
    const r = await fetchNoRedirect(`${BASE}/admin`, { headers: authHeaders });
    assertEq(r.status, 200);
  });
  await check("phản hồi admin có Cache-Control: no-store", async () => {
    for (const p of ["/admin", "/admin/products", "/admin/activity", "/admin/news"]) {
      const r = await fetchNoRedirect(`${BASE}${p}`, { headers: authHeaders });
      assert((r.headers.get("cache-control") ?? "").includes("no-store"), `${p} thiếu no-store`);
    }
  });

  console.log("S2 — đăng nhập + giới hạn:");
  await check("5 lần sai → lần 6 trả 429 (5 lần/15 phút)", async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: `sai-${i}` }),
      });
      last = r.status;
      if (i < 5) assert(r.status === 401, `lần ${i + 1} kỳ vọng 401, được ${r.status}`);
    }
    assertEq(last, 429);
  });
  await check("lỗi đăng nhập chung chung, không phân biệt sai tên/sai mật khẩu", async () => {
    await db.adminLoginAttempt.deleteMany({});
    const r = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "khong-ton-tai", password: "x" }),
    });
    assertEq(r.status, 401);
    const data = (await r.json()) as { error?: string };
    assertEq(data.error, "Tên đăng nhập hoặc mật khẩu không đúng.");
    await db.adminLoginAttempt.deleteMany({});
  });
  await check("không có open redirect: Location sau POST login không chứa evil.com", async () => {
    const r = await fetchNoRedirect(`${BASE}/api/admin/login?next=https://evil.com`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "username=admin&password=sai",
    });
    const loc = r.headers.get("location") ?? "";
    assert(!loc.includes("evil.com"), `Location chứa evil.com: ${loc}`);
    // redirectUrl() trả URL tuyệt đối cùng host (không phải relative):
    // chấp nhận /login... hoặc http(s)://<host-của-shop>/login...
    const u = new URL(loc, BASE);
    assertEq(u.origin, new URL(BASE).origin);
    assert(u.pathname.startsWith("/login"), `Location phải về /login: ${loc}`);
    await db.adminLoginAttempt.deleteMany({});
  });

  console.log("S3 — injection (tham số công khai):");
  const sqliPayloads = [
    "' OR 1=1--",
    '"; DROP TABLE products;--',
    "%",
    "\\",
    "a".repeat(5000),
    "test\u0000x",
  ];
  for (const payload of sqliPayloads) {
    await check(`SQLi không 500, không đổi dữ liệu: ${JSON.stringify(payload.slice(0, 20))}`, async () => {
      const before = await db.product.count();
      const r = await fetch(`${BASE}/search?q=${encodeURIComponent(payload)}`);
      assert(r.status !== 500, `status ${r.status}`);
      assertEq(await db.product.count(), before);
    });
  }
  await check("SQLi lên tham số trang/danh mục: page/tab/payment không 500", async () => {
    const urls = [
      "/search?q=x&page=' OR 1=1--",
      "/hoa-tuoi?page=999999999",
      "/hoa-tuoi?tab=' OR 1=1--",
    ];
    for (const u of urls) {
      const r = await fetch(`${BASE}${u}`);
      assert(r.status !== 500, `${u} → ${r.status}`);
    }
  });
  // SQLi lên slug/trang tin tức (Ngày 18): không 500, không đổi dữ liệu.
  await check("SQLi lên slug/trang tin tức không 500, không đổi dữ liệu", async () => {
    const before = await db.newsArticle.count();
    const urls = [
      "/tin-tuc/' OR 1=1--",
      "/tin-tuc/%22; DROP TABLE news;--",
      "/tin-tuc?trang=' OR 1=1--",
      "/tin-tuc?trang=999999999",
      "/search?q=' OR 1=1--",
    ];
    for (const u of urls) {
      const r = await fetch(`${BASE}${u}`);
      assert(r.status !== 500, `${u} → ${r.status}`);
    }
    assertEq(await db.newsArticle.count(), before);
  });
  await check("XSS: payload <script> vào q bị escape ở shop", async () => {
    const payload = "<script>alert(1)</script>";
    const r = await fetch(`${BASE}/search?q=${encodeURIComponent(payload)}`);
    const body = await r.text();
    assert(!body.includes("<script>alert(1)</script>"), "payload thô xuất hiện trong HTML");
    assert(body.includes("&lt;script&gt;"), "payload phải bị escape");
  });
  await check("XSS: payload vào suggest/quick-view không 500, không thực thi", async () => {
    const payload = '"><svg onload=alert(1)>';
    const r1 = await fetch(`${BASE}/api/search/suggest?q=${encodeURIComponent(payload)}`);
    assert(r1.status !== 500, `suggest ${r1.status}`);
    const j = await r1.text();
    assert(!j.includes("<svg onload"), "suggest rò payload thô");
    const r2 = await fetch(`${BASE}/api/quick-view?id=${encodeURIComponent(payload)}`);
    assert(r2.status !== 500, `quick-view ${r2.status}`);
  });
  await check("XSS lưu qua đơn hàng: tên khách chứa payload không chạy ở admin (đọc HTML)", async () => {
    // Không tạo đơn thật ở đây (S8 thuộc agent sau); kiểm trang
    // /admin/orders với tham số tìm kiếm chứa payload.
    const payload = "<img src=x onerror=alert(1)>";
    const r = await fetchNoRedirect(`${BASE}/admin/orders?q=${encodeURIComponent(payload)}`, { headers: authHeaders });
    assert(r.status === 200, `status ${r.status}`);
    const body = await r.text();
    assert(!body.includes("<img src=x onerror=alert(1)>"), "payload thô trong HTML admin");
  });
  // XSS lưu qua bài tin tức (Ngày 18): payload vào tiêu đề/nội dung/
  // tác giả/tóm tắt — kiểm HTML ở shop (/tin-tuc, chi tiết) VÀ admin
  // (/admin/news): payload phải bị escape, không thực thi. Nội dung
  // Markdown đi qua renderMarkdown chung (đã có test ReDoS 50 ms ở
  // markdown.test.ts) nên không fuzz lại ở đây.
  await check("XSS lưu qua tin tức: payload không chạy ở shop và admin", async () => {
    const slug = "test-xss-news";
    await db.newsArticle.deleteMany({ where: { slug } });
    await db.settingsAudit.deleteMany({ where: { key: `news:${slug}` } });
    try {
      await db.newsArticle.create({
        data: {
          slug,
          title: "<script>alert(1)</script>",
          excerpt: "<script>alert(2)</script>",
          content: "# Hi\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
          author: '"><svg onload=alert(1)>',
          isPublished: true,
          publishedAt: new Date(),
        },
      });
      const detail = await fetch(`${BASE}/tin-tuc/${slug}`);
      assertEq(detail.status, 200);
      const detailBody = await detail.text();
      assert(!detailBody.includes("<script>alert(1)</script>"), "payload script thô ở chi tiết");
      assert(!detailBody.includes("<img src=x onerror=alert(1)>"), "payload img thô ở chi tiết");
      assert(!detailBody.includes("<svg onload=alert(1)>"), "payload svg thô ở chi tiết");
      assert(!detailBody.includes("javascript:alert(1)"), "link javascript: lọt vào HTML");
      assert(detailBody.includes("&lt;script&gt;"), "payload phải bị escape ở chi tiết");
      const list = await fetch(`${BASE}/tin-tuc`);
      assertEq(list.status, 200);
      const listBody = await list.text();
      assert(!listBody.includes("<script>alert(1)</script>"), "payload script thô ở danh sách");
      assert(!listBody.includes("<script>alert(2)</script>"), "payload excerpt thô ở danh sách");
      const admin = await fetchNoRedirect(`${BASE}/admin/news`, { headers: authHeaders });
      assertEq(admin.status, 200);
      const adminBody = await admin.text();
      assert(!adminBody.includes("<script>alert(1)</script>"), "payload script thô ở admin");
      assert(!adminBody.includes("<svg onload=alert(1)>"), "payload svg thô ở admin");
    } finally {
      await db.newsArticle.deleteMany({ where: { slug } });
      await db.settingsAudit.deleteMany({ where: { key: `news:${slug}` } });
    }
  });

  console.log("S4 — CSRF:");
  await check("upload route: Origin evil → 403", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(tinyPng())], { type: "image/png" }), "a.png");
    const r = await fetch(`${BASE}/api/admin/upload`, {
      method: "POST",
      headers: { ...authHeaders, origin: "https://evil.example" },
      body: form,
    });
    assertEq(r.status, 403);
  });
  await check("upload route: thiếu Origin → 403", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(tinyPng())], { type: "image/png" }), "a.png");
    const r = await fetch(`${BASE}/api/admin/upload`, {
      method: "POST",
      headers: { ...authHeaders },
      body: form,
    });
    assertEq(r.status, 403);
  });
  await check("server action: Origin evil + Next-Action giả → bị chặn, không chạy", async () => {
    // Next 15 chặn action khác nguồn bằng lỗi "Invalid Server Actions
    // request" (500) và ghi log "Aborting the action" — action không
    // chạy. Đối chứng: cùng nguồn + id giả → 404 (lỗi id, không phải
    // lỗi nguồn), chứng tỏ 500 là do kiểm Origin.
    const evil = await fetch(`${BASE}/admin/products`, {
      method: "POST",
      headers: { ...authHeaders, origin: "https://evil.example", "Next-Action": "deadbeef" },
      body: "",
    });
    assert(evil.status === 403 || evil.status === 500, `evil origin → ${evil.status}`);
    const same = await fetch(`${BASE}/admin/products`, {
      method: "POST",
      headers: { ...authHeaders, origin: BASE, "Next-Action": "deadbeef" },
      body: "",
    });
    assertEq(same.status, 404);
    // Log server phải ghi rõ lý do chặn là Origin không khớp.
    const { readFile } = await import("node:fs/promises");
    const log = await readFile(".next/standalone-server.log", "utf8").catch(() => "");
    assert(
      log.includes("does not match `origin` header") && log.includes("Aborting the action"),
      "log server không ghi lý do chặn Origin",
    );
  });

  console.log("S5 — upload:");
  async function uploadProduct(file: Blob, filename: string, extraHeaders: Record<string, string> = {}) {
    const form = new FormData();
    form.append("file", file, filename);
    return fetch(`${BASE}/api/admin/upload`, {
      method: "POST",
      headers: { ...authHeaders, origin: BASE, ...extraHeaders },
      body: form,
    });
  }
  await check("SVG tĩnh bị từ chối ở settings/upload (S5 Ngày 17)", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>';
    const form = new FormData();
    form.append("purpose", "logo");
    form.append("file", new Blob([svg], { type: "image/svg+xml" }), "logo.svg");
    const r = await fetch(`${BASE}/api/admin/settings/upload`, {
      method: "POST",
      headers: { ...authHeaders, origin: BASE },
      body: form,
    });
    assertEq(r.status, 400);
    const data = (await r.json()) as { error?: string };
    assert((data.error ?? "").includes("JPEG, PNG hoặc WebP"), `thông báo: ${data.error}`);
  });
  await check("SVG chứa script bị từ chối ở settings/upload", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const form = new FormData();
    form.append("purpose", "logo");
    form.append("file", new Blob([svg], { type: "image/svg+xml" }), "logo.svg");
    const r = await fetch(`${BASE}/api/admin/settings/upload`, {
      method: "POST",
      headers: { ...authHeaders, origin: BASE },
      body: form,
    });
    assertEq(r.status, 400);
  });
  await check(".png chứa HTML/PHP → 400", async () => {
    const bad = new Blob(["<html><script>alert(1)</script></html><?php echo 1; ?>"], { type: "image/png" });
    const r = await uploadProduct(bad, "x.png");
    assertEq(r.status, 400);
  });
  await check("đổi đuôi: file text đặt tên .png → 400", async () => {
    const bad = new Blob(["hello world, khong phai anh"], { type: "image/png" });
    const r = await uploadProduct(bad, "anh.png");
    assertEq(r.status, 400);
  });
  await check("ảnh > 2 MB → 400", async () => {
    const big = Buffer.concat([tinyPng(), Buffer.alloc(3 * 1024 * 1024)]);
    const r = await uploadProduct(new Blob([new Uint8Array(big)], { type: "image/png" }), "lon.png");
    assert(r.status === 400 || r.status === 413, `status ${r.status}`);
  });
  await check("ảnh PNG 7000×100 px → 400 (giới hạn điểm ảnh)", async () => {
    const r = await uploadProduct(new Blob([new Uint8Array(tinyPng(7000, 100))], { type: "image/png" }), "rong.png");
    assertEq(r.status, 400);
  });
  await check("ảnh hỏng (magic bytes đúng, header thiếu) → 400", async () => {
    const truncated = tinyPng().subarray(0, 10);
    const r = await uploadProduct(new Blob([new Uint8Array(truncated)], { type: "image/png" }), "hong.png");
    assertEq(r.status, 400);
  });
  await check("PNG hợp lệ nhỏ → 200, tên theo băm nội dung", async () => {
    const r = await uploadProduct(new Blob([new Uint8Array(tinyPng())], { type: "image/png" }), "../../evil.png");
    assertEq(r.status, 200);
    const data = (await r.json()) as { url?: string };
    assert(/^https?:\/\/.+\/uploads\/[a-f0-9]{12}\.png$/.test(data.url ?? ""), `url: ${data.url}`);
    const name = (data.url ?? "").split("/").pop()!;
    uploadedFiles.push(name);
  });
  await check("ảnh đã tải phục vụ với nosniff", async () => {
    if (uploadedFiles.length === 0) throw new Error("không có file đã tải");
    const r = await fetch(`${BASE}/uploads/${uploadedFiles[0]}`);
    assertEq(r.status, 200);
    assertEq(r.headers.get("x-content-type-options"), "nosniff");
  });

  console.log("S10 — header (động):");
  await check("CSP + nosniff + Referrer-Policy + Permissions-Policy trên /", async () => {
    const r = await fetch(`${BASE}/`);
    const csp = r.headers.get("content-security-policy") ?? "";
    assert(csp.includes("default-src 'self'"), "thiếu default-src");
    assert(csp.includes("script-src 'self' 'nonce-"), "script-src thiếu nonce");
    assert(!/script-src[^;]*unsafe-inline/.test(csp), "script-src còn unsafe-inline");
    assertEq(r.headers.get("x-content-type-options"), "nosniff");
    assertEq(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert((r.headers.get("permissions-policy") ?? "").includes("camera=()"), "thiếu Permissions-Policy");
    assertEq(r.headers.get("x-powered-by"), null);
  });
  await check("HSTS khi chạy production", async () => {
    const r = await fetch(`${BASE}/`);
    const hsts = r.headers.get("strict-transport-security") ?? "";
    assert(hsts.includes("max-age=31536000"), `HSTS: ${hsts || "(không có)"}`);
  });
  await check("admin + /login không bị iframe bao (frame-ancestors 'none')", async () => {
    const r = await fetchNoRedirect(`${BASE}/login`);
    assert((r.headers.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"), "thiếu frame-ancestors");
    assertEq(r.headers.get("x-frame-options"), "DENY");
  });
  await check("trang lỗi không lộ stack trace", async () => {
    const r = await fetch(`${BASE}/khong-co-trang-nay-xyz`);
    assert(r.status === 404, `status ${r.status}`);
    const body = await r.text();
    assert(!/at .*\(.*\.ts:\d+|node_modules\/next|Error: /i.test(body), "lộ stack trace");
  });

  console.log("S12 — audit:");
  await check("nhật ký hoạt động không có đường xóa/sửa trong giao diện", async () => {
    const r = await fetchNoRedirect(`${BASE}/admin/activity`, { headers: authHeaders });
    assertEq(r.status, 200);
    const body = await r.text();
    assert(!/xóa nhật ký|xoa-nhat-ky|deleteActivity|delete-activity/i.test(body), "có đường xóa nhật ký");
  });

  console.log("\nDọn dẹp...");
  for (const id of createdSessionIds) {
    await db.adminSession.deleteMany({ where: { id } });
  }
  await db.adminLoginAttempt.deleteMany({});
  for (const name of uploadedFiles) {
    try {
      await unlink(path.join(process.cwd(), "public/uploads", name));
    } catch { /* đã dọn hoặc chưa từng ghi đĩa */ }
  }
  await db.$disconnect();

  console.log(`\nsecurity-live-check: ${pass} PASS, ${fail} FAIL`);
  if (failedNames.length > 0) console.log(`Chưa đạt: ${failedNames.join("; ")}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("security-live-check lỗi không lường trước:", e instanceof Error ? e.message : e);
  try {
    for (const id of createdSessionIds) await db.adminSession.deleteMany({ where: { id } });
    await db.adminLoginAttempt.deleteMany({});
    await db.$disconnect();
  } catch { /* bỏ qua */ }
  process.exit(1);
});
