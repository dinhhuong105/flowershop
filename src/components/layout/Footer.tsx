import { siteConfig, telHref, zaloHref } from "@/config/site";

// Footer (mục 4.3 phụ lục): nền green-900, 5 cột. Cột 2–4 ("Về chúng
// tôi", "Hỗ trợ khách hàng", "Chính sách") chưa có trang thật (Ngày 9)
// nên chỉ hiện tiêu đề + dòng "Đang cập nhật" — KHÔNG link tới trang
// chưa tồn tại. Cột "Liên hệ" chỉ ghi field có giá trị thật trong
// siteConfig (hiện chỉ còn giờ mở cửa; hotline/địa chỉ trong .env mẫu
// là số giữ chỗ nên đã bị lọc ở site.ts). Không cột newsletter, không
// logo VISA/Mastercard/MoMo/ZaloPay. Thanh dưới: © + badge COD, Chuyển khoản.
export default function Footer() {
  const year = new Date().getFullYear();
  const hasContact =
    siteConfig.address || siteConfig.hotline || siteConfig.zaloPhone || siteConfig.openHours;
  return (
    <footer className="bg-green-900 text-white">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="font-display text-xl font-semibold">{siteConfig.name}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">
            {siteConfig.tagline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            {siteConfig.description}
          </p>
          {siteConfig.socialLinks.length > 0 ? (
            <ul className="mt-4 flex gap-2">
              {siteConfig.socialLinks.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-sm font-bold text-white transition-colors duration-150 hover:border-gold-300 hover:text-gold-300"
                  >
                    {s.label.slice(0, 1)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <nav aria-label="Về chúng tôi">
          <p className="font-semibold">Về chúng tôi</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">Đang cập nhật.</p>
        </nav>
        <nav aria-label="Hỗ trợ khách hàng">
          <p className="font-semibold">Hỗ trợ khách hàng</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">Đang cập nhật.</p>
        </nav>
        <nav aria-label="Chính sách">
          <p className="font-semibold">Chính sách</p>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Nội dung mẫu, chờ cửa hàng xác nhận.
          </p>
        </nav>
        <div>
          <p className="font-semibold">Liên hệ</p>
          {hasContact ? (
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {siteConfig.address ? <li>{siteConfig.address}</li> : null}
              {siteConfig.hotline ? (
                <li>
                  Hotline:{" "}
                  <a href={telHref(siteConfig.hotline)} className="text-white hover:underline">
                    {siteConfig.hotline}
                  </a>
                </li>
              ) : null}
              {siteConfig.zaloPhone ? (
                <li>
                  Zalo:{" "}
                  <a
                    href={zaloHref(siteConfig.zaloPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:underline"
                  >
                    {siteConfig.zaloPhone}
                  </a>
                </li>
              ) : null}
              {siteConfig.openHours ? <li>Giờ mở cửa: {siteConfig.openHours}</li> : null}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-white/70">Đang cập nhật.</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/15" data-testid="footer-bottom">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-white/70">
          <p>
            © {year} {siteConfig.name}
          </p>
          <p className="flex items-center gap-2">
            <span className="rounded-[2px] border border-white/30 px-2 py-0.5 text-xs font-semibold text-white">
              COD
            </span>
            <span className="rounded-[2px] border border-white/30 px-2 py-0.5 text-xs font-semibold text-white">
              Chuyển khoản
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
