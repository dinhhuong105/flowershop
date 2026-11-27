# Báo cáo chuẩn bị đẩy Ngày 17 — 27/11/2026 (21:30 giờ VN)

- Nền: commit `0fdfafa` (Ngày 17, đã được Claude CHO ĐẨY kèm ngoại lệ S11).
- Kết quả đợt này: **thử overrides THÀNH CÔNG — không cần ngoại lệ S11 nữa**,
  không cần file `docs/security-exceptions.md`, không cần allowlist/đổi CI.
- Link live: https://flowershop-steel.vercel.app/
- **CHƯA PUSH** — commit duy nhất đợt này để Pi Em tự kiểm rồi tự đẩy.

## 1. Thử overrides (giới hạn 1 giờ — ĐẠT, giữ lại)

Như tiền lệ postcss/zod, ép 2 gói qua `overrides` trong `package.json`
(giữ nguyên `postcss 8.5.33`, `zod 4.6.6`):

| Gói | Trước | Ép thành | Nguồn |
|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | **8.0.0** | GHSA-ggr8-5vv4-36mx (stack exhaustion), vulnerable `<8.0.0` → bản vá nhỏ nhất 8.0.0 |
| `effect` | 3.21.0 | **3.22.1** | GHSA-7589-6fvf-x4pw (ReDoS Schema.TemplateLiteral), vulnerable `<=3.22.0` → bản vá nhỏ nhất 3.22.1 |

- `npm audit --omit=dev`: **trước 4 High, 0 Critical → sau 0 vulnerabilities**
  (audit đầy đủ cũng 0). Kiểm độc lập bởi điều phối viên: `found 0 vulnerabilities`.
- Diff lockfile: **22 dòng** (16 thêm/6 bớt) — chỉ đổi resolved/integrity
  của đúng 2 gói này (+ funding block của deepmerge-ts 8.0.0); **không đổi
  metadata dev flag** nào của prisma hay gói khác.
- `prisma generate` (Client v6.19.3) + `prisma migrate deploy` (12 migrations,
  không còn migration chờ) đều chạy tốt với 2 gói đã ép — `@prisma/config`
  6.19.3 vẫn nạp được cấu hình bình thường.

## 2. Không còn ngoại lệ S11

Vì audit đã về 0 nên **không tạo `docs/security-exceptions.md`** và **không
thêm allowlist/job audit vào CI** (CI hiện chưa có bước audit — xem mục
"Còn thiếu" dưới). Nếu sau này audit lại xuất hiện High/Critical mới thì
xử lý theo `bao-mat-dac-ta.md` §0 (sửa hoặc ghi ngoại lệ có lý do + hạn),
không tự nới `--audit-level`.

## 3. Migration Ngày 17 — xác nhận chỉ thêm

Đọc nguyên văn 2 migration, xác nhận **chỉ ADD COLUMN / CREATE TABLE**,
không DROP, không sửa kiểu cột, không xóa dữ liệu:

- `20261127170000_day17_rate_limit`: `CREATE TABLE "rate_limit_events"
  (id SERIAL, key TEXT, "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`
  + `CREATE INDEX ... ("key", "createdAt")`. (Ghi chú "Rollback: DROP TABLE"
  trong file chỉ là comment, không phải lệnh chạy.)
- `20261127180000_day17_product_source`: `ALTER TABLE "products" ADD COLUMN
  "source" TEXT NOT NULL DEFAULT 'seed'` + tương tự cho `"categories"`.
  Dữ liệu cũ nhận mặc định `'seed'`.

Vì migration chỉ thêm nên rollback code (mục 4) không cần lùi DB: code cũ
(6e4a514) không đọc cột/bảng mới.

## 4. Kế hoạch lùi (đã thêm vào `docs/van-hanh.md` §5.5)

Vercel Instant Rollback về deployment của commit `6e4a514` (bản live trước
Ngày 17): Dashboard → project `flowershop` → Deployments → deployment
`6e4a514` → `⋯` → Instant Rollback → xác nhận. Kiểm tra sau lùi: trang chủ
200, đăng nhập admin được, `bash scripts/smoke-live.sh
https://flowershop-steel.vercel.app/` kỳ vọng 21/21. Rollback chỉ lùi
CODE, không lùi dữ liệu (xem mục 3). Lùi xong vẫn lỗi thì xem Runtime Logs
và báo người phụ trách kỹ thuật; đừng push lại commit Ngày 17 cho tới khi
rõ nguyên nhân. (Mục 5.4 cũ "Dữ liệu test local" đổi số thành §5.6; không
còn tham chiếu nào tới số cũ.)

## 5. Sửa kèm: báo cáo Ngày 17 làm rớt `test:security`

Quét tĩnh FAIL 1 bước: mẫu URL Postgres trong `docs/reports/ngay-17.md`
dòng 447 (phụ lục "Kiểm chứng độc lập (Pi Em)" trích lại nguyên văn mẫu
đã sửa ở dòng 311 — chính phụ lục lặp lại lỗi đó). Đã bỏ chuỗi mẫu khỏi
dòng 447, giữ nguyên ý nghĩa câu. Sau sửa, `test:security` **TẤT CẢ ĐẠT**
(xem mục 6). Bài học đã ghi trong báo cáo: không viết nguyên văn mẫu bí
mật mà máy quét đang tìm, kể cả khi trích lại để giải thích.

## 6. Kiểm chứng (điều phối viên chạy lại toàn bộ trên cây cuối)

| Mục | Kết quả |
|---|---|
| `npm audit --omit=dev` | **0 vulnerabilities** (trước overrides: 4 High) |
| Unit (`npm test`) | **386/386 PASS** (107 suites) |
| test:db (recreate → test:db → clean) | **92/92 PASS** (25 suites) |
| Typecheck | **0 lỗi** |
| Lint | **0 lỗi**, 2 warning `<img>` có từ trước |
| Build | OK; First Load JS `/` = **115 kB** (như nền fixup 3) |
| Smoke local | **20/21 PASS** — FAIL duy nhất sitemap-localhost (kỳ vọng: `.env` local đặt `SITE_URL=http://localhost:3000`) |
| So `<head>` với nền fixup 3 | **4/4 giống hệt** |
| `npm run test:security` | **TẤT CẢ ĐẠT** (tĩnh 52 ok, động 44 PASS, live 21 PASS) |
| `prisma generate` + `migrate deploy` | OK, không còn migration chờ |
| DB cuối đợt | **20\|0\|3\|0\|24\|0\|0\|4\|0**; ngân hàng về gốc (BIN/STK/tên rỗng, enabled false, mẫu `DH {ORDER_CODE}`) |

Log: `~/workspace/day17-prep-overrides-*.log` (bản thử overrides) và
`~/workspace/day17-prep-{unit,testdb,build,smoke,security}-mine.log`
(bản kiểm lại của điều phối viên). Số của subagent thử overrides khớp
với số kiểm lại (unit 386/386, test:db 92/92, build 115 kB, smoke 20/21);
riêng `test:security` của subagent exit 1 do đúng lỗi dòng 447 đã sửa
ở mục 5 — sau sửa, điều phối viên chạy lại thì TẤT CẢ ĐẠT.

## 7. Còn thiếu / lưu ý (không chặn đẩy)

1. **CI chưa có bước audit:** `npm audit` hiện chỉ chạy tay local. Nếu
   sau này có High/Critical mới, CI sẽ không báo đỏ. Đề xuất Ngày 18:
   thêm job audit vào `.github/workflows/ci.yml` (chạy
   `npm audit --omit=dev`, fail khi có High/Critical; KHÔNG nới
   `--audit-level`, KHÔNG sửa metadata lockfile).
2. **S0 chờ Henry:** thu hồi token GitHub cũ đã lộ (26/11) — không hỏi,
   không nhắc.
3. TOTP P2 chưa làm; 2 điểm nhỏ cuối ngày (router.refresh; nhật ký SP
   hiện SKU + giá định dạng) chưa làm — để sau, theo chỉ đạo.
4. Ngày 18 (Quản lý tin tức) chưa làm trong đợt này.
5. Lập chỉ mục vẫn TẮT trên live — đợt này không đụng vào.
6. Server local đang chạy bản mới trên :3000 (PID 60966) để Pi Em kiểm
   tiếp; live chưa động vào.

## 8. Đã đẩy lên live (bổ sung sau khi đẩy, 27/11/2026 ~21:2x)

- Remote HEAD: **`3e5696f`** (Ngày 17 `cffb9f3` + prep `3e5696f`).
  Lưu ý mã commit đã đổi so với mục trên (0fdfafa → cffb9f3,
  095e411 → 3e5696f) vì phải tách file CI ra khỏi đợt đẩy — xem dưới.
  Nội dung code không đổi, chỉ thiếu đúng file `.github/workflows/ci.yml`.
- **Token GitHub không có quyền `workflow`:** lần đẩy đầu bị GitHub từ
  chối — "refusing to allow a Personal Access Token to create or update
  workflow `.github/workflows/ci.yml` without `workflow` scope". Đã tách
  ci.yml ra commit riêng `f94bb77`, ở lại local, chờ token mới có quyền
  workflow (gắn với S0 thu hồi token cũ). Vì vậy **chưa có lần chạy CI
  đầu để theo dõi** — CI chưa từng chạy thật.
- Kiểm live (Pi Em tự kiểm sau đẩy): smoke production **21/21**; F2
  exit 0 (**5 PASS**, các INFO là kỳ vọng: chưa có OG image, indexing
  TẮT); header CSP đã có trên live. CSP kiểm bằng trình duyệt thật trên
  7 trang (chủ, danh mục, sản phẩm, giỏ, thanh toán, đăng nhập admin,
  tổng quan, popup sản phẩm + upload Blob): **không thấy vi phạm CSP** —
  lưu ý DevTools Console không mở được trong trình duyệt đó nên kết luận
  dựa trên bằng chứng chức năng/hiển thị (ảnh/font/tính năng đều chạy,
  không có gì vỡ). Upload thử để lại 1 file test orphan trong Blob
  (không lưu sản phẩm, vẫn 20 sản phẩm).
- **TTFB live (curl):** trang chủ 1,24–1,46 s, danh mục 1,46–2,65 s;
  đối chứng robots.txt (tĩnh) 0,38 s. Cơ chế đã xác nhận trong code:
  layout gốc đọc `headers()` để lấy nonce (`layout.tsx:109`) nên mọi
  trang render động (`Cache-Control: private, no-cache`,
  `X-Vercel-Cache: MISS`). Chưa có baseline live trước Ngày 17 để so
  sánh "tăng bao nhiêu". Để Ngày 18 đo đạc và đề xuất; quyết định thu
  hẹp nonce chỉ admin + /login là của Claude.
- **Checkout live chỉ có COD** (kiểm lại trực tiếp 21:22): không có
  "Chuyển khoản", không QR, không thông tin ngân hàng — chuyển khoản
  vẫn TẮT đúng như đã quyết.
- **F2 `home-jsonld` INFO là dương tính giả:** JSON-LD Organization CÓ
  trên live nhưng thẻ script mang thuộc tính `nonce` nên mẫu sed khớp
  chính xác của F2 không nhận ra — sửa mẫu F2 ở Ngày 18.

## File đổi trong commit này (1 commit duy nhất trên `0fdfafa`)

| File | Đổi gì |
|---|---|
| `package.json` | Thêm overrides `deepmerge-ts 8.0.0`, `effect 3.22.1` |
| `package-lock.json` | Theo overrides (22 dòng, chỉ 2 gói) |
| `docs/van-hanh.md` | Thêm §5.5 kế hoạch lùi Vercel Instant Rollback; §5.4 cũ → §5.6 |
| `docs/reports/ngay-17.md` | Bỏ chuỗi mẫu URL Postgres ở dòng 447 (sửa rớt `test:security`) |
| `docs/reports/ngay-17-day18-prep.md` (mới, file này) | Báo cáo chuẩn bị đẩy Ngày 17 |
