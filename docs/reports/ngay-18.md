# Báo cáo Ngày 18 — Quản lý tin tức (27/11/2026)

Ngắn, theo mẫu Ngày 17. Toàn bộ thay đổi UNCOMMITTED, không động
vào live, indexing vẫn TẮT. Live không đổi trong đợt này.

## 1. Từng mục Ngày 18 (§9 "Ngưỡng deploy")

| Mục | Kết quả | Ghi chú |
| --- | --- | --- |
| Model `NewsArticle` + migration `day18_news` | ĐẠT | `news`, 0 tin ban đầu, không seed |
| Trang công khai `/tin-tuc` (danh sách đã xuất bản, mới nhất trước, phân trang 8/trang) | ĐẠT | Trống: "Chưa có tin tức nào." |
| Trang chi tiết `/tin-tuc/[slug]` (Markdown an toàn, ngày, tác giả khi có) | ĐẠT | Nháp/không có → 404 |
| Metadata SEO/OG (seoTitle/seoDescription, OG image = ảnh đại diện) | ĐẠT | Canonical `/tin-tuc`, OG type article |
| Admin `/admin/news` (bảng, popup căn giữa thêm/sửa, toggle, xóa có xác nhận, lọc trạng thái + tìm) | ĐẠT | Theo mẫu `/admin/pages` |
| Upload ảnh đại diện dùng lại route `/api/admin/upload` (Blob, ≤2 MB, jpeg/png/webp, magic bytes, không SVG) | ĐẠT | Không route upload mới |
| Validate (tiêu đề bắt buộc, slug duy nhất + chặn va chạm, độ dài theo mẫu trang tĩnh) | ĐẠT | `news-validation.ts`, 8 unit test |
| `tin-tuc` vào RESERVED_SLUGS + kiểm va chạm slug 3 chiều | ĐẠT | Script chạy: 0 va chạm |
| Nhật ký hoạt động (tạo/sửa/xuất bản/về nháp/xóa) + lọc khu vực "Tin tức" | ĐẠT | Nhãn "Đã xuất bản" / "Đã chuyển về nháp" |
| Tìm kiếm công khai `/search` trả cả tin tức (q ≤ 100) | ĐẠT | Chỉ bài đã xuất bản, không phân biệt dấu |
| Sitemap: `/tin-tuc` + bài đã xuất bản (lastmod updatedAt) | ĐẠT | Nháp không lộ |
| Footer: link "Tin tức" → `/tin-tuc` | ĐẠT | Cột "Về chúng tôi" |
| Sidebar: "Bài viết / Tin tức" bỏ "Sắp có" → `/admin/news` | ĐẠT | |
| Nhập/xuất tin tức | CHƯA ĐẠT | Chưa có yêu cầu cụ thể; admin tạo/sửa tay đủ cho giai đoạn này → backlog (xem §5) |

## 2. Việc 2 — 2 điểm nhỏ cuối ngày (verdict Ngày 17)

- **(a) Poll đơn mới — ĐẠT (có sửa thêm 2 hồi quy phát hiện lúc probe).**
  `NewOrderPoller.pollOnce`: khi số đơn đổi thì `router.refresh()`
  để thẻ "Đơn cần xử lý" cập nhật cùng chuông. Probe CDP:
  đơn mới vào DB → sau 60 s (1 kỳ poll) thẻ 0→1, chuông 0→1,
  toast "Có 1 đơn mới" — không reload. Lúc probe lần 1 phát hiện
  tiêu đề tab `(1)...` bị `router.refresh()` ghi đè về "Tổng quan"
  (hồi quy so với Ngày 17): đã sửa — effect tiêu đề chạy sau mọi
  lần render để khẳng định lại sau commit của refresh; probe lần 2
  (5/5 PASS): tiêu đề giữ `(1) Hoa Tươi Demo — Quản trị` cả sau
  refresh + 10 s. Lúc Pi Em kiểm độc lập lại probe (25/26) phát
  hiện thêm 1 lệch: xóa đơn → chuông về 0 nhưng thẻ giữ 1, vì
  refresh trước đây chỉ chạy khi số đơn TĂNG — đã sửa thành refresh
  khi số đơn đổi cả hai chiều (tăng hoặc giảm); toast/chuông mới/
  âm báo vẫn chỉ khi tăng; tiêu đề "(1)" vẫn giữ tới khi mở danh
  sách. Probe lại sau sửa: probe-day18 26/26, probe-poll2 5/5
  (xóa đơn → chuông 0 + thẻ 0, tiêu đề vẫn "(1)" tới khi xem).
- **(b) Nhật ký sản phẩm — ĐẠT.** Khóa `product:<id>` → `product:<sku>`
  (tra lúc hiển thị, SP đã xóa fallback id), giá định dạng
  `890.000 ₫ → 891.000 ₫` ở tầng hiển thị, dữ liệu audit đã lưu
  không đổi. Probe: sửa giá SP1 890000→891000 qua UI, audit ghi
  dưới khóa `product:HT-001.price`, `/admin/activity` hiện đúng
  `product:HT-001.price 890.000 ₫ → 891.000 ₫` (đã xem ảnh).
  Lưu ý: hàm thật là `displayActivityValue`, không có hàm
  `auditValueFor` như tên nhắc trong task.

## 3. Việc 3–5

- **Việc 3 (F2 `home-jsonld`) — ĐẠT.** Mẫu sed cũ khớp chính xác
  `<script type="application/ld+json">` nên bỏ qua thẻ mang `nonce`
  (dương tính giả). Đã sửa thành mẫu nhận thuộc tính
  (`<script[^>]*type="application/ld+json"[^>]*>`); kiểm trên HTML
  trang chủ local: mẫu cũ không khớp, mẫu mới khớp, JSON-LD
  Organization "Hoa Tươi Demo" parse được. Chạy
  `go-live-check.sh http://localhost:3000`: `home-jsonld PASS`.
  Full script exit 0 chỉ kiểm được trên live https — local còn 3
  FAIL theo thiết kế (base-https, sitemap-loc, http-to-https).
- **Việc 4 (job audit CI) — ĐẠT (chưa chạy thật trên GitHub).**
  Thêm job `audit` vào `.github/workflows/ci.yml` (file vẫn
  local-only): `npm ci` rồi `npm audit --omit=dev`, fail khi có
  High/Critical; không nới `--audit-level`, không sửa metadata
  lockfile. YAML parse được, 6 jobs. `npm audit --omit=dev` local:
  **0 vulnerabilities**.
- **Việc 5 (TTFB/nonce) — CHỈ ĐO, KHÔNG ÁP DỤNG.** Xem §4.

## 4. TTFB live + đề xuất nonce (chưa áp dụng — chờ Claude quyết)

Đo bằng curl ngày 27/11 ~21:50 (mỗi URL 3 lần), live
`flowershop-steel.vercel.app`:

| URL | TTFB lần 1/2/3 | Nền Ngày 17 |
| --- | --- | --- |
| `/` | 7,91 s (cold) / 2,27 s / 2,11 s | 1,24–1,46 s |
| `/hoa-tuoi` | 2,73 s / 2,70 s / 1,62 s | 1,46–2,65 s |
| `/hoa-tuoi/bo-hong-do-tinh-yeu` | 2,26 s / 2,21 s / 1,36 s | — |
| `/robots.txt` (đối chứng tĩnh) | 0,60 s / 0,41 s / 0,65 s | 0,38 s |

Xác nhận trong code: `src/app/layout.tsx:109` đọc `headers()`
(nonce `x-nonce` do middleware sinh mỗi request) nên mọi trang
render động: live trả `Cache-Control: private, no-cache, no-store`
+ `X-Vercel-Cache: MISS` trên `/` và `/hoa-tuoi`.

**Bằng chứng chưa kết luận nonce là nguyên nhân chính:**
`/robots.txt` là file tĩnh, `X-Vercel-Cache: HIT`, mà TTFB vẫn
0,41–0,65 s từ VM này (nền 0,38 s) — tức có một phần độ trễ
nằm ở đường mạng/edge, không phải thời gian render của app.
Local render nhanh (smoke: `/` 42 ms, SP 48 ms). Thu hẹp nonce
có thể giúp phần render động, nhưng không chắc kéo TTFB live về
dưới ~0,5 s nếu nút thắt nằm ở edge/Neon.

**Đề xuất (chưa áp dụng):** chỉ sinh nonce cho khu vực admin +
`/login`: middleware chỉ đặt `x-nonce` cho `/admin/*`, `/login`;
layout gốc không gọi `headers()` nữa (chuyển kiểm `x-admin-area`
và đọc nonce sang layout admin riêng); trang shop thành tĩnh
(prerender lúc build, dữ liệu mới nhờ `revalidatePath` đã có
trong các action admin); CSP trang shop dùng hash cho script
inline cố định thay nonce. Số đo dự kiến: TTFB warm về mức file
tĩnh (~0,4–0,6 s từ VM này) nếu nút thắt là render động; nếu
Neon/edge là nút thắt thì cải thiện ít hơn. Rủi ro: trang shop
tĩnh cần rà lại mọi chỗ đọc dữ liệu theo request (giỏ, cài đặt)
— không làm vội trong Ngày 18.

## 5. Bảng bảo mật S1–S12 (ca mới trong Ngày 18)

`npm run test:security`: **TẤT CẢ ĐẠT** — unit bảo mật 95/95
(87 cũ + 8 mới), quét tĩnh 58 ok (52 + 6), kiểm động 49 PASS
(44 + 5), quét live 21 PASS.

| S | Số ca mới | PASS/FAIL | Phát hiện | Đã sửa | Chưa test |
| --- | --- | --- | --- | --- | --- |
| S1 Phân quyền | 4 | 4 PASS | Không | — | — |
| S2 Phiên/đăng nhập | 0 | — | Không | — | TOTP (P2) vẫn chưa làm, để Ngày 19 |
| S3 Tiêm nhiễm | 10 | 10 PASS | Không | — | — |
| S4 CSRF | 0 | — | Không | — | — |
| S5 Upload | 0 (tái dùng route cũ) | — | Không | — | — |
| S6 SSRF | 0 | — | Không | — | — |
| S7 Tra cứu đơn | 0 | — | Không | — | — |
| S8 Logic đặt hàng | 0 | — | Không | — | — |
| S9 Rate-limit | 0 | — | Không | — | Tra cứu trả 200 thay vì 429 (Low, từ Ngày 17) |
| S10 Header/CSP | 0 | — | Không | — | — |
| S11 Cung ứng/bí mật | 0 (+ job audit CI mới) | — | Không | — | Job audit chưa chạy thật trên GitHub |
| S12 Nhật ký/phục hồi | 2 (db) + audit tin tức trong 6 ca db tin | PASS | Không | — | Sao lưu tự động + cảnh báo 500 (từ Ngày 17) |

Chi tiết ca mới:
- **S1 (4):** `/admin/news`, `/admin/news/new`, `/admin/news/1`
  không đăng nhập → 307 (3 ca) + `/admin/news` có `no-store` (1 ca).
- **S3 (10):** unit `news-validation` 8 ca (giới hạn độ dài, slug,
  coverImage chặn `javascript:`/`data:`); live SQLi lên slug/trang
  tin tức (`/tin-tuc/' OR 1=1--`, `?trang=...` → không 500, không
  đổi dữ liệu, 1 ca); live XSS lưu qua tin tức — payload vào
  tiêu đề/nội dung/tác giả/tóm tắt, kiểm HTML ở `/tin-tuc`,
  chi tiết và `/admin/news`: payload thô không xuất hiện, dạng
  escaped có (1 ca). Markdown fuzz ReDoS 50 ms: dùng chung
  `renderMarkdown` đã có test ở `markdown.test.ts`, không test mới.
  Không thêm `dangerouslySetInnerHTML` mới ngoài 2 chỗ dùng
  `renderMarkdown` đã cho vào allowlist (xem dưới).
- **S5 (0 ca mới):** upload ảnh đại diện tái dùng đúng route
  `/api/admin/upload` đã có ca: PNG chứa HTML/PHP → 400, đổi
  đuôi → 400, >2 MB → 400/413, 7000 px → 400, ảnh hỏng → 400,
  tên `../../evil.png` → 200 + URL băm.
- **Quét tĩnh (+6):** 4 server action tin tức gọi `requireAdmin()`
  đầu tiên + 2 mục DSI allowlist (`tin-tuc/[slug]` và `NewsForm`,
  đều render qua `renderMarkdown` đã thoát HTML).
- **S12:** audit tin tức (tạo/sửa/xuất bản/về nháp/xóa) phủ trong
  `news.db.test.ts` (6 ca); `resolveActivityKeys` + lọc area news
  phủ trong `activity.db.test.ts` (2 ca mới).

## 6. Số kiểm chứng (log thật, không bịa)

- Unit `npm test`: **404/404 PASS** (114 suites; nền 386).
- test:db (recreate → test:db → clean): **101/101 PASS**
  (92 cũ + 9 mới: tin tức 7, activity 2).
- Typecheck: **0 lỗi**. Lint: **0 lỗi, 2 warning `<img>` cũ**.
- Build: OK, First Load JS `/` = **115 kB** (bằng nền fixup 3),
  `/tin-tuc` 112 kB, `/admin/news` 111 kB.
- Smoke local: **20/21** — FAIL duy nhất `sitemap-localhost` là
  kỳ vọng (`.env` local đặt `SITE_URL=http://localhost:3000`).
- So `<head>` 4/4 với nền fixup 3
  (`~/workspace/day18-shots/day18-heads.mjs`).
- `npm audit --omit=dev`: **0 vulnerabilities**.
- Kiểm va chạm slug: **0 va chạm** (4 danh mục, 3 trang, 0 tin).
- CDP probe `~/workspace/day18-shots/probe-day18.mjs`: **26/26
  PASS** (lần chạy 2; lần 1: 24/24 tới H0 rồi lỗi INSERT đơn
  probe thiếu `createdAt`/`updatedAt` — đã sửa script, và H2
  kỳ vọng sai đã sửa thành kiểm chuông). Probe poll tập trung
  `probe-poll2.mjs`: **5/5 PASS**. Ảnh đã xem bằng mắt:
  `/tin-tuc` trống + danh sách + chi tiết, `/admin/news`,
  `/search` có section Tin tức, `/admin/activity` SKU + giá,
  tổng quan khi có đơn mới (chuông 1, thẻ 1, toast "Có 1 đơn mới").
- DB cuối đợt: **20|0|3|0|24|0|0|4|0** + **0 tin tức**; cài đặt
  ngân hàng về gốc (rỗng, enabled false, mẫu `DH {ORDER_CODE}`).
  `clean-test-data.ts` đã thêm scope tin tức (`test-*`) và
  scope rate-limit (dọn 8 sự kiện test).

## 7. Mục còn thiếu / chưa làm

- Nhập/xuất tin tức: chưa đạt, backlog (xem §1).
- **TOTP cho admin (S2, P2): chưa làm, để Ngày 19.**
- S0 token GitHub cũ chờ Henry thu hồi (không hỏi, không nhắc).
- Chuyển khoản khi BẬT chưa kiểm live; Safari/Firefox chưa kiểm;
  Lighthouse chưa đo (từ Ngày 17).
- Rate-limit tra cứu trả 200 thay vì 429 (Low); fail-open khi DB
  bộ đếm lỗi (Medium); sao lưu tự động + cảnh báo 500 chưa có;
  CI chưa chạy thật trên GitHub (từ Ngày 17).

## 8. Kiểm chứng độc lập (điều phối viên — chạy lại toàn bộ, 27/11 ~22:xx)

- Unit `npm test`: **404/404 PASS** (114 suites); test:db (recreate →
  test:db → clean): **101/101 PASS** (28 suites); typecheck **0 lỗi**;
  lint **0 lỗi, 2 warning `<img>` cũ**; build OK, First Load JS `/`
  **115 kB**; smoke local **20/21** (chỉ sitemap-localhost, kỳ vọng);
  `<head>` **4/4** giống nền fixup 3; `npm run test:security`
  **TẤT CẢ ĐẠT**; `npm audit --omit=dev` **0 vulnerabilities** — tất
  cả khớp số builder báo.
- Đọc code mới: `news.ts` theo đúng mẫu trang tĩnh (transaction +
  audit, chặn va chạm slug hai chiều, `publishedAt` đặt khi xuất bản
  lần đầu, `React.cache()` gộp metadata + render); `searchNews`
  dùng `Prisma.sql` tham số hóa (không nối chuỗi); migration chỉ
  CREATE TABLE + index (chỉ thêm); `package.json` chỉ thêm 2 file
  test vào script test/test:db.
- Ảnh chụp của builder đã xem bằng mắt: `/tin-tuc` (thẻ bài, ngày,
  tác giả, tóm tắt, link "Tin tức" ở footer), `/admin/activity`
  hiện `product:HT-001.price 890.000 ₫ → 891.000 ₫` — đúng.
- **1 lệch tìm thấy lúc kiểm lại (đã sửa trong đợt này, trước khi
  commit):** probe-day18 chạy lại chỉ **25/26** — H2 FAIL: xóa đơn
  probe → chuông về 0 nhưng thẻ "Đơn cần xử lý" giữ 1, vì
  `router.refresh()` trước đây chỉ chạy khi số đơn TĂNG. Đây là
  cùng kiểu lệch chuông/thẻ mà Claude yêu cầu sửa (hai con số khác
  nhau), chỉ khác chiều. Đã sửa `NewOrderPoller.pollOnce`: refresh
  RSC khi số đơn đổi cả hai chiều (tăng hoặc giảm); toast/chuông
  mới/âm báo vẫn chỉ khi tăng; tiêu đề "(1)" vẫn giữ tới khi mở
  danh sách. Probe chạy lại sau sửa: **probe-day18 26/26** (H2:
  thẻ về 0 sau 60 s), **probe-poll2 5/5** (P3: chuông 0 + thẻ 0,
  tiêu đề vẫn "(1)" tới khi xem). Không đổi unit test (logic thuần
  không đổi); đã cập nhật kỳ vọng P3 trong `probe-poll2.mjs` và
  mục §2(a) trong báo cáo này.
- TTFB live đo lại (curl, ~22:xx): home 5,41 s (cold) / 1,37 s /
  1,28 s (warm — khớp nền Ngày 17: 1,24–1,46 s); robots.txt tĩnh
  1,33 s (nền 0,38 s) — đối chứng tĩnh cũng chậm lúc này nên chưa
  kết luận nonce là nguyên nhân chính; ủng hộ đề xuất §4 (chờ
  Claude quyết, không tự đổi).
- Lưu ý: job audit CI dùng `npm audit --omit=dev` với mức mặc
  định (low) nên Low/Moderate cũng làm fail — chặt hơn mức yêu cầu
  "fail khi High/Critical", là lựa chọn chủ ý, ghi lại để Claude
  biết (không phải lỗi).
- DB cuối đợt: **20|0|3|0|24|0|0|4|0|0** + **0 tin tức**; ngân hàng
  về gốc (rỗng, enabled false, mẫu `DH {ORDER_CODE}`). Server
  local đã dừng sau kiểm chứng.

## 9. File đổi (1 commit duy nhất trên c75e60f, không push)

Như §8, cộng thêm sửa H2 ở `src/components/admin/NewOrderPoller.tsx`
trong cùng commit. Probe scripts (`~/workspace/day18-shots/`) không
nằm trong repo nên không commit.

Tạo mới: `prisma/migrations/20261127142923_day18_news/`,
`src/lib/admin/news.ts`, `news-validation.ts`,
`news-validation.test.ts`, `news.db.test.ts`,
`news-form-state.ts`, `src/components/admin/NewsForm.tsx`,
`ToggleNewsButton.tsx`, `DeleteNewsButton.tsx`,
`NewsFilterBar.tsx`, `src/app/admin/news/` (list/new/[id]),
`src/app/admin/@modal/(.)news/` (new/[id]),
`src/app/tin-tuc/` (list/[slug]).
Sửa: `prisma/schema.prisma`, `src/lib/reserved-slugs.ts`,
`src/lib/admin/products.ts`, `src/lib/admin/activity.ts`,
`src/app/admin/activity/page.tsx`,
`src/components/admin/NewOrderPoller.tsx`,
`src/components/admin/AdminNav.tsx`,
`src/components/layout/Footer.tsx`, `src/app/sitemap.ts`,
`src/app/search/page.tsx`, `src/lib/search.ts`,
`src/lib/vn-datetime.ts`, `src/app/actions/admin.ts`,
`src/lib/admin/toggle-toast.ts`,
`src/lib/admin/catalog-p5.db.test.ts`,
`src/lib/admin/activity.test.ts`,
`src/lib/admin/activity.db.test.ts`,
`src/lib/admin/toggle-toast.test.ts`,
`src/lib/vn-datetime.test.ts`, `package.json`,
`scripts/check-slug-collisions.ts`,
`scripts/clean-test-data.ts`, `scripts/go-live-check.sh`,
`scripts/security-scan.mjs`, `scripts/security-live-check.ts`,
`scripts/test-security.mjs`, `.github/workflows/ci.yml`
(job audit, file vẫn local-only).
