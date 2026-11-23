// Tạo ADMIN_PASSWORD_HASH từ mật khẩu đọc ở stdin (không qua tham
// số dòng lệnh — mật khẩu không lọt vào lịch sử shell hay ps).
//   echo -n '<mật khẩu>' | npx tsx scripts/hash-admin-password.ts
// In ra: scrypt$<saltHex>$<hashHex> (N=32768, r=8, p=1, keylen 64,
// maxmem 64 MB — xem src/lib/admin/password.ts).
// KHÔNG ghi mật khẩu gốc hay hash vào file nào khác; hash chỉ đưa
// vào .env (gitignored) hoặc biến môi trường khi deploy.

import { readFileSync } from "node:fs";
import { hashAdminPassword } from "../src/lib/admin/password";

async function main(): Promise<void> {
  const password = readFileSync(0, "utf-8").replace(/\r?\n$/, "");
  if (password.length === 0) {
    console.error("Mật khẩu trống — nhập mật khẩu qua stdin.");
    process.exit(1);
  }
  console.log(await hashAdminPassword(password));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
