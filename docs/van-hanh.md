# Hướng dẫn vận hành — dành cho chủ shop (người trực admin)

Tài liệu này hướng dẫn các thao tác thường xuyên trong trang quản trị
(`/admin`), cách sao lưu/khôi phục và cách xử lý khi gặp sự cố. Đăng
nhập tại `/login` bằng tài khoản quản trị duy nhất (tài khoản + mật
khẩu đặt trong biến môi trường `ADMIN_USERNAME` /
`ADMIN_PASSWORD_HASH`). Phiên hết hạn tuyệt đối sau 12 giờ và tự hết
hạn sau 30 phút không thao tác — bị văng ra thì đăng nhập lại, đó là
hành vi đúng, không phải lỗi.

Mọi thay đổi trong admin (đổi trạng thái đơn, hoàn tiền, sửa sản phẩm,
danh mục, khu vực, cài đặt, ngân hàng…) đều được ghi vào **nhật ký
hoạt động** (`/admin/activity`) và **không có đường xóa/sửa** trong
giao diện — xem lại ở đó khi cần đối chiếu.

## 1. Quản lý đơn hàng (`/admin/orders`)

### Xem và tìm đơn

- Danh sách chia tab theo trạng thái: **Đã tiếp nhận (NEW) → Đã xác
  nhận (CONFIRMED) → Đang giao (DELIVERING) → Đã giao (COMPLETED)**,
  tab **Đã hủy (CANCELLED)** và tab **Tất cả**. Thẻ **Đơn cần xử lý**
  ở trang Tổng quan (`/admin`) đếm các đơn NEW + CONFIRMED +
  DELIVERING.
- Lọc: theo phương thức thanh toán (COD/chuyển khoản), trạng thái
  thanh toán, ngày, khu vực; tìm theo mã đơn, tên hoặc số điện thoại
  người đặt/nhận. Bộ lọc nằm trên URL nên có thể bookmark hoặc gửi
  link cho nhau.
- Bấm vào một đơn để xem chi tiết: người đặt, người nhận, địa chỉ,
  khu vực, ngày/khung giờ giao, từng dòng hàng, phí giao, tổng tiền,
  phương thức thanh toán và trạng thái thanh toán.

### Đổi trạng thái — chỉ đi theo luồng cho phép

| Từ | Được chuyển tới |
|---|---|
| Đã tiếp nhận | Đã xác nhận, Đã hủy |
| Đã xác nhận | Đang giao, Đã hủy |
| Đang giao | Đã giao, Đã hủy |
| Đã giao / Đã hủy | (trạng thái cuối — không chuyển tiếp được) |

- Nút chuyển trạng thái chỉ hiện các bước hợp lệ; máy chủ cũng chặn
  bước chuyển sai nên không thể "nhảy cóc" (vd NEW → Đã giao).
- **Hủy đơn bắt buộc nhập lý do** — lý do được lưu cùng đơn và ghi
  nhật ký. Đơn đã hủy không chuyển lại được.
- Trạng thái **Đang chuẩn bị (PREPARING)** có trong hệ thống nhưng
  hiện không dùng: không có bước chuyển nào vào/ra, không tính vào
  "Cần xử lý" — đơn ở trạng thái này (nếu có từ trước) chỉ thấy
  trong tab "Tất cả".
- **In phiếu giao hàng (khổ A5):** trong trang chi tiết đơn, nút
  "In phiếu giao hàng" mở trang in — in hoặc lưu PDF rồi giao cho
  shipper.

### Hoàn tiền

Hoàn tiền (khi khách đã chuyển khoản mà đơn bị hủy, hoặc thỏa thuận
hoàn lại) được ghi lý do rõ ràng trong đơn và nhật ký. Ghi đúng lý
do thật (vd "khách hủy sau khi đã chuyển khoản", "hết hàng — hoàn
100%") để sau này đối chiếu với sao kê ngân hàng. Tiền hoàn được
chuyển tay qua ngân hàng — shop chưa có hoàn tiền tự động.

### Tra cứu đơn của khách

Khách tự tra cứu tại `/order/<mã đơn>` (mã 10 ký tự in trên trang xác
nhận sau khi đặt). Trang này hiện tên, địa chỉ, số điện thoại đã che
một phần (vd `090****567`) và trạng thái đơn. Nếu khách báo "không
tìm thấy đơn": kiểm tra mã khách nhập (đủ 10 ký tự, không lẫn
chữ O/I), rồi tìm đơn đó trong `/admin/orders` bằng ô tìm kiếm.

## 2. Quản lý sản phẩm và danh mục

### Sản phẩm (`/admin/products`)

- **Thêm/sửa:** tên, danh mục, mô tả, giá, giá khuyến mãi (để trống
  nếu không giảm), ảnh (tối đa 6 ảnh, mỗi ảnh JPEG/PNG/WebP ≤ 2 MB,
  mỗi chiều ≤ 6000 px; KHÔNG nhận SVG), tag, thứ tự hiển thị, cờ
  "còn hàng". Sản phẩm hết hàng (`inStock` tắt) hiện **"Tạm hết
  hàng"** ngoài shop và khách không đặt được.
- **Ẩn/hiện:** sản phẩm không bán nữa thì **ẩn** (không xóa cứng —
  đơn cũ vẫn giữ được liên kết tới sản phẩm). Sản phẩm đã ẩn vẫn thấy
  trong danh sách admin, không thấy ngoài shop.
- **Cột Nguồn:** mỗi sản phẩm ghi rõ nguồn `Seed mẫu` (20 sản phẩm
  mẫu ban đầu) hay `Nhập tay` (thêm trong admin) / `Nhập từ file`
  (nhập hàng loạt, xem dưới). Lọc theo nguồn để biết sản phẩm nào là
  dữ liệu mẫu.
- **Thao tác hàng loạt:** tick chọn nhiều sản phẩm → thanh thao tác
  hiện ra → **Ẩn/Hiện nhiều sản phẩm cùng lúc** (có hộp xác nhận ghi
  rõ số lượng trước khi áp dụng).
- **Nhập sản phẩm từ nguồn ngoài:** nhập từ URL nguồn dữ liệu
  (chỉ `http(s)`, có giới hạn tốc độ, chỉ chạy khi đã đăng nhập
  admin) hoặc tệp CSV/JSON (tối đa 5 MB, 2.000 dòng/lô, tối đa
  5 lô/ngày) qua trang `/admin/products/import` theo 6 bước:
  nguồn → ánh xạ cột → xem trước → xác nhận quyền → chạy →
  kết quả. Hàng nhập luôn ở trạng thái **Chờ duyệt** và **ẩn**
  khỏi shop/sitemap/tìm kiếm cho tới khi duyệt; duyệt từng cái
  hoặc tối đa 50/lần (tùy chọn đồng thời Hiện); từ chối = xóa;
  hoàn tác lô xóa mọi sản phẩm của lô còn chờ duyệt (giữ lại
  sản phẩm đã duyệt). Nhập lại cùng nguồn: cập nhật theo khóa
  (tên nguồn + mã ngoài); sản phẩm đã duyệt mà sửa tay sau khi
  nhập thì mặc định bỏ qua (bật ghi đè mới cập nhật); không bao
  giờ ghi đè sản phẩm hệ thống (trùng SKU/slug → bỏ qua + lý do).
  Nguồn không hợp lệ hoặc trỏ về địa chỉ nội bộ sẽ bị từ
  chối — đó là hành vi đúng. Kiểm lại từng sản phẩm sau khi nhập
  (tên, giá, ảnh) trước khi để hiện ngoài shop.
- **Ô công thức trong dữ liệu nhập (CSV/JSON):** ô bắt đầu bằng
  `=`, `+`, `-`, `@`, tab hoặc ký tự xuống dòng được **giữ
  nguyên** khi nhập (có đánh cờ) — nhưng nếu sau này có chức
  năng **xuất CSV**, bắt buộc phải vô hiệu hóa công thức trước
  khi xuất (ví dụ thêm dấu `'` ở đầu ô) để file xuất ra mở bằng
  bảng tính không chạy công thức lạ.
- **Cờ test `SAFE_FETCH_ALLOW_LOOPBACK` (chỉ máy local):** mặc
  định tắt — server chỉ fetch feed/ảnh từ địa chỉ công khai.
  Khi cần probe với máy chủ giả trên chính máy này thì khởi
  động server local với `SAFE_FETCH_ALLOW_LOOPBACK=1`; **không
  bao giờ đặt biến này trên Vercel** (ở đó biến môi trường
  `VERCEL=1` nên cờ luôn bị ép tắt).

### Danh mục (`/admin/categories`)

- Thêm/sửa tên, mô tả, ảnh đại diện, thứ tự. **Xóa danh mục chỉ được
  khi danh mục đang trống** (không còn sản phẩm) — nút xóa bị khóa
  khi còn sản phẩm; muốn xóa thì chuyển/hide hết sản phẩm trong đó
  trước.
- Slug danh mục không được trùng slug trang tĩnh hay đường dẫn cố
  định (`cart`, `checkout`, `search`, `admin`, …) — hệ thống báo lỗi
  đúng ô slug khi trùng. Đổi slug danh mục làm link cũ hỏng (không
  tự chuyển hướng) nên hạn chế đổi sau khi đã công bố.

### Trang tĩnh và bài viết

- Trang tĩnh (`/admin/pages`): giới thiệu, liên hệ, chính sách,
  FAQ… — soạn bằng Markdown, xuất bản/nháp bằng nút mắt. Trang nháp
  ngoài shop trả 404. **Chưa có mục Tin tức/Bài viết** — trong menu
  admin mục "Bài viết / Tin tức" đang để "Sắp có", chưa dùng được.
- Xem trước Markdown 2 cột (B6): ô soạn bên trái, bản xem trước bên
  phải (màn hình hẹp thì xếp dọc).

## 3. Cài đặt (`/admin/settings/*`)

| Trang | Đổi được |
|---|---|
| Chung (`general`) | Tên shop, slogan, logo, favicon |
| Liên hệ (`contact`) | Hotline, Zalo, email, địa chỉ, giờ mở cửa, mạng xã hội |
| SEO (`seo`) | Tiêu đề/description mặc định, ảnh OG |
| Ngân hàng & QR (`bank`) | Ngân hàng nhận chuyển khoản (BIN, số tài khoản, tên chủ TK), bật/tắt chuyển khoản, mẫu nội dung chuyển khoản `DH {ORDER_CODE}` |
| Khu vực & phí (`shipping-zones`) | Danh sách khu vực giao + phí từng khu vực; tắt khu vực thì đơn mới không chọn được khu vực đó |
| Telegram (`telegram`) | Bot token + chat ID để báo đơn mới (không bắt buộc — Henry quyết không dùng; thiếu thì đơn vẫn tạo bình thường, chỉ không gửi báo) |

- **Đổi thông tin ngân hàng là thao tác nhạy cảm** (khách chuyển
  khoản theo đúng số này): đổi xong kiểm tra lại ngay ngoài trang
  checkout (chọn "Chuyển khoản" xem QR có đúng số tài khoản mới
  không). Mọi lần đổi đều ghi nhật ký, số tài khoản trong nhật ký
  chỉ hiện dạng che (`****1098`).
- **Lưu cài đặt cần nhập lại mật khẩu admin để xác nhận** (khi form
  yêu cầu) — đó là lớp bảo vệ chống người khác dùng máy bạn đang
  đăng nhập để đổi ngân hàng.
- Lưu xong, mặt shop cập nhật ngay (không cần deploy lại). Nếu đổi
  mà ngoài shop chưa thấy: tải lại trang (F5) — cài đặt được cache
  theo tag, lần lưu nào cũng xóa cache; đừng sửa trực tiếp trong DB.

### 3.1. Xác thực hai bước (TOTP) cho admin — `/admin/security` (Ngày 19 Phần C)

**Chờ Henry (C4):** 2FA tắt mặc định trên production. Để bật, Henry làm 5 bước sau trên điện thoại của mình (cần app Google Authenticator, Authy hoặc 1Password):

1. Đăng nhập admin trên production, mở **Cài đặt → Bảo mật**.
2. Bấm **Bắt đầu bật xác thực hai bước**, quét mã QR bằng app xác thực (hoặc nhập tay khóa hiện trên màn hình).
3. Nhập mã 6 số vừa hiện trong app, bấm **Xác nhận và bật 2FA**.
4. Cất **10 mã khôi phục** hiện ra một lần duy nhất ở nơi an toàn (quản lý mật khẩu hoặc giấy) — mỗi mã dùng được đúng một lần khi mất điện thoại; rời trang là không xem lại được.
5. Từ nay đăng nhập cần thêm mã 6 số; lưu thông tin ngân hàng cần thêm mã 6 số (ngoài nhập lại mật khẩu).

**Trước bước trên (agent/dev):** đặt biến môi trường `AUTH_ENCRYPTION_KEY` trên Vercel (Dashboard → Project → Settings → Environment Variables → Production). Sinh giá trị bằng lệnh `openssl rand -base64 32` trên máy dev (đúng 32 byte, base64) rồi dán vào — không in giá trị ra log/báo cáo/chat, không commit vào repo. **Cất một bản sao khóa vào trình quản lý mật khẩu của chủ shop** (cùng nơi cất 10 mã khôi phục) — nếu đổi/mất khóa thì 2FA hiện tại không còn xác minh được (bí mật cũ không giải mã được), phải đặt lại an toàn theo mục thoát hiểm bên dưới rồi bật lại 2FA từ đầu. Thiếu khóa thì trang Bảo mật báo rõ lý do và 2FA tự tắt (đăng nhập không đổi). Đổi khóa sau khi đã bật 2FA sẽ làm bí mật cũ không giải mã được — phải tắt 2FA rồi bật lại từ đầu.

**Mất điện thoại + mã khôi phục (thoát hiểm):** chủ sở hữu Vercel đặt biến môi trường `ADMIN_TOTP_DISABLE=1` (Production) rồi redeploy — đăng nhập tạm thời chỉ cần mật khẩu. Mỗi lần dùng cơ chế này đều ghi nhật ký (`totp.escape-used`, xem ở Nhật ký hoạt động → Bảo mật). Xong việc **gỡ biến này ngay và redeploy** để bật lại bước TOTP (không để biến thoát hiểm nằm lại trên production), rồi bật lại 2FA/tạo lại mã khôi phục nếu cần; sau khi bật lại, **kiểm tra lại trạng thái 2FA ở trang Bảo mật** (phải hiện "Đang bật") và thử đăng xuất → đăng nhập một lần để chắc chắn mã 6 số hoạt động.

**Không đưa mã khôi phục hay khóa thật vào ảnh chụp/báo cáo** (quy tắc Ngày 20 B5 — ảnh/báo cáo chỉ dùng dữ liệu kiểm thử, và mã trong ảnh Ngày 19 là mã kiểm thử đã xóa ngay sau khi kiểm).

**Lưu ý về gói Vercel (Ngày 20 B5):** gói Hobby của Vercel chỉ dành cho dự án phi thương mại; trước khi nhận đơn thật nên chuyển sang gói phù hợp (ghi chú vận hành chung, không chặn triển khai).

**Lưu ý:** bật/tắt 2FA sẽ buộc đăng nhập lại mọi phiên admin khác (chỉ giữ phiên đang thao tác). Mã 6 số đổi mỗi 30 giây; nhập sai 5 lần trong 15 phút thì bị khóa tạm 15 phút.

## 4. Theo dõi đơn mới khi không có thông báo đẩy

Shop chưa dùng Telegram hay email để báo đơn mới — mọi báo hiệu đều
chạy ngay trong tab quản trị đang mở. Đọc kỹ mục 4.1 trước: **đóng
hết tab admin thì không có báo hiệu gì cả**.

### 4.1. Nguyên tắc: báo hiệu chỉ chạy khi có tab admin đang mở

- Khi một tab quản trị đang mở (trang Tổng quan, Đơn hàng, hay bất kỳ
  trang `/admin` nào), trình duyệt tự hỏi máy chủ mỗi **60 giây** xem
  có đơn mới cần xử lý không.
- Tab bị ẩn (chuyển sang tab khác, thu nhỏ cửa sổ) thì trình duyệt
  **tạm dừng hỏi**; quay lại tab thì hỏi lại ngay rồi tiếp tục mỗi
  60 giây.
- **Đóng hết tab admin thì không có báo hiệu gì** — trình duyệt không
  chạy nền, máy chủ không tự gửi gì về điện thoại hay máy tính của
  bạn. Đây là giới hạn có chủ đích của cơ chế này (không cần tài
  khoản dịch vụ ngoài), không phải lỗi.

### 4.2. Cách vận hành trong giờ làm việc

Chọn một trong hai cách, giữ trong suốt giờ làm việc:

1. **Máy tính:** mở sẵn một tab trang Tổng quan (`/admin`) và để đó.
   Có đơn mới, tab sẽ báo ngay trong vòng 60 giây (xem mục 4.3).
2. **Điện thoại:** mở trình duyệt, đăng nhập admin, mở sẵn trang Tổng
   quan (`/admin`) và để tab đó mở. Lưu ý: điện thoại khóa màn hình
   hay trình duyệt bị hệ thống đóng tab thì cũng mất báo hiệu như
   đóng tab trên máy tính — thỉnh thoảng mở lại trang Tổng quan để
   kiểm tra (mục 4.4).

Ngoài giờ làm việc, không cần để tab mở. Sáng hôm sau mở trang Tổng
quan là thấy ngay số đơn chờ xử lý.

### 4.3. Khi có đơn mới, bạn sẽ thấy gì

Khi số đơn cần xử lý tăng so với lần hỏi trước (có đơn mới vào):

- **Chuông** trên thanh đầu trang hiện số đơn cần xử lý hiện tại.
- **Tiêu đề tab** đổi thành `(N) Hoa Tươi Demo — Quản trị` (N là số
  đơn mới chưa xem).
- **Toast** hiện ở góc dưới-phải: `Có N đơn mới`, kèm liên kết
  **Xem danh sách** tới danh sách đơn cần xử lý.
- Bấm vào chuông, hoặc mở danh sách đơn, là đã xem — số mới biến
  mất, tiêu đề tab trở lại bình thường.

Hai tùy chọn thêm (đều **mặc định TẮT**, bật trong menu người dùng —
bấm vào tên/ảnh đại diện ở góc trên-phải):

- **Âm báo đơn mới:** tiếng "bíp" ngắn khi có đơn mới. Chỉ phát sau
  khi bạn đã bấm/phím gì đó trên trang (trình duyệt cấm trang tự
  phát âm khi chưa có thao tác). Tùy chọn được nhớ trên trình duyệt
  đó.
- **Thông báo trình duyệt:** hiện thông báo hệ thống ngay cả khi tab
  admin không phải tab đang xem (nhưng trình duyệt vẫn phải đang
  chạy và tab vẫn mở). Trình duyệt **chỉ hỏi quyền khi bạn bấm công
  tắc bật** — không tự hỏi lúc mở trang. Nếu bạn đã từng bấm "Chặn"
  thì công tắc không bật được nữa; muốn bật lại thì cho phép quyền
  thông báo trong cài đặt của trang (biểu tượng ổ khóa/khóa bên cạnh
  thanh địa chỉ).

### 4.4. Kiểm tra thủ công (không cần chờ báo hiệu)

Bất cứ lúc nào, mở trang Tổng quan (`/admin`) và xem thẻ
**Đơn cần xử lý**:

- Số lớn trên thẻ = số đơn đang chờ (mới nhận, đã xác nhận, đang giao).
- Dòng dưới thẻ: **"N đơn đã quá hạn giao"** — số đơn cần xử lý mà
  ngày giao đã qua (ngày giao trước hôm nay theo giờ Việt Nam, đơn
  chưa giao xong và chưa hủy). Bấm vào dòng đó để xem đúng N đơn đó.
- Nếu số trên thẻ là 0 và không có dòng quá hạn thì không còn đơn
  nào chờ xử lý.

### 4.5. Những gì cơ chế này KHÔNG làm

- Không gửi email, không gửi tin nhắn Telegram/Zalo.
- Không báo khi đóng hết tab, tắt máy, hay tắt trình duyệt.
- Không tự động xử lý, xác nhận hay giao đơn — mọi thao tác trên đơn
  vẫn do bạn bấm tay trong trang quản trị.
- Không thu thập thêm dữ liệu khách: lần hỏi mỗi 60 giây chỉ lấy về
  hai con số (số đơn cần xử lý và mã đơn mới nhất), không lấy tên,
  số điện thoại, địa chỉ hay tổng tiền.

## 5. Sao lưu và khôi phục

### 5.1. Hiện trạng (Ngày 17 — ghi đúng sự thật)

- **Nhánh snapshot Neon `snapshot-2026-11-26` đã tạo** (Henry tạo
  ngày 26/11/2026 lúc ~20:44, theo báo cáo Ngày 15) — đây là điểm
  khôi phục của cơ sở dữ liệu production trước các đợt xóa dữ liệu
  hàng loạt.
- **Sao lưu tự động 2h sáng + giữ 7 ngày là việc vận hành trên
  Neon/Vercel, CHƯA tự động hóa trong repo này.** Trong repo không
  có script hay job nào tự chụp snapshot, và cũng chưa có job nào
  kiểm tra snapshot còn tốt hay không. Muốn chắc chắn: định kỳ mở
  Neon dashboard kiểm tra nhánh snapshot còn đó và ngày tạo.
- Mọi script xóa dữ liệu hàng loạt trong repo
  (`scripts/clean-production.ts`) đều **bắt buộc phải có snapshot
  chụp TRƯỚC** (tham số `--snapshot=<vị trí/tên snapshot>`) — không
  có snapshot thì script từ chối xóa. Đây là chốt chặn cuối cùng,
  đừng tìm cách vòng qua nó.

### 5.2. Trước khi xóa dữ liệu hàng loạt (bắt buộc)

1. Chụp snapshot production TRƯỚC (Neon dashboard → tạo branch/
   snapshot mới, hoặc `pg_dump` ra file và giữ file ở chỗ an toàn).
2. Ghi lại tên/vị trí snapshot.
3. Chạy script xóa ở chế độ liệt kê trước (dry-run, mặc định), đọc
   kỹ danh sách sẽ xóa, rồi mới chạy `--confirm` kèm `--snapshot`
   và `--i-know-this-is-production`.
4. Xóa xong kiểm tra lại số lượng trên production ngay.

### 5.3. Khôi phục khi có sự cố dữ liệu

1. **Dừng nhận đơn mới** nếu có thể (tạm thời không xử lý đơn trong
   admin) để tránh ghi thêm dữ liệu lên nền dữ liệu lỗi.
2. Xác định thời điểm dữ liệu còn đúng lần cuối — đối chiếu nhật ký
   hoạt động (`/admin/activity`) và đơn gần nhất.
3. Khôi phục từ nhánh snapshot Neon gần nhất TRƯỚC thời điểm lỗi
   (thao tác trong Neon dashboard — việc này do Henry/người giữ tài
   khoản Neon làm, vì cần đăng nhập Neon). **Quy trình khôi phục
   này chưa từng chạy thử end-to-end trên production** — lần đầu
   chạy thật cần làm cẩn thận và kiểm tra lại toàn bộ sau khi khôi
   phục (số sản phẩm, số đơn, cài đặt ngân hàng).
4. Sau khôi phục: mở trang chủ, trang danh mục, trang chi tiết, đăng
   nhập admin, kiểm tra một đơn gần nhất còn đủ thông tin; chạy
   `bash scripts/smoke-live.sh https://flowershop-steel.vercel.app/`
   để kiểm nhanh.
5. **Lưu ý:** khôi phục từ snapshot sẽ mất mọi thay đổi sau thời
   điểm snapshot (đơn mới, sửa giá, cài đặt mới) — ghi lại những gì
   sẽ mất trước khi khôi phục, và nhập lại tay sau đó nếu cần.

### 5.5. Lùi code về bản trước (Vercel Instant Rollback)

Khi bản deploy mới (Ngày 17) gây lỗi trên live mà chưa rõ nguyên
nhân, lùi code về bản trước thay vì sửa vội trên production:

1. Mở Vercel Dashboard → project `flowershop` → **Deployments**.
2. Tìm deployment của commit **`6e4a514`** (bản live trước Ngày 17 —
   "Ngày 16 fixup 3") → bấm `⋯` → **Instant Rollback** (hoặc
   **Promote to Production**) → xác nhận.
3. Kiểm tra: mở https://flowershop-steel.vercel.app/ — trang chủ
   phải trả 200, đăng nhập admin được; chạy
   `bash scripts/smoke-live.sh https://flowershop-steel.vercel.app/`
   (kỳ vọng 21/21).
4. **Lưu ý:** rollback chỉ lùi CODE, không lùi dữ liệu. Migration
   Ngày 17 chỉ thêm cột `source` và bảng `rate_limit_events` mới —
   code cũ không đọc chúng nên chạy bình thường; đơn hàng/sản phẩm
   tạo sau deploy Ngày 17 vẫn còn nguyên trong DB.
5. Lùi xong vẫn lỗi thì xem Runtime Logs của deployment đang chạy
   (Deployments → deployment → **Runtime Logs**) và báo lại cho
   người phụ trách kỹ thuật kèm ảnh chụp. Đừng push lại commit
   Ngày 17 cho tới khi rõ nguyên nhân lỗi.

### 5.6. Dữ liệu test local (không phải production)

Trên máy dev, dựng lại DB bằng `~/workspace/rebuild-flower-db.mjs`
+ `prisma migrate deploy` + `prisma db seed` (đủ 20 sản phẩm, 4 danh
mục, 4 khu vực, 3 trang tĩnh). Dữ liệu test (SP TEST-001 + 3 đơn
mẫu) tạo bằng `npx tsx scripts/recreate-test-data.ts`, dọn bằng
`npx tsx scripts/clean-test-data.ts --delete`. **Không bao giờ chạy
hai script này trỏ vào DB production** — chúng tự từ chối khi
`DATABASE_URL` không phải localhost.

## 6. Xử lý sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Có đơn mới mà tab không báo | Tab admin có đang mở không (mục 4.1)? Đã quá 60 giây chưa? Tải lại trang (F5) rồi xem thẻ "Đơn cần xử lý" — số trên thẻ luôn đúng dù cơ chế báo có trục trặc. |
| Tiêu đề tab vẫn còn `(N)` sau khi đã xem đơn | Bấm vào chuông một lần, hoặc mở lại danh sách đơn — số mới sẽ xóa. |
| Bật âm báo mà không nghe tiếng | Âm chỉ phát sau khi bạn đã thao tác trên trang; bấm chuột một lần vào trang rồi chờ đơn mới tiếp theo. Kiểm tra loa/âm lượng của máy và công tắc trong menu người dùng. |
| Bật thông báo trình duyệt mà không thấy | Kiểm tra quyền thông báo của trang trong cài đặt trình duyệt (biểu tượng bên cạnh thanh địa chỉ). Trình duyệt phải đang chạy và tab admin vẫn mở. |
| Đăng nhập bị văng ra giữa chừng | Phiên admin hết hạn sau 30 phút không có thao tác nào (kể cả hỏi đơn mới cũng tính là có hoạt động khi tab đang mở). Đăng nhập lại. |
| Đăng nhập sai 5 lần liên tiếp → báo lỗi 429 | Đã vượt giới hạn thử sai (5 lần/15 phút theo IP). Đợi 15 phút rồi thử lại; kiểm tra kỹ mật khẩu (phân biệt hoa/thường). |
| Khách báo đặt hàng lỗi / không tạo được đơn | Hỏi khách: mã lỗi hiện gì, đang ở bước nào (giỏ, thanh toán), phương thức nào (COD/chuyển khoản — chuyển khoản chỉ hiện khi đã cấu hình ngân hàng). Kiểm tra trong admin: sản phẩm còn hàng không, khu vực giao còn bật không, phương thức thanh toán còn bật không. |
| Ảnh tải lên bị từ chối | Kiểm: đúng JPEG/PNG/WebP không (không nhận SVG), ≤ 2 MB (logo ≤ 1 MB, favicon ≤ 256 KB), mỗi chiều ≤ 6000 px, tên file không chứa `../`. Ảnh chụp từ điện thoại thường quá lớn — nén/xoay ảnh trước khi tải. |
| Đổi cài đặt mà ngoài shop chưa thấy | Tải lại trang (F5). Nếu vẫn chưa thấy, kiểm tra xem mình có đang xem đúng shop (local hay production) không; cài đặt lưu xong là revalidate ngay, không cần deploy. |
| Trang báo lỗi 500 | Chụp màn hình + ghi lại đang làm gì, lúc nào; thử tải lại. **Hiện chưa có cảnh báo 500 tự động** (không có dịch vụ cảnh báo) nên lỗi chỉ phát hiện khi có người báo hoặc tự kiểm tra. Kiểm tra bằng `bash scripts/smoke-live.sh <link-shop>`; lỗi lặp lại thì báo lại cho người phụ trách kỹ thuật kèm ảnh chụp. |
| Trang chủ/danh mục trắng tinh hoặc thiếu ảnh | Kiểm tra ảnh sản phẩm còn không (đổi adapter Blob/đĩa có thể làm mất ảnh cũ nếu URL đổi); kiểm tra cài đặt tên shop/logo còn không. |
| Muốn xóa dữ liệu test khỏi production | Chỉ dùng `scripts/clean-production.ts`, theo đúng mục 5.2 — bắt buộc có snapshot trước. Không xóa tay trong DB production. |
