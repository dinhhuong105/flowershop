# Nhập sản phẩm (CSV/JSON/feed)

Hướng dẫn vận hành bộ nhập sản phẩm ở `/admin/products/import`.
Hàng nhập **luôn chờ duyệt** và ẩn khỏi shop cho tới khi duyệt —
không bao giờ tự lên shop, không bao giờ ghi đè sản phẩm hệ thống.

## Định dạng tệp

- **CSV** (UTF-8, có/không BOM; tự nhận dấu phân tách `,` `;` tab):
  tối đa 5 MB, tối đa 2.000 hàng, tối đa 40 cột, mỗi ô tối đa
  5.000 ký tự. Dòng đầu là header.
- **JSON**: mảng đối tượng ở gốc, hoặc object có khóa `items` /
  `products` / `data` chứa mảng; tối đa 5 MB, tối đa 2.000 phần tử,
  độ sâu tối đa 6 tầng. Khóa `__proto__` / `constructor` /
  `prototype` ở mọi tầng bị từ chối.
- Định dạng được nhận dạng **bằng nội dung** (không tin đuôi tệp
  hay Content-Type): nội dung bắt đầu bằng `{`/`[` là JSON, còn
  lại là CSV. Tệp nhị phân/UTF-16 (chứa byte NUL) bị từ chối.
- **Feed URL**: chỉ `http(s)` cổng 80/443, qua bộ tải an toàn
  (chặn IP nội bộ/đặc dụng, tối đa 3 lần redirect, 10 s tổng);
  nội dung HTML bị từ chối với thông báo
  "Đây là trang web, không phải dữ liệu nhập (CSV/JSON)".

## Cột (ánh xạ ở bước 2)

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `externalId` | Có | Mã ngoài, ổn định, duy nhất trong nguồn; cùng `sourceName` là khóa để lần nhập sau cập nhật đúng sản phẩm. |
| `name` | Có | Tên sản phẩm, 3–160 ký tự (sau khi làm sạch). |
| `price` | Có | Xem "Quy tắc giá" bên dưới. |
| `salePrice` | Không | Phải nhỏ hơn giá gốc (nghiêm ngặt). |
| `description` | Không | Tối đa 2.000 ký tự văn bản thuần (bỏ thẻ HTML). |
| `category` | Không | Tên hoặc slug danh mục; mỗi giá trị phải được ánh xạ sang danh mục có sẵn (hoặc "Bỏ qua các dòng này"). Không tự tạo danh mục. Nếu nguồn không có cột danh mục thì chọn danh mục mặc định. |
| `sku` | Không | Chỉ chữ hoa, số, gạch nối, 2–20 ký tự. Trùng với sản phẩm không cùng nguồn → hàng lỗi "SKU đã tồn tại". |
| `imageUrl` | Không | Một hoặc nhiều URL, ngăn bằng `\|` hoặc mảng JSON, tối đa 8 ảnh/sản phẩm; chỉ nhận `http(s)`. Ảnh tải qua bộ tải an toàn (JPEG/PNG/WebP/AVIF, magic bytes, kích thước điểm ảnh ≤ 6000×6000). Ảnh lỗi → sản phẩm vẫn nhập, hàng có cảnh báo. |
| `stock` | Không | Số nguyên ≥ 0; trống nghĩa là còn hàng. |

Văn bản được làm sạch: bỏ thẻ HTML, ký tự điều khiển, chuẩn hóa
khoảng trắng. Ô bắt đầu bằng `=`, `+`, `-`, `@`, tab, CR được
đánh cờ (chống chèn công thức khi xuất CSV).

## Quy tắc giá

- Nhận dạng dấu thập phân/nghìn kiểu Việt Nam: `1.234.567` =
  1.234.567, `1,234,567` = 1.234.567, `1234.5` = 1.234,5. Cụ thể:
  dấu phân tách theo sau là nhóm đủ 3 chữ số thì là dấu nghìn
  (`890.000` = 890.000); dấu cuối theo sau 1–2 chữ số là dấu thập
  phân (`1234.5` = 1.234,5).
- Tùy chọn giá ở bước ánh xạ: hệ số nhân 0,1–10 (tối đa 2 chữ số
  thập phân) + làm tròn (không / 1.000 / 10.000). Giá sau chuyển đổi
  làm tròn về số nguyên VND, phải trong khoảng 1–1.000.000.000;
  `salePrice` < `price` (nghiêm ngặt, bằng cũng lỗi).

## Trạng thái hàng chờ duyệt

- Sản phẩm mới nhập: `needsReview=true`, `isActive=false` (ẩn).
- **Duyệt** (từng mục hoặc hàng loạt ≤ 50): bỏ `needsReview`;
  tùy chọn "hiện luôn" **mặc định KHÔNG hiện** — phải tick mới
  cho bán ngay. Có xác nhận kèm số lượng + nhật ký.
- **Từ chối**: xóa sản phẩm chưa duyệt (không có đơn), có xác nhận
  + nhật ký.
- Nhập lại cùng `(sourceName, externalId)`:
  - Chưa duyệt → cập nhật mọi trường nhập.
  - **Đã duyệt → chỉ cập nhật `price`/`salePrice`** (ghi "giá đổi"
    vào kết quả); không ghi đè tên/mô tả/ảnh đã chỉnh tay.
- **Hoàn tác lô**: xóa sản phẩm của lô còn chờ duyệt (không có
  đơn); sản phẩm đã duyệt được giữ lại; trạng thái lô →
  `ROLLED_BACK`.

## Quyền sử dụng

Không nhập dữ liệu hoặc ảnh của website khác khi chưa có thỏa thuận
bằng văn bản.

Trước khi chạy, bắt buộc tick xác nhận:

> Tôi xác nhận shop có quyền sử dụng dữ liệu và hình ảnh của nguồn
> này (ví dụ có thỏa thuận bằng văn bản hoặc đây là dữ liệu của
> chính shop).

Chưa tick thì nút chạy bị khóa và máy chủ từ chối. Thời điểm + người
xác nhận được ghi vào lô và nhật ký.

## Giới hạn

- Bắt đầu lô: tối đa 5 lần/giờ và 20 lần/ngày (toàn cục).
- Tải feed URL: tối đa 10 lần/giờ. Bộ đếm lỗi → đóng (từ chối).
- Lô quá 2.000 hàng bị từ chối. Mỗi lần gọi chạy tối đa 10 hàng
  hoặc ~8 giây; tải lại trang vẫn tiếp tục được từ `import_rows`.
- Dữ liệu tạm từng hàng (`import_rows.payload`) được giữ 7 ngày để
  xem lịch sử/kết quả, sau đó dọn bằng
  `npx tsx scripts/cleanup-import-rows.ts` (xem đầu script).

## Xuất CSV lỗi

Danh sách lỗi ở bước xem trước và kết quả chạy tải được dạng CSV.
Ô bắt đầu bằng `=`, `+`, `-`, `@`, tab, CR được thêm dấu nháy đơn
phía trước để vô hiệu công thức khi mở bằng bảng tính.

## Mẫu

- `docs/mau-nhap/mau.csv`, `docs/mau-nhap/mau.json`: 3 hàng **giả**
  (không phải dữ liệu thật, không ảnh thật — URL ảnh trong mẫu là
  địa chỉ giả `vi-du.invalid` nên khi chạy sẽ có cảnh báo ảnh;
  sản phẩm vẫn được nhập).
