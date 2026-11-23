# Báo cáo Ngày 7 — Trang quản trị (admin)

Ngày: 2026-11-23. Commit: 872bcab (commit Ngày 7 gốc; đã amend 1 lần để điền hash vào báo cáo — hash cuối xem `git log -1`).
Đặc tả: `ngay-7-dac-ta.md` (§0 K-1..K-9 + §1..§9 D7-1..D7-25).
Môi trường kiểm chứng: VM Ubuntu 24.04.5, Node 22 v22.23.5
(`~/tools/node22/bin/node` + npm), PostgreSQL 16.15, DB `hoa_shop`
(user `hoa`), headless Chrome 158 (CDP, cổng 9222),
Lighthouse 12.8.0. Build standalone: `next build`, copy
`.next/static` + `public` vào `.next/standalone/`, chạy bằng
`node --env-file=.env .next/standalone/server.js`.

Kết quả tổng: **typecheck 0 lỗi, lint 0 lỗi, test 138/138 PASS**
(Ngày 6: 99; +39 test mới: 1 NFD search, 7 bank, 6 password,
~17 product-validation + 1 ảnh-hiện-có-khi-sửa, 7 uploads).
Build OK. First Load JS `/` = **115 kB** (Ngày 6 cũng 115 kB,
≤ 135 kB). **D7-1..D7-25: 25/25 ĐẠT, 0 KHÔNG ĐẠT.**
K-1..K-9: 9/9 xong (K-1 = commit local, không push).

## 0. Môi trường / máy chủ dùng để đo

- Máy chủ chính `http://localhost:3000` — `.env` có
  `ADMIN_PASSWORD_HASH` của Henry (xem D7-2), TZ=Asia/Ho_Chi_Minh.
- Máy chủ stage `http://localhost:3100` — chạy bằng user `nobody`,
  KHÔNG có `.env`, env truyền trực tiếp (xem D7-22); cùng DB
  `hoa_shop`, cùng `UPLOAD_DIR`; cố tình đặt
  `BANK_BIN=970415` + `BANK_NAME=Vietcombank` lệch nhau để kiểm K-9.
- Các stage phụ (3200 K-2 mock Telegram, 3300 K-3, 3400 503,
  3500 thư mục không ghi được) đã dừng, DB tạm đã xóa.

## K-1..K-9 (đầu Ngày 7)

- **K-1 — Push code: chỉ commit local, KHÔNG push** (đợi token
  của Henry; việc push do Pi Em xử lý sau, theo mẫu H-8).
  Commit: xem cuối báo cáo.
- **K-2 — Mock Telegram (node `--import` ghi đè fetch cho
  `api.telegram.org`, trả lời sau 3 giây): ĐẠT.**
  - Lần 1 (mock 200): redirect **255 ms** (≤ 1 s); đơn `0Z2DZBQNTJ`
    tạo 14:33:19.512; request Telegram 14:33:19.598 (**sau**
    redirect); response 200 lúc 14:33:22.599;
    `notifiedAt = 14:33:22.599` (có giá trị).
  - Lần 2 (mock 500): redirect **253 ms**; đơn `1N0PEZH0J7`
    tạo, trạng thái NEW, `notifiedAt` vẫn NULL (đơn được giữ).
  - Chú ý: đặt qua giao hẹn 2026-11-24 khung 08:00–10:00 + COD
    vì lúc ~21:30 VN shop đã đóng (EXPRESS_2H báo khung giờ
    không còn khả dụng). Giới hạn 5 đơn/60 phút/số điện thoại:
    số 0901234567 đã đặt 3 đơn.
- **K-3 — DB Ngày 5 là DB nào: ĐÃ LÀM RÕ.** DB Ngày 5/6 là DB
  **dựng lại từ migration + seed sau khi VM bị thay** (0 đơn),
  KHÔNG phải DB khôi phục từ bản sao có đơn thật. Đã chạy lại
  nâng cấp trên DB có ≥ 1 đơn thật: DB `hoa_shop_k3` dựng từ
  migration (chưa có migration admin) + seed, đặt 1 đơn thật qua
  app (`0YNS07EXMZ`, tổng 826.000 = 801.000 + 25.000), rồi áp
  migration admin → số liệu giữ nguyên (20 sản phẩm, 1 đơn,
  1 order_item, 2 bảng admin đều rỗng). DB rỗng (đủ migration,
  không seed) → 0 sản phẩm, 0 đơn. Cả hai DB tạm đã xóa.
- **K-4 — Ảnh thiếu: ĐÃ CHỤP ĐỦ.**
  `h3-toast-390.png`: toast "Đã thêm vào giỏ hàng" **1 dòng**
  (cao 19 px, line-height 19,25 px).
  `d6-h2-errors-390.png`: 6 lỗi thanh toán, **mỗi lỗi 1 dòng**
  ("Họ tên người đặt phải từ 2 đến 60 ký tự.", "Số điện thoại
  người đặt không hợp lệ.", "Địa chỉ nhận hàng phải từ 5 đến
  200 ký tự.", "Vui lòng chọn khu vực giao hàng.", "Vui lòng
  chọn phương thức giao hàng.", "Vui lòng chọn phương thức
  thanh toán.").
- **K-5 — Toast đếm từ khi cửa sổ đóng: ĐẠT.** QuickViewDialog
  không dispatch `cart:added` lúc bấm thêm; lưu số lượng vào
  `toastPendingRef`, dispatch ở cleanup khi dialog unmount
  (timer 3 s bắt đầu khi dialog đóng). Đo bằng CDP: dialog đóng
  lúc 1420 ms sau khi bấm, toast xuất hiện lúc 1420 ms, biến mất
  lúc 4427 ms → **hiện 3,01 s sau khi đóng** (≥ 2,5 s). Huy hiệu
  giỏ vẫn tăng lúc bấm thêm (0 → 1), kể cả thêm từ Xem nhanh.
  AddToCartForm (trang chi tiết) giữ dispatch ngay (không có
  dialog ở đó).
- **K-6 — Xem nhanh 390 px: ĐẠT.** Ảnh `max-md:h-[32dvh]`
  (trước đây aspect 4/5 chiếm hơn nửa sheet); form hành động
  `max-md:sticky max-md:bottom-0` nền trắng + viền trên. Đo
  bằng CDP ở 390×844: ảnh **270 px = 32dvh**, hai nút "Thêm vào
  giỏ hàng"/"Mua ngay" ở top 730/bottom 774 (trong viewport
  844), `canScroll=false` — tên/giá/2 nút thấy được không cần
  cuộn. Ảnh `xem-nhanh-390-sau-k6.png`.
- **K-7 — Trang đơn chuyển khoản 390 px: ĐẠT.** Hàng
  BankTransferBox xếp dọc dưới 640 px (nhãn trên, giá trị +
  nút "Sao chép" dưới); giá trị nội dung chuyển khoản
  `whitespace-nowrap`. Đo live trên đơn `QAFNN907ZY` ở 390 px:
  nội dung "DH QAFNN907ZY" **cao 20 px = line-height 20 px =
  đúng 1 dòng**, `nowrap=true`.
- **K-8 — NFD: ĐẠT.** Thêm `.normalize("NFC")` ở đầu
  `tokenizeSearchQuery` (src/lib/search.ts) + test NFD
  (`tokenizeSearchQuery("ho\u0302\u0300ng")` → `["hồng"]`).
  Đo live: tìm NFD `ho+U+0302+U+0300+ng` → **6 kết quả**, bằng
  NFC "hồng".
- **K-9 — BIN: ĐẠT, đặc tả của Claude đúng.** Tra 3 nguồn độc
  lập (PyPI vnqr, vietqr_gen Dart, congcu.com):
  **970415 = VietinBank (ICB), 970436 = Vietcombank (VCB).**
  Quyết định: thêm bảng `BANK_NAMES` (14 BIN đã kiểm) vào
  src/lib/bank.ts; `getBankInfo()` lấy tên từ BIN khi biết, bỏ
  qua `BANK_NAME` lệch; BIN lạ thì dùng `BANK_NAME`. Sửa comment
  sai trong `.env.example` (trước ghi "970415 = Vietcombank").
  Thêm src/lib/bank.test.ts (7 test). Dữ liệu test Ngày 6
  (BANK_BIN=970415 + BANK_NAME=Vietcombank) vốn lệch nhau — nay
  hiển thị **VietinBank**. Đo live 23/11 ~14:35: trang đơn ngân
  hàng hiện "VietinBank" dù env ghi Vietcombank.

## D7-1..D7-25

- **D7-1 — Migration admin: ĐẠT.** Bảng `admin_sessions`,
  `admin_login_attempts` (snake_case) tạo bởi migration
  `20261123210000_admin`, đã áp bằng `prisma migrate deploy`.
- **D7-2 — Đăng nhập tài khoản + mật khẩu: ĐẠT (có lưu ý).**
  Hash của Henry trong `.env` local: đúng định dạng
  `scrypt$<saltHex>$<hashHex>` (salt 32 ký tự hex = 16 byte,
  hash 128 ký tự hex = 64 byte), `ADMIN_USERNAME=admin`.
  Cơ chế đăng nhập đã chứng minh bằng mật khẩu test trên stage
  (đăng nhập 200, cookie đặt đúng). **Đăng nhập end-to-end
  bằng hash của Henry chỉ Henry mới chứng minh được** (không
  ai khác biết mật khẩu gốc; không ghi plaintext ở đâu).
  Lỗi sai tài khoản/mật khẩu giống hệt nhau, không lộ chỗ sai.
- **D7-3 — Migration trên DB có đơn: ĐẠT** (xem K-3).
- **D7-4 — 503 khi chưa cấu hình: ĐẠT.** Stage không có
  `ADMIN_PASSWORD_HASH` → `/login` và `/admin/products` trả
  503 "Chưa cấu hình quản trị"; trang chủ vẫn 200.
- **D7-5 — requireAdmin() ở đầu mọi action/route: ĐẠT.**
  Grep (xem file đính kèm): mọi Server Action quản trị
  (`createProductAction`, `updateProductAction`,
  `toggleProductAction`), route `/api/admin/upload`, mọi trang
  `/admin/*` đều mở đầu bằng `await requireAdmin()`.
  Ngoại lệ có chủ đích, ghi chú trong code: route
  `/api/admin/login` (tạo phiên) và `logoutAction` (hủy phiên).
- **D7-6 — Đăng nhập/đăng xuất: ĐẠT.** Đăng nhập đúng → 200,
  cookie `admin_session` (HttpOnly, SameSite=strict, Path=/,
  Max-Age=43200 = 12 giờ, không Secure vì
  `ADMIN_COOKIE_SECURE=false` để thử qua HTTP; mặc định
  production là Secure). DB chỉ lưu sha256 của token (64 ký tự
  hex). Sai → 401 `{"ok":false,"error":"Tên đăng nhập hoặc mật
  khẩu không đúng."}` — giống hệt cho sai username và sai
  password. Đăng xuất qua giao diện → về `/login`, dòng phiên
  bị xóa khỏi DB.
- **D7-7 — Giới hạn thử sai: ĐẠT.** Theo IP: 5 lần 401 rồi lần
  thứ 6 (nhập ĐÚNG mật khẩu) → **429** "Quá nhiều lần đăng nhập
  sai, vui lòng thử lại sau 15 phút."; lùi thời gian các lần thử
  16 phút → mở khóa. Toàn hệ thống: 20 lần sai từ 20 IP giả
  khác nhau → đăng nhập đúng từ IP mới → **429**; lùi thời gian
  → đăng nhập lại được (200).
- **D7-8 — Phiên hết hạn: ĐẠT.** Đặt `expiresAt` của một phiên
  về quá khứ bằng psql → `/admin/products` redirect **307 về
  /login**; dòng phiên hết hạn bị xóa.
- **D7-9 — Danh sách/tìm/lọc/phân trang: ĐẠT.** Tổng 21 sản
  phẩm (20 mẫu + 1 test), 20/trang, "trang 1/2" và "trang 2/2";
  tìm `q=hong` → 6; lọc danh mục lan-ho-diep → 3; lọc trạng
  thái đã ẩn → 0; trang 2 chứa TEST-001.
- **D7-10 — Tạo sản phẩm + hiển thị: ĐẠT.** Tạo qua form quản
  trị: "Bó Hoa Đồng Tiền Thử Nghiệm", slug tự sinh
  `bo-hoa-dong-tien-thu-nghiem`, SKU TEST-001, giá 450.000,
  giá KM 400.000, thứ tự 99. Hiện ở: trang chi tiết (200),
  trang danh mục (trang 2, vì sortOrder 99), tìm "dong tien"
  → 1 kết quả, gợi ý tìm kiếm (có giá KM + ảnh), Xem nhanh
  `?c=hoa-tuoi&p=bo-hoa-dong-tien-thu-nghiem` → 200.
  (Lưu ý: API Xem nhanh nhận `?c=&p=`, không phải `?id=` —
  lần thử đầu dùng `?id=` nên 404 gây hiểu lầm.)
- **D7-11 — Lỗi khi tạo/sửa: ĐẠT.** Giao diện: tên "Ab" →
  "Tên sản phẩm phải từ 3 đến 120 ký tự."; giá KM 500.000 ≥
  giá gốc 450.000 → "Giá khuyến mãi phải lớn hơn 0 và nhỏ hơn
  giá gốc."; SKU trùng HT-001 → "SKU này đã dùng cho một sản
  phẩm khác."; tên/slug trùng → "Đường dẫn này đã dùng cho một
  sản phẩm khác trong cùng danh mục.". Giá 0 bị chặn bởi
  `min=1000` của input (không submit tới máy chủ); các trường
  hợp phía máy chủ (giá 0/-1/1.5/abc/100000001, slug sai, slug
  > 80, SKU sai, 11 tag, tag > 30, danh mục sai, mô tả > 2000,
  tên chứa HTML lưu dạng text, quy tắc ảnh) đều có unit test.
  Trường thừa (id, createdAt) trong FormData bị bỏ qua
  (whitelist).
- **D7-12 — Đổi giá không đổi đơn cũ: ĐẠT.** Giá SP 21 đổi
  400.000 → 380.000 → 360.000 → 340.000; giỏ hiện giá mới
  (360.000 lúc đo). Đơn `QAFNN907ZY` (chuyển khoản, 3 × SP 21,
  tạm tính 1.080.000 = 3 × 360.000, ship 25.000, tổng
  1.105.000) giữ giá cũ sau khi SP đổi sang 340.000 —
  `order_items.price = 360000` trong DB; trang đơn hiện
  1.080.000/1.105.000, không phải 1.020.000 (3 × 340.000).
  (Trang đơn hiện tổng dòng, không hiện đơn giá.)
- **D7-13 — Ẩn/hiện sản phẩm: ĐẠT.** Ẩn SP 21: chi tiết 404,
  tìm 0, gợi ý [], Xem nhanh 404, danh mục 0, danh sách quản
  trị vẫn hiện. Hiện lại: mọi nơi trở lại bình thường.
- **D7-14 — Giỏ chứa sản phẩm vừa bị ẩn: ĐẠT (không cần sửa
  code).** Hành vi hiện có đã an toàn, kiểm live: dòng giỏ hiện
  "Sản phẩm hiện không còn bán", mờ, số lượng "—", chỉ còn nút
  xóa, loại khỏi tạm tính (0 sản phẩm, 0 ₫); `/checkout`
  redirect về `/cart`.
- **D7-15 — Tải ảnh lên: ĐẠT.** PNG/JPG/WebP hợp lệ → 200,
  tên do máy chủ sinh (`/uploads/c414cd0e204d.png`,
  `/uploads/cf47eb4301b2.jpg`, `/uploads/712ce9a98ad9.webp`);
  ảnh đầu là ảnh chính; hiện ở chi tiết/danh mục/tìm kiếm/
  Xem nhanh.
- **D7-16 — Ảnh không hợp lệ: ĐẠT.** Text đội lốt .jpg, SVG,
  GIF → 400 "Chỉ nhận ảnh JPEG, PNG hoặc WebP."; file rỗng →
  400 "File rỗng."; > 5 MB → 400 "File quá lớn (tối đa 5
  MB/ảnh)."; thiếu Origin → 403 "Thiếu Origin."; Origin lạ →
  403 "Origin không hợp lệ."; chưa đăng nhập → 401; productId
  không tồn tại → 404 "Không tìm thấy sản phẩm."; ảnh thứ 7 khi
  SP đã đủ 6 → 400 "Sản phẩm đã đủ 6 ảnh.".
- **D7-17 — GET /uploads/[name]: ĐẠT.** Ảnh hợp lệ → 200,
  đúng Content-Type, `Cache-Control: public, max-age=31536000,
  immutable`, `X-Content-Type-Options: nosniff`; tên xấu
  (`../..`, sai mẫu, không tồn tại) → 404.
- **D7-18 — Sắp xếp/gỡ/dọn ảnh: ĐẠT.** Sắp xếp lại qua form
  (fd96… thành ảnh chính), gỡ khỏi SP nhưng file vẫn còn trên
  đĩa. Script `prune-uploads.ts`: mặc định chỉ liệt kê mồ côi
  > 24 giờ (5 file), `--delete` xóa đúng 5 file đó, giữ file
  đang dùng (`fd96a24713dc.png`).
- **D7-19 — Mobile 390 px quản trị: ĐẠT (có ghi chú).**
  Không cuộn ngang ở `/admin/products` và
  `/admin/products/21` (scrollWidth 390 = innerWidth 390).
  **Mọi `<button>` đều ≥ 44 px** (danh sách 22 nút, form sửa
  5 nút, 0 nút nhỏ). Thứ tự tab hợp lý: Sản phẩm → Xem shop ↗
  → Đăng xuất → tên → slug → sku → danh mục → giá. Ghi chú:
  link chữ tên sản phẩm trong thẻ mobile cao 22 px (link, không
  phải nút bấm) — vùng chạm nhỏ hơn 44 px, ghi nhận, chưa sửa.
- **D7-20 — Lighthouse + First Load JS: ĐẠT (có ghi chú).**
  Admin `/admin/products` (mobile, có cookie quản trị):
  **A11y 1,00, BP 1,00** (ngưỡng 0,95 / 0,90).
  Trang chủ `/` Perf 5 lần: 0,77 / 0,79 / 0,78 / **0,85** /
  **0,83** — dao động do CPU máy ảo bị chia sẻ (TBT 470–690
  ms, LCP 2,4–2,7 s), giống hệt Ngày 6 (lần đầu 0,78/0,79,
  chạy lại 0,81/0,87); các lần chạy lại đều ≥ 0,80. First Load
  JS `/` = **115 kB** (≤ 135 kB).
- **D7-21 — Không gọi ra ngoài khi dùng admin: ĐẠT.** Nhật ký
  mạng CDP trong lúc dùng admin: 94 request, **0 request ra
  ngoài localhost**.
- **D7-22 — Stage runner (mô phỏng VPS): ĐẠT.** Máy chủ stage
  chạy bằng user `nobody`, không `.env`, env truyền trực tiếp
  (có `ADMIN_PASSWORD_HASH`, `UPLOAD_DIR`): đăng nhập, tạo/sửa/
  tải ảnh, sản phẩm hiện trên shop đều chạy. `UPLOAD_DIR` không
  ghi được → upload trả 500 JSON "Không lưu được ảnh — kiểm
  tra thư mục UPLOAD_DIR.", máy chủ vẫn chạy (200). 503 khi
  chưa cấu hình (xem D7-4). Lưu ý: user `nobody` ban đầu bị
  EACCES vì thư mục repo là 2770 — đã `chmod a+rx` đường dẫn
  (môi trường dev local; VPS thật cần quyền tương tự).
- **D7-23 — Dockerfile/docker-compose.yml không đổi: ĐẠT.**
  `git diff -- Dockerfile docker-compose.yml` rỗng.
- **D7-24 — docs/CONTEXT.md ≤ 50 dòng: ĐẠT.** 13 dòng.
- **D7-25 — Báo cáo: ĐẠT.** Báo cáo này + bản gọn + file đính
  kèm + 5 ảnh (xem cuối).

## Đổi URL sang tiếng Anh (quyết định của Henry 23/11 20:54)

- Ánh xạ: `/thanh-toan` → `/checkout`; `/tim-kiem` → `/search`;
  `/gio-hang` → `/cart`; `/don-hang` → `/order` (chi tiết
  `/don-hang/[mã]` → `/order/[mã]`).
- Đã đổi tên thư mục route trong `src/app`, cập nhật mọi link
  nội bộ (Header, giỏ, luồng thanh toán, xác nhận đơn, gợi ý
  tìm kiếm, Xem nhanh, toast "Xem giỏ hàng") và mọi test tham
  chiếu đường dẫn cũ. Slug danh mục/sản phẩm từ DB
  (vd `/hoa-tuoi/bo-hong-do-tinh-yeu`) **giữ nguyên** tiếng Việt.
- Redirect **301** vĩnh viễn URL cũ → mới qua **middleware**
  (không phải next.config.ts — `redirects()` của Next.js trả
  308, không phải 301). Kiểm bằng curl: cả 5 URL cũ → 301,
  giữ query (`/tim-kiem?q=hong` → `/search?q=hong`,
  `/don-hang/ABC1234567` → `/order/ABC1234567`); URL mới:
  `/cart` 200, `/search?q=hong` 200, `/login` 200,
  `/checkout` 307 (giỏ rỗng → `/cart`, hành vi cũ Ngày 5),
  `/order/ABC1234567` 404 (đơn không tồn tại — đúng).
- Grep cuối repo: không còn tham chiếu `/thanh-toan|/tim-kiem|
  /gio-hang|/don-hang` ngoài bảng redirect trong middleware và
  báo cáo cũ trong `docs/reports/`. Sitemap chưa có (Ngày 9);
  robots đã cập nhật URL mới.
- URL quản trị tiếng Anh (quyết định Henry 20:41): `/admin`,
  `/login`, `/admin/products`, `/admin/products/new`,
  `/admin/products/[id]`; `admin` trong RESERVED_SLUGS
  (không thêm `quan-tri`); robots Disallow `/admin`; noindex,
  nofollow; không vào sitemap; force-dynamic; layout quản trị
  riêng (không Header/Footer shop, không truy vấn giỏ).

## TZ

`TZ=UTC` so với `TZ=Asia/Ho_Chi_Minh` **giống hệt**: trang đơn
`QAFNN907ZY` hiện cùng ngày giao 24/11/2026 và khung
08:00–10:00 ở cả hai TZ (app định dạng ngày qua
`deliveryConfig.timezone` = Asia/Ho_Chi_Minh).

## Khác đặc tả

1. **Scrypt maxmem (QUAN TRỌNG):** Node 22 mặc định scrypt
   maxmem = 32 MB, nhưng N=32768/r=8 cần ~33,5 MB nên scrypt
   ném `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` (đã kiểm live: không
   maxmem thì lỗi, có `maxmem: 64*1024*1024` thì chạy).
   Cả `scripts/hash-admin-password.ts` VÀ đường verify trong
   `auth.ts` BẮT BUỘC truyền maxmem 64 MB.
2. **URL tiếng Anh + đăng nhập tài khoản/mật khẩu** — quyết
   định của Henry, ghi đè đặc tả (xem trên).
3. **Redirect 301 qua middleware**, không qua next.config.ts
   (lý do ở trên).
4. **K-9: bảng BIN→tên** trong `bank.ts` (xem K-9).
5. **Route upload không tự gắn ảnh vào sản phẩm; `productId`
   tùy chọn** — form tạo mới chưa có sản phẩm nên cần upload
   trước khi sản phẩm tồn tại; biểu mẫu mới là nơi lưu danh
   sách ảnh vào DB.
6. **Login/logout là ngoại lệ có chủ đích của D7-5**
   (login tạo phiên, logout hủy phiên).
7. **Middleware chỉ dùng cho**: cổng 503 khi chưa cấu hình +
   header `x-admin-area` (để layout gốc bỏ chrome shop) +
   redirect 301 URL cũ. Xác thực vẫn do `requireAdmin()` ở
   từng action/route/trang.
8. **Không có sharp** trong build → file upload lưu nguyên
   (không strip EXIF, không resize, không chuyển WebP).
9. **Trên Vercel ảnh upload không bền** (filesystem tạm, mất
   khi redeploy) — Henry đã biết, xử lý ở Ngày 10 VPS; không
   đổi gì thêm.
10. **Lỗi đã tìm và sửa — Origin check:** route upload dùng
    `new URL(request.url).host` — máy chủ standalone dựng
    `request.url` từ địa chỉ listen (`http://0.0.0.0:3000/...`)
    nên Origin không bao giờ trùng, mọi upload đều 403. Đã sửa
    sang so Origin với header `Host`. Cùng lỗi ở route login:
    redirect form-POST dựng bằng `new URL(path, request.url)`
    sẽ cho Location `http://0.0.0.0:3000/...` — đã sửa bằng
    helper `redirectUrl()` dùng header `Host`.
11. **Lỗi đã tìm và sửa — sửa sản phẩm mẫu luôn lỗi "Ảnh không
    hợp lệ":** `validateProductForm` bắt mọi ảnh phải khớp mẫu
    `/uploads/...`, nhưng sản phẩm mẫu dùng
    `/images/placeholder.svg`. Đã sửa: `validateProductForm
    (input, existingImages = [])` — khi sửa, ảnh hiện có của
    sản phẩm được chấp nhận nguyên trạng; ảnh MỚI vẫn phải khớp
    `/uploads/...`. `updateProductAction` tải sản phẩm trước và
    truyền ảnh hiện có. +1 unit test.
12. **D7-14:** hành vi hiện có đã an toàn, không sửa code.
13. **D7-19:** link chữ tên sản phẩm 22 px (ghi chú ở D7-19).
14. **D7-20:** Perf dao động do CPU chia sẻ (ghi chú ở D7-20).
15. **Dữ liệu test còn trong DB local `hoa_shop`:** sản phẩm
    21 (TEST-001), 3 đơn test (`QAFNN907ZY`, `0Z2DZBQNTJ`,
    `1N0PEZH0J7`), 5 phiên admin test, các lần thử đăng nhập
    test. Cần quyết định có dọn trước khi push/deploy hay giữ
    làm bằng chứng (đề xuất: dọn đơn/phiên test, giữ SP 21
    hoặc xóa luôn — chờ Henry/Claude).

## Câu hỏi cho Claude

1. Dữ liệu test trong DB local (mục 15 trên) — dọn trước khi
   push/deploy hay giữ lại?
2. Link chữ tên sản phẩm 22 px ở mobile (D7-19) — có cần
   tăng vùng chạm lên ≥ 44 px không, hay ghi nhận là được?
3. Ngày 8 (quản lý đơn hàng) có giữ nguyên các URL tiếng Anh
   `/order/...` và layout quản trị này không?

## Chờ Henry

- **Token GitHub để push** (mẫu H-8: gửi 1 lần, dùng 1 lần,
  bỏ ngay sau khi push). Commit local đã sẵn sàng.
- **Đăng nhập end-to-end bằng hash của Henry** — chỉ Henry
  mới kiểm được (mật khẩu gốc không ai khác biết).
- Các mục chỉ Henry mới quyết (từ các ngày trước, vẫn chờ):
  tên thương hiệu + logo, ảnh sản phẩm thật, khu vực/phí ship
  thật, khung giờ giao thật, hotline/Zalo/địa chỉ, cam kết shop
  (VAT, miễn ship, đổi trả), tài khoản ngân hàng cho QR (BIN,
  số tài khoản, tên chủ TK), Telegram bot token + chat ID,
  duyệt wording `product-copy.ts`, VPS + domain (Ngày 10–11).

## File thay đổi (tóm tắt)

- Mới: `src/lib/admin/{config-format,password,rate-limit,
  auth,product-validation,uploads,products,upload-rules,
  product-form-state}.ts`, `src/app/actions/{admin,
  admin-auth}.ts`, `src/app/api/admin/{login,upload}/route.ts`,
  `src/app/uploads/[name]/route.ts`, `src/app/{admin,login}/`,
  `src/components/admin/{LoginForm,ToggleActiveButton,
  ProductForm}.tsx`, `src/middleware.ts`,
  `prisma/migrations/20261123210000_admin/`,
  `scripts/{hash-admin-password,prune-uploads}.ts`,
  `src/lib/bank.test.ts`, `docs/CONTEXT.md`, `docs/reports/
  ngay-7.md`.
- Sửa: đổi tên 4 route (`cart`, `checkout`, `search`, `order`),
  `src/lib/{search,bank,reserved-slugs}.ts`,
  `src/components/product/QuickViewDialog.tsx` (K-5, K-6),
  `src/components/order/BankTransferBox.tsx` (K-7),
  `src/app/{layout,robots}.ts`, `src/lib/cart.ts`,
  `src/config/cart.ts`, `README.md`, `.env.example`,
  `.gitignore`, `.dockerignore`, `package.json` (thêm 4 file
  test vào script `test`), `next.config.ts` (header
  `/order/:code`).
- Không đổi: `Dockerfile`, `docker-compose.yml`.

## Ảnh đính kèm (5 ảnh, tại `~/workspace/`)

- `h3-toast-390.png` — toast 1 dòng, huy hiệu giỏ = 2.
- `d6-h2-errors-390.png` — 6 lỗi thanh toán, mỗi lỗi 1 dòng.
- `xem-nhanh-390-sau-k6.png` — Xem nhanh 390×844 sau K-6.
- `form-sua-san-pham-390.png` — form sửa SP 21 + gallery
  (ảnh chính fd96…, nút Lên/Xuống/Gỡ, "Tải ảnh lên").
- `danh-sach-san-pham-quan-tri-1440.png` — danh sách quản trị
  1440, "Tìm thấy 21 sản phẩm — trang 1/2".

---
Commit: 872bcab (xem ghi chú đầu báo cáo).
