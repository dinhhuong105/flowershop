# Báo cáo Ngày 13 — Trang tĩnh & chính sách + SEO/meta (trên commit 20a8c8d)

Ngày 26/11/2026. Đặc tả: `~/workspace/ngay-13-dac-ta.md` (109 dòng).
Henry duyệt Ngày 13 ngày 26/11 ~12:34, A5 = (a) GIỮ NGUYÊN (không thêm cột snapshot
ngân hàng vào đơn) — A5 đóng bằng quyết định của Henry, không có code.
KHÔNG push, KHÔNG chạm production. Live do Pi Em kiểm sau.

## B0 — Kiểm kê trang có sẵn (chỉ đọc, làm trước khi viết code)

| Đường dẫn | File | Hiện trạng |
|---|---|---|
| /about | src/app/about/page.tsx | Cố định: Giới thiệu, Chúng tôi bán gì, Giao hàng, Liên hệ |
| /faq | src/app/faq/page.tsx | Cố định: ITEMS + Accordion |
| /contact | src/app/contact/page.tsx | Đọc getSettings() |
| /policy | src/app/policy/page.tsx | Cố định: Giao hàng, Thanh toán, Đổi trả, Bảo mật |

- Footer "Chính sách" → /policy ("Chính sách giao hàng, thanh toán, đổi trả").
- RESERVED_SLUGS lúc kiểm: 22 mục (cart, checkout, order, search, faq, about, contact,
  policy, van-chuyen, doi-tra, bao-mat, lien-he, admin, login, api, _next, images,
  uploads, sitemap.xml, robots.txt, favicon.ico).
- Quyết định route: `/trang/[slug]` — đoạn tĩnh "trang" thắng `[category]/[product]`
  (không trùng route nào); đã thêm "trang" vào RESERVED_SLUGS.

## A — Nợ Ngày 12

- **A1 — ĐẠT (phần code).** `src/lib/storage.ts`: `StorageWriteError` thêm `code`
  (`blob-denied` | `blob-exists` | `blob-network` | `blob-unknown`); `classifyBlobError()`
  (theo `error.name` + message: BlobPreconditionFailedError → exists; BlobAccessError /
  BlobClientTokenExpiredError / BlobStoreNotFoundError / BlobStoreSuspendedError → denied;
  BlobServiceNotAvailable / BlobServiceRateLimited / lỗi mạng → network; còn lại unknown);
  `sanitizeBlobErrorMessage()` che token trong log; `put()` thêm `allowOverwrite: true` +
  `access: "public"`; lỗi put được bọc thành StorageWriteError kèm code + console.error;
  lỗi `del()` log rồi trả false (giữ hợp đồng deleteImage). **Giá trị `access` đang dùng:
  `"public"`.** Test mock: 7 case mới trong `src/lib/storage.test.ts` (allowOverwrite +
  access được truyền, 4 nhánh phân loại, del lỗi → false + log không chứa token) —
  storage.test.ts 22/22.
  - **A1 bước 4–5 — việc của Henry (chưa làm):** deploy rồi đọc Vercel Runtime Logs để
    thấy lỗi thật (giờ log có mã `blob-denied` / `blob-exists` / `blob-network` /
    `blob-unknown`); kiểm tra Storage/Connect, token có đúng store + scope Production
    không, store đang Private hay Public (code ghi `access: "public"`).
- **A2 — ĐẠT (có sửa thật).** Bank: fallback env BANK_* đã có từ Ngày 12, KHÔNG sửa.
  Telegram: phát hiện 2 lệch so với hành vi trước Ngày 12, đã sửa cả hai — (1) mặc định
  `telegramEnabled` hardcode `false` (giờ suy ra từ env token+chat id qua
  `defaultTelegramEnabledFromEnv()`); (2) đường gửi thông báo không hề đọc toggle
  (giờ `isTelegramNotifyEnabled()`: hàng DB thắng, không có hàng thì đọc env, lỗi đọc
  DB thì fallback env; chỉ chặn thông báo đơn tự động — gửi lại tay, gửi thử và thông
  báo đổi ngân hàng là thao tác chủ động của admin nên không chặn). Test: unit cho 2
  hàm thuần trong `src/lib/settings.test.ts`; describe mới trong
  `src/lib/settings.db.test.ts` (4 test: subprocess chứng minh không-hàng + env → bật,
  không-env → tắt; hàng DB tắt thắng env; gate gửi thật với fetch mock).
- **A3 — CHƯA LÀM (việc của Henry):** snapshot/nhánh Neon.
- **A4 — ĐẠT.** `AdminNav`: useEffect + navRef, khi đổi pathname thì
  `querySelector('[aria-current="page"]')` trong nav → `scrollIntoView({block:"nearest"})`
  (chỉ cuộn trong nav). CDP: 1280×700 mục "Cài đặt SEO" trong vùng nhìn thấy (scrollTop
  510); drawer 390×844 cũng vậy. (Dung sai 1px do làm tròn sub-pixel: đáy mục 624.375
  so với đáy nav 624 — xem "Độ lệch".)
- **A5 — ĐÃ ĐÓNG (quyết định của Henry, không code).**
- **A6 — CHƯA KIỂM TRA (cần token Telegram thật của Henry trong env Vercel).**

## B — Trang tĩnh & chính sách

- **B1 — ĐẠT.** Bảng `pages` (migration `20261126055603_pages`, rollback = DROP TABLE):
  id, slug unique, title, content, isPublished (mặc định false), seoTitle,
  seoDescription, sortOrder, showInFooter (mặc định false), createdAt, updatedAt.
  `src/lib/admin/page-validation.ts`: tiêu đề 2–120, slug 2–60 + PRODUCT_SLUG_RE +
  không thuộc RESERVED_SLUGS + không trùng slug danh mục, gợi ý slug từ tiêu đề như
  danh mục, nội dung ≤ 20.000, sortOrder 0–9999, isPublished/showInFooter boolean.
  Sửa slug ở trang đã xuất bản hiện cảnh báo "Đổi đường dẫn sẽ làm link cũ của trang
  đã xuất bản báo 404." (CDP kiểm thật). `src/lib/admin/pages.ts`: CRUD + bật/tắt +
  xóa, mọi thay đổi ghi `settings_audit` khóa `page:<slug>` trong cùng transaction.
- **B2 — ĐẠT.** `src/lib/markdown.ts`: render thoát-trước (escape-first) — tiêu đề #
  → h2 / ## → h3 / ### → h4 (trang đã có h1 riêng), **đậm**, *nghiêng*, ul/ol, đoạn;
  link chỉ https:/tel:/mailto:/nội bộ, link ngoài thêm `rel="noopener noreferrer"`;
  không HTML thô, không ảnh. Test `src/lib/markdown.test.ts` 8/8 (kể cả `<script>`,
  `javascript:`, `onerror=`, HTML lồng nhau đều bị vô hiệu; http:, data:, `//` bị từ chối).
- **B3 — ĐẠT.** `/admin/pages`: menu "Trang tĩnh" thành link thật; bảng (≥768px) +
  thẻ (<768px), cột Tiêu đề/Slug/Trạng thái/Chân trang/Cập nhật; popup thêm/sửa rộng
  (intercepting route `(.)pages/new`, `(.)pages/[id]`, tái dùng ProductModal max-w-3xl)
  + trang đầy đủ khi vào trực tiếp URL; xem trước Markdown trực tiếp + bộ đếm ký tự
  20.000/120/160; bật/tắt xuất bản không cần xác nhận + toast Hoàn tác (5 giây);
  xóa có hộp xác nhận; ghi audit. CDP 27/27 (xem D4): thêm trang (slug tự gợi ý
  "trang-kiem-thu-cdp"), xem trước render đúng h2/bold/link, slug cấm "admin" → lỗi
  + GIỮ NGUYÊN giá trị đã nhập (bài học Ngày 12 — form dùng
  `dispatch(new FormData(form))`), lưu → 4 trang, bật xuất bản → toast, xóa → về 3 trang.
- **B4 — ĐẠT.** `/trang/[slug]`: chỉ trang đã xuất bản → 200 (tiêu đề qua titleTemplate,
  vd "Giới thiệu | Hoa Tươi Demo"), nháp/không có → 404. Footer: thêm cột "Trang tĩnh"
  liệt kê trang đã xuất bản + showInFooter theo sortOrder — chỉ hiện khi có ít nhất
  một trang (kiểm live: bật tạm Giới thiệu + showInFooter → cột hiện link
  /trang/gioi-thieu; tắt → biến mất; các mục footer cũ giữ nguyên). Sitemap thêm trang
  đã xuất bản (kiểm live: bật → có /trang/gioi-thieu, tắt → mất). Seed 3 trang NHÁP
  trong `prisma/seed.ts` (chỉ khi bảng trống, độc lập với chặn seed demo):
  `gioi-thieu`, `chinh-sach-giao-hang-thanh-toan`, `chinh-sach-doi-tra` — nội dung chỉ
  là gạch đầu dòng "chủ shop cần điền", KHÔNG có nội dung chính sách thật.

## C — SEO/meta

- **C1 — ĐẠT.** Nhóm `seo` trong `src/lib/settings.ts`: titleTemplate mặc định
  `%s | Hoa Tươi Demo` (giữ đúng cách đặt tiêu đề hiện nay), defaultDescription mặc
  định = mô tả hiện nay, defaultOgImage "", metaKeywords "", allowIndexing true.
  `validateSeoValues`: mẫu bắt buộc, chứa `%s` đúng một lần, ≤ 80; mô tả ≤ 160 (được
  để trống); OG phải là jpg/png/webp (không SVG); từ khóa ≤ 200, tùy chọn. Tổng khóa
  seed 19 → 24 (test seed đã cập nhật). Route upload thêm purpose `"og"` (jpg/png/webp,
  ≤ 1 MB, từ chối SVG); `SettingsImageField` thêm prop `accept` + `onUrlChange` (đồng
  bộ xem trước OG).
- **C2 — ĐẠT.** `/admin/settings/seo`: menu "Cài đặt SEO" thành link thật; form +
  bộ đếm ký tự (80/160/200), cảnh báo nhẹ khi mô tả < 50 ký tự, ghi chú "các công cụ
  tìm kiếm lớn không dùng từ khóa này để xếp hạng"; xem trước kết quả tìm kiếm + thẻ
  OG (cập nhật theo mẫu — CDP kiểm: đổi mẫu → xem trước đổi theo); lưu → shop cập
  nhật ngay qua revalidateTag; tắt allowIndexing → hộp xác nhận (CDP: hủy → chưa lưu,
  robots vẫn Allow; lưu lại → hộp hiện lại; xác nhận → lưu). Form dùng
  `dispatch(new FormData(form))` (bài học Ngày 12): mẫu sai → lỗi từng trường + giữ
  giá trị (CDP kiểm).
- **C3 — ĐẠT.** Layout `generateMetadata` đọc titleTemplate/defaultDescription/
  defaultOgImage/metaKeywords/allowIndexing từ getSettings(); mẫu rỗng/sai → dùng lại
  mẫu mặc định (không bao giờ để tiêu đề trống); mô tả rỗng → dùng slogan; OG image
  qua `toAbsoluteImageUrl` (1200×630 khi có); allowIndexing=false → meta noindex +
  `robots.ts` Disallow "/" (CDP kiểm cả hai chiều: tắt → noindex + Disallow /; bật
  lại → hết). JSON-LD Organization trong layout (chỉ khu vực shop, chỉ field đã điền:
  tên, logo, điện thoại, địa chỉ, sameAs, url từ env — KHÔNG bịa đánh giá/tọa độ/giờ
  mở cửa có cấu trúc). Trang sản phẩm/danh mục/trang tĩnh giữ tiêu đề riêng trong mẫu.
  **So sánh `<head>` với baseline Ngày 13: y hệt trên trang chủ, 1 sản phẩm, 1 danh
  mục (sau khi chuẩn hóa hash file build).** Không đổi canonical/sitemap/robots ngoài
  allowIndexing + trang tĩnh.

## D — Kiểm tra

- **D1 — ĐẠT.** 6 ảnh trong `~/workspace/ngay-13-*.png` (đã mắt kiểm từng ảnh):
  pages-1440, seo-1440, page-popup-1440, page-edit-1440, pages-390, seo-390. Không
  tràn ngang ở 360px (danh sách trang) và 390px (SEO): scrollWidth == clientWidth.
- **D2 — ĐẠT.** `scripts/smoke-live.sh`: 15 → 19 mục (thêm `/trang/gioi-thieu` → 404;
  `/admin/pages` + `/admin/settings/seo` chưa đăng nhập → 307 /login; sitemap đếm
  đúng số trang đã xuất bản qua `SMOKE_EXPECTED_PUBLISHED_PAGES`, mặc định 0).
  Chạy local: **18/19 PASS** — chỉ FAIL mục sitemap-localhost (domain local là
  localhost, đúng như kỳ vọng ở local; trên production mục này PASS).
- **D3 — ĐẠT.** Còn **7** mục "Sắp có": Bài viết, Yêu cầu liên hệ, Khách hàng, Tin
  nhắn, Tài khoản, Vai trò, Nhật ký. (Đếm trong nav đang hiện — trang render 2 nav
  desktop + drawer nên đếm thô ra 14.)
- **D4 — ĐẠT.**
  - Unit test: **280/280** (từ 251; mới: storage 22/22, markdown 8/8,
    page-validation 8/8, settings 26/26 gồm A2 + C1).
  - test:db: **34/34** (từ 30; +4 test A2).
  - Typecheck: 0 lỗi. Lint: 0 lỗi, 2 warning `<img>` có sẵn từ trước.
  - Build OK. First Load JS: `/` **115 kB** (≤ 135 kB, bằng Ngày 12),
    `/admin/pages` 109 kB, `/admin/settings/seo` 107 kB, `/trang/[slug]` 103 kB.
  - Smoke local: 18/19 (xem D2). CDP (Chrome headless, server standalone):
    **27/27 PASS** — danh sách, A4 (1280×700 + drawer 390), popup thêm/sửa, slug
    tự gợi ý, xem trước Markdown, lỗi slug + giữ giá trị, lưu/xóa, bật/tắt + toast
    Hoàn tác, /trang 200/404, footer, SEO (lỗi mẫu + giữ giá trị, xem trước, hộp
    xác nhận tắt index cả hai chiều), noindex + robots, không tràn 360/390, cảnh
    báo đổi slug trang đã xuất bản.
  - DB cuối: 3 trang (0 xuất bản), 24 khóa cài đặt, 0 audit, 0 session,
    21 sản phẩm, 3 đơn — sạch như baseline (dữ liệu test đã dọn).

## Độ lệch (so với đặc tả)

1. `seoTitle` ≤ 120 và `seoDescription` ≤ 160 là giới hạn do người làm chọn — đặc tả
   không ghi giới hạn cho 2 trường này.
2. Trang seed có `showInFooter=false` (theo mặc định B1) — không tự hiện ở footer khi
   xuất bản; Henry phải tick "Hiện ở chân trang" từng trang. Mục footer cũ (/policy…)
   KHÔNG tự gỡ khi có trang thay thế — việc thay thế do Henry quyết từng trang.
3. `titleTemplate` mặc định lưu tên shop theo chữ lúc mặc định (`%s | Hoa Tươi Demo`);
   đổi tên shop trong Cài đặt chung thì phải sửa lại mẫu ở trang Cài đặt SEO (đã ghi
   chú trong code).
4. Layout lúc đầu thêm `og:url` + `og:site_name` vào Open Graph — đã bỏ lại cả hai vì
   `og:url` lấy từ layout sẽ sai trên trang danh mục/trang tĩnh (phải là URL của chính
   trang đó); `<head>` mặc định nhờ vậy y hệt baseline. Đặc tả C3 không yêu cầu 2 thẻ này.
5. Kiểm A4 dùng dung sai 1px: mục đang chọn có đáy 624.375 so với đáy nav 624 (làm
   tròn sub-pixel) — thực tế mục đã nằm trong vùng nhìn thấy.
6. Gate Telegram chỉ chặn thông báo đơn TỰ ĐỘNG; gửi lại tay, gửi thử, thông báo đổi
   ngân hàng là thao tác chủ động của admin nên không chặn.
7. Cảnh báo đổi slug hiện với mọi lần đổi slug ở chế độ sửa (chữ "đã xuất bản" chỉ
   thêm khi trang đang xuất bản).
8. Hủy trong hộp xác nhận tắt lập chỉ mục thì checkbox vẫn ở trạng thái bỏ chọn (sửa
   chưa lưu) — giá trị đã lưu không đổi; bấm Lưu lần nữa thì hộp xác nhận hiện lại.
9. Môi trường: VM bị thay thế giữa chừng đã xóa PostgreSQL + Chrome — đã dựng lại DB
   từ migration + seed và cài lại Chrome; không ảnh hưởng code.

## Việc còn chờ Henry (không thuộc build này)

- A1 bước 4–5: deploy + đọc Vercel Runtime Logs (log giờ có mã lỗi rõ) + kiểm tra
  Storage/Connect, token đúng store + scope Production, store Private/Public.
- A3: snapshot/nhánh Neon.
- A6: token Telegram thật vào env Vercel để kiểm nhận tin thật.
- A5: đã quyết (a) — không còn việc.

## File thay đổi (1 commit, trên 20a8c8d)

- Mới: `prisma/migrations/20261126055603_pages/`, `src/lib/markdown.ts`,
  `src/lib/admin/page-validation.ts`, `src/lib/admin/pages.ts`,
  `src/lib/admin/page-form-state.ts`, `src/components/admin/PageForm.tsx`,
  `src/components/admin/TogglePageButton.tsx`, `src/components/admin/DeletePageButton.tsx`,
  `src/components/admin/SeoSettingsForm.tsx`, `src/app/admin/pages/` (list/new/[id]),
  `src/app/admin/@modal/(.)pages/` (new/[id]), `src/app/admin/settings/seo/`,
  `src/app/trang/[slug]/`.
- Sửa: `prisma/schema.prisma`, `prisma/seed.ts`, `scripts/smoke-live.sh`,
  `src/lib/settings.ts`, `src/lib/telegram.ts`, `src/lib/storage.ts`,
  `src/lib/reserved-slugs.ts`, `src/app/layout.tsx`, `src/app/robots.ts`,
  `src/app/sitemap.ts`, `src/app/actions/admin.ts`,
  `src/app/admin/settings/actions.ts`, `src/app/api/admin/settings/upload/route.ts`,
  `src/components/admin/AdminNav.tsx`, `src/components/admin/SettingsImageField.tsx`,
  `src/components/layout/Footer.tsx`, `src/lib/admin/toggle-toast.ts`,
  `package.json` (test script), test files.
- Ảnh: 6 file `~/workspace/ngay-13-*.png` (đã mắt kiểm).
