// Quét tĩnh bảo mật (Ngày 17 S1/S3/S11) — chạy offline, không cần
// server hay DB: `node scripts/security-scan.mjs` (được gọi từ
// `npm run test:security`). Thoát != 0 khi có lỗi.
//
// Kiểm:
//  S1  mọi trang src/app/admin/**/page.tsx gọi requireAdmin();
//      mọi route handler src/app/api/** gọi requireAdmin() trừ danh
//      sách ngoại lệ công khai; mọi hàm trong file "use server" gọi
//      requireAdmin() trừ ngoại lệ (đặt hàng, giỏ hàng, đăng nhập,
//      đăng xuất, tra cứu đơn).
//  S3  dangerouslySetInnerHTML chỉ ở danh sách cho phép; mọi
//      $queryRaw/$executeRaw phải tham số hóa (không nối chuỗi).
//  S11 không có bí mật trong kho mã (kể cả file test đã loại trừ
//      mẫu giả), không có bí mật trong gói JS trình duyệt
//      (.next/static), .env không nằm trong git, .env.example chỉ
//      có tên biến/placeholder.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;
let checks = 0;

function fail(msg) {
  failures += 1;
  console.log(`  FAIL: ${msg}`);
}
function ok(msg) {
  checks += 1;
  console.log(`  ok: ${msg}`);
}

function listFiles(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      out.push(...listFiles(full, exts));
    } else if (exts.some((e) => full.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}
const rel = (f) => path.relative(ROOT, f).replaceAll(path.sep, "/");

// ---------------- S1: phân quyền ----------------
console.log("S1 — phân quyền (tĩnh):");

// Trang quản trị: mọi page.tsx dưới src/app/admin/** phải gọi requireAdmin().
const adminPages = listFiles(path.join(ROOT, "src/app/admin"), [".tsx", ".ts"]).filter((f) =>
  /(^|\/)page\.tsx?$/.test(f),
);
let adminPagesOk = 0;
for (const f of adminPages) {
  const src = readFileSync(f, "utf8");
  if (/await\s+requireAdmin\s*\(\)/.test(src)) adminPagesOk += 1;
  else fail(`trang admin không gọi requireAdmin(): ${rel(f)}`);
}
ok(`${adminPagesOk}/${adminPages.length} trang admin gọi requireAdmin()`);

// Layout admin cũng phải kiểm tra trước khi đọc số liệu.
const adminLayout = readFileSync(path.join(ROOT, "src/app/admin/layout.tsx"), "utf8");
if (/await\s+requireAdmin\s*\(\)/.test(adminLayout)) ok("layout admin gọi requireAdmin()");
else fail("layout admin không gọi requireAdmin()");

// Route handler API: ngoại lệ công khai tường minh.
const API_PUBLIC = new Set([
  "src/app/api/health/route.ts", // chỉ trả {status:"ok"} sau SELECT 1
  "src/app/api/quick-view/route.ts", // dữ liệu sản phẩm công khai
  "src/app/api/search/suggest/route.ts", // gợi ý tìm kiếm công khai
  "src/app/uploads/[name]/route.ts", // ảnh sản phẩm công khai (tên do server sinh)
]);
const API_LOGIN = "src/app/api/admin/login/route.ts"; // tạo phiên — KHÔNG gọi requireAdmin
const apiRoutes = listFiles(path.join(ROOT, "src/app"), ["route.ts"]);
for (const f of apiRoutes) {
  const r = rel(f);
  const src = readFileSync(f, "utf8");
  if (API_PUBLIC.has(r)) {
    ok(`route công khai (ngoại lệ): ${r}`);
  } else if (r === API_LOGIN) {
    if (/await\s+requireAdmin\s*\(\)/.test(src)) fail(`route login không được gọi requireAdmin: ${r}`);
    else ok(`route tạo phiên (ngoại lệ): ${r}`);
  } else if (/await\s+requireAdmin\s*\(\)/.test(src)) {
    ok(`route admin gọi requireAdmin(): ${r}`);
  } else {
    fail(`route handler không gọi requireAdmin(): ${r}`);
  }
}

// File "use server": từng hàm export phải gọi requireAdmin() trừ ngoại lệ.
const SERVER_ACTION_PUBLIC = new Set([
  "placeOrder", // đặt hàng công khai (S8 — agent đơn hàng)
  "addToCart",
  "updateQuantity",
  "removeItem",
  "buyNow", // giỏ hàng công khai
  "logoutAction", // đăng xuất: phá phiên, không cần phiên
]);
const serverFiles = listFiles(path.join(ROOT, "src/app/actions"), [".ts"]).concat(
  listFiles(path.join(ROOT, "src/app/admin/settings"), ["actions.ts"]),
);
for (const f of serverFiles) {
  const src = readFileSync(f, "utf8");
  if (!src.includes('"use server"')) continue;
  const chunks = src.split(/(?=export async function )/);
  for (const chunk of chunks) {
    const m = /^export async function (\w+)/.exec(chunk);
    if (!m) continue;
    const name = m[1];
    if (SERVER_ACTION_PUBLIC.has(name)) {
      ok(`server action công khai (ngoại lệ): ${name} (${rel(f)})`);
    } else {
      // requireAdmin() phải đứng TRƯỚC lần chạm DB đầu tiên trong hàm.
      const authAt = chunk.indexOf("await requireAdmin()");
      const dbAt = chunk.search(/\bdb\./);
      if (authAt === -1) fail(`server action không gọi requireAdmin(): ${name} (${rel(f)})`);
      else if (dbAt !== -1 && authAt > dbAt) {
        fail(`server action gọi requireAdmin() SAU khi chạm DB: ${name} (${rel(f)})`);
      } else ok(`server action gọi requireAdmin() đầu tiên: ${name}`);
    }
  }
}

// ---------------- S3: dangerouslySetInnerHTML + SQL thô ----------------
console.log("S3 — dangerouslySetInnerHTML / SQL thô:");
const DSI_ALLOWLIST = new Set([
  "src/app/layout.tsx", // script class 'js' (nội dung cố định) + JSON-LD đã thoát <
  "src/app/[category]/page.tsx", // renderMarkdown (đã thoát HTML)
  "src/components/order/BankTransferBox.tsx", // SVG QR do thư viện qrcode sinh
  "src/components/admin/BankQrPreview.tsx", // SVG QR do thư viện qrcode sinh
  "src/components/admin/PageForm.tsx", // xem trước renderMarkdown
]);
const srcFiles = listFiles(path.join(ROOT, "src"), [".ts", ".tsx"]).filter(
  (f) => !/\.test\.ts(x)?$/.test(f) && !/\.db\.test\.ts$/.test(f),
);
for (const f of srcFiles) {
  const src = readFileSync(f, "utf8");
  if (!src.includes("dangerouslySetInnerHTML")) continue;
  const r = rel(f);
  if (DSI_ALLOWLIST.has(r)) ok(`dangerouslySetInnerHTML (cho phép): ${r}`);
  else fail(`dangerouslySetInnerHTML NGOÀI danh sách cho phép: ${r}`);
}

// $queryRaw/$executeRaw: không được nối chuỗi — chỉ chấp nhận nội suy
// tham số Prisma (định danh/biểu thức đơn giản). Báo lỗi khi thấy
// nối chuỗi (+, .join, String(, template lồng) trong template SQL.
let rawCount = 0;
for (const f of srcFiles) {
  const src = readFileSync(f, "utf8");
  const re = /\$(queryRaw|executeRaw)`([\s\S]*?)`/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    rawCount += 1;
    const body = m[2];
    const interps = [...body.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]);
    for (const interp of interps) {
      // Chỉ bắt nối chuỗi thật (+, String(), .join(), .concat(),
      // template lồng). Nội suy tham số (input.cartId, params.dip,
      // currentPriceSql là đối tượng Prisma.sql) là an toàn.
      if (/\+|String\(|\.join\(|\.concat\(|`/.test(interp)) {
        fail(`nối chuỗi trong SQL thô (${rel(f)}): \${${interp}}`);
      }
    }
  }
}
ok(`${rawCount} template $queryRaw/$executeRaw đều tham số hóa (không nối chuỗi)`);

// ---------------- S11: bí mật ----------------
console.log("S11 — quét bí mật:");
const SECRET_PATTERNS = [
  [/ghp_[A-Za-z0-9]{20,}/, "GitHub PAT (ghp_)"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "GitHub fine-grained PAT"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, "private key"],
  [/vercel_blob_rw_[A-Za-z0-9]{10,}/, "Vercel Blob token"],
  [/postgres:\/\/[^:\s]+:[^@\s]+@/, "postgres URL có mật khẩu"],
  [/scrypt\$[0-9a-f]{32,}\$[0-9a-f]{32,}/, "ADMIN_PASSWORD_HASH thật"],
];
// Quét kho mã (trừ file test — chứa mẫu giả như vercel_blob_rw_xxx —
// và trừ .env* local, .next, node_modules).
const scanFiles = listFiles(ROOT, [".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".sql"]).filter(
  (f) => {
    const r = rel(f);
    if (r.startsWith(".next/") || r.startsWith("node_modules/")) return false;
    if (/\.test\.ts(x)?$/.test(r) || /\.db\.test\.ts$/.test(r)) return false;
    if (r === ".env" || r.startsWith(".env.")) return false;
    if (r === "package-lock.json") return false;
    return true;
  },
);
let secretHits = 0;
for (const f of scanFiles) {
  const src = readFileSync(f, "utf8");
  for (const [re, label] of SECRET_PATTERNS) {
    if (re.test(src)) {
      secretHits += 1;
      fail(`bí mật (${label}) trong ${rel(f)}`);
    }
  }
}
if (secretHits === 0) ok(`không thấy bí mật trong ${scanFiles.length} file mã nguồn`);

// Gói JS trình duyệt (.next/static): chỉ NEXT_PUBLIC_* được phép;
// quét cùng mẫu (trừ postgres URL vì bundle không chứa).
if (existsSync(path.join(ROOT, ".next/static"))) {
  const bundleFiles = listFiles(path.join(ROOT, ".next/static"), [".js"]);
  let bundleHits = 0;
  for (const f of bundleFiles) {
    const src = readFileSync(f, "utf8");
    for (const [re, label] of SECRET_PATTERNS) {
      if (label === "postgres URL có mật khẩu") continue;
      if (re.test(src)) {
        bundleHits += 1;
        fail(`bí mật (${label}) trong bundle ${rel(f)}`);
      }
    }
  }
  if (bundleHits === 0) ok(`không thấy bí mật trong ${bundleFiles.length} file .next/static`);
} else {
  console.log("  (bỏ qua) chưa có .next/static — chạy sau `npm run build`");
}

// .env không nằm trong git; .env.example chỉ có tên biến/placeholder.
try {
  const tracked = execFileSync("git", ["ls-files", ".env"], { cwd: ROOT, encoding: "utf8" }).trim();
  if (tracked) fail(".env đang nằm trong git");
  else ok(".env không nằm trong git");
} catch {
  console.log("  (bỏ qua) không chạy được git ls-files");
}
const envExample = path.join(ROOT, ".env.example");
if (existsSync(envExample)) {
  const src = readFileSync(envExample, "utf8");
  if (/scrypt\$[0-9a-f]{32,}\$/.test(src)) fail(".env.example chứa hash thật");
  else ok(".env.example chỉ có tên biến/placeholder");
}

console.log(`\nsecurity-scan: ${checks} ok, ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
