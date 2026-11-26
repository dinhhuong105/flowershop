# Báo cáo Ngày 14 — Trang tĩnh ở slug gốc + SEO riêng + go-live

- Ngày: 26/11/2026.
- Nền: commit `3cbc9bb` (Ngày 13).
- Commit Ngày 14: 1 commit trên `3cbc9bb` (lấy hash đầy đủ bằng `git log`).
- Phạm vi theo lệnh Henry 26/11 ~15:05: cắt tối thiểu A + B + C + F trước, D làm thêm vì còn thời gian; E và B6 chuyển sang Ngày 15. G KHÔNG ÁP DỤNG.
- Lệnh Henry cùng lúc (vượt spec): **bỏ `/trang` hoàn toàn** — trang tĩnh sống ở slug gốc (`/gioi-thieu`, …); từ nay không thêm phân cấp cố định/prefix mới.

## Kiểm kê đầu ngày

### A2 — Live + local (chỉ đọc, 26/11)
- Live `https://flowershop-steel.vercel.app/robots.txt`: `Disallow: /` + `Sitemap: https://flowershop-steel.vercel.app/sitemap.xml`. Trang chủ live có `<meta name="robots" content="noindex, nofollow"/>` → **lập chỉ mục ĐANG TẮT** (Henry duyệt tắt 26/11 ~14:32; kiểm lại lúc viết báo cáo bằng F2 — INFO `noindex (noindex, nofollow)` + `robots.txt chặn toàn bộ (Disallow: /)`).
- Live sitemap: **29 URL** (1 gốc, 8 một đoạn — 4 trang cố định /faq, /about, /contact, /policy + 4 danh mục — 20 sản phẩm, **0 trang đã xuất bản**).
- Số đơn / khu vực / site_settings / settings_audit trên live không xem được từ mặt public — cần kiểm qua admin live (mẹ).
- Local (DB dựng lại từ migration + seed sau khi VM bị thay — xem "Sự cố môi trường"): 20 sản phẩm, 4 danh mục, 0 đơn, 3 trang nháp (0 xuất bản), 24 settings, 0 audit, 4 khu vực, 0 phiên.
- A1 BLOCKED (store `flowershop-blob` vẫn Private — chỉ Henry sửa được trong Vercel dashboard). A3 BLOCKED (Neon — Henry). A4 KHÔNG KIỂM (chưa có token Telegram — ghi rõ, không tính là đạt).

### C0 — Trang cũ (local, trước khi code C1–C4)
- `/about`, `/policy`, `/faq`, `/contact` = **200** (trang cứng có thật); `/van-chuyen`, `/doi-tra`, `/bao-mat`, `/lien-he` = **404** (không có route); `/trang/gioi-thieu` = 404 (trang nháp).
- `/policy` gồm 4 mục: Giao hàng, Thanh toán, Đổi trả, Bảo mật thông tin.
- Link tới route cũ: Footer (/about, /faq ×2, /contact, /policy), trang /about → /contact, trang /contact → /faq; Header/menu mobile: không có; sitemap: /faq, /about, /contact, /policy; JSON-LD: không có.
- Quyết định: `LEGACY_PATHS = ["/about", "/policy", "/faq", "/contact"]` (4 trang cứng thật; `/van-chuyen`… không cần legacyPath — trang tĩnh có slug đó tự phục vụ ở gốc).

### D0 — `<head>` nền (Day 13, đã chụp `~/workspace/day14-baseline-heads/`)
- Sản phẩm (`/hoa-tuoi/bo-hong-do-tinh-yeu`): title "Bó Hồng Đỏ Tình Yêu | Hoa Tươi Demo"; description = mô tả sản phẩm cắt 155 ký tự; canonical `/hoa-tuoi/bo-hong-do-tinh-yeu`; og:title/og:description theo title/description; không og:image; JSON-LD Organization duy nhất (name + url). Không có JSON-LD Product/Breadcrumb.
- Danh mục (`/hoa-tuoi`): title "Hoa tươi | Hoa Tươi Demo"; description từ `CATEGORY_DESCRIPTIONS`; canonical `/hoa-tuoi`; og:title = mặc định layout "Hoa Tươi Demo"; og:description = mô tả mặc định của shop; không og:image; JSON-LD Organization duy nhất.
- Trang chủ: title "Hoa Tươi Demo" (không qua template); **không có `<link rel="canonical">`** — đây là khoảng trống F2 tìm ra (xem độ lệch 2).

### E0 — Nhật ký hoạt động
- `settings_audit` hiện 0 dòng. Các key code đã ghi: `general.*`, `contact.*`, `bank.*`, `telegram.*`, `seo.*` (qua `saveSettingsToDb`), `page:<slug>` (tạo/sửa/xuất bản/nháp/xóa), `bank.notify` (gửi/thất bại). Lịch sử trạng thái đơn nằm riêng ở `order_events` — KHÔNG thuộc phạm vi E1 (E2 nói rõ không log đổi trạng thái đơn đợt này).

### G0 — Dọn demo
- KHÔNG ÁP DỤNG: chưa có sản phẩm thật/ảnh thật (điều kiện bắt buộc G chưa đủ). Local seed = 20 sản phẩm demo, 4 danh mục.

## Kết quả từng mục

| Mục | Kết quả | Ghi chú |
|---|---|---|
| A1 Blob Public + redeploy | KHÔNG ĐẠT (blocked) | Store vẫn Private; chỉ Henry sửa trong dashboard Vercel. Không đổi code sang private/signed URL. |
| A2 Kiểm kê | ĐẠT | Live indexing TẮT (bằng chứng ở trên); sitemap live 29 URL, 0 trang xuất bản. |
| A3 Neon snapshot + branch | KHÔNG ĐẠT (blocked) | Henry chưa kích hoạt Neon / tạo branch. |
| A4 Telegram thật | KHÔNG KIỂM | Chưa có token — ghi rõ, không tính đạt. |
| B1 `{siteName}` trong mẫu tiêu đề | ĐẠT | Module thuần `src/lib/title-template.ts` (validate/apply/resolve); mặc định mới `"%s | {siteName}"`; hàng cũ trong DB giữ nguyên mẫu cũ. |
| B2 Gom nhóm menu Cài đặt | ĐẠT | Một nhóm "Cài đặt" 6 mục con (Chung, Liên hệ, SEO, Khu vực & phí, Ngân hàng & QR, Telegram); URL không đổi; tự mở khi ở trang con. |
| B3 Bảng trang tĩnh không tràn | ĐẠT | `table-fixed` + độ rộng cột; cột "Chân trang" gộp thành badge trong ô Trạng thái; không tràn 1440/1280/1024/390. |
| B4 Tiêu đề popup "Sửa …: …" | ĐẠT | 8 trang modal + full-page (trang/sản phẩm/danh mục/khu vực); h1 trang sửa sản phẩm không tên nên giữ nguyên. |
| B5 Cảnh báo khi lưu ngân hàng | ĐẠT | Hộp vàng khi form đổi + N > 0 ("N đơn chuyển khoản chưa thu sẽ hiển thị QR mới") + link tới danh sách đơn đã lọc; Telegram thêm câu "N đơn chưa thu bị ảnh hưởng."; thông báo thành công giữ nguyên khi N = 0. |
| B6 Xem trước Markdown 2 cột | KHÔNG LÀM | Chuyển Ngày 15 — ưu tiên thấp, hết thời gian sau D. |
| C0 Kiểm kê trang cũ | ĐẠT | Xem trên. |
| C1 `legacyPath` | ĐẠT | Migration `pages.legacyPath` (unique); chọn trang cũ trong PageForm + cảnh báo /policy; xung đột legacyPath báo rõ; đổi legacyPath ghi thêm dòng audit cùng transaction. |
| C2 Chuyển hướng 308 | ĐẠT | `/about` → 308 → `/<slug>` (query giữ nguyên, một hop); chưa thay thì 200 như cũ. |
| C3 Footer + link + sitemap | ĐẠT | Footer đổi link cũ theo thay thế, ẩn mục trùng trang tĩnh; sitemap bỏ URL cũ đã thay; link /about→/contact, /contact→/faq đổi theo. |
| C4 Kiểm C | ĐẠT | Unit + test:db + curl (xem "Kiểm chứng"). |
| D0 Kiểm kê SEO nền | ĐẠT | Xem trên. |
| D1 SEO riêng sản phẩm/danh mục | ĐẠT | Migration `seoTitle` (≤ 120) + `seoDescription` (≤ 160) trên `products` + `categories`; section "SEO (không bắt buộc)" gập/mở trong 8 form (4 sản phẩm + 4 danh mục), đếm ký tự + xem trước tìm kiếm; giữ giá trị sau lỗi. |
| D2 Áp SEO lên `<head>` | ĐẠT | seoTitle/seoDescription (nếu có) thay title/description/og; không SEO → `<head>` giống hệt nền; canonical không đổi; không thêm JSON-LD. |
| D3 Kiểm D | ĐẠT | Validation tests + test:db lưu/đọc + so `<head>` + CDP giữ giá trị sau lỗi (8/8). |
| E1 Trang `/admin/activity` | KHÔNG LÀM | Chuyển Ngày 15 — hết thời gian sau khi cắt tối thiểu + D xong và kiểm chứng lại toàn bộ (VM bị thay giữa chừng). |
| E2 Log sản phẩm/danh mục/khu vực | KHÔNG LÀM | Chuyển Ngày 15 (phụ thuộc E1). |
| F1 Checklist go-live | ĐẠT | `docs/go-live-checklist.md` — đủ 8 bước, mỗi bước có người làm + cách kiểm; bước 2 ghi rõ biến `SITE_URL`; bước 6 nhắc indexing đang TẮT và bật cuối cùng. |
| F2 Script `go-live-check.sh` | ĐẠT | GET-only; thoát 0/1/2; kiểm sitemap/canonical/og:image/JSON-LD/HTTP→HTTPS/alt-host/`--expect-redirect`; INFO noindex. Chạy đúng 3 tình huống spec + 2 tình huống tên miền sai. |
| F3 Bảng sẵn sàng dữ liệu | ĐẠT | Bảng ở dưới (chỉ đọc). |
| G Dọn demo | KHÔNG ÁP DỤNG | Chưa đủ điều kiện (xem G0). |

## Độ lệch (so với spec Ngày 14)

1. **Lệnh Henry — bỏ `/trang` hoàn toàn.** Trang tĩnh sống ở slug gốc: `[category]/page.tsx` (cả `generateMetadata`) tra trang đã xuất bản theo slug trước, có thì render trang tĩnh, không thì render danh mục như cũ; thư mục `src/app/trang` đã xóa; sitemap/Footer/admin/pages/PageForm dùng `/<slug>`; slug trang mới vẫn bị chặn nếu trùng slug danh mục (đã có sẵn trong `findSlugClash`); `/trang/<slug>` cũ chưa từng public (3 trang seed đều nháp) nên không cần redirect; `/trang/x` hai đoạn → 404 qua `[category]/[product]`. Mục C2/C3/C4 đổi đích từ `/trang/<slug>` sang `/<slug>`.
2. **Trang chủ thêm `<link rel="canonical">`.** F2 phát hiện trang chủ chưa từng có canonical (sản phẩm/danh mục đã có). Thêm `metadata = { alternates: { canonical: "/" } }` vào `src/app/page.tsx`. `<head>` trang chủ khác nền đúng 1 dòng này; sản phẩm/danh mục giống hệt nền.
3. **`CATEGORY_DESCRIPTIONS` chuyển sang `src/lib/category-descriptions.ts`.** Import giá trị từ module route `[category]/page` bị typecheck từ chối (xung đột index signature của route types). Nội dung không đổi; 2 trang sửa danh mục import từ lib.
4. **`products.db.test.ts`: tra SP test theo SKU, bỏ id cứng 21.** Id tự tăng đổi mỗi lần dựng lại DB (lần này là 23 rồi 21); SKU `TEST-001` mới ổn định. Test vẫn yêu cầu chạy `scripts/recreate-test-data.ts` trước (đã ghi trong file) rồi dọn bằng `clean-test-data.ts`.
5. **F2: sửa lỗi đọc `Disallow: /`.** Grep cũ `^Disallow: /` nhận nhầm `Disallow: /cart` thành "chặn toàn bộ". Giờ khớp đúng dòng `Disallow: /` (cuối dòng). Local (Allow: /) giờ báo đúng "không chặn toàn bộ".
6. **`categories.db.test.ts`: thêm `seoTitle`/`seoDescription` vào 3 lệnh gọi** (bắt buộc vì `CategoryFormValues` mới).
7. **`"trang"` vẫn giữ trong `RESERVED_SLUGS`.** Không còn URL `/trang/…` nào được tạo; giữ reserved để tránh nhầm với prefix cũ (ghi chú trong code).

## Kiểm chứng

- Unit: **298/298 PASS** (Ngày 13: 280; +18: title-template, bank-warning, legacy-paths, page-validation, telegram, product/category validation SEO).
- test:db: **42/42 PASS** (Ngày 13: 34; +8: bank-warning 1, pages-legacy 4, seo-fields 3). Lưu ý: cần chạy `scripts/recreate-test-data.ts` trước (SP TEST-001 cho test toggle), rồi dọn bằng `clean-test-data.ts --delete` sau.
- Typecheck: **0 lỗi**. Lint: **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`).
- Build: OK. First Load JS `/` = **115 kB** (≤ 135 kB).
- Smoke local (`scripts/smoke-live.sh http://localhost:3000`, sau khi dọn probe): **19/20** — FAIL duy nhất là sitemap-localhost (SITE_URL là http://localhost:3000 ở local; trên production sẽ PASS). Có thêm 2 check mới PASS: `/gioi-thieu` 404 (nháp) và `/trang/gioi-thieu` 404 (tiền tố đã bỏ).
- CDP (headless Chrome, server standalone :3000): **22/22 PASS** — B2 desktop + mobile (nhóm Cài đặt, 6 mục con, "Sắp có" = 7 vì E1 chưa làm), B3 desktop 11 dòng không tràn 1440/1280/1024 + mobile 11 thẻ không tràn 390, B5 desktop + mobile (chưa sửa: không cảnh báo; sửa 1 ô: hộp vàng "1 đơn chuyển khoản chưa thu sẽ hiển thị QR mới" + link lọc đúng; trả về như cũ: hộp ẩn), slug gốc `/trang-kiem-thu-legacy` render đúng, `/hoa-tuoi` vẫn chạy.
- CDP-D (form SEO giữ giá trị sau lỗi): **8/8 PASS** — sản phẩm: nhập seoTitle 121 ký tự → lỗi "Tiêu đề SEO tối đa 120 ký tự." + giá trị còn nguyên + section vẫn mở; danh mục: seoDescription 161 ký tự → lỗi "Mô tả SEO tối đa 160 ký tự." + giá trị còn nguyên.
- So `<head>` với nền (chuẩn hóa hash): sản phẩm + danh mục **giống hệt**; trang chủ khác đúng 1 dòng canonical (độ lệch 2). Sản phẩm/danh mục điền SEO: chỉ title/description/og:title/og:description đổi theo SEO, canonical không đổi (đã trả SEO về rỗng sau kiểm).
- C2/C3 (curl): `/about` → **308** → `/trang-kiem-thu-legacy`; `/about?x=1` → 308 giữ `?x=1`; `/policy` (chưa thay) → 200; bỏ xuất bản trang test → `/about` về 200; sitemap bỏ /about + có trang mới, 0 URL `/trang/`; footer trang chủ có `href="/trang-kiem-thu-legacy"`, 0 `href="/about"`; `/trang/xyz` → 404.
- F2: không tham số → thoát 2; trên live `flowershop-steel.vercel.app` (code Ngày 13) → 5 PASS / 1 FAIL (chỉ home-canonical — khoảng trống Ngày 14 sửa; sẽ PASS sau deploy); tên miền sai không phân giải → 5 FAIL thoát 1; tên miền sai có phân giải (example.com) → 4 FAIL thoát 1; local + `--expect-redirect /about=/trang-kiem-thu-legacy` → redirect PASS 308; sau sửa Disallow: local báo đúng "robots.txt không chặn toàn bộ".
- DB local sau dọn: products=20, orders=0, pages=3 (0 xuất bản), settings=24, audit=0, categories=4, zones=4, sessions=0. **Sạch.**

## F3 — Bảng sẵn sàng dữ liệu production (chỉ đọc)

Căn cứ: mặt public live (sitemap/robots/head, kiểm lúc viết báo cáo) + kiểm live ngày 26/11 (checkout chỉ có COD) + seed mặc định. Số liệu trong admin live cần mẹ kiểm lại trước go-live.

| Mục | Trạng thái | Việc cần làm |
|---|---|---|
| Tên shop khác mặc định | ✗ "Hoa Tươi Demo" (mặc định) | Henry nhập tên shop thật ở Cài đặt chung |
| Hotline/Zalo/địa chỉ không còn giá trị mẫu | ✗ Giá trị mẫu | Henry nhập ở Cài đặt liên hệ |
| Ngân hàng đã cấu hình + bật | ✗ Chưa cấu hình (checkout live chỉ có COD) | Henry nhập tài khoản ở Ngân hàng & QR (không gửi qua chat) |
| Telegram có token + bật | ✗ Chưa có token | Henry đặt token vào env Vercel + chat id trong admin, rồi "Gửi thử" |
| Khu vực + phí đã thay giá trị mẫu | ✗ 4 khu vực mẫu 25k/35k/50k/70k | Henry nhập khu vực + phí thật |
| Sản phẩm có ảnh thật (so với "Ảnh mẫu") | ✗ 0/20 — tất cả dùng `/images/placeholder.svg` | Henry nhập sản phẩm + ảnh thật (cần A1 Blob Public trước) |
| Ba trang chính sách đã xuất bản | ✗ 0/3 trang xuất bản (cả 3 seed đều nháp) | Henry viết nội dung thật + xuất bản (giới thiệu, giao hàng/thanh toán, đổi trả); đọc lại /policy hiện tại |
| Mẫu tiêu đề SEO / mô tả mặc định / ảnh OG | ✗ Mẫu mặc định (`%s \| {siteName}`), mô tả mặc định, chưa có ảnh OG | Henry đặt mô tả mặc định thật + ảnh OG (jpg/png/webp ≤ 1 MB) |
| Trạng thái lập chỉ mục | ✗ ĐANG TẮT (đúng chủ đích hiện tại) | Henry bật cuối cùng sau khi 1–5 đạt (bước 6 checklist) |

## Mục chưa làm + lý do

- **E1 `/admin/activity`** — chuyển Ngày 15. Hết thời gian sau khi cắt tối thiểu + D xong và kiểm chứng lại toàn bộ; VM bị thay giữa chừng (PostgreSQL + Chrome bị xóa, phải cài lại + dựng lại DB + chạy lại toàn bộ kiểm chứng). Không làm dở.
- **E2 log sản phẩm/danh mục/khu vực** — chuyển Ngày 15 (phụ thuộc E1).
- **B6 xem trước Markdown 2 cột** — chuyển Ngày 15, ưu tiên thấp.
- **A1 / A3 / A4** — blocked / chưa kiểm như trên; là việc của Henry, không phải code.

## Ảnh đính kèm

- B2: `~/workspace/ngay-14-b2-1440.png`, `~/workspace/ngay-14-b2-390.png`
- B3: `~/workspace/ngay-14-b3-1440.png`, `~/workspace/ngay-14-b3-390.png`
- B5: `~/workspace/ngay-14-b5-1440.png`, `~/workspace/ngay-14-b5-390.png`
- E1: không có (chưa làm).

## Sự cố môi trường (ghi lại để lần sau khỏi mất thời gian)

- Giữa buổi, VM bị thay: PostgreSQL 16 + Chrome biến mất (`/usr/lib/postgresql` không còn, uptime 3 phút), server local chết. `~/workspace` + `~/tools/node22` còn nguyên. Hệ thống tự replay lại gói apt cũ (PostgreSQL về lại sau ~10 phút chờ `apt-get update` của hệ thống xong); Chrome cài lại từ Google .deb. DB dựng lại từ migration + seed (20 sản phẩm, 0 đơn, 3 trang nháp). Toàn bộ kiểm chứng (unit, test:db, CDP 22/22, CDP-D 8/8, so head, smoke) chạy lại trên build cuối sau khi dựng lại.
- Bài học probe CDP: `Network.setCookie` phải gửi vào **page session** (sau `Target.createTarget` + attach), không phải browser session — gửi browser-level báo `'Network.setCookie' wasn't found`.

## Việc của Henry (nhắc lại, không giục riêng lẻ)

- A1: bật Public cho store `flowershop-blob` trong Vercel dashboard (hoặc tạo store Public mới + nối lại + redeploy), rồi chạy lại test tải ảnh A1.
- A3: kích hoạt Neon (link trong email) rồi tạo branch từ production trong Neon Console — làm TRƯỚC khi nhập dữ liệu thật.
- A4: token Telegram vào env + chat id trong admin, rồi "Gửi thử".
- Dữ liệu thật: tên shop, hotline/Zalo/địa chỉ, ngân hàng, khu vực + phí, sản phẩm + ảnh thật, nội dung 3 trang chính sách + mô tả SEO mặc định + ảnh OG; đọc lại /policy đang public.
- Quyết định token GitHub (thu hồi token đã dán trong chat + tạo fine-grained mới) vẫn là của Henry.
