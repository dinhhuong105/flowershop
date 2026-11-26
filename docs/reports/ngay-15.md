# Báo cáo Ngày 15 — Nhật ký hoạt động + 3 điểm kỹ thuật tồn đọng

- Ngày: 26/11/2026.
- Nền: commit `f750c78` (Ngày 14).
- Commit Ngày 15: 1 commit trên `f750c78` (lấy hash đầy đủ bằng `git log`) + 1 commit sửa lint (bỏ hàm `pageValues` thừa trong test, xem "Sự cố").
- Phạm vi theo đặc tả: Phần B (B1 → B2 → B3) trước, Phần C (C0 → C1 → C2), rồi B4; Phần D (B6, E2) KHÔNG LÀM — hết giờ sau khi kiểm chứng đầy đủ, chuyển ngày sau (đặc tả cho phép). Phần A chỉ ghi trạng thái (chỉ đọc). Phần G KHÔNG ÁP DỤNG.
- Link live (mọi báo cáo cho Claude đều kèm): https://flowershop-steel.vercel.app/

## Kiểm kê đầu ngày

### C0 — Khóa hiện ghi trong `settings_audit` (đọc code, 26/11)

Bảng ghi đủ ai làm (`updatedBy` = `"admin"`), thời gian (`createdAt`), giá trị cũ/mới (`oldValue`/`newValue`). STK che lúc ghi (chỉ giữ 4 số cuối).

| Nơi ghi | Khóa | Giá trị cũ → mới |
|---|---|---|
| `saveSettingsToDb` (`src/lib/settings.ts`) — chỉ ghi khóa ĐÃ ĐỔI, trong 1 transaction | `general.siteName`, `general.slogan`, `general.logo`, `general.favicon` | giá trị cũ (hiệu dụng) → mới; STK qua `auditValueFor` |
| | `contact.hotline`, `contact.zalo`, `contact.email`, `contact.address`, `contact.openHours`, `contact.facebook`, `contact.instagram`, `contact.tiktok` | như trên |
| | `bank.bankCode`, `bank.accountNumber`, `bank.accountName`, `bank.transferNoteTemplate`, `bank.enabled` | như trên; riêng `accountNumber` che lúc ghi thành `****` + 4 số cuối |
| | `telegram.chatId`, `telegram.enabled` | như trên (token bot Telegram KHÔNG nằm trong settings — chỉ ở biến môi trường, không bao giờ vào audit) |
| | `seo.titleTemplate`, `seo.defaultDescription`, `seo.defaultOgImage`, `seo.metaKeywords`, `seo.allowIndexing` | như trên |
| `recordSettingsAudit` (`src/lib/settings.ts`) | `bank.notify` | `null` → `"sent"` / `"failed: …"` (kết quả gửi tin Telegram khi nhóm bank đổi) |
| `createAdminPage` / `updateAdminPage` / `deleteAdminPage` / `setAdminPagePublished` (`src/lib/admin/pages.ts`) | `page:<slug>` | tạo: `null` → `"created"`; sửa: tiêu đề cũ → `"updated"` (+ dòng riêng khi đổi `legacyPath`); xóa: tiêu đề cũ → `"deleted"`; bật/tắt xuất bản: `"draft"` ↔ `"published"` |

Lịch sử trạng thái đơn nằm riêng ở `order_events` — KHÔNG thuộc phạm vi C1.

### B3 — Đo số truy vấn bảng `pages` (ghi query Prisma ở môi trường test, `PRISMA_LOG_QUERIES=1`)

Đếm theo từng request (đo 2 lần mỗi URL, ổn định cả 2 lần).

| URL | Tra trang theo slug (trước) | Tra trang theo slug (sau) | Tổng truy vấn bảng `pages` (trước → sau) |
|---|---|---|---|
| GET `/hoa-tuoi` (danh mục) | 2 (`generateMetadata` + render) | **1** | 4 → 3 |
| GET `/gioi-thieu` (trang tĩnh đã xuất bản) | 2 (`generateMetadata` + render) | **1** | 4 → 3 |

2 truy vấn còn lại vào bảng `pages` ở cả trước và sau là tra chân trang (`showInFooter`) + tra trang thay thế đường dẫn cũ (`legacyPath`) từ root layout — không thuộc phạm vi B3, không đổi. Hàm tra dùng chung `getPublishedPageBySlugCached` bọc `React.cache()` (`src/lib/admin/pages.ts`), dùng ở cả 2 chỗ trong `src/app/[category]/page.tsx`.

### A — Việc của Henry (chỉ đọc, 26/11)

- A1 Blob: store `flowershop-blob` đã Public + đã nối project (xác nhận bằng ảnh chụp Vercel 20:35), NHƯNG bản live chưa redeploy sau khi nối nên test tải ảnh live thất bại 20:30–20:37 ("Không lưu được ảnh, vui lòng thử lại.") → **chờ Henry redeploy** (Deployments → bản mới nhất → Redeploy). KHÔNG chạy lại test upload live cho tới lúc đó.
- A3 Neon: Henry báo đã tạo nhánh `snapshot-2026-11-26` lúc 20:44. Ghi chú bộ nhớ (cập nhật ngoài phiên này) ghi "Neon snapshot verified" — kiểm chứng chính thức thuộc về phía cha; trong phiên này chỉ ghi theo báo cáo của Henry.
- A4 Telegram: chưa có token → **KHÔNG KIỂM**.
- Phần G (dọn demo): **KHÔNG ÁP DỤNG** — chưa đủ điều kiện (A1 + A3 + sản phẩm thật + ảnh thật + Henry duyệt SKU).

## Kết quả từng mục

| Mục | Kết quả | Ghi chú |
|---|---|---|
| A1 Blob Public + redeploy | CHỜ HENRY | Xem trên. |
| A3 Neon snapshot + branch | HENRY BÁO ĐÃ TẠO | Xem trên. |
| A4 Telegram thật | KHÔNG KIỂM | Chưa có token — ghi rõ, không tính đạt. |
| B1 Va chạm slug 2 chiều | ĐẠT | Danh mục trùng slug trang tĩnh (nháp hay đã xuất bản) → từ chối, lỗi đúng ô slug; xuất bản trang trùng slug danh mục (nút mắt) → từ chối, lỗi hiện dưới nút; `RESERVED_SLUGS` giữ ở cả 2 bên + test đủ bộ `trang`, `admin`, `cart`, `checkout`, `search`; script chỉ đọc `scripts/check-slug-collisions.ts` chạy local: **0 cặp trùng** (4 danh mục, 3 trang); quy tắc ưu tiên (trang tĩnh đã xuất bản thắng danh mục ở route gốc) viết rõ trong code (`[category]/page.tsx`) + README + test khóa hành vi. |
| B2 Cảnh báo thay `/contact`, `/faq`, `/policy` | ĐẠT | Hộp vàng đúng câu nguyên văn từng trang (`/contact`, `/faq`, `/policy` giữ cảnh báo cũ đủ 4 mục); bắt buộc tick "Tôi hiểu", lỗi đúng ô `confirmReplace`, không tick → không lưu, bỏ tick → lỗi lại; `/about` không hỏi xác nhận; server kiểm lại ở `create/updateAdminPage` (không chỉ giao diện). |
| B3 Tra trang tĩnh 1 lần/request | ĐẠT | `React.cache()`; bảng đo ở trên: tra slug 2 → 1 mỗi request; `<head>` giống hệt nền (xem "Kiểm chứng"). |
| B4 Tách câu cảnh báo ngân hàng | ĐẠT | Chỉ tắt "Bật thanh toán chuyển khoản" → câu "N đơn chuyển khoản chưa thu sẽ không còn hiển thị mã QR"; đổi STK (hoặc đổi khác) → giữ câu cũ "… sẽ hiển thị QR mới"; cả hộp vàng trên form lẫn thông báo sau khi lưu đều dùng chung cách chọn câu. |
| C0 Kiểm kê | ĐẠT | Xem trên. |
| C1 Trang `/admin/activity` | ĐẠT | Bảng Thời gian (giờ VN `dd/MM/yyyy HH:mm`), Người, Khu vực (Chung / Liên hệ / SEO / Ngân hàng / Telegram / Trang tĩnh), Khóa, Cũ → mới (che + cắt 60 ký tự); lọc Khu vực + tìm theo khóa/người + khoảng ngày (giờ VN) + phân trang **20/trang**; chỉ đọc (không sửa/xóa); chưa đăng nhập → 307 `/login`; migration thêm chỉ mục `settings_audit(createdAt)`; menu "Nhật ký hoạt động" thành mục thật dưới nhóm Cài đặt; còn **6** mục "Sắp có" (Bài viết, Yêu cầu liên hệ, Khách hàng, Tin nhắn, Tài khoản quản trị, Vai trò & phân quyền). |
| C2 Kiểm C | ĐẠT | Test thuần + test:db + CDP + smoke (xem "Kiểm chứng"). |
| B6 Xem trước Markdown 2 cột | KHÔNG LÀM | Chuyển ngày sau — ưu tiên thấp, hết giờ sau khi kiểm chứng đầy đủ B1–B4 + C. |
| E2 Log sản phẩm/danh mục/khu vực | KHÔNG LÀM | Chuyển ngày sau (phụ thuộc E1 đã xong nhưng hết giờ; xem độ lệch 5). |
| G Dọn demo | KHÔNG ÁP DỤNG | Chưa đủ điều kiện (xem A). |

## Độ lệch (so với đặc tả Ngày 15)

1. **B2 — tick lại mỗi lần lưu.** Đặc tả: "khi chọn một trong ba đường dẫn này để thay, bắt buộc tick 'Tôi hiểu' trước khi lưu". Quy tắc đã làm: mỗi lần lưu với một trong ba đường dẫn đều phải tick lại, kể cả sửa trang đã thay trước đó (checkbox không bao giờ tick sẵn). Lý do: đơn giản, kiểm được ở cả form lẫn server bằng cùng một quy tắc, không cần nhớ trạng thái cũ; ma sát nhỏ (một tick) đổi lại xác nhận luôn đúng lúc.
2. **C1 — ngưỡng che khi hiển thị là dãy ≥ 8 chữ số.** Đặc tả: "che lại lúc hiển thị nếu còn sót (quét dãy số dài)" nhưng không cố định độ dài. Đã chọn ≥ 8 chữ số (kể cả có khoảng trắng/gạch nối xen giữa) → chỉ giữ 4 số cuối. Hệ quả: số điện thoại 10 số (vd hotline) cũng hiện che (`****4567`); đổi hotline vẫn kiểm được qua khóa + khu vực + thời gian. Token bot không bao giờ vào audit (chỉ ở biến môi trường) nên không có gì để lộ qua đường này.
3. **B3 — bảng đo ghi thêm tổng truy vấn bảng `pages`.** Đặc tả yêu cầu đếm "số truy vấn vào bảng `pages`"; bảng ở trên ghi cả hai số: tra theo slug (2 → 1, đúng chỗ trùng lặp) và tổng bảng `pages` (4 → 3). 2 truy vấn còn lại là của root layout, ngoài phạm vi B3.
4. **C2 — test:db phân trang đúng 31 dòng như ví dụ đặc tả** (trang 1: 20, trang 2: 11), thay vì 35 dòng ở bản nháp đầu.
5. **E2 chuyển ngày sau cùng B6.** Đặc tả xếp B6 + E2 vào "nếu còn thời gian"; sau khi kiểm chứng đầy đủ B1–B4 + C (kể cả sửa 3 lỗi do probe phát hiện — xem "Sự cố") thì hết giờ. Không làm dở.

## Kiểm chứng

- Unit: **313/313 PASS** (Ngày 14: 298; +15: activity 10, bank-warning 2, page-validation 2, category-validation 1).
- test:db: **56/56 PASS** (Ngày 14: 42; +14: slug-collision 4, activity 6, pages-legacy B2 4). Đúng trình tự: `recreate-test-data` → `test:db` → `clean-test-data --delete`.
- Typecheck: **0 lỗi**. Lint: **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`) — bản đầu có thêm 1 warning biến thừa `pageValues` trong `slug-collision.db.test.ts`, đã bỏ hàm thừa ở commit sửa lint sau đó, chạy lại lint còn đúng 2 warning.
- Build: OK. First Load JS `/` = **115 kB** (≤ 135 kB, như Ngày 14); `/admin/activity` = 106 kB.
- Smoke local (`scripts/smoke-live.sh http://localhost:3000`): **20/21 PASS** — FAIL duy nhất là sitemap-localhost (SITE_URL là http://localhost:3000 ở local; trên production sẽ PASS — giống Ngày 14). Check mới PASS: `/admin/activity` chưa đăng nhập → 307 `/login`.
- CDP (headless Chrome 158, server standalone :3000, phiên admin tạo trực tiếp trong DB local): **26/26 PASS** — B1a popup Thêm danh mục (lỗi đúng ô + giữ giá trị), B1b toggle xuất bản trang trùng (lỗi dưới nút), B2a hộp vàng `/contact` nguyên văn + không tick → lỗi + giữ giá trị + bỏ tick → lỗi lại + tick → lưu được, B2b `/about` không hộp vàng/không checkbox, B4a đổi STK → câu cũ + B4b chỉ tắt công tắc → câu mới (N = 1 đơn chuyển khoản chưa thu), C1a đổi hotline, C1b sửa ngân hàng có nhập lại mật khẩu (mật khẩu thử local — xem "Sự cố"), C1c xuất bản rồi gỡ xuất bản trang, C1d `/admin/activity` 1440 + 390 (dòng `contact.hotline`, dòng `bank.accountNumber` đã che `****9012 → ****1098`, dòng `page:gioi-thieu`, không lộ STK đầy đủ, lọc Khu vực = Ngân hàng chỉ còn dòng ngân hàng).
- So `<head>` với nền Ngày 14 (chuẩn hóa hash, `~/workspace/day15-baseline-heads/` → `~/workspace/day15-after-heads/`): sản phẩm + danh mục + trang chủ + trang tĩnh **giống hệt** (4/4). Lưu ý: lần chụp đầu trang tĩnh lệch đúng 1 dòng title do test:db đổi tiêu đề trang seed — đã sửa test + khôi phục tiêu đề, chụp lại thì giống hệt (xem "Sự cố").
- Script va chạm slug: **0 cặp trùng**.
- DB local sau dọn: products=20, categories=4, orders=0, pages=3 (0 xuất bản, tiêu đề gốc), settings=24, audit=0, sessions=0. **Sạch.**

## Mục chưa làm + lý do

- **B6 xem trước Markdown 2 cột** — chuyển ngày sau (ưu tiên thấp, hết giờ).
- **E2 log sản phẩm/danh mục/khu vực** — chuyển ngày sau (phụ thuộc E1 đã xong, hết giờ).
- **A1 / A3 / A4** — chờ Henry / chưa kiểm như trên; là việc của Henry, không phải code.

## Ảnh đính kèm

- B1: `~/workspace/day15-shots/b1-category-1440.png`, `~/workspace/day15-shots/b1-toggle-1440.png`
- B2: `~/workspace/day15-shots/b2-contact-warning-1440.png`, `~/workspace/day15-shots/b2-contact-notick-1440.png`, `~/workspace/day15-shots/b2-about-1440.png`
- B4: `~/workspace/day15-shots/b4-stk-1440.png`, `~/workspace/day15-shots/b4-disable-1440.png`
- C1: `~/workspace/day15-shots/c1-activity-1440.png`, `~/workspace/day15-shots/c1-activity-390.png`, `~/workspace/day15-shots/c1-activity-bank-1440.png`
- Probe CDP (tái chạy được): `~/workspace/day15-probe.mjs`

## Sự cố trong ngày (ghi lại để lần sau khỏi mất thời gian)

- **`next build` tạo lại toàn bộ `.next/standalone/`** — file `.next/static` + `public` copy vào standalone ở lần build trước bị xóa ở lần build sau. Lần probe CDP đầu chạy với server thiếu CSS/JS (404 mọi chunk): trang hiện dạng HTML trần, không hydrate — form dùng `action={dispatch}` (danh mục, nút mắt) vẫn chạy nhờ progressive enhancement nên B1 PASS, còn form dùng `onSubmit` + `dispatch` (trang tĩnh) submit native → reload trắng → B2/B4/C1 FAIL giả. Sửa: copy lại `.next/static` → `.next/standalone/.next/static` + `public` → `.next/standalone/public` SAU lần build cuối rồi mới khởi động server; chạy lại probe thì 26/26 PASS. Bài học: sau mỗi lần build, kiểm tra `curl /_next/static/css/…` trả 200 trước khi probe.
- **Test:db làm bẩn dữ liệu seed.** `slug-collision.db.test.ts` ban đầu xuất bản trang seed bằng `updateAdminPage` với tiêu đề test ("Trang gioi-thieu") — so `<head>` bắt được ngay (title trang tĩnh lệch 1 dòng). Sửa: xuất bản bằng `setAdminPagePublished` (chỉ đổi cờ) + `after()` trả lại tiêu đề gốc đã lưu từ `before()`. Chạy lại test: 4/4 PASS, tiêu đề seed nguyên vẹn.
- **`bankCode` phải là mã BIN 6 số, không phải mã 3 chữ.** Probe ghi `bankCode='VCB'` vào DB test → lưu ngân hàng báo "Kiểm tra lại các trường tô đỏ." (validate `^\d{6}$`), không phải lỗi mật khẩu — chẩn đoán bằng mini-probe (0 lần thử sai trong `admin_login_attempts` chứng tỏ chưa tới bước kiểm mật khẩu). Sửa: dùng BIN Vietcombank `970436`.
- **Lint warning biến thừa.** `slug-collision.db.test.ts` định nghĩa hàm `pageValues` nhưng không dùng (test xuất bản trang seed bằng `setAdminPagePublished` thay vì tạo trang mới) → lint báo 1 warning thừa. Sửa: xóa hẳn hàm `pageValues` (commit riêng sau commit chính), chạy lại lint còn đúng 2 warning `<img>` có từ trước, chạy lại test:db vẫn 56/56.
- **`/proc/<pid>/environ` không phản ánh biến `--env-file`.** Environ của tiến trình chỉ giữ giá trị lúc `exec`; biến Node nạp từ env-file không hiện ở đó — đừng dùng cách này để kiểm env của server. (Mật khẩu thử local chỉ dùng cho server chạy bằng env thử; file env thử đã xóa sau probe; mật khẩu thật của Henry không đụng tới.)
- **Lập chỉ mục vẫn TẮT** trên live theo quyết định của Henry — ngày này không đụng vào (bật lại chỉ ở go-live, bước 6 checklist).

## Việc của Henry (nhắc lại, không giục riêng lẻ)

- A1: redeploy Vercel (Deployments → bản mới nhất → Redeploy) để store Blob Public có hiệu lực, rồi chạy lại test tải ảnh.
- A3: (đã báo tạo nhánh snapshot-2026-11-26) — xác nhận theo phía cha.
- A4: token Telegram vào env + chat id trong admin, rồi "Gửi thử".
- Dữ liệu thật: tên shop, hotline/Zalo/địa chỉ, ngân hàng, khu vực + phí, sản phẩm + ảnh thật, nội dung 3 trang chính sách + mô tả SEO mặc định + ảnh OG; đọc lại /policy đang public.
- Quyết định token GitHub (thu hồi token đã dán trong chat + tạo fine-grained mới) vẫn là của Henry.
- Sau khi dữ liệu thật đủ: B6 + E2 (chuyển từ Ngày 15) rồi Phần G (dọn demo).
