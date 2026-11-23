// Định dạng ADMIN_PASSWORD_HASH — file thuần, không import node:*
// nên dùng được cả trong middleware (Edge runtime).
// scrypt$<saltHex: 32 ký tự hex = 16 byte>$<hashHex: 128 ký tự hex = 64 byte>
export const ADMIN_PASSWORD_HASH_RE = /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/;

export function isValidAdminPasswordHash(
  value: string | undefined | null,
): boolean {
  if (!value) return false;
  return ADMIN_PASSWORD_HASH_RE.test(value.trim());
}
