#!/usr/bin/env bash
# Kiểm sẵn sàng chạy thật (Ngày 14 F2): chỉ GET, không đăng nhập,
# không ghi dữ liệu. Thoát 0 khi tất cả PASS, 1 khi có FAIL,
# 2 khi thiếu tham số.
#
#   ./scripts/go-live-check.sh https://<ten-mien-chinh>
#   ./scripts/go-live-check.sh https://example.com --alt-host www.example.com
#   ./scripts/go-live-check.sh https://example.com --expect-redirect /about=/gioi-thieu
#
# Kiểm: <loc> sitemap đúng domain; robots.txt có dòng Sitemap đúng
# domain; trang chủ canonical + og:image đúng domain, JSON-LD không
# chứa domain lạ; HTTP → HTTPS chuyển vĩnh viễn; tên miền phụ
# (--alt-host) chuyển vĩnh viễn sang tên chính; chuyển hướng trang
# cũ (--expect-redirect đường-dẫn-cũ=đường-dẫn-mới, mục tiêu ở slug
# gốc — không còn /trang/ từ Ngày 14). Trạng thái lập chỉ mục chỉ
# in THÔNG TIN, không tính PASS/FAIL.
set -u

BASE="${1:-}"
if [ -z "$BASE" ]; then
  echo "Cách dùng: $0 <base-url> [--alt-host <host>] [--expect-redirect <cu>=<moi>] ..." >&2
  exit 2
fi
shift
BASE="${BASE%/}"

ALT_HOST=""
EXPECT_REDIRECTS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --alt-host)
      ALT_HOST="${2:-}"
      if [ -z "$ALT_HOST" ]; then echo "--alt-host cần một host." >&2; exit 2; fi
      shift 2
      ;;
    --expect-redirect)
      if [ -z "${2:-}" ]; then echo "--expect-redirect cần <cu>=<moi>." >&2; exit 2; fi
      EXPECT_REDIRECTS+=("$2")
      shift 2
      ;;
    *)
      echo "Tham số không rõ: $1" >&2
      exit 2
      ;;
  esac
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
ok()   { PASS=$((PASS + 1)); printf "%-28s PASS  %s\n" "$1" "${2:-}"; }
bad()  { FAIL=$((FAIL + 1)); printf "%-28s FAIL  %s\n" "$1" "${2:-}"; }
info() { printf "%-28s INFO  %s\n" "$1" "${2:-}"; }

# Lấy nội dung một URL bằng GET (không theo chuyển hướng), trả mã
# HTTP vào $CODE, body vào $1, header vào $2.
fetch() {
  local url="$1" body="$2" hdr="$3"
  local out
  out="$(curl -s -D "$hdr" -o "$body" -w "%{http_code}" --max-time 20 "$url" 2>/dev/null || true)"
  CODE="${out:-000}"
}

# Host của base-url (không scheme, không path).
BASE_HOST="$(printf '%s' "$BASE" | sed -e 's#^https\?://##' -e 's#/.*##')"
# Base có phải *.vercel.app không — khi đó vercel.app trong nội dung
# là domain chính nó, không tính là domain lạ.
case "$BASE_HOST" in
  *.vercel.app) BASE_IS_VERCEL=1 ;;
  *) BASE_IS_VERCEL=0 ;;
esac

# --- 0. base-url phải là https ---
if [[ "$BASE" == https://* ]]; then
  ok "base-https" "$BASE"
else
  bad "base-https" "base-url phải bắt đầu bằng https:// (được: $BASE)"
fi

# --- 1. Sitemap: mọi <loc> bắt đầu bằng base-url; không localhost;
#     không vercel.app khi base không phải *.vercel.app ---
fetch "$BASE/sitemap.xml" "$TMP/sitemap.xml" "$TMP/sitemap.hdr"
if [ "$CODE" != "200" ]; then
  bad "sitemap-loc" "không lấy được /sitemap.xml (HTTP $CODE)"
else
  LOCS="$(grep -o '<loc>[^<]*</loc>' "$TMP/sitemap.xml" | sed -e 's#<loc>##' -e 's#</loc>##' || true)"
  COUNT="$(printf '%s' "$LOCS" | grep -c . || true)"
  if [ "$COUNT" -eq 0 ]; then
    bad "sitemap-loc" "sitemap không có <loc> nào"
  else
    WRONG="$(printf '%s\n' "$LOCS" | grep -v -e "^$BASE$" -e "^$BASE/" || true)"
    if [ -n "$WRONG" ]; then
      bad "sitemap-loc" "$COUNT loc, có loc không bắt đầu bằng base-url: $(printf '%s' "$WRONG" | head -3 | tr '\n' ' ')"
    elif grep -q "localhost" "$TMP/sitemap.xml"; then
      bad "sitemap-loc" "$COUNT loc, còn chứa localhost"
    elif [ "$BASE_IS_VERCEL" -eq 0 ] && grep -q "vercel.app" "$TMP/sitemap.xml"; then
      bad "sitemap-loc" "$COUNT loc, còn chứa vercel.app"
    else
      ok "sitemap-loc" "$COUNT loc đều bắt đầu bằng base-url"
    fi
  fi
fi

# --- 2. robots.txt: dòng Sitemap đúng domain ---
fetch "$BASE/robots.txt" "$TMP/robots.txt" "$TMP/robots.hdr"
if [ "$CODE" != "200" ]; then
  bad "robots-sitemap" "không lấy được /robots.txt (HTTP $CODE)"
elif grep -qF "Sitemap: $BASE/sitemap.xml" "$TMP/robots.txt"; then
  ok "robots-sitemap" "có dòng Sitemap: $BASE/sitemap.xml"
else
  bad "robots-sitemap" "thiếu dòng Sitemap: $BASE/sitemap.xml"
fi

# --- 3. Trang chủ: canonical + og:image đúng domain; JSON-LD không
#     chứa domain lạ (localhost, hoặc vercel.app khác với base) ---
fetch "$BASE/" "$TMP/home.html" "$TMP/home.hdr"
if [ "$CODE" != "200" ]; then
  bad "home-canonical" "không lấy được trang chủ (HTTP $CODE)"
  bad "home-jsonld" "không lấy được trang chủ (HTTP $CODE)"
else
  CANONICAL="$(grep -o '<link rel="canonical" href="[^"]*"' "$TMP/home.html" | head -1 | sed -e 's#.*href="##' -e 's#"$##' || true)"
  if [ -z "$CANONICAL" ]; then
    bad "home-canonical" "không có <link rel=\"canonical\">"
  elif [[ "$CANONICAL" == "$BASE" || "$CANONICAL" == "$BASE/"* ]]; then
    ok "home-canonical" "$CANONICAL"
  else
    bad "home-canonical" "canonical sai domain: $CANONICAL"
  fi
  OGIMAGE="$(grep -o '<meta property="og:image" content="[^"]*"' "$TMP/home.html" | head -1 | sed -e 's#.*content="##' -e 's#"$##' || true)"
  if [ -z "$OGIMAGE" ]; then
    info "home-og-image" "không có og:image (chưa đặt ảnh OG)"
  elif [[ "$OGIMAGE" == "$BASE"/* ]]; then
    ok "home-og-image" "$OGIMAGE"
  else
    bad "home-og-image" "og:image sai domain: $OGIMAGE"
  fi
  # JSON-LD: bỏ qua chính base-host rồi mới tìm domain lạ.
  JSONLD="$(sed -n '/<script type="application\/ld+json">/,/<\/script>/p' "$TMP/home.html" | sed "s#$BASE_HOST##g" || true)"
  if [ -z "$JSONLD" ]; then
    info "home-jsonld" "không có JSON-LD"
  elif printf '%s' "$JSONLD" | grep -q "localhost"; then
    bad "home-jsonld" "JSON-LD còn chứa localhost"
  elif printf '%s' "$JSONLD" | grep -q "vercel.app"; then
    bad "home-jsonld" "JSON-LD còn chứa vercel.app (khác base)"
  else
    ok "home-jsonld" "không chứa domain lạ"
  fi
fi

# --- 4. HTTP → HTTPS chuyển vĩnh viễn ---
HTTP_OUT="$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "http://$BASE_HOST/" 2>/dev/null || true)"
HTTP_CODE="${HTTP_OUT%% *}"
HTTP_LOC="${HTTP_OUT#* }"
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "308" ]; then
  case "$HTTP_LOC" in
    "https://$BASE_HOST"*) ok "http-to-https" "HTTP $HTTP_CODE → $HTTP_LOC" ;;
    *) bad "http-to-https" "HTTP $HTTP_CODE nhưng Location sai: $HTTP_LOC" ;;
  esac
else
  bad "http-to-https" "http://$BASE_HOST/ trả $HTTP_CODE, muốn 301/308 sang https://"
fi

# --- 5. Tên miền phụ (--alt-host) chuyển vĩnh viễn sang tên chính ---
if [ -n "$ALT_HOST" ]; then
  ALT_OUT="$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "https://$ALT_HOST/" 2>/dev/null || true)"
  ALT_CODE="${ALT_OUT%% *}"
  ALT_LOC="${ALT_OUT#* }"
  if [ "$ALT_CODE" = "301" ] || [ "$ALT_CODE" = "308" ]; then
    case "$ALT_LOC" in
      "$BASE"*) ok "alt-host" "https://$ALT_HOST/ $ALT_CODE → $ALT_LOC" ;;
      *) bad "alt-host" "https://$ALT_HOST/ $ALT_CODE nhưng Location sai: $ALT_LOC" ;;
    esac
  else
    bad "alt-host" "https://$ALT_HOST/ trả $ALT_CODE, muốn 301/308 sang $BASE"
  fi
fi

# --- 6. Chuyển hướng trang cũ (--expect-redirect cu=moi) ---
for spec in "${EXPECT_REDIRECTS[@]}"; do
  OLD="${spec%%=*}"
  NEW="${spec#*=}"
  R_OUT="$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" --max-time 20 "$BASE$OLD" 2>/dev/null || true)"
  R_CODE="${R_OUT%% *}"
  R_LOC="${R_OUT#* }"
  if { [ "$R_CODE" = "301" ] || [ "$R_CODE" = "308" ]; } && [ "$R_LOC" = "$BASE$NEW" ]; then
    ok "redirect:$OLD" "$R_CODE → $R_LOC"
  else
    bad "redirect:$OLD" "muốn 301/308 → $BASE$NEW, được $R_CODE → ${R_LOC:-"(không có Location)"}"
  fi
done

# --- THÔNG TIN: đang noindex hay cho phép (không tính PASS/FAIL) ---
if [ -f "$TMP/home.html" ]; then
  ROBOTS_META="$(grep -o '<meta name="robots" content="[^"]*"' "$TMP/home.html" | head -1 | sed -e 's#.*content="##' -e 's#"$##' || true)"
  if printf '%s' "$ROBOTS_META" | grep -qi "noindex"; then
    info "indexing-meta" "noindex ($ROBOTS_META)"
  elif [ -n "$ROBOTS_META" ]; then
    info "indexing-meta" "cho phép ($ROBOTS_META)"
  else
    info "indexing-meta" "không có <meta robots>"
  fi
fi
if [ -f "$TMP/robots.txt" ]; then
  # Khớp đúng dòng "Disallow: /" (cả site) — "Disallow: /cart" không tính.
  if grep -q "^Disallow: /[[:space:]]*$" "$TMP/robots.txt"; then
    info "indexing-robots" "robots.txt chặn toàn bộ (Disallow: /)"
  else
    info "indexing-robots" "robots.txt không chặn toàn bộ"
  fi
fi

echo "---"
echo "PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
