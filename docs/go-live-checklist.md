# Checklist chạy thật (go-live) — Hoa Tươi Demo

Danh sách đánh dấu theo thứ tự. Chỉ chuyển sang bước sau khi bước
trước đã đạt. Bước 6 (bật lập chỉ mục) làm CUỐI CÙNG — hiện tại
lập chỉ mục đang TẮT trên live theo quyết định của Henry (26/11);
không bật sớm hơn.

## 1. Trỏ tên miền vào Vercel — Henry
- Trỏ tên miền thật (mua ở nhà đăng ký tên miền) vào project
  `flowershop` trên Vercel theo hướng dẫn của Vercel (bản ghi DNS).
- Chọn **một tên miền chính** (có hoặc không có `www`); tên miền
  còn lại phải chuyển hướng vĩnh viễn sang tên chính.
- Kiểm: mở `https://<tên-miền-chính>/` thấy đúng shop; mở tên
  miền phụ thấy chuyển sang tên chính (mã 301/308).

## 2. Đặt biến môi trường chứa tên miền — Henry
- Biến đang dùng cho sitemap/robots/canonical là **`SITE_URL`**
  (`src/config/site.ts`: `process.env.SITE_URL`, mặc định
  `http://localhost:3000` khi chưa đặt).
- Đặt `SITE_URL=https://<tên-miền-chính>` (không có dấu `/` cuối)
  ở môi trường **Production** trong Vercel, rồi **redeploy**.
- Kiểm: mở `/sitemap.xml` — mọi `<loc>` bắt đầu bằng tên miền
  chính; mở `/robots.txt` — dòng `Sitemap:` đúng tên miền chính;
  mở trang chủ — `<link rel="canonical">` đúng tên miền chính.

## 3. Kiểm biến bắt buộc trên Vercel — Henry
- Trong Vercel → Project → Settings → Environment Variables,
  môi trường Production phải có: `DATABASE_URL`,
  `ADMIN_PASSWORD_HASH`, `BLOB_READ_WRITE_TOKEN`, token Telegram
  (`TELEGRAM_BOT_TOKEN`), chat id Telegram, `SITE_URL`.
- Không đặt `BANK_*` nếu đã dùng trang Ngân hàng & QR (thông tin
  ngân hàng nhập trong admin, không để trong env).
- Kiểm: mỗi biến hiện ở cột Production; redeploy sau khi thêm/sửa.

## 4. Chạy hai script kiểm — agent
- `bash scripts/smoke-live.sh https://<tên-miền-chính>`
- `bash scripts/go-live-check.sh https://<tên-miền-chính>`
- Kiểm: tất cả PASS (thoát 0). Mục nào FAIL thì sửa rồi chạy lại.

## 5. Dữ liệu thật đã nhập — Henry (+ agent kiểm)
- Ngân hàng đã cấu hình + bật (trang Ngân hàng & QR); Telegram
  có token + bật, gửi thử nhận được tin; khu vực + phí đã thay
  giá trị mẫu; liên hệ (hotline/Zalo/địa chỉ/giờ mở cửa) đã điền
  thật; tên shop khác mặc định; mô tả SEO mặc định + ảnh OG đã đặt.
- Sản phẩm thật + ảnh thật đã nhập; ba trang chính sách đã xuất
  bản (Giới thiệu, Giao hàng & thanh toán, Đổi trả) — xem bảng F3
  trong báo cáo Ngày 14.
- Kiểm: đối chiếu bảng F3, mục nào còn ✗ thì nhập bổ sung.

## 6. Bật lập chỉ mục — Henry (CUỐI CÙNG)
- Chỉ làm khi bước 1–5 đều đạt. Bật "Cho phép công cụ tìm kiếm
  lập chỉ mục" trong Cài đặt SEO (`/admin/settings/seo`).
- Kiểm: mở trang chủ — có `<meta name="robots" content="index,
  follow"/>`; mở `/robots.txt` — không còn `Disallow: /`.

## 7. Gửi sitemap lên Google Search Console — Henry
- Thêm tài sản tên miền chính vào Google Search Console, gửi
  sitemap `https://<tên-miền-chính>/sitemap.xml`.
- Kiểm: Search Console báo sitemap đã đọc; trang chủ đã được lập
  chỉ mục (có thể mất vài ngày).

## 8. Đặt một đơn COD thật cuối cùng — Henry (+ agent dọn)
- Đặt một đơn COD thật dưới tên `[TEST]`, kiểm: Telegram nhận
  được tin báo đơn mới; QR đúng (nếu chuyển khoản); đơn hiện
  trong admin với đúng thông tin.
- Dọn đơn đó bằng `scripts/clean-production.ts`: chạy dry-run
  trước, rồi `--confirm` sau khi Henry duyệt (xem hướng dẫn trong
  script; bắt buộc có snapshot Neon trước khi xóa — xem A3).
- Kiểm: đơn `[TEST]` không còn trong admin; shop vẫn chạy bình
  thường.

## Điều kiện tiên quyết (nợ Ngày 13 — xem báo cáo Ngày 14)
- **A1 Blob:** store `flowershop-blob` phải ở chế độ Public (hoặc
  tạo store Public mới + connect + redeploy) thì ảnh tải lên mới
  hiện. Chưa xong thì bước 5 (ảnh thật) không đạt.
- **A3 Neon:** Henry kích hoạt email Neon + tạo nhánh snapshot
  trước khi nhập dữ liệu thật hàng loạt hoặc xóa dữ liệu production.
- **A4 Telegram:** token vào Vercel + chat id trong admin, gửi thử
  nhận được tin `[TEST]`.
