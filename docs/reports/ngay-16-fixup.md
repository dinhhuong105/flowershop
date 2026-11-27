# Báo cáo Ngày 16 fixup — Giá trị rỗng "(trống)" + hồi quy hook lọc dùng chung

- Ngày: 27/11/2026.
- Nền: commit `a8e6e38` (Ngày 16, remote HEAD, đã live).
- Commit fixup: 1 commit trên `a8e6e38` (lấy hash đầy đủ bằng `git log`). KHÔNG push.
- Phạm vi: 2 điểm nhỏ còn lại trong verdict Ngày 16 của Claude. Đây KHÔNG phải Ngày 17 (Claude nói không cần đặc tả mới, làm kèm là đủ). B6 + E2 vẫn để sau, ưu tiên thấp.
- Link live: https://flowershop-steel.vercel.app/

## Kết quả từng mục

| Mục | Kết quả | Ghi chú |
|---|---|---|
| 1. Giá trị rỗng hiện "(trống)" | ĐẠT | `displayActivityValue` trả "(trống)" khi giá trị null hoặc "". Một hàm dùng chung cho cả bảng desktop lẫn thẻ mobile nên cả 2 đều đúng. Kèm unit test 4 trường hợp (thêm/xóa/sửa/cả 2 phía rỗng). |
| 2. Hồi quy hook `useFilterNavigation` trên đơn + sản phẩm | ĐẠT — không lỗi | 8 tình huống (4 × 2 trang) đều PASS ngay lần đầu. Không sửa code hook. Không refactor hook sang kiểu dựng URL từ giá trị các ô nhập (Claude dặn làm sau, chỉ khi hook gây vấn đề thật — lần này không gây vấn đề). |

## Điểm 1 — chi tiết

- Trước: dòng thay đổi có phía rỗng hiện trống hẳn — "0900123456 →" (xóa) hoặc "→ 0900123456" (thêm), không biết là thêm hay xóa.
- Sau: `displayActivityValue` (src/lib/admin/activity.ts) trả "(trống)" cho null hoặc "" trước khi che/cắt: thêm → "(trống) → 0900111222", xóa → "0900111222 → (trống)".
- Lưu ý nhỏ (mở rộng có chủ đích): giá trị **null** trước đây hiện "—", nay cũng hiện "(trống)" — vd dòng `bank.notify` cũ sẽ đọc "(trống) → failed: …" thay vì "— → failed: …". Null cũng là "không có giá trị" nên dùng chung một nhãn cho rõ. Nhãn vòng đời ("Đã tạo", "Đã xóa", "Cập nhật", "Nháp → Đã xuất bản"…) không đổi vì đi qua `formatActivityChange`, không qua cặp cũ → mới.
- Unit test mới (1 test, 4 trường hợp trong `describe("displayActivityValue")`): thêm ("" → "(trống)", số mới hiện đầy đủ), xóa (số cũ hiện đầy đủ, "" → "(trống)"), sửa (cả 2 phía có giá trị → hiện như cũ), cả 2 phía rỗng (null và "" → "(trống)").

## Điểm 2 — kết quả từng tình huống hồi quy

Dữ liệu thử chèn tạm rồi xóa hết: 5 sản phẩm (slug `fixup-p1..p5`) + 25 đơn (mã `FIXUP-001..025`: 13 BANK_TRANSFER/UNPAID, 12 COD/PAID) để có 2 trang (20/trang). Đơn ở tab mặc định "Cần xử lý" (status NEW).

### /admin/orders

| # | Tình huống | Kết quả | Bằng chứng |
|---|---|---|---|
| (a) | Đổi 1 lọc: Thanh toán = UNPAID | PASS | URL `?payment=UNPAID`, bảng "Tìm thấy 13 đơn" |
| (b) | Đổi 2 lọc liên tiếp (không chờ): PAID rồi COD ngay | PASS | URL `?payment=PAID&method=COD` (giữ đủ cả 2 param), bảng "Tìm thấy 12 đơn" |
| (c) | Trang 2 (Trang 2/2, 5 dòng) → đổi lọc Thanh toán = UNPAID | PASS | URL mất `page`, bảng về trang 1 ("Tìm thấy 13 đơn") |
| (d) | Nút Back sau khi đổi lọc ở 2 entry | PASS | Trước Back `?tab=all&method=COD`; sau Back `?payment=UNPAID` (không còn `tab=all`), select Thanh toán = UNPAID, bảng 13 đơn |

### /admin/products

| # | Tình huống | Kết quả | Bằng chứng |
|---|---|---|---|
| (a) | Đổi 1 lọc: Danh mục = Hoa tươi | PASS | URL `?category=1`, bảng "Tìm thấy 17 sản phẩm" (12 seed + 5 thử) |
| (b) | Đổi 2 lọc liên tiếp (không chờ): Giỏ trái cây rồi Đang bán ngay | PASS | URL `?category=2&status=active` (giữ đủ cả 2 param), bảng "Tìm thấy 3 sản phẩm" |
| (c) | Trang 2 (Trang 2/2, 5 dòng) → đổi lọc Trạng thái = Đã ẩn | PASS | URL mất `page`, bảng về trang 1 ("Tìm thấy 0 sản phẩm") |
| (d) | Nút Back sau khi đổi lọc ở 2 entry | PASS | Trước Back `?status=active&category=2`; sau Back `?category=1` (không còn `status=active`), select Danh mục = 1, bảng 17 sản phẩm |

Cách kiểm (d): vào trang (entry 1) → đổi 1 lọc (replace) → mở URL khác của cùng trang bằng điều hướng đầy đủ (entry 2, push) → đổi thêm 1 lọc (replace) → Back → URL + select + bảng phải khớp entry 1. `router.replace` không tạo entry lịch sử nên Back về entry push gần nhất, không về lần đổi lọc ngay trước — đúng thiết kế, bảng vẫn khớp URL.

## Kiểm chứng

- Unit: **321/321 PASS** (Ngày 16: 320; +1: `(trống)` 4 trường hợp).
- test:db: **56/56 PASS** (như Ngày 16). Đúng trình tự: `recreate-test-data` → `test:db` → `clean-test-data --delete`.
- Typecheck: **0 lỗi**. Lint: **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`).
- Build: OK. First Load JS `/` = **115 kB** (≤ 135 kB, như Ngày 16); `/admin/activity` = 124 kB.
- Smoke local (`scripts/smoke-live.sh http://localhost:3000`): **20/21 PASS** — FAIL duy nhất là sitemap-localhost (kỳ vọng). `/admin/activity` chưa đăng nhập → 307 PASS. Server chạy bằng `scripts/start-standalone.sh` (home 200, chunk 200).
- So `<head>` với nền Ngày 16 (nội dung ngữ nghĩa title/description/canonical/robots/OG, bỏ đường dẫn asset theo hash): trang chủ + danh mục + sản phẩm + trang tĩnh **giống hệt** (4/4, cùng trạng thái 0 trang đã xuất bản).
- CDP (headless Chrome 158, server standalone :3000, phiên admin tạo trực tiếp trong DB local): **21/21 PASS** — điểm 1: thêm hotline qua form thật → "(trống) → 0900111222", xóa hotline qua form thật → "0900111222 → (trống)", mobile 390 thẻ mobile hiện "(trống)" cả 2 phía + không tràn ngang; điểm 2: 8 tình huống như bảng trên. Ảnh đã nhìn bằng mắt.
- DB local sau dọn: products=20, orders=0, pages=3 (0 xuất bản), settings=24, audit=0, sessions=0, categories=4; hotline khôi phục về "". **Sạch.**

## Ảnh đính kèm

- Điểm 1: `~/workspace/day16-fixup-shots/activity-empty-add-1440.png`, `activity-empty-delete-1440.png`, `activity-empty-390.png`
- Probe CDP (tái chạy được): `~/workspace/day16-fixup-verify.mjs`

## Sự cố trong ngày (ghi lại để lần sau khỏi mất thời gian)

- **VM lại bị thay (~10:00 ngày 27/11, uptime 1:06 lúc 11:07)** — PostgreSQL 16 còn chạy nhưng role `hoa` + DB `hoa_shop` biến mất (chỉ còn DB seecarauto); Chrome cũng mất. Dựng lại: chạy `~/workspace/rebuild-flower-db.mjs` (tạo role + DB), `prisma migrate deploy` (tới `20261126210000_day15`) + `prisma db seed` → counts 20|0|3|0|24|0|0|4; cài lại Google Chrome 158 từ .deb (curl dl.google.com, `dpkg -i`, không cần `apt-get install -f`). Probe lần này đọc mật khẩu DB từ `.env` (DATABASE_URL) thay vì ghi cứng như probe Ngày 16 — nên dùng cách này cho các probe sau.
- **Ảnh nhật ký: mục "Sản phẩm" trong sidebar trông như bị cắt ở mép trái.** Không phải lỗi (đã kết luận ở Ngày 16): sidebar tự cuộn xuống để hiện mục đang mở ("Nhật ký hoạt động") — hành vi `scrollIntoView` từ Ngày 13 (A4).
- **Lập chỉ mục vẫn TẮT** trên live theo quyết định của Henry — ngày này không đụng vào.

## Việc của Henry (nhắc lại, không giục riêng lẻ)

- Không cần Telegram — Henry nói 27/11 ~10:58: "không cần telegram, có thì dùng, không có thì thôi". A4 coi như bỏ (không còn là việc chờ). `bank.notify` failed trên live là hệ quả đã biết, không cần xử lý.
- Dữ liệu thật: tên shop, hotline/Zalo/địa chỉ, ngân hàng, khu vực + phí, sản phẩm + ảnh thật, nội dung 3 trang chính sách + mô tả SEO mặc định + ảnh OG; đọc lại /policy đang public.
- Quyết định token GitHub (thu hồi token đã dán trong chat + tạo fine-grained mới) vẫn là của Henry.
- Trước Phần G (dọn demo): tạo nhánh Neon mới ngay trước khi xóa (nhánh snapshot hiện tại sẽ cũ dần).
- Sau khi dữ liệu thật đủ: B6 + E2 rồi Phần G (dọn demo) — Claude viết đặc tả riêng khi Henry báo dữ liệu thật đã vào.
