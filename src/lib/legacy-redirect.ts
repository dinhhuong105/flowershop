// Chuyển hướng vĩnh viễn đường dẫn cũ sang trang tĩnh thay thế
// (Ngày 14 C2). Chỉ chuyển khi có trang ĐÃ XUẤT BẢN thay thế
// đường dẫn đó; nháp/bị xóa → trả về bình thường để trang cũ hiện
// như thường. Giữ nguyên query (?x=y), một lần chuyển (308),
// chỉ áp dụng cho GET/HEAD (trang tĩnh vốn chỉ có GET).
import { permanentRedirect } from "next/navigation";
import { getPublishedPageByLegacyPath } from "@/lib/admin/pages";

export async function redirectIfReplaced(
  legacyPath: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<void> {
  const replacement = await getPublishedPageByLegacyPath(legacyPath);
  if (!replacement) return;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    } else {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  permanentRedirect(`/${replacement.slug}${qs ? `?${qs}` : ""}`);
}
