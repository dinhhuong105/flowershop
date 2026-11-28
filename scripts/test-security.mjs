// Bộ test bảo mật Ngày 17 (S1–S12) — chạy offline trên server
// standalone LOCAL, không đụng production:
//   npm run test:security
//
// Thứ tự:
//   1. Unit test bảo mật (tsx --test, không cần server).
//   2. Quét tĩnh (scripts/security-scan.mjs): phân quyền, allowlist
//      dangerouslySetInnerHTML, SQL thô, bí mật.
//   3. Khởi động server standalone :3000 nếu chưa chạy (NODE_ENV
//      =production để kiểm HSTS), rồi kiểm động
//      (scripts/security-live-check.ts) + quét live chỉ GET/HEAD
//      (scripts/security-scan-live.sh).
//   4. Dừng server nếu chính script này đã khởi động nó.
// Thoát != 0 khi có bước nào FAIL. Server log: .next/standalone-server.log.
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = process.env.SECURITY_BASE_URL ?? "http://localhost:3000";
let failures = 0;

function runStep(name, cmd, args, opts = {}) {
  console.log(`\n== ${name}: ${cmd} ${args.join(" ")} ==`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", ...opts });
  if (r.status !== 0) {
    failures += 1;
    console.log(`!! ${name} FAIL (exit ${r.status})`);
  } else {
    console.log(`-- ${name} OK`);
  }
  return r.status === 0;
}

async function serverUp() {
  try {
    const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

const nodeBin = process.execPath;
const npxBin = "npx"; // dùng npx trên PATH — chạy được cả local lẫn CI
// (trước đây ghi cứng ~/tools/node22/bin/node|npx nên trên GitHub
// Actions không chạy được; process.execPath chính là node đang chạy
// script này nên hành vi local không đổi — Ngày 17 Phần D).

// 1. Unit test bảo mật.
runStep("unit test bảo mật", npxBin, [
  "tsx",
  "--test",
  "src/lib/rate-limit.test.ts",
  "src/lib/admin/session-idle.test.ts",
  "src/lib/security-headers.test.ts",
  "src/lib/markdown.test.ts",
  "src/lib/admin/uploads.test.ts",
  "src/lib/admin/news-validation.test.ts",
  "src/lib/news-jsonld.test.ts",
  "src/lib/storage.test.ts",
  "src/lib/admin/ip.test.ts",
  "src/lib/admin/password.test.ts",
]);

// 2. Quét tĩnh.
runStep("quét tĩnh", nodeBin, ["scripts/security-scan.mjs"]);

// 3. Server standalone + kiểm động.
const alreadyUp = await serverUp();
let startedByUs = false;
if (!alreadyUp) {
  console.log("\n== khởi động server standalone :3000 (NODE_ENV=production) ==");
  const r = spawnSync("bash", ["scripts/start-standalone.sh", "3000"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", PATH: `${process.env.HOME}/tools/node22/bin:${process.env.PATH}` },
  });
  if (r.status !== 0 || !(await serverUp())) {
    failures += 1;
    console.log("!! không khởi động được server standalone");
  } else {
    startedByUs = true;
  }
} else {
  console.log("\n== server :3000 đã chạy — dùng luôn (không dừng sau khi xong) ==");
}

if (failures === 0 || (await serverUp())) {
  runStep("kiểm động", npxBin, ["tsx", "scripts/security-live-check.ts", BASE]);
  runStep("quét live (GET/HEAD)", "bash", ["scripts/security-scan-live.sh", BASE]);
}

if (startedByUs) {
  console.log("\n== dừng server standalone đã khởi động ==");
  try {
    const pid = execFileSync("bash", ["-c", "ss -ltnp 2>/dev/null | grep ':3000 ' | grep -oP 'pid=\\K[0-9]+' | head -1"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (pid) execFileSync("kill", [pid]);
  } catch {
    console.log("(không dừng được server — kiểm tra tay cổng 3000)");
  }
}

console.log(`\ntest:security: ${failures === 0 ? "TẤT CẢ ĐẠT" : `${failures} bước FAIL`}`);
process.exit(failures === 0 ? 0 : 1);
