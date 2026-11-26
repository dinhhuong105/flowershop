# Báo cáo Ngày 12 — Kết Ngày 11 + Ngân hàng & QR từng đơn + Khu vực & phí + Telegram

Nền: commit a249ec2. Đặc tả: ~/workspace/ngay-12-dac-ta.md (87 dòng, md5 b1a9c118bb97903507acd436c208dd0b — đã đọc nguyên văn).
Link live: https://flowershop-steel.vercel.app/

## Kiểm kê B0 — Thông tin ngân hàng & QR hiện tại (chỉ đọc, 26/11 ~09:4x)

**Thông tin ngân hàng nằm ở BIẾN MÔI TRƯỜNG, không ở DB:**
- `src/lib/bank.ts` — `getBankInfo()` đọc 4 biến: `BANK_BIN`, `BANK_NAME`, `BANK_ACCOUNT`, `BANK_ACCOUNT_NAME`. Thiếu/bất kỳ trường nào sai định dạng (BIN đúng 6 chữ số, STK 6–19 chữ số, tên chủ TK không rỗng) → trả `null` → `isBankConfigured()` = false → ẩn "Chuyển khoản".
- Danh sách ngân hàng ĐÃ CÓ trong code: `BANK_NAMES` trong `src/lib/bank.ts` (14 BIN, đã kiểm chứng chéo từ danh mục VietQR/NAPAS: vietqr.io, vnqr, vietqr_gen — cả ba khớp nhau; K-9: tên hiển thị lấy theo BIN, 970415 = VietinBank, 970436 = Vietcombank). Ngày 12 dùng lại bảng này, KHÔNG lấy danh sách mới, KHÔNG gõ BIN từ trí nhớ.
- Không có khóa `bank.*` nào trong `site_settings` (DB local hiện 12 khóa general + contact).

**Hàm tạo QR — `src/lib/vietqr.ts`:**
- `buildVietQrPayload(input: { bin, account, amount, content })` — tự dựng payload EMVCo/NAPAS 247 + CRC16-CCITT-FALSE, không gọi dịch vụ ngoài.
- Giới hạn THỰC TẾ của hàm hiện có: BIN đúng 6 chữ số; STK 6–19 chữ số; số tiền số nguyên dương; nội dung CHỈ ký tự ASCII, 1–25 ký tự (vượt 25 → throw "Nội dung chuyển khoản tối đa 25 ký tự."). Đây là giới hạn đặc tả B1 yêu cầu kiểm lại — khớp: kết quả cuối ≤ 25 ký tự.
- `transferContent(orderCode)` trong `src/lib/bank.ts`: `"DH " + mã đơn` (13 ký tự ASCII, trong giới hạn 25).

**Trang đặt hàng khi chọn "Chuyển khoản":**
- `src/app/checkout/page.tsx:28` — `bankConfigured = isBankConfigured()` (từ env), truyền vào `CheckoutForm` (prop `bankConfigured`).
- `src/app/actions/order.ts:103` — server kiểm lại: `paymentMethod === "BANK_TRANSFER" && !isBankConfigured()` → từ chối tạo đơn (không tin client).
- Chưa cấu hình thì lựa chọn "Chuyển khoản" bị ẩn (chỉ còn COD) — hành vi hiện hữu, Ngày 12 giữ nguyên nhưng nguồn đọc chuyển sang `getSettings()` (B4).

**Trang đơn khi đã chọn "Chuyển khoản":**
- `src/app/order/[code]/page.tsx:34,96` — `bank = getBankInfo()` (env); nếu có bank thì render `BankTransferBox` với `amount = order.total`, `content = transferContent(order.code)`.
- `src/components/order/BankTransferBox.tsx` — QR SVG sinh từ payload (thư viện `qrcode`, `QRCode.toString(payload, {type: "svg"})`); hiển thị Ngân hàng / Số tài khoản / Chủ tài khoản / Số tiền / Nội dung chuyển khoản, mỗi trường có nút "Sao chép".
- `src/app/admin/orders/[code]/page.tsx:251` — chi tiết đơn (admin) cũng hiện nội dung chuyển khoản `transferContent(order.code)`.
- Đơn cũ: đơn KHÔNG lưu lại thông tin ngân hàng/STK đã hiển thị lúc đặt (bảng `orders` không có cột bank). QR + nội dung trên trang đơn được dựng lại từ cấu hình HIỆN TẠI mỗi lần mở trang. Nghĩa là đổi STK trong admin → trang đơn cũ sẽ hiện QR/STK MỚI (không giữ bản chụp lúc đặt). Ghi nhận theo B4 (không tự sửa schema đơn khi chưa hỏi).

**Telegram hiện tại:**
- `src/lib/telegram.ts:133-134` — token + chat id đọc từ env `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`; thiếu thì bỏ qua im lặng, đơn vẫn tạo bình thường (D4 đã là hành vi hiện hữu).
- `src/lib/admin/orders.ts:571-572` — nút "Gửi lại Telegram" ở chi tiết đơn dùng cùng 2 biến env; `src/app/admin/orders/[code]/page.tsx:85-86` — nút chỉ hiện khi cả hai env đều có giá trị.
- Chưa có khóa `telegram.*` nào trong `site_settings`.

## Kiểm kê C0 — Khu vực & phí giao hàng (chỉ đọc, 26/11 ~09:4x)

**Bảng `shipping_zones` hiện có 5 cột:** `id`, `name` (duy nhất), `fee` (Int, VND), `isActive` (Boolean, mặc định true), `sortOrder` (Int, mặc định 0). KHÔNG có cột khung giờ hay ngưỡng miễn phí.

**ĐIỀU KIỆN DỪNG KHÔNG KÍCH HOẠT — phần C được làm tiếp:**
- Đơn LƯU SẴN phí giao tại thời điểm đặt: `orders.shippingFee` (Int) + `orders.area` (tên khu vực tại thời điểm đặt) + `orders.deliverySurcharge`. `src/lib/order.ts:131-132` — `const shippingFee = zone.fee;` rồi ghi vào đơn (dòng 164); tổng tiền chốt luôn tại lúc tạo đơn. Đổi phí khu vực sau đó KHÔNG làm lệch đơn cũ.
- Server đã chặn khu vực đã tắt: `src/lib/order.ts:126` (`!zone || !zone.isActive` → lỗi "Khu vực giao hàng không khả dụng.") và `src/app/actions/order.ts:82` (kiểm lại trước khi tạo đơn).
- Trang đặt hàng đã chỉ liệt kê khu vực đang bật: `src/app/checkout/page.tsx:24` — `where: { isActive: true }`.

**Phát hiện quan trọng cho C1:** cột `isActive` ĐÃ TỒN TẠI từ migration khởi tạo `20261121113203_init` (cả schema lẫn DB đều có, mặc định true) — đặc tả C1 nói "migration thêm isActive" là thừa. Ngày 12 KHÔNG tạo migration mới cho cột này (không có gì để thêm); chỉ xây trang quản trị bật/tắt + xóa theo quy tắc. Ghi vào "Độ lệch".
- Trạng thái DB local: 4 khu vực đều đang bật (trung tâm 25.000đ, lân cận 35.000đ, xa 50.000đ, ngoại thành 70.000đ); cả 3 đơn mẫu đều ở "Khu vực trung tâm" (khu vực 1 có 3 đơn → không xóa được; khu vực 2–4 có 0 đơn → xóa được).

## Kết quả từng mục

- **A1 — Pi Em đang kiểm trực tiếp.** Henry xác nhận 26/11 ~10:09 ĐÃ TẠO Blob store. Theo chỉ đạo của Pi Em, mình KHÔNG thử upload live: Pi Em tự làm toàn bộ (redeploy qua Vercel dashboard + kiểm upload + kiểm lại sau deploy Ngày 12 + gỡ ảnh thử). A3 vẫn chờ Henry tạo nhánh Neon.
- **A2 — ĐẠT.** Unit test nhánh chọn adapter: Vercel + không token → ném lỗi "Chưa cấu hình nơi lưu ảnh (Blob)" (`src/lib/storage.test.ts:161`). Kiểm live trên server thứ hai với `VERCEL=1` (port 3001, không token): trang Cài đặt Chung hiện cảnh báo vàng đúng câu chữ; POST `/api/admin/settings/upload` trả 500 + đúng thông báo (không ghi disk, không crash).
- **A3 — CHƯA ĐẠT.** Chờ Henry tạo nhánh Neon snapshot (mình không làm được).
- **A4 — ĐẠT.** Ô xem trước favicon nới rộng 80px; "Chưa có ảnh" còn 1–2 dòng (ảnh `ngay-12-general-1440.png` + `ngay-12-blob-warning-1440.png`).
- **B1 — ĐẠT.** Validation: STK chỉ chữ số 6–19 ký tự; tên chủ TK in hoa không dấu 2–50 ký tự; mẫu nội dung chỉ `{ORDER_CODE}` + chữ/số/khoảng trắng, ≤ 50 ký tự, kết quả cuối ≤ 25 ký tự (giới hạn VietQR thực tế đã kiểm lại ở B0). Unit tests kèm theo.
- **B2 — ĐẠT.** Trang `/admin/settings/bank` + xem trước QR từ chính dữ liệu đang nhập (số tiền mẫu 100.000 ₫ + mã đơn mẫu 0123456789), nhãn "QR mẫu — không dùng để thu tiền". STK hiện dạng che (`****7890`) khi mở lại trang; input ẩn giữ số thật; nút Hiện/Ẩn. Kiểm bằng CDP (QR SVG + đủ nội dung VietinBank/100.000 ₫/DH 0123456789) + mắt kiểm ảnh.
- **B3 — ĐẠT.** Lưu bank đòi nhập lại mật khẩu admin (đúng hàm xác thực của đăng nhập, chung giới hạn 5 lần sai/15 phút). Sai mật khẩu → không lưu + giữ nguyên mọi giá trị đã nhập (CDP); chưa đăng nhập → 307 `/login` (smoke-live). Audit ghi khóa + giá trị cũ/mới đã che + ai + lúc nào (STK chỉ hiện `****7890`, số cũ che `****`). Gửi 1 tin Telegram cho chủ shop mỗi khi nhóm bank đổi (không kèm số đầy đủ); Telegram lỗi thì không chặn lưu — ghi vào audit (`bank.notify` = "failed: ...") và hiện trong thông báo lưu.
- **B4 — ĐẠT.** Mặt shop đọc từ `getSettings()`; bank chưa đủ hoặc `enabled=false` thì ẩn "Chuyển khoản" (chỉ còn COD), không hiện STK demo (CDP: checkout có "Chuyển khoản" khi bật; tắt thì mất — kiểm qua vòng B3). Đơn cũ: hệ thống KHÔNG lưu thông tin bank lúc đặt (ghi nhận ở B0) — đổi STK đổi QR trên đơn cũ; không sửa schema đơn khi chưa hỏi.
- **C1 — ĐẠT.** Không xóa cứng khu vực đã có đơn (server kiểm lại số đơn; nút khóa kèm lý do "Đã có N đơn, không xóa được" — CDP: khu vực trung tâm 3 đơn bị khóa); khu vực chưa có đơn mới xóa được (CDP: thêm → xóa khu vực test thành công). Xem "Độ lệch" về migration `isActive`.
- **C2 — ĐẠT.** Trang `/admin/shipping-zones` theo mẫu Danh mục (bảng desktop + thẻ mobile); thêm/sửa dạng popup (intercepting route `@modal`, `ProductModal` căn giữa — CDP: bấm link → modal mở; sửa phí 50.000 → 55.000 → 50.000 qua popup); bật/tắt không cần xác nhận kèm toast Hoàn tác (CDP: tắt → "Đã tắt khu vực" → Hoàn tác → "Đã bật lại khu vực"); menu "Khu vực & phí giao hàng" thành mục thật.
- **C3 — ĐẠT.** Mặt shop chỉ liệt kê khu vực `isActive` (CDP: tắt "lân cận" → checkout còn 3 khu vực; bật lại → 4). Đổi phí trong admin thì đơn mới dùng phí mới ngay, đơn cũ không đổi tổng tiền (test:db C4 + kiểm kê B0/C0: đơn lưu sẵn `shippingFee` + `area`).
- **C4 — ĐẠT.** test:db 3 trường hợp: tắt khu vực không đổi tổng đơn cũ; xóa khu vực có đơn bị từ chối; đặt đơn ở khu vực đã tắt bị từ chối ở server (nằm trong 30 test db).
- **D1–D5 — ĐẠT (trừ tiêu chí nhận tin thật của Henry).** Nhóm cài đặt Telegram + trang `/admin/settings/telegram` + nút "Gửi thử"; token KHÔNG BAO GIỜ lưu DB/UI/log — chỉ báo "Đã có token / Chưa có token" (CDP: hiện "Chưa có token"). Thông báo đơn đọc chatId từ cài đặt, fallback env khi trống; nút "Gửi lại Telegram" ở chi tiết đơn tiếp tục chạy; Telegram lỗi không làm hỏng đặt đơn (D4 — hành vi hiện hữu từ trước + test). "Gửi thử" khi chưa có token → báo rõ lý do, không crash. Tiêu chí D "Henry bấm Gửi thử và nhận tin thật" = **CHƯA KIỂM TRA** (cần token thật của Henry).
- **E1 — ĐẠT.** Ảnh 1440 + 390 cho 3 trang mới, popup khu vực, QR mẫu, cảnh báo thiếu Blob — 10 ảnh trong `~/workspace/ngay-12-*.png`, đã mắt kiểm từng ảnh (không tràn ở 360: `scrollWidth == clientWidth == 345` cả 4 trang).
- **E2 — ĐẠT.** `scripts/smoke-live.sh` thêm 3 mục chưa đăng nhập → 307 `/login` cho 3 trang mới (12 → 15 mục). Chạy local: **14/15** — FAIL duy nhất là sitemap còn localhost, đúng kỳ vọng trên localhost (trên production kỳ vọng 15/15).
- **E3 — ĐẠT.** Đếm trực tiếp từ `AdminNav.tsx` (`soon: true`): còn **9** mục "Sắp có" — Bài viết / Tin tức, Trang tĩnh, Yêu cầu liên hệ, Khách hàng, Tin nhắn, Tài khoản quản trị, Vai trò & phân quyền, Nhật ký hoạt động, Cài đặt SEO. Ngày 12 biến 3 mục thành thật: Khu vực & phí giao hàng, Ngân hàng & QR, Telegram.

## Kiểm chứng

- `npm test`: **251/251 PASS**; `npm run test:db`: **30/30 PASS**; `typecheck`: 0 lỗi; `lint`: 0 lỗi (2 warning `<img>` có từ trước ở `Header.tsx`); `build`: OK; First Load JS `/` = **115 kB** (≤ 135 kB); `/admin/settings/bank` = 133 kB (thư viện `qrcode`).
- CDP (trình duyệt thật, server standalone port 3000): vòng 2 **18/24 PASS**, vòng 3 **7/8 PASS**, probe QR **PASS**, probe A2 (server `VERCEL=1` port 3001) **PASS**, probe form-reset sau sửa **PASS**. Mọi FAIL trong các vòng đều là lỗi script kiểm (đã sửa + kiểm lại), trừ 1 lỗi app thật (form reset — xem "Độ lệch", đã sửa + kiểm lại).
- `scripts/smoke-live.sh http://localhost:3000`: **14/15** (sitemap-localhost FAIL đúng kỳ vọng).
- Ảnh: 10 file `~/workspace/ngay-12-*.png` (bank-qr-1440, bank-sai-mat-khau-1440, telegram-1440, zones-1440, zones-popup-1440, general-1440, blob-warning-1440, bank-390, telegram-390, zones-390) — đã mắt kiểm từng ảnh.
- DB local cuối vòng (đã dọn): 3 đơn mẫu / 21 sản phẩm / 4 danh mục / 4 khu vực (25.000/35.000/50.000/70.000₫, đều bật) / 0 phiên / 19 dòng settings (về mặc định) / 0 audit / 0 giỏ.

## Độ lệch

1. **C1 "migration thêm `isActive`" là thừa** — cột `isActive` đã tồn tại từ migration khởi tạo `20261121113203_init` (schema + DB đều có, mặc định true). Ngày 12 KHÔNG tạo migration mới cho cột này; chỉ xây trang quản trị bật/tắt + xóa theo quy tắc.
2. **B1 mẫu nội dung mặc định là `"DH {ORDER_CODE}"`**, khác đặc tả (`{ORDER_CODE}`) — giữ đúng nội dung chuyển khoản hiện hành của shop từ Ngày 5 (13 ký tự, trong giới hạn VietQR 25 ký tự) để shop không đổi khi seed.
3. **Lỗi phát hiện khi kiểm CDP, đã sửa trong vòng này (26/11 ~10:3x): React reset form sau mỗi lần `useActionState` hoàn tất, làm `<select>` ngân hàng và checkbox bật/tắt mất về giá trị lúc mở trang** (text input thì giữ được nhờ cơ chế theo dõi giá trị của React). Hậu quả thực tế trước khi sửa: nhập sai mật khẩu 1 lần rồi nhập đúng → lưu bank với `bankCode` rỗng (mất ngân hàng đã chọn) và `bankEnabled=false` — đã xác nhận bằng probe + audit DB. Đã sửa: `BankSettingsForm` + `TelegramSettingsForm` gửi bằng `dispatch(new FormData(form))` trực tiếp thay vì native submit (kèm `reportValidity()` để giữ kiểm tra `required`); đã kiểm lại bằng CDP: sai mật khẩu → giữ nguyên mọi giá trị + FormData đúng; đúng mật khẩu → lưu đúng + giữ nguyên sau lưu. Form General/Contact (Ngày 11) không bị lỗi này: chỉ có text input (React tự khôi phục sau reset) — đã kiểm chứng CDP lưu xong ô nhập giữ tên mới.
4. **Khu vực "lân cận" bị xóa nhầm 1 lần trong vòng kiểm CDP đầu tiên** (script kiểm chọn nhầm dialog xóa của khu vực khác — dialog đầu tiên trong DOM, không phải dialog của khu vực test) — đã khôi phục bằng tay (thêm lại đúng tên/phí/thứ tự 35.000₫/2, đang bật) và sửa script (dialog xác định theo tên khu vực); vòng kiểm sau xác nhận đủ 4 khu vực đúng phí. Không ảnh hưởng dữ liệu thật (đơn mẫu đều ở khu vực trung tâm).

## Phần bị chặn / chưa kiểm tra

- **A1 — Pi Em đang kiểm trực tiếp.** Henry xác nhận 26/11 ~10:09 ĐÃ TẠO Blob store. Mình KHÔNG thử upload live (theo chỉ đạo của Pi Em): Pi Em tự làm redeploy qua Vercel dashboard + kiểm upload + kiểm lại sau deploy Ngày 12 + gỡ ảnh thử.
- **A3 — CHƯA ĐẠT.** Chờ Henry tạo nhánh Neon snapshot (mình không làm được).
- **Dữ liệu thật (ngân hàng, khu vực/phí thật, chat id Telegram, token bot): Henry tự nhập sau.** Seed bank chỉ khi bảng trống, bằng đúng giá trị env hiện hành, enabled giữ như hiện trạng. KHÔNG bịa STK/tên chủ TK/số điện thoại nào. Danh sách ngân hàng dùng `BANK_NAMES` đã có trong code (14 BIN đã kiểm chứng VietQR/NAPAS).
- **Tiêu chí D "Henry bấm Gửi thử và nhận tin thật": CHƯA KIỂM TRA** (cần token bot thật của Henry).
- **Đơn cũ giữ nguyên thông tin bank lúc đặt: KHÔNG.** Hệ thống không lưu thông tin ngân hàng vào đơn (bảng `orders` không có cột bank) — đổi STK trong admin thì trang đơn cũ hiện QR/STK mới. Ghi nhận theo B4; không tự sửa schema đơn khi chưa hỏi.
