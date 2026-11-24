# Hoa Tươi Demo — Website bán hoa

Website bán hoa (tên tạm: Hoa Tươi Demo), xây bằng Next.js + TypeScript +
Tailwind CSS + Prisma + PostgreSQL 16, chạy bằng Docker.

Ngày 1 chỉ làm khung dự án và dữ liệu mẫu: trang chủ tối thiểu hiển thị tên
shop, danh mục và sản phẩm lấy từ cơ sở dữ liệu.

## Yêu cầu

- Docker Desktop (bật WSL2).
- Git.

## Chạy lần đầu (PowerShell, Windows)

```powershell
Copy-Item .env.example .env
```

Sửa mật khẩu trong file `.env` vừa tạo, rồi chạy:

```powershell
docker compose up --build -d
docker compose --profile tools run --rm seed
```

Mở http://localhost:3000.

## Xem cơ sở dữ liệu bằng Adminer

```powershell
docker compose --profile tools up -d adminer
```

Mở http://localhost:8080 (hệ thống: PostgreSQL, máy chủ: `db`).

## Lệnh thường dùng

- Xem log: `docker compose logs -f app`
- Xem trạng thái: `docker compose ps`
- Dừng: `docker compose down`
- Xóa sạch dữ liệu (**mất dữ liệu**): `docker compose down -v`

## Cách đổi tên shop

Sửa `SHOP_NAME` trong file `.env` rồi chạy lại `docker compose up -d`.

## Cấu trúc URL

URL tối đa 2 cấp. Trang danh mục ở cấp 1, trang chi tiết sản phẩm ở cấp 2:

| URL | Trang |
|---|---|
| `/` | Trang chủ |
| `/<slug-danh-mục>` | Trang danh mục, ví dụ `/hoa-tuoi` |
| `/<slug-danh-mục>/<slug-sản-phẩm>` | Trang chi tiết sản phẩm (Ngày 4) |
| `/cart`, `/checkout` | Giỏ hàng, thanh toán (Ngày 4–5) |
| `/search` | Tìm kiếm không phân biệt dấu (Ngày 6) |
| `/order/[mã]` | Trang xác nhận/đơn hàng (Ngày 5) |
| `/login`, `/admin` | Đăng nhập và trang quản trị (Ngày 7) |

URL cũ tiếng Việt (`/gio-hang`, `/thanh-toan`, `/tim-kiem`,
`/don-hang`) chuyển 301 vĩnh viễn sang URL tiếng Anh tương ứng
(quyết định của Henry, Ngày 7). Slug danh mục/sản phẩm lấy từ DB
vẫn giữ tiếng Việt.

Tham số của trang danh mục (kết hợp được, giá trị sai bị bỏ qua):

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| `dip` | `sinh-nhat`, `khai-truong`, `chuc-mung`, `tinh-yeu`, `chia-buon`, `tham-benh`, `qua-tang` | Lọc theo dịp |
| `gia` | `duoi-1tr`, `1-2tr`, `tren-2tr` | Lọc theo giá hiện tại (giá giảm nếu có) |
| `sx` | `gia-tang`, `gia-giam` | Sắp xếp theo giá hiện tại |
| `trang` | số nguyên dương | Trang hiện tại (8 sản phẩm/trang) |

## Giỏ hàng (Ngày 4)

Giỏ hàng lưu trong cơ sở dữ liệu, nhận diện bằng cookie `cart_token`
(`HttpOnly`, `SameSite=Lax`, `Path=/`, hạn 30 ngày). Chỉ xem trang không
tạo giỏ; giỏ chỉ được tạo khi thêm món lần đầu.

- Trang chi tiết `/<slug-danh-mục>/<slug-sản-phẩm>`: thư viện ảnh, giá
  (giá gốc gạch ngang + "Tiết kiệm" khi có giảm giá), chọn số lượng 1–20,
  "Thêm vào giỏ hàng" (toast + huy hiệu header) và "Mua ngay" (chuyển tới
  `/cart`). Cả hai nút đều là form + Server Action nên dùng được khi
  tắt JavaScript.
- Trang giỏ `/cart`: đổi số lượng, xóa dòng, tạm tính theo giá hiện
  tại trong DB (đổi giá bằng SQL phản ánh ngay). Nút "Tiến hành thanh
  toán" dẫn tới `/checkout` (Ngày 5).
- Mỗi sản phẩm có mã `SKU` (quy tắc: tiền tố danh mục + số thứ tự, vd
  `HT-001`) và cờ `inStock`; hết hàng hiện "Tạm hết hàng" và vô hiệu hóa
  các nút mua (kể cả khi gửi yêu cầu giả).
- Sản phẩm liên quan: tối đa 4, cùng danh mục trước rồi lấy bù từ danh
  mục khác.

Dọn giỏ hết hạn (không có đơn hàng) — chạy định kỳ, vd bằng cron:

```powershell
npm run cleanup:carts
```

Kiểm tra song song (10 lệnh thêm đồng thời rồi thêm 30 nữa, số lượng
kẹp ở 20):

```powershell
npm test
```

## Thanh toán và đơn hàng (Ngày 5)

- Trang `/checkout` (một trang): người đặt, người nhận ("Giống người
  đặt" mặc định bật), khu vực giao hàng, phương thức giao (giao nhanh 2
  giờ / giao trong ngày / hẹn ngày giờ), lời nhắn trên thiệp (tối đa 200
  ký tự), ghi chú (tối đa 300 ký tự), thanh toán COD hoặc chuyển khoản.
  Tắt JavaScript vẫn đặt được (form thường, máy chủ kiểm tra lại toàn bộ).
- Đơn tạo trong một giao dịch DB: giỏ ACTIVE → CONVERTED có điều kiện
  (chặn đặt trùng khi gửi song song), tính lại toàn bộ số tiền từ dữ liệu
  máy chủ, mã đơn 10 ký tự Crockford base32. Trang `/order/[mã]` là
  trang xác nhận kiêm theo dõi đơn (không lập chỉ mục, header
  `Cache-Control: no-store`).
- Chuyển khoản: mã QR VietQR tự dựng tại máy chủ (chuỗi payload EMVCo +
  CRC16), không gọi dịch vụ ngoài. Chỉ hiện lựa chọn "Chuyển khoản" khi
  đã cấu hình đủ `BANK_BIN`, `BANK_NAME`, `BANK_ACCOUNT`,
  `BANK_ACCOUNT_NAME` trong `.env`.
- Các giá trị mặc định tạm (giờ làm việc 07:30–21:00, khung giờ giao,
  thời gian chuẩn bị tối thiểu 120 phút, đặt trước tối đa 30 ngày, 4 khu
  vực mẫu) nằm trong `src/config/delivery.ts` — Henry cần xác nhận hoặc
  sửa trước khi mở bán thật.

### Báo đơn qua Telegram

1. Mở Telegram, nhắn cho `@BotFather`, gửi `/newbot` và làm theo hướng
   dẫn để lấy token.
2. Nhắn một tin bất kỳ cho bot vừa tạo.
3. Mở `https://api.telegram.org/bot<token>/getUpdates` trong trình
   duyệt, tìm `chat.id` trong kết quả.
4. Điền `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` vào `.env`, chạy lại
   ứng dụng. Thiếu hai biến này thì đơn vẫn tạo bình thường, chỉ không
   gửi báo.

Gửi lại báo cho các đơn chưa được báo (khi Telegram từng lỗi):

```powershell
npm run resend:notifications
```

## Tìm kiếm và "Xem nhanh" (Ngày 6)

- Tìm kiếm không phân biệt dấu (`/search`): tìm trong tên, SKU, tên
  danh mục và tag; mỗi từ phải xuất hiện dưới dạng chuỗi con (phép AND);
  xếp hạng: tên chứa đủ mọi từ đứng trước, rồi `sortOrder` danh mục,
  rồi `sortOrder` sản phẩm, rồi `id`. Ô tìm trên header kèm gợi ý
  (`/api/search/suggest`, tối đa 5) — tắt JavaScript vẫn tìm được vì
  ô tìm là form GET thường.
- Hàm `vi_unaccent(text)` trong DB (migration `search_unaccent`) dùng
  extension `unaccent` của PostgreSQL để bỏ dấu tiếng Việt (kể cả
  `đ/Đ` → `d`). Với vài trăm sản phẩm không cần chỉ mục; khi quá
  khoảng 2.000 sản phẩm thì thêm chỉ mục trigram (`pg_trgm`) trên biểu
  thức tìm kiếm để giữ tốc độ.
- "Xem nhanh": nút trên thẻ sản phẩm ở trang chủ, danh mục và tìm kiếm
  mở cửa sổ `<dialog>` (tải lười); khối "Những thiết kế đồng điệu" ở
  trang chi tiết giữ nút "Xem chi tiết". Tắt JS thì nút là liên kết
  tới trang chi tiết nên vẫn hoạt động.

## Trang quản trị (Ngày 7)

Đăng nhập bằng **tài khoản + mật khẩu** tại `/login`; quản lý sản
phẩm tại `/admin/products` (danh sách gồm cả sản phẩm đã ẩn, thêm/sửa/
ẩn, tải ảnh lên). Không có quản lý đơn hàng (Ngày 8), không xóa cứng
sản phẩm (chỉ ẩn).

```powershell
# Tạo hash mật khẩu (mật khẩu đọc từ stdin, không qua tham số dòng lệnh)
echo -n '<mật khẩu>' | npx tsx scripts/hash-admin-password.ts
```

Điền vào `.env` (xem `.env.example`):

- `ADMIN_USERNAME` — mặc định `admin` khi không đặt.
- `ADMIN_PASSWORD_HASH` — dạng `scrypt$<saltHex>$<hashHex>` do script
  trên in ra. Thiếu hoặc sai định dạng thì mọi `/admin/*` và `/login`
  trả **503** "Chưa cấu hình quản trị".
- `ADMIN_COOKIE_SECURE=false` — chỉ để thử qua HTTP; **không tắt trên
  VPS thật** (mặc định `Secure` khi `NODE_ENV=production`).

Phiên đăng nhập: cookie `admin_session` (`HttpOnly`, `SameSite=Strict`,
`Path=/`), hết hạn tuyệt đối 12 giờ; DB chỉ lưu hash sha256 của token.
Giới hạn thử sai: quá 5 lần sai trong 15 phút theo IP, hoặc 20 lần sai
toàn hệ thống, thì trả 429. IP lấy từ header `X-Forwarded-For` do
reverse proxy đặt — chỉ tin `TRUSTED_PROXY_HOPS` phần tử CUỐI của
danh sách (mặc định 1, đúng cho Vercel và nginx/Caddy 1 proxy); các
phần tử đầu do client tự đặt được nên không tin. Thiếu header thì
dự phòng `X-Real-IP`, không có thì "unknown". Khi chạy sau Caddy/
Nginx phải chắc proxy chuyển tiếp header này, nếu không mọi lần thử
sẽ tính chung một IP. `TRUSTED_PROXY_HOPS` đặt SAI (lớn hơn số proxy
đáng tin thật sự) thì lại tin IP do client đặt — kẻ tấn công đổi
header mỗi lần là né được giới hạn 5 lần/IP. Hệ quả của giới hạn
toàn hệ thống (chấp nhận, chỉ ghi chú): kẻ tấn công cố tình đăng
nhập sai 20 lần cũng khóa được Henry tối đa 15 phút.

### Ảnh tải lên

- Tải lên qua `POST /api/admin/upload` (chỉ JPEG/PNG/WebP theo magic
  bytes, ≤ 5 MB/ảnh, ≤ 6 ảnh/sản phẩm). Tên file do máy chủ sinh
  (`<12 ký tự đầu sha256>.<ext>`), lưu ở `UPLOAD_DIR` (mặc định
  `./data/uploads`, tự tạo; thư mục `data/` không commit lên Git).
  Ảnh phục vụ ở `/uploads/<tên>` (header `immutable`, `nosniff`).
- Ảnh không qua xử lý `sharp` (chưa có trong bản build): lưu nguyên
  file đã kiểm, không xoay theo EXIF, không bỏ metadata.
- Dọn file mồ côi (không sản phẩm nào dùng, cũ hơn 24 giờ):
  `npx tsx scripts/prune-uploads.ts` (chỉ liệt kê) hoặc thêm
  `--delete` để xóa thật.

**Volume trên VPS (Ngày 10):** ảnh tải lên phải nằm ngoài image
Docker (volume) và ghi được bởi user không phải root của container —
vd trong `docker-compose.yml` thêm:

```yaml
volumes:
  - uploads:/app/data/uploads
```

(kèm `UPLOAD_DIR=/app/data/uploads`). Ngày 7 chưa sửa
`Dockerfile`/`docker-compose.yml`; việc thêm volume quyết cùng Henry
ở Ngày 10. **Trên Vercel ảnh tải lên không bền** (filesystem tạm,
mất khi redeploy) — chỉ dùng để xem thử, xử lý ở Ngày 10 VPS.

## Chạy bản standalone (không dùng Docker)

Sau `npm run build`, Next tạo thư mục `.next/standalone/` chứa máy chủ
độc lập. Script `postbuild` tự xóa `.next/standalone/.env*` (file này có
thể chứa mật khẩu DB thật) nên không bao giờ chạy máy chủ bằng file đó.
Chạy bằng biến môi trường từ `.env` của dự án:

```powershell
node --env-file=.env .next/standalone/server.js
```

(Ngày 10: chạy trên VPS theo cách này, xem thêm hướng dẫn triển khai.)

## Thông tin liên hệ

Hotline, Zalo, địa chỉ và giờ mở cửa đọc từ file `.env`, đổi không cần sửa code:

- `HOTLINE` — số điện thoại hiển thị và liên kết `tel:`.
- `ZALO_PHONE` — số Zalo (mặc định theo `HOTLINE` nếu để trống).
- `SHOP_ADDRESS` — địa chỉ cửa hàng hiển thị ở footer.
- `OPEN_HOURS` — giờ mở cửa hiển thị ở footer.

Sau khi sửa `.env`, chạy lại để áp dụng:

```powershell
docker compose up -d
```

## Xử lý sự cố

- Docker Desktop chưa chạy: mở Docker Desktop rồi chạy lại lệnh.
- Trùng cổng 3000 hoặc 5432: đổi `APP_PORT` hoặc `DB_PORT` trong file `.env`.
- Lỗi xuống dòng CRLF: file đã ép LF bằng `.gitattributes`; nếu Git báo khác, kiểm tra lại cấu hình Git `core.autocrlf`.
