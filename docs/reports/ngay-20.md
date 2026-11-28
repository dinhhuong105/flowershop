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
