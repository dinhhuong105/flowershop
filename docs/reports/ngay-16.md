# Báo cáo Ngày 16 — Lỗi xuất bản bằng toast + che theo khóa + nhãn Việt/lọc tự động + script khởi động standalone

- Ngày: 27/11/2026.
- Nền: commit `04ffd20` (Ngày 15).
- Commit Ngày 16: 1 commit trên `04ffd20` (lấy hash đầy đủ bằng `git log`). KHÔNG push.
- Phạm vi theo verdict Ngày 15 của Claude (không có file đặc tả riêng — Claude: "Ngày 16: không cần đặc tả mới"): 4 việc, mỗi việc có tiêu chí ĐẠT. B6 + E2 vẫn để sau, ưu tiên thấp.
- Link live (mọi báo cáo cho Claude đều kèm): https://flowershop-steel.vercel.app/

## Kết quả từng mục

| Mục | Kết quả | Ghi chú |
|---|---|---|
| 1. Lỗi xuất bản hiện bằng toast | ĐẠT | Trước: bấm Xuất bản trang trùng slug danh mục → lỗi nhét vào ô thao tác, dòng bảng cao 69 → **171 px** (2,5×). Sau: toast lỗi góc dưới-phải ("Đường dẫn này đã dùng cho một danh mục, không xuất bản được.", tone error, 5 giây), dòng bảng giữ **69 px**, không còn `<p role="alert">` trong dòng. Ảnh trước/sau đính kèm. Xem thêm độ lệch 1 (toast xuống dòng). |
| 2. Che hotline theo khóa | ĐẠT | `maskSensitiveForDisplay(value, key)` mới: `contact.hotline` + `contact.zalo` hiện đầy đủ (thông tin công khai); khóa chứa `token`/`password`/`secret` che toàn bộ `********`; các khóa còn lại giữ quét dãy ≥ 8 chữ số (kể cả khoảng trắng/gạch nối) → `****` + 4 số cuối. Kèm test thuần (xem "Kiểm chứng"). Probe CDP qua form liên hệ thật: hotline `0900123456` hiện đầy đủ trong nhật ký, STK vẫn `****9012 → ****9098`. |
| 3. Nhãn tiếng Việt + lọc tự động | ĐẠT | Cột "Thay đổi" dùng `formatActivityChange`: `created` → "Đã tạo", `deleted` → "Đã xóa", `updated` → "Cập nhật", `draft → published` → "Nháp → Đã xuất bản", `published → draft` → "Đã xuất bản → Nháp"; giá trị khác giữ cặp cũ → mới như cũ. Thanh lọc mới `ActivityFilterBar` (dropdown khu vực + tìm kiếm debounce ~400 ms + 2 ô ngày) lọc TỰ ĐỘNG qua `router.replace`, không còn nút "Lọc"/"Xóa lọc"; param URL giữ nguyên (`area`, `q`, `from`, `to`) nên bookmark/link cũ vẫn chạy. Giữ **20 dòng/trang** (Claude chấp nhận 20 hay 30). Xem thêm độ lệch 2 (sửa race mất param khi đổi 2 lọc liên tiếp). |
| 4. Script khởi động server standalone | ĐẠT | `scripts/start-standalone.sh [PORT]` (mặc định 3000): kiểm build đã có, kill server cũ trên cổng bằng PID chính xác từ `ss -ltnp` (không pgrep), xóa cache standalone, copy `.next/static` → `.next/standalone/.next/static` + `public` → `.next/standalone/public`, khởi động server (`node --env-file=.env next/standalone/server.js`), chờ trang chủ 200 (tối đa 30 s, lỗi thì kill server + in 20 dòng log cuối), rồi kiểm 1 chunk JS trả 200. Đã dùng để chạy mọi probe CDP trong ngày (server lên, chunk 200). |

## Độ lệch (so với đặc tả Ngày 16)

1. **Mục 1 — thông báo toast được xuống dòng.** Probe CDP đầu tiên PASS hết về mặt text, nhưng kiểm bằng mắt thấy thông báo lỗi dài (60 ký tự) bị cắt cụt ở mép phải màn hình: span thông báo trong `Toast.tsx` có `whitespace-nowrap` trong khi hộp chỉ `max-w-md` (448 px) nên nội dung tràn khỏi hộp. Sửa: bỏ `whitespace-nowrap`, thêm `min-w-0` cho span thông báo — thông báo dài xuống 2 dòng trong hộp, thông báo ngắn ("Đã thêm vào giỏ hàng") vẫn một dòng như cũ; nút ✕ vẫn cùng hàng nhờ `flex-nowrap` của container. Probe bổ sung kiểm hình học toast (mép phải 1424 ≤ viewport 1440, không tràn ngang) — PASS. Sửa này dùng chung cho mọi toast admin (kể cả toast Hoàn tác).
2. **Mục 3 — sửa race mất param trong `useFilterNavigation` (dùng chung cho đơn hàng/sản phẩm/nhật ký).** Probe CDP đầu tiên FAIL 1 kiểm: đặt Từ ngày rồi Đến ngày ngay sau đó → URL chỉ còn `to`, mất `from`. Nguyên nhân: `router.replace` là bất đồng bộ — `window.location.search` chỉ đổi SAU khi điều hướng commit (vài chục–vài trăm ms), nên 2 lần đổi lọc liên tiếp cùng đọc URL cũ, lần sau đè mất lần trước. Ghi chú cũ trong code ("window.location.search luôn mới nhất") là SAI trong trường hợp này. Sửa: giữ param của lần replace chưa commit trong `pendingRef` (`{from, params, at}`) và gộp lần đổi sau vào đó; chỉ dùng khi lần replace xuất phát đúng từ URL hiện tại (`from` khớp) và còn mới (< 2 s — điều hướng thường commit trong < 500 ms). Chạy lại probe: URL đủ `?area=contact&from=2026-11-20&to=2026-11-20`. Giới hạn còn lại (ghi trong code): bấm Back về đúng URL cũ rồi đổi lọc trong 2 s sau một lần đổi lọc có thể làm param cũ hiện lại — cửa sổ hẹp, param hiện rõ trên URL, xóa được bằng cách xóa lọc. Không thêm được test thuần cho hook này (test thuần của repo chạy bằng `tsx --test`, không có React Testing Library/jsdom) — kiểm bằng CDP.
3. **Không có độ lệch về 20 dòng/trang** — giữ 20 như cũ.

## Kiểm chứng

- Unit: **320/320 PASS** (Ngày 15: 313; +7: che theo khóa 5, `formatActivityChange` 2 nhóm — hotline/zalo hiện đầy đủ, STK che kể cả dạng có khoảng trắng, khóa token/password/secret che toàn bộ, khóa lạ vẫn quét, nhãn Việt 5 mẫu + không khớp → null).
- test:db: **56/56 PASS** (như Ngày 15). Đúng trình tự: `recreate-test-data` → `test:db` → `clean-test-data --delete`.
- Typecheck: **0 lỗi**. Lint: **0 lỗi**, 2 warning `<img>` có từ trước (`SettingsImageField.tsx`, `Header.tsx`).
- Build: OK. First Load JS `/` = **115 kB** (≤ 135 kB, như Ngày 15); `/admin/activity` = 124 kB.
- Smoke local (`scripts/smoke-live.sh http://localhost:3000`): **20/21 PASS** — FAIL duy nhất là sitemap-localhost (SITE_URL là http://localhost:3000 ở local; trên production sẽ PASS — giống Ngày 14/15). Check mới PASS: `/admin/activity` chưa đăng nhập → 307 `/login`.
- CDP (headless Chrome 158, server standalone :3000 do `scripts/start-standalone.sh` khởi động, phiên admin tạo trực tiếp trong DB local): **22/22 PASS** — (1) bấm Xuất bản trang trùng → toast lỗi hiện + không lỗi trong ô thao tác + dòng 69 px + toast không tràn mép phải; (2) đổi hotline qua form thật → lưu thành công + dòng nhật ký hiện số đầy đủ + STK vẫn che; (3) đủ 5 nhãn Việt + không còn giá trị thô published/draft + không còn nút Lọc/Xóa lọc + chọn khu vực → URL tự đổi `?area=contact` + bảng chỉ còn dòng liên hệ + đặt khoảng ngày → URL tự đổi đủ from/to + khoảng ngày không khớp → trạng thái trống + gõ tìm kiếm → URL tự đổi `q=hotline` (debounce); mobile 390: không tràn ngang.
- So `<head>` với nền Ngày 15 (chuẩn hóa hash, `~/workspace/day16-baseline-heads/` → `~/workspace/day16-after-heads/`): trang chủ + danh mục + sản phẩm + trang tĩnh **giống hệt** (4/4) trong cùng trạng thái xuất bản (0 trang xuất bản).
- DB local sau dọn: products=20, categories=4, orders=0, pages=3 (0 xuất bản, tiêu đề gốc), settings=24, audit=0, sessions=0. **Sạch.** Hotline đã khôi phục về "".

## Mục chưa làm + lý do

- **B6 xem trước Markdown 2 cột** — chuyển ngày sau (ưu tiên thấp, theo đặc tả Ngày 16).
- **E2 log sản phẩm/danh mục/khu vực** — chuyển ngày sau (ưu tiên thấp, theo đặc tả Ngày 16).
- **A1 (Blob) theo dõi thêm** — Claude lưu ý: mới xác nhận tải ảnh + URL trả 200; bước "sau redeploy URL vẫn 200" chưa làm (store nằm ngoài deploy nên gần như chắc chắn, nhưng vẫn cần mở lại URL sau lần deploy tới). URL test: https://sv2gh55kprjxi3pk.public.blob.vercel-storage.com/uploads/ebc2164ae457.png — mở lại sau khi deploy bản Ngày 16.
- **Nhánh snapshot Neon sẽ cũ dần** — Claude lưu ý: trước Phần G (dọn demo) tạo nhánh mới ngay trước khi xóa.

## Ảnh đính kèm

- Mục 1 (trước/sau): `~/workspace/day16-shots/publish-error-before-1440.png`, `~/workspace/day16-shots/publish-error-after-1440.png`
- Mục 2 + 3: `~/workspace/day16-shots/activity-hotline-1440.png`, `~/workspace/day16-shots/activity-autofilter-1440.png`, `~/workspace/day16-shots/activity-390.png`
- Probe CDP (tái chạy được): `~/workspace/day16-verify-mine.mjs` (harness mượn từ probe Ngày 15 `day15-verify-mine3.mjs`)

## Sự cố trong ngày (ghi lại để lần sau khỏi mất thời gian)

- **VM lại bị thay trước ~07:30 ngày 27/11** (uptime 1:25 lúc ~09:00) — PostgreSQL + Chrome bị xóa. Dựng lại: `apt-get update`, cài postgresql-16 + Google Chrome 158, chạy `~/workspace/rebuild-flower-db.mjs` (tạo lại role `hoa` + DB `hoa_shop`), `prisma migrate deploy` + `prisma db seed`. DB sạch: 20|0|3|0|24|0|0|4.
- **`psql -t -A -c "INSERT... RETURNING id"` in cả tag lệnh.** Output là `"4\nINSERT 0 1"` — nhét nguyên vào chuỗi JS trong `Runtime.evaluate` gây SyntaxError (xuống dòng trong literal). Sửa: lấy id bằng regex `match(/^\d+/)`. (Ghi vào `~/AGENTS.md` ở lần sau.)
- **Race mất param khi đổi 2 lọc liên tiếp** — xem độ lệch 2. Bài học: `window.location.search` KHÔNG phải lúc nào cũng mới nhất — nó lag một lần `router.replace` chưa commit.
- **Toast lỗi dài bị cắt cụt ở mép phải** — xem độ lệch 1. Bài học: kiểm bằng mắt sau khi probe PASS bằng text; `whitespace-nowrap` + `max-w-md` = tràn với nội dung dài.
- **Tự tay làm hỏng `Toast.tsx` khi sửa comment.** Lần sửa comment đầu vô tình nhân đôi dòng `className={` → typecheck báo `TS1160: Unterminated template literal`, build fail, script khởi động báo thiếu `.next/standalone/server.js`. Sửa: xóa dòng trùng, chạy lại typecheck + build xanh. Bài học: khi sửa comment ngay trên một dòng code dài, đừng nhét lại dòng code đó vào nội dung sửa.
- **Probe gọi `Emulation.setDeviceMetricsOverride` sai session.** Gửi về browser session thay vì page session → `wasn't found`. Sửa: gửi về page session (không truyền `false` làm cờ session). DB đã dọn sạch trước khi lỗi này xảy ra nên không mất dữ liệu probe.
- **Lập chỉ mục vẫn TẮT** trên live theo quyết định của Henry — ngày này không đụng vào (bật lại chỉ ở go-live, bước 6 checklist).

## Việc của Henry (nhắc lại, không giục riêng lẻ)

- A4: token Telegram vào env + chat id trong admin, rồi "Gửi thử".
- Dữ liệu thật: tên shop, hotline/Zalo/địa chỉ, ngân hàng, khu vực + phí, sản phẩm + ảnh thật, nội dung 3 trang chính sách + mô tả SEO mặc định + ảnh OG; đọc lại /policy đang public.
- Quyết định token GitHub (thu hồi token đã dán trong chat + tạo fine-grained mới) vẫn là của Henry.
- Sau khi dữ liệu thật đủ: B6 + E2 rồi Phần G (dọn demo) — Claude viết đặc tả riêng khi Henry báo dữ liệu thật đã vào.
- Sau Ngày 16: **chờ Henry**, không tự tạo thêm việc (B6 + E2 ưu tiên thấp, để sau).
