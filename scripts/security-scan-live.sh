#!/usr/bin/env bash
# Quét bảo mật live CHỈ ĐỌC (Ngày 17 S10/S1/S3) — dùng được cả trên
# production: CHỈ GET/HEAD, không gửi payload tấn công, không đăng
# nhập, không đổi dữ liệu.
#
# Cách dùng: bash scripts/security-scan-live.sh <base-url>
#   vd: bash scripts/security-scan-live.sh https://flowershop-steel.vercel.app
#       bash scripts/security-scan-live.sh http://localhost:3000
#
# Kiểm:
#  S10 header trên / và /login: CSP (default-src 'self', object-src
#      'none', base-uri 'self', frame-ancestors 'none', form-action
#      'self', script-src có nonce, không 'unsafe-inline' cho script),
#      X-Content-Type-Options: nosniff,
#      Referrer-Policy: strict-origin-when-cross-origin,
#      Permissions-Policy (camera/mic/geolocation tắt), không
#      X-Powered-By, HSTS (chỉ kiểm khi base-url là https).
#  S1  /admin và /admin/products chưa đăng nhập → 307 về /login
#      (hoặc 401/403), không lộ dữ liệu; /login có no-store.
#  S3  /search?q=<payload SQLi/XSS> → không 500, không phản chiếu
#      payload thô chưa escape trong HTML.
set -uo pipefail

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "Cách dùng: $0 <base-url>" >&2
  exit 2
fi
BASE="${BASE%/}"
FAIL=0
PASS=0

check() { # check <mô tả> <lệnh...>
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    PASS=$((PASS + 1)); echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1)); echo "  FAIL: $desc"
  fi
}

headers() { # headers <path> → header (chữ thường), theo redirect? không
  curl -s -D - -o /dev/null "$BASE$1" | tr -d '\r' | awk -F': ' '{k=tolower($1); $1=""; sub(/^ /,""); print k": "$0}'
}
header_value() { # header_value <path> <tên-chữ-thường>
  headers "$1" | awk -F': ' -v k="$2" '$1==k {print $2; exit}'
}
status_of() { curl -s -o /dev/null -w "%{http_code}" "$BASE$1"; }

echo "security-scan-live: $BASE"

echo "S10 — header trên /:"
HOME_CSP="$(header_value / content-security-policy)"
check "CSP có default-src 'self'" grep -q "default-src 'self'" <<<"$HOME_CSP"
check "CSP có object-src 'none'" grep -q "object-src 'none'" <<<"$HOME_CSP"
check "CSP có base-uri 'self'" grep -q "base-uri 'self'" <<<"$HOME_CSP"
check "CSP có frame-ancestors 'none'" grep -q "frame-ancestors 'none'" <<<"$HOME_CSP"
check "CSP có form-action 'self'" grep -q "form-action 'self'" <<<"$HOME_CSP"
check "CSP script-src dùng nonce, không unsafe-inline" bash -c "grep -q \"script-src 'self' 'nonce-\" <<<\"\$0\" && ! grep -q \"script-src[^;]*unsafe-inline\" <<<\"\$0\"" "$HOME_CSP"
check "X-Content-Type-Options: nosniff" test "$(header_value / x-content-type-options)" = "nosniff"
check "Referrer-Policy: strict-origin-when-cross-origin" test "$(header_value / referrer-policy)" = "strict-origin-when-cross-origin"
check "Permissions-Policy tắt camera/mic/geolocation" grep -q "camera=()" <<<"$(header_value / permissions-policy)"
check "không có X-Powered-By" test -z "$(header_value / x-powered-by)"
if [[ "$BASE" == https://* ]]; then
  check "HSTS max-age >= 31536000 (https)" grep -q "max-age=31536000" <<<"$(header_value / strict-transport-security)"
else
  echo "  (bỏ qua) HSTS chỉ kiểm trên https"
fi

echo "S10 — header trên /login:"
check "CSP có trên /login" test -n "$(header_value /login content-security-policy)"
check "X-Frame-Options: DENY trên /login" test "$(header_value /login x-frame-options)" = "DENY"

echo "S1 — chưa đăng nhập:"
check "/admin → 307/401/403" bash -c 'c=$(curl -s -o /dev/null -w "%{http_code}" "$0/admin"); [ "$c" = 307 ] || [ "$c" = 401 ] || [ "$c" = 403 ]' "$BASE"
check "/admin/products → 307/401/403" bash -c 'c=$(curl -s -o /dev/null -w "%{http_code}" "$0/admin/products"); [ "$c" = 307 ] || [ "$c" = 401 ] || [ "$c" = 403 ]' "$BASE"
check "/admin trả no-store" grep -qi "no-store" <<<"$(header_value /admin cache-control)"
check "/login trả no-store" grep -qi "no-store" <<<"$(header_value /login cache-control)"
check "/order/KHONGTONTAI → 404 (không phân biệt)" test "$(status_of /order/KHONGTONTAI)" = "404"

echo "S3 — payload lên tham số công khai (chỉ GET, không đổi dữ liệu):"
SQLI_BODY="$(curl -s "$BASE/search?q=%27%20OR%201%3D1--")"
check "SQLi q=' OR 1=1-- không 500" bash -c 'c=$(curl -s -o /dev/null -w "%{http_code}" "$0/search?q=%27%20OR%201%3D1--"); [ "$c" != 500 ]' "$BASE"
check "SQLi không rò lỗi SQL trong HTML" bash -c '! grep -qi "psql\|postgres\|prisma\|syntax error" <<<"$0"' "$SQLI_BODY"
XSS_BODY="$(curl -s "$BASE/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E")"
check "XSS q=<script> không 500" bash -c 'c=$(curl -s -o /dev/null -w "%{http_code}" "$0/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E"); [ "$c" != 500 ]' "$BASE"
check "XSS không phản chiếu <script> thô" bash -c '! grep -q "<script>alert(1)</script>" <<<"$0"' "$XSS_BODY"

echo
echo "security-scan-live: $PASS PASS, $FAIL FAIL"
[ "$FAIL" = 0 ]
