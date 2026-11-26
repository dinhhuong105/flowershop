# Báo cáo Ngày 11 — Dọn production + Nền cài đặt

- **Nền:** `21d8d55` (đợt 4 đã live)
- **Commit Ngày 11:** một commit trên `21d8d55`, chưa push (xem `git log` — hash
  đổi mỗi lần amend nên không ghi hash cố định trong báo cáo, theo mẫu Ngày 10).
- **Link live:** https://flowershop-steel.vercel.app/
- **Ngày làm:** 2026-11-26
- **Đặc tả:** `~/workspace/ngay-11-dac-ta.md` (đọc nguyên văn)

## Tóm tắt

Ngày 11 xây xong nền cài đặt shop và công cụ dọn production, nhưng
**production không có gì để dọn**: kiểm kê chỉ đọc ngày 26/11 ~00:26 cho thấy
production có **0 đơn, 20 sản phẩm, 4 danh mục, sitemap 29 URL, KHÔNG có
TEST-001** — trái với giả định trong đặc tả A1 (3 đơn test + TEST-001).
A4 vì vậy không xóa gì; A2 + A3 chỉ làm phòng ngừa.

Nơi lưu ảnh theo quyết định mới của Henry (26/11 ~07:29): **Vercel Blob khi
còn ở Vercel, disk (public/uploads) là hướng dài hạn khi chuyển VPS**.
Module storage một giao diện, hai adapter, chọn theo biến môi trường.
Blob store Henry tự tạo trong dashboard Vercel — **chưa có**, nên kiểm
"upload trên production → deploy lại → ảnh vẫn còn" là **CHƯA KIỂM TRA**
(không bịa kết quả).

## Kết quả từng mục

### Phần A — Dọn production

| Mục | Kết quả | Ghi chú |
|-----|---------|---------|
| A0 Snapshot production | **KHÔNG ĐẠT** | Không pg_dump được production từ máy này (không có Neon credentials). Ghi rõ, không giấu. Vì A4 không xóa gì nên rủi ro bằng 0; bắt buộc phải có snapshot trước bất kỳ lần xóa production nào trong tương lai. |
| A1 Kiểm kê (chỉ đọc) | **ĐẠT** | Production 26/11 ~00:26: 0 đơn, 20 sản phẩm, 4 danh mục, sitemap 29 URL; KHÔNG có TEST-001 (chỉ có ở DB local); cả 20 sản phẩm dùng placeholder `/images/placeholder.svg` trong repo (HTTP 200); không có ảnh upload, không 404. |
| A2 Script `scripts/clean-production.ts` | **ĐẠT** | Dry-run mặc định; `--confirm` mới xóa; một transaction; in số dòng từng bảng; tiêu chí: tên người đặt bắt đầu `[TEST]` hoặc mã đơn truyền vào; SKU truyền vào; từ chối khi > 20 đơn khớp hoặc có đơn COMPLETED+PAID khớp mà không có `--allow-paid`; yêu cầu `--i-know-this-is-production` khi DATABASE_URL không phải localhost; yêu cầu `--snapshot=<...>` khi xóa thật. Unit test cho hàm chọn thuần (`src/lib/admin/clean-production.test.ts`). |
| A3 Chặn seed `--force` trên production | **ĐẠT** | `prisma/seed.ts`: `--force` trên production bị từ chối trừ khi có `--i-know-this-is-production`; kiểm trực tiếp: URL Neon giả → từ chối, exit 1, **trước** mọi ghi DB. Test nhánh production trong `src/lib/seed-guard.test.ts`; README cập nhật. |
| A4 Thực hiện dọn | **KHÔNG ÁP DỤNG** | Không có gì để xóa (0 đơn, không TEST-001 trên production). Không chạy xóa production. Dashboard production sau dọn = dashboard hiện tại; ảnh dashboard production không chụp được ở vòng này (không push trong phạm vi; xem "Chưa kiểm tra" bên dưới). |

**Tiêu chí A:** snapshot — KHÔNG ĐẠT (lý do trên); dry-run in đúng danh sách —
ĐẠT (chạy trên local: chọn đúng 1 đơn 0Z2DZBQNTJ + sản phẩm 21 TEST-001,
không xóa gì); test A2/A3 pass; sau dọn không còn đơn test / TEST-001 trên
production — ĐẠT theo nghĩa không tồn tại ngay từ đầu; smoke 10/10 — xem C5
(11/12 local, 1 fail là kiểm sitemap-localhost, chỉ có ý nghĩa trên
production).

### Phần B — Nền cài đặt

| Mục | Kết quả | Ghi chú |
|-----|---------|---------|
| B1.1 Ảnh production là ảnh repo hay upload | **ĐẠT** | Cả 20 sản phẩm dùng placeholder trong repo, HTTP 200; không ảnh upload, không 404. |
| B1.2 Chọn nơi lưu ảnh | **ĐẠT** | Henry quyết 26/11 ~07:29: Vercel Blob khi còn ở Vercel; disk là hướng VPS sau này. Store Blob **chưa được tạo** (Henry tự tạo trong dashboard Vercel; Vercel tự thêm `BLOB_READ_WRITE_TOKEN`). |
| B1.3 Module `src/lib/storage.ts` | **ĐẠT** | Một giao diện `saveImage(file) → url`, `deleteImage(url)`; disk adapter (local + VPS sau này) + Blob adapter (`@vercel/blob` 2.9.0, `put`/`del`, tên file theo content-hash, `addRandomSuffix: false`, mock provider cho test); chọn adapter theo `BLOB_READ_WRITE_TOKEN` có hay không. Giữ kiểm loại tệp/kích thước Ngày 7 (SVG an toàn, logo ≤ 1 MB, favicon ≤ 256 KB). Upload ảnh sản phẩm (`/api/admin/upload`) đã chuyển sang module này. URL tuyệt đối theo quy tắc của Henry: đã có domain thì giữ nguyên, còn tương đối thì gắn domain shop (`SITE_URL` / `siteConfig.url`), không gắn 2 lần — helper `toAbsoluteImageUrl` ở tầng storage. Test `src/lib/storage.test.ts` (mock provider). |
| B1.4 Chuyển ảnh hiện có | **KHÔNG ÁP DỤNG** | Không có ảnh upload nào trên production để chuyển. |
| B1 tiêu chí "upload → deploy lại → ảnh vẫn còn" | **CHƯA KIỂM TRA** | Chỉ chạy được sau khi Henry tạo Blob store xong + deploy. Local: upload qua disk adapter chạy được, file còn sau khi restart server. Không bịa kết quả production. |
| B2 Bảng cài đặt + `getSettings()` | **ĐẠT** | Migration `20261126000000_settings` (bảng `site_settings` + `settings_audit`, quay lại được). `src/lib/settings.ts`: `getSettings()` có kiểu + giá trị mặc định đúng chữ đang hiển thị trên shop; cache theo tag `site-settings` (`src/lib/settings-cache.ts`, tách riêng để `settings.ts` không phụ thuộc Next và test thuần được); `saveSettingsToDb` kiểm hợp lệ rồi `revalidateTag`; seed mặc định chỉ khi bảng trống (seed-guard, không ghi đè); `settings_audit` ghi 1 dòng cho mỗi khóa đổi (khóa, giá trị cũ/mới, ai, lúc nào). Nhóm khóa đúng đặc tả: general (siteName, slogan, logo, favicon), contact (hotline, zalo, email, address, openHours, facebook, instagram, tiktok). Test thuần validate + test:db lưu/đọc/mặc định/seed-không-ghi-đè (`src/lib/settings.test.ts`, `src/lib/settings.db.test.ts`). |
| B3 Trang admin Cài đặt | **ĐẠT** | Menu "Cài đặt shop" thành nhóm thật với 2 mục con Chung (`/admin/settings/general`) + Liên hệ (`/admin/settings/contact`); Ngân hàng & QR / Khu vực & phí / Telegram vẫn "Sắp có". Hai trang là trang đầy đủ (không phải popup), form trong thẻ, nút Lưu, lỗi theo từng ô, thông báo thành công. Upload logo/favicon qua module B1, có xem trước + nút "Gỡ ảnh" (về mặc định). `updatedBy` = tài khoản admin. Nút 30 px, mobile 44 px theo kiểu admin hiện tại. |
| B4 Quyền | **ĐẠT** | Chỉ phiên admin hợp lệ mới đọc/ghi; server action kiểm session lại đầu tiên (`requireAdmin`). Kiểm khi chưa đăng nhập bị từ chối: CDP + smoke C5 (`/admin/settings/general` chưa đăng nhập → 307 `/login`, PASS) — không viết unit test cho nhánh này vì `requireAdmin()` cần request scope của Next.js, đã ghi chú trong `src/lib/settings.db.test.ts`. |
| B5 Mặt shop đọc từ cài đặt | **ĐẠT** | Xem danh sách chuyển đổi bên dưới. Kiểm live: đổi tên shop → trang chủ hiện ngay → trả lại; đổi hotline → trang chủ/footer hiện ngay → trả lại rỗng thì ẩn; tải logo → header hiện logo → gỡ thì về biểu tượng mặc định. JSON-LD/sitemap/robots/canonical vẫn lấy domain từ biến môi trường, không đọc cài đặt. |

**Tiêu chí B:** B1–B5 đều ĐẠT (trừ B1.4 không áp dụng, kiểm
upload→deploy→còn-ảnh trên production CHƯA KIỂM TRA); shop không đổi khi
chưa nhập gì (mặc định = đúng chữ hiện tại); test mới pass; First Load JS
`/` = **115 kB** (≤ 135 kB, không đổi).

#### B5 — các chỗ đã chuyển sang `getSettings()` (grep)

- `src/app/layout.tsx` — `generateMetadata()` (title/description/og + favicon
  khi có) thay cho metadata tĩnh; truyền settings xuống TopBar/Header/Footer/
  FloatingContact/MobileMenu (không gọi `getSettings()` trong từng component).
- `src/components/layout/Header.tsx` — logo từ cài đặt (chưa có thì biểu tượng
  hoa mặc định), tên shop.
- `src/components/layout/Footer.tsx` — tên/slogan/socials/địa chỉ/hotline/
  Zalo/giờ mở cửa từ cài đặt; tagline giữ `siteConfig`.
- `src/components/layout/TopBar.tsx` — hotline.
- `src/components/layout/FloatingContact.tsx` — hotline/Zalo (props).
- `src/components/layout/MobileMenu.tsx` — tên shop/hotline/Zalo (props).
- `src/app/contact/page.tsx` — đọc cài đặt; mỗi dòng chỉ hiện khi có giá trị
  (hotline `tel:`, Zalo, email `mailto:`, địa chỉ, giờ mở cửa); chỉ hiện một
  dòng "Đang cập nhật." khi TẤT CẢ đều trống.
- `src/app/[category]/[product]/page.tsx` — og:title dùng tên shop từ cài
  đặt; nút gọi/Zalo dùng hotline/Zalo từ cài đặt; truyền shopName xuống
  CommitmentBlock/ProductAdvice, hotline/Zalo xuống StickyBuyBar.
- **Không chuyển (theo đặc tả):** `robots.ts`, `sitemap.ts`, `cart.ts`
  (domain/env), `siteConfig.commitments`, `Gallery fastDeliveryLabel`,
  `UspStrip`.

### Phần C — Kiểm và dọn nợ

| Mục | Kết quả | Ghi chú |
|-----|---------|---------|
| C1 Ảnh chụp | **ĐẠT (local)** | Dashboard local, Cài đặt Chung + Liên hệ ở 1440 và 390, footer sau khi đổi hotline, trang chủ có logo đỏ, trang Liên hệ 390 — tất cả đã xem bằng mắt, xem danh sách ảnh bên dưới. Dashboard **production** sau dọn chưa chụp (không push trong phạm vi). |
| C2 360 px không tràn | **ĐẠT** | Cài đặt chung / Liên hệ / Danh mục / Sản phẩm: `scrollWidth = 360` ở cả 4 trang. |
| C3 Toast che nút "+ Thêm sản phẩm" | **ĐẠT** | Toast quản trị dời xuống góc dưới-phải (`bottom-4`, không đo header); đo thực tế ở 1440: toast top 834–884/900, nút "+ Thêm sản phẩm" top 85–129, không chồng lấn; ảnh đã xem bằng mắt. Toast shop không đổi. |
| C4 Kiểm giờ VN sau 00:00 | **ĐẠT** | Unit test múi giờ (vnDayBounds + formatVnDateTime, 6 ca) chạy lại trong bộ test, PASS. |
| C5 `smoke-live.sh` + 2 kiểm mới | **ĐẠT** | 12 kiểm, **11/12 PASS** local. 2 kiểm mới PASS: trang chủ chứa tên website từ cài đặt; `/admin/settings/general` chưa đăng nhập → 307 `/login`. Kiểm FAIL duy nhất: Sitemap "còn chứa localhost" — ĐÚNG trên localhost (SITE_URL local là http://localhost:3000); kiểm này chỉ có ý nghĩa trên production. |

## Độ lệch (so với đặc tả + brief gốc)

1. **Nơi lưu ảnh — quyết định mới của Henry (26/11 ~07:29), ghi đè brief gốc:**
   Brief gốc nói disk-làm-chính, không Blob. Henry đổi: **Vercel Blob khi còn
   ở Vercel; disk là hướng dài hạn khi chuyển VPS**. B1.2 giờ là Blob; disk
   adapter dùng cho local (và VPS sau này); bỏ phần "thông báo upload không
   khả dụng trên Vercel" vì giờ có Blob, upload chạy được trên Vercel.
2. **A1 trái giả định đặc tả:** đặc tả ghi "đã biết còn sót 3 đơn test +
   TEST-001" trên production — kiểm kê chỉ đọc cho thấy production có **0
   đơn, không TEST-001**. A4 không có gì để xóa.
3. **A0 snapshot:** không thể pg_dump production từ máy này (không có Neon
   credentials). Ghi rõ; không xóa gì nên rủi ro bằng 0.
4. **Kiểm hợp lệ B2 không dùng zod:** đặc tả cho "zod hoặc tương đương" —
   dùng kiểm tay (không thêm dependency), tái dùng `isValidPhone` /
   `normalizePhone` / `isValidEmail` từ `checkout-validation`.
5. **B4 không có unit test:** `requireAdmin()` cần request scope của Next.js;
   kiểm bằng CDP + smoke (307) thay cho unit test, đã ghi chú trong test file.
6. **Upload ở chế độ standalone:** server standalone của Next đổi CWD về thư
   mục chứa `server.js`, nên trên máy này file upload rơi vào
   `.next/standalone/public/uploads/` (vẫn phục vụ HTTP 200 bình thường). Trên
   Docker VPS, `server.js` ở `/app/server.js` nên upload rơi vào
   `/app/public/uploads` — đúng như hướng dẫn volume trong README
   (`uploads:/app/public/uploads`, `UPLOAD_DIR=/app/public/uploads`).
   `Dockerfile` / `docker-compose.yml` vẫn **chưa** có volume uploads — thêm
   khi chuyển VPS.
7. **Lỗi tìm thấy và sửa trong lúc build (không có trong đặc tả):** trang
   Cài đặt trả 500 `Cannot read properties of undefined (reading 'siteName')`.
   Nguyên nhân: `initialSettingsFormState` (một object thuần) được export từ
   file `"use server"` (`actions.ts`) — Next biến mọi export của file đó thành
   server reference (hàm), nên `useActionState` nhận hàm làm trạng thái ban
   đầu và biểu mẫu vỡ. Sửa: chuyển object + kiểu sang module lib thuần mới
   `src/lib/admin/settings-form-state.ts` (theo đúng mẫu
   `src/lib/admin/category-form-state.ts`). Sau sửa, cả hai trang trả 200.
8. **Môi trường:** một lần thay VM giữa chừng đã xóa sạch PostgreSQL (role +
   database mất); dựng lại từ migrations + seed + recreate-test-data. Ngoài
   ra: `next dev` **ghi đè** thư mục `.next` của bản production (kể cả
   `.next/standalone`) và cơ chế load `.env` của Next mở rộng `$...` trong
   `ADMIN_PASSWORD_HASH` thành chuỗi rỗng (hash chứa `$`) nên đăng nhập admin
   trên dev trả 503 — kiểm chứng luôn dùng standalone server
   (`node --env-file=.env .next/standalone/server.js`), không dùng dev.
9. **File mồ côi có sẵn:** `public/uploads/fd96a24713dc.png` (từ 23/11, đã nằm
   ở `data/uploads` từ trước, được chuyển sang vị trí mới khi đổi thư mục mặc
   định) — không sản phẩm nào tham chiếu; giữ nguyên, không xóa dữ liệu có sẵn.

## Kiểm chứng (số liệu quan sát được, không ước đoán)

- **Unit test:** `npm test` **226/226 PASS** (nền 196; +30 mới: settings,
  storage, clean-production, seed-guard, product-validation).
- **Test DB:** `npm run test:db` **22/22 PASS** (nền 18; +4 settings:
  lưu/đọc/mặc định/seed-không-ghi-đè + audit).
- **Typecheck:** 0 lỗi. **Lint:** 0 lỗi, 2 cảnh báo (thẻ `<img>` thường ở
  Header + SettingsImageField — cố ý: logo có thể là URL Blob hoặc SVG,
  `next/image` cần remotePatterns và không tối ưu SVG).
- **Build:** exit 0. First Load JS `/` = **115 kB**; `/admin/settings/general`
  và `/admin/settings/contact` = 105 kB mỗi trang. `postbuild` đã xóa
  `.next/standalone/.env` (kiểm tra: không còn file).
- **Seed A3 kiểm trực tiếp:** `--force` trên URL Neon giả → từ chối, exit 1,
  trước mọi ghi DB; có thêm `--i-know-this-is-production` thì qua cổng bảo vệ
  (lỗi kết nối như kỳ vọng).
- **clean-production dry-run trên local:** chọn đúng đơn 0Z2DZBQNTJ + sản phẩm
  21 (TEST-001), không xóa gì; `--confirm` không kèm `--snapshot` bị từ chối.
- **CDP (headless Chrome, cookie phiên, 1440 + 390 + 360): 18/18 PASS** —
  đăng nhập; 2 trang cài đặt render; menu "Cài đặt shop" có 2 mục con thật;
  lưu tên shop mới → trang chủ hiện ngay → trả lại tên gốc; tải logo → URL
  tuyệt đối `http://localhost:3000/uploads/…` → header hiện logo → gỡ về mặc
  định; toast dưới-phải không che "+ Thêm sản phẩm"; 360 px không tràn ở 4
  trang; trang Liên hệ hiện giờ mở cửa từ cài đặt, không hiện "Đang cập nhật."
  từng dòng.
- **Kiểm logo nhìn thấy được (bổ sung): 5/5 PASS** — logo đỏ 40×40 vẽ bằng
  canvas: tải lên → lưu → header hiện đúng ảnh 40×40 (`naturalWidth` 40) →
  gỡ → header về biểu tượng mặc định.
- **Kiểm hotline B5 (bổ sung): 5/5 PASS** — lưu hotline 0901234567 → trang
  chủ/footer hiện ngay → trả về rỗng → trang chủ không còn hotline.
- **Smoke live (localhost): 11/12 PASS** (xem C5).
- **Dọn dữ liệu test sau kiểm:** `scripts/clean-test-data.ts --delete
  --only=seed,sessions` (không bao giờ dùng `--delete` trần); xóa 7 + 2 phiên
  admin test; xóa 2 + 2 dòng audit từ kiểm thử; xóa file logo test khỏi đĩa.

### Ghi chú kiểm thử (để các vòng sau khỏi vấp lại)

- Nút "Đăng xuất" ở sidebar/header admin là `type="submit"` và nằm TRƯỚC nội
  dung chính trong DOM — script CDP dùng `button[type="submit"]` không giới
  hạn sẽ bấm **Đăng xuất** thay vì Lưu, hủy phiên đang kiểm. Phải giới hạn
  trong form cài đặt (`#gs-siteName` / `#cs-hotline` → `closest("form")`).
- Kiểm render bằng `innerText.slice(0, 400)` sẽ sai vì sidebar chiếm hơn 400
  ký tự đầu — dùng toàn bộ `innerText`.
- Cookie phiên admin dùng cho CDP lấy từ lần đăng nhập curl gần nhất; phiên
  sống 12 giờ, không tự xoay.

## DB production sau dọn (kiểm kê chỉ đọc 26/11 ~00:26)

| | Số lượng |
|---|---|
| Đơn | **0** |
| Sản phẩm | **20** (tất cả dùng placeholder trong repo, HTTP 200) |
| Danh mục | **4** (không còn "Danh mục kiểm tra") |
| Khu vực | 4 (demo, giữ đến Ngày 12 theo A4) |
| Phiên admin | — (không đếm được từ ngoài; không có đơn/phiên test nào thấy được) |
| Sitemap | 29 URL |

**DB local cuối vòng (sau dọn):** 3 đơn mẫu / 21 sản phẩm / 4 danh mục /
4 khu vực / 0 phiên admin / 12 dòng `site_settings` (đúng mặc định) /
0 dòng `settings_audit`.

## Ảnh đính kèm (đã xem bằng mắt, `~/workspace/`)

- `ngay-11-settings-general-1440.png` — trang Cài đặt chung 1440
- `ngay-11-settings-general-390.png` — trang Cài đặt chung 390
- `ngay-11-settings-contact-390.png` — trang Liên hệ 390
- `ngay-11-contact-390.png` — trang Liên hệ mặt shop 390 (giờ mở cửa từ cài đặt)
- `ngay-11-home-ten-moi-1440.png` — trang chủ với tên shop test
- `ngay-11-home-co-logo-1440.png` — trang chủ với logo test (PNG trong suốt 1×1, chỉ kiểm DOM)
- `ngay-11-home-logo-do-1440.png` — trang chủ với logo đỏ 40×40 nhìn thấy được
- `ngay-11-footer-hotline-1440.png` — footer sau khi đổi hotline 0901234567
- `ngay-11-toast-duoi-phai-1440.png` — toast dưới-phải, không che "+ Thêm sản phẩm"
- `ngay-11-general-360.png`, `ngay-11-contact-360.png`,
  `ngay-11-categories-360.png`, `ngay-11-products-360.png` — 360 px không tràn
- `ngay-11-dashboard-local-1440.png` — dashboard local (dashboard production
  chưa chụp — xem A4)
- `ngay-11-home-1440.png` — trang chủ cuối vòng (đã trả tên gốc)

## Cần Henry / Claude quyết tiếp

1. **Tạo Blob store trong dashboard Vercel** (Henry tự làm) — xong thì kiểm
   "upload trên production → deploy lại → ảnh vẫn còn" mới chạy được.
2. **Nhập dữ liệu thật cho nhóm Chung + Liên hệ** trong trang Cài đặt shop
   (tên website, slogan, logo, favicon, hotline, Zalo, email, địa chỉ, giờ làm
   việc, mạng xã hội) — mặc định hiện tại giữ nguyên chữ cũ nên shop không
   đổi gì cho đến lúc đó.
3. **A1 không cần duyệt xóa** — production không có gì để xóa.
4. **Phạm vi Ngày 12+** (chờ đặc tả Claude sau Ngày 11): Ngân hàng & QR (QR
   tĩnh — Henry đã chọn), Khu vực & phí, Telegram, SEO, Chính sách.
5. Các mục Henry vẫn nợ từ trước (không đổi): tên miền + tên shop chính thức;
   tài khoản ngân hàng cho QR; khu vực/phí thật; giờ làm việc/slot giao thật;
   hotline/Zalo/địa chỉ thật; ảnh sản phẩm thật.

## File thay đổi (commit này)

Mới: `src/lib/storage.ts`, `src/lib/settings.ts`, `src/lib/settings-cache.ts`,
`src/lib/admin/clean-production.ts`, `src/lib/admin/settings-form-state.ts`,
`src/app/admin/settings/actions.ts`,
`src/app/admin/settings/general/page.tsx`,
`src/app/admin/settings/contact/page.tsx`,
`src/app/api/admin/settings/upload/route.ts`,
`src/components/admin/GeneralSettingsForm.tsx`,
`src/components/admin/ContactSettingsForm.tsx`,
`src/components/admin/SettingsImageField.tsx`,
`scripts/clean-production.ts`,
`prisma/migrations/20261126000000_settings/`,
`src/lib/settings.test.ts`, `src/lib/storage.test.ts`,
`src/lib/admin/clean-production.test.ts`, `src/lib/settings.db.test.ts`,
`public/uploads/.gitkeep`, `docs/reports/ngay-11.md`.
Sửa: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/seed-guard.ts`,
`src/lib/admin/uploads.ts`, `src/lib/admin/upload-rules.ts`,
`src/lib/admin/product-validation.ts`, `src/app/api/admin/upload/route.ts`,
`src/app/layout.tsx`, `src/app/contact/page.tsx`,
`src/app/[category]/[product]/page.tsx`, `src/components/admin/AdminNav.tsx`,
`src/components/layout/{Header,Footer,TopBar,FloatingContact,MobileMenu}.tsx`,
`src/components/product/{StickyBuyBar,CommitmentBlock,ProductAdvice}.tsx`,
`src/components/ui/Toast.tsx`, `scripts/smoke-live.sh`, `README.md`,
`.env.example`, `.gitignore`, `package.json`, `package-lock.json`, test files.
