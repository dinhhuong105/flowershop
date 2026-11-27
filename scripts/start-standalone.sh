#!/usr/bin/env bash
# Khởi động server standalone cho probe CDP (Ngày 16 #4).
#
# Tự làm, theo đúng thứ tự:
#   1. Dừng server cũ đang nghe trên cùng cổng (lấy PID chính xác
#      từ `ss`, không pgrep theo pattern).
#   2. Xóa cache đĩa của standalone (.next/standalone/.next/cache)
#      để server mới đọc cài đặt từ DB, không dùng cache cũ
#      (bài học Ngày 15: sửa site_settings bằng SQL không làm mất
#      hiệu lực unstable_cache).
#   3. Copy .next/static -> .next/standalone/.next/static và
#      public -> .next/standalone/public SAU build (next build tạo
#      lại toàn bộ .next/standalone/ nên copy cũ bị mất).
#   4. Khởi động server (node --env-file=.env).
#   5. Chờ trang chủ trả 200, rồi kiểm một chunk JS mà trang chủ
#      tham chiếu trả 200 — chỉ khi đó mới cho probe CDP chạy
#      (tránh FAIL giả Ngày 15: server thiếu CSS/JS, trang không
#      hydrate, form submit native).
#
# Cách dùng: bash scripts/start-standalone.sh [PORT]  (mặc định 3000)
#   PORT cũng đọc từ biến môi trường PORT nếu không truyền tham số.
#   NODE_BIN: đường dẫn node dùng để chạy server (mặc định
#   ~/tools/node22/bin/node nếu có, không thì `node` trên PATH).
# Thoát 0 khi server lên + chunk 200; thoát 1 kèm lý do khi lỗi.
# Log server: .next/standalone-server.log (nằm trong .next, đã gitignore).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-${PORT:-3000}}"
LOG="$ROOT/.next/standalone-server.log"

if [ -x "$HOME/tools/node22/bin/node" ]; then
  NODE_BIN="${NODE_BIN:-$HOME/tools/node22/bin/node}"
else
  NODE_BIN="${NODE_BIN:-node}"
fi

fail() {
  echo "start-standalone: LỖI: $*" >&2
  exit 1
}

# 0. Kiểm build đã có chưa (không tự build ở đây — build là bước riêng).
[ -f "$ROOT/.next/standalone/server.js" ] || fail "chưa có .next/standalone/server.js — chạy 'npm run build' trước."
[ -d "$ROOT/.next/static" ] || fail "chưa có .next/static — chạy 'npm run build' trước."
[ -d "$ROOT/public" ] || fail "thiếu thư mục public."
[ -f "$ROOT/.env" ] || fail "thiếu file .env (DATABASE_URL, ADMIN_PASSWORD_HASH...)."

# 1. Dừng server cũ trên cùng cổng (PID chính xác từ ss).
OLD_PID="$(ss -ltnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1 || true)"
if [ -n "$OLD_PID" ]; then
  echo "start-standalone: dừng server cũ (PID $OLD_PID) trên cổng $PORT..."
  kill "$OLD_PID" 2>/dev/null || true
  for _ in $(seq 1 10); do
    ss -ltn 2>/dev/null | grep -q ":${PORT} " || break
    sleep 0.5
  done
  ss -ltn 2>/dev/null | grep -q ":${PORT} " && fail "cổng $PORT vẫn bận sau khi dừng PID $OLD_PID."
fi

# 2. Xóa cache đĩa của standalone (server mới đọc DB, không dùng cache cũ).
rm -rf "$ROOT/.next/standalone/.next/cache"

# 3. Copy static + public vào standalone (SAU build).
rm -rf "$ROOT/.next/standalone/.next/static" "$ROOT/.next/standalone/public"
cp -r "$ROOT/.next/static" "$ROOT/.next/standalone/.next/static"
cp -r "$ROOT/public" "$ROOT/.next/standalone/public"
echo "start-standalone: đã copy .next/static + public vào standalone."

# 4. Khởi động server (nền, tách khỏi terminal hiện tại).
cd "$ROOT"
setsid nohup "$NODE_BIN" --env-file=.env .next/standalone/server.js > "$LOG" 2>&1 < /dev/null &
NEW_PID=$!
echo "start-standalone: server đang khởi động (PID $NEW_PID, log $LOG)..."

# 5. Chờ trang chủ trả 200 (tối đa 30 giây).
UP=""
for _ in $(seq 1 30); do
  CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/" || true)"
  if [ "$CODE" = "200" ]; then UP="1"; break; fi
  sleep 1
done
if [ -z "$UP" ]; then
  kill "$NEW_PID" 2>/dev/null || true
  echo "--- 20 dòng cuối log server ---" >&2
  tail -20 "$LOG" >&2 || true
  fail "server không trả 200 sau 30 giây (xem log $LOG)."
fi
echo "start-standalone: trang chủ trả 200."

# 6. Kiểm một chunk JS mà trang chủ tham chiếu trả 200.
CHUNK="$(curl -s "http://localhost:${PORT}/" | grep -o '/_next/static/chunks/[^"]*\.js' | head -1 || true)"
[ -n "$CHUNK" ] || fail "không tìm thấy chunk JS nào trong HTML trang chủ."
CHUNK_CODE="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}${CHUNK}")"
[ "$CHUNK_CODE" = "200" ] || fail "chunk $CHUNK trả $CHUNK_CODE (kỳ vọng 200)."
echo "start-standalone: chunk $CHUNK trả 200."

echo "start-standalone: OK — server PID $NEW_PID trên cổng $PORT."
