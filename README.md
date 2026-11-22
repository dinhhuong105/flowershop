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
| `/gio-hang`, `/thanh-toan` | Giỏ hàng, thanh toán (Ngày 4–5) |

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
  `/gio-hang`). Cả hai nút đều là form + Server Action nên dùng được khi
  tắt JavaScript.
- Trang giỏ `/gio-hang`: đổi số lượng, xóa dòng, tạm tính theo giá hiện
  tại trong DB (đổi giá bằng SQL phản ánh ngay). Nút "Tiến hành thanh
  toán" dẫn tới `/thanh-toan` (Ngày 5).
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

- Trang `/thanh-toan` (một trang): người đặt, người nhận ("Giống người
  đặt" mặc định bật), khu vực giao hàng, phương thức giao (giao nhanh 2
  giờ / giao trong ngày / hẹn ngày giờ), lời nhắn trên thiệp (tối đa 200
  ký tự), ghi chú (tối đa 300 ký tự), thanh toán COD hoặc chuyển khoản.
  Tắt JavaScript vẫn đặt được (form thường, máy chủ kiểm tra lại toàn bộ).
- Đơn tạo trong một giao dịch DB: giỏ ACTIVE → CONVERTED có điều kiện
  (chặn đặt trùng khi gửi song song), tính lại toàn bộ số tiền từ dữ liệu
  máy chủ, mã đơn 10 ký tự Crockford base32. Trang `/don-hang/[mã]` là
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
