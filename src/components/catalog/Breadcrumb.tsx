import Link from "next/link";

// Breadcrumb 2 cấp (Trang chủ › danh mục) hoặc 3 cấp (Trang chủ ›
// danh mục › sản phẩm, khi truyền productName + categorySlug).
export default function Breadcrumb({
  categoryName,
  categorySlug,
  productName,
  tone = "light",
}: {
  categoryName: string;
  categorySlug?: string;
  productName?: string;
  tone?: "light" | "dark";
}) {
  const linkClass =
    tone === "dark"
      ? "text-white/80 transition-colors duration-150 hover:text-white hover:underline"
      : "text-muted transition-colors duration-150 hover:text-green-800 hover:underline";
  const currentClass = tone === "dark" ? "font-semibold text-white" : "font-semibold text-ink";
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        <li>
          <Link href="/" className={`flex min-h-11 items-center gap-1.5 ${linkClass}`}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M9 21v-6h6v6" />
            </svg>
            Trang chủ
          </Link>
        </li>
        <li aria-hidden="true" className={tone === "dark" ? "text-white/60" : "text-muted"}>
          ›
        </li>
        {productName ? (
          <>
            <li>
              <Link
                href={categorySlug ? `/${categorySlug}` : "#"}
                className={`flex min-h-11 items-center ${linkClass}`}
              >
                {categoryName}
              </Link>
            </li>
            <li aria-hidden="true" className={tone === "dark" ? "text-white/60" : "text-muted"}>
              ›
            </li>
            <li aria-current="page" className={currentClass}>
              {productName}
            </li>
          </>
        ) : (
          <li aria-current="page" className={currentClass}>
            {categoryName}
          </li>
        )}
      </ol>
    </nav>
  );
}
