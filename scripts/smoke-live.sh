#!/usr/bin/env bash
# Kiểm production sau mỗi lần deploy (Ngày 10 D10-5; Ngày 11 C5
# thêm 2 mục: trang chủ hiện tên shop từ Cài đặt, trang Cài đặt
# chung khi chưa đăng nhập chuyển về /login) — thay cho chuỗi curl
# gõ tay (D9-1). Chỉ dùng GET, không đăng nhập, không ghi dữ liệu.
# Thoát 0 khi mọi mục PASS, khác 0 khi có mục FAIL.
#
#   ./scripts/smoke-live.sh https://flowershop-steel.vercel.app/
#   ./scripts/smoke-live.sh http://localhost:3000   (kiểm bản local)
set -u

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "Cách dùng: $0 <base-url>   (vd: $0 https://flowershop-steel.vercel.app/)" >&2
  exit 2
fi
BASE="${BASE%/}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# check <tên> <đường-dẫn> <mã-kỳ-vọng> [kiểm-thêm]
# kiểm-thêm: "no-localhost" | "sitemap-line" | "location-login"
check() {
  local name="$1" path="$2" want="$3" extra="${4:-}"
  local body="$TMP/body" hdr="$TMP/hdr"
  local out code time_s
  # Một request duy nhất: mã + thời gian lấy cùng lúc (không gọi
  # curl lần 2 — vừa chậm vừa có thể ra kết quả khác lần 1).
  out="$(curl -s -D "$hdr" -o "$body" -w "%{http_code} %{time_total}" --max-time 20 "$BASE$path" 2>/dev/null || true)"
  if [ -z "$out" ]; then out="000 0"; fi
  code="${out%% *}"
  time_s="${out##* }"
  local ok=1 reason=""
  if [ "$code" != "$want" ]; then
    ok=0; reason="muốn $want, được $code"
  elif [ "$extra" = "no-localhost" ]; then
    if ! grep -q "<loc>" "$body"; then ok=0; reason="không có <loc> nào"; fi
    if grep -q "localhost" "$body"; then ok=0; reason="còn chứa localhost"; fi
  elif [ "$extra" = "sitemap-line" ]; then
    if ! grep -q "Sitemap: $BASE/sitemap.xml" "$body"; then
      ok=0; reason="không có dòng Sitemap đúng domain"
    fi
  elif [ "$extra" = "location-login" ]; then
    if ! grep -qi "^location:.*\/login" "$hdr"; then
      ok=0; reason="không chuyển tới /login"
    fi
  elif [[ "$extra" == contains:* ]]; then
    local needle="${extra#contains:}"
    if ! grep -qF "$needle" "$body"; then
      ok=0; reason="không chứa \"$needle\""
    fi
  fi
  local ms
  ms="$(awk -v t="$time_s" 'BEGIN { printf "%d", t * 1000 }')"
  if [ "$ok" -eq 1 ]; then
    PASS=$((PASS + 1))
    printf "%-32s %-42s %4s %6s ms  PASS\n" "$name" "$path" "$code" "$ms"
  else
    FAIL=$((FAIL + 1))
    printf "%-32s %-42s %4s %6s ms  FAIL (%s)\n" "$name" "$path" "$code" "$ms" "$reason"
  fi
}

printf "%-32s %-42s %4s %6s    %s\n" "MỤC KIỂM" "ĐƯỜNG DẪN" "MÃ" "TGIAN" "KẾT QUẢ"
check "Trang chủ" "/" "200"
check "Trang chủ (tên shop)" "/" "200" "contains:Hoa Tươi Demo"
check "Trang sản phẩm" "/hoa-tuoi/bo-hong-do-tinh-yeu" "200"
check "Giỏ hàng" "/cart" "200"
check "FAQ" "/faq" "200"
check "Sitemap" "/sitemap.xml" "200" "no-localhost"
check "Robots" "/robots.txt" "200" "sitemap-line"
check "Checkout (giỏ trống)" "/checkout" "307"
check "Đơn không tồn tại" "/order/KHONGTONTAI" "404"
check "Admin (chưa đăng nhập)" "/admin" "307" "location-login"
check "Danh sách đơn (chưa đăng nhập)" "/admin/orders" "307" "location-login"
check "Cài đặt chung (chưa đăng nhập)" "/admin/settings/general" "307" "location-login"

echo
echo "PASS: $PASS  FAIL: $FAIL  (base: $BASE)"
[ "$FAIL" -eq 0 ]
