"use client";

import { useState } from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

// Thư viện ảnh trang chi tiết (mục 5.2 đặc tả Ngày 4 + mục 3.3 phụ
// lục): ảnh chính 4/5, bấm thumbnail đổi ảnh (fade 250ms), hover
// desktop phóng 1.8x theo vị trí con trỏ. Chỉ có ≥2 ảnh mới hiện hàng
// thumbnail; 1 ảnh thì không. Huy hiệu "Giao nhanh" (nhãn lấy từ
// siteConfig) và "-{n}%" góc trái trên ảnh chính.
export default function Gallery({
  images,
  name,
  isFastDelivery,
  discountPercent,
}: {
  images: string[];
  name: string;
  isFastDelivery: boolean;
  discountPercent: number | null;
}) {
  const [active, setActive] = useState(0);
  const [origin, setOrigin] = useState("50% 50%");
  const main = images[active] ?? "/images/placeholder.svg";

  const onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  };

  return (
    <div>
      <div
        className="group relative aspect-[4/5] w-full overflow-hidden rounded-[3px] border border-line bg-cream-100"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setOrigin("50% 50%")}
      >
        <Image
          key={active}
          src={main}
          alt={name}
          width={800}
          height={1000}
          priority
          unoptimized
          style={{ transformOrigin: origin }}
          className="h-full w-full animate-[fade-in_250ms_ease-out_both] object-cover transition-transform duration-300 ease-out group-hover:scale-[1.8]"
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {isFastDelivery ? (
            <span className="rounded-[2px] bg-green-900 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              {siteConfig.fastDeliveryLabel}
            </span>
          ) : null}
          {discountPercent !== null ? (
            <span className="rounded-[2px] bg-danger px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              -{discountPercent}%
            </span>
          ) : null}
        </div>
      </div>
      {images.length >= 2 ? (
        <div className="mt-3 flex gap-2" role="group" aria-label="Ảnh sản phẩm">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Xem ảnh ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              className={`h-20 w-16 shrink-0 overflow-hidden rounded-[3px] border transition-all duration-150 ${
                i === active
                  ? "border-green-800 ring-2 ring-green-800/30"
                  : "border-line opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={src}
                alt=""
                width={96}
                height={120}
                loading="lazy"
                unoptimized
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
