// Lớp cache đọc ổn định cho trang tĩnh đã xuất bản (Ngày 19 B2).
// Hàm DB thô vẫn nằm ở ./admin/pages.ts (test db dùng trực tiếp —
// unstable_cache ném lỗi ngoài runtime Next nên KHÔNG được bọc hàm
// thô). Chỉ dữ liệu công khai (trang đã xuất bản, chân trang, map
// đường dẫn cũ); mọi Server Action sửa trang gọi
// revalidateTag("footer-pages") / revalidateTag("published-pages")
// để mặt shop cập nhật ngay (xem src/app/actions/admin.ts).
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
  getPublishedPageBySlug,
  type PublishedPage,
} from "./admin/pages";

// Một truy vấn duy nhất vào bảng pages cho cả chân trang lẫn map
// đường dẫn cũ (trước đây là 2 truy vấn riêng mỗi request).
type FooterPageRow = {
  slug: string;
  title: string;
  legacyPath: string | null;
  showInFooter: boolean;
};

async function readFooterRows(): Promise<FooterPageRow[]> {
  return db.page.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { slug: true, title: true, legacyPath: true, showInFooter: true },
  });
}

const cachedFooterRows = unstable_cache(readFooterRows, ["footer-pages"], {
  tags: ["footer-pages"],
});

// Ngoài runtime Next (test tsx, script): unstable_cache ném
// "incrementalCache missing" — đọc thẳng DB, không cache.
const getFooterRows = cache(async (): Promise<FooterPageRow[]> => {
  try {
    return await cachedFooterRows();
  } catch {
    return readFooterRows();
  }
});

export const getCachedFooterPages = cache(
  async (): Promise<Array<{ slug: string; title: string }>> => {
    const rows = await getFooterRows();
    return rows
      .filter((r) => r.showInFooter)
      .map((r) => ({ slug: r.slug, title: r.title }));
  },
);

export const getCachedLegacyReplacements = cache(
  async (): Promise<Map<string, string>> => {
    const rows = await getFooterRows();
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.legacyPath !== null) map.set(row.legacyPath, row.slug);
    }
    return map;
  },
);

// Tra trang đã xuất bản theo slug, cache qua request (React cache)
// và qua các request (unstable_cache, tag "published-pages").
// unstable_cache tuần tự hóa JSON nên updatedAt: Date đi qua cache
// về thành chuỗi — khôi phục lại thành Date ở đây để kiểu
// PublishedPage không đổi với nơi gọi.
const cachedPageBySlug = unstable_cache(
  async (slug: string): Promise<PublishedPage | null> =>
    getPublishedPageBySlug(slug),
  ["published-page-by-slug"],
  { tags: ["published-pages"] },
);

export const getCachedPublishedPageBySlug = cache(
  async (slug: string): Promise<PublishedPage | null> => {
    let page: PublishedPage | null;
    try {
      page = await cachedPageBySlug(slug);
    } catch {
      // Ngoài runtime Next: đọc thẳng DB, không cache (xem trên).
      page = await getPublishedPageBySlug(slug);
    }
    if (!page) return null;
    return {
      ...page,
      updatedAt:
        page.updatedAt instanceof Date
          ? page.updatedAt
          : new Date(page.updatedAt),
    };
  },
);
