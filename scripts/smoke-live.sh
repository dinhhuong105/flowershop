#!/usr/bin/env bash
# Kiểm production sau mỗi lần deploy (Ngày 10 D10-5; Ngày 11 C5
# thêm 2 mục: trang chủ hiện tên shop từ Cài đặt, trang Cài đặt
# chung khi chưa đăng nhập chuyển về /login; Ngày 12 E2 thêm 3 mục:
# Ngân hàng & QR, Khu vực & phí, Telegram khi chưa đăng nhập;
# Ngày 13 D2 thêm 4 mục: trang tĩnh nháp → 404, Trang tĩnh + Cài
# đặt SEO khi chưa đăng nhập, sitemap đếm đúng số trang đã xuất bản
# — biến SMOKE_PUBLISHED_PAGE_SLUGS (danh sách slug, cách nhau bằng
# dấu phẩy; mặc định rỗng → 0 vì hiện chưa có trang nào xuất bản);
# Ngày 14: trang tĩnh ở slug gốc (không còn /trang/), sitemap
# không được chứa URL /trang/ nào) — thay cho chuỗi curl gõ tay
# (D9-1). Chỉ dùng GET, không đăng nhập, không ghi dữ liệu. Thoát 0
# khi mọi mục PASS, khác 0 khi có mục FAIL.
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

# check_sitemap_pages <tên> — đếm URL trang tĩnh đã xuất bản trong
# sitemap, so với danh sách slug trong SMOKE_PUBLISHED_PAGE_SLUGS
# (cách nhau bằng dấu phẩy, mặc định rỗng → 0 vì hiện chưa có trang
# nào xuất bản; Ngày 14: trang tĩnh ở slug gốc, không còn /trang/).
# Sitemap chỉ liệt kê trang đã xuất bản nên số này phải đúng, và
# không được còn URL /trang/ nào.
check_sitemap_pages() {
  local name="$1"
  local body="$TMP/sitemap-pages-body"
  local out code time_s
  out="$(curl -s -o "$body" -w "%{http_code} %{time_total}" --max-time 20 "$BASE/sitemap.xml" 2>/dev/null || true)"
  if [ -z "$out" ]; then out="000 0"; fi
  code="${out%% *}"
  time_s="${out##* }"
  local count=0
  local expected_list="${SMOKE_PUBLISHED_PAGE_SLUGS:-}"
  local expected=0
  if [ -n "$expected_list" ]; then
    expected="$(printf '%s' "$expected_list" | awk -F, '{ print NF }')"
  fi
  if [ -f "$body" ]; then
    count=0
    # Đếm từng slug mong đợi có mặt trong sitemap.
    local slug
    IFS=',' read -ra SLUGS <<< "$expected_list"
    for slug in "${SLUGS[@]}"; do
      slug="$(printf '%s' "$slug" | xargs)"
      if [ -n "$slug" ] && grep -qF "$BASE/$slug<" "$body"; then
        count=$((count + 1))
      fi
    done
  fi
  local ms
  ms="$(awk -v t="$time_s" 'BEGIN { printf "%d", t * 1000 }')"
  local trang_left=0
  if [ -f "$body" ]; then trang_left="$(grep -c "/trang/" "$body" || true)"; fi
  if [ "$code" = "200" ] && [ "$count" = "$expected" ] && [ "$trang_left" = "0" ]; then
    PASS=$((PASS + 1))
    printf "%-32s %-42s %4s %6s ms  PASS (%s trang đã xuất bản)\n" "$name" "/sitemap.xml" "$code" "$ms" "$count"
  else
    FAIL=$((FAIL + 1))
    printf "%-32s %-42s %4s %6s ms  FAIL (muốn %s trang, được %s; còn %s URL /trang/; mã %s)\n" "$name" "/sitemap.xml" "$code" "$ms" "$expected" "$count" "$trang_left" "$code"
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
check "Ngân hàng & QR (chưa đăng nhập)" "/admin/settings/bank" "307" "location-login"
check "Khu vực & phí (chưa đăng nhập)" "/admin/shipping-zones" "307" "location-login"
check "Telegram (chưa đăng nhập)" "/admin/settings/telegram" "307" "location-login"
check "Trang tĩnh nháp (giới thiệu)" "/gioi-thieu" "404"
check "Tiền tố /trang/ đã bỏ" "/trang/gioi-thieu" "404"
check "Trang tĩnh (chưa đăng nhập)" "/admin/pages" "307" "location-login"
check "Cài đặt SEO (chưa đăng nhập)" "/admin/settings/seo" "307" "location-login"
check "Nhật ký hoạt động (chưa đăng nhập)" "/admin/activity" "307" "location-login"
check_sitemap_pages "Sitemap (số trang đã xuất bản)"


echo
echo "PASS: $PASS  FAIL: $FAIL  (base: $BASE)"
[ "$FAIL" -eq 0 ]
