import { siteConfig, telHref } from "@/config/site";

export default function TopBar() {
  return (
    <div className="bg-brand text-sm text-white">
      <div className="mx-auto flex min-h-11 w-full max-w-[1200px] items-center justify-end gap-4 px-4 sm:justify-between">
        <p className="hidden sm:block">{siteConfig.strapline}</p>
        <a
          href={telHref(siteConfig.hotline)}
          className="flex min-h-11 items-center font-medium hover:underline"
        >
          Tư vấn: {siteConfig.hotline}
        </a>
      </div>
    </div>
  );
}
