# Báo cáo Ngày 9 — Đóng nợ Ngày 8 và xác minh production (+ dashboard + FAQ/SEO)

Ngày: 2026-11-24. Base: commit `821f3a7` (Ngày 8 + sửa tối 24/11, đã push).
Báo cáo này ghi trên một commit mới trên `821f3a7` (xem `git log -1`
lấy mã commit Ngày 9; KHÔNG sửa commit cũ). Chưa push.
Đặc tả: `~/workspace/ngay-9-dac-ta.md` (Claude trả lời trong chat Ngày 8
https://claude.ai/chat/ff815f24-b64c-4274-b53e-c4fd04c3bc15, 24/11 ~20:29).
Henry duyệt 24/11 20:34: **làm cả hai** — Phần A (D9-1..D9-7) + Phần B
(D9-8 dashboard) + lộ trình gốc Ngày 9 (FAQ/chính sách/giới thiệu/
liên hệ + SEO + sitemap).

Kết quả: **D9-1..D9-8 ĐẠT** (D9-2 có ghi chú cold start; D9-3 tìm thêm
1 lỗi phân trang thật và đã sửa trong Ngày 9).

## Môi trường

- VM thay mới giữa chừng (lần 2 trong ngày, khoảng 20:40–20:50):
  PostgreSQL + Chrome bị xóa. Dựng lại PostgreSQL 16.15, Chrome 158
  (`apt-get update` mất ~10 phút qua proxy). DB local dựng lại từ
  migration + seed (6 migration, 4 danh mục, 20 sản phẩm, 4 khu vực);
  3 đơn test + SP 21 tạo lại đúng giá trị báo cáo Ngày 7 bằng script
  mới `scripts/recreate-test-data.ts` (chỉ chạy khi DB ở localhost,
  chạy lại bỏ qua dữ liệu đã có).
- Máy kiểm: local port 3000 (build standalone mới, `.env`); live
  https://flowershop-steel.vercel.app/ chỉ cho D9-1/D9-2.
- Test: **176/176 PASS** (169 + 7 mới), **test:db 5/5 PASS**; typecheck 0,
  lint 0, build OK. First Load JS `/` = **115 kB** (≤ 135 kB).
- Kiểm live dùng phiên admin tạo trực tiếp trong DB local (token ngẫu
  nhiên, chỉ để kiểm tra; đã xóa khi dọn dữ liệu).

## D9-1 Xác minh production sau deploy 821f3a7 — ĐẠT

**(b) migrate-status — ĐÃ XÁC MINH (không còn bị chặn).** Redeploy an
toàn cùng commit 821f3a7 lên Vercel xong, deployment
`DdeCACjzUXVph3EJyz5XzSJnuary`, trạng thái Ready/Production lúc
21:03:47 ngày 24/11. Log build ghi nguyên văn: lệnh build
`prisma generate && prisma migrate deploy && prisma db seed && next
build`; đã kết nối Neon database "neondb"; `6 migrations found in
prisma/migrations`; `No pending migrations to apply.` — cả 6 migration
đã áp trên production, gồm `20261123210000_admin` (Ngày 7) và
`20261124144500_order_management` (Ngày 8, thêm paidAt, internalNote,
bảng order_events). Seed cũng chạy xong (4 danh mục, 20 sản phẩm,
4 khu vực giao). Kết luận: `DATABASE_URL` trên production còn nguyên —
sự kiện "edited" lúc ~20:37 chỉ là thao tác mở form rồi hủy, không thay
đổi giá trị — và **Henry không cần đặt lại từ Neon nữa**. README đã
cập nhật mục "Triển khai production (Vercel) và migration" với bằng
chứng này + quy trình từ nay (build chạy `prisma migrate deploy`;
sau mỗi deploy kiểm: (1) deployment Ready đúng commit, (2) `prisma
migrate status` khi có chuỗi kết nối, (3) kiểm live bằng GET).

**(a) Kiểm live bằng GET (tự kiểm lại sau redeploy, 24/11 ~21:07,
curl từ VM):** `/` 200; `/hoa-tuoi/bo-hong-do-tinh-yeu` 200;
`/cart` 200; `/checkout` 307 → `/cart` (giỏ trống); `/order/KHONGTONTAI`
404 + tiêu đề `<title>Không tìm thấy trang | Hoa Tươi Demo</title>`
(chứng minh code 821f3a7 đang live); `/order/QAFNN907ZY` 404 (không có
đơn test trên production); `/admin/orders` 307 → `/login` với
`Cache-Control: private, no-cache, no-store, max-age=0,
must-revalidate`; `/admin` 307 → `/login`. `/faq` và `/sitemap.xml`
404 — đúng như dự kiến vì Ngày 9 chưa deploy. Kiểm trước redeploy
(24/11 ~20:36) cũng đạt tương tự. Không tạo đơn test trên production.

## D9-2 Đăng nhập live — ĐẠT (ghi chú cold start)

Ba lần POST mật khẩu sai tới live `/api/admin/login`, cách nhau ≥ 60
giây, đều 401, không 429: **5,96 s; 5,02 s; 1,64 s** (ttfb ≈ tổng).
Thời gian giảm dần → cold start đang ấm lên; lần ấm 1,64 s < 3 s nên
không đào sâu vùng function/DB hay chi phí băm (chi phí scrypt
N=32768 cỡ 0,1–0,2 s, không giải thích được dao động cỡ giây).
Đã dùng: 1 lần 20:24 + 3 lần này = 4 lần trong cửa sổ, dưới giới hạn
5/IP. Rate-limit lưu ở **DB** (bảng `admin_login_attempts` qua Prisma,
`src/lib/admin/rate-limit.ts`: 5/IP/15 phút, 20 toàn hệ thống/15 phút,
IP băm sha256) — không phải bộ nhớ tiến trình nên không cần chuyển;
không đổi code, chỉ ghi vào báo cáo.

## D9-3 Phân trang live (local) — ĐẠT (tìm thêm 1 lỗi, đã sửa)

`scripts/seed-test-orders.ts` mới: 45 đơn `SEED000001..SEED000045`,
người đặt "Seed Phân Trang", từ chối khi `NODE_ENV=production` hoặc
host `DATABASE_URL` không phải localhost; phân bố 20 NEW / 10
CONFIRMED / 5 DELIVERING / 5 COMPLETED / 5 CANCELLED (đơn 44
COD/UNPAID/CANCELLED để kiểm phiếu giao; đơn 45 BANK_TRANSFER/PAID/
CANCELLED để kiểm lời nhắn hoàn tiền; đơn COMPLETED có sự kiện
STATUS_CHANGE → COMPLETED để kiểm doanh thu); ngày giao rải 24–28/11.

Kiểm live trên máy local (đã đăng nhập quản trị):
- Tab "Tất cả": các trang **20/20/8** (48 đơn = 45 seed + 3 test).
  Tìm `q=Seed` + tab "Tất cả": **20/20/5**.
- `page=99`: 0 đơn, hiện "trang 99/3", tổng vẫn 48.
- `page=0` và `page=abc`: về trang 1 (200).
- Giữ tab/tìm/lọc khi chuyển trang: `pageHref` giữ tab/q/payment/date,
  `tabHref` giữ q/payment/date (đổi tab thì về trang 1). Tìm mới khi
  đang ở trang 2 thì bắt đầu lại từ trang 1 (form tìm không có trường
  page); mở thẳng `q=Seed&page=2` trả đúng trang 2 của kết quả lọc
  (20 đơn).
- Số đếm tab: Cần xử lý 38, Đã tiếp nhận 23, Đã xác nhận 10, Đang giao
  5, Đã giao 5, Đã hủy 5, Tất cả 48 — khớp DB.

**Lỗi tìm được khi kiểm (đã sửa trong Ngày 9):** tổng số đơn lấy từ
`COUNT(*) OVER()` của trang hiện tại nên trang vượt quá (page=99)
trả 0 dòng → tổng thành 0 dù vẫn có đơn. Sửa: tổng lấy từ số đếm tab
(`counts[tab]`, cùng truy vấn GROUP BY). `test:db` bắt đúng lỗi này
(1 test lỗi trước sửa, 5/5 sau sửa).

`scripts/clean-test-data.ts` mở rộng: thêm phạm vi `--only=seed`
(chỉ xóa đơn seed, giữ 3 đơn Ngày 7 + SP 21 làm mẫu) và chặn theo
host của `DATABASE_URL` (không chỉ `NODE_ENV`). Đã kiểm: `DATABASE_URL`
trỏ host ngoài → từ chối, exit 1; dry-run liệt kê 45 đơn seed +
1 phiên admin, chưa xóa gì; `--only=seed,sessions --delete` đã xóa
45 đơn seed + 1 phiên admin test. Sau dọn: 0 đơn seed, 0 phiên,
3 đơn mẫu còn nguyên NEW/UNPAID, SP 21 còn nguyên; giỏ khách tạo
khi kiểm toast (1 giỏ, 1 dòng) cũng đã xóa.

## D9-4 Đơn đã hủy — ĐẠT

- Phiếu giao đơn CANCELLED (SEED000044, COD chưa trả): dải đỏ
  **"ĐƠN ĐÃ HỦY — KHÔNG GIAO"** + **"Thu hộ 0 ₫"**. Chọn hiện dải +
  0 ₫, không chặn in — lý do: phiếu vẫn là hồ sơ lưu của đơn, dải đỏ
  làm rõ không được giao hàng.
- Trang công khai: SEED000045 (chuyển khoản + PAID, đã hủy) hiện lời
  nhắn "Đơn đã hủy. Nếu bạn đã chuyển khoản cho đơn này, vui lòng liên
  hệ shop để được hỗ trợ hoàn tiền."; SEED000044 (COD, đã hủy) không
  hiện câu hoàn tiền nào. Điều kiện trong code: chỉ khi
  `paymentMethod === "BANK_TRANSFER" && paymentStatus === "PAID"`.
- Stepper: đơn hủy có 0 `aria-current="step"` trong HTML đã render
  (không tô bước nào); đơn NEW có 1 (bước hiện tại). `Steps` nhận
  `current: number | null`, trang công khai truyền `null` khi hủy.

## D9-5 Chất lượng thông báo — ĐẠT

- `src/lib/telegram.test.ts` mới: escape HTML cho tên/địa chỉ/ghi chú
  chứa `<`, `>`, `&` (mock Telegram trên 127.0.0.1:18081 trả 200;
  kiểm cả trường hợp tên chứa ký tự đặc biệt). `src/lib/admin/
  orders.test.ts`: test thống nhất nhãn + `slotStartMinutes()`.
- Nhãn thống nhất qua một nguồn duy nhất `src/lib/order-labels.ts`:
  NEW = **"Đã tiếp nhận"** ở mọi nơi (trước: tab ghi "Mới", huy hiệu
  ghi "Đã tiếp nhận"); COMPLETED = **"Đã giao"** (trước: tab ghi
  "Hoàn tất"). Lỗi chuyển trạng thái dùng nhãn tiếng Việt, không còn
  mã enum thô (ví dụ "Không thể chuyển đơn từ Đã tiếp nhận sang
  Đã giao.").
- Sắp xếp "Cần xử lý" theo giờ bắt đầu dạng số: helper thuần
  `slotStartMinutes()` + `CASE` SQL (khung "08:00 – 10:00" → 480;
  "Trong 2 giờ..." → 0; "Trước 18:00" → 1080), thay cách xếp chuỗi
  mong manh trước đây.

## D9-6 Test có DB — ĐẠT

`npm run test:db` mới (`tsx --test src/lib/admin/orders.db.test.ts`),
**5/5 PASS** trên Postgres local: (1) hồi quy lỗi enum 42883 của
D8-3 — lọc payment + tab trạng thái (thiếu ép kiểu `::"PaymentStatus"`
/ `::"OrderStatus"` sẽ ném lỗi ngay); (2) tìm theo mã + số đếm tab
khớp dữ liệu; (3) phân trang page=99 trả 0 đơn, giữ nguyên tổng;
(4) lỗi chuyển sai bước dùng nhãn tiếng Việt; (5) số liệu dashboard
trên DB thật. Unit test thường vẫn chạy không cần DB: **176/176 PASS**.

## D9-7 Tài liệu và UI nhỏ — ĐẠT

- Phụ lục §8 đã thay bằng số đo sau sửa (390/390; toast left 16,
  right 374, nút ✕ 317–361 hiện đầy đủ) trong `bao-cao-ngay-8-dinh-
  kem.md`; số ảnh thống nhất **7 ảnh** ở phụ lục, báo cáo gọn D8-14
  và `docs/reports/ngay-8.md` D8-14.
- Toast mobile một hàng (CDP ở 390 px thật): toast left 16, right
  374, rộng 358, cao 62; nút ✕ 317–361 (rộng 44 px), top 122–166 nằm
  trong toast top 113–175 → cùng hàng, không bị đẩy xuống dòng riêng.
  (Class `flex-nowrap`, nội dung `whitespace-nowrap`, ✕ `ml-auto`.)
- Chi tiết đơn 390 px: các dòng `dl` đã `items-center` — tâm dọc
  dt/dd trùng nhau (598/598, 650/650, 690/690, 718/718).
- Header admin gọn trên mobile: một hàng, cao **69 px** ở 390 px
  (trước ~167 px), menu cuộn ngang. **Lỗi tìm được khi kiểm (đã sửa
  trong Ngày 9):** header tràn ngang 4 px ở 390 px (thương hiệu
  ~264 px + 2 khoảng cách + nút "Đăng xuất" 106 px = 394 > 358 px
  nội dung) → thương hiệu rút thành "Quản trị" dưới `sm`, hiện đủ
  từ 640 px trở lên; đo lại `/admin`, chi tiết đơn, danh sách đơn
  đều innerWidth = scrollWidth = 390.
- Hạn chế claim-then-send của Telegram đã ghi vào README (nếu tiến
  trình serverless chết giữa claim và gửi, `notifiedAt` đã set dù
  chưa gửi gì; chấp nhận cho demo).

## D9-8 Trang tổng quan /admin — ĐẠT

**Quyết định: sau đăng nhập vào dashboard `/admin`** (đổi cả 3 chỗ
chuyển sau đăng nhập: route login, trang `/login`, `LoginForm`;
trước đây vào `/admin/orders`). Trang gồm 5 thẻ số liệu, lấy trực
tiếp từ DB (force-dynamic + header no-store, không cache):
- Đơn cần xử lý: **38** (NEW + CONFIRMED + DELIVERING).
- Đơn giao hôm nay: **11** (ngày giao = hôm nay theo giờ VN, chưa hủy).
- Chuyển khoản chưa thu: **7** (BANK_TRANSFER + UNPAID, chưa hủy).
- Doanh thu hôm nay: **4.130.000 ₫**; doanh thu 7 ngày:
  **4.130.000 ₫** (tổng tiền các đơn COMPLETED theo ngày hoàn tất —
  sự kiện STATUS_CHANGE → COMPLETED; 5 đơn × 826.000 ₫).
  Tất cả đã đối chiếu trực tiếp với DB local. `requireAdmin()` ở đầu
  trang, no-store, noindex (next.config.ts). 390 px: innerWidth =
  scrollWidth = 390, không cuộn ngang; 1440 px hiển thị đủ 5 thẻ.

## Lộ trình gốc Ngày 9 (làm cùng) — ĐẠT

- Trang mới, URL cố định tiếng Anh theo quy tắc Ngày 7: `/faq`,
  `/about`, `/policy`, `/contact` (đều 200). FAQ dạng accordion
  7 câu; trang Giới thiệu/Liên hệ/Chính sách chỉ dùng dữ liệu thật
  đã xác nhận, chỗ chờ Henry (hotline, Zalo, địa chỉ, giờ mở cửa,
  chính sách đổi trả...) ghi rõ **"Đang cập nhật."** — không bịa cam
  kết, giá hay chính sách.
- SEO: metadata mỗi trang + `sitemap.xml` (**30 URL**: 5 trang tĩnh +
  4 danh mục + 21 sản phẩm đang bán; force-dynamic) + `robots.txt`
  (Allow `/`; Disallow `/cart`, `/checkout`, `/order`, `/search`,
  `/admin`, `/login`, `/api/`; có dòng Sitemap). Footer cột 2–4 nay
  trỏ tới trang thật (`/faq`, `/about`, `/contact`, `/policy`).
  `reserved-slugs.ts` thêm about/contact/policy. Tuân thủ quy tắc
  EdenGift (chỉ học cấu trúc, không copy chữ/ảnh).

## Khác đặc tả

- Sau đăng nhập vào `/admin` (dashboard) thay vì `/admin/orders`.
- Phiếu giao đơn hủy: hiện dải đỏ + "Thu hộ 0 ₫", không chặn in.
- Tổng số đơn của tab lấy từ số đếm tab (sửa lỗi page=99 trả tổng 0).
- `clean-test-data.ts`: thêm phạm vi `--only=seed` (Ngày 9 chỉ xóa
  seed + phiên, giữ mẫu Ngày 7; Ngày 11 `--delete` xóa hết trước khi
  mở bán).
- `scripts/recreate-test-data.ts` mới: tạo lại SP 21 + 3 đơn test
  đúng giá trị Ngày 7 sau khi VM bị thay mới (chỉ localhost, chạy
  lại bỏ qua dữ liệu đã có).
- D9-2: không đào sâu vùng function/DB vì lần đo ấm (1,64 s) dưới 3 s.

## Kiểm chứng tổng hợp

- Unit test 176/176, test:db 5/5, typecheck 0, lint 0, build OK,
  First Load JS `/` 115 kB. Kiểm local không có request ra ngoài
  localhost; kiểm live chỉ tới chính site production (D9-1/D9-2).
- Không có dữ liệu test trên production (`/order/QAFNN907ZY` 404
  sau redeploy; seed trên production chỉ có dữ liệu gốc 20 sản phẩm).
- Ảnh đã mắt kiểm (tại `~/workspace/`): xem mục Ảnh ở báo cáo gọn.

## Chờ Henry

- Dữ liệu bán thật: bank QR, Telegram, khu vực giao, giờ làm việc,
  hotline/Zalo, địa chỉ, cam kết shop.
- **Không còn chờ:** thử đăng nhập live `/login` (D7-2) — đã xác minh
  24/11 ~21:11: POST `/api/admin/login` bằng tài khoản admin thật trả
  200 `{"ok":true}` trong 2,2 s; không cần đặt lại mật khẩu.
- **Không còn chờ:** đặt lại `DATABASE_URL` từ Neon — đã xác minh còn
  nguyên sau redeploy 21:03 (xem D9-1).

## Bổ sung sau Ngày 9 — sửa 12 mục theo verdict Claude (Henry duyệt "Sửa luôn 12 mục này" 24/11 ~22:29)

Verdict Claude trong chat Ngày 9
(https://claude.ai/chat/e9868d1c-de57-4a5b-b7dc-69ad782b8796, 24/11
~22:26): không gắn nhãn DUYỆT chính thức — "Nhìn chung D9-1..D9-8
đạt. Em thấy vài điểm cần xử lý trước khi coi Ngày 9 là đóng hẳn."
12 mục dưới đây sửa trong MỘT commit mới trên `8fa1e9e` (xem
`git log -1`; chưa push). Môi trường: VM thay mới lần 3 trong ngày —
dựng lại PostgreSQL 16.15 + Chrome 158, DB local từ migration + seed
+ `scripts/recreate-test-data.ts` (3 đơn mẫu + SP 21 đúng giá trị
Ngày 7). Kiểm chứng cuối: unit test **176/176**, test:db **7/7**
(trước 5/5, +2 ca mới mục 9+10), typecheck 0, lint 0, build OK,
First Load JS `/` = **115 kB**.

1. **Seed ghi đè — ĐÃ SỬA (mục bắt buộc).** `prisma/seed.ts`: cả 3
   `upsert` (category/product/shippingZone) đổi `update:` đầy đủ
   thành `update: {}` — chạy lại seed là no-op với dữ liệu đã có.
   README mục "Triển khai production" ghi rõ quy tắc này + cách đổi
   dữ liệu gốc (sửa trong admin hoặc migration). **Bằng chứng:**
   sửa tay trong DB (SP 1: tên "TÊN ĐÃ SỬA", giá 999.999 ₫; khu vực
   1: phí 99.999 ₫; danh mục hoa-tuoi: "DANH MỤC ĐÃ SỬA"), chạy
   `npm run db:seed`, kiểm lại cả 3 vẫn giữ nguyên giá trị đã sửa;
   sau đó khôi phục về đúng giá trị gốc (890.000 ₫ / 25.000 ₫ /
   "Hoa tươi", đã kiểm lại).
2. **Sitemap live — KHÔNG CÒN LỖI (chỉ ghi nhận).** Đã xác minh live
   trước khi sửa: sitemap live có **29 URL** (đúng — 20 sản phẩm,
   SP 21 chỉ có ở local) và mọi `<loc>` đều đúng domain
   `flowershop-steel.vercel.app`, không có localhost. Phần còn lại
   của mục này (lastmod) sửa ở mục 12.
3. **Dải đỏ phiếu giao không in ra — ĐÃ SỬA.** Thêm
   `print:[print-color-adjust:exact]` cho dải đỏ ở
   `src/app/admin/orders/[code]/print/page.tsx`. **Bằng chứng:**
   CSS build có `@media print{.print\:[print-color-adjust\:exact\]
   {-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
   in thử bằng headless Chrome print-to-PDF trang phiếu giao đơn
   hủy SEED000044, render PDF ra ảnh: dải đỏ nền đặc + chữ trắng
   hiện đầy đủ trên giấy (ảnh `phieu-giao-huy-v2.png`).
4. **Phiếu hủy mâu thuẫn — ĐÃ SỬA.** Khi `status === CANCELLED`,
   dòng cuối phiếu thành "Đơn đã hủy — không thu tiền." thay cho
   "Thanh toán khi nhận hàng (COD).". **Bằng chứng:** curl trang
   in SEED000044 (COD, đã hủy): banner 1, dòng mới 1, dòng COD cũ
   0, `print-cod` = "0 ₫".
5. **Trang công khai đơn hủy — ĐÃ SỬA.** Ẩn hẳn thanh bước
   `<Steps>` khi đơn đã hủy (trước chỉ truyền `current={null}` vẫn
   hiện thanh); bỏ dòng trạng thái "Đơn đã hủy" thừa (giữ tiêu đề +
   alert + huy hiệu). **Bằng chứng:** curl `/order/SEED000045`
   (BT+PAID, đã hủy) và `/order/SEED000044` (COD, đã hủy): không
   còn `aria-label="Các bước đặt hàng"` (0), "Đơn đã hủy" còn đúng
   2 lần trong phần hiển thị (tiêu đề + alert; số thô 4 là do
   payload RSC lặp lại nội dung trong `<script>`); SEED000045 hiện
   lời nhắn hoàn tiền (1), SEED000044 không hiện (0); đơn NEW
   (QAFNN907ZY) vẫn hiện thanh bước (1) + tiêu đề "Đặt hàng thành
   công" (1). Ảnh `don-da-huy-cong-khai-390-v2.png` đã mắt kiểm.
6. **PREPARING bị hở — ĐÃ GHI RÕ (giữ nguyên luồng).** Quyết định
   giữ nguyên: PREPARING là trạng thái dự trữ, không dùng trong
   luồng (không bước chuyển, không tab, không tính vào "Cần xử lý"
   hay dashboard; đơn ở trạng thái này chỉ thấy trong "Tất cả").
   Đã ghi vào README (mục "Trang quản trị", kèm dòng sửa câu cũ
   "Không có quản lý đơn hàng (Ngày 8)" thành mô tả đúng) và tăng
   cường comment trong `src/lib/admin/orders.ts` (bảng chuyển trạng
   thái) + `src/lib/admin/dashboard.ts` (định nghĩa pending).
7. **Ảnh chi tiết đơn hủy cũ — ĐÃ CHỤP LẠI.** Ảnh mới
   `chi-tiet-don-huy-390-v2.png` (chi tiết SEED000044, 390 px, sau
   bản sửa): header chỉ hiện "Quản trị" dưới `sm` (đúng như D9-7),
   đã mắt kiểm.
8. **Menu admin 390 px bị che — ĐÃ SỬA.** Thêm mask mờ dần 15%
   cuối cho nav cuộn ngang (`[mask-image:linear-gradient(to_right,
   #000_85%,transparent)]` trong `src/app/admin/layout.tsx`).
   **Bằng chứng:** CSS build có
   `mask-image:linear-gradient(90deg,#000 85%,#0000)`; ảnh
   `dashboard-390-v2.png` (390 px) đã mắt kiểm: chữ "Sản phẩm"
   mờ dần ở mép phải, thấy rõ còn mục cuộn được.
9. **Test dashboard chưa chứng minh ranh giới ngày — ĐÃ SỬA.**
   `src/lib/admin/orders.db.test.ts` thêm ca kiểm: đơn COMPLETED
   3 ngày trước chỉ cộng vào doanh thu 7 ngày (không cộng vào hôm
   nay), đơn 8 ngày trước bị loại khỏi cả hai — đối chiếu bằng
   delta trước/sau để không phụ thuộc dữ liệu có sẵn. **Bằng
   chứng:** test:db 7/7 PASS (ca mới pass).
10. **Doanh thu tính trùng theo sự kiện — ĐÃ SỬA.**
    `src/lib/admin/dashboard.ts`: hai truy vấn sự kiện nay lấy thêm
    `orderId`, cộng doanh thu theo ĐƠN (distinct theo orderId) thay
    cho cộng theo sự kiện. **Bằng chứng:** test:db thêm ca hồi
    quy — một đơn có 2 sự kiện COMPLETED cùng lúc chỉ cộng đúng
    1 lần vào cả hôm nay lẫn 7 ngày; 7/7 PASS.
11. **vnDayBounds cứng -7 — CHỈ THÊM GHI CHÚ.** Không đổi hành vi:
    comment trong `src/lib/admin/dashboard.ts` ghi rõ -7 là độ lệch
    UTC+7 của `Asia/Ho_Chi_Minh` (deliveryConfig.timezone), VN
    không có giờ mùa hè nên là hằng số đúng quanh năm; đổi timezone
    thì phải đổi số này theo.
12. **lastmod trang tĩnh = now — ĐÃ SỬA.** `src/app/sitemap.ts`:
    bỏ `lastModified` ở 5 trang tĩnh (giữ lastmod thật theo
    `updatedAt` cho danh mục/sản phẩm). **Bằng chứng:** curl
    `/sitemap.xml` local 2 lần cách nhau 3 s: tổng vẫn **30 URL**,
    5 trang tĩnh không còn `<lastmod>`; các lastmod còn lại (theo
    updatedAt) giống hệt nhau giữa 2 lần gọi (ổn định, không đổi
    theo request). Live vẫn 29 URL (đã xác minh trước, mục 2).

Trạng thái DB local cuối đợt: 3 đơn mẫu NEW/UNPAID (QAFNN907ZY,
0Z2DZBQNTJ, 1N0PEZH0J7), 0 đơn seed (45 đơn SEED đã xóa bằng
`clean-test-data.ts --only=seed,sessions --delete`), 0 phiên admin,
21 sản phẩm. Server verification chạy trên cổng 3000 phục vụ bản
mới (build standalone sau sửa). Ảnh chụp lại tại `~/workspace/`:
`chi-tiet-don-huy-390-v2.png`, `dashboard-390-v2.png`,
`phieu-giao-huy-v2.png`, `don-da-huy-cong-khai-390-v2.png` (đã mắt
kiểm cả 4 + file PDF in thử ở `/tmp/phieu-giao-huy-v2.pdf`).
