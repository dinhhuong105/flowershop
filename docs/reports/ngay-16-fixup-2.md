# Báo cáo Ngày 16 fixup 2 — bank.notify "skipped" + checklist go-live (chuyển khoản, Telegram)

- Ngày: 27/11/2026.
- Nền: commit `8dd227e` (Ngày 16 fixup 1, remote HEAD, đã live).
- Commit fixup 2: 1 commit trên `8dd227e` (lấy hash đầy đủ bằng `git log`). KHÔNG push.
- Phạm vi: 3 việc nhỏ còn lại trong verdict mới nhất của Claude sau fixup 1. Đây KHÔNG phải Ngày 17 (Claude nói không cần đặc tả mới, làm kèm là đủ). B6 + E2 vẫn để sau, ưu tiên thấp.
- Link live: https://flowershop-steel.vercel.app/

## Kết quả từng mục

| Mục | Kết quả | Ghi chú |
|---|---|---|
| 1. bank.notify ghi "skipped: chưa cấu hình" khi chưa cấu hình Telegram | ĐẠT | `sendTelegramMessage` trả thêm cờ `skipped`; hàm thuần `bankNotifyAuditValue` map kết quả → giá trị nhật ký; `saveBankSettingsAction` dùng hàm này. Hành vi gửi không đổi. Kèm unit test 7 ca mới. |
| 2. Checklist go-live: thêm bước "Bật lại thanh toán chuyển khoản" trước bước bật lập chỉ mục | ĐẠT | Bước mới là bước 6; lập chỉ mục thành bước 7; Search Console bước 8; đơn COD cuối bước 9. Đánh lại số + mọi tham chiếu "bước 1–5" → "bước 1–6". |
| 3. Bảng readiness F3 + bước 8 checklist sang "Telegram không dùng" | ĐẠT | Dòng Telegram trong bảng F3 (báo cáo Ngày 14) đổi sang "Telegram không dùng"; bước 8 (nay là bước 9) bỏ kiểm tin Telegram. Kèm chỉnh nhất quán: bước 3/5 và mục A4 trong cùng checklist. |

## Điểm 1 — chi tiết

- Trước: lưu cài đặt ngân hàng khi chưa có token/chat id Telegram thì `sendTelegramMessage` trả `{ ok: false, error: "Chưa cấu hình token bot hoặc chat id Telegram." }`, và `saveBankSettingsAction` ghi audit `bank.notify` = `"failed: Chưa cấu hình token bot hoặc chat id Telegram."` — đọc như gửi lỗi, trong khi thật ra không có tin nào được gửi đi (Henry quyết không dùng Telegram).
- Sau:
  - `src/lib/telegram.ts`: `sendTelegramMessage` trả thêm `skipped: true` đúng nhánh chưa cấu hình (trước khi gọi fetch); `sendBankChangeNotification` giữ nguyên hành vi gửi, chỉ chuyển tiếp cờ này qua kiểu trả về. Hàm thuần mới `bankNotifyAuditValue(notify)`: `ok` → `"sent"`; `skipped` → `"skipped: chưa cấu hình"`; còn lại → `"failed: <error>"` (không error → `"failed: unknown"`).
  - `src/app/admin/settings/actions.ts`: dòng ghi audit dùng `bankNotifyAuditValue(notify)` thay cho toán tử ba ngôi cũ. Không đổi đường gửi, không đổi điều kiện ghi (chỉ ghi khi `saved.length > 0`).
- Unit test mới (7 ca, `src/lib/telegram.test.ts`): `bankNotifyAuditValue` 4 trường hợp (sent / skipped / failed có error / failed không error); `sendBankChangeNotification` khi chưa cấu hình (xóa env token + chat id; DB local có `telegram.chatId = ""`) → `{ ok: false, skipped: true }` + map ra `"skipped: chưa cấu hình"`; đã cấu hình + mock 200 → `"sent"` như cũ; đã cấu hình + mock 500 → `"failed: …"` như cũ, `skipped` undefined.
- CDP qua form ngân hàng thật (server local chạy env thử, mật khẩu thử chỉ trong tiến trình probe): chọn Vietcombank (BIN 970436), STK test, tên test, lưu với mật khẩu xác nhận → lưu thành công; DB: `bank.notify` = `"skipped: chưa cấu hình"`; `/admin/activity` hiện `(trống) → skipped: chưa cấu hình`, không còn dòng `failed: Chưa cấu hình token bot`. Ảnh đã nhìn bằng mắt.
- Quan sát (KHÔNG đổi, ngoài phạm vi): thông báo sau khi lưu vẫn kèm câu "Lưu ý: không gửi được thông báo Telegram, đã ghi vào nhật ký." (`bankSaveSuccessMessage` nhận `!notify.ok`, không phân biệt skipped/failed). Nếu Claude muốn câu này cũng đổi theo skipped thì làm riêng — không tự đổi trong đợt này.

## Điểm 2 — chi tiết (checklist)

- `docs/go-live-checklist.md` nay có 9 bước. Bước 6 mới "Bật lại thanh toán chuyển khoản — Henry": trong thời gian demo chuyển khoản đang TẮT để đơn thử không hiện QR tài khoản thật; sau khi dữ liệu thật đã vào (bước 5) thì bật lại công tắc trong Cài đặt Ngân hàng & QR; kiểm bằng cách mở trang thanh toán của một đơn chuyển khoản và thấy đúng QR tài khoản thật (đúng ngân hàng, đúng số tiền, đúng mã đơn).
- Lập chỉ mục thành bước 7, vẫn là bước cuối cùng trong nhóm bật/tắt ("Chỉ làm khi bước 1–6 đều đạt"); tiêu đề file đổi "Bước 6 … làm CUỐI CÙNG" → "Bước 7 …". Search Console → bước 8; đơn COD cuối → bước 9.

## Điểm 3 — chi tiết (Telegram không dùng)

- Bảng F3 trong `docs/reports/ngay-14.md` (bảng sẵn sàng dữ liệu, chỉ đọc): dòng Telegram đổi thành `| Telegram có token + bật | — Telegram không dùng | Henry quyết 27/11: không cần Telegram; không còn là mục chờ |`. Dòng "Trạng thái lập chỉ mục" trong cùng bảng đổi tham chiếu "(bước 6 checklist)" → "(bước 7 checklist)" và "sau khi 1–5 đạt" → "sau khi 1–6 đạt" (theo bước mới ở điểm 2). Phần còn lại của báo cáo Ngày 14 không sửa (lịch sử).
- Bước 8 cũ (nay bước 9, đơn COD cuối) trong checklist: bỏ kiểm "Telegram nhận được tin báo đơn mới"; ghi rõ "(Telegram không dùng — Henry quyết 27/11 — nên không kiểm tin báo đơn qua Telegram.)".
- Chỉnh nhất quán trong cùng file checklist (không phải việc mới, chỉ để checklist không tự mâu thuẫn): bước 3 — token/chat id Telegram chỉ cần khi dùng Telegram, Henry đã quyết không dùng nên không bắt buộc; bước 5 — bỏ yêu cầu "Telegram có token + bật, gửi thử nhận được tin", thay bằng "Telegram: không dùng (Henry quyết 27/11)"; mục A4 ở cuối — đổi thành "**A4 Telegram: KHÔNG DÙNG** — Henry quyết 27/11 … không cần token/chat id, không kiểm 'Gửi thử', không còn là mục chờ."

## Kiểm chứng

- Unit: **328/328 PASS** (fixup 1: 321; +7: bankNotifyAuditValue 4 + sendBankChangeNotification 3).
- test:db: **56/56 PASS** (như fixup 1). Đúng trình tự: `recreate-test-data` → `test:db` → `clean-test-data --delete`.
- Typecheck: **0 lỗi**. Lint: **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`).
- Build: OK. First Load JS `/` = **115 kB** (≤ 135 kB, như fixup 1); `/admin/activity` = 124 kB.
- Smoke local (`scripts/smoke-live.sh http://localhost:3000`): **20/21 PASS** — FAIL duy nhất là sitemap-localhost (kỳ vọng). `/admin/activity` chưa đăng nhập → 307 PASS. Server chạy bằng `scripts/start-standalone.sh` (home 200, chunk 200).
- So `<head>` với nền fixup 1 (nội dung ngữ nghĩa title/description/canonical/robots/OG, bỏ đường dẫn asset theo hash): trang chủ + danh mục + sản phẩm + trang tĩnh **giống hệt** (4/4, cùng trạng thái 0 trang đã xuất bản).
- CDP (headless Chrome 158, server standalone :3000, phiên admin tạo trực tiếp trong DB local): **11/11 PASS** — lưu ngân hàng thật qua form (BIN 970436, STK test) → DB `bank.notify` = "skipped: chưa cấu hình"; `/admin/activity` hiện đúng dòng, không còn "failed: Chưa cấu hình token bot"; DB sau dọn sạch. Ảnh đã nhìn bằng mắt.
- DB local sau dọn: products=20, orders=0, pages=3 (0 xuất bản), settings=24, audit=0, sessions=0, categories=4; cài đặt ngân hàng trả về gốc (bankCode/STK/tên rỗng, enabled false, mẫu "DH {ORDER_CODE}"). **Sạch.**

## Ảnh đính kèm

- Điểm 1: `~/workspace/day16-fixup2-shots/activity-skipped-1440.png`
- Probe CDP (tái chạy được): `~/workspace/day16-fixup2-verify.mjs` (lưu ý: cần server chạy bằng env thử có hash mật khẩu admin thử — xem "Sự cố" dưới; probe tự dọn DB).

## Sự cố trong ngày (ghi lại để lần sau khỏi mất thời gian)

- **Lần đầu đổi ADMIN_PASSWORD_HASH trong .env bằng perl đã làm hỏng dòng** (giá trị hash chứa `$` nên perl nội suy thành biến rỗng → dòng còn lại `ADMIN_PASSWORD_HASH="scrypt"`). Đã khôi phục từ backup `/tmp/.env.fixup2.bak` rồi đổi lại bằng Node (`String.replace` — không nội suy `$`). Bài học: **không dùng perl/sed thay giá trị chứa `$`** (hash scrypt, token…); dùng Node hoặc viết file mới.
- **Probe CDP cần mật khẩu xác nhận khi lưu ngân hàng** (theo mẫu Ngày 15): tạo hash scrypt của mật khẩu thử (N=32768 r=8 p=1, keylen 64, maxmem 64 MB), đổi tạm `ADMIN_PASSWORD_HASH` trong `.env`, khởi động server bằng `scripts/start-standalone.sh`, chạy probe, rồi khôi phục `.env` gốc + khởi động lại server với env thật. Mật khẩu thử chỉ xuất hiện trong tiến trình probe + `.env` tạm, đã xóa backup sau khi khôi phục.
- **VM không bị thay đợt này** — PostgreSQL + Chrome còn nguyên từ lần dựng lại ~10:00 ngày 27/11 (uptime 1:42 lúc bắt đầu). Không cần dựng lại DB.
- **Lập chỉ mục vẫn TẮT** trên live theo quyết định của Henry — đợt này không đụng vào.

## Việc của Henry (nhắc lại, không giục riêng lẻ)

- Chuyển khoản trên live: Henry nói 27/11 ~11:33 "bạn làm luôn đi, đừng chờ tôi" — việc tắt/bật trên live do phía chat chính xử lý (không thuộc đợt code này); checklist bước 6 mới ghi lại để bật lại khi chạy thật.
- Dữ liệu thật: tên shop, hotline/Zalo/địa chỉ, ngân hàng, khu vực + phí, sản phẩm + ảnh thật, nội dung 3 trang chính sách + mô tả SEO mặc định + ảnh OG; đọc lại /policy đang public.
- Quyết định token GitHub (thu hồi token đã dán trong chat + tạo fine-grained mới) vẫn là của Henry.
- Trước Phần G (dọn demo): tạo nhánh Neon mới ngay trước khi xóa (nhánh snapshot hiện tại sẽ cũ dần).
- Sau khi dữ liệu thật đủ: B6 + E2 rồi Phần G (dọn demo) — Claude viết đặc tả riêng khi Henry báo dữ liệu thật đã vào.
