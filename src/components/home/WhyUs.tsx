function TruckIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 8h13v8H1z" />
      <path d="M14 11h4l3 3v2h-7" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}

function FlowerIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <circle cx="12" cy="16" r="3.5" />
      <circle cx="8" cy="12" r="3.5" />
      <circle cx="16" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BouquetIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21v-8" />
      <path d="M12 13c-4 0-6-2.5-6-6 2.5 0 5 1 6 3-1-2.5-.5-5 1-7 .5 2.5 1 4.5 3 5.5C17.5 7 19 5 19 5c.5 3.5-1 7-4 8h-3Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </svg>
  );
}

const reasons = [
  {
    title: "Giao hoa nhanh trong ngày",
    text: "Đặt hoa trước giờ giao, shop giao tận nơi trong ngày.",
    icon: <TruckIcon />,
  },
  {
    title: "Hoa tươi chọn lọc mỗi ngày",
    text: "Hoa nhập mới mỗi sáng, chỉ chọn những cành tươi nhất.",
    icon: <FlowerIcon />,
  },
  {
    title: "Cắm hoa theo yêu cầu",
    text: "Muốn kiểu nào, màu nào, cứ nhắn cho shop, shop cắm theo ý bạn.",
    icon: <BouquetIcon />,
  },
  {
    title: "Tư vấn tận tình",
    text: "Nhắn Zalo hoặc gọi hotline, shop trả lời nhanh và nhiệt tình.",
    icon: <ChatIcon />,
  },
];

export default function WhyUs() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <h2 className="text-2xl font-bold text-ink">Vì sao chọn chúng tôi</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((r) => (
          <div key={r.title} className="rounded-2xl border border-line bg-card p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream text-brand">
              {r.icon}
            </span>
            <h3 className="mt-3 text-lg font-semibold text-ink">{r.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{r.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
