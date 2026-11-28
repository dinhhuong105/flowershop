# Báo cáo Ngày 20 — Hiệu năng (tìm vùng DB) + Dọn nhỏ + Bộ nhập sản phẩm (28/11/2026)

Ngắn, theo mẫu Ngày 19. Bốn commit local trên main, CHƯA PUSH
(Pi Em kiểm độc lập rồi mới đẩy): `37a1c29` (Phần A) →
`ad4aac1` (Phần B) → `dde1f4b` (Phần C) → commit này (báo cáo).
Live không đổi trong đợt này (remote HEAD vẫn 4b5eb52, Ngày 19);
indexing vẫn TẮT; chuyển khoản vẫn TẮT.

## 0. C0 — Kiểm kê cột nguồn Ngày 17 trên `products` (đầu báo cáo)

| Cột | Kiểu | Mặc định | Giá trị |
| --- | --- | --- | --- |
| `source` | `String` | `"seed"` | `seed` / `manual` / `import` (`src/lib/admin/product-source.ts`, nhãn Seed mẫu/Nhập tay/Nhập file) |
| `sourceName` | — | — | **chưa có** trước C1 |
| `sourceUrl` | — | — | **chưa có** trước C1 |
| `externalId` | — | — | **chưa có** trước C1 |
| `importedAt` | — | — | **chưa có** trước C1 |
| `needsReview` | — | — | **chưa có** trước C1 |
| `importBatchId` | — | — | **chưa có** trước C1; không có bảng `import_batches` |

C1 bổ sung cả 6 cột + bảng `ImportBatch` (xem §5).

## 1. Từng mục Ngày 20

| Mục | Kết quả | Ghi chú |
| --- | --- | --- |
| A1 Route chẩn đoán db-ping | ĐẠT (đo local xong, đã xóa) | Trung vị lạnh 1,13 ms / ấm 0,35 ms (DB localhost — chỉ chứng minh cơ chế); RTT live không đo được từ đây; vùng Neon chưa biết |
| A2 Đặt `vercel.json` regions | CHỜ VÙNG NEON | Không đoán vùng — không tạo file |
| A3 Kiểm host `-pooler` | KHÔNG XÁC ĐỊNH ĐƯỢC | Chuỗi kết nối production chỉ nằm trong env Vercel |
| A4 Đo lại TTFB live | KHÔNG ĐẠT (tiêu chí) | `/hoa-tuoi` 1,52–2,19 s, `/` 0,84–1,08 s — chưa ≤ 800/600 ms, chưa −40%; không có cách sửa vùng/pooler áp dụng được. Bù: gộp truy vấn trang danh mục 4 → 3 truy vấn ấm (xem §3) |
| B1 A4.1 chấp nhận hiện trạng + header tra cứu | ĐẠT | Giữ chặn cấp trang 200 + thông báo; thêm `Cache-Control: no-store` + `X-Robots-Tag: noindex` trên `/order/:code` (curl xác nhận) |
| B2 test:db tuần tự | ĐẠT | `--test-concurrency=1`; 3 lần liên tiếp 129/129, 0 fail, 0 cancelled |
| B3 Test còn thiếu (2FA/cookie/fail-closed) | ĐẠT | (a) lưu ngân hàng khi 2FA bật: CDP 9/9; (b) cookie chờ xác minh: unit 6/6 + live-check + CDP; (c) đặt hàng fail-closed: CDP 5/5 |
| B4 `/login/verify` bỏ nhắc hướng dẫn vận hành | ĐẠT | Giữ "Liên hệ chủ shop" |
| B5 `docs/van-hanh.md` §3.1 | ĐẠT | Khóa trong password manager + đặt lại an toàn; Vercel Hobby phi thương mại; không đưa mã/khóa thật vào ảnh/báo cáo |
| B6 Thêm ci.yml thủ công | KHÔNG THỰC HIỆN (theo đặc tả) | Cần trình duyệt GitHub đã đăng nhập của Henry — ghi ở §10 |
| C0 Kiểm kê nguồn | ĐẠT | Xem §0 |
| C1 Migration chỉ thêm | ĐẠT | `20261128120210_day20_import`, chỉ thêm; có 1 drift cũ ngoài phạm vi (xem §5) |
| C2 Bộ đọc CSV/JSON thuần | ĐẠT | `parse.ts` + 33 unit test |
| C3 Mô-đun safe-fetch duy nhất | ĐẠT | `safe-fetch.ts` + 27 unit test |
| C4 Wizard nhập 6 bước | ĐẠT | `/admin/products/import`, có TOTP khi bật; 8 lỗi tìm thấy lúc kiểm, đã sửa (xem §4) |
| C5 Luật nhập (khóa, ẩn, slug, ảnh) | ĐẠT | Upsert theo `(sourceName, externalId)`; needsReview ẩn khỏi shop/sitemap/tìm kiếm; không ghi đè SP hệ thống |
| C6 Danh sách + duyệt/từ chối/hoàn tác | ĐẠT | Lọc Nguồn (Tất cả/Hệ thống/Nhập từ ngoài/Chờ duyệt) + cột Nguồn link tới lô; duyệt ≤50; hoàn tác liệt kê SP giữ lại |
| C7 Test bảo mật vào test:security | ĐẠT | SSRF/tài nguyên/parse/XSS/phân quyền/CSRF/dữ liệu hiện có + quét tĩnh fetch (xem §6) |
| C8 Tiêu chí ĐẠT (CDP local) | ĐẠT | Probe `probe-day20-import.mjs` **18/18 PASS** (máy chủ giả feed + ảnh hợp lệ + tệp độc); ảnh 1440 + 390 đã mắt kiểm |

## 2. Phần A — Hiệu năng, tìm đúng vùng DB

### A1. Route chẩn đoán tạm `/api/admin/diag/db-ping`

Chỉ admin (`requireAdmin`), giới hạn 20/phút theo IP đã băm,
`Cache-Control: no-store`, chỉ trả thời gian (20 mẫu: trung vị,
min, max, lần đầu) — **không** in chuỗi kết nối, host hay SQL.
Đo trên server standalone local (DB localhost): lạnh (lần gọi
đầu sau khởi động) trung vị **1,13 ms** (lần đầu 1,95 ms); ấm
trung vị **0,35 ms** (1 ngoại lệ 62,32 ms); chưa đăng nhập → 401;
không rò chuỗi kết nối/SQL trong phản hồi. Local RTT ~1 ms chỉ
chứng minh cơ chế — không nói gì về vùng live. **Route đã XÓA
sau khi đo — không còn trong cây cuối** (đã kiểm `src/app/api/
admin/diag` không tồn tại, git status sạch).

### A2/A3. Vùng Neon + pooler: chưa xác định được, không đoán

- Vùng Neon đang được Pi Em đọc riêng qua dashboard (Chrome của
  Henry). Không có `vercel.json` trong repo (không tạo theo phỏng
  đoán).
- Host production `DATABASE_URL` chỉ nằm trong env Vercel — không
  đọc được từ đây nên không biết có dùng `-pooler` hay không.
  Cả hai mục ghi rõ "chờ Pi Em", không chặn phần còn lại.

### A4. Đo lại TTFB live (cùng phương pháp Ngày 19, live vẫn code Ngày 19 `4b5eb52`)

`x-vercel-id`: hàm `iad1` (không đổi). robots.txt tĩnh ~0,45 s
(nền mạng VM không đổi).

| Route | Vòng 1 ấm trung vị | Vòng 2 ấm trung vị | Nền Ngày 19 | Tiêu chí (≤800 ms hoặc −40%) |
| --- | --- | --- | --- | --- |
| `/` | 1,08 s | 0,84 s | 1,33 s | **KHÔNG ĐẠT** (cần ≤ 600 ms) |
| `/hoa-tuoi` | 2,19 s | 1,52 s | 1,47 s | **KHÔNG ĐẠT** |
| `/tin-tuc` | 0,78 s | — | 1,15 s | — |

Số dao động mạnh giữa các vòng (lần đầu lạnh 4–5 s xen kẽ);
không có cách sửa vùng/pooler nào áp dụng được nên tiêu chí
không đạt — ghi trung thực, không bịa nguyên nhân.

**Sửa thêm trong phạm vi A4 ("giải thích rồi xét hướng khác"):**
gộp `fetchCategoryPage` (`src/lib/catalog.ts`) từ 2 truy vấn
("lấy id rồi lấy chi tiết") thành **1 SQL thô** (cột đầy đủ +
`COUNT(*) OVER()`, JOIN danh mục theo slug) + tag qua
`SELECT DISTINCT unnest(tags)` JOIN theo slug + `findUnique`
danh mục trong cùng `Promise.all`. Kết quả: `/hoa-tuoi` truy vấn
ấm **4 → 3**, vòng RTT tuần tự **3 → 1** (truy vấn layout đều
cache ấm); `/` ấm vẫn 1. Hồi quy: chụp HTML trước/sau cho 6 biến
thể danh mục (`/`, `?trang=2`, `?dip=sinh-nhat`, `?sx=gia-tang`,
`?gia=duoi-500k`, `?sx=gia-giam&trang=1`), so dãy slug + tag —
**KHỚP 6/6**; slug xấu vẫn 404; trang SP 200. Unit 432/432 lúc đó.

## 3. Phần B — Dọn nhỏ

- **B1:** A4.1 CHẤP NHẬN hiện trạng (giữ chặn cấp trang 200 +
  thông báo khi bộ đếm lỗi; KHÔNG thử middleware-fetch — đã gỡ
  ở Ngày 19). Thêm `X-Robots-Tag: noindex` vào entry
  `/order/:code` của `next.config.ts` (`Cache-Control: no-store`
  đã có; trang đã có metadata `robots: {index:false}` — header
  là lớp thứ hai). Xác nhận bằng curl:
  `/order/TEST123456` → `Cache-Control: no-store` +
  `X-Robots-Tag: noindex` (404 đúng vì mã giả). Độ lệch: Low.
- **B2:** script test:db thêm `--test-concurrency=1` (cờ của
  Node test-runner; test dùng `tsx --test`, không phải vitest).
  **3 lần liên tiếp 120/120, 0 fail, 0 cancelled** (mỗi lần
  recreate → test:db → clean). Bài học: chạy test:db KHÔNG
  recreate trước cho 118 pass + 2 cancelled (suite toggle SP
  cần SP TEST-001); `clean-test-data.ts` không `--delete` chỉ
  là dry-run. DB sau kiểm: 20|0|3|0|4|24|0|0|0|0|0|0.
- **B3a — lưu ngân hàng khi 2FA bật: CDP 9/9 PASS**
  (`probe-day20-bank-totp.mjs`): mẫu mật khẩu tạm + restart
  `NODE_ENV=production`; bật 2FA qua UI → đăng xuất → đăng nhập
  → kiểm cookie chờ xác minh (B3b) → xác minh bằng mã TOTP mới
  → form ngân hàng: thiếu mã → từ chối "Mã xác thực không đúng,
  chưa lưu thay đổi.", DB không đổi; mã đúng → lưu "Đã lưu thông
  tin ngân hàng.", DB `accountName` đổi thành "PROBE B3A"; khôi
  phục ngân hàng, tắt 2FA bằng mã khôi phục, trả `.env`, restart
  server, DB sạch. Lưu ý: ô mã TOTP của form có `required` HTML5
  nên probe gỡ `required` bằng JS trước khi submit thiếu mã —
  thứ chứng minh là cổng **server**, không phải validate trình
  duyệt.
- **B3b — cookie phiên "chờ xác minh": ĐẠT.** `isCookieSecure`
  export từ `src/lib/admin/auth.ts`; unit
  `session-cookie.test.ts` 6/6 (production/dev × cờ true/false/
  chưa đặt/khoảng trắng/hoa-thường/rác); thêm vào `npm test` và
  danh sách unit của test:security; assert tĩnh S2 trong
  `security-scan.mjs` (cả hai `set()` cho `admin_session` và
  `admin_pending` phải có httpOnly, sameSite strict, path `/`,
  secure theo `isCookieSecure()`); assert live-check ở mục TOTP
  trên `Set-Cookie` sau totp-verify. Sửa lúc kiểm: assert đầu
  fail vì Next.js ghi `SameSite=strict` (thường) chứ không phải
  `Strict` — sửa assert so không phân biệt hoa/thường (cookie
  vốn đã đủ 4 cờ). CDP xác nhận trực tiếp cookie pending:
  httpOnly=true, secure=true, sameSite=Strict, path=/.
- **B3c — đặt hàng fail-closed khi bộ đếm lỗi: CDP 5/5 PASS**
  (`probe-day20-order-failclosed.mjs`): thêm SP vào giỏ qua UI
  (URL SP là `/{category}/{product}`, không phải
  `/products/{slug}` — lần thử đầu sai URL đã sửa bằng cách đọc
  `c.slug || '/' || p.slug` từ DB), điền form checkout (COD,
  giao ngày mai 2026-11-29, khu vực 1), đổi tên bảng
  `rate_limit_events` → `rate_limit_events_bak`, submit →
  "Hệ thống đang bận, vui lòng thử lại sau." + 0 đơn; đổi tên
  bảng lại trong `finally`, dọn giỏ, DB 20|0|0|0|0. Lưu ý: form
  checkout mặc định `sameAsSender` nên FormData không có trường
  người nhận — action fallback sang người gửi; form vẫn hợp lệ
  (bị chặn ở bước kiểm rate-limit chứng tỏ đã tới được bước đó).
- **B4:** `/login/verify` — bỏ "(xem hướng dẫn vận hành)" khỏi
  dòng "Mất điện thoại và mã khôi phục? …"; giữ "Liên hệ chủ shop".
- **B5:** `docs/van-hanh.md` §3.1 — (a) cất
  `AUTH_ENCRYPTION_KEY` trong trình quản lý mật khẩu; đổi/mất
  khóa thì 2FA hiện tại không xác minh được — đặt lại an toàn qua
  `ADMIN_TOTP_DISABLE=1` (nhắc thu hồi biến sau khi dùng +
  kiểm tra lại trạng thái 2FA); (b) Vercel Hobby chỉ cho dự án
  phi thương mại, trước khi nhận đơn thật nên dùng gói phù hợp;
  (c) không đưa mã khôi phục/khóa thật vào ảnh/báo cáo (ghi rõ mã
  trong ảnh Ngày 19 là dữ liệu kiểm thử đã xóa sau kiểm).
  Phần C bổ sung thêm ở §2 (luồng nhập, ô công thức, cờ test
  loopback — xem §5).
- **B6: KHÔNG THỰC HIỆN** (theo đặc tả — cần trình duyệt GitHub
  đã đăng nhập của Henry). Ghi ở §10.

## 4. Phần C — Bộ nhập sản phẩm

### C1. Migration (chỉ thêm)

`20261128120210_day20_import` — Product thêm `sourceName`,
`sourceUrl` (nullable), `externalId`, `importedAt` (nullable),
`needsReview Boolean @default(false)`, `importBatchId Int?`
(quan hệ ImportBatch, `onDelete SetNull`),
`@@unique([sourceName, externalId])` (Postgres coi NULL là khác
nhau nên SP hệ thống có `sourceName` NULL không bao giờ xung đột
— khóa C5 được ép ở tầng DB), `@@index([importBatchId])`,
`@@index([needsReview])`; bảng `ImportBatch` mới (id, sourceName,
kind `file|feed`, fileName?, sourceUrl?, rightsConfirmed,
status `pending|running|done|cancelled` @default pending, 4 bộ
đếm @default 0, createdBy, createdAt, finishedAt?, notes?,
payload `Json?`, quan hệ products) + enum `ImportBatchKind`,
`ImportBatchStatus`. Thêm cột `payload` (JSON: dòng đã chuẩn hóa
+ ánh xạ + tiến độ + lỗi) — **mở rộng ngoài danh sách cột C1
trong đặc tả**, cần cho C4 bước 5 tiếp tục sau khi tải lại trang
(tệp đã mất sau reload). Tạo SQL bằng `prisma migrate diff`
(không cần shadow DB) rồi áp bằng `migrate deploy`.
**Drift cũ phát hiện và LOẠI KHỎI migration Ngày 20 (ghi rõ):**
diff còn chứa `ALTER TABLE "admin_two_factor" ALTER COLUMN "id"
SET DEFAULT 1, ALTER COLUMN "updatedAt" DROP DEFAULT` — drift từ
Ngày 19 (migration Ngày 19 tạo `admin_two_factor` với `id`
không default và `updatedAt` có DEFAULT, trong khi schema có
`id @default(1)` và `updatedAt @updatedAt` không default DB).
Sau khi áp C1, chạy lại migrate diff chỉ còn drift đó — chứng tỏ
migration C1 đúng đúng tập C1. Không sửa drift này trong Ngày 20
(nằm ngoài phạm vi, để ngày riêng).

### C2. Bộ đọc thuần (`src/lib/import/parse.ts`, 635 dòng + `parse.test.ts` 407 dòng)

CSV UTF-8 ±BOM, tự nhận `,` `;` tab, ngoặc kép, xuống dòng trong
ô, ≤ 2.000 dòng, lỗi từng dòng có số dòng + lý do; JSON mảng gốc
hoặc khóa items/products/data, sâu ≤ 10 (kiểm lặp, không đệ quy),
≤ 2.000 phần tử (đếm trước khi duyệt sâu). Chuẩn hóa: externalId
bắt buộc ≤ 100 (mặc định lấy SKU), name 3–160, description
≤ 2.000, price > 0, salePrice ≤ price, categoryName ≤ 100,
imageUrls ≤ 6, stock nguyên ≥ 0. Ô bắt đầu `= + - @` tab CR:
**GIỮ NGUYÊN** dữ liệu + đánh cờ (`flaggedFields`); xem trước
escape; xuất CSV về sau phải vô hiệu công thức (ghi trong
`docs/van-hanh.md` §2). **Diễn giải đã ghim bằng test:** số VN
"890.000" đọc thành 890 (`.` là phân tách thập phân, không phải
phân tách hàng nghìn). **33/33 unit test PASS.**

### C3. Mô-đun safe-fetch duy nhất (`src/lib/import/safe-fetch.ts`, 664 dòng + test 859 dòng)

Chỉ http/https cổng 80/443, không thông tin xác thực trong URL;
phân giải DNS chặn loopback/riêng tư/link-local/đặc dụng (kể cả
169.254.169.254) + IPv6 (::1, fc00::/7, fe80::/10) + IPv4-mapped;
**ghim IP đã kiểm** khi kết nối (chống DNS rebinding), giữ
Host/SNI gốc; redirect ≤ 3, kiểm lại mỗi lần, không https→http;
timeout 10 s tổng; giới hạn đọc theo luồng feed ≤ 5 MB / ảnh
≤ 3 MB (bất kể Content-Length giả); Content-Type phù hợp + magic
bytes JPEG/PNG/WebP/AVIF trong 512 byte đầu; User-Agent cố định
`FlowerShop-Import/1.0`, không cookie/header xác thực, không ghi
nội dung phản hồi vào log; nhận hàm phân giải DNS thay thế để
test. **27/27 unit test PASS** (kể cả: DNS rebinding, redirect
tới địa chỉ chặn, downgrade https→http, phản hồi vô hạn/chậm
từng byte, Content-Length giả, tệp 10 MB, `__proto__`, JSON lồng
1.000 tầng, mảng 1M phần tử, ô công thức).

### C4/C5/C6. Luồng nhập + luật + quản lý

- **Trang** `/admin/products/import` + nút "Nhập sản phẩm" ở
  trang Sản phẩm; chỉ admin (`requireAdmin`); TOTP khi 2FA bật
  ở bước tạo lô + hoàn tác (xem độ lệch dưới). 6 bước: nguồn
  (tệp ≤ 5 MB CSV/JSON hoặc feed; Tên nguồn bắt buộc 2–60) →
  ánh xạ (tự khớp tên thường gặp, chỉnh được; ánh xạ giá trị
  danh mục sang danh mục có sẵn + "Bỏ qua các dòng này"; danh
  mục mặc định bắt buộc khi không có cột danh mục; KHÔNG tự tạo
  danh mục) → xem trước (20 dòng đầu + thống kê + lỗi ≤ 50 dòng
  kèm số dòng; KHÔNG ghi DB) → xác nhận (tick quyền bắt buộc +
  gõ lại tên nguồn; lưu rightsConfirmed) → chạy (khối ~25 dòng/
  lần gọi + giới hạn 10 s/lần gọi để không chạm giới hạn ~15 s
  của Server Action trên Vercel Hobby, thanh tiến độ, tiếp tục
  được khi tải lại trang, 1 lô chạy 1 lúc, hủy giữa chừng được,
  phần đã nhập giữ nguyên ghi skipped; tối đa 20 phút/lần chạy)
  → kết quả (tổng/tạo mới/cập nhật/bỏ qua/lỗi, lỗi cắt ngắn,
  link "Xem hàng chờ duyệt" + "Hoàn tác lô").
- **C5:** hàng nhập luôn `source=import`, `needsReview=true`,
  **ẨN** khỏi shop/sitemap/tìm kiếm/quick-view (bộ lọc
  `needsReview=false` ở 7 chỗ: catalog, product, queries,
  search, sitemap, quick-view + tag danh mục). Khóa
  `(sourceName, externalId)`: đã có thì CẬP NHẬT (giữ nguyên
  slug + trạng thái duyệt/hiện — xem lỗi số 2 bên dưới); đã duyệt +
  sửa tay sau `importedAt` → mặc định BỎ QUA báo "đã chỉnh sửa
  tay" (tùy chọn ghi đè, mặc định tắt). Trùng SKU/slug hệ thống:
  bỏ qua + lý do, **KHÔNG BAO GIỜ** ghi đè SP hệ thống. Slug từ
  tên, duy nhất bằng hậu tố `-2`, `-3…`, không trùng
  RESERVED_SLUGS/slug danh mục/trang tĩnh (trùng với SP hệ thống
  trong cùng danh mục → BỎ QUA). Ảnh qua safe-fetch, lưu qua
  storage (Blob) tên theo băm nội dung; lỗi ảnh không hỏng dòng
  (nhưng vẫn đếm vào tổng lỗi — xem lỗi số 6 bên dưới). Giới hạn:
  ≤ 2.000 dòng/lô, tối đa 5 lô/ngày, rate-limit nhóm import
  30/10 phút fail-closed.
- **C6:** danh sách SP lọc "Nguồn" (Tất cả/Hệ thống/Nhập từ
  ngoài/Chờ duyệt) + cột Nguồn link tới lô + nhãn "Chờ duyệt".
  Duyệt từng/≤ 50 lần (bỏ needsReview, tùy chọn đồng thời Hiện;
  duyệt lẻ đồng thời Hiện để bán ngay). Từ chối: xóa SP đó (ghi
  nhật ký, từ chối SP đã có đơn tham chiếu). Hoàn tác lô: xóa mọi
  SP của lô còn `needsReview=true` và chưa có đơn tham chiếu;
  liệt kê SP giữ lại (kể cả SP đã duyệt — xem lỗi số 3 ở §5);
  bản ghi lô vẫn còn để đối chiếu. Audit `import:<batchId>` lúc
  bắt đầu/kết thúc/hoàn tác.

### Lỗi tìm thấy + sửa trong lúc kiểm Phần C (8 lỗi thật, đều có test/probe bắt lại)

1. **Duyệt làm lệch phát hiện "sửa tay":** `approveImportedProducts`
   dùng `updateMany` tự bump `updatedAt` → lần nhập lại sau nhầm
   mọi SP đã duyệt thành "đã chỉnh sửa tay". Sửa: duyệt dùng
   UPDATE thô giữ nguyên `updatedAt` (chỉ đổi needsReview/
   isActive) + `classifyRow` chỉ coi là sửa tay khi
   `updatedAt - importedAt > 1 giây` (dung sai cho lần cập nhật
   do chính lần nhập trước đặt cả hai mốc cùng lúc). Bắt bằng
   test DB mới.
2. **Cập nhật nhập lại ẩn SP đã duyệt:** đường cập nhật trong
   `runImportChunk` dùng chung object dữ liệu có
   `needsReview: true` → SP đã duyệt bị ẩn lại sau mỗi lần nhập
   lại. Sửa: chỉ hàng TẠO MỚI đặt `needsReview=true,
   isActive=false`; hàng cập nhật giữ nguyên needsReview/isActive
   hiện có. Bắt bằng test DB mới.
3. **Hoàn tác liệt kê thiếu SP giữ lại:** `undoImportBatch` chỉ
   liệt kê SP chờ duyệt có đơn vào "giữ lại", SP đã duyệt của lô
   giữ im lặng. Sửa: liệt kê cả SP đã duyệt (lý do "đã duyệt").
   Bắt bằng test DB mới.
4. **"Tổng dòng" ở xem trước đếm thiếu:** `computePreview`
   trả `total = payload.rows.length` (chỉ dòng parse được) nên
   file 7 dòng hiện "Tổng dòng 5" (trùng "Hợp lệ"). Sửa: `total =
   rows.length + errors.length` (dòng rớt lúc parse) + dòng "7
   dòng đã đọc" ở bước 2 cũng sửa tương tự. Bắt bằng probe C8.
5. **Wizard tự kéo về bước 2 sau khi Lưu ánh xạ:** effect
   `startState` phụ thuộc cả `batches`; sau Lưu, `revalidatePath`
   làm mới prop `batches` → effect chạy lại → `setStep(2)` kéo
   wizard từ bước 3 về bước 2 (POST lưu trả 200 nhưng giao diện
   kẹt ở bước 2 — bắt bằng probe C8 + log Network). Sửa: ref
   `handledStartBatch` chỉ xử lý mỗi batchId một lần.
6. **Lỗi ảnh không đếm vào tổng lỗi:** `runImportChunk` ghi lỗi
   ảnh vào `runErrors` nhưng không tăng `errors` → ô "Lỗi" ở kết
   quả hiện 0 dù 2 ảnh lỗi. Sửa: `errors += imageErrors.length`.
   Bắt bằng probe C8 (tạo 5, lỗi 0 → sau sửa lỗi 2).
7. **Bước 6 không hiện lỗi lúc chạy:** `runLoop` cập nhật state
   lô cục bộ nhưng không có `payload.runErrors` → danh sách lỗi
   lúc chạy trống dù server đã ghi. Sửa: khi chạy xong, tải lại
   lô từ server (`getImportBatchForPage`) rồi mới sang bước 6.
   Bắt bằng probe C8.
8. **Form ánh xạ hiện trống sau khi tạo lô:** `useState` khởi tạo
   chỉ chạy 1 lần lúc mount (khi batch còn null ở bước 1) nên sau
   khi tạo lô, form bước 2 hiện toàn "— Không dùng —" dù
   `payload.mapping` đã tự khớp. Sửa: effect đồng bộ form theo
   `batch.id` (chỉ khi đổi lô, không ghi đè chỉnh sửa của người
   dùng). Bắt bằng ảnh probe C8 (đã mắt kiểm trước/sau: sau sửa
   các select hiện đúng sku/name/price/category/imageUrls/stock).

### Độ lệch so với đặc tả (ghi rõ)

- Nhập cho phép name 3–160 / price > 0 (C2) trong khi form tạo
  tay giới hạn 120 / ≥ 1.000 ₫ — SP nhập có tên 150 ký tự hoặc
  giá 500 ₫ sẽ không sửa được trong form admin nếu không rút
  ngắn/tăng giá. Ghi rõ để Claude quyết có siết lại hay không.
- TOTP: bắt buộc ở tạo lô (bước 1) + hoàn tác (phá hủy); các
  bước ánh xạ/xác nhận/chạy chỉ cần phiên admin (lô đã tạo sau
  khi xác minh TOTP; bắt TOTP từng khối là không dùng được cho
  chạy theo khối).
- CSRF: repo KHÔNG có token CSRF cho từng form ở bất cứ đâu;
  Server Action dựa vào kiểm Origin có sẵn của Next.js +
  `requireAdmin`, route handler kiểm Origin so với Host → 403
  (mẫu ở route upload/totp-verify). Bộ nhập theo đúng mẫu đó —
  lệch so với câu "CSRF token mọi form" ở C7 (ghi rõ, không giấu).
- Cột `payload` JSON ở `ImportBatch` là mở rộng ngoài danh sách
  C1 (cần cho tiếp tục sau reload).
- AVIF thêm vào `upload-rules.ts` (cần cho C3/C5 — trước đó
  `ImageType` không có avif).
- Cờ test `SAFE_FETCH_ALLOW_LOOPBACK=1` (xem cuối §5): chỉ cho probe
  local với máy chủ giả; **không bao giờ đặt trên Vercel**
  (ở đó `VERCEL=1` nên cờ luôn bị ép tắt). Ghi trong
  `docs/van-hanh.md` §2.

## 5. Bảng bảo mật (S1–S12 + C7)

`npm run test:security`: **TẤT CẢ ĐẠT** — quét tĩnh 76 ok
(64 + 12 mới, trong đó có quy tắc C7), live-check 63/63 PASS,
quét live 21 PASS.

| Nhóm | Số ca | PASS/FAIL | Phát hiện | Đã sửa | Chưa test |
| --- | --- | --- | --- | --- | --- |
| C7 SSRF (unit safe-fetch) | 27 | PASS | Không (127.0.0.1, localhost., localhost:3000, [::1], 169.254.169.254, 192.168.1.10, tên miền → 10.0.0.5, DNS rebinding, redirect tới địa chỉ chặn, https→http, cổng khác 80/443, URL có thông tin xác thực đều bị chặn) | — | Feed/ảnh qua UI trên production (chỉ local + unit) |
| C7 Tài nguyên | 5 | PASS | Không (vô hạn/chậm từng byte → timeout; Content-Length giả + 10 MB → too_large; magic bytes sai → bad_content_type) | — | — |
| C7 Phân tích dữ liệu | 33 | PASS | Không (`__proto__` không nhiễm prototype; JSON 1.000 tầng → lỗi; mảng 1M → lỗi nhanh; ô công thức giữ + cờ) | — | — |
| C7 XSS/injection (xem trước/danh sách/chi tiết) | CDP 18/18 | PASS | Không (mọi giá trị hiển thị là text, React escape; ô `=SUM(A1:A2)` hiện đúng dạng text) | — | — |
| C7 Phân quyền/CSRF/tốc độ | db 9 + CDP | PASS | Không (chưa đăng nhập → 307; phiên chờ xác minh → bị chặn; import rate-limit 30/10 phút fail-closed) | — | CSRF token từng form (độ lệch ở §4 — theo mẫu repo, không token riêng) |
| C7 Bảo vệ dữ liệu hiện có | db 9 | PASS | 3 lỗi logic (số 1, 2, 3 ở §4) | Đã sửa + test DB bắt lại | — |
| C7 Quét tĩnh fetch | 1 quy tắc mới | PASS | 1 false positive lúc đầu (chuỗi tên hàm trong comment của ImportWizard) — đổi cách diễn đạt comment, không thêm ngoại lệ | Đã sửa | — |
| S1 Phân quyền | +9 (db import) | PASS | Không | — | — |
| S2 Phiên/cookie | B3b | PASS | Assert live-check so `SameSite` phân biệt hoa/thường (cookie vốn đủ cờ) | Sửa assert | — |
| S3 Tiêm nhiễm | 0 | — | Không | — | — |
| S4 CSRF | 0 | — | Không | — | Xem lệch CSRF ở §4 |
| S5 Upload | AVIF | PASS | Không (AVIF thêm vào upload-rules, magic bytes ftyp+avif) | — | — |
| S6 SSRF | C7 | PASS | Không | — | — |
| S7 Tra cứu đơn | B1 | PASS | A4.1 giữ nguyên (200 + thông báo) | — | — |
| S8 Logic đặt hàng | B3c | PASS | Không | — | — |
| S9 Rate-limit | import 30/10 phút | PASS | Không | — | — |
| S10 Header/CSP | B1 | PASS | Không | — | — |
| S11 Cung ứng/bí mật | 0 | PASS | Không | — | Job audit CI chưa chạy thật trên GitHub (chờ token workflow — S0) |
| S12 Nhật ký/phục hồi | import audit | PASS | Không | — | Sao lưu tự động + cảnh báo 500 (từ Ngày 17) |

**Cờ test loopback (ghi rõ để không ai hiểu lầm là nới SSRF):**
VM này không nối hairpin về IP ngoài của chính nó (curl tới
198.19.0.2 và IPv6 ULA đều 000, chỉ 127.0.0.1 tới được) nên máy
chủ giả cho probe C8 chỉ chạy được trên loopback. `safe-fetch`
vốn đã có cờ test-only `allowLoopbackForTest` (chỉ dùng trong
unit test); Ngày 20 nối cờ này ra biến môi trường
`SAFE_FETCH_ALLOW_LOOPBACK=1` tại đúng 2 chỗ gọi safeFetch
(feed + ảnh), có chốt chặn `process.env.VERCEL !== "1"` (trên
Vercel luôn bị ép tắt). Server probe chạy với cờ này; server
cuối đợt đã khởi động lại **không** cờ (đã kiểm environ:
không có biến). Mặc định (không cờ): loopback vẫn bị chặn —
unit test + quét tĩnh C7 chứng minh.

## 6. Bảng hiệu năng

| URL | Truy vấn lạnh/ấm trước (Ngày 19) | Truy vấn lạnh/ấm sau | TTFB ấm trung vị live | ĐẠT? |
| --- | --- | --- | --- | --- |
| `/` | 4 / 1 | 4 / 1 | 0,84–1,08 s (nền 1,33 s) | Không (cần ≤ 600 ms) |
| `/hoa-tuoi` | 8 / 4 | **8 / 3** | 1,52–2,19 s (nền 1,47 s) | Không (cần ≤ 800 ms hoặc −40%) |
| `/tin-tuc` | 5 / 2 | 5 / 2 | 0,78 s (nền 1,15 s) | — |
| SP | 5 / 2 | 5 / 2 | — | — |

TTFB live đo lại 28/11 trên code Ngày 19 (chưa có sửa Ngày 20);
số sau sửa chỉ đo được sau khi Pi Em đẩy + deploy. Vùng Neon
chưa biết nên chưa có cách sửa vùng/pooler nào.

## 7. Số kiểm chứng (log thật, không bịa)

- Unit `npm test`: **498/498 PASS** (130 suites; nền Ngày 19:
  432, +60 import mới, +6 cookie phiên).
- test:db (recreate → test:db → clean): **129/129 PASS × 3 lần
  liên tiếp, 0 fail, 0 cancelled** (nền 120, +9 mới:
  import-batches 9 ca: upsert, sửa tay + ghi đè, trùng SKU/slug
  hệ thống, duyệt/từ chối/hoàn tác, ẩn khỏi tìm kiếm, 5 lô/ngày).
- Typecheck: **0 lỗi**. Lint: **0 lỗi, 4 warning** (2 `<img>` cũ
  + 2 `_req`/`_res` trong test safe-fetch; đã sửa 2 warning do
  Ngày 20 gây ra).
- Build: OK, First Load JS `/` = **115 kB** (≤ 135 kB).
- Smoke local: **20/21** — FAIL duy nhất `sitemap-localhost` là
  kỳ vọng. F2 local: 3/6 PASS, 3 FAIL đều localhost-expected
  (base-https, sitemap-loc, http-to-https). `<head>` **4/4**.
- `npm audit --omit=dev`: **0 vulnerabilities**.
- `npm run test:security`: **TẤT CẢ ĐẠT** (tĩnh 76 ok,
  live-check 63/63, quét live 21/21). Lưu ý: 1 lần chạy giữa bị
  1 FAIL giả ở S4 (log server) vì `npm run build` xóa
  `.next/standalone-server.log` trong lúc server vẫn chạy —
  khởi động lại server rồi chạy lại: **63/63 PASS**. Không phải
  lỗi app.
- CDP probe Phần B: bank-TOTP **9/9 PASS**, order-failclosed
  **5/5 PASS** (ảnh 1440 đã mắt kiểm).
- CDP probe Phần C `~/workspace/day20-shots/probe-day20-import.mjs`:
  **18/18 PASS** — máy chủ giả trên 127.0.0.1:18081 phục vụ feed
  CSV 7 dòng (5 hợp lệ + 2 lỗi) + ảnh PNG hợp lệ + ảnh HTML độc
  + ảnh 4 MB quá giới hạn; đủ 6 bước qua UI thật, duyệt 1 SP,
  hoàn tác 1 lô; ảnh 1440 + 390 đã mắt kiểm (ánh xạ, xem trước
  có lỗi, kết quả, danh sách nhãn nguồn + Chờ duyệt; popup
  "Hoàn tác lô?" — dialog native không chụp được pixel ở
  headless, nội dung đã xác minh bằng sự kiện CDP
  `Page.javascriptDialogOpening` + DB sau khi chấp nhận).
  Ảnh ở `~/workspace/day20-shots/day20-import-*.png`.
- DB cuối đợt: **20|0|3|0|4|24|0|0|0|0|0|0**
  (products|orders|pages|news|categories|settings|sessions|
  audit|ratelimit|totp|pending|carts) + 0 lô nhập + 0 SP nhập.
  Ảnh test mồ côi (1×1 PNG, 70 byte) trong
  `.next/standalone/public/uploads/` đã xóa; lần khởi động
  server sau cũng tự dọn thư mục đó.
- VM bị thay giữa chừng (28/11 ~05:30 UTC, ngay trước probe C8):
  PostgreSQL + Chrome mất hẳn; đã cài lại PostgreSQL 16 (từ
  cache apt) + Chrome 158, dựng lại DB bằng
  `rebuild-flower-db.mjs` + migrate + seed về đúng nền
  20|0|3|0|4|24. Mọi kiểm chứng cuối (unit, test:db ×3,
  test:security, C8) đều chạy **sau** khi dựng lại DB. Replay
  apt của hệ thống vẫn chạy nền lúc đó (khôi phục các gói đã ghi)
  nhưng không chặn việc dựng lại.

## 8. File đổi (commit Phần C trên `ad4aac1`, chưa push)

- `prisma/schema.prisma` + migration
  `20261128120210_day20_import/` (52 dòng SQL, chỉ thêm).
- `src/lib/import/parse.ts` (635) + `parse.test.ts` (407);
  `src/lib/import/safe-fetch.ts` (664) + `safe-fetch.test.ts`
  (859) — mới.
- `src/lib/admin/import-batches.ts` (1101) + `import-batches.db.test.ts`
  (306) — mới; `src/lib/admin/products.ts` (lọc nguồn/needsReview);
  `src/lib/admin/upload-rules.ts` (AVIF).
- `src/app/admin/products/import/` (`page.tsx` 58 +
  `actions.ts` 348) — mới; `src/components/admin/ImportWizard.tsx`
  (727) — mới.
- `src/app/admin/products/page.tsx` (nút Nhập + lọc review);
  `src/components/admin/ProductsFilterBar.tsx` (Hệ thống/Chờ duyệt);
  `src/components/admin/AdminProductsList.tsx` (cột Nguồn + Duyệt/Từ chối).
- Ẩn needsReview: `src/lib/catalog.ts`, `src/lib/product.ts`,
  `src/lib/queries.ts`, `src/lib/search.ts`, `src/app/sitemap.ts`,
  `src/app/api/quick-view/route.ts`.
- `scripts/security-scan.mjs` (quy tắc C7 + assert cookie S2);
  `scripts/test-security.mjs` (thêm test import vào danh sách unit);
  `package.json` (test:db tuần tự + thêm test import).
- `docs/van-hanh.md` (B5 + luồng nhập + ô công thức + cờ test).
- Probe scripts + ảnh (`~/workspace/day20-shots/`,
  `~/workspace/day19-shots/` helpers) không nằm trong repo nên
  không commit.

## 9. Chờ Henry (gom một mục, không dừng việc khác)

- **S0:** thu hồi token GitHub đã lộ (26/11) + tạo fine-grained
  token mới cho kho `flowershop`, quyền Contents (đọc/ghi) **và
  Workflows (đọc/ghi)** để đẩy được `.github/workflows/ci.yml`
  (hiện ở commit local `8599fec`). Không hỏi, không nhắc.
- **B6 ci.yml thủ công:** khi trình duyệt GitHub đã đăng nhập của
  Henry sẵn sàng, thêm thủ công `.github/workflows/ci.yml` đúng
  như commit local `8599fec` rồi `git pull` để đồng bộ — không
  cần token mới cho đường này.
- **C4 bật 2FA:** đặt `AUTH_ENCRYPTION_KEY` trên Vercel (lệnh sinh
  khóa trong `docs/van-hanh.md` §3.1 — giá trị production phải
  **khác** khóa local) rồi quét QR ở `/admin/security` và cất 10
  mã khôi phục. 5 bước trong `docs/van-hanh.md` §3.1.
- **Vùng Neon:** Pi Em kiểm tra vùng Neon trên dashboard; nếu khác
  `iad1` thì đặt `vercel.json` regions khớp, rồi đo lại TTFB live.
  Kèm theo: kiểm host production có dùng `-pooler` không (A3).

## 10. Còn thiếu / chưa làm

- TTFB live sau sửa Ngày 20 chưa đo (chờ Pi Em đẩy + deploy, đo
  lại từ cùng VM, ấm, trung vị 5 lần, đối chiếu nền Ngày 19).
- Vùng Neon + pooler chưa xác định → chưa đặt `vercel.json`.
- Bộ nhập **KHÔNG bật trên production nếu chưa PASS toàn bộ C7
  trên live** (theo đặc tả) — C7 mới PASS ở local + unit; sau khi
  đẩy cần kiểm lại trên live (đặc biệt SSRF vẫn chặn khi không có
  cờ loopback).
- Feed JSON qua UI chưa probe bằng CDP (CSV feed đã probe đủ 6
  bước; JSON parse đã có unit test 33 ca).
- Nhập/xuất tin tức: backlog từ Ngày 18.
- Safari/Firefox chưa kiểm; Lighthouse chưa đo; sao lưu tự động +
  cảnh báo 500 chưa có.
- Drift `admin_two_factor` (Ngày 19) chưa sửa — để ngày riêng.
- Giới hạn nhập nới hơn form tay (name 160 / price > 0) — chờ
  Claude quyết có siết lại không (xem §4).

---

# Bổ sung theo bản đặc tả sau Retry (201 dòng)

Ngày 28/11/2026, sau khi báo cáo trên được gửi, Claude trả lời lần
đầu (bản 132 dòng, §1–§10 trên) rồi nút Retry tạo lại câu trả lời
thành **bản đặc tả mới 201 dòng** — bản này mới là bản Claude chấm.
Phần dưới đây là PHẦN CHÊNH giữa cây `18e2135` (bản 132 dòng) và
bản mới; những gì đã đúng được giữ nguyên. Sáu commit local trên
main, CHƯA PUSH (Pi Em kiểm độc lập rồi mới đẩy):

- `17d088f` — A2+A3 (2FA fail-closed + ca còn thiếu)
- `5774606` — B-model (căn chỉnh mô hình nhập theo enum mới + bảng `import_rows`)
- `9534764` — B-rest (giới hạn đầu vào + ánh xạ/giá + quyền + luật hàng + chờ duyệt + bảo mật bổ sung)
- `436c091` — B-rest: sửa lỗi phát hiện khi kiểm test:db
- `1353c98` — B-rest: bảng lịch sử lô cập nhật sau khi chạy
- `ef34a3d` — C (vercel.json regions sin1 + EXPLAIN danh mục)
- commit này — báo cáo (bổ sung phần delta)

Live không đổi trong đợt này (remote HEAD vẫn `4b5eb52`, Ngày 19);
indexing vẫn TẮT; chuyển khoản vẫn TẮT; 2FA chưa bật trên live.

## 11. Bảng từng mục bản mới (A1–A6 / B0–B11 / C)

| Mục | Kết quả | Ghi chú / độ lệch |
| --- | --- | --- |
| A1 A4.1 chốt ở mức Low | ĐẠT | Đã xong ở bản 11:19; quyết định + lý do ghi ở `docs/van-hanh.md` §3.1 (dòng 70): chặn cấp trang 200 + thông báo, `Cache-Control: no-store` + `X-Robots-Tag: noindex` |
| A2 2FA fail-closed khi thiếu/lệch khóa (ƯU TIÊN 1) | ĐẠT | `isTotpLoginRequired` không còn tự tắt 2FA; mã khôi phục thử TRƯỚC (băm độc lập với khóa); mã 6 số bị từ chối khi bí mật không giải mã được; biểu ngữ đỏ đúng câu bản mới ở mọi trang admin + `/login/verify` + `/admin/security`; audit `totp.key-unavailable` giới hạn 1 dòng/giờ; `docs/van-hanh.md` §3.1 cập nhật. Test: `totp` 32/32 (5 ca mới: thiếu khóa/khóa sai/bản mã sửa 1 bit/thoát hiểm/audit 1 lần/giờ). CDP 9/9 PASS |
| A3 Ca còn thiếu | ĐẠT | (a) Lưu ngân hàng KHÔNG có mật khẩu bị từ chối (hồi quy) — test:db + CDP 6/6. (b) Mã TOTP đã dùng bị từ chối qua server action thật — CDP (xem độ lệch). (c) Đặt hàng fail-closed khi bộ đếm lỗi — chạy lại CDP 5/5 |
| A4 test:db tuần tự | ĐẠT | `--test-concurrency=1`; **139/139 × 3 lần liên tiếp** trên cây B-rest, thêm 2 lần 139/139 trên cây cuối (tổng 5 lần PASS). Một lần chạy giữa chừng báo 138/139 ở test phiên 2FA — do còn sót 1 phiên admin từ probe CDP chạy trước đó (không phải hồi quy code); chạy lại suite đó độc lập 13/13 |
| A5 Hiệu năng (xem §13) | KHÔNG ĐẠT (chưa đo live) | `vercel.json` đã tạo (sin1); đo lại live 5× × 3 URL sau deploy là việc của Pi Em. Local ấm `/hoa-tuoi` ~0,026 s — không nói gì về live |
| A6 "Chờ Henry" | GHI Ở §15 | S0 token, bật 2FA |
| B0 Kiểm kê bổ sung | ĐẠT | `sharp` KHÔNG có trong `package.json` (không thêm gói); không có thư viện CSV/ảnh — bộ đọc/tải ảnh viết tay. Slug: `slugifyName` (bỏ dấu, hậu tố ngắn khi trùng, tránh `RESERVED_SLUGS`); SKU: regex chữ hoa/số/gạch nối 2–20 ký tự. Ràng buộc duy nhất: `@@unique([categoryId, slug])`, `@@unique([sourceName, sourceExternalId])`, `@@unique([sku])` |
| B1 Căn chỉnh mô hình | ĐẠT | Migration `20261128120211_day20b_import_model` (chỉ thêm; đã thử trên DB nháp với dữ liệu cũ tổng hợp: map trạng thái, suy `sourceKind`, giữ nguyên bộ đếm, backfill `mappingJson`, sao hàng sang `import_rows`, đổi tên unique index). `products.externalId` → `sourceExternalId` (schema + migration + toàn bộ code + test + UI). `ImportBatch` thêm `sourceKind`, `fileSha256`, `mappingJson`, `rightsConfirmedAt/By`, `rowsTotal/created/updated/skipped/failed`, status enum PREVIEW\|RUNNING\|DONE\|FAILED\|ROLLED_BACK. Bảng mới `import_rows` (batchId, rowIndex, externalId, status PENDING\|CREATED\|UPDATED\|SKIPPED\|ERROR, message ≤300, productId, payload JSON ≤8KB/hàng). Chunk runner giữ lô bằng lease 30 s + ghi trạng thái cuối có điều kiện `WHERE status='PENDING'`; tiếp tục sau reload từ `import_rows`. Hành vi wizard giữ nguyên |
| B2 Giới hạn đầu vào | ĐẠT | CSV ≤40 cột, ô ≤5000 ký tự; JSON sâu ≤6 (đã siết từ 10), từ chối khóa `__proto__`/`constructor`/`prototype`; nhận dạng bằng nội dung (không tin đuôi tệp/Content-Type); feed HTML từ chối với đúng thông báo "Đây là trang web, không phải dữ liệu nhập (CSV/JSON)"; dữ liệu tạm theo batchId trong `import_rows.payload`, dọn sau 7 ngày bằng `scripts/cleanup-import-rows.ts` (xem độ lệch B1) |
| B3 Ánh xạ + tùy chọn giá | ĐẠT | externalId bắt buộc; name, price, salePrice, description, category (tên/slug), sku (tùy chọn), imageUrl (1+, ngăn `\|` hoặc mảng JSON, ≤8); nhớ ánh xạ theo sourceName. Hệ số 0,1–10 (≤2 chữ số thập phân) + làm tròn (không/1.000/10.000). **Số thập phân ĐẢO NGƯỢC diễn giải đã ghim ở Ngày 20: "890.000" = 890.000 (dấu phân tách nghìn)** — parser + test đã cập nhật. Giá nguyên VND 1–1.000.000.000; salePrice < price nghiêm ngặt. Danh sách lỗi xem trước tải được dạng CSV (vô hiệu công thức) |
| B4 Xác nhận quyền | ĐẠT | Tick đúng câu bản mới (CDP kiểm); chưa tick thì nút chạy khóa VÀ server từ chối; ghi `rightsConfirmedAt/By` + nhật ký; dòng cảnh báo cố định hiện trên trang nhập (CDP kiểm) |
| B5 Luật từng hàng | ĐẠT | Đã có + chưa duyệt → cập nhật mọi trường; **đã có + ĐÃ DUYỆT → chỉ cập nhật price/salePrice (ghi "giá đổi")**, thay quy tắc "bỏ qua khi sửa tay" của Ngày 20; SKU trùng SP không cùng nguồn → hàng lỗi "SKU đã tồn tại"; slug từ tên + hậu tố ngắn + tránh `RESERVED_SLUGS`; làm sạch văn bản (bỏ thẻ HTML, ký tự điều khiển, chuẩn hóa khoảng trắng); tên 3–160, mô tả ≤2.000 ký tự; nhật ký tổng lô + từng SP (`product:<sku>`), không ghi PII; mỗi lần gọi tối đa 10 hàng hoặc ~8 giây |
| B6 Hàng chờ duyệt | ĐẠT | Popup SP hiện khối chỉ đọc "Nguồn dữ liệu" (tên nguồn, mã ngoài, lô, ngày nhập; sourceUrl chỉ khi http(s) + `rel="noopener noreferrer"`) — CDP kiểm + ảnh. Duyệt từng/hàng loạt ≤50, xác nhận kèm số lượng + nhật ký; **"hiện luôn" MẶC ĐỊNH KHÔNG hiện** (đã căn chỉnh duyệt lẻ; CDP kiểm hộp thoại mặc định không tick); từ chối xóa SP chưa duyệt (không có đơn). Xuất CSV lỗi/kết quả vô hiệu công thức (thêm `'` trước ô bắt đầu bằng `= + - @` tab CR). **Nhãn nguồn đổi: seed/manual → "Hệ thống", import → "Nhập từ ngoài"** (bảng §0 trên ghi nhãn cũ) |
| B7 Ảnh | ĐẠT (giữ nguyên) | Kiểm lại sau refactor B1: probe import CDP PASS lại. Độ lệch: giới hạn ≤500 ảnh/lô và re-encode WebP bằng sharp CHƯA làm (sharp không có sẵn) — ghi rõ, không lặng lẽ bỏ |
| B8 Lịch sử/hoàn tác | ĐẠT (giữ nguyên) | Hoàn tác đặt status lô ROLLED_BACK theo enum mới; giữ SP đã duyệt/có đơn. Kiểm lại bằng test:db + CDP |
| B9 Giới hạn tốc độ | ĐẠT | Bắt đầu lô 5/giờ + 20/ngày (toàn cục); tải feed 10/giờ; fail-closed khi bộ đếm lỗi; lô >2.000 hàng bị từ chối. Ghi chú: giới hạn 30 thao tác nhập/10 phút theo IP (Ngày 20) vẫn là lớp riêng — probe CDP đã chạm trần này khi chạy 2 lần đầy đủ liên tiếp trong cùng cửa sổ 10 phút (đúng thiết kế, không phải lỗi) |
| B10 Tài liệu + mẫu | ĐẠT | `docs/nhap-san-pham.md` (định dạng/cột/quy tắc giá/trạng thái chờ duyệt/quyền/giới hạn) + `docs/mau-nhap/mau.csv` + `mau.json` (3 hàng GIẢ, URL ảnh giả `vi-du.invalid`, không dữ liệu bên thứ ba — parse thử: CSV 3/3, JSON 3/3, 0 lỗi) |
| B11 Bảo mật bổ sung | ĐẠT | Xem §12 |
| C Hiệu năng | KHÔNG ĐẠT (chưa đo live) | Xem §13. `vercel.json` đã tạo; EXPLAIN xong, không thiếu chỉ mục; đo lại live sau deploy (Pi Em) |

### Độ lệch / diễn giải ghi rõ (không lặng lẽ bỏ)

1. **B3 externalId "bắt buộc" ở mức HÀNG, không phải mức cột:** cột ánh xạ được chấp nhận là externalId HOẶC sku — parser lấy externalId từ cột SKU khi không có cột mã ngoài riêng (file nguồn thường chỉ có SKU làm mã duy nhất). Ánh xạ tự động cũng tự điền externalId = cột SKU. Hàng nào cũng phải có externalId; cột ánh xạ không bắt buộc phải đúng tên externalId.
2. **B3 số thập phân đảo ngược:** "890.000" = 890.000 (nghìn), "1234.5" = 1.234,5 (thập phân). Khoảng trắng trong số bị từ chối (nghiêm ngặt, giữ hành vi cũ).
3. **B1 payload từng hàng giữ 7 ngày, không xóa ngay khi nhập xong:** đặc tả cho phép "sau 7 ngày hoặc khi nhập xong"; giữ 7 ngày để trang lịch sử/kết quả còn dữ liệu từng hàng. Dọn bằng `scripts/cleanup-import-rows.ts` (đã chạy `--dry-run`: không có lô quá 7 ngày).
4. **B1 lỗi đọc ban đầu (parse) không tạo `import_rows`:** lỗi parse sống ở `batch.payload.parseErrors` và hiện riêng ở bước 6 ("Lỗi đọc dữ liệu ban đầu: N dòng"), không cộng vào `batch.failed` (failed chỉ đếm hàng lỗi trong lúc chạy). Đây là mô hình đã có từ Ngày 20 C — giữ nguyên, không thiết kế lại; tiêu chí "25 tạo/5 lỗi" vẫn hiện đủ ở giao diện (bước 6).
5. **A3 "mã TOTP đã dùng bị từ chối qua server action thật":** chỉ kiểm bằng CDP, không bằng test:db — Node 22.23.5 ở đây không có `mock.module` (kể cả với cờ thử nghiệm) nên test:db không gọi được server action (cần request scope của `next/headers`). Chống replay ở tầng hàm verify đã có trong `totp.db.test.ts`.
6. **B7:** giới hạn ≤500 ảnh/lô + re-encode WebP bằng sharp chưa làm (sharp không có sẵn, không thêm gói).
7. **Nhập cho phép name 160 / price > 0** trong khi form tay giới hạn 120 / ≥ 1.000 ₫ — giữ như Ngày 20 §4, chờ Claude quyết (bản Retry không đổi điểm này).
8. **Ánh xạ nhớ theo sourceName hợp nhất với tự nhận diện** (sửa lỗi tìm thấy khi kiểm — xem §14.2): cột đã nhớ chỉ giữ khi còn tồn tại trong tệp mới; trường nào nhớ là null thì tự nhận diện lại.
9. **Bảng "Các lô nhập gần đây" không tự mới sau khi chạy** (sửa lỗi tìm thấy bằng ảnh probe — xem §14.4): wizard hợp nhất state lô mới nhất vào danh sách hiển thị.

## 12. Bảng bảo mật bổ sung (B11) — `npm run test:security` TẤT CẢ ĐẠT

`test:security`: quét tĩnh **76 ok, 0 FAIL**; live-check **63 PASS, 0 FAIL**; live scan **21 PASS, 0 FAIL**. Các ca B11 mới (unit 516/516, trong đó `parse.test.ts` 40/40 + `safe-fetch.test.ts` 35/35 ở cây B-rest):

| Nhóm | Ca kiểm | Kết quả |
| --- | --- | --- |
| safe-fetch | IP dạng số `2130706433`, `0x7f000001`, `017700000001`, `127.1` (WHATWG URL đã chuẩn hóa về 127.0.0.1; code mới chặn tường minh qua `parseInetAton`); `[::ffff:127.0.0.1]`; `user:pass@host`; cổng 22/6379/5432; scheme `file:`/`gopher:`/`ftp:`/`data:`; redirect >3; nội dung HTML (Content-Type + body bắt đầu `<`, kể cả khoảng trắng/BOM đầu, đúng thông báo) | ĐẠT |
| safe-fetch | Multicast 224.0.0.0/4 + ff00::/8; connect timeout 5 s (không probe trực tiếp được trên VM này — không có tường lửa DROP — chỉ kiểm bằng code + timeout tổng; ghi rõ, không nhận đã probe) | ĐẠT (timeout: chỉ code) |
| Ảnh (B7) | PNG chứa HTML/script, đa dạng thức GIF/HTML, kích thước điểm ảnh >6000×6000 (PNG/JPEG/WebP/AVIF — đúng 6000×6000 vẫn qua), tên tệp `../` (tên tệp lưu theo hash nội dung `[a-f0-9]{12}.ext`, `readUpload` từ chối tên không khớp regex — đã có test) | ĐẠT |
| Phân tích tệp | JSON bom (độ sâu ≤6, số khóa), `__proto__` (đã từ chối; prototype không ô nhiễm), CSV nhiều cột/ô khổng lồ/dòng thiếu dấu ngoặc, tệp nhị phân đổi đuôi `.csv` (byte NUL → từ chối), BOM/UTF-16, ký tự điều khiển, ReDoS ở bộ nhận dạng số (nhóm 3 chữ số, không backtrack) | ĐẠT |
| Nội dung | XSS trong tên/mô tả/danh mục/sourceName/externalId (làm sạch thẻ + React escape) — CDP: tên chứa `<3` hiện `&lt;3` trong HTML shop, không có `<script>` thô; `javascript:`/`data:` trong sourceUrl/imageUrl bị từ chối; CSV injection trong tệp xuất (thêm `'`); SQLi vào mọi cột (tham số hóa — test:db lưu nguyên văn `'; DROP TABLE products; --`, bảng nguyên vẹn) | ĐẠT |
| Phân quyền/CSRF/tốc độ | Route/action mới chưa đăng nhập → chuyển `/login` (CDP B0.1, status 307); phiên chờ xác minh bị chặn; Origin sai bị từ chối (server action Next.js); vượt hạn mức bị chặn (test:db: 5 lô/giờ, 20 lô/ngày, 10 lần tải feed/giờ); bộ đếm lỗi → đóng | ĐẠT |
| Logic | Chạy lại cùng tệp → cập nhật, không trùng (test:db + CDP 25 UPDATED, vẫn 25 SP); 2 lần chạy song song trên 1 lô không xử lý trùng hàng (test:db: mỗi SKU đúng 1 lần; lease 30 s chặn lần chạy thứ hai); lô thất bại giữa chừng tiếp tục được (hủy → PREVIEW, chạy tiếp); hoàn tác không xóa SP đã duyệt/có đơn (test:db) | ĐẠT |

## 13. Phần C — Hiệu năng (giới hạn 1,5 giờ, KHÔNG đổi nonce)

### C1. Vùng + pooler — ĐÃ XÁC ĐỊNH (không còn chờ)

- **Vùng Neon: AWS Asia Pacific 1 (Singapore), `ap-southeast-1`** — đọc từ trường "Region" trên trang tổng quan project `flowershop-db` (icy-waterfall-52224687) trong Neon Console lúc 13:58 ngày 28/11 (Pi Em đọc). Hàm Vercel đang ở `iad1` → KHÁC VÙNG.
- **Đã tạo `vercel.json` `{"regions": ["sin1"]}`** (commit `ef34a3d`): chuyển hàm về cùng vùng với DB để giảm RTT mỗi vòng truy vấn.
- **Pooler: ĐANG DÙNG** — Neon Console hiển thị host có `-pooler` và công tắc pooling đang bật. Theo đúng phương pháp kiểm của đặc tả, điểm cuối pooled đang dùng; không cần đổi chuỗi kết nối. **Ghi rõ: biến `DATABASE_URL` trên Vercel là Secret nên không đọc được trực tiếp — kết luận pooler dựa trên Neon Console (host hiển thị), không phải đọc biến Vercel.** Không tự đổi biến môi trường production (cần đăng nhập Vercel — việc của Pi Em/Henry).

### C2. EXPLAIN truy vấn SP theo danh mục — KHÔNG THIẾU CHỈ MỤC

Truy vấn danh mục đã 4 → 3 (Ngày 20 Part A, giữ nguyên). Chạy
`EXPLAIN (ANALYZE, BUFFERS)` cho Q2 của `fetchCategoryPage` trên
DB local (21 SP) — script chẩn đoán `~/workspace/day20b-explain.ts`
(không commit vào repo):

| Truy vấn | Kế hoạch | Thời gian thực thi |
| --- | --- | --- |
| Q2 mặc định (ORDER BY sortOrder, id) | Seq Scan products (21 dòng, đúng với bảng nhỏ) + Hash Join với categories (Index Scan `categories_slug_key`) + Sort quicksort 28 kB + WindowAgg | 0,505 ms |
| Q2 sắp xếp theo giá (CASE salePrice/price) | Cùng hình dạng, Sort theo biểu thức tính | 0,265 ms |
| Q3 tags (DISTINCT unnest) | HashAggregate | 0,587 ms |
| Q2 mặc định với `enable_seqscan = off` | Bitmap Index Scan qua unique `(categoryId, slug)` + Sort quicksort 25 kB | 0,166 ms |

**Kết luận: không thêm chỉ mục.** Chỉ mục `(categoryId, isActive, sortOrder)` + unique `(categoryId, slug)` đã phủ lọc + thứ tự; `needsReview` chỉ là bộ lọc thêm trên tối đa vài trăm dòng/danh mục — lợi ích của chỉ mục `(categoryId, isActive, needsReview, sortOrder)` không đo được ở quy mô này, và planner có thể không chọn nó (đã chọn bitmap qua unique nhỏ hơn). Không đoán chỉ mục.

### C3. Bảng hiệu năng trước/sau

| URL | Trước (live, Ngày 19/20 — ấm, trung vị 5×) | Local sau delta (ấm, trung vị 5×, cùng VM, DB localhost) | Live sau delta |
| --- | --- | --- | --- |
| `/` | 0,84–1,08 s | ~0,027 s (0,024–0,069 s) | CHỜ DEPLOY — Pi Em đo 5× × 3 URL ấm |
| `/hoa-tuoi` | 1,52–2,19 s | ~0,026 s (0,021–0,101 s) | CHỜ DEPLOY — mục tiêu ≤1,05 s (giảm ≥40% so với 1,75 s) |
| `/tin-tuc` | 0,78 s | ~0,019 s (0,015–0,024 s) | CHỜ DEPLOY |

Số local chỉ chứng minh truy vấn + render nhanh khi DB cùng máy —
không nói gì về live. Nguyên nhân còn lại nếu live vẫn >1,05 s
sau khi chuyển vùng: render động toàn trang (root layout gọi
`await headers()` lấy `x-nonce` → mọi trang render động, không
cache tĩnh) + RTT còn lại Singapore–Singapore. **Nonce/ISR để
ngày riêng** (theo đặc tả: ghi nguyên nhân còn lại và dừng).
Không hồi quy: `<head>` 4/4, CSP, smoke local 20/21 (chỉ
sitemap-localhost, như trước), `security-scan-live.sh` 21/21.

## 14. Lỗi tìm thấy khi kiểm (đã sửa, có test)

### 14.1 Ánh xạ bắt buộc externalId chặn tệp chỉ có SKU
Ánh xạ tự động không map cột `sku` → `externalId`, mà B3 mới yêu
cầu externalId bắt buộc → lưu ánh xạ bị từ chối. Sửa: chấp nhận
externalId HOẶC sku ở mức cột (xem độ lệch §11.1) + tự điền
externalId = cột SKU khi tệp không có cột mã ngoài.

### 14.2 Ánh xạ nhớ theo sourceName bỏ qua cột mới
Lô giá dùng cùng sourceName với các lô trước nên nạp ánh xạ đã nhớ
từ tệp cũ (không có cột salePrice/description) thay vì tự nhận diện
cột của tệp mới — salePrice/description bị bỏ qua âm thầm. Sửa:
`mergeSavedMapping` — cột đã nhớ chỉ giữ khi còn tồn tại trong tệp
mới, trường null thì tự nhận diện lại (unit test 3 ca mới).

### 14.3 Cập nhật chỉ-giá không chuyển `importBatchId`
Nhánh cập nhật chỉ-giá (SP đã duyệt) chỉ sửa price/salePrice nên
hoàn tác lô mới không tìm thấy SP (lô cũ vẫn giữ). Sửa: cập nhật
chỉ-giá cũng chuyển `importBatchId` sang lô mới (nhất quán với
nhánh cập nhật đầy đủ).

### 14.4 Bảng "Các lô nhập gần đây" hiện số cũ sau khi chạy
Bảng dùng prop `batches` lấy lúc tải trang nên sau khi chạy xong
vẫn hiện "Chờ xử lý 0/0/0/0" trong khi bước 6 đã báo "Xong, tạo
25" — bắt được bằng ảnh probe CDP. Sửa: wizard hợp nhất state lô
mới nhất vào danh sách hiển thị (ảnh sau sửa: "Xong 25/0/0/0").

### 14.5 Môi trường (không phải lỗi code — ghi để lần sau khỏi mất giờ)
- Chrome headless mất sau lần thay VM — cài lại từ `.deb` của Google.
- Fixture TEST-001 mất sau lần dựng lại DB — khôi phục bằng `scripts/recreate-test-data.ts` (test:db 123/139 → 139/139).
- DB local sau dựng lại thiếu dòng `seo.allowIndexing` → mặc định `true` → trang chủ local không có meta robots noindex (làm rớt kiểm `<head>` 4/4 ở probe lần đầu). Đã đặt `seo.allowIndexing=false` bằng SQL + khởi động lại server để khớp trạng thái production (TẮT). Đây là trạng thái DB local, không phải code.
- Lỗi probe (không phải lỗi sản phẩm): trang `/search` echo lại từ khóa trong tiêu đề nên phải kiểm bằng slug; nhãn "Cập nhật (đã tồn tại)" chứa ngoặc tròn phải escape trong regex; bảng + thẻ mobile cùng render nên mỗi SP có 2 checkbox — đếm theo nút bulk; href không nằm trong `innerText`; React chèn `<!-- -->` giữa "Lô #" và số.

## 15. Tiêu chí ĐẠT Phần B (bản mới) — CDP 30/30

Probe `~/workspace/day20b-shots/probe-day20b-import.mjs` (máy chủ
giả 127.0.0.1:18082, server standalone local với
`SAFE_FETCH_ALLOW_LOOPBACK=1`), CSV mẫu 30 dòng (25 hợp lệ + 5
lỗi cố ý: giá âm, tên ngắn, salePrice bằng giá, giá 0, thiếu mã
ngoài), ảnh 1440 + 390 đã mắt kiểm
(`~/workspace/day20b-shots/`):

| # | Kiểm | Kết quả |
| --- | --- | --- |
| B0.1 | Chưa đăng nhập → chuyển `/login` (307) | PASS |
| B1.1–B1.3 | Mở trang nhập, chọn tệp CSV 30 dòng, tạo lô qua UI | PASS |
| B3.1–B3.2 | Ánh xạ tự khớp đủ cột; lưu ánh xạ danh mục Hoa tươi | PASS |
| B2.1–B2.2 | Xem trước: tổng 30 / hợp lệ 25 / tạo mới 25 / lỗi 5; danh sách lỗi hiện Dòng 27–31 | PASS |
| B6.1 | Nút "Tải CSV lỗi" hiện ở xem trước | PASS |
| B4.1–B4.2 | Câu tick đúng bản mới; xác nhận quyền → bước 5 | PASS |
| B2.3 | Chạy xong: tạo mới 25 + "Lỗi đọc dữ liệu ban đầu: 5 dòng" | PASS |
| B6.2 | DB: 25 SP mới đều ẩn + Chờ duyệt | PASS |
| B6.3–B6.4 | SP chờ duyệt ẩn khỏi tìm kiếm shop (kiểm bằng slug) + sitemap | PASS |
| HEAD | Shop `/`: 4/4 (title, description, robots noindex, og:title) | PASS |
| B3.3 | Chạy lại: ánh xạ nhớ vẫn giữ cột salePrice | PASS |
| B5.1–B5.2 | Chạy lại: tạo 0 / cập nhật 25 / lỗi 5; vẫn 25 SP, 25 hàng UPDATED, không trùng | PASS |
| B6.5 | Danh sách hiện nguồn "Nhập từ ngoài" + tên nguồn | PASS |
| B6.6–B6.8 | Chọn 3 SP (gồm SP tên có `<3`) để duyệt; hộp duyệt: "Hiện luôn" mặc định KHÔNG tick; duyệt 3 (hiện luôn) → 3 SP hiện, bán được | PASS |
| B11.1 | XSS: tên có `<3` hiện `&lt;3` trong HTML shop | PASS |
| B6.9 | Từ chối 2 SP → còn 23 SP | PASS |
| B6.10 | Popup SP hiện khối "Nguồn dữ liệu" (tên nguồn, mã ngoài, lô, ngày nhập) — ảnh popup đã mắt kiểm; kiểm lại bằng curl có cookie sau khi sửa check probe (lỗi `<!-- -->`) | PASS |
| B2.4 | Feed URL (máy chủ giả) tạo lô qua UI | PASS |
| B2.5 | Feed HTML → đúng thông báo "Đây là trang web, không phải dữ liệu nhập (CSV/JSON)" | PASS |
| B11.2 | URL nội bộ 169.254.169.254 bị chặn, không tạo lô | PASS |

**Tổng: 30/30 PASS** (29/30 ở lần chạy đầy đủ cuối + B6.10
xác minh nhắm mục tiêu sau đó; lần chạy đầy đủ trước đó 25/30 —
5 lỗi đều là lỗi probe/môi trường, đã sửa, xem §14.5). DB cuối
sạch: 21 SP (20 seed + TEST-001), 0 lô, 0 hàng nhập, 0 phiên,
0 ánh xạ nhớ.

## 16. Số kiểm cuối cùng (cây cuối)

| Kiểm | Kết quả |
| --- | --- |
| Unit (`npm test`) | **516/516** (tăng từ 498: +3 merge mapping, +15 parse/safe-fetch B11) |
| test:db (`--test-concurrency=1`) | **139/139 × 3 lần liên tiếp** trên cây B-rest + 2 lần 139/139 trên cây cuối (tổng 5 lần PASS; 1 lần 138/139 giữa chừng do phiên thừa từ probe — xem A4) |
| Typecheck (`tsc --noEmit`) | 0 lỗi |
| Lint | 0 lỗi / 4 cảnh báo (cũ) |
| Build (`next build`) | OK; First Load JS `/` **115 kB** (≤135 kB) |
| `npm run test:security` | TẤT CẢ ĐẠT (tĩnh 76, live-check 63/63, live scan 21/21) |
| CDP Phần A2 | 9/9 PASS |
| CDP Phần A3 (bank) | 6/6 PASS; đặt hàng fail-closed 5/5 PASS |
| CDP Phần B (tiêu chí chấp nhận) | 30/30 PASS |
| Smoke local | 20/21 (chỉ sitemap-localhost, như trước) |
| `npm audit --omit=dev` | 0 |

## 17. Còn thiếu / chưa làm (bổ sung)

- TTFB live sau sửa chưa đo (chờ Pi Em đẩy + deploy, đo lại 5× × 3 URL ấm, đối chiếu nền Ngày 19) — mục tiêu `/hoa-tuoi` ≤1,05 s.
- Feed JSON qua UI chưa probe bằng CDP (CSV feed đã probe đủ; JSON parse đã có unit test).
- Nhập/xuất tin tức: backlog từ Ngày 18.
- Safari/Firefox chưa kiểm; Lighthouse chưa đo; sao lưu tự động + cảnh báo 500 chưa có.
- Drift `admin_two_factor` (Ngày 19) chưa sửa — để ngày riêng.
- B7: giới hạn ≤500 ảnh/lô + re-encode WebP bằng sharp chưa làm (sharp không có sẵn).

## 18. Chờ Henry

- **S0: thu hồi token GitHub đã dán trong chat + tạo token fine-grained** với Contents AND **Workflows** read/write để đẩy được `.github/workflows/ci.yml`; tới lúc đó ci.yml vẫn chỉ local (commit `8599fec`) và CI chưa từng chạy. Đường khác (B6 bản cũ): thêm ci.yml thủ công qua giao diện web GitHub khi trình duyệt Henry đã đăng nhập, rồi `git pull` đồng bộ — không cần token mới.
- **Bật 2FA trên production:** đặt `AUTH_ENCRYPTION_KEY` trên Vercel (lệnh sinh khóa trong `docs/van-hanh.md` §3.1 — giá trị production phải **khác** khóa local), quét QR ở `/admin/security`, cất 10 mã khôi phục + cất bản sao khóa vào trình quản lý mật khẩu. Không bật 2FA trên live trước khi có khóa đúng (A2: thiếu khóa thì chỉ đăng nhập được bằng mã khôi phục).
- ~~Vùng Neon + pooler~~ — ĐÃ XÁC ĐỊNH (§13.1), không còn chờ.
