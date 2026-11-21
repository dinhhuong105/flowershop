import Link from "next/link";
import { occasions } from "@/config/site";

export default function OccasionChips() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <h2 className="text-2xl font-bold text-ink">Chọn hoa theo dịp</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        {occasions.map((o) => (
          <Link
            key={o.slug}
            href={`/hoa-tuoi?dip=${o.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-5 font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            {o.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
