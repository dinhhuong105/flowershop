import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { isValidAdminPasswordHash } from "./config-format";

// Băm mật khẩu quản trị bằng scrypt (Ngày 7 §2): N=32768, r=8, p=1,
// keylen 64, định dạng `scrypt$<saltHex>$<hashHex>`.
//
// QUAN TRỌNG — PHÁT HIỆN NGÀY 7: Node 22 đặt maxmem mặc định của
// scrypt là 32 MB, nhưng N=32768/r=8 cần khoảng 33,5 MB nên scrypt
// ném ERR_CRYPTO_INVALID_SCRYPT_PARAMS nếu không truyền maxmem.
// Mọi chỗ gọi scrypt ở đây đều truyền maxmem = 64 MB. (Xem "Khác
// đặc tả" trong báo cáo Ngày 7.)
export const SCRYPT_PARAMS = {
  N: 32768,
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 64 * 1024 * 1024,
} as const;

// Gọi scrypt dạng callback (promisify không nhận tham số options
// theo kiểu của @types/node) rồi bọc thành Promise.
function scryptPromise(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      SCRYPT_PARAMS.keylen,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
        maxmem: SCRYPT_PARAMS.maxmem,
      },
      (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      },
    );
  });
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptPromise(password, salt);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

// So khớp mật khẩu với hash dạng scrypt$<saltHex>$<hashHex> bằng
// timingSafeEqual. Hash sai định dạng → false (không throw).
export async function verifyAdminPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (!isValidAdminPasswordHash(hash)) return false;
  const parts = hash.trim().split("$");
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  let derived: Buffer;
  try {
    derived = await scryptPromise(password, salt);
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
