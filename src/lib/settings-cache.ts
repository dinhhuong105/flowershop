// Lớp cache cho getSettings() (Ngày 11 B2): đọc qua unstable_cache
// với tag "site-settings" — layout + trang shop đọc qua đây để mỗi
// request không truy vấn DB; lưu xong, Server Action gọi
// revalidateTag("site-settings") để mặt shop cập nhật ngay.
// Tách riêng khỏi ./settings.ts để module đó không import next/*
// và test được trực tiếp.
import { unstable_cache } from "next/cache";
import { mergeSettings, readSettingsFromDb, type ShopSettings } from "./settings";

const cachedRead = unstable_cache(
  async (): Promise<Partial<ShopSettings>> => readSettingsFromDb(),
  ["site-settings"],
  { tags: ["site-settings"] },
);

export async function getSettings(): Promise<ShopSettings> {
  return mergeSettings(await cachedRead());
}
