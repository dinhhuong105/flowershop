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
