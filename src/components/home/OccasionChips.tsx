import Link from "next/link";
import { occasions } from "@/config/site";
import Reveal from "@/components/ui/Reveal";

// "Chọn hoa theo dịp" (mục 5.1 phụ lục): giữ từ Ngày 2, đặt trước khối
// danh mục đầu tiên trên trang chủ. Chip dẫn tới /hoa-tuoi?dip=<slug>.
export default function OccasionChips() {
  return (
    <section className="shell py-10" data-testid="occasion-chips">
      <Reveal>
        <h2 className="text-2xl text-ink sm:text-3xl">Chọn hoa theo dịp</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          {occasions.map((o) => (
            <Link
              key={o.slug}
              href={`/hoa-tuoi?dip=${o.slug}`}
              className="inline-flex min-h-11 items-center rounded-[3px] border border-line bg-white px-5 font-medium text-ink transition-colors duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.97]"
            >
              {o.label}
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
