# Báo cáo Ngày 17 — Vận hành, kiểm thử, tài liệu, bàn giao

- Ngày: 27/11/2026.
- Nền: commit `6e4a514` (Ngày 16 fixup 3, đã live).
- Trạng thái: **1 commit duy nhất trên `6e4a514`** (toàn bộ
  thay đổi của các phần S, O, P, N, D). KHÔNG push (cổng deploy: 4 High
  S11 còn mở — xem "Kết luận trước").
- Link live: https://flowershop-steel.vercel.app/
- Đặc tả: `~/workspace/ngay-17-dac-ta.md` (§2, §3, §4, §5, §6, §7, §8,
  §9), `~/workspace/bao-mat-dac-ta.md` (S1–S12), `~/workspace/ngay-17-bo-sung.md`.

## Kết luận trước (đọc trước khi deploy)

**Ngày 17 CHƯA đủ điều kiện đóng/deploy theo cổng bảo mật** — không
phải vì test rớt (mọi bộ test đều xanh, xem mục "Kiểm chứng"), mà vì
**4 lỗ hổng High ở S11 còn mở** (`npm audit --omit=dev`: 4 High, 0
Critical, đều qua `@prisma/config` của Prisma 6.19.3; bản sửa là nâng
Prisma lên 7.10.1 — thay đổi phá vỡ, ngoài phạm vi Ngày 17, cần quyết
định riêng của Henry). Theo `bao-mat-dac-ta.md` §0: "còn Critical/High
mở thì KHÔNG push". Mọi mục P0 khác đã xong; các mục P1 đạt trên 80%
(trừ Safari/Firefox và Lighthouse chưa đo — xem dưới).

Ngoài S11, còn 1 việc chờ Henry: **S0 — thu hồi token GitHub cũ đã lộ
từ 26/11** (tạo fine-grained token mới chỉ cho kho `flowershop`).
Quét lịch sử commit không thấy `ghp_`/`github_pat_` và không thấy
hash mật khẩu thật (chỉ placeholder `scrypt$<saltHex>$<hashHex>` trong
`.env.example`); nhưng token cũ vẫn phải thu hồi vì đã dán vào trò
chuyện.

## Kết quả từng phần

| Phần | Kết quả | Ghi chú |
|---|---|---|
| S — Bảo mật nền (S1–S12) | ĐẠT, trừ S11 | `npm run test:security`: unit bảo mật 87/87, quét tĩnh 52 ok, kiểm động 44 PASS, quét live 21 PASS. 4 High S11 còn mở (cổng deploy). S0 chờ Henry. |
| O — Đặt hàng/tra cứu (S7, S8) | ĐẠT | Probe CDP chạy lại 19/19 PASS (S8 tamper giá/số lượng/SP ẩn/khu vực tắt/chuyển khoản tắt; S7 che SĐT, 404 thống nhất, flood bị giới hạn; kiểm tay "nhảy thứ tự" 4 ca). |
| P — Sản phẩm/Danh mục (P1–P3, P5, B6) | ĐẠT | Probe CDP chạy lại 17/17 PASS (cột Nguồn + lọc, thao tác hàng loạt, nhật ký P5, xem trước 2 cột B6 1440/390). |
| N — Theo dõi đơn mới | ĐẠT | Probe CDP chạy lại 27/27 PASS (poll 60s, chuông + tiêu đề + toast trong 60–75s, tab ẩn dừng gọi, âm báo + thông báo trình duyệt chỉ hỏi khi bấm, thẻ quá hạn). |
| D — Tài liệu, CI, hiệu năng, ngưỡng deploy (phần này) | ĐẠT, trừ 2 mục ghi rõ | CI workflow mới (YAML hợp lệ, chưa chạy thật trên GitHub); TTFB đo thật; README + `docs/van-hanh.md` đầy đủ; a11y 8/8; sửa xong ca flaky markdown. Chưa đo Lighthouse; Safari/Firefox chưa kiểm. |

## §2 Kiểm thử + CI

- Bộ test Ngày 17: **unit 386 ca** (`npm test`), **test:db 92 ca**
  (`npm run test:db`), **test bảo mật** (`npm run test:security`,
  xem bảng Bảo mật). Phân loại unit / test:db / kiểm động CDP đã có;
  không có bộ E2E tự động riêng (CDP probe đóng vai trò này cho các
  luồng chính).
- **CI mới — `.github/workflows/ci.yml`** (5 jobs: `lint`,
  `typecheck`, `test` (unit), `test-db` (Postgres 16 service: migrate
  + seed + recreate → test:db → clean), `security`
  (`test:security` trên server standalone). Chạy trên mọi push/PR lên
  `main` và hằng đêm lúc **02:00 giờ Việt Nam** (cron `0 19 * * *`
  UTC — cron GitHub luôn tính theo UTC). Quy tắc ghi trong workflow
  và README: **CI đang chạy không chặn deploy; CI báo đỏ thì chặn
  deploy** cho tới khi sửa xong và CI xanh lại.
- Tính khả thi của `test:db` trên CI đã xét kỹ: service Postgres chạy
  trên cùng runner nên `DATABASE_URL` trỏ `localhost:5432`, đúng điều
  kiện "chỉ localhost" mà `test:db`/`recreate-test-data.ts` yêu cầu;
  job tự tạo `.env` tạm (mật khẩu admin sinh ngẫu nhiên theo job,
  hash ngay tại chỗ, không phải mật khẩu thật, không commit).
- **Chưa kiểm chứng:** workflow mới chỉ kiểm bằng YAML parse +
  kiểm cú pháp (`node --check` cho script sửa kèm) — `act` không chạy
  được trên máy này (Docker không chạy container) nên **chưa từng
  chạy thật trên GitHub**. Lần đầu chạy cần xem log CI để xác nhận
  job `test-db`/`security` xanh.
- Sửa kèm nhỏ để CI chạy được (Phần D): `scripts/test-security.mjs`
  trước đây ghi cứng `~/tools/node22/bin/node|npx` nên trên GitHub
  Actions không chạy được; nay dùng `process.execPath` + `npx` trên
  PATH — hành vi local không đổi (đã chạy lại `test:security` sau
  sửa: TẤT CẢ ĐẠT).

## §3 Hiệu năng (số đo thật, server standalone local :3000)

TTFB đo bằng `curl` (mỗi trang 3 lần, server đã nóng):

| Trang | Lần 1 | Lần 2 | Lần 3 | Trung bình |
|---|---|---|---|---|
| `/` (trang chủ) | 48,9 ms | 39,0 ms | 33,9 ms | **~40,6 ms** |
| `/hoa-tuoi` (danh mục) | 39,9 ms | 36,5 ms | 38,4 ms | **~38,3 ms** |
| `/hoa-tuoi/bo-hong-do-tinh-yeu` (sản phẩm) | 99,7 ms | 28,9 ms | 26,1 ms | **~51,6 ms** (trung vị 28,9 ms; lần đầu gồm truy vấn lạnh) |

- First Load JS (từ build log): **`/` = 115 kB**, `/[category]` =
  114 kB, `/[category]/[product]` = 118 kB, shared 103 kB —
  **giữ nguyên như nền fixup 3**, không tối ưu thêm (đúng chỉ đạo:
  giữ nguyên 115 kB).
- **Ngân sách (§3, chế độ cảnh báo — không chặn deploy):** trang chủ
  2,5 giây trên mạng 4G chậm, dưới 100 KB JavaScript, Lighthouse
  trên 90. Đối chiếu: TTFB local ~41 ms (tốt, nhưng TTFB local
  KHÔNG phải thời gian tải trên 4G chậm — không được đọc hai số này
  là một); **First Load JS 115 kB VƯỢT ngân sách 100 kB** (giữ
  nguyên theo quyết định Ngày 17, ghi nhận ở chế độ cảnh báo);
  **Lighthouse CHƯA ĐO** — không có Chrome Lighthouse CLI đáng tin
  trên máy này nên không bịa điểm số (xem mục "Còn thiếu").
- Không tối ưu gì thêm trong đợt này vì không phát hiện vấn đề rõ
  ràng (TTFB thấp, JS không tăng so với nền).

## §4 Vận hành

- **Sao lưu — ĐÃ XÁC MINH (theo báo cáo của Henry):** nhánh snapshot
  Neon **`snapshot-2026-11-26` đã tạo** (Henry tạo 26/11 ~20:44, theo
  báo cáo Ngày 15 — kiểm chứng chính thức thuộc về phía cha; trong
  phiên này chỉ ghi theo báo cáo của Henry). Script xóa hàng loạt
  (`scripts/clean-production.ts`) vẫn bắt buộc `--snapshot` chụp
  TRƯỚC — không có snapshot thì từ chối xóa.
- **Sao lưu tự động 2h sáng + giữ 7 ngày: CHƯA CÓ.** Đây là việc vận
  hành trên Neon/Vercel, **chưa tự động hóa trong repo** (không có
  script/job nào tự chụp snapshot hay kiểm tra snapshot còn tốt) —
  ghi rõ, không bịa đã làm. Quy trình sao lưu/khôi phục đầy đủ đã
  viết trong `docs/van-hanh.md` §5, kèm lưu ý **quy trình khôi phục
  từ snapshot chưa từng chạy thử end-to-end trên production**.
- **Cảnh báo lỗi 500: CHƯA CÓ** (không có dịch vụ cảnh báo) — lỗi
  chỉ phát hiện khi có người báo hoặc tự kiểm tra (`smoke-live.sh`).
  Ghi rõ, không bịa.
- **Nhật ký hoạt động (audit):** có từ trước + P5 mở rộng sang sản
  phẩm/danh mục/khu vực (probe P chạy lại 17/17); không có đường
  xóa/sửa trong giao diện (kiểm động S12 PASS).
- Theo dõi vận hành hàng ngày: thẻ "Đơn cần xử lý" + thẻ quá hạn ở
  `/admin`, chuông/toast poll 60 giây (phần N) — xem `docs/van-hanh.md` §4.

## §5 Tài liệu

- **README cập nhật** (giữ nội dung cũ, chỉ thêm/sửa phần thiếu):
  link deploy, cách chạy local không Docker, bảng biến môi trường,
  mục "Kiểm thử và CI" (`npm test`, `npm run test:db` đúng trình tự
  recreate → test:db → clean, `npm run test:security`, `typecheck`,
  `lint`, smoke 20/21), mục "Sao lưu/khôi phục và vận hành" trỏ
  `docs/van-hanh.md`, ngân sách hiệu năng (warn). Sửa 2 chỗ đã lỗi
  thời: giới hạn ảnh sản phẩm 5 MB → **2 MB** (Ngày 17 S5) và
  "Ngân hàng & QR, Khu vực & phí, Telegram vẫn Sắp có" → đã có trang
  quản trị riêng từ Ngày 12.
- **`docs/van-hanh.md` mở rộng thành tài liệu vận hành admin đầy đủ
  (tiếng Việt):** quản lý đơn (luồng trạng thái, hủy cần lý do, hoàn
  tiền, in phiếu A5, tra cứu), quản lý sản phẩm/danh mục (cột Nguồn,
  thao tác hàng loạt, nhập sản phẩm, giới hạn ảnh), cài đặt (6 trang,
  lưu ý đổi ngân hàng + xác nhận bằng mật khẩu), theo dõi đơn mới
  (giữ nguyên nội dung của phần N — không viết trùng lặp), sao lưu/
  khôi phục (§5.1–5.4, ghi rõ phần chưa tự động và phần chưa chạy
  thử), xử lý sự cố (bảng 13 hiện tượng, gồm cả lỗi 500 chưa có cảnh
  báo và đăng nhập sai 5 lần → 429).

## §6 Bảo mật vận hành

- Script production: `clean-production.ts` chỉ chạy tay, có chốt
  chặn snapshot + `--i-know-this-is-production`; không chạy script
  nào lên production trong Ngày 17 (mọi kiểm chứng đều trên
  standalone local).
- Mọi route `/admin` yêu cầu đăng nhập: quét tĩnh **42 mục S1 ok**
  (30/30 trang admin + layout + 21 server action admin gọi
  `requireAdmin()` đầu tiên, danh sách ngoại lệ công khai: đặt hàng,
  giỏ hàng, đăng nhập, tra cứu, health/quick-view/suggest); kiểm
  động 14 ca S1 PASS (8 route admin chưa đăng nhập → 307, cookie
  giả → 307, phiên hết hạn/idle → 307, admin có `no-store`).
- Bí mật: quét tĩnh **không thấy bí mật trong 273 file mã nguồn +
  80 file `.next/static`**; `.env` không nằm trong git;
  `.env.example` chỉ có tên biến/placeholder; lịch sử commit không
  thấy `ghp_`/`github_pat_` hay hash mật khẩu thật. Lưu ý trong ngày:
  một lệnh `psql` lỗi của Phần D đã in `DATABASE_URL` ra log
  terminal của phiên làm việc (mật khẩu DB local chỉ xuất hiện trong
  log phiên, không ghi vào file/báo cáo/commit nào) — lần sau dùng
  `PGPASSWORD` thay vì URL trên argv.

## §7 P1

- **Khả năng truy cập — kiểm bằng CDP (probe mới
  `~/workspace/day17-shots/day17-d-a11y.mjs`): 8/8 PASS.** Tab đi
  qua được: link "Bỏ qua tới nội dung chính", ô tìm kiếm, nút tìm
  kiếm, giỏ hàng, menu danh mục, nút Xem nhanh/xem chi tiết (trang
  chủ, 40 lần Tab); ô tên đăng nhập + mật khẩu + nút Đăng nhập
  (`/login`, có `<label>` gắn đúng ô). Nút chỉ có icon: 8/8 có
  aria-label/title (trang chủ). Ảnh: 15/15 có `alt`. Tương phản chữ
  chính **11,57:1** (chữ `#123C2E` trên nền `#FAF8F4`, vượt WCAG AA
  4,5:1). Ảnh: trang chủ + `/login` (ô mật khẩu đang focus, vòng
  focus thấy rõ).
- **Trình duyệt: CHỈ Chrome headless 158.** Safari/Firefox **CHƯA
  KIỂM** (không có trên máy này) — không bịa.
- **Dependency:** `postcss`/`zod` đã nâng ở Phần S qua `overrides`
  trong `package.json` (`postcss 8.5.33`, `zod 4.6.6`) — ghi nhận.
  **Prisma 6.19.3 → 7.10.1 KHÔNG nâng** (4 High qua `@prisma/config`
  còn mở — ngoài phạm vi, cần quyết định riêng; xem S11).
- B6 xem trước Markdown 2 cột: ĐẠT (probe P 17/17, 1440 xếp 2 cột,
  390 xếp dọc không tràn ngang).

## Bảo mật (S1–S12)

Cách đếm: "số ca" = số kiểm đã chạy trong Ngày 17 mà Phần D chạy lại
và đối chiếu được từ log (`npm run test:security`: unit bảo mật 87 +
quét tĩnh 52 + kiểm động 44 + quét live 21; cộng các test unit/db
liên quan trong `npm test`/`npm run test:db`). Chi tiết từng nhóm
trong log `/tmp/day17-test-security.log` (phiên làm việc; chạy lại
bằng `npm run test:security` để tái tạo).

| Nhóm | Số ca | PASS/FAIL | Phát hiện (mức độ) | Đã sửa | Phần chưa test |
|---|---|---|---|---|---|
| S0 Token GitHub | 0 | CHỜ HENRY | Token cũ dán vào trò chuyện 26/11, coi như đã lộ (High) | Chưa — việc của Henry: thu hồi + tạo fine-grained token mới chỉ cho kho `flowershop` | Xác nhận thu hồi + quét lại sau khi Henry làm |
| S1 Phân quyền | 61 | PASS | Không | — (30/30 trang admin + layout + 21 action gọi `requireAdmin()`; 14 ca động + 5 ca live-scan) | Server action mới sau Ngày 17 (chưa có) |
| S2 Phiên/đăng nhập | 24 | PASS | Không (mức FAIL); **TOTP P2 chưa làm** (theo đặc tả: làm sau, vì admin sửa được thông tin ngân hàng) | Idle 30 phút đã có (unit 5 + động: idle 31' → 307, 29' → vào được); 5 lần sai → 429; lỗi chung chung; chặn open redirect | TOTP (P2) |
| S3 Tiêm nhiễm | 33 | PASS | **ReDoS Markdown (High, đã sửa):** regex link cũ backtrack hàm mũ, chuỗi 5,7 KB mất 2,8 giây | Quét tuyến tính thay regex (Ngày 17 S3); giữ 50 ms/ca (xem mục sửa flaky) | Fuzz sâu hơn bộ Markdown (hiện 3 ca ngân sách + payload XSS/SQLi trên tham số công khai) |
| S4 CSRF | 3 | PASS | Không (Origin evil/thiếu Origin → 403; server action giả → bị chặn) | — | Route handler đổi trạng thái ngoài upload (đã quét tĩnh qua S1) |
| S5 Upload | 48 | PASS | Không (SVG tĩnh + SVG chứa script → từ chối; `.png` chứa HTML/PHP, đổi đuôi, > 2 MB, 7000 px, ảnh hỏng → 400; PNG hợp lệ → 200, tên theo băm; ảnh phục vụ kèm `nosniff`) | Giới hạn siết 5 MB → 2 MB/ảnh, ≤ 6 ảnh/SP, ≤ 6000 px; không nhận SVG | Ảnh qua adapter Blob trên production (chỉ kiểm đĩa local) |
| S6 SSRF | 0 | KHÔNG ÁP DỤNG | Không có chức năng nhập từ URL để tấn công: trong toàn bộ `src/` không có code fetch URL do người dùng nhập (chỉ `fetch` client tới `/api/quick-view` của chính shop); "Nhập sản phẩm" chỉ là nhãn nguồn (P1), không phải import URL | — | Nếu sau này thêm import URL thì phải làm đủ S6 (chặn IP nội bộ, ghim IP, tối đa 3 redirect, timeout 10s) + test với máy chủ giả |
| S7 Tra cứu đơn | 7 | PASS* | **Tra cứu bị giới hạn trả 200 thay vì 429 (Low):** sau 30 lần/phút, trang trả 200 kèm thông báo "quá nhiều" thay vì 429 — giới hạn CÓ tác dụng (chặn nội dung), chỉ sai mã trạng thái. Phần D tự kiểm lại: 35 lần tra mã sai liên tiếp → 30×404 rồi 5×200 "quá nhiều". (Ngoài 7 ca unit/db: probe O chạy lại thêm 4 ca CDP S7 PASS — che SĐT, 404 thống nhất, `no-store`+`noindex`, flood bị giới hạn.) | Chưa sửa (Low, để Ngày 18) | Liệt kê đơn bằng tham số khác (đã kiểm: không có tham số liệt kê) |
| S8 Logic đặt hàng | 12 | PASS | Không (12 ca `order.db.test.ts`: tính lại tiền từ DB, phí theo khu vực, SP ẩn/khu vực tắt → không tạo đơn, chống đặt trùng, mã đơn Crockford, SL 0/âm/quá lớn/51 dòng, lý do hủy, chuyển trạng thái sai → từ chối. Ngoài ra probe O chạy lại thêm 9 ca CDP S8 PASS.) | — | **Chuyển khoản khi BẬT chưa kiểm live** (chỉ kiểm khi tắt) |
| S9 Giới hạn tốc độ | 12 | PASS* | **Fail-open khi DB bộ đếm lỗi (Medium, đã biết):** `checkRateLimit` lỗi DB → cho qua thay vì chặn (ghi nhận từ phần S, chưa đổi vì đổi sang fail-closed có thể khóa luôn người dùng thật khi DB chập chờn — cần quyết định riêng). Cùng phát hiện 200-thay-429 với S7 | Chưa sửa | Hành vi khi DB bộ đếm lỗi dưới tải thật |
| S10 Header/cấu hình | 24 | PASS | Không (CSP `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, script-src nonce không `unsafe-inline`; HSTS production; `nosniff`; Referrer-Policy; Permissions-Policy; không `X-Powered-By`; trang lỗi không lộ stack trace; `/login` có `X-Frame-Options: DENY`) | — | HSTS chỉ kiểm được trên https (local http bỏ qua đúng quy định) |
| S11 Chuỗi cung ứng/bí mật | 4 (+4 tĩnh) | **FAIL** | **4 High còn mở (cổng deploy):** `npm audit --omit=dev` = 4 High, 0 Critical — `deepmerge-ts` stack exhaustion (GHSA-ggr8-5vv4-36mx) + `effect` ReDoS (GHSA-7589-6fvf-x4pw), đều qua `@prisma/config` của Prisma 6.19.3; bản sửa là Prisma 7.10.1 (breaking change). Quét bí mật tĩnh 4/4 ok | Chưa — ngoài phạm vi Ngày 17, cần quyết định riêng | Kiểm lại audit sau khi nâng Prisma |
| S12 Nhật ký/phục hồi | 14 | PASS | Không (audit không có đường xóa/sửa trong giao diện; snapshot Neon `snapshot-2026-11-26` đã tạo) | Nhật ký mở rộng sang SP/danh mục/khu vực (P5) | Quy trình khôi phục từ snapshot chưa chạy thử end-to-end |

Log `npm run test:security` (Phần D chạy lại 2 lần, đều TẤT CẢ ĐẠT):
unit bảo mật **87/87**, quét tĩnh **52 ok, 0 FAIL**, kiểm động
**44 PASS, 0 FAIL**, quét live (GET/HEAD) **21 PASS, 0 FAIL**.
Quét live trên production (`security-scan-live.sh` lên live) chưa
chạy trong Ngày 17 — chỉ quét live trên standalone local.

## §9 Ngưỡng deploy — đánh giá trung thực từng tiêu chí

(Kiểm bằng code/curl/CDP nhanh trong Ngày 17; các mục đã kiểm kỹ ở
ngày trước thì dẫn nguồn ngày đó.)

| Tiêu chí | Kết quả | Lý do / nguồn |
|---|---|---|
| Sản phẩm: tên, ảnh, giá, mô tả, đánh giá, kho, giá gốc; hết hàng hiện rõ, không đặt được | **CHƯA ĐẠT (phần đánh giá)** | Tên/ảnh/giá/mô tả/kho/giá gốc/hết hàng: ĐẠT (Ngày 4; kiểm lại Ngày 17: "Tạm hết hàng" trong `page.tsx:110` + `ProductCard.tsx:73`, nút mua vô hiệu hóa). **Đánh giá sản phẩm: KHÔNG CÓ** — không có tính năng đánh giá nào trong code (tìm "review/rating" không thấy) nên tiêu chí này chưa đạt. |
| Danh mục: tên, ảnh, mô tả, liên kết; trống thì báo trống | ĐẠT | Ngày 7; kiểm lại: "Chưa có danh mục nào." (`admin/categories/page.tsx:58`); danh mục ngoài shop hiển thị đủ tên/ảnh/mô tả/liên kết. |
| Giỏ hàng: tên, ảnh, giá, mô tả ngắn, số lượng; sửa được SL; trống thì báo trống | ĐẠT | Ngày 4–5 (giỏ trong DB, đổi SL/xóa dòng, tạm tính theo giá DB). |
| Trang tĩnh: đủ mục + nội dung; không "lorem ipsum"/nháp | ĐẠT | Ngày 13–15; 3 trang, 0 xuất bản (kiểm `<head>` 4/4 + smoke: trang nháp → 404). |
| Trang tin tức: tiêu đề, ảnh, nội dung, ngày đăng; trống thì báo trống | **KHÔNG ÁP DỤNG** | Không có tính năng tin tức công khai (không có route tin tức; menu admin "Bài viết / Tin tức" đang để "Sắp có" — `AdminNav.tsx:147`). Chưa từng nằm trong phạm vi các ngày 1–17; muốn có là phạm vi mới. |
| Bài tin tức: tiêu đề, ảnh, nội dung, ngày đăng, tác giả; trống thì báo trống | **KHÔNG ÁP DỤNG** | Như trên. |
| Cài đặt: tên shop, slogan, liên hệ, SEO, phí vận chuyển, phương thức thanh toán; chưa có thì báo trống | ĐẠT | Ngày 11–12 (6 trang cài đặt); trường trống thì ẩn dòng, không hiện "Đang cập nhật". |
| Tìm kiếm: công khai (SP, danh mục, tin tức); theo từ khóa/danh mục/không có kết quả | **ĐẠT (trừ tin tức)** | Ngày 6 (không phân biệt dấu, AND, xếp hạng); tin tức không áp dụng như trên. |
| Tra cứu đơn: mã đúng/sai/không tồn tại | ĐẠT | S7: 404 thống nhất, che SĐT, `no-store` + `noindex`, giới hạn 30 lần/phút (probe O 19/19). Lưu ý 200-thay-429 (Low, S7). |
| Đặt hàng: số tiền, phương thức thanh toán, khu vực giao hàng | ĐẠT | Ngày 5 + S8 (probe O 19/19). Lưu ý: chuyển khoản khi BẬT chưa kiểm live. |
| Quản lý đơn hàng: đủ trường các trạng thái; đổi trạng thái, gửi email xác nhận, theo khu vực, tìm đơn | **CHƯA ĐẠT (phần email)** | Đổi trạng thái theo `ORDER_NEXT`, tìm/lọc theo khu vực, phiếu A5: ĐẠT (Ngày 8–10). **Gửi email xác nhận đơn: KHÔNG CÓ** — shop chưa gửi email (chỉ có báo Telegram qua `resendNotificationAction`; email là bước sau theo quyết định Phần N). |
| Quản lý sản phẩm: đủ trường; hiển thị theo khu vực, cập nhật, nhập, xuất | **CHƯA ĐẠT (phần xuất)** | Cập nhật + nhập (nguồn/cột Nguồn, lọc, hàng loạt — P): ĐẠT. **Xuất sản phẩm: KHÔNG CÓ** (không có chức năng export trong code). "Hiển thị theo khu vực" không áp dụng cho sản phẩm (sản phẩm không gắn khu vực — khu vực chỉ gắn với giao hàng). |
| Quản lý danh mục: đủ trường; hiển thị theo khu vực, cập nhật, nhập, xuất | **CHƯA ĐẠT (phần nhập/xuất)** | Cập nhật + lọc nguồn: ĐẠT (P). **Nhập/xuất danh mục: KHÔNG CÓ.** |
| Quản lý tin tức: đủ trường; cập nhật, nhập, xuất | **KHÔNG ÁP DỤNG** | Không có tính năng tin tức (như trên). |
| Quản lý cài đặt: đủ trường; cập nhật, nhập, xuất | **ĐẠT (trừ nhập/xuất)** | Cập nhật đủ 6 trang + audit: ĐẠT. Nhập/xuất cài đặt: KHÔNG CÓ — ghi nhận là chưa đạt phần nhỏ này (cài đặt không có chức năng import/export; đổi bằng tay trong admin). |
| Quản lý trang tĩnh: đủ trường; cập nhật, nhập, xuất | **ĐẠT (trừ nhập/xuất)** | Cập nhật + xuất bản/nháp + chặn trùng slug: ĐẠT (Ngày 13–15). Nhập/xuất trang tĩnh: KHÔNG CÓ. |
| Quản lý người dùng | **KHÔNG ÁP DỤNG** | Thiết kế 1 tài khoản admin duy nhất qua biến môi trường; không có khái niệm người dùng/khách hàng có tài khoản nên không có màn quản lý người dùng. |
| Quản lý vận hành | **KHÔNG ÁP DỤNG** | Không có mục quản trị vận hành riêng trong phạm vi; thay thế một phần bằng nhật ký hoạt động (`/admin/activity`) + thẻ tổng quan + `docs/van-hanh.md`. |
| Đơn hàng của khách hàng | ĐẠT | Cùng tiêu chí quản lý đơn hàng (xem trên) trừ phần email. |
| Sản phẩm của khách hàng | **CHƯA ĐẠT (phần xuất)** | Cùng tiêu chí quản lý sản phẩm (xem trên). |
| Trang đăng nhập admin: đăng nhập, báo sai, bị khóa | ĐẠT | S2: 5 lần sai → 429 (15 phút), lỗi chung chung, chặn open redirect; CDP a11y 8/8 (ô + nút tới được bằng Tab). |
| Kiểm thử: test bảo mật PASS, không Critical/High | **CHƯA ĐẠT** | Test bảo mật PASS hết (87+52+44+21), nhưng **4 High S11 còn mở** (Prisma) → chưa đạt cổng deploy. |
| Kiểm thử: unit 100%; integration > 80%; E2E > 80% | **ĐẠT MỘT PHẦN** | Unit 386/386 PASS; test:db 92/92 PASS (integration); CDP probe S/O/P/N 19+17+27 PASS + a11y 8/8. **Không có con số % bao phủ đo được** (không đo coverage) nên không khẳng định "100% unit / > 80% E2E" theo nghĩa bao phủ mã — chỉ khẳng định mọi ca hiện có đều PASS. |
| Hiệu năng: 2,5s trên 4G chậm, < 100 KB JS, Lighthouse > 90 | **CHƯA ĐẠT** | TTFB local ~41 ms (không phải thời gian tải 4G); **First Load JS 115 kB > 100 kB**; **Lighthouse chưa đo**. Ngân sách ở chế độ cảnh báo (không chặn deploy) nên mục này không chặn, nhưng ghi CHƯA ĐẠT cho đúng số. |
| SEO: title, description, OG; ảnh có `alt`; sitemap + robots.txt | ĐẠT | `<head>` 4/4 giống nền fixup 3 (title/description/canonical/robots/OG); ảnh trang chủ 15/15 có `alt`; sitemap + robots trả đúng (smoke PASS). |
| Phân tích: Google Analytics hoặc tương đương | **CHƯA ĐẠT** | Không có Google Analytics hay công cụ tương đương nào trong code (tìm `gtag`/`googletagmanager`/analytics: không thấy). |
| Khả năng truy cập: bàn phím, tương phản, Tab | ĐẠT (cơ bản) | CDP 8/8 (Tab, aria-label, alt, tương phản 11,57:1). Chưa kiểm trình đọc màn hình hay Safari/Firefox. |
| Bảo mật: CSP, nosniff, Referrer-Policy, Permissions-Policy, HSTS | ĐẠT | S10: 24 ca PASS (CSP nonce, HSTS production, `X-Frame-Options: DENY` trên `/login`, không `X-Powered-By`). |

**Tổng §9:** nhiều tiêu chí ĐẠT, nhưng các tiêu chí sau chưa đạt hoặc
không áp dụng: đánh giá sản phẩm, email xác nhận đơn, xuất sản phẩm/
danh mục/trang tĩnh/cài đặt, test bảo mật (4 High S11), hiệu năng
(JS 115 kB + Lighthouse chưa đo), Google Analytics, và % bao phủ
không đo được. Tin tức + quản lý người dùng + quản lý vận hành là
KHÔNG ÁP DỤNG (tính năng chưa từng có trong phạm vi).

## Sửa ca test flaky `markdown.test.ts:85` (Phần D)

- Vấn đề: 3 ca ReDoS assert `< 50 ms` bằng **một lần đo duy nhất**
  — đo cả nhiễu lập lịch/JIT nên máy tải nặng đã đo **66 ms** cho ca
  link chưa đóng (P và N đều ghi nhận), dù bản thân render chỉ
  ~0,5 ms (đo lại Ngày 17: link300 min 0,41 ms, median 0,45 ms;
  95 KB min 1,24 ms).
- Cách sửa (đúng đắn, không làm yếu test): đo **5 lần lấy MIN kèm
  1 lần khởi động (JIT)**, giữ nguyên ngân sách **50 ms**. Min loại
  nhiễu lập lịch nhưng vẫn bắt được ReDoS thật — regex cũ mất
  **2.800 ms** (gấp 56 lần ngân sách) nên min của nó vẫn vượt 50 ms
  với biên độ lớn.
- Kiểm chứng: `markdown.test.ts` **13/13 PASS × 3 lần chạy** sau sửa
  (trước sửa cũng 13/13 × 3 lần trong phiên này nhưng flaky đã được
  ghi nhận ở máy tải nặng).

## Kiểm chứng (Phần D chạy lại toàn bộ)

| Mục | Kết quả |
|---|---|
| Unit (`npm test`) | **386/386 PASS × 3 lần** (lần 1: 13,7s; không còn flaky) |
| test:db (recreate → test:db → clean) | **92/92 PASS** (chạy 2: 92/92; chạy 3: 92/92; **chạy 1: 91 pass + 1 fail — xem "Sự cố"**) |
| Typecheck | **0 lỗi** |
| Lint | **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`) |
| Build | OK; First Load JS `/` = **115 kB** (như nền fixup 3) |
| Smoke local (`smoke-live.sh http://localhost:3000`) | **20/21 PASS** — FAIL duy nhất sitemap-localhost (kỳ vọng) |
| So `<head>` với nền P (= nền fixup 3) | **4/4 giống hệt** (trang chủ + danh mục + sản phẩm + trang tĩnh; chạy lại probe của agent N `day17-n-heads.mjs`) |
| `npm run test:security` | **TẤT CẢ ĐẠT** (unit 87/87, tĩnh 52 ok, động 44 PASS, live 21 PASS; chạy 2 lần) |
| CDP probe N (chạy lại) | **27/27 PASS** (toast/chuông/tiêu đề, tab ẩn, âm báo, thông báo trình duyệt, thẻ quá hạn) |
| CDP probe P (chạy lại) | **17/17 PASS** (Nguồn/lọc, hàng loạt, audit P5, B6) |
| CDP probe O (chạy lại) | **19/19 PASS** (S8 tamper, S7 tra cứu, kiểm tay "nhảy thứ tự" 4 ca) |
| CDP a11y mới (Phần D) | **8/8 PASS** (Tab, aria-label, alt, tương phản 11,57:1) |
| TTFB (curl, server standalone local) | `/` ~40,6 ms; `/hoa-tuoi` ~38,3 ms; SP ~51,6 ms (trung bình 3 lần) |
| `npm audit --omit=dev` | **4 High, 0 Critical** (S11 — cổng deploy) |
| `git status` | Mọi thay đổi đều là file có chủ đích (S/O/P/N/D); không còn file tạm/backup trong repo |
| DB cuối đợt | **20\|0\|3\|24\|0\|0\|0\|4** (products\|orders\|pages\|settings\|audit\|sessions\|carts\|categories); cài đặt ngân hàng về gốc (bankCode/STK/tên rỗng, enabled false, mẫu `DH {ORDER_CODE}`); `rate_limit_events` = 0 |

## Kiểm chứng độc lập (điều phối viên — chạy lại toàn bộ từ đầu, số của mình)

| Mục | Kết quả |
|---|---|
| Unit (`npm test`) | **386/386 PASS** (log `~/workspace/day17-unit-mine.log`) |
| test:db (recreate → test:db → clean) | **92/92 PASS** (log đầy đủ `~/workspace/day17-testdb-mine.log` — **không còn fail không xác định** như lần chạy 1 của Phần D; lần đó nhiều khả năng là nhiễu do bộ đếm rate-limit còn sót, nay đã có log đầy đủ để đối chiếu nếu tái hiện) |
| Typecheck | **0 lỗi** |
| Lint | **0 lỗi**, 2 warning `<img>` có từ trước |
| Build | OK; First Load JS `/` = **115 kB**; `/admin/activity` 125 kB, `/admin/products` 118 kB |
| Smoke local | **20/21 PASS** — FAIL duy nhất sitemap-localhost (kỳ vọng) |
| So `<head>` với nền fixup 3 | **4/4 giống hệt** (chạy lại probe `day17-n-heads.mjs`) |
| `npm run test:security` | **TẤT CẢ ĐẠT** (xem sự cố 1 dưới: lần chạy đầu FAIL 1 bước do log server bị xóa, không phải lỗi sản phẩm; chạy lại sau khi khởi động lại server: tĩnh 52 ok, động 44 PASS, live 21 PASS) |
| `npm audit --omit=dev` (tự chạy lại) | **4 High, 0 Critical** — xác nhận độc lập cổng deploy: `deepmerge-ts` GHSA-ggr8-5vv4-36mx + `effect` GHSA-7589-6fvf-x4pw, qua `@prisma/config`, sửa = Prisma 7.10.1 |
| `markdown.test.ts` (sửa flaky) | **13/13 PASS × 3 lần** |
| CDP probe N (chạy lại) | **27/27 PASS** (xem sự cố 2 dưới: lần chạy đầu 22/27 do thiếu dữ liệu recreate; chạy lại sau recreate: 27/27) |
| CDP probe O (chạy lại) | **19/19 PASS** (log `~/workspace/day17-o-verify-mine.log`: S8 tamper giá/SL/SP ẩn/khu vực tắt/chuyển khoản tắt, "nhảy thứ tự" 3 ca, S7 che SĐT + 404 thống nhất + flood giới hạn ở lần thứ 28) |
| Ảnh mắt kiểm (điều phối viên) | Toast đơn mới 1440 (chuông 1 + "Có 1 đơn mới / Xem danh sách", dòng quá hạn "0 đơn đã quá hạn giao →" dính mũi tên đúng); nhật ký P5 1440 (`product:1.price 890000 → 891000`, 4 dòng `isActive` đúng) |
| CI workflow (đọc + kiểm) | `.github/workflows/ci.yml` đọc kỹ: 5 jobs + cron 02:00 VN hợp lệ; `scripts/hash-admin-password.ts` **có tồn tại**; lockfile đồng bộ với `package.json` (`npm install --dry-run --package-lock-only` không đổi lockfile) nên `npm ci` chạy được |
| Quét bí mật trên diff | **0 hit** (`ghp_`/`github_pat_`/`AKIA`/private key/URL Postgres có mật khẩu/token Blob/hash scrypt thật); diff `package-lock.json` sạch: chỉ bỏ postcss 8.4.31 lồng trong next + zod 4.1.11 → 4.6.6 |
| DB cuối đợt | **20\|0\|3\|0\|24\|0\|0\|4\|0** (products\|orders\|pages\|published\|settings\|audit\|sessions\|categories\|rate_limit_events); cài đặt ngân hàng về gốc (rỗng, enabled false, mẫu `DH {ORDER_CODE}`); không còn file `.env.*.bak`/`.sha` nào trong `~/workspace` |

## Sự cố trong ngày (bổ sung — điều phối viên gặp khi kiểm độc lập)

- **`npm run test:security` lần chạy đầu FAIL 1 bước (S4, không phải lỗi sản phẩm):** kiểm động `security-live-check` báo "log server không ghi lý do chặn Origin". Nguyên nhân: lệnh `npm run build` của mình đã xóa `.next/standalone-server.log` trong lúc server cũ (PID 28449, do Phần D khởi động) vẫn đang chạy và giữ inode đã xóa (`(deleted)`); `test-security.mjs` thấy server đang chạy nên dùng luôn mà không khởi động lại, còn bước kiểm đọc file log trên đĩa — file không còn nên đọc được chuỗi rỗng. Bản thân action đã bị chặn đúng (evil Origin → 500, cùng nguồn + id giả → 404). Cách xử lý: khởi động lại server bằng `scripts/start-standalone.sh` (giết đúng PID cũ, tạo lại file log) rồi chạy lại → **TẤT CẢ ĐẠT**. Bài học/hạn chế của harness: `test-security.mjs` tái dùng server đang chạy; nếu file log của server đó đã mất (sau một lần build) thì bước kiểm S4 sẽ FAIL giả. Trên CI không gặp vì CI luôn build mới rồi mới khởi động server. Ghi lại để Ngày 18 cân nhắc: bắt `test-security.mjs` khởi động lại server khi file log không tồn tại.
- **Probe N lần chạy đầu 22/27 (5 FAIL, không phải lỗi sản phẩm):** probe `day17-n-verify.mjs` giả định DB đang ở trạng thái recreate (3 đơn mẫu, chuông ban đầu = 3), nhưng lần chạy `test:db` + clean của mình trước đó đã xóa 3 đơn mẫu nên chuông ban đầu = 0 và cả 5 ca N3/N2 liên quan số 3 đều FAIL. Chạy lại sau `recreate-test-data.ts` → **27/27 PASS**. Bài học: probe CDP nào cũng phải ghi rõ tiền điều kiện DB trong đầu file (probe N đã ghi, nhưng người chạy lại phải đọc).

## Còn thiếu / rủi ro đã biết

1. **4 High S11 còn mở (cổng deploy):** qua `@prisma/config` của
   Prisma 6.19.3; sửa = nâng Prisma 7.10.1 (breaking change) — cần
   quyết định riêng của Henry. Chưa nâng trong Ngày 17.
2. **TOTP P2 chưa làm** (S2): admin sửa được thông tin ngân hàng nên
   TOTP là ưu tiên sau S1–S12 chính.
3. **S0 chờ Henry:** thu hồi token GitHub cũ đã lộ (26/11).
4. **Poll giữ phiên sống:** tab admin mở thì poll 60 giây tính là
   có hoạt động nên idle 30 phút không hết hạn khi tab đang mở —
   hành vi đã biết, chưa đổi (đổi sẽ làm tab đang mở bị văng giữa
   chừng; cần quyết định: poll có nên "chạm" idle hay không).
5. **Thẻ tổng quan SSR không cập nhật live:** số trên thẻ "Đơn cần
   xử lý" chỉ đúng lúc tải trang; đơn mới chỉ cập nhật chuông/tiêu
   đề/toast (poll), thẻ chỉ đổi sau khi tải lại trang.
6. **Rate-limit tra cứu trả 200 thay vì 429 (Low):** đã tự kiểm lại
   (30×404 rồi 5×200 "quá nhiều") — giới hạn có tác dụng, chỉ sai
   mã trạng thái.
7. **Fail-open khi DB bộ đếm lỗi (Medium):** `checkRateLimit` lỗi DB
   → cho qua; đổi sang fail-closed cần quyết định riêng (có thể khóa
   luôn người dùng thật khi DB chập chờn).
8. **Chuyển khoản khi BẬT chưa kiểm live:** chỉ kiểm khi tắt (S8-5);
   luồng QR VietQR khi bật vẫn là dữ liệu seed/cấu hình mẫu, chưa
   có tài khoản ngân hàng thật của Henry.
9. **Safari/Firefox chưa kiểm** (chỉ Chrome headless 158).
10. **Lighthouse chưa đo** (không có Chrome Lighthouse CLI đáng tin
    trên máy này) — không bịa điểm số.
11. **Sao lưu tự động + cảnh báo 500 chưa có** (xem §4); quy trình
    khôi phục từ snapshot Neon chưa chạy thử end-to-end.
12. **CI chưa chạy thật trên GitHub** (chỉ kiểm YAML/cú pháp);
    lần đầu chạy cần xem log job `test-db`/`security`.
13. **S6 KHÔNG ÁP DỤNG** (không có import URL) — nếu sau này thêm
    import URL thì phải làm đủ SSRF + test với máy chủ giả.
14. **Không có đánh giá sản phẩm, email xác nhận đơn, xuất
    sản phẩm/danh mục/trang tĩnh/cài đặt, Google Analytics** (xem
    §9) — các tính năng này chưa từng nằm trong phạm vi các ngày
    1–17.
15. **test:db chạy 1 FAIL 1 lần, không xác định được ca nào** (xem
    "Sự cố" dưới) — chạy lại 2 lần đều 92/92; cần theo dõi.
16. **Lập chỉ mục vẫn TẮT** trên live theo quyết định của Henry —
    đợt này không đụng vào.

## Ảnh đính kèm

- Trang chủ 1440: `~/workspace/day17-shots/day17-d-home-1440.png`
- `/login` với ô mật khẩu đang focus (vòng focus thấy rõ):
  `~/workspace/day17-shots/day17-d-a11y-login-1440.png`
- Toast đơn mới (phần N, chạy lại): `~/workspace/day17-shots/day17-n-toast-1440.png`,
  `~/workspace/day17-shots/day17-n-toast-390.png`
- Nhật ký P5 (phần P, chạy lại): `~/workspace/day17-shots/day17-p-activity-product-1440.png`
- Ảnh S7/S8 (phần O, chạy lại): `~/workspace/day17-shots/day17-s7-rate-limited.png`,
  `~/workspace/day17-shots/day17-s8-tamper-order.png`
- Probe chạy lại được: `~/workspace/day17-shots/day17-d-a11y.mjs`
  (Phần D), `~/workspace/day17-n-verify.mjs` (N),
  `~/workspace/day17-shots/probe-part-p.mjs` (P),
  `~/workspace/day17-shots/probe-part-o.mjs` (O),
  `~/workspace/day17-n-heads.mjs` (so `<head>`).

## File đã đổi (Phần D; toàn bộ Ngày 17 vẫn là 1 commit duy nhất trên `6e4a514`, chưa commit)

| File | Đổi gì |
|---|---|
| `.github/workflows/ci.yml` (mới) | CI 5 jobs + lịch hằng đêm 02:00 giờ VN; chặn deploy khi đỏ, không chặn khi đang chạy |
| `README.md` | Link deploy, chạy local không Docker, bảng biến môi trường, mục Kiểm thử/CI, mục Sao lưu/vận hành, ngân sách hiệu năng; sửa 2 chỗ lỗi thời (ảnh 5 MB → 2 MB; ngân hàng/khu vực/Telegram đã có trang quản trị) |
| `docs/van-hanh.md` (viết lại, giữ nội dung phần N) | Tài liệu vận hành admin đầy đủ: đơn, SP/danh mục, cài đặt, theo dõi đơn mới, sao lưu/khôi phục, xử lý sự cố |
| `docs/reports/ngay-17.md` (mới, file này) | Báo cáo tổng Ngày 17 |
| `src/lib/markdown.test.ts` | Sửa flaky ReDoS: đo min 5 lần, giữ ngân sách 50 ms |
| `scripts/test-security.mjs` | Bỏ ghi cứng `~/tools/node22/bin/node\|npx` → `process.execPath` + `npx` trên PATH (để chạy được trên CI) |
| `~/workspace/day17-shots/day17-d-a11y.mjs` (mới, ngoài repo) | Probe CDP khả năng truy cập 8/8 |

Các file của phần S/O/P/N (xem `git status`): migration rate-limit +
product-source, `src/lib/rate-limit.*`, `security-headers.*`,
`phone-mask.*`, `new-orders.*`, `product-source.*`, `bulk-products.*`,
`catalog-audit.*`, `NewOrderPoller.tsx`, `AdminProductsList.tsx`,
`CategoriesFilterBar.tsx`, `src/app/api/admin/orders/new-count/`,
`scripts/test-security.mjs`, `security-scan*.mjs/sh`,
`security-live-check.ts`, `docs/van-hanh.md` (phần N), sửa
`middleware.ts`/`auth.ts`/`markdown.ts`/upload/`orders.ts`/…

## Sự cố trong ngày (ghi lại để lần sau khỏi mất thời gian)

- **test:db lần 1 FAIL 1 ca, không xác định được ca nào:** lần chạy
  `test:db` đầu tiên của Phần D cho 91 pass + 1 fail, nhưng output
  được pipe qua `grep` nên chi tiết ca fail không được lưu lại. Chạy
  lại ngay sau đó 2 lần đều **92/92 PASS** (đúng trình tự recreate
  → test:db → clean). Nghi ngờ là flaky do nhiễu thời gian (khối
  HTTP của `new-orders.db.test.ts` tự khởi động server riêng trên
  cổng 3101) hoặc do bộ đếm rate-limit còn sót, nhưng không có bằng
  chứng để kết luận — ghi rõ ở đây để Ngày 18 theo dõi, không giấu.
  Bài học: **không pipe output test qua `grep` khi có fail** — luôn
  lưu log đầy đủ rồi mới lọc.
- **Một lệnh `psql` lỗi đã in `DATABASE_URL` ra log terminal** (xem
  §6): mật khẩu DB local chỉ xuất hiện trong log phiên làm việc,
  không vào file/báo cáo/commit. Lần sau dùng `PGPASSWORD` (như các
  probe đã làm) thay vì URL trên argv.
- **Probe a11y lần đầu FAIL 2 ca do lỗi probe, không phải lỗi sản
  phẩm:** (1) chỉ Tab 14 lần nên chưa tới nút Xem nhanh (sản phẩm
  nằm dưới); (2) kiểm `/login` bằng `innerText` của `<input>` (luôn
  rỗng) thay vì `<label>` gắn với ô. Sửa probe (Tab 40 lần; kiểm
  label/placeholder/name) → **8/8 PASS**. Ghi lại để lần sau khỏi
  tưởng sản phẩm lỗi.
- **VM/Postgres/Chrome đều còn tốt từ đầu đợt** (Postgres 16 online,
  Chrome 158 có sẵn) — không cần dựng lại DB hay cài lại Chrome như
  fixup 3.

## Kiểm chứng độc lập (Pi Em — chạy lại toàn bộ sau khi nhận bàn giao 27/11 ~19:00)

| Mục | Kết quả |
|---|---|
| Unit (`npm test`) | **386/386 PASS** (log `~/workspace/day17-unit-mine.log`) |
| test:db (recreate → test:db → clean) | **92/92 PASS**, log đầy đủ `~/workspace/day17-testdb-mine.log` |
| Typecheck | **0 lỗi** |
| Lint | **0 lỗi**, 2 warning `<img>` có từ trước |
| Build | OK; First Load JS `/` = **115 kB**, `/admin/activity` 125 kB |
| Smoke local | **20/21 PASS** — FAIL duy nhất sitemap-localhost (kỳ vọng) |
| So `<head>` với nền fixup 3 | **4/4 giống hệt** (chỉ khác ký tự xuống dòng cuối file) |
| `npm run test:security` | **TẤT CẢ ĐẠT** sau khi sửa lỗi dưới (lần 1 FAIL 1 bước tĩnh, xem dưới) |
| CDP probe N (chạy lại) | **27/27 PASS** |
| CDP probe P (chạy lại) | **17/17 PASS** |
| CDP probe O (chạy lại) | **19/19 PASS** (S7-1 che SĐT `masked=true`, S7-3 flood chặn ở lần 28 đúng kỳ vọng) |
| Ảnh mắt kiểm | Toast đơn mới 1440 (chuông 4 + "Có 1 đơn mới / Xem danh sách", thẻ quá hạn "3 đơn đã quá hạn giao →"); nhật ký P5 1440 (`product:1.price 890000 → 891000`); S7/S8 (SĐT `090****567`, tổng 801.000 + 25.000 = 826.000) |
| `npm audit --omit=dev` | **4 High, 0 Critical** — tự chạy lại, xác nhận cổng deploy chưa đạt theo chữ của quy tắc |
| DB cuối đợt | **20\|0\|3\|0\|24\|0\|0\|4\|0**; cài đặt ngân hàng về gốc |

**2 lỗi tìm thấy khi kiểm độc lập (đã sửa, amend vào cùng commit):**

1. **`test:security` FAIL trên đúng cây đã commit** — quét tĩnh S11 báo
   "bí mật (postgres URL có mật khẩu) trong `docs/reports/ngay-17.md`".
   Nguyên nhân: dòng 311 của báo cáo viết mẫu ví dụ ``postgres://…:…@``
   khi liệt kê các mẫu đã quét; regex của máy quét khớp đúng chuỗi mẫu
   đó (dương tính giả — không có mật khẩu thật nào trong repo, đã grep
   toàn repo xác nhận chỉ có đúng 1 chỗ này). Sửa: bỏ chuỗi mẫu khỏi
   báo cáo, viết "URL Postgres có mật khẩu". Chạy lại `test:security` →
   **TẤT CẢ ĐẠT**. Bài học: báo cáo không được viết nguyên văn các mẫu
   bí mật mà máy quét đang tìm (kể cả dạng placeholder).
2. **Mã commit trong báo cáo sai** — đầu báo cáo ghi `c869c6a` nhưng
   commit thực tế lúc bàn giao là `85abd29` (báo cáo viết trước khi
   điều phối viên gom lại). Sửa: bỏ mã commit tự tham chiếu khỏi đầu
   báo cáo (mã commit đổi mỗi lần amend nên không ghi cứng trong file
   của chính commit đó nữa).

**Kiểm sâu về 4 High S11 (để quyết định cổng deploy):**

- Chuỗi phụ thuộc: `prisma@6.19.3 → @prisma/config@6.19.3 →
  deepmerge-ts@7.1.5` (GHSA-ggr8-5vv4-36mx, stack exhaustion) +
  `effect@3.21.0` (GHSA-7589-6fvf-x4pw, ReDoS). Bản sửa duy nhất:
  Prisma 7.10.1 (breaking change).
- **Không có trong bundle chạy trên live:** `.next/standalone/` chỉ
  chứa `@prisma/client` (không có `@prisma/config`, `effect`,
  `deepmerge-ts`); `@prisma/client` không khai báo dependencies nào;
  chuỗi `prisma/config` duy nhất trong bundle là metadata package.json
  nhúng trong `runtime/library.js`, không phải code được nạp.
- **Không tới được từ request:** hai lỗi nằm ở bộ nạp file cấu hình
  của Prisma CLI (lúc build/migrate), không nằm trên đường xử lý HTTP;
  kẻ ngoài không có cách nào đưa input vào đó nếu không có quyền ghi
  repo.
- **Lưu ý về metadata lockfile:** `package-lock.json` KHÔNG đánh dấu
  `prisma` là dev (`dev: undefined`) dù `package.json` để nó ở
  devDependencies — đó là lý do `npm audit --omit=dev` vẫn báo 4 High.
  Chưa sửa metadata này (sửa chỉ để audit xanh sẽ là lách cổng) — để
  Claude quyết có sửa metadata hay không, tách khỏi quyết định deploy.
- **So sánh rủi ro:** live hiện chạy `6e4a514` — code cũ có cùng 4 High
  này CỘNG thêm các lỗ hổng Ngày 17 đã sửa (tra cứu lộ đủ SĐT — High,
  ReDoS Markdown — High, chưa có CSP, chưa có idle 30 phút). Giữ
  nguyên không đẩy thì shop live vẫn ở trạng thái rủi ro hơn là đẩy.
  Đề xuất của Pi Em: **đẩy kèm ngoại lệ S11 có ghi lý do** (build-time
  only, không tới được từ runtime, không có trong bundle live), và mở
  đợt riêng nâng Prisma 7 có kiểm thử đầy đủ. Quyết định cuối thuộc về
  Claude (người đặt cổng).
