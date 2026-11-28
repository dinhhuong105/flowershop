# Báo cáo Ngày 19 — Dọn nợ + Hiệu năng (đo trước khi sửa) + TOTP cho admin (28/11/2026)

Ngắn, theo mẫu Ngày 17/18. Ba commit local trên main, CHƯA PUSH
(Pi Em kiểm độc lập rồi mới đẩy): `1797cb2` (Phần A) →
`da063e0` (Phần B) → `fe94312` (Phần C) → commit này (báo cáo).
Live không đổi trong đợt này (remote HEAD vẫn 628f709, Ngày 18);
indexing vẫn TẮT; chuyển khoản vẫn TẮT.

## 1. Từng mục Ngày 19

| Mục | Kết quả | Ghi chú |
| --- | --- | --- |
| A1 Đối chiếu Ngày 18, làm bù thiếu | ĐẠT | Chuẩn bản Claude Message 68 (xem §2) |
| A2 Tác giả tùy chọn | ĐẠT | Trống → không hiện dòng tác giả, JSON-LD bỏ author |
| A3 "0 đơn quá hạn" chỉ hiện khi N>0 | ĐẠT | Probe 0 → vắng, 1 → hiện, xóa → biến mất |
| A4 Giới hạn tốc độ, fail-closed | ĐẠT MỘT PHẦN | Đăng nhập/đặt hàng/poller: bộ đếm lỗi → 429 "Thử lại sau" live; tìm kiếm công khai vẫn mở 200. **A4.1 KHÔNG ĐẠT** (xem §3) |
| A5 npm audit 0 + CI audit | ĐẠT | Audit 0; CI cổng high + job nightly low |
| B1 Đo nguyên nhân trước khi sửa | ĐẠT | Bảng số + kết luận ở §4 (file `~/workspace/day19-b1-do.md`) |
| B2 Sửa rẻ → đắt | ĐẠT MỘT PHẦN | Cache + song song + gộp truy vấn xong; **đồng vùng KHÔNG LÀM** (vùng Neon chưa xác định, không đoán) |
| B3 Mục tiêu hiệu năng | ĐẠT MỘT PHẦN | Truy vấn `/` ≤ 5: **ĐẠT** (ấm 1, lạnh 4). TTFB live giảm ≥ 40%: **CHƯA ĐO ĐƯỢC** (chờ đẩy + deploy, xem §4) |
| C1 Thiết kế + luồng TOTP | ĐẠT | RFC 6238, AES-256-GCM, phiên chờ xác minh, `/admin/security` |
| C2 QR otpauth | ĐẠT | QR vẽ tại chỗ, không dịch vụ ngoài |
| C3 Kiểm thử (vào test:security) | ĐẠT | Unit 19 + DB 9 + live-check 12 ca TOTP mới, probe CDP 15/15 |
| C4 Bật trên production | CHỜ HENRY | Khóa Vercel chưa đặt; 2FA tắt mặc định, an toàn khi chưa bật |

## 2. A1 — Đính chính chuẩn đối chiếu (quan trọng)

Đặc tả A1 viết "ngay-17-dac-ta.md có mục NGÀY 18 — Quản lý tin tức"
là **SAI**: file đó không có mục nào tên như vậy (chỉ có §9 "Ngưỡng
deploy"). Claude trả lời (Message 68, chat Claude.ai 28/11) chấp
nhận cách đối chiếu của Pi Em, cho biết file bên mình khác bản
Claude soạn, và viết ra toàn bộ mục Ngày 18 theo bản của mình —
đã lưu nguyên văn tại `~/workspace/ngay-18-dac-ta-claude-ban-goc.md`.
A1 chấm theo **bản Claude** đó, không theo §9 nữa.

| Mục trong bản Claude | Trạng thái | Ghi chú |
| --- | --- | --- |
| Bảng articles: slug duy nhất | ĐẠT | Schema `@unique` |
| title **3–160** | **ĐÃ BÙ** (cũ 2–120) | Test biên 2/3/160/161 |
| excerpt **≤ 300** | **ĐÃ BÙ** (cũ 200) | Test biên 300/301; form hiện "/ 300 ký tự" |
| content **≤ 30.000** | **ĐÃ BÙ** (cũ 20.000) | Test biên 30000/30001 |
| coverImage qua module upload S5 | ĐẠT | Route `/api/admin/upload`, ≤2 MB, jpeg/png/webp, magic bytes, không SVG |
| isPublished mặc định false | ĐẠT | Schema `@default(false)` |
| publishedAt + hẹn giờ (tương lai chưa hiện, giờ VN) | **ĐÃ BÙ** | Ô `datetime-local` + lọc ở list/detail/search/sitemap; probe lưu qua popup: `2026-11-29 01:30:00` UTC đúng VN−7h |
| Chỉ bài đã xuất bản + đến giờ mới hiện | **ĐÃ BÙ** | Cùng lọc trên |
| `/tin-tuc/<slug>`; `tin-tuc` trong RESERVED_SLUGS | ĐẠT | Có từ Ngày 18 |
| Va chạm slug với danh mục/trang tĩnh **cả hai chiều** | **ĐÃ BÙ** (chiều ngược) | `categories.ts`/`pages.ts` nay chặn slug đã dùng cho tin tức + test |
| Admin list: tiêu đề, slug, trạng thái (Nháp / Đã xuất bản / **Hẹn giờ**), ngày; lọc tự động | **ĐÃ BÙ** | Thêm `newsStatusLabel` + lọc `scheduled`; test DB lọc scheduled |
| Popup **rộng**, xem trước Markdown, ảnh bìa, bộ đếm ký tự | ĐẠT (+bù nhỏ) | `ProductModal` max-w-3xl; preview + counters; đã thêm counter tiêu đề ("/ 160 ký tự") |
| Bật/tắt xuất bản có **Hoàn tác** | ĐẠT | Toast Hoàn tác 5s (`ToggleNewsButton`) |
| Xóa có xác nhận | ĐẠT | Hộp `<dialog>` |
| Nhật ký đúng khóa **`article:<slug>`** | **ĐÃ BÙ** (cũ `news:`) | 4 chỗ ghi trong `news.ts`; `listActivity` lọc OR cả hai tiền tố (dòng cũ vẫn hiện khu vực Tin tức); test DB + activity |
| `/admin/news` thay vì `/admin/articles` | CHẤP NHẬN, không đổi | Claude đồng ý |
| Phân trang 8 thay vì 12 | CHẤP NHẬN, không đổi | Claude đồng ý |
| `/tin-tuc/<slug>` 404 nếu nháp/chưa đến giờ/không tồn tại | **ĐÃ BÙ** (hẹn giờ) | Probe A1.2/A1.10 |
| `<title>`/mô tả theo SEO, ảnh bìa làm og:image | ĐẠT | `generateMetadata` (seoTitle/seoDescription, fallback) |
| JSON-LD Article chỉ trường có dữ liệu, escape an toàn | **ĐÃ BÙ** | `src/lib/news-jsonld.ts` mới + 5 unit test; probe `</script>` parse lại đúng |
| Sitemap có bài đã xuất bản; canonical đúng | ĐẠT | Sitemap đã lọc hẹn giờ; canonical `/tin-tuc/<slug>` |
| Bảo mật: XSS Markdown/tiêu đề/excerpt; upload S5; phân quyền mọi action; ReDoS Markdown | ĐẠT | Có từ Ngày 18 + test |
| Bảo mật: giới hạn độ dài; escape JSON-LD; va chạm slug | **ĐÃ BÙ** | Xem các dòng trên |

Hai lỗi phát hiện + sửa lúc kiểm A: (1) `listActivity` lọc SQL theo
tiền tố `news:` nên dòng nhật ký `article:` mới bị loại khỏi khu vực
Tin tức — sửa thành OR cả hai tiền tố; (2) test flood tra cứu trong
`security-live-check` lệch 1 lượt vì kiểm tra S1 trước đó cũng ghi
event tra cứu, và post-clean không chạy khi assert ném lỗi — sửa
thành dọn trước + `try/finally`.

## 3. A4.1 KHÔNG ĐẠT — tra cứu đơn vượt hạn không trả 429

Đã thử chặn tra cứu ở middleware bằng fetch route nội bộ
`/api/internal/lookup-limit`, nhưng **fetch của Edge runtime tới
chính server standalone trên VM này hỏng** — xác minh bằng 6 build
+ ~15 lần thử: không proxy thì fail nhanh `fetch failed` (cause
HTTPParserError, phản hồi không khớp HTTP/1.1); có proxy env thì
treo tới timeout 3s; cả ba đích đều hỏng (`localhost`, `127.0.0.1`,
IP LAN); đối chứng curl/Node fetch tới cùng URL trả 200 trong
0,015s/0,13s; route nội bộ tự nó đúng; một lần duy nhất ở build3
trả 404 đúng nhưng không tái hiện được.

**Quyết định:** gỡ toàn bộ cơ chế middleware-fetch + route nội bộ
(middleware về đúng bản gốc — điều phối viên kiểm lại: diff
middleware của commit A là rỗng), giữ kiểm tra ở page: giới hạn
30 lần/phút + fail-closed (bộ đếm lỗi → "Hệ thống đang bận, vui
lòng thử lại sau."), chỉ mất mã 429 (trả 200 kèm thông báo vì
Server Component không đặt được status). Trên Vercel, fetch Edge
tới domain deploy đi qua hạ tầng nội bộ của Vercel nên cách
middleware-fetch **có thể** chạy được — **CHƯA kiểm chứng**, không
khẳng định. Ghi chú này đã viết trong code
`src/app/order/[code]/page.tsx`. Cần quyết định của parent/Claude:
giữ page-level hiện tại hay thử lại middleware-fetch sau deploy.

Các nhóm A4 khác ĐẠT: đăng nhập / đặt hàng / poller đơn mới — bộ
đếm lỗi → **429** "Thử lại sau" live (probe A4.4/A4.5); tìm kiếm
công khai vẫn mở 200 (A4.6). TOTP (Phần C) và nhập sản phẩm
(Ngày 20) dùng chung hàm `checkRateLimitFailClosed` đã export sẵn
(khóa `totp:ip:<hash>` / `totp:admin`, 5/15 phút).

## 4. Phần B — Hiệu năng: đo trước, sửa sau (không đổi nonce)

### B1. Đo (28/11 ~09:45–10:00, từ VM này; live = remote Ngày 18 `04d8801`)

| Hạng mục | Giá trị đo được |
| --- | --- |
| `x-vercel-id` trên live `/` | `sfo1::iad1::…` → edge **sfo1**, hàm **iad1** (us-east-1) |
| Vùng DB Neon | **CHƯA XÁC ĐỊNH ĐƯỢC** — chuỗi kết nối Neon chỉ nằm trong env Vercel, `.env` local trỏ Postgres localhost. Không đoán. Cần Pi Em kiểm tra trên Neon/Vercel dashboard. |

TTFB live (curl, 6 lần; lần 1 sau nhiều giờ không dùng):

| Route | Lạnh | Ấm trung vị (5 lần) | Nền Ngày 18 |
| --- | --- | --- | --- |
| `/` | 3,07 s | **1,33 s** | 1,28–1,37 s ✓ khớp |
| `/hoa-tuoi` | 2,90 s | **1,75 s** | 1,54–2,77 s ✓ |
| `/tin-tuc` | 2,48 s | **1,15 s** | 1,13–1,70 s ✓ |
| SP | 2,06 s | **1,35 s** | — |
| `/robots.txt` (tĩnh) | 0,67 s | **0,45 s** | 0,38–0,65 s ✓ |

Truy vấn Prisma mỗi request (lạnh/ấm, trước sửa): `/` **10/7**,
`/hoa-tuoi` **10/8**, SP **9/7**, `/tin-tuc` **7/5**, robots 0,
health 1. Toàn bộ gần như tuần tự (layout `await` nối tiếp 5 lần
đọc độc lập; cài đặt đọc **3 lần** khi cache lạnh). TTFB local ấm:
`/` 0,034 s — render không phải nút thắt.

**Kết luận nguyên nhân:** (1) nền mạng/edge từ VM ~0,45 s (robots
tĩnh live 0,45 s vs local 0,009 s) — code không sửa được; (2) thời
gian phía server live ~0,9 s trên `/` là các vòng RTT tới DB
(7–8 truy vấn tuần tự) cộng độ trễ hàm — nếu DB Neon khác vùng
`iad1` thì mỗi truy vấn tuần tự cộng một RTT liên lục địa, là nghi
phạm lớn nhất nhưng **chưa xác minh được vùng Neon**; (3) truy
vấn thừa/trùng (menu = danh mục trang chủ, quan hệ category nạp
lại 2 lần, footer + legacy là 2 truy vấn riêng vào cùng bảng
`pages`, cài đặt đọc 3 lần khi cache lạnh); (4) lạnh (hàm/Neon/
cache). **Ghi trung thực: số đo từ VM không bằng trải nghiệm ở
Việt Nam** (người dùng VN gần edge hơn; số live từ VM là chặn
trên).

### B2. Đã sửa (rẻ → đắt)

1. **Đồng vùng: KHÔNG LÀM** — không xác định được vùng Neon từ
   local; không đặt `vercel.json` regions theo phỏng đoán (file
   không tồn tại trong repo). Cần Pi Em kiểm tra vùng Neon trên
   dashboard; nếu khác `iad1` thì đặt regions khớp, rồi đo lại
   live. `vercel.json` chỉ có hiệu lực sau khi đẩy + deploy lại.
2. **Cache đọc ổn định** (`unstable_cache` + tag + `revalidateTag`
   ở action admin, chỉ dữ liệu công khai): danh mục
   (`nav-categories`), chân trang + legacy map gộp thành 1 truy
   vấn (`footer-pages`), tra trang theo slug (`published-pages`,
   mới: `src/lib/pages-cache.ts`; hàm DB thô giữ nguyên cho test).
   Cài đặt bọc thêm React `cache()` để gộp 3 lần đọc lạnh thành 1.
3. **Song song hóa:** layout `Promise.all` 5 lần đọc; tag danh
   mục chạy song song với SP.
4. **Gộp truy vấn:** trang chủ dùng chung danh mục menu (bỏ truy
   vấn trùng), SP không select quan hệ `category` nữa (nối
   slug/tên trong JS từ danh mục đã có).

Lưu ý kỹ thuật: `unstable_cache` ném lỗi ngoài runtime Next — đã
thêm fallback đọc thẳng DB trong `queries.ts`/`pages-cache.ts`
(phát hiện nhờ test seo-fields fail lúc đầu, đã sửa; không ảnh
hưởng hành vi trong request Next). Không đổi nonce, không động
code Phần A ngoài việc chạm `settings-cache.ts` (giữ nguyên hành
vi A).

### B3. Trước/sau (đo lại bằng đúng script B1, build cuối, local)

| Route | Truy vấn lạnh/ấm trước | Truy vấn lạnh/ấm sau | TTFB local ấm sau (trước) |
| --- | --- | --- | --- |
| `/` | 10 / 7 | **4 / 1** | 0,030 s (0,034 s) |
| `/hoa-tuoi` | 10 / 8 | **8 / 4** | 0,031 s (0,034 s) |
| SP | 9 / 7 | **5 / 2** | 0,031 s (0,033 s) |
| `/tin-tuc` | 7 / 5 | **5 / 2** | 0,024 s (0,031 s) |

- Số truy vấn `/` ≤ 5: **ĐẠT** (ấm 1, lạnh 4).
- TTFB local gần như không đổi — đúng dự kiến (DB local RTT ≈ 0;
  lợi ích nằm ở số vòng RTT tuần tự khi DB ở xa).
- **TTFB live giảm ≥ 40%: CHƯA ĐO ĐƯỢC** — số live sau sửa chỉ đo
  được sau khi Pi Em đẩy + Vercel deploy lại. Dự kiến cải thiện
  nhờ giảm vòng RTT tuần tự (7 → 1 truy vấn ấm trên `/`), nhưng
  con số thật phải đo lại sau deploy; nếu vẫn chưa đạt thì xét
  lại lệch vùng (cần vùng Neon) và/hoặc nonce ở ngày riêng.

## 5. Phần C — TOTP cho admin

- **C1 Thiết kế: ĐẠT.** `src/lib/admin/totp.ts`: HMAC-SHA1, 6 số,
  bước 30 s, cửa sổ ±1, `lastUsedStep`, `timingSafeEqual`. Vector
  RFC Appendix B đối chiếu độc lập bằng Python (6/6). Bí mật
  AES-256-GCM (`totp-crypto.ts`), khóa `AUTH_ENCRYPTION_KEY` 32
  byte base64; thiếu khóa → `isTotpAvailable()=false`, tính năng
  tự tắt. Bảng mới `admin_two_factor` + `admin_pending_sessions`,
  migration `20261128100000_day19_totp` **chỉ thêm** (2 CREATE
  TABLE, không DROP — điều phối viên đã đọc SQL).
- **C1 Luồng đăng nhập: ĐẠT.** Đúng mật khẩu → phiên "chờ xác
  minh" (cookie `admin_pending` riêng, 5 phút) → `/login/verify`
  → phiên đầy đủ. Giới hạn 5 sai/15 phút dùng
  `checkRateLimitFailClosed` của Phần A (khóa `totp:ip:<hash>` +
  `totp:admin`); lỗi chung chung; mã khôi phục scrypt, dùng 1 lần.
  Thoát hiểm `ADMIN_TOTP_DISABLE=1` + ghi audit `totp.escape-used`
  mỗi lần dùng.
- **C1 Cài đặt `/admin/security`: ĐẠT.** Menu "Bảo mật" trong
  nhóm Cài đặt. Bật: QR `otpauth://` + khóa nhập tay → nhập mã
  xác nhận → 10 mã khôi phục hiện **một lần duy nhất**. Tắt /
  tạo lại mã: cần mật khẩu + mã. Sau khi bật, bí mật/mã không lấy
  lại được từ giao diện/HTML (live-check assert).
- **C1 Thao tác nhạy cảm: ĐẠT.** Lưu ngân hàng khi 2FA bật cần
  thêm mã TOTP (ngoài nhập lại mật khẩu), bộ đếm riêng
  `totp:bank:ip:<hash>` 5/15 phút fail-closed. Form ngân hàng hiện
  thêm ô mã khi 2FA bật.
- **C1 Cờ bật/tắt: ĐẠT.** 2FA tắt mặc định; đăng nhập không đổi
  khi chưa bật. Audit `totp.*` (bật/tắt/khôi phục/sai/tạo lại/
  thoát hiểm) vào khu vực "Bảo mật" của nhật ký. Hướng dẫn vận
  hành + 5 bước bật cho Henry ở `docs/van-hanh.md` §3.1.
- **Quyết định phiên khi bật/tắt 2FA (đã chọn, ghi rõ): buộc
  đăng nhập lại mọi phiên đầy đủ khác** — chỉ giữ phiên đang thao
  tác (`revokeOtherAdminSessions`). Đã kiểm chứng: db-test (giữ
  đúng 1, xóa 2) + probe CDP C5 (phiên B → 307 về `/login` sau
  khi bật).
- **C2 QR: ĐẠT.** `otpauth://totp/<tên shop>:<admin>?secret=…&
  issuer=…`, QR SVG vẽ tại chỗ (thư viện `qrcode` đã có), không
  dịch vụ ngoài. `/admin/security` + `/login/verify` có
  `Cache-Control: no-store`; bí mật không nằm trong URL/log.
- **C3 Kiểm thử: ĐẠT.** Unit 19 ca TOTP + mã hóa; DB 9 ca;
  live-check TOTP 12 ca mới; probe CDP 15/15 (xem §6).
- **C4 Bật production: CHỜ HENRY.** Khóa Vercel **chưa đặt**
  (builder không có trình duyệt — đúng chỉ đạo, bỏ qua). Hướng
  dẫn + lệnh sinh khóa trong `docs/van-hanh.md` §3.1 và
  `.env.example`. Khóa mã hóa local đã sinh bằng `openssl rand
  -base64 32` và chỉ nằm trong `.env` local (gitignored, không
  commit) — production cần giá trị **khác**.

**Khóa AUTH_ENCRYPTION_KEY — kiểm lại bởi điều phối viên:** tên
biến xuất hiện 24 lần trong diff Ngày 19 (code, test, docs,
`.env.example` với giá trị trống) — **không có giá trị khóa nào**
trong diff, repo hay bundle. `.env` gitignored, không được track.
Không bí mật/khóa/mã khôi phục nào in ra log/báo cáo/file.

Lỗi tìm thấy trong lúc kiểm C (đã sửa, có test): (1) **Bug thật:**
mã khôi phục băm dạng có gạch `XXXXX-XXXXX` nhưng lúc xác minh
chuẩn hóa bỏ gạch → không bao giờ khớp. Sửa: băm dạng chuẩn hóa
(`totp-store.ts`); test DB bắt được. (2) Test nhớ sai 2 vector
RFC (lẫn cột SHA-256) — code đúng, đã đối chiếu Python và sửa
test. (3) Sau khi tắt 2FA, trang không tự refresh nên trạng thái
hiển thị cũ — thêm `router.refresh()` khi tắt thành công. (4)
Body 307 của Next chứa `<title>` tĩnh của route — không phải dữ
liệu; assert live-check chỉ kiểm dữ liệu (như chuẩn S1 cũ).

**Chưa kiểm end-to-end ở C:** (a) nhánh thoát hiểm
`ADMIN_TOTP_DISABLE=1` (chỉ đọc code — 1 rẽ boolean + audit, chưa
chạy với env thật); (b) cổng lưu-ngân-hàng-cần-TOTP chưa có test
live/CDP (logic dùng chung `verifyTotpOrRecoveryCode` đã được
test, nhưng chưa có lần submit form ngân hàng thật với mã TOTP).

## 6. Bảng bảo mật S1–S12 (ca mới trong Ngày 19)

`npm run test:security`: **TẤT CẢ ĐẠT** — quét tĩnh 64 ok (58 + 6),
live-check 63/63 PASS (51 + 12 TOTP), quét live 21 PASS.

| S | Số ca mới | PASS/FAIL | Phát hiện | Đã sửa | Chưa test |
| --- | --- | --- | --- | --- | --- |
| S1 Phân quyền | 12 (TOTP) + 4 (news) | PASS | Không | — | — |
| S2 Phiên/đăng nhập | TOTP (P2) xong | PASS | Bug mã khôi phục băm/chuẩn hóa lệch (xem §5) | Đã sửa + test DB | Nhánh thoát hiểm chưa chạy với env thật |
| S3 Tiêm nhiễm | 0 | — | Không | — | — |
| S4 CSRF | 1 (TOTP) | PASS | Không | — | — |
| S5 Upload | 0 | — | Không | — | — |
| S6 SSRF | 0 | — | Không | — | — |
| S7 Tra cứu đơn | 0 | — | A4.1: tra cứu vượt hạn không trả 429 (xem §3) | Page-level fail-closed (200 + thông báo) | Middleware-fetch trên Vercel chưa kiểm chứng |
| S8 Logic đặt hàng | 0 | — | Không | — | Đặt hàng fail-closed live qua CDP checkout chưa probe (mới chỉ unit + cùng wrapper đã chứng minh live qua đăng nhập/poller/tra cứu) |
| S9 Rate-limit | 3 (db) + 12 (live TOTP) | PASS | Không | — | — |
| S10 Header/CSP | 0 | — | Không | — | — |
| S11 Cung ứng/bí mật | 0 | PASS | Không | — | Job audit CI chưa chạy thật trên GitHub (chờ token workflow) |
| S12 Nhật ký/phục hồi | audit `totp.*` + khu vực "Bảo mật" | PASS | Không | — | Sao lưu tự động + cảnh báo 500 (từ Ngày 17) |

Chi tiết ca mới:
- **S1 (12 TOTP):** phiên chờ xác minh bị từ chối trên 8 route
  admin + server action, cookie pending không làm phiên đầy đủ,
  pending hết hạn, không open redirect, `/admin/security` không
  lộ bí mật.
- **S1 (4 news, từ A):** hẹn giờ/scheduled trong `news.db.test.ts`
  và slug-collision chiều ngược.
- **S9 (3 db + 12 live):** fail-closed khi bộ đếm DB lỗi cho từng
  nhóm; 6 lần sai TOTP liên tiếp → khóa; bộ đếm lỗi → đóng.
- **S2:** vector RFC 6/6, cửa sổ ±1, chống dùng lại, mã khôi phục
  đúng 1 lần, GCM bit-flip, thiếu khóa → tắt.

## 7. Số kiểm chứng (log thật, không bịa)

- Unit `npm test`: **432/432 PASS** (120 suites; nền Ngày 18: 404).
  Điều phối viên chạy lại độc lập trên cây cuối: **432/432**.
- test:db (recreate → test:db → clean): **120/120 PASS** (nền
  101, +19 mới: rate-limit fail-closed 3, hẹn giờ 4, slug 1,
  scheduled 2, TOTP 9). Lưu ý: 2 lần chạy giữa bị 1 fail do race
  song song có sẵn (1 lần test `new-orders` đếm đơn 9 vs 10 — chạy
  riêng 7/7; 1 lần test của C đếm tuyệt đối phiên — đã sửa thành
  đếm tương đối; lần cuối 120/120).
- Typecheck: **0 lỗi** (điều phối viên chạy lại: 0). Lint: **0 lỗi,
  2 warning** `<img>` cũ.
- Build: OK, First Load JS `/` = **115 kB** (≤ 135 kB), `/tin-tuc`
  112 kB, `/admin/security` 3,21 kB.
- Smoke local: **20/21** — FAIL duy nhất `sitemap-localhost` là
  kỳ vọng (`.env` local đặt `SITE_URL=http://localhost:3000`).
- So `<head>` 4/4 với nền Ngày 18.
- `npm audit --omit=dev`: **0 vulnerabilities** (điều phối viên
  chạy lại: 0).
- `npm run test:security`: **TẤT CẢ ĐẠT** (tĩnh 64 ok, live-check
  63/63, quét live 21/21).
- CDP probe `~/workspace/day19-shots/probe-day19.mjs`: **26/26
  PASS** (A1.1–A1.14, A2.1–A2.2, A3.1–A3.3, A4.1–A4.7 theo hành
  vi mới). Probe CDP mất hiệu lực cache (Phần B): **6/6 PASS**
  (sửa tên danh mục → menu đổi ngay; xuất bản + hiện footer trang
  tĩnh → footer đổi ngay; đã hoàn nguyên).
- CDP probe TOTP `~/workspace/day19-shots/probe-day19-totp.mjs`:
  **15/15 PASS** (bật qua giao diện → phiên khác bị thu hồi → đăng
  nhập sang `/login/verify` → sai mã bị từ chối → đúng mã vào
  `/admin` → dùng lại mã bị từ chối → mã khôi phục vào được + dùng
  lại hết hiệu lực → tắt 2FA → đăng nhập lại chỉ cần mật khẩu).
  Ảnh 1440 + 390 đã mắt kiểm (QR, 10 mã khôi phục, màn xác minh,
  admin sau đăng nhập, mobile 390).
- DB cuối đợt: **20|0|3|0|24|0|0|4|0|0** + **0 tin tức, 0 phiên
  2FA, 0 audit totp, 0 rate-limit totp sót** (products|orders|
  pages|carts|settings|sessions|audit|categories|ratelimit|
  login_attempts|news). Ngân hàng về gốc (rỗng, enabled false,
  mẫu `DH {ORDER_CODE}`).

## 8. File đổi (3 commit trên 3b3addb, chưa push)

- `1797cb2` Phần A (36 files, +920/−131): hẹn giờ tin tức,
  JSON-LD Article, giới hạn Claude, tác giả tùy chọn, thẻ quá
  hạn, fail-closed rate-limit, CI audit (cổng high + nightly low).
- `da063e0` Phần B (11 files, +290/−108): cache đọc ổn định
  (`pages-cache.ts`, `queries.ts`), `Promise.all` ở layout, gộp
  truy vấn trùng; không migration, không đặt `vercel.json`.
- `fe94312` Phần C (29 files, +2233/−8): TOTP (`totp.ts`,
  `totp-crypto.ts`, `totp-store.ts`), bảng `admin_two_factor` +
  `admin_pending_sessions` (migration `20261128100000_day19_totp`,
  chỉ thêm), `/admin/security`, `/login/verify`, lưu ngân hàng
  cần mã TOTP, audit `totp.*`, hướng dẫn `docs/van-hanh.md` §3.1.
- Commit này: chỉ báo cáo `docs/reports/ngay-19.md`.

Probe scripts + ảnh (`~/workspace/day19-shots/`, `~/workspace/day19-b1-do.md`)
không nằm trong repo nên không commit.

## 9. Chờ Henry (gom một mục, không dừng việc khác)

- **S0:** thu hồi token GitHub đã lộ (26/11) + tạo fine-grained
  token mới cho kho `flowershop`, quyền Contents (đọc/ghi) **và
  Workflows (đọc/ghi)** để đẩy được `.github/workflows/ci.yml`
  (hiện ở commit local `3b3addb`). Khi có token mới: đẩy ci.yml,
  theo dõi lần chạy CI đầu, báo kết quả. Không hỏi, không nhắc.
- **C4 bật 2FA:** đặt `AUTH_ENCRYPTION_KEY` trên Vercel (lệnh sinh
  khóa trong `docs/van-hanh.md` §3.1 — giá trị production phải
  **khác** khóa local) rồi quét QR ở `/admin/security` và cất 10
  mã khôi phục. 5 bước trong `docs/van-hanh.md` §3.1.
- **Vùng Neon:** Pi Em kiểm tra vùng Neon trên dashboard; nếu khác
  `iad1` thì đặt `vercel.json` regions khớp, rồi đo lại TTFB live.
- **A4.1:** quyết định giữ page-level tra cứu (200 + thông báo)
  hay thử lại middleware-fetch sau deploy Vercel.

## 10. Còn thiếu / chưa làm

- TTFB live sau sửa chưa đo (chờ Pi Em đẩy + deploy, đo lại từ
  cùng VM, ấm, trung vị 5 lần, đối chiếu nền Ngày 18).
- Vùng Neon chưa xác định → chưa đặt `vercel.json` regions.
- Nhánh thoát hiểm `ADMIN_TOTP_DISABLE=1` chưa chạy với env thật;
  cổng lưu-ngân-hàng-cần-TOTP chưa có test live/CDP.
- Đặt hàng fail-closed live qua CDP checkout chưa probe.
- Nhập/xuất tin tức: backlog từ Ngày 18.
- Chuyển khoản khi BẬT chưa kiểm live; Safari/Firefox chưa kiểm;
  Lighthouse chưa đo; sao lưu tự động + cảnh báo 500 chưa có.
- VM bị thay giữa chừng (~03:09, uptime reset 1 phút): PostgreSQL
  + Chrome (cài qua apt) mất hẳn; đã cài lại PostgreSQL 16, khởi
  động cluster tay, dựng lại DB bằng `rebuild-flower-db.mjs` +
  migrate + seed về đúng nền 20|0|3|0|4|24; cài lại Chrome. Mọi
  kiểm chứng Phần C đều chạy **sau** khi dựng lại DB.
