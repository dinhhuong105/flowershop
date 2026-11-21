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
