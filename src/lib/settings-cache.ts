// Lớp cache cho getSettings() (Ngày 11 B2): đọc qua unstable_cache
// với tag "site-settings" — layout + trang shop đọc qua đây để mỗi
// request không truy vấn DB; lưu xong, Server Action gọi
// revalidateTag("site-settings") để mặt shop cập nhật ngay.
// Tách riêng khỏi ./settings.ts để module đó không import next/*
// và test được trực tiếp.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { mergeSettings, readSettingsFromDb, type ShopSettings } from "./settings";

const cachedRead = unstable_cache(
  async (): Promise<Partial<ShopSettings>> => readSettingsFromDb(),
  ["site-settings"],
  { tags: ["site-settings"] },
);

// Bọc thêm bằng React cache() (Ngày 19 B2): unstable_cache KHÔNG gộp
// các lần gọi đồng thời khi cache còn lạnh — đo B1 thấy request đầu
// đọc site_settings tới 3 lần (generateMetadata + layout + UspStrip).
// React cache() gộp các lần gọi trong cùng một request thành 1 lần
// đọc; ngoài request Next (test tsx) nó chỉ đi qua, không lỗi.
export const getSettings = cache(async (): Promise<ShopSettings> => {
  return mergeSettings(await cachedRead());
});
