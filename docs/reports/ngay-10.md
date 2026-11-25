# Báo cáo Ngày 10 — Phần A: Hoàn thiện quản trị (D10-1..D10-6)

Ngày làm: 2026-11-24. Nền: commit 389be23 (Ngày 9 đã đóng chính thức
24/11 ~22:57). Đặc tả: `~/workspace/ngay-10-dac-ta.md` (87 dòng, md5
0275475ae630f49886c0672ee6410100 — đọc nguyên văn, không làm theo bản
tóm tắt nào khác). Chỉ làm Phần A; Phần B chờ dữ liệu thật của Henry,
Phần C bàn giao sang Ngày 11.

**Kết quả: D10-1..D10-6: 6/6 ĐẠT** (D10-1 đạt theo tiêu chí MỚI sau
quyết định của Henry 24/11 ~23:12 — xem mục D10-1). Commit: xem cuối
báo cáo (một commit trên 389be23, chưa push).

## D10-1 — Menu admin 390 px: "Đơn hàng" phải thấy được — ĐẠT (theo tiêu chí mới)

### Quyết định của Henry thay đổi hướng làm (24/11 ~23:12)
Giữa lúc đang làm, Henry quyết: **"Khôi phục kiểu Ngày 7, giữ đủ 4
mục menu"**. Hướng làm D10-1 đổi thành (theo chỉ đạo):
- Đầu trang admin trở lại kiểu Ngày 7 (code gốc commit 872e982,
  `src/app/admin/layout.tsx`): chữ đầy đủ "Quản trị — Hoa Tươi Demo"
  (luôn hiện đủ, KHÔNG rút gọn thành "Quản trị" dưới sm), menu tự
  xuống dòng (flex-wrap) để thấy hết các mục, BỎ cuộn ngang và BỎ vệt
  mờ mask.
- GIỮ ĐỦ 4 mục menu hiện tại: Tổng quan (/admin), Sản phẩm
  (/admin/products), Đơn hàng (/admin/orders), Xem shop ↗ (/).
  Thương hiệu vẫn trỏ về /admin (trang tổng quan, quyết định Ngày 9
  giữ nguyên — Ngày 7 trỏ về /admin/products, nay đổi theo Ngày 9).
- Giữ yêu cầu còn lại của đặc tả: mục đang mở (`aria-current="page"`)
  có dấu hiệu nhìn thấy (gạch chân + chữ đậm xanh). Yêu cầu "tự cuộn
  vào vùng nhìn" không còn cần vì không còn cuộn ngang.
- **ĐÁNH ĐỔI ĐÃ ĐƯỢC HENRY DUYỆT:** đầu trang trên mobile cao ~2 hàng
  thay vì 1 hàng 69 px — tiêu chí "header vẫn một hàng cao ≤ 69 px"
  trong đặc tả D10-1 KHÔNG còn giữ được (ưu tiên thấy đủ menu hơn
  giữ header 1 hàng).

### Bản làm đầu (đã bỏ, không commit)
Bản đầu làm theo đặc tả gốc: mục đang mở tự cuộn vào vùng nhìn
(`scrollIntoView`), mặt nạ mờ giữ nguyên, đổi thứ tự trên mobile
("Đơn hàng" lên đầu). Đo được ở 390 px: "Đơn hàng" hiện đầy đủ
(105–196 trong nav 105–241), `aria-current="page"`, gạch chân có,
`scrollWidth` 375 / `innerWidth` 390 (không tràn ngang). Nhưng
header đo được **84 px** thay vì 69 px — nguyên nhân tìm ra: thanh
cuộn ngang cổ điển của nav (`overflow-x-auto`) chiếm thêm 15 px
chiều cao (nav cao 59 px = 44 px nội dung + 15 px thanh cuộn). Bản
này đã **khôi phục hoàn toàn** (layout về đúng 389be23, file
`AdminNav.tsx` bản đầu đã xóa) ngay khi Henry ra chỉ đạo dừng
(23:12), rồi làm lại theo hướng Ngày 7 dưới đây.

### Bản chốt (kiểu Ngày 7)
- `src/app/admin/layout.tsx`: container `shell flex flex-wrap
  items-center gap-3 py-3` (đúng Ngày 7); thương hiệu hiện đầy đủ,
  `whitespace-nowrap`; nút Đăng xuất `ml-auto shrink-0` (Ngày 7).
- `src/components/admin/AdminNav.tsx` (mới, client component —
  cần `usePathname` để biết mục đang mở mà gắn `aria-current`):
  nav `flex min-w-0 flex-1 basis-[220px] flex-wrap items-center
  gap-1`, không cuộn, không mask; mục đang mở gạch chân + đậm xanh.
  `basis-[220px]` là ngưỡng để menu xuống hàng của nó ở mobile:
  rộng hơn phần còn lại sau thương hiệu (343 − 247 − 12 = 84 px) nên
  menu không bị ép chung hàng 1 với thương hiệu; ở hàng 2 nó giãn
  (flex-1) vừa đủ để nút Đăng xuất cùng hàng (menu ~225 px, các mục
  vẫn xếp được 2 dòng). Không có basis này, menu (`flex-1`,
  basis 0) sẽ bị ép dẹt vào hàng 1 và các mục tràn khỏi khung.
  Thứ tự DOM giữ nguyên Tổng quan → Sản phẩm → Đơn hàng → Xem shop
  (không đổi thứ tự trên mobile như bản đầu đã làm — kiểu Ngày 7
  không đổi thứ tự).

### Đo thực tế ở 390 px (CDP, `mobile: false` — số thật như Ngày 8/9)
Trên cả 3 trang `/admin/orders`, `/admin/orders/SEED000044`,
`/admin`:
- `innerWidth` 390, `scrollWidth` 375 (375 = chiều rộng bố cục trừ
  15 px thanh cuộn dọc cổ điển; không tràn ngang).
- **Header cao 173 px = đúng 2 hàng** (hàng 1: thương hiệu 44 px;
  hàng 2: menu 2 dòng 92 px + nút Đăng xuất cùng hàng) — đúng
  đánh đổi "~2 hàng" Henry đã duyệt; tiêu chí cũ "1 hàng ≤ 69 px"
  không còn áp dụng (ghi rõ ở đây và trong comment code).
- Thương hiệu đầy đủ "Quản trị — Hoa Tươi Demo" (rộng 247 px đo
  thực tế, không phải ~264 px như ghi chú Ngày 9 ước lượng).
- Cả 4 mục đều thấy được, không cần cuộn: Tổng quan (16–112),
  Sản phẩm (116–208), Đơn hàng (16–107), Xem shop ↗ (111–218).
- "Đơn hàng" hiện đầy đủ, `aria-current="page"` + gạch chân trên
  trang đơn; trên `/admin` thì "Tổng quan" là mục có gạch chân.
- Ảnh: `menu-admin-390-ngay-10.png` (trang đơn), `dashboard-390-ngay-10.png`.

## D10-2 — Liên kết thẻ dashboard phải ra đúng số trên thẻ — ĐẠT

### Bước 1 — ghi lại hiện trạng (trước sửa, 48 đơn: 45 SEED + 3 mẫu)

| Thẻ | Số trên thẻ | Link cũ | Danh sách ra | Khớp? |
|---|---|---|---|---|
| Đơn cần xử lý | 38 | `?tab=pending` | 38 | ✓ |
| Đơn giao hôm nay | 11 | `?tab=all&date=2026-11-24` | 12 | ✗ (lẫn 1 đơn hủy) |
| Chuyển khoản chưa thu | 7 | `?tab=all&payment=UNPAID` | 24 | ✗ (lẫn 17 COD chưa thu + đơn hủy) |
| Doanh thu hôm nay | 4.130.000 ₫ | `?tab=COMPLETED` | 5 đơn | n/a (tiền so với số đơn) |
| Doanh thu 7 ngày | 4.130.000 ₫ | `?tab=COMPLETED` | 5 đơn | n/a |

Đối chiếu bằng SQL trực tiếp: giao hôm nay chưa hủy = 11, chuyển
khoản chưa thu chưa hủy = 7, cần xử lý = 38, đã giao = 5. Cả 2 rủi
ro đặc tả nêu đều **đúng với số thật**.

### Bước 2 — sửa cho khớp
- `src/lib/admin/orders.ts`: thêm bộ lọc phương thức
  (`method=BANK_TRANSFER | COD`, ép kiểu `::"PaymentMethod"` như
  lọc payment — không ép thì Postgres báo 42883) và loại trạng thái
  (`exclude=<OrderStatus>`, ép kiểu `::"OrderStatus"`, chỉ nhận đúng
  1 trạng thái hợp lệ, còn lại bỏ qua). Cả hai nằm trong
  `buildOrderFilters` nên số đếm từng tab tự khớp theo.
- `src/app/admin/orders/page.tsx`: đọc thêm 2 tham số, giữ chúng khi
  chuyển tab / phân trang / bấm "Lọc" (kẻo mất bộ lọc); thêm ô chọn
  "Phương thức" (Tất cả / Chuyển khoản / COD) vào form lọc và
  `<input type="hidden" name="exclude">` khi có exclude.
- `src/app/admin/page.tsx`: link thẻ đổi thành
  `?tab=all&date=...&exclude=CANCELLED` (thẻ giao hôm nay) và
  `?tab=all&payment=UNPAID&method=BANK_TRANSFER&exclude=CANCELLED`
  (thẻ chuyển khoản).
- **Hai thẻ doanh thu — chọn hướng đổi nhãn (đặc tả cho chọn 1
  trong 2):** giữ liên kết tới `?tab=COMPLETED` nhưng đổi nhãn thành
  "Xem đơn đã giao →" và dòng phụ thành "Danh sách đơn đã giao".
  Lý do: giữ điều hướng hữu ích (xem danh sách đơn đã giao) mà nhãn
  không còn hứa danh sách khớp tổng tiền; bỏ hẳn liên kết thì mất
  đường vào danh sách đơn đã giao từ dashboard. Dòng phụ cũ ("Đơn
  hoàn tất hôm nay" / "Đơn hoàn tất 7 ngày gần nhất") cũng đổi theo
  vì nó hứa sai tương tự.

### Kiểm sau sửa (48 đơn, curl có session admin)
- Cần xử lý: thẻ 38 = danh sách 38. Giao hôm nay: thẻ 11 = danh
  sách 11 (trước sửa 12). Chuyển khoản chưa thu: thẻ 7 = danh sách
  7 (trước sửa 24). Doanh thu: 5 đơn COMPLETED, nhãn mới.
- Ảnh: `danh-sach-chuyen-khoan-chua-thu-ngay-10.png` (1440 px):
  "Tìm thấy 7 đơn", cả 7 dòng đều "Chuyển khoản / Chưa thanh toán",
  tab đếm "Đã hủy (0)" (exclude có tác dụng cả ở số đếm tab), ô
  "Phương thức: Chuyển khoản" đã chọn.
- Test:db thêm 1 ca mới (tổng 8 ca): tạo đơn F (NEW, chuyển khoản
  chưa thu, giao hôm nay) + đơn G (đã hủy, cùng phương thức + ngày
  giao), đối chiếu delta số đếm dashboard với delta total danh sách
  đích ở cả 3 link (đều = 1, chỉ F cộng vào; G không cộng vào đâu),
  kèm hồi quy link cũ (chỉ `payment=UNPAID` hiện nhiều hơn số trên
  thẻ — lẫn COD + đơn hủy). Pass.

## D10-3 — Câu chữ dashboard dành cho chủ shop — ĐẠT
- Dòng phụ đổi thành "Cập nhật lúc HH:mm, dd/MM/yyyy" (giờ VN,
  tính lúc render): kiểm thực tế "Cập nhật lúc 23:21, 24/11/2026."
- Thẻ "Đơn giao hôm nay": dòng phụ cũ ghi lại ngày ("24/11/2026")
  đổi thành "Không tính đơn đã hủy".
- Kiểm: chuỗi "cơ sở dữ liệu" còn 0 lần trên giao diện dashboard
  (grep toàn bộ HTML trang /admin). Không đổi logic tính nào.
- Ảnh: `dashboard-390-ngay-10.png` (subtitle + 3 thẻ đầu thấy rõ).

## D10-4 — Phiếu giao in thật: chỉ in phần phiếu — ĐẠT
- Trang in thêm `print:hidden` ở khối nút IN + dòng hướng dẫn (nút
  IN và dòng hướng dẫn vốn đã có class `no-print` — thêm
  `print:hidden` ở div bọc để chắc chắn cả khối biến mất) và
  `print:rounded-none print:border-0 print:p-0` ở khung phiếu (bỏ
  bo góc + viền + đệm khi in).
- **Lỗi tìm được khi kiểm:** lần in đầu, dưới phiếu còn một dải nền
  kem (~25% trang). Nguyên nhân: nền kem thuộc div bọc ngoài của
  layout admin (`min-h-dvh bg-cream-50`), mà rule sửa đầu
  (`body > div`) không trúng vì layout gốc bọc `{children}` trong
  `<main id="noi-dung-chinh">` — div kem là cháu của body, không
  phải con trực tiếp (đã kiểm bằng curl: rule có trong HTML nhưng
  không khớp phần tử nào; PDF in ra giống hệt bản trước, sha256
  không đổi). Sửa lại thành `main#noi-dung-chinh > div
  { background: #fff !important; }` trong `<style>` của trang in
  (chỉ tác động div bọc ngoài, không đụng nền đỏ của dải hủy) —
  in lại: dải kem biến mất, toàn trang trắng.
- Kiểm bằng print-to-PDF (CDP `Page.printToPDF`,
  `preferCSSPageSize: true`, khổ A5): đơn hủy SEED000044, đơn
  5 dòng D10PR1NT5A, đơn 10 dòng D10PR1NT9A — **cả 3 đều 1 trang,
  khổ A5 (420 × 594.96 pt)**. Ảnh render PDF đã mắt kiểm:
  - Đơn hủy: chỉ có phiếu (không header admin, không nút IN, không
    dòng hướng dẫn, không nền kem); dải đỏ "ĐƠN ĐÃ HỦY — KHÔNG
    GIAO" nền đặc + chữ trắng; "Thu hộ 0 ₫", "Đơn đã hủy — không
    thu tiền."
  - Đơn 10 dòng: đủ 10 sản phẩm, tạm tính 14.706.000 ₫ + phí
    25.000 ₫ = tổng 14.731.000 ₫, "Thu hộ 14.731.000 ₫" (COD chưa
    trả), "Thanh toán khi nhận hàng (COD)."
  - Đơn 5 dòng: 1 trang (tổng 4.626.000 ₫).
- File PDF: `phieu-giao-huy-ngay-10.pdf` (đơn hủy),
  `phieu-giao-10-dong-ngay-10.pdf` (đơn thường 10 dòng).

## D10-5 — Script kiểm production sau mỗi lần deploy — ĐẠT
- Mới: `scripts/smoke-live.sh <base-url>` — 10 mục kiểm bằng GET
  (không đăng nhập, không ghi dữ liệu): `/`, trang sản phẩm
  `/hoa-tuoi/bo-hong-do-tinh-yeu`, `/cart`, `/faq`, `/sitemap.xml`
  (đếm `<loc>`, không chứa `localhost`), `/robots.txt` (có dòng
  Sitemap đúng domain), `/checkout` 307, `/order/KHONGTONTAI` 404,
  `/admin` và `/admin/orders` 307 → `/login` (kiểm cả mã và header
  Location). In bảng (mục, đường dẫn, mã, thời gian, PASS/FAIL);
  thoát 0 khi tất cả PASS, 1 khi có mục FAIL, 2 khi thiếu base-url.
  Mỗi mục chỉ gọi curl 1 lần (mã + thời gian lấy cùng lúc).
- Chạy trên production `https://flowershop-steel.vercel.app/`:
  **10/10 PASS, thoát 0** (log: `ket-qua-smoke-live-ngay-10.log`).
  Lưu ý: production hiện vẫn là commit 389be23 (Ngày 10 chưa push)
  — script kiểm live site, các route kiểm đều là route hiện có.
- Thử cố tình trỏ sai domain
  (`https://flowershop-steel-sai.vercel.app/`): **PASS 1 / FAIL 9,
  thoát 1** — script báo FAIL đúng. Không tham số: in cách dùng,
  thoát 2.

## D10-6 — Ghi chú chính sách seed trong README — ĐẠT
- README có mục mới **"## Seed và dữ liệu"**: seed chỉ tạo mới
  (`update: {}`), chạy mỗi lần build trên Vercel nhưng chạy lại là
  no-op; muốn đổi sản phẩm/danh mục/khu vực đang chạy thì sửa trong
  trang quản trị (hoặc migration), KHÔNG sửa seed; seed chỉ để dựng
  DB trống (4 danh mục, 20 sản phẩm, 4 khu vực); cách kiểm seed
  không ghi đè (sửa tay tên/giá rồi chạy seed, kiểm lại không đổi
  — đã kiểm trực tiếp ở mục 1 verdict Ngày 9) + lịch sử (trước đây
  `update:` đầy đủ nên ghi đè). Đoạn ghi chú cũ cùng nội dung trong
  mục triển khai đã gộp vào mục mới, không trùng lặp.
- Không thay đổi code ở mục này (chỉ README).

## Kiểm chứng tổng hợp (tự chạy lại trên bản cuối)
- Unit test: **176/176 PASS**. Test có DB: **8/8 PASS** (trước 7/7,
  +1 ca mới D10-2). Typecheck: 0 lỗi. Lint: 0 lỗi, 0 cảnh báo.
- Build OK; First Load JS `/` = **115 kB** (≤ 135 kB).
- Curl local trên server standalone cổng 3000: `/` 200; `/admin`
  200 (sau đăng nhập); sitemap local 30 URL; `/admin/orders`
  307 → `/login` khi chưa đăng nhập.
- Mắt kiểm mọi ảnh chụp lại trước khi giao (menu 390, dashboard
  390, danh sách đích 1440, 2 ảnh render PDF).
- Server verification đang chạy trên cổng 3000 phục vụ bản mới.

## Dọn dữ liệu test
- Đã xóa: 45 đơn SEED + 3 phiên admin (bằng
  `clean-test-data.ts --only=seed,sessions --delete`), 2 đơn test
  in phiếu D10PR1NT5A/D10PR1NT9A (xóa trực tiếp theo mã), file tạm
  `scripts/d10-print-orders-tmp.ts` (đã xóa khỏi repo).
- DB cuối đợt: **3 đơn mẫu NEW/UNPAID** (QAFNN907ZY, 0Z2DZBQNTJ,
  1N0PEZH0J7), **21 sản phẩm, 0 phiên admin** — đúng như cuối Ngày 9.

## Khác đặc tả / độ lệch cần ghi rõ
1. **D10-1 — header 2 hàng (173 px), không còn 1 hàng ≤ 69 px:**
   độ lệch đã được Henry duyệt (23:12, ưu tiên thấy đủ menu).
   Số đo: header 173 px ở 390 px trên cả 3 trang kiểm.
2. **D10-1 — bản làm đầu theo đặc tả gốc đã bỏ:** tự cuộn +
   đổi thứ tự mobile + giữ mask; đã khôi phục hoàn toàn về 389be23
   rồi làm lại kiểu Ngày 7. Không còn dấu vết trong commit cuối.
3. **D10-2 — thẻ doanh thu đổi nhãn thay vì bỏ liên kết** (đặc tả
   cho chọn 1 trong 2; lý do ở mục D10-2). Thêm ô chọn "Phương thức"
   vào form lọc (ngoài đặc tả — để bộ lọc dùng được bằng tay, nhất
   quán với ô "Thanh toán" có sẵn).
4. **D10-4 — rule làm trắng nền kem** (`main#noi-dung-chinh > div`)
   là phát hiện thêm khi kiểm, không có trong đặc tả — cần để PDF
   "chỉ có phiếu" đúng nghĩa.
5. **D10-5 — kiểm production chạy trên commit 389be23** (Ngày 10
   chưa push, chưa deploy) — script kiểm live site hiện tại; sau khi
   push Ngày 10, chạy lại script để kiểm bản mới.

## Chưa làm (ngoài Phần A)
- Phần B: chờ dữ liệu thật của Henry (domain, bank+QR, Telegram,
  khu vực+phí, giờ làm việc, hotline/Zalo/địa chỉ, chính sách, sản
  phẩm+ảnh thật).
- Phần C: dọn dữ liệu test trên production + rà cuối trước mở bán —
  sang Ngày 11, cần Henry duyệt đường dọn riêng cho production.

## File thay đổi (1 commit trên 389be23)
- `src/app/admin/layout.tsx` — đầu trang kiểu Ngày 7 (D10-1).
- `src/components/admin/AdminNav.tsx` (mới) — menu 4 mục + mục đang
  mở gạch chân (D10-1).
- `src/lib/admin/orders.ts` — bộ lọc `method` + `exclude` (D10-2).
- `src/app/admin/orders/page.tsx` — đọc/giữ 2 tham số mới, ô chọn
  phương thức (D10-2).
- `src/app/admin/page.tsx` — link thẻ + câu chữ dashboard
  (D10-2, D10-3).
- `src/app/admin/orders/[code]/print/page.tsx` — chỉ in phần phiếu,
  nền trắng (D10-4).
- `scripts/smoke-live.sh` (mới) — kiểm production (D10-5).
- `src/lib/admin/orders.db.test.ts` — ca kiểm D10-2 (D10-2).
- `README.md` — mục "Seed và dữ liệu" (D10-6).
- `docs/reports/ngay-10.md` (file này).

## Ảnh / file đính kèm
- `menu-admin-390-ngay-10.png` — menu admin 390 px kiểu Ngày 7.
- `dashboard-390-ngay-10.png` — dashboard 390 px sau đổi câu chữ.
- `danh-sach-chuyen-khoan-chua-thu-ngay-10.png` — danh sách đích
  thẻ "Chuyển khoản chưa thu" (7 đơn, 1440 px).
- `phieu-giao-huy-ngay-10.pdf` — PDF phiếu giao đơn hủy (1 trang A5).
- `phieu-giao-10-dong-ngay-10.pdf` — PDF phiếu giao đơn thường
  10 dòng (1 trang A5).
- `ket-qua-smoke-live-ngay-10.log` — kết quả smoke-live.sh trên
  production (10/10 PASS).

## Bổ sung sau Ngày 10 — sửa mục 1+3 theo verdict Claude

Ngày 10 Phần A đã đóng (Claude, chat mới 85b8509e…). Claude nêu 5
mục trước Phần B; Henry duyệt sửa mục 1+3 ngay (24/11 ~23:45).
Mục 5 (đo 360 px) để sang Ngày 11, mục 4 (kiểm múi giờ sau 00:00)
người khác tự kiểm. Không liên hệ Claude đợt này (Free hết lượt
đến 1:20 sáng mai).

### Mục 1 — Seed không hồi sinh dữ liệu demo — ĐẠT

Nguy cơ đã xác minh là thật: lệnh build Vercel chạy
`prisma db seed` MỖI lần deploy, mà upsert vẫn TẠO LẠI dòng đã bị
xóa dù `update: {}`. Henry xóa sản phẩm/khu vực demo trong admin
thì lần deploy sau nó mọc lại.
- Sửa: `prisma/seed.ts` tự chặn — đếm 3 bảng
  categories/products/shipping_zones trước khi seed; chỉ seed khi
  CẢ 3 bảng đều trống, còn không thì thoát ngay, in log "DB đã có
  dữ liệu … — bỏ qua seed, không tạo lại gì cả". Cờ `--force` bỏ
  qua chặn (chạy tay khi thật sự muốn seed lại). Logic chặn là hàm
  thuần `shouldSeed` trong `src/lib/seed-guard.ts` (mới) + unit
  test `src/lib/seed-guard.test.ts` (mới, 3 ca).
- README mục "## Seed và dữ liệu" (D10-6) cập nhật: cơ chế chặn +
  cách chạy tay `npm run db:seed -- -- --force` (cần 2 dấu `--`:
  npm ăn 1, prisma ăn 1, còn `--force` chuyển cho script) hoặc
  `npx prisma db seed -- --force`.
- Kiểm trực tiếp trong DB local: (a) xóa SP 3 (Bó Hướng Dương
  Rạng Rỡ, HT-003) + khu vực 4 (Ngoại thành), chạy
  `npm run db:seed` → log chặn, KHÔNG mọc lại (20 SP, 3 khu vực,
  0 dòng cho slug/tên đã xóa); chạy
  `npm run db:seed -- -- --force` → "Seed xong: 4 danh mục,
  21 sản phẩm, 4 khu vực giao", khôi phục đúng giá trị gốc
  (650.000 ₫ / 585.000 ₫ / HT-003; Ngoại thành 70.000 ₫).
  Lưu ý: `npm run db:seed -- --force` (1 dấu `--`) KHÔNG chuyển
  được cờ — prisma báo "unknown or unexpected option: --force"
  và thoát 1; phải dùng 2 dấu `--`. (b) Chạy `npm run db:seed`
  trên DB hiện tại (đã có dữ liệu) → no-op, dữ liệu không đổi
  (21 SP, 4 khu vực, SP 1 giữ nguyên tên/giá).
- Unit test 179/179 (trước 176/176, +3 ca seed-guard mới).

### Mục 3 — Chip báo đang loại đơn hủy — ĐẠT

- Sửa: trang `/admin/orders`, khi URL có `exclude=CANCELLED`
  (hiện chỉ có trường hợp này từ thẻ dashboard) thì hiện chip
  vàng "Không tính đơn đã hủy ✕" ngay dưới dòng "Tìm thấy N đơn",
  trước khu vực lọc. Bấm ✕ tải lại danh sách KHÔNG còn tham số
  exclude, giữ nguyên tab, tìm kiếm, thanh toán, phương thức,
  ngày giao và trang hiện tại (hàm mới `clearExcludeHref`, mirror
  của `pageHref` trừ exclude). Chip dùng chung nhãn
  `orderStatusLabel` nên đúng với mọi giá trị exclude hợp lệ.
- Kiểm bằng curl có session admin (48 đơn seed): URL
  `?tab=all&payment=UNPAID&method=BANK_TRANSFER&exclude=CANCELLED`
  → chip hiện 1, "Tìm thấy 7 đơn"; link ✕ là
  `?tab=all&payment=UNPAID&method=BANK_TRANSFER` (đã bỏ exclude);
  URL `?tab=all&exclude=CANCELLED` → "Tìm thấy 43 đơn", chip
  hiện; cùng URL không exclude → "Tìm thấy 48 đơn", chip không
  hiện (chênh 5 = đúng 5 đơn hủy). Lưu ý: với bộ lọc
  BANK_TRANSFER+UNPAID, tổng vẫn 7 dù có exclude hay không, vì
  5 đơn hủy seed không có đơn nào vừa chuyển khoản vừa chưa thu
  (3 COD chưa thu + 2 chuyển khoản đã thu) — không phải lỗi.
- Ảnh đã mắt kiểm: `chip-loai-don-huy-1440.png` (chip vàng rõ,
  đúng vị trí; tab "Đã hủy (0)" / "Tất cả (7)" nay đã có chú
  thích) và `chip-loai-don-huy-390.png` (chip vừa 1 dòng, không
  tràn, bố cục mobile không vỡ).

### Dọn nốt — PDF phiếu 5 dòng — ĐẠT

Báo cáo Ngày 10 nói làm 3 PDF nhưng chỉ giao 2 file. File PDF
đơn 5 dòng còn trong /tmp (`/tmp/d10-phieu-5dong.pdf`), đã lưu
thành `phieu-giao-5-dong-ngay-10.pdf`; pdfinfo: 1 trang, khổ A5
(420 × 594.96 pt).

### Kiểm chứng tổng hợp (tự chạy trên bản cuối)
- Unit test **179/179 PASS** (trước 176/176, +3 ca seed-guard);
  test:db **8/8 PASS**; typecheck 0 lỗi; lint 0 lỗi; build OK;
  First Load JS `/` = **115 kB** (≤ 135 kB).
- Curl local trên server standalone cổng 3000: `/` 200; chip
  hiện/không hiện đúng theo URL; link ✕ bỏ đúng tham số exclude.
- DB cuối đợt: **3 đơn mẫu NEW/UNPAID, 21 sản phẩm, 4 khu vực,
  0 phiên admin** (đã xóa 45 đơn SEED + 1 phiên; SP 3 và khu vực
  4 đã xóa lúc kiểm seed được khôi phục đúng giá trị gốc).
- Server verification đang chạy trên cổng 3000 phục vụ bản mới.

### File thay đổi đợt bổ sung
- `prisma/seed.ts`, `src/lib/seed-guard.ts` (mới),
  `src/lib/seed-guard.test.ts` (mới), `package.json` (thêm test
  vào script `test`), `README.md` — mục 1.
- `src/app/admin/orders/page.tsx` — mục 3 (chip + helper
  `clearExcludeHref`).
- Ảnh/file: `chip-loai-don-huy-1440.png`,
  `chip-loai-don-huy-390.png`, `phieu-giao-5-dong-ngay-10.pdf`.

## Thiết kế lại giao diện admin theo ảnh mẫu của Henry (25/11)

Henry gửi ảnh mẫu trang quản trị BĐS (sidebar trái tối, thanh trên
có ô tìm kiếm + chuông + avatar, 5 thẻ số liệu, bảng có bộ lọc, cột
phải tiến độ + biểu đồ tròn + nổi bật) và nói "Tôi thích giao diện
admin giống thế này, hãy chỉnh sửa lại giao diện admin". Henry duyệt
phạm vi "Làm toàn bộ admin". Đầu trang ngang kiểu Ngày 7 (thương
hiệu đầy đủ + menu 2 hàng, quyết định 24/11 ~23:12) được THAY bằng
sidebar — đánh đổi Henry đã duyệt khi chọn phạm vi này.

### 1. Sidebar trái màu tối — ĐẠT

- `src/components/admin/AdminShell.tsx` (mới, client) +
  `src/components/admin/AdminNav.tsx` (viết lại dọc):
  sidebar màu xanh đậm token green-900 (#01321f) của shop (không
  đổi sang xanh dương của ảnh mẫu), logo "Hoa Tươi Demo" + huy
  hiệu vàng "QUẢN TRỊ", đủ 4 mục Tổng quan / Sản phẩm / Đơn hàng /
  Xem shop ↗ chia 3 nhóm (Tổng quan, Quản lý, Cửa hàng), mục đang
  mở nền green-800 + chữ trắng (`aria-current="page"`), icon SVG
  tự vẽ, nút Đăng xuất ở cuối sidebar (desktop).
- Mobile (< lg): sidebar thành drawer trượt từ trái (mẫu MobileMenu
  của shop: translateX 300 ms, nền mờ fade 200 ms, đóng bằng Esc /
  bấm nền mờ / bấm liên kết, khóa cuộn nền, trả focus về nút mở,
  `inert` khi đóng). Nút Đăng xuất vẫn thấy trên topbar mobile.

### 2. Thanh trên cùng — ĐẠT

- Ô tìm kiếm THẬT (không phải trang trí): form GET tới
  `/admin/orders` với `tab=all` ẩn, dùng đúng logic tìm theo mã
  đơn/tên/SĐT sẵn có. Kiểm bằng trình duyệt: gõ SEED000001 ở ô
  trên → ra trang đơn "Tìm thấy 1 đơn", đúng đơn đó. Ô tìm kiếm ẩn
  dưới sm (ô tìm kiếm riêng của trang đơn vẫn dùng được).
- Phải: "Quản trị viên / admin" + vòng tròn chữ Q + nút Đăng xuất
  (mobile). Không có chuông thông báo (shop chưa có chức năng đó —
  không làm nút chết).

### 3. Trang tổng quan — ĐẠT

- 5 thẻ số liệu giữ ĐÚNG số + link đích Ngày 10 (D10-2), thêm ô
  icon màu kiểu ảnh mẫu. **Độ lệch so với ảnh mẫu (đã ghi trong
  code): lưới thẻ là 3 cột (3+2) thay vì 5 thẻ 1 hàng, số tiền ở
  hàng riêng cỡ text-2xl** — số VND dài ("4.130.000 ₫") ở text-3xl
  đã tràn khỏi thẻ khi 5 thẻ xếp 1 hàng (nội dung thẻ chỉ ~139 px
  ở 1280 px; ảnh kiểm đầu thấy "₫" lòi ra ngoài viền thẻ). Số trong
  ảnh mẫu ngắn ("48", "87%") nên xếp 5 được; shop thì không.
- Cột phải: "Tiến độ đơn hàng" (số đơn theo trạng thái + thanh
  tiến độ) và "Thống kê theo trạng thái" (biểu đồ tròn vẽ bằng
  `conic-gradient`, không thêm thư viện) — số từ DB qua 2 hàm mới
  `getOrderStatusCounts()` + `getRecentOrders()` trong
  `src/lib/admin/dashboard.ts`. **Thêm ngoài phạm vi ghi trong
  nhiệm vụ: khối "Đơn mới nhất" (5 đơn mới nhất) ở cột trái** —
  nếu không, dưới 5 thẻ sẽ là cột trái trống; số liệu đã có sẵn
  trong DB, không thêm logic mới ngoài một truy vấn take-5.
- Không hiện phần trăm tăng trưởng "↑12%" như ảnh mẫu (shop chưa
  có số liệu đó — không bịa).

### 4. Bảng đơn hàng — ĐẠT

- Restyle nhẹ (bóng thẻ, nền đầu bảng cream-50, hover hàng):
  GIỮ NGUYÊN mọi cột, bộ lọc (tab/trạng thái/thanh toán/phương
  thức/ngày/tìm kiếm), chip "Không tính đơn đã hủy ✕", phân
  trang 20/trang.

### 5. Chi tiết đơn + trang sản phẩm — ĐẠT

- Restyle đồng bộ qua shell chung (sidebar + topbar); giữ nguyên
  mọi nội dung/chức năng (đổi trạng thái, in phiếu, quản lý sản
  phẩm, upload ảnh). Trang sửa/thêm sản phẩm và /login đều 200.

### 6. Trang in phiếu — ĐẠT (KHÔNG ĐỔI)

- Không sửa file in. In lại bằng Chrome print-to-PDF sau khi đổi
  layout: đơn hủy + đơn thường đều **1 trang, khổ A5**
  (420 × 594.96 pt). Sidebar/topbar/drawer có `print:hidden`,
  `<main id="noi-dung-chinh">` giữ nguyên nên rule làm trắng nền
  kem vẫn trúng.

### 7. Màu sắc — ĐẠT

- Giữ token xanh lá/vàng của shop (giao-dien-v2); chỉ lấy BỐ CỤC
  của ảnh mẫu.

### 8. Đo ở 360 px (mục 5 verdict Ngày 10) — ĐẠT

- Đo bằng CDP (`document.documentElement.scrollWidth` so với
  `innerWidth`): dashboard 360 px: scrollWidth 345 = innerWidth
  360 − 15 px thanh cuộn dọc cổ điển → **không tràn ngang**;
  danh sách đơn 360 px cũng 345/360. Topbar 360 px: nút ☰ +
  avatar + Đăng xuất vừa màn hình. Drawer 390 px mở/đóng đúng
  (mở bằng nút ☰, đóng bằng Esc đã kiểm bằng CDP: trả về
  "drawer CLOSED by Esc"). Bố cục cũ (nút Đăng xuất rớt hàng)
  không còn vì đầu trang cũ đã bị thay bằng sidebar.

### Kiểm chứng tổng hợp (tự chạy trên bản cuối)

- Unit test **185/185 PASS**; test:db **10/10 PASS** (trước 8/8,
  +2 ca mới: `getOrderStatusCounts` đủ 6 trạng thái/tổng khớp,
  `getRecentOrders` đơn mới đứng đầu + tôn trọng giới hạn);
  typecheck 0 lỗi; lint 0 lỗi (đã sửa 1 warning import thừa);
  build OK; First Load JS `/` = **115 kB** (≤ 135 kB).
- Curl local trên server standalone cổng 3000 (48 đơn = 45 seed +
  3 mẫu): thẻ dashboard 38 / 8 / 7 / 4.130.000 ₫ / 4.130.000 ₫
  khớp DB (giao hôm nay 8 chứ không phải 11 như Ngày 10 — ngày
  seed nay là 25/11, phân bố ngày giao theo ngày chạy seed);
  link thẻ: pending → "Tìm thấy 38 đơn", giao hôm nay → 8,
  chuyển khoản chưa thu → 7; chip hiện với exclude (43 đơn) và
  ẩn khi không có exclude (48 đơn); tìm q=SEED000001 → 1 đơn;
  trang 2 → tổng vẫn 48; sản phẩm → 21; chi tiết đơn 200.
- Ảnh đã mắt kiểm: `admin-moi-dashboard-1440.png` (v2, sau khi
  sửa tràn số), `admin-moi-dashboard-1440-day-du.png` (toàn trang,
  biểu đồ tròn), `admin-moi-don-hang-1440.png`,
  `admin-moi-chi-tiet-don-1440.png`, `admin-moi-san-pham-1440.png`,
  `admin-moi-dashboard-390.png`, `admin-moi-drawer-390.png`,
  `admin-moi-topbar-360.png`.
- Môi trường: giữa đợt VM bị thay mới (mất PostgreSQL + Chrome
  đã cài) — đã cài lại PostgreSQL 16 + Chrome 158, dựng DB từ
  migration + seed + `recreate-test-data.ts`.
- DB cuối đợt: **3 đơn mẫu NEW/UNPAID, 21 sản phẩm, 4 khu vực,
  0 phiên admin** (đã xóa 45 đơn SEED + 1 phiên bằng
  `clean-test-data.ts --only=seed,sessions --delete`).
- Server verification đang chạy trên cổng 3000 phục vụ bản mới.

### File thay đổi đợt này

- `src/components/admin/AdminShell.tsx` (mới) — sidebar +
  drawer + topbar.
- `src/components/admin/AdminNav.tsx` (viết lại) — menu dọc.
- `src/app/admin/layout.tsx` (viết lại) — dùng AdminShell.
- `src/app/admin/page.tsx` (viết lại) — 5 thẻ icon + đơn mới
  nhất + tiến độ + biểu đồ tròn.
- `src/lib/admin/dashboard.ts` — thêm `getOrderStatusCounts()`,
  `getRecentOrders()`.
- `src/app/admin/orders/page.tsx`, `src/app/admin/products/page.tsx`
  — restyle nhẹ (bóng, nền đầu bảng, hover).
- `src/lib/admin/orders.db.test.ts` — +2 ca test:db.
- Ảnh: 8 file `admin-moi-*.png` ở `~/workspace/`.

## Thiết kế lại admin lần 2 — đúng màu mockup + menu đầy đủ (25/11, sau verdict Ngày 10)

Henry phản hồi sau lần thiết kế đầu: bố cục giống ảnh mẫu nhưng màu sắc/style không giống (lần đầu giữ xanh lá/vàng của shop). Henry duyệt kế hoạch sửa ngày 25/11 ~12:32.

### Bảng màu mới (chỉ trang admin; mặt shop bán hàng giữ nguyên xanh lá/vàng)

Lấy trực tiếp từ ảnh mẫu `~/workspace/user/media_library/image/Admin_-_D___n.png`:

- Sidebar xanh navy đậm `#0f1e33`, rộng `w-72` (288 px — bằng ảnh mẫu; `w-64` làm 4 nhãn "Sắp có" dài bị cắt dấu …).
- Mục đang mở nền xanh dương `#2563eb` bo tròn `rounded-lg`, chữ trắng; mục thường chữ xám nhạt `slate-400`; nhãn nhóm chữ nhỏ in hoa xám `slate-500`.
- Logo: ô vuông xanh dương `#2563eb` chữ "H" trắng + "Hoa Tươi Demo" trắng + huy hiệu "Admin" nền trắng mờ.
- Nền trang xám nhạt `#f1f5f9` (`slate-100`), chữ navy `#0f172a` (`slate-900`), chữ phụ `slate-500`.
- Thẻ trắng `rounded-xl`, viền `slate-200`, bóng nhẹ `shadow-sm`.
- Thẻ số liệu: icon mỗi thẻ một ô màu pastel khác nhau như ảnh mẫu — xanh dương (`blue-100`/`blue-600`), xanh lá (`green-100`/`green-600`), tím (`violet-100`/`violet-600`), cam (`orange-100`/`orange-600`), hồng (`pink-100`/`pink-600`).
- Chữ trong admin dùng font sans mặc định, KHÔNG dùng font serif Playfair nữa.
- Nút chính xanh dương `#2563eb` (`blue-600`, hover `blue-700`); nút phụ viền `slate-300`, chữ `slate-900`.
- Huy hiệu trạng thái kiểu ảnh mẫu (mềm, nền pastel, không viền): NEW xanh dương, CONFIRMED tím, DELIVERING hổ phách, COMPLETED xanh lá, CANCELLED xám — chỉ trong admin (`OrderStatusBadge` thêm prop `variant="admin"`; mặc định `"shop"` giữ màu xanh lá cũ cho trang công khai `/order/[code]`, đã kiểm vẫn xanh lá).

### Menu đầy đủ (theo đúng danh sách Henry duyệt)

Nhóm như ảnh mẫu; mục chưa làm ghi "Sắp có" — hiển thị mờ + huy hiệu "Sắp có", KHÔNG bấm được (`<span aria-disabled>`, không dùng thẻ `<a>`, không link chết):

- **Bảng điều khiển:** Tổng quan (`/admin`)
- **Quản lý nội dung:** Sản phẩm (`/admin/products`), Danh mục (Sắp có), Bài viết / Tin tức (Sắp có), Trang tĩnh (Sắp có)
- **Giao dịch:** Đơn hàng (`/admin/orders`), Yêu cầu liên hệ (Sắp có), Khách hàng (Sắp có), Tin nhắn (Sắp có)
- **Người dùng:** Tài khoản quản trị (Sắp có), Vai trò & phân quyền (Sắp có)
- **Cấu hình:** Khu vực & phí giao hàng (Sắp có), Ngân hàng & QR (Sắp có), Telegram (Sắp có), Cài đặt shop (Sắp có), Nhật ký hoạt động (Sắp có)
- **Cửa hàng:** Xem shop (link ra shop)

### Thanh trên

- Chuông báo THẬT: số trên chuông = số đơn cần xử lý (NEW + CONFIRMED + DELIVERING, lấy từ `getAdminDashboardStats()` sẵn có; `layout.tsx` lấy số này truyền xuống `AdminShell` qua prop `pendingCount`), bấm chuông ra `/admin/orders?tab=pending` (tab mặc định của trang đơn, cùng link thẻ "Đơn cần xử lý"). Huy hiệu đỏ chỉ hiện khi số > 0.
- Ô tìm kiếm hiện cả trên mobile: thành hàng thứ hai của thanh trên (dưới 640 px `order-3 w-full`, từ `sm` trở lên về lại một hàng).
- Avatar tròn xanh dương chữ "Q" (thay cho vòng xanh lá cũ).

### Bỏ PREPARING khỏi hiển thị

Dòng "Đang chuẩn bị" (PREPARING) đã bỏ khỏi biểu đồ tiến độ VÀ biểu đồ tròn + chú thích (verdict Ngày 10 + kiểm lại trong code: `PREPARING: []` trong bảng chuyển trạng thái, không đường nào tạo ra đơn ở trạng thái này nên dòng đó mãi bằng 0). Chỉ lọc ra khỏi hiển thị ở `page.tsx` (`visibleCounts`); KHÔNG sửa enum, label hay hàm đếm `getOrderStatusCounts()` (test:db vẫn kiểm đủ 6 trạng thái).

### Các thay đổi khác trong đợt này

- 5 thẻ số liệu xếp 1 HÀNG ở màn hình rộng (`xl:grid-cols-5`), số tiền cỡ `text-2xl` — "4.130.000 ₫" vừa một dòng ở 1440 px và 1280 px (đo bằng CDP: ở 1280 px `scrollWidth` 132 so với `clientWidth` 131 — lệch 1 px, nằm trong đệm 20 px của thẻ, mắt kiểm không thấy tràn).
- Màu trạng thái cho thanh tiến độ + biểu đồ tròn đổi sang bảng màu ảnh mẫu: NEW `#3b82f6`, CONFIRMED `#8b5cf6`, DELIVERING `#f59e0b`, COMPLETED `#22c55e`, CANCELLED `#94a3b8`.
- Trang danh sách đơn, chi tiết đơn, sản phẩm, biểu mẫu sản phẩm, nút thao tác: đổi sang xanh dương/xám nhạt theo cùng bảng màu (bo góc lớn cho thẻ, bo vừa cho ô nhập/nút). Trang in phiếu KHÔNG đổi (sidebar/topbar/drawer `print:hidden`, `<main id="noi-dung-chinh">` giữ nguyên).
- Nút chính trong admin bỏ chữ hoa toàn bộ (`uppercase`) cho giống nút "+ Thêm dự án" trong ảnh mẫu.

### Độ lệch so với kế hoạch

- Nhãn menu dài nhất "Khu vực & phí giao hàng" xuống 2 dòng trên sidebar desktop (đã mở rộng sidebar lên `w-72` nhưng nhãn này vẫn dài hơn chỗ trống sau khi trừ icon + huy hiệu "Sắp có"; đã bỏ cắt dấu … và cho xuống dòng để đọc đủ, kèm `title` là tên đầy đủ). Các nhãn còn lại 1 dòng.
- Nhãn thẻ số liệu dài ("Chuyển khoản chưa thu", "Doanh thu hôm nay") vẫn xuống 2 dòng trong thẻ ở 1280–1440 px (nhãn tiếng Việt dài hơn nhãn ảnh mẫu); số liệu vẫn thẳng hàng, không tràn.
- Link "Xem đơn đã giao →" xuống 2 dòng trong thẻ doanh thu ở 1280 px (thẻ hẹp); ở 1440 px 1 dòng.

### Kiểm chứng (bản cuối, 25/11 ~12:40–12:47)

- Unit test **185/185 PASS**; test:db **10/10 PASS**; typecheck 0 lỗi; lint 0 lỗi; build OK; First Load JS `/` = **115 kB** (≤ 135 kB).
- Curl local trên server standalone cổng 3000 (48 đơn = 45 seed + 3 mẫu): thẻ dashboard 38 / 8 / 7 / 4.130.000 ₫ / 4.130.000 ₫ khớp DB (SQL đối chiếu: pending 38, giao hôm nay 8, chuyển khoản chưa thu 7, đã giao 5); link thẻ ra đúng danh sách; chuông = 38, bấm chuông ra "Tìm thấy 38 đơn"; tìm topbar `q=SEED000001` → 1 đơn; chip với exclude → 7 đơn + chip hiện; sản phẩm → 21; chi tiết đơn 200 + huy hiệu xanh dương; trang công khai `/order/0Z2DZBQNTJ` vẫn huy hiệu xanh lá cũ (không đổi mặt shop); trang chủ shop 200, token xanh lá/vàng vẫn còn.
- HTML dashboard: 0 lần "PREPARING"/"Đang chuẩn bị"; "Sắp có" xuất hiện 52 lần = 13 mục × 2 (sidebar + drawer) × 2 (huy hiệu + title); 0 lần `green-900` trong HTML admin.
- Mắt kiểm 7 ảnh (xem `~/workspace/`): `admin-navy-dashboard-1440.png`, `admin-navy-menu-1440.png` (đủ menu), `admin-navy-don-hang-1440.png`, `admin-navy-dashboard-1280.png` (số tiền vừa 1 dòng), `admin-navy-dashboard-390.png`, `admin-navy-drawer-390.png` (đủ menu + huy hiệu Sắp có), `admin-navy-topbar-360.png` (thấy ô tìm kiếm, không tràn ngang).
- Trang in: Chrome print-to-PDF, đơn hủy (`SEED000041`) + đơn thường (`SEED000031`) đều **1 trang, khổ A5** (420 × 595.92 pt) — `admin-navy-phieu-huy.pdf`, `admin-navy-phieu-thuong.pdf`.
- DB cuối đợt: **3 đơn mẫu NEW/UNPAID, 21 sản phẩm, 4 khu vực, 0 phiên admin** (đã xóa 45 đơn seed + phiên bằng `clean-test-data.ts --only=seed,sessions --delete`).

### Bổ sung sau lần 2 — sửa font tiêu đề admin (25/11 ~12:50, kiểm lại độc lập)
- Phát hiện khi mắt kiểm ảnh lần 2: tiêu đề "Tổng quan", "Đơn mới nhất", "Tiến độ đơn hàng" vẫn là font serif Playfair, dù class `font-display` đã được gỡ khỏi admin — vì `globals.css` đặt `h1` và `h2, h3` dùng `var(--font-display)` TOÀN CỤC, tiêu đề admin là thẻ h1/h2/h3 nên vẫn kế thừa serif.
- Sửa: thêm class `admin-shell` vào div gốc của `AdminShell`, thêm rule `.admin-shell :is(h1, h2, h3):not(.font-display) { font-family: var(--font-sans); }` trong `globals.css` — chỉ admin đổi sang sans, mặt shop giữ Playfair; phiếu in (h1 có class `font-display` tường minh) được loại trừ nên giữ nguyên chữ shop.
- Kiểm: computed style của h1 "Tổng quan" = `system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (CDP); ảnh `admin-navy-dashboard-1440.png` đã chụp lại (ghi đè bản cũ) — tiêu đề sans, khớp ảnh mẫu. Test 185/185 + test:db 10/10, build OK, First Load JS `/` = 115 kB.

## Bổ sung sau Ngày 10 — Icon actions + tooltip (25/11 ~18:06–18:45, Henry duyệt)

- Henry duyệt kế hoạch 25/11 ~18:06: mọi nút thao tác trong admin chỉ hiện icon, hover thì hiện tooltip. Một commit, CHƯA push (push cần token GitHub của Henry).
- Mới: `src/components/admin/AdminIconButton.tsx` — component nút icon dùng chung + 8 icon SVG vẽ tay (mắt, mắt gạch, bút chì, mũi tên phải, thùng rác, tiền giấy, gửi, máy in; viewBox 24, stroke currentColor, nét 2, đầu tròn — đúng kiểu icon menu trong `AdminNav`). Tooltip: span `role="tooltip"`, nền navy `#0f1e33`, chữ trắng, hiện khi `group-hover`/`group-focus-within`, phía trên nút; mỗi nút có `aria-label` trùng nội dung tooltip; nút ≥ 44 px (min-h-11 min-w-11).
- **Chỉnh nhỏ so với kế hoạch đã trình: KHÔNG dùng thuộc tính `title`** — title của trình duyệt sẽ hiện thêm một tooltip nữa, chồng lên tooltip tự làm. Tooltip tự làm + `aria-label` là đủ (đọc màn hình + hover/focus).
- Thay đổi:
  - Bảng đơn hàng (`src/app/admin/orders/page.tsx`): thêm cột "Thao tác" cuối bảng — mỗi dòng 1 icon mắt "Xem chi tiết" (link tới chi tiết đơn); thẻ mobile dưới 768 px cũng có icon mắt ở đầu thẻ, cạnh huy hiệu trạng thái. Link mã đơn vẫn đi tới chi tiết như cũ.
  - Bảng sản phẩm (`src/app/admin/products/page.tsx` + `ToggleActiveButton.tsx`): "Sửa" → icon bút chì "Sửa sản phẩm"; Ẩn/Hiện → icon mắt gạch "Ẩn sản phẩm" / mắt "Hiện lại sản phẩm". Hộp xác nhận Ẩn/Hiện và nút chữ "Hủy"/"Xác nhận" trong đó giữ nguyên. Cả bảng desktop lẫn thẻ mobile.
  - Chi tiết đơn (`OrderDetailActions.tsx` + link in ở `[code]/page.tsx`): nút bước tiếp theo → icon mũi tên (tooltip = đúng nhãn bước, vd "Xác nhận đơn"); "Hủy đơn" → icon thùng rác; "Đã thanh toán" → icon tiền giấy (tooltip "Đánh dấu đã thanh toán"); "Gửi lại thông báo Telegram" → icon gửi, tooltip "Chưa cấu hình Telegram" khi disabled; "In phiếu giao hàng" → icon máy in. Nút trong hộp thoại hủy ("Không hủy"/"Xác nhận hủy") giữ nguyên dạng chữ.
  - Tooltip ở cột Thao tác (cột cuối bảng) căn phải (`tooltipAlign="right"`) để không tràn khỏi mép phải của bảng (bảng có `overflow-x-auto` nên nội dung tràn sẽ bị cắt); các chỗ khác căn giữa. Wrapper `span.group` ôm cả nút: nút disabled không nhận sự kiện chuột nhưng hover trên wrapper vẫn hiện tooltip (đã kiểm: nút gửi Telegram khi chưa cấu hình vẫn hiện "Chưa cấu hình Telegram").
- Không đổi hành vi: cùng Server Action, cùng hộp xác nhận hủy, cùng trạng thái disabled, cùng URL/lọc/phân trang/chip; dashboard, sidebar, topbar, trang in, mặt shop không đụng tới.

### Kiểm chứng (độc lập, 25/11 ~18:15–18:45)

- Unit test **185/185 PASS**; test:db **10/10 PASS**; typecheck 0 lỗi; lint 0 lỗi; build OK; First Load JS `/` = **115 kB** (≤ 135 kB; `/admin/orders` 106 kB, `/admin/orders/[code]` 109 kB, `/admin/products` 114 kB).
- CDP trên server standalone cổng 3000 (48 đơn = 45 seed + 3 mẫu + 1 đơn 10 dòng tự tạo `9K7M2Q8X4P`):
  - Bảng đơn: có tiêu đề cột "Thao tác"; 40 icon mắt `aria-label="Xem chi tiết"` (20 bảng + 20 thẻ mobile trong DOM), link đầu tiên đúng `/admin/orders/1N0PEZH0J7`; 0 tooltip rỗng.
  - Bảng sản phẩm: 40 icon "Sửa sản phẩm", 40 icon "Ẩn sản phẩm", 0 icon "Hiện lại sản phẩm" (20 sản phẩm trang 1 đều đang bán); 0 nút chữ "Sửa"/"Ẩn sản phẩm" còn sót.
  - Chi tiết đơn `1N0PEZH0J7` (NEW, COD, UNPAID, chưa gửi Telegram): đủ 5 icon — "Xác nhận đơn" (không disabled), "Hủy đơn", "Đánh dấu đã thanh toán", "Chưa cấu hình Telegram" (disabled = true), "In phiếu giao hàng"; trong nhóm "Thao tác" chỉ còn nút chữ của hộp thoại hủy.
  - Hover thật bằng chuột (CDP `Input.dispatchMouseEvent`): cả 4 tooltip đều hiện — "Xem chi tiết", "Sửa sản phẩm", "Hủy đơn", "Chưa cấu hình Telegram" (visibility: visible, opacity: 1).
  - Bấm icon thùng rác → hộp thoại hủy mở đúng (có ô lý do + nút "Không hủy"/"Xác nhận hủy"); đóng lại bằng nút "Không hủy", đơn không bị hủy.
  - Mobile 390 px: 3 trang (đơn, sản phẩm, chi tiết đơn) đều `scrollWidth = innerWidth = 390`, không tràn ngang; thẻ đơn có 1 icon mắt, thẻ sản phẩm có 1 icon bút chì + 1 icon ẩn/hiện.
  - Mặt shop không đổi: trang chủ 200, token `green-900`/`gold-300` còn nguyên trong HTML.
  - Trang in: print-to-PDF đơn hủy `SEED000044` + đơn 10 dòng `9K7M2Q8X4P` (tạm tính 14.706.000 ₫ + phí 25.000 ₫ = 14.731.000 ₫) đều **1 trang, khổ A5** (420 × 594.96 pt).
- Mắt kiểm 9 ảnh (xem `~/workspace/`): `admin-icon-don-hang-1440.png` (cột Thao tác + tooltip "Xem chi tiết" đang hiện), `admin-icon-tooltip-xem-chi-tiet.png` (cận cảnh), `admin-icon-san-pham-1440.png` (bút chì + mắt gạch, tooltip "Sửa sản phẩm"), `admin-icon-tooltip-sua.png` (cận cảnh), `admin-icon-chi-tiet-don-1440.png` (4 icon thao tác + icon máy in, tooltip "Chưa cấu hình Telegram" đang hiện), `admin-icon-tooltip-huy-don.png` (cận cảnh), `admin-icon-huy-don-dialog-1440.png` (hộp thoại hủy mở, nút chữ còn nguyên), `admin-icon-orders-390.png`, `admin-icon-products-390.png`, `admin-icon-detail-390.png` (mobile, không tràn). PDF: `phieu-giao-huy-icon.pdf`, `phieu-giao-10-dong-icon.pdf`.
- **Vướng khi kiểm (đã xử lý, ghi lại để lần sau khỏi mất công):** Chrome headless mặc định báo `hover: none` nên Tailwind v4 (bọc mọi hover variant trong `@media (hover:hover)`) không áp dụng rule `group-hover` — lần hover đầu tưởng tooltip hỏng (rule có trong CSS build, `:hover` vẫn khớp, nhưng media query không khớp). `Emulation.setEmulatedMedia` không đổi được trạng thái này; chạy Chrome có giao diện dưới Xvfb thì cổng DevTools không mở. Cách kiểm đúng: chạy Chrome headless với cờ `--blink-settings=primaryHoverType=2` (khi đó `matchMedia("(hover:hover)")` = true, giống trình duyệt desktop thật) — tooltip hiện đúng. Trên điện thoại thật (hover: none) tooltip không hiện khi chạm — đúng bản chất mobile, đã nêu với Henry từ lúc trình kế hoạch (bù bằng icon quen thuộc + aria-label).
- Dọn dẹp: đã xóa 45 đơn seed + 7 phiên admin + đơn 10 dòng tự tạo; `clean-test-data.ts --delete` (không `--only`) còn xóa luôn 3 đơn mẫu + SP 21 — đã tạo lại bằng `scripts/recreate-test-data.ts` (lỗi này từng xảy ra 24/11, lần sau chỉ dùng `--only=seed,sessions`). DB cuối đợt: **3 đơn mẫu NEW/UNPAID, 21 sản phẩm, 4 khu vực, 0 phiên admin, 0 lần đăng nhập sai**.
- Môi trường: VM lại bị thay mới giữa đợt — đã cài lại PostgreSQL 16 (tạo lại user/db từ migrations + seed), cài lại Chrome 158 từ file .deb của Google (apt-get update chậm, tải trực tiếp `dl.google.com` vẫn được).

## Bổ sung sau Ngày 10 — Icon nhỏ + tooltip có mũi tên + animation + lọc tự động + popup thêm/sửa (25/11 ~18:51–19:00, Henry phản hồi sau khi xem live)

- Henry xem giao diện live 25/11 ~18:51 và phản hồi 4 ý, rồi thêm 3 ý trong tối (18:53, 18:53, 18:55, 18:56): (1) icon quá to/thô → thu nhỏ; (2) tooltip phải có mũi tên hướng vào nút; (3) tooltip chưa chuyên nghiệp; (4) hệ thống phải có animation khi load và hover. Thêm: (5) thanh cuộn menu sidebar hiện khung trắng xấu trên nền navy → ẩn hẳn; (6) bấm Ẩn/Hiện sản phẩm KHÔNG hiện popup xác nhận nữa — bấm một cái là ẩn/hiện luôn; (7) bộ lọc admin bắt bấm nút "Lọc" mới lọc → phải tự lọc ngay khi chọn, dropdown/checkbox phải có style đẹp (chọn 1 = radio, chọn nhiều = checkbox); (8) thêm/sửa phải hiện dạng POPUP, áp dụng toàn hệ thống ở bất kỳ chỗ nào có thêm/sửa. Tất cả gộp vào MỘT commit trên `9ceb136`, CHƯA push (push cần token GitHub của Henry). Theo quy tắc mới của Henry (25/11 ~18:07): việc UI thì làm thẳng, không hỏi ý kiến trước — Henry xem trên giao diện live và điều chỉnh sau.

### Thay đổi

- **Icon nhỏ, nét mảnh (`AdminIconButton.tsx`):** glyph SVG 24 viewBox render ở **18 px** (`h-[18px] w-[18px]`), stroke-width **1.5** (trước: 24 px / nét 2). **Vùng bấm vẫn giữ 44 px** (`min-h-11 min-w-11`) — chuẩn chạm từ Ngày 8, chỉ glyph nhỏ lại, nút không nhỏ lại (quyết định có chủ ý, đã nêu với Henry).
- **Tooltip chuyên nghiệp, có mũi tên (`AdminIconButton.tsx`):** `text-xs`, `px-2.5 py-1.5`, `rounded-lg`, `shadow-lg`, `whitespace-nowrap`, `z-50`, nền navy `#0f1e33`, chữ trắng; mũi tên là hình vuông 8 px xoay 45° (`rotate-45`, cùng màu nền) ở mép dưới tooltip, hướng xuống nút; hiện bằng fade + trượt 4 px trong 200 ms ease-out, trễ 150 ms khi hover (không chớp khi chuột chỉ lướt qua hàng); không dùng thuộc tính `title`. Thêm prop `align` (`center` | `right`): cột "Thao tác" (cột cuối bảng đơn) dùng `right` — tooltip căn phải, mũi tên cách mép phải 18 px (tâm mũi tên trùng tâm nút 44 px). Vẫn `aria-label` = nội dung tooltip, không đổi văn bản.
- **Animation (`globals.css` + `AdminIconButton.tsx`):** keyframe mới `@keyframes admin-fade-up` (opacity 0→1, translateY(4px)→0, 300 ms ease-out) áp cho các khối nội dung chính trong `<main>` của admin, giới hạn dưới `.admin-shell` (mặt shop không ảnh hưởng), tắt khi in (`@media print`); hover nút icon: `transition-all` + `scale-105` trong 150 ms; tooltip vào như trên. Tôn trọng `prefers-reduced-motion: reduce` (khối cuối `globals.css` đã có sẵn, ép animation/transition về 0.01ms — bao luôn animation mới; đã kiểm bằng CDP với reduced-motion: thời lượng còn 0.01ms).
- **Ẩn thanh cuộn menu sidebar (`globals.css` + `AdminNav.tsx`):** rule mới `.admin-nav-scroll { scrollbar-width: none; }` + `::-webkit-scrollbar { display: none; }`, gắn vào đúng phần tử `<nav>` đang cuộn trong `AdminNav.tsx` (dùng chung cho sidebar desktop và drawer mobile). CHỈ ẩn thanh cuộn của nav sidebar — thanh cuộn trang/nội dung chính không động tới. Vẫn cuộn được bằng chạm/lăn chuột.
- **Ẩn/Hiện không còn hộp xác nhận (`ToggleActiveButton.tsx`):** bỏ hẳn `<dialog>` (xóa `dialogRef`, `confirmedRef`, bộ chặn gửi lần đầu, toàn bộ JSX `<dialog>`); nút thành form submit thẳng tới `toggleProductAction` (giữ `useActionState` + `router.refresh()` khi thành công + hiện lỗi dạng `<p role="alert">` nếu có). Prop `productName` bỏ luôn ở component và cả 2 chỗ gọi. An toàn vì ẩn/hiện đảo ngược được bằng một lần bấm nữa, trạng thái "Đang bán"/"Đã ẩn" đổi ngay. CHỈ bỏ hộp xác nhận của Ẩn/Hiện — hộp xác nhận Hủy đơn ở chi tiết đơn vẫn giữ nguyên (hủy cần lý do bắt buộc). **Đính chính nhãn (báo cáo đợt trước ghi sai):** nhãn khi sản phẩm đang ẩn là **"Hiện lại"** (không phải "Hiện lại sản phẩm") — code `ToggleActiveButton.tsx` ghi đúng như vậy từ đầu.
- **Lọc tự động + radio pill + checkbox có style (mới: `filter-controls.tsx`, `OrdersFilterBar.tsx`, `ProductsFilterBar.tsx`):**
  - `/admin/orders` và `/admin/products`: bỏ hẳn form GET + nút "Lọc" + các `<select>`; thay bằng client component dùng `useRouter`/`usePathname` + `router.replace`: đổi một lọc thì cập nhật đúng param đó, giữ nguyên các param còn lại (tab, exclude, q...), reset về trang 1 (bỏ param `page`). Ô tìm kiếm debounce ~400 ms, Enter lọc ngay. **Tên và giá trị param GIỮ NGUYÊN như cũ** (`payment`, `method`, `date`, `q`, `tab`, `exclude`, `category`, `status`) nên link từ thẻ dashboard (`method=BANK_TRANSFER`, `exclude=CANCELLED`) và bookmark vẫn chạy; trạng thái lọc trên UI lấy từ URL khi tải trang. Đọc param hiện tại từ `window.location.search` (luôn mới nhất) thay vì snapshot `useSearchParams` — tránh mất một lần đổi lọc khi đổi 2 lọc liên tiếp trước khi render lại. Trang server bọc filter bar trong `<Suspense>` (hook dùng `useSearchParams` gián tiếp).
  - Chọn 1 → radio kiểu pill: payment (3), method (3), category sản phẩm (5: tất cả + 4), status sản phẩm (3), category trong `ProductForm` (4) — `<fieldset>` + `<legend>` + input radio thật (`sr-only`, `peer`) + label; đang chọn nền xanh dương chữ trắng, chưa chọn nền trắng viền slate; tự xuống dòng trên mobile. Không còn `<select>` ở những chỗ này.
  - Checkbox có style (`StyledCheckbox` trong `filter-controls.tsx`): 3 checkbox trong `ProductForm` (`isActive` "Đang bán (hiện trên shop)", `inStock` "Còn hàng", `isFastDelivery` "Giao nhanh") thành ô vuông ~20 px bo tròn, viền slate, khi checked nền xanh dương + dấu tích trắng (SVG), có hover/focus/transition. Giữ nguyên tên field và hành vi gửi form (`formData` vẫn đọc `"on"`). Date input "Ngày giao" giữ nguyên dạng nhập ngày nhưng áp dụng ngay khi chọn ngày.
  - `ProductForm.tsx`: select category → `RadioPillsField` (không cần option trống vì server validation đã bắt buộc chọn danh mục); thêm prop `onSuccess?: "back" | "list"` (mặc định `"list"`); nút "Hủy" ở chế độ modal thì `router.back()`, còn lại là link về `/admin/products` như cũ.
  - `src/app/actions/admin.ts`: `createProductAction` + `updateProductAction` KHÔNG còn `redirect("/admin/products")` khi thành công — trả về `{ ok: true, ... }` để modal tự đóng (đã bỏ import `redirect` thừa); vẫn `revalidatePath("/", "layout")`. Không test nào phụ thuộc vào redirect cũ.
  - Đã gỡ `transition-colors`/`transition-opacity` khỏi tất cả 10 chỗ gọi `AdminIconButton` (component đã tự quản `transition-all` — để 2 transition chồng nhau sẽ khó đoán).
- **Thêm/sửa sản phẩm thành POPUP (mới: `ProductModal.tsx` + intercepting route `@modal`):**
  - "+ Thêm sản phẩm" → popup với `ProductForm` trống; icon bút chì trên một dòng (bảng desktop + thẻ mobile) → popup với dữ liệu sản phẩm đó đã điền sẵn. KHÔNG chuyển trang nữa.
  - Popup dùng `<dialog>` gốc (`showModal()` trong `useEffect`, có guard `open` chống gọi 2 lần; nút đóng ✕ `aria-label="Đóng"`; bấm nền mờ đóng (`event.target === dialog`); Esc đóng (hành vi gốc của dialog); đóng thì `close()` trước (trả tiêu điểm về nút đã bấm) rồi sự kiện `close` gọi `router.back()` về lại danh sách — `back()` giữ nguyên URL lọc hiện tại. Tiêu đề rõ ("Thêm sản phẩm" / "Sửa sản phẩm ..."). Nội dung cuộn trong `max-h-[calc(90dvh-9rem)] overflow-y-auto`.
  - Sau khi lưu thành công: ĐÓNG popup và làm mới danh sách (`router.refresh()` qua `onSuccess="back"` → `router.back()`), dòng mới/sửa hiện ra ngay, KHÔNG điều hướng sang trang khác. Lỗi validation vẫn hiện trong popup như cũ; lỗi server vẫn hiện; nút "Hủy" đóng popup (không lưu).
  - **Cách chọn: intercepting route (chuẩn Next.js).** `src/app/admin/layout.tsx` nhận thêm slot `modal` và truyền xuống `AdminShell`; `AdminShell` render `{modal}` làm con cuối của div `.admin-shell` (trong `.admin-shell` để giữ font sans, ngoài `<main>` để không dính hiệu ứng vào trang); `src/app/admin/@modal/default.tsx` trả null; `src/app/admin/@modal/(.)products/new/page.tsx` và `(.)products/[id]/page.tsx` render `ProductModal` + `ProductForm` (`onSuccess="back"`). URL `/admin/products/new` và `/admin/products/[id]` vẫn mở được trực tiếp (trang form đầy đủ như cũ khi vào thẳng — đã kiểm).
  - **Sửa lỗi quan trọng khi làm (ghi lại để khỏi lặp lại):** lúc đầu đặt thư mục intercepting route là `(..)products` — KHÔNG chặn được (bấm "+ Thêm sản phẩm" vẫn chuyển trang đầy đủ, RSC trả về trang form thường, không có slot `modal`). Nguyên nhân đọc từ code Next.js (`extractInterceptionRouteInformation`): với marker `(..)`, route bị chặn = route chứa slot **bỏ đi đoạn cuối** + đường dẫn còn lại — slot ở `/admin` nên `(..)products/new` chặn `/products/new` (route gốc, không tồn tại), chứ không phải `/admin/products/new`. Marker đúng cho cùng cấp là **`(.)`** (`interceptedRoute = interceptingRoute + '/' + path` = `/admin/products/new`). Đổi tên thư mục sang `(.)products` thì chặn đúng ngay, không đổi code nào khác. Bảng route sau build: `/admin/(.)products/[id]` và `/admin/(.)products/new` (744 B / 117 kB).
  - **Quy tắc đứng (ghi trong code + báo cáo này):** mọi màn thêm/sửa trong hệ thống (kể cả các trang "Sắp có" sau này như Danh mục, Bài viết...) đều dùng popup — comment đầu `ProductModal.tsx` và `ProductForm.tsx` đã ghi rõ, lần sau không ai làm lại dạng trang riêng.

### Kiểm chứng (độc lập, 25/11 ~19:00–19:45, CDP trên server standalone cổng 3000, Chrome headless + `--blink-settings=primaryHoverType=2`)

- Unit test **185/185 PASS**; test:db **10/10 PASS**; typecheck 0 lỗi; lint 0 lỗi (1 cảnh báo `aria-invalid` không dùng được cho role radio lúc đầu — đã bỏ thuộc tính đó, lỗi hiện qua `<p role="alert">` dưới nhóm); build OK (2 lần, lần 2 sau khi sửa `(..)` → `(.)`); First Load JS `/` = **115 kB** (≤ 135 kB).
- **Icon + tooltip (1440 px):** SVG đo được **18×18**, stroke-width **1.5**, nút **44×44**; hover thật bằng chuột: tooltip "Xem chi tiết" hiện (visibility: visible, opacity: 1), mũi tên `rotate: 45deg` (lưu ý: Tailwind v4 dùng thuộc tính CSS `rotate`, KHÔNG phải `transform` — lần kiểm đầu đọc sai thuộc tính nên tưởng mũi tên chưa xoay), nền mũi tên `rgb(15,30,51)`, tâm mũi tên = tâm nút (1343 = 1343), mép phải tooltip 1365 ≤ 1440; cột Thao tác dùng `tooltipAlign="right"`.
- **Animation load:** phần tử nội dung đầu tiên trong `<main>` của admin có `animationName: admin-fade-up`, `animationDuration: 0.3s`; opacity **0 ở ~60 ms sau khi vào trang → 1 ở ~560 ms** (fade-up chạy thật). Với `prefers-reduced-motion: reduce`, thời lượng còn **0.01ms** (tắt).
- **Thanh cuộn nav:** nav có class `admin-nav-scroll`, computed `scrollbarWidth: none`; desktop 1280×768: scrollHeight 1016 > clientHeight 477; drawer 390×844: 1016 > 696; cuộn xuống cuối tới được "Xem shop" + "Đăng xuất"; ảnh drawer không còn khung trắng.
- **Ẩn/Hiện không hộp xác nhận:** bấm mắt gạch trên SP 1 → trạng thái đổi "Đang bán" → "Đã ẩn", **0 dialog mở**; bấm lại (nhãn "Hiện lại") → về "Đang bán" (đã kiểm qua `requestSubmit` + DB: `isActive` true; 2 lần bấm chuột CDP vào nút này không kích hoạt được form — đã xác minh là do click tổng hợp của probe, không phải lỗi app: cùng nút đó lần ẩn trước đã bấm được, và `requestSubmit` đổi đúng cả 2 chiều; nút vẫn hoạt động với chuột thật). Hộp xác nhận Hủy đơn không động tới.
- **Lọc tự động (1440 + 390 px):** không còn `<select>`, không còn nút "Lọc" ở cả 2 trang; đổi radio payment PAID → URL `?payment=PAID`, "Tìm thấy 17 đơn"; về "Tất cả" → 39 đơn (tab pending); link dashboard `?tab=pending&method=BANK_TRANSFER&exclude=CANCELLED` → radio "Chuyển khoản" được chọn + chip loại đơn hủy hiện; đổi payment khác vẫn giữ `method` + `exclude` trong URL; chọn ngày → URL có `date=2026-11-25`; gõ tìm kiếm debounce → `q=SEED000001`, "Tìm thấy 1 đơn"; Enter lọc ngay (< 400 ms); trang sản phẩm: category "Giỏ trái cây" → `?category=2`, "Tìm thấy 3 sản phẩm"; status "Đã ẩn" (giữ category=2) → 0 sản phẩm; @390: status=hidden → `?status=hidden`, 0 sản phẩm, radio được chọn là "hidden"; thêm category=2 → `?status=hidden&category=2`, 0 sản phẩm; về status=all → `?status=all&category=2`, 3 sản phẩm. Mở form sửa: radio danh mục + 3 checkbox style mới hiển thị đúng, gửi form lưu được (đổi giá rồi lưu, DB đổi theo).
- **Popup (1440 + 390 px):**
  - Bấm "+ Thêm sản phẩm" → URL `/admin/products/new`, `dialog[open] = true`, danh sách vẫn ở phía sau ("Tìm thấy" còn trong DOM), tiêu đề "Thêm sản phẩm"; điền tên/giá/chọn danh mục → bấm "Lưu sản phẩm" (bấm chuột thật) → popup đóng, URL về `/admin/products`, sản phẩm mới "Bó Hoa Test Modal" (150.000 đ) xuất hiện trong danh sách (DB: id 24).
  - Bấm bút chì SP "Bó Hoa Test Probe3" → URL `/admin/products/23`, popup mở, tiêu đề "Sửa sản phẩm Bó Hoa Test Probe3", tên/slug/giá (120.000) điền sẵn, danh mục "Hoa tươi" được chọn; sửa giá → 135.000 (DB đổi theo), popup đóng, URL về `/admin/products`.
  - Đóng: Esc (cần đủ chuỗi phím `rawKeyDown` + `keyDown` + `keyUp` — chỉ gửi `keyDown`/`keyUp` thì dialog gốc không đóng trong Chrome headless) → đóng, về danh sách; bấm nền mờ → đóng; bấm ✕ → đóng; cả 3 đều không lưu.
  - Lỗi validation trong popup: tên "AB" (2 ký tự — qua được `required` của trình duyệt nhưng trượt kiểm tra server ≥ 3 ký tự) → popup vẫn mở, hiện `role="alert"` **"Tên sản phẩm phải từ 3 đến 120 ký tự."**; tên trống thì trình duyệt chặn bằng validation gốc (không gửi action) — hành vi có sẵn của form, không đổi.
  - Vào trực tiếp `/admin/products/new` và `/admin/products/23` → trang form đầy đủ (không popup), lưu được (tên/giá/danh mục điền đúng, sau lưu về `/admin/products`; SP Probe3 đổi giá → 140.000 đ qua trang trực tiếp).
  - @390: popup mở trên nền danh sách, rộng 358 px ≤ 390, tiêu đề + ✕ đầy đủ, cuộn được trong popup.
- **Mobile 390 px:** drawer nav (scrollbar ẩn, cuộn tới cuối), tooltip trên thẻ mobile: hiện (visible, opacity 1), `tipLeft 252 / tipRight 342` trong 390, tâm mũi tên = tâm nút (320 = 320); tooltip trên bảng (cột cuối) căn phải không tràn; 3 trang (đơn, sản phẩm, chi tiết) đều `scrollWidth 375 = 390 − 15` (trừ scrollbar), không tràn ngang; bật/tắt trên thẻ mobile đổi trạng thái ngay ("Đang bán" ↔ "Đã ẩn") rồi trả lại như cũ.
- **Mặt shop không đổi:** trang chủ 200, token `green-900` (48 lần) / `gold-300` (30 lần) còn nguyên trong HTML.
- **Trang in:** print-to-PDF đơn hủy `SEED000044` + đơn 10 dòng `T10DNGXYZ1` (15.670.000 ₫ + phí 25.000 ₫ = 15.695.000 ₫) đều **1 trang, khổ A5** (420 × 595.92 pt).
- **Mắt kiểm ảnh (xem `~/workspace/`):** `admin-icon-v2-tooltip-arrow-1440.png` (tooltip "Xem chi tiết" + mũi tên trên cột Thao tác), `admin-icon-v2-san-pham-1440.png` (bảng sản phẩm, icon bút chì/mắt gạch nhỏ, pill lọc), `admin-icon-v2-chi-tiet-don-1440.png` (4 icon thao tác: mũi tên, thùng rác, tiền giấy, máy in — đơn này đã gửi Telegram nên không có nút gửi lại, đúng quy tắc Ngày 8), `admin-icon-v2-modal-them-1440.png` (popup thêm, danh sách mờ phía sau), `admin-icon-v2-modal-sua-1440.png` (popup sửa, dữ liệu điền sẵn, "Hoa tươi" được chọn), `admin-icon-v2-modal-loi-1440.png` (popup + lỗi validation), `admin-icon-v2-drawer-390.png` (drawer cuộn tới cuối, không khung trắng), `admin-icon-v2-tooltip-390.png` (tooltip trên thẻ mobile, trong viewport), `admin-icon-v2-modal-390.png` (popup trên mobile), `admin-icon-v2-dashboard-1440.png`. PDF: `phieu-giao-huy-icon.pdf`, `phieu-giao-10-dong-icon.pdf` (ghi đè bản đợt icon v1 — cùng tên, nội dung in không đổi).
- **Vướng khi kiểm (đã xử lý, ghi lại để lần sau khỏi mất công):**
  - **2 thẻ `<main id="noi-dung-chinh">` trùng nhau (có sẵn từ trước, KHÔNG phải do đợt này):** layout gốc (`src/app/layout.tsx:70`) bọc toàn bộ trang trong `<main id="noi-dung-chinh">`, và `AdminShell` lại render thêm một `<main id="noi-dung-chinh">` bên trong (lồng nhau — HTML không hợp lệ, id trùng). Lần kiểm animation đầu đo nhầm phần tử con của `<main>` ngoài (chính là div `.admin-shell`) nên tưởng animation không chạy — đo đúng phần tử con của `<main>` trong (nội dung trang thật) thì animation chạy đúng. Rule `.admin-shell main#noi-dung-chinh > *` vẫn trúng đúng phần tử cần. **Chưa sửa trùng id trong đợt này** (ngoài phạm vi; sửa cần đổi cả rule in phiếu + skip link — để đợt sau, đã ghi nhận ở đây).
  - **Kiểm tooltip phải đọc `rotate`, không đọc `transform`:** Tailwind v4 dùng thuộc tính CSS `rotate` cho `rotate-45`.
  - **Chrome headless có `scroll-behavior: smooth` (globals.css:79, có sẵn):** `scrollIntoView` cuộn từ từ nên đo rect ngay sau đó sẽ ra tọa độ cũ, bấm chuột sẽ trượt — lần kiểm lọc/tooltip @390 đầu bị trượt vì vậy. Cách kiểm đúng: `scrollIntoView({behavior:'instant'})` rồi đo lại rect sau khi cuộn xong.
  - **Bấm nút submit dưới cuối form/dialog bằng tọa độ chuột dễ trượt** (nút ngoài viewport): lần kiểm lưu trang trực tiếp đầu tưởng form hỏng — thực ra form đúng, chỉ cần cuộn nút vào giữa màn hình trước khi bấm (hoặc dùng `requestSubmit()` để kiểm riêng action). Đã kiểm lại: lưu trực tiếp thêm/sửa đều chạy.
  - **Esc đóng dialog gốc cần đủ chuỗi phím** `rawKeyDown` + `keyDown` + `keyUp` trong CDP headless; chỉ gửi `keyDown`/`keyUp` thì không đóng (trình duyệt thật vẫn đóng bình thường).
  - **Nhãn nút Ẩn/Hiện:** đợt trước báo cáo ghi "Hiện lại sản phẩm" là sai — code ghi "Hiện lại". Đã đính chính ở trên.
- **Dọn dẹp:** đã xóa 45 đơn seed + 14 phiên admin bằng `npx tsx scripts/clean-test-data.ts --delete --only=seed,sessions` (lưu ý: script KHÔNG có trong `npm run` — gọi trực tiếp bằng `tsx`; lần đầu gõ `npm run clean-test-data` đã báo `Missing script`); xóa tay đơn 10 dòng tự tạo `T10DNGXYZ1` (+ 10 dòng hàng) và 2 sản phẩm test ("Bó Hoa Test Probe3" id 23, "Bó Hoa Test Modal" id 24) bằng psql; SP 1 "Bó Hồng Đỏ Tình Yêu" đã trả lại "Đang bán" (bị ẩn trong lúc kiểm toggle); SP 2 trả lại "Đang bán" sau khi kiểm bật/tắt trên thẻ mobile. DB cuối đợt: **3 đơn mẫu NEW/UNPAID (0Z2DZBQNTJ, 1N0PEZH0J7, QAFNN907ZY), 21 sản phẩm, 4 khu vực, 0 phiên admin, 0 lần đăng nhập sai**. Ảnh `admin-icon-v2-modal-them-dien-1440.png` (chụp lúc modal chưa chặn được, hiện trang đầy đủ) đã xóa để khỏi nhầm với bản đúng.

## Bổ sung sau Ngày 10 — Tinh chỉnh admin đợt 3 (25/11 ~20:12, theo góp ý của Henry sau khi xem live)

Henry góp 2 ý mới, làm thẳng theo quy tắc 25/11 ~18:07 (không hỏi lại kế hoạch):

### 1. Nút chứa icon chỉ ~30 px — toàn hệ thống admin

- `AdminIconButton` (nút icon dùng chung: mắt xem, bút chì sửa, mắt gạch ẩn/hiện, mũi tên bước tiếp, thùng rác hủy, tiền giấy đã thanh toán, gửi Telegram, máy in): từ `min-h-11 min-w-11` (44 px) xuống `h-[30px] w-[30px]`; glyph giữ **18 px, stroke-width 1.5**.
- Áp dụng cùng 30 px cho mọi nút chỉ có icon còn lại trong admin: nút ✕ đóng popup `ProductModal`, nút hamburger mở/đóng drawer mobile (`AdminShell`, glyph hamburger 24 → 18 px cho cân), link chuông báo trên topbar (giữ badge số đơn cần xử lý, glyph chuông 22 → 18 px).
- Không động tới nút chữ: Đăng xuất, "+ Thêm sản phẩm", các nút trong dialog, tab trạng thái, pill lọc, ô tìm kiếm.
- **LỆCH CHUẨN (ghi rõ):** chuẩn chạm ≥ 44 px từ Ngày 8 **không còn áp dụng cho nút icon** (chỉ nút icon — nút chữ vẫn giữ min-h-11). Henry chốt 30 px cho gọn mắt; đánh đổi: vùng bấm nhỏ hơn trên cảm ứng, nhưng đúng ý Henry sau khi xem live.
- Tooltip vẫn neo đúng vào nút (đo lại, xem dưới); mũi tên căn phải tính lại theo nút 30 px: tâm nút cách mép phải 15 px, mũi tên rộng 8 px → `right-[11px]` (trước là 18 px theo nút 44 px).

### 2. Nhóm nhiều lựa chọn để trong dropdown — thay radio pill

- **Đảo ngược hướng đợt 2:** đợt 2 (18:56) đổi `<select>` thành radio pill theo ý Henry lúc đó; đợt 3 này Henry đổi ý — các nhóm nhiều lựa chọn phải để trong dropdown. Các nhóm bị đổi: trang đơn — "Thanh toán" (all/UNPAID/PAID), "Phương thức" (all/BANK_TRANSFER/COD); trang sản phẩm — "Danh mục" (all + 4 danh mục), "Trạng thái" (all/active/hidden); form sản phẩm — "Danh mục" (4 danh mục) về lại `<select>`.
- Dropdown là `<select>` gốc đã tạo kiểu, dùng chung qua 2 component mới trong `filter-controls.tsx`: `FilterSelect` (có điều khiển, cho thanh lọc) và `FilterSelectField` (không điều khiển, cho form — gửi theo form như `<select>` cũ, `defaultValue` từ dữ liệu đã lưu). Kiểu: `appearance-none` + mũi tên chevron tự vẽ (SVG, `pointer-events-none`), `rounded-lg`, viền slate, focus có viền xanh dương, chữ navy; cao min-h-11 như các ô nhập khác. Select gốc nên bàn phím, đọc màn hình và mobile đều đúng mặc định.
- **Hành vi lọc tự động KHÔNG đổi** (kế thừa đợt 2): đổi dropdown là cập nhật ngay param đó trên URL qua `router.replace`, giữ nguyên các param còn lại (tab, exclude, q, date…), về trang 1 (bỏ param page); **tên và giá trị param giữ nguyên** nên link từ thẻ dashboard và bookmark vẫn chạy.
- `RadioPills` / `RadioPillsField` / `PillOption` trong `filter-controls.tsx` đã xóa (không còn chỗ nào dùng — kiểm tra bằng grep; chỉ còn nhắc trong comment lịch sử của file này và báo cáo này).
- **Giữ nguyên:** tab trạng thái đơn (kèm số đếm) vẫn là tab — đó là điều hướng chính, không phải nhóm lọc; ô tìm kiếm (debounce ~400 ms, Enter lọc ngay); ô "Ngày giao"; chip "Không tính đơn đã hủy"; 3 checkbox đã tạo kiểu trong ProductForm; tooltip, animation, popup căn giữa (`m-auto`), sidebar, màu sắc. Không động tới các radio ở mặt shop (chọn phương thức giao/thanh toán/khung giờ ở checkout — ngoài phạm vi admin).

### Kiểm chứng (độc lập, 25/11 ~20:20–20:45, CDP trên server standalone cổng 3000, Chrome headless + `--blink-settings=primaryHoverType=2`)

- Unit test **185/185 PASS**; test:db **10/10 PASS**; typecheck 0 lỗi; lint 0 lỗi; build OK (2 lần — lần 2 để lấy lại số First Load JS); First Load JS `/` = **115 kB** (≤ 135 kB).
- **Nút icon 30 px:** trang đơn — nút mắt "Xem chi tiết" đo được **30×30** (3 hàng bảng; 3 thẻ mobile ẩn ở 1440 đo 0×0 là đúng); chuông topbar **30×30** (badge "3" vẫn hiện); chi tiết đơn — 4 nút thao tác ("Xác nhận đơn", "Hủy đơn", "Đánh dấu đã thanh toán", "In phiếu giao hàng") đều **30×30**; trang sản phẩm — nút "Sửa sản phẩm" **30×30**; popup — nút ✕ "Đóng" **30×30**; @390 — nút hamburger **30×30**, chuông **30×30**.
- **Tooltip sau khi thu nút:** hover thật bằng chuột lên nút mắt → tooltip "Xem chi tiết" hiện (visibility: visible, opacity: 1); mũi tên đo được cách mép phải tooltip **9 px** — đúng vị trí đặt 11 px, chênh 2 px là do đo khung bao của hình vuông đã xoay 45° (khung bao rộng hơn cạnh thật ~1.65 px mỗi bên), không phải lệch thật.
- **Dropdown + lọc tự động:** trang đơn **0 input radio**; 2 dropdown `#admin-order-payment` (3 lựa chọn), `#admin-order-method` (3 lựa chọn); đổi payment → UNPAID: URL `?payment=UNPAID`, "Tìm thấy 6 hàng" (3 đơn UNPAID × 2 chế độ hiển thị); đổi tiếp method → BANK_TRANSFER: URL `?payment=UNPAID&method=BANK_TRANSFER` (giữ payment), "Tìm thấy 2 hàng" (chỉ QAFNN907ZY); trang sản phẩm **0 input radio**; 2 dropdown `#admin-category` (5 lựa chọn: Tất cả + 4), `#admin-status` (3 lựa chọn); đổi category → 2: URL `?category=2`, "Tìm thấy 6 hàng" (3 sản phẩm Giỏ trái cây × 2); đổi tiếp status → hidden: URL `?category=2&status=hidden` (giữ category), 0 sản phẩm (không có SP ẩn trong danh mục này — đúng).
- **Popup vẫn căn giữa:** bấm "+ Thêm sản phẩm" → dialog mở, tâm x = 720 = đúng giữa viewport 1440, căn giữa dọc đúng; trong popup, "Danh mục" là dropdown 4 lựa chọn, giá trị mặc định "Hoa tươi" (id 1); **0 input radio** trong dialog.
- **Mobile 390 px:** `scrollWidth 390 = innerWidth 390`, không tràn ngang; dropdown "Thanh toán"/"Phương thức" hiện đủ (rộng > 0), xếp dọc trong thẻ lọc; hamburger + chuông 30×30.
- **Mắt kiểm ảnh (xem `~/workspace/`):** `admin-v3-orders-1440.png` (dropdown "Chưa thanh toán"/"Chuyển khoản" có chevron, tooltip "Xem chi tiết" + mũi tên trên nút mắt nhỏ, "Tìm thấy 1 đơn" sau lọc), `admin-v3-products-1440.png` (dropdown "Giỏ trái cây"/"Đã ẩn", "Tìm thấy 0 sản phẩm"), `admin-v3-orders-390.png` (topbar mobile gọn, dropdown xếp dọc, thẻ đơn với nút mắt nhỏ), `admin-v3-modal-1440.png` (popup căn giữa, "Danh mục" là dropdown "Hoa tươi", nút ✕ nhỏ, phía sau là bảng sản phẩm với icon bút chì/mắt gạch nhỏ).
- **Dọn dẹp:** không cần tạo dữ liệu test cho đợt này (3 đơn mẫu đủ để kiểm lọc: UNPAID → 3 đơn, BANK_TRANSFER → 1 đơn, category=2 → 3 SP); chỉ xóa 5 phiên admin do CDP đăng nhập tạo ra bằng `npx tsx scripts/clean-test-data.ts --delete --only=seed,sessions` (không dùng bare `--delete` — bài học đợt trước: bare `--delete` xóa luôn 3 đơn mẫu). DB cuối đợt: **3 đơn mẫu NEW/UNPAID (0Z2DZBQNTJ, 1N0PEZH0J7, QAFNN907ZY), 21 sản phẩm, 4 khu vực, 0 phiên admin**.

## Bổ sung sau Ngày 10 — Trang quản lý Danh mục (25/11 ~20:32, theo câu hỏi của Henry)

Henry hỏi: danh mục đã làm từ trước rồi, sao mục "Danh mục" trong menu vẫn "Sắp có", chưa thao tác được? Đúng là dữ liệu danh mục đã có từ Ngày 1 (4 danh mục seed; lọc sản phẩm theo danh mục, dropdown chọn danh mục trong form sản phẩm và trang danh mục ngoài shop đều chạy) — nhưng **chưa từng có trang quản lý danh mục**: thêm/sửa/xóa danh mục không làm được ở đâu cả, nên menu để "Sắp có" từ lúc thiết kế lại lần 2. Đợt này làm luôn trang đó, theo quy tắc 25/11 ~18:07 (không hỏi lại kế hoạch).

### 1. Trang /admin/categories

- Bảng (từ 768 px) + thẻ (dưới 768 px), cột: **Tên** (link tới trang sửa), **Đường dẫn (slug)** (link tới trang danh mục ngoài shop, `/{slug}`), **Số sản phẩm**, **Thứ tự**; cột Thao tác: bút chì "Sửa danh mục" (link, `AdminIconButton` 30 px) + thùng rác "Xóa danh mục" (xem mục 3).
- Nút "+ Thêm danh mục" (xanh dương, giống "+ Thêm sản phẩm").
- Sidebar: mục "Danh mục" thành link thật tới `/admin/categories` (cả desktop lẫn drawer mobile), hết huy hiệu "Sắp có" cho mục này; 12 mục "Sắp có" còn lại giữ nguyên (12×2 = 24 huy hiệu đếm được trên live — xem kiểm chứng).

### 2. Thêm/sửa dạng popup (quy tắc đứng)

- Tái dùng `ProductModal` (dialog gốc, đã căn giữa bằng `m-auto`) — component này nhận mọi nội dung con, không riêng gì sản phẩm; không tạo modal mới.
- Intercepting routes `src/app/admin/@modal/(.)categories/new` và `/(.)categories/[id]`; vào trực tiếp URL `/admin/categories/new` và `/admin/categories/[id]` vẫn hiện trang form đầy đủ (`onSuccess="list"`), bấm từ danh sách thì popup (`onSuccess="back"`, quay lại giữ nguyên URL).
- Form mới `CategoryForm` (theo mẫu `ProductForm`): **Tên** (3–120 ký tự), **Đường dẫn (slug)** (tự gợi ý từ tên, không dấu — tái dùng `slugifyName`; sửa tay được), **Thứ tự sắp xếp** (số nguyên 0–9999, mặc định 0). Kiểm tra ở máy chủ, lỗi từng trường, giữ nguyên giá trị đã nhập.
- Slug: đúng mẫu chữ thường/số/gạch nối, ≤ 80 ký tự, duy nhất toàn hệ thống (trùng → lỗi đúng trường, không 500), **không được trùng `RESERVED_SLUGS`** (cart, checkout, admin, login, api… — cùng danh sách chặn Day 1 dùng cho seed).
- Đổi slug khi sửa: cảnh báo "Đổi đường dẫn sẽ làm link cũ của trang danh mục báo 404." (giống cảnh báo đổi slug sản phẩm). **Lưu ý cho Henry:** đổi slug đổi luôn URL trang danh mục ngoài shop (`/hoa-tuoi` → `/ten-moi`); link cũ 404, không có redirect tự động.
- Tầng dữ liệu mới `src/lib/admin/categories.ts` (`listAdminCategoriesWithCounts`, `getAdminCategory`, `createAdminCategory`, `updateAdminCategory`, `deleteAdminCategory`) + validation thuần `category-validation.ts` + state `category-form-state.ts` + 3 action mới trong `src/app/actions/admin.ts` (`createCategoryAction`, `updateCategoryAction`, `deleteCategoryAction`, đều `requireAdmin()` đầu tiên, `revalidatePath` danh sách + toàn layout vì slug ảnh hưởng mặt shop).

### 3. Xóa — chỉ khi danh mục trống

- Nút thùng rác **bị khóa** khi danh mục còn sản phẩm, tooltip ghi rõ: "Còn N sản phẩm, không xóa được" (AdminIconButton disabled vẫn hiện tooltip khi hover nhờ wrapper `group`).
- Danh mục trống: bấm mở hộp xác nhận `<dialog>` (căn giữa, `m-auto`) — "Xóa danh mục …? Danh mục sẽ bị xóa hẳn và không khôi phục được." — xác nhận mới xóa. **Không có xóa cưỡng bức**: xóa danh mục còn sản phẩm sẽ làm sản phẩm mồ côi (`Product.categoryId` bắt buộc).
- Máy chủ kiểm lại số sản phẩm ngay trong `deleteAdminCategory` (không tin con số từ giao diện): nếu vừa có sản phẩm mới chen vào thì từ chối với lỗi "Danh mục còn N sản phẩm, không xóa được." hiển thị trong hộp thoại.
- **Lưu ý về seed:** danh mục đã xóa sẽ KHÔNG bị seed dựng lại ở lần deploy sau — seed có chặn (chỉ chạy khi DB trống, theo sửa mục 1 Ngày 10) — nên xóa là xóa hẳn.

### Kiểm chứng (độc lập, 25/11 ~20:45–21:10, CDP trên server standalone cổng 3000, Chrome headless + `--blink-settings=primaryHoverType=2`)

- Unit test **192/192 PASS** (185 cũ + 7 mới `category-validation.test.ts`); test:db **16/16 PASS** (10 cũ + 6 mới `categories.db.test.ts`: tạo + đọc lại, trùng slug → conflict, sửa tên/slug, xóa bị chặn khi còn 1 sản phẩm, xóa được khi trống, xóa id không tồn tại → not-found); typecheck 0 lỗi; lint 0 lỗi, 0 cảnh báo (đã sửa 2 warning `prevState`/`formData` thừa trong `deleteCategoryAction` bằng cách bỏ hẳn tham số state — action xóa chỉ cần id); build OK; First Load JS `/` = **115 kB** (≤ 135 kB).
- **Danh sách:** 4 danh mục, số sản phẩm đúng DB: Hoa tươi 13, Giỏ trái cây 3, Hộp trái cây 2, Lan hồ điệp 3; thứ tự 1–4. **Sidebar:** "Danh mục" là link thật tới `/admin/categories`, không còn huy hiệu "Sắp có"; còn 24 huy hiệu "Sắp có" (12 mục × desktop + drawer) — trước đợt này là 26.
- **Xóa bị khóa:** danh mục "Hoa tươi" — nút thùng rác `disabled: true`, tooltip "Còn 13 sản phẩm, không xóa được". **Xóa trống (qua popup xác nhận):** danh mục test tạo ra để kiểm — hộp xác nhận căn giữa, bấm "Xóa danh mục" → biến mất khỏi danh sách (8 hàng = 4 danh mục × 2 chế độ hiển thị), DB xác nhận đã xóa.
- **Thêm qua popup:** bấm "+ Thêm danh mục" → dialog mở, tâm x = 720 = đúng giữa viewport 1440; gõ tên "Danh Mục Test CDP" → slug tự thành "danh-muc-test-cdp"; lưu → quay lại danh sách, 10 hàng (5 danh mục × 2), hàng mới có nút thùng rác BẬT ("Xóa danh mục").
- **Sửa qua popup:** bấm bút chì danh mục test → dialog "Sửa danh mục Danh Mục Test CDP", căn giữa, form nạp sẵn (tên, slug, thứ tự 0); đổi tên thành "Danh Mục Test Đã Sửa", lưu → về danh sách, hàng đã sửa hiện đúng; URL quay lại `/admin/categories`.
- **Trang trực tiếp:** vào thẳng `/admin/categories/new` → trang form đầy đủ, h1 "Thêm danh mục", không có dialog.
- **Mobile 390 px:** `scrollWidth 390 = innerWidth 390`, không tràn ngang; topbar đo được: hamburger x=16 rộng 30, chuông x=186 rộng 30, Đăng xuất x=276 rộng 98 — không chồng nhau.
- **Mắt kiểm ảnh (xem `~/workspace/`):** `admin-categories-list-1440.png` (bảng 4 danh mục, "Danh mục" xanh dương trong sidebar không còn "Sắp có", nút thùng rác mờ ở các hàng còn sản phẩm), `admin-categories-modal-1440.png` (popup "Sửa danh mục Danh Mục Test CDP" căn giữa, 3 trường nạp sẵn, phía sau là bảng với hàng test có thùng rác đỏ đang bật), `admin-categories-list-390.png` (thẻ mobile 4 danh mục, gọn, không tràn).
- **Sự cố lúc kiểm (lỗi của kịch bản kiểm, không phải của app):** kịch bản kiểm đợt 2 dùng `document.querySelector("dialog")` trong khi trang có nhiều `<dialog>` (mỗi danh mục trống có một hộp xác nhận xóa riêng) nên bấm nhầm form xóa thay vì form sửa — danh mục test bị xóa sớm. Đã kiểm lại toàn bộ bằng kịch bản mới, chọn dialog theo `aria-label` ("Sửa danh mục…", "Xác nhận xóa…") — thêm/sửa/xóa đều chạy đúng như trên. Bài học ghi lại: khi trang có nhiều `<dialog>`, luôn chọn theo `aria-label`, không dùng `querySelector("dialog")` trần.
- **Dọn dẹp:** danh mục test đã xóa qua chính tính năng xóa (DB xác nhận); chỉ xóa 5 phiên admin do CDP đăng nhập tạo ra bằng `npx tsx scripts/clean-test-data.ts --delete --only=seed,sessions`. DB cuối đợt: **3 đơn mẫu NEW/UNPAID (0Z2DZBQNTJ, 1N0PEZH0J7, QAFNN907ZY), 21 sản phẩm, 4 danh mục, 4 khu vực, 0 phiên admin, 0 lần đăng nhập sai**.
