// Cài đặt shop (Ngày 11 B2): bảng key-value site_settings +
// getSettings() có giá trị mặc định + saveSettings() kiểm hợp lệ.
// Module này KHÔNG import next/* nên test được trực tiếp (unit +
// test:db). Lớp cache theo tag nằm ở ./settings-cache.ts.
//
// Mặc định = ĐÚNG chữ đang hiển thị trên shop hiện nay (đặc tả):
// DB trống thì shop không đổi gì. Seed chỉ ghi mặc định khi bảng
// trống (seed-guard), không ghi đè dữ liệu Henry nhập.

import { siteConfig } from "@/config/site";
import { db } from "@/lib/db";
import { isValidEmail, isValidPhone, normalizePhone } from "./checkout-validation";

export type ShopSettings = {
  siteName: string;
  slogan: string;
  logo: string;
  favicon: string;
  hotline: string;
  zalo: string;
  email: string;
  address: string;
  openHours: string;
  facebook: string;
  instagram: string;
  tiktok: string;
};

export type SettingsGroup = "general" | "contact";

// Khóa trong bảng site_settings: "nhóm.trường".
export const SETTING_KEYS = {
  siteName: "general.siteName",
  slogan: "general.slogan",
  logo: "general.logo",
  favicon: "general.favicon",
  hotline: "contact.hotline",
  zalo: "contact.zalo",
  email: "contact.email",
  address: "contact.address",
  openHours: "contact.openHours",
  facebook: "contact.facebook",
  instagram: "contact.instagram",
  tiktok: "contact.tiktok",
} as const satisfies Record<keyof ShopSettings, string>;

const KEY_TO_FIELD = Object.fromEntries(
  Object.entries(SETTING_KEYS).map(([field, key]) => [key, field as keyof ShopSettings]),
) as Record<string, keyof ShopSettings>;

export const GENERAL_FIELDS = ["siteName", "slogan", "logo", "favicon"] as const;
export const CONTACT_FIELDS = [
  "hotline",
  "zalo",
  "email",
  "address",
  "openHours",
  "facebook",
  "instagram",
  "tiktok",
] as const;

// Mặc định = chữ đang hiển thị trên shop (xem site.ts): tên shop,
// dòng mô tả dưới tên ở footer (slogan), giờ mở cửa; hotline/Zalo/
// địa chỉ đang rỗng vì số giữ chỗ trong .env mẫu đã bị lọc ở site.ts.
export const DEFAULT_SETTINGS: ShopSettings = {
  siteName: siteConfig.name,
  slogan: siteConfig.description,
  logo: "",
  favicon: "",
  hotline: siteConfig.hotline,
  zalo: siteConfig.zaloPhone,
  email: "",
  address: siteConfig.address,
  openHours: siteConfig.openHours,
  facebook: "",
  instagram: "",
  tiktok: "",
};

export type SettingsFieldErrors = Partial<Record<keyof ShopSettings, string>>;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// URL ảnh logo/favicon: đường dẫn nội bộ bắt đầu "/" hoặc URL http(s);
// đuôi phải là png/jpg/webp/svg (bỏ query/fragment khi kiểm).
function isImageUrl(value: string): boolean {
  if (value.startsWith("/")) {
    return /\.(png|jpe?g|webp|svg)(\?|#|$)/i.test(value);
  }
  if (!isHttpUrl(value)) return false;
  return /\.(png|jpe?g|webp|svg)(\?|#|$)/i.test(value);
}

function isEmail(value: string): boolean {
  return isValidEmail(value);
}

function checkPhone(value: string): string | null {
  if (value === "") return null;
  return isValidPhone(value) ? null : "Số điện thoại không đúng định dạng Việt Nam.";
}

function checkSocialUrl(value: string): string | null {
  if (value === "") return null;
  if (!value.startsWith("https://")) return "Đường dẫn phải bắt đầu bằng https://.";
  return isHttpUrl(value) ? null : "Đường dẫn không hợp lệ.";
}

// Kiểm hợp lệ từng nhóm (thuần, dùng ở Server Action + test).
// Trả { values (đã chuẩn hóa: trim, SĐT chuẩn hóa) , errors }.
export function validateGeneralValues(input: {
  siteName?: string;
  slogan?: string;
  logo?: string;
  favicon?: string;
}): {
  values: Pick<ShopSettings, "siteName" | "slogan" | "logo" | "favicon">;
  errors: SettingsFieldErrors;
} {
  const siteName = (input.siteName ?? "").trim();
  const slogan = (input.slogan ?? "").trim();
  const logo = (input.logo ?? "").trim();
  const favicon = (input.favicon ?? "").trim();
  const errors: SettingsFieldErrors = {};
  if (siteName.length < 2 || siteName.length > 80) {
    errors.siteName = "Tên website phải từ 2 đến 80 ký tự.";
  }
  // Slogan là dòng mô tả dưới tên shop ở footer: tối đa 200 ký tự
  // (cùng giới hạn với giờ làm việc; đặc tả không ghi riêng).
  if (slogan.length > 200) {
    errors.slogan = "Slogan tối đa 200 ký tự.";
  }
  if (logo !== "" && !isImageUrl(logo)) {
    errors.logo = "Logo phải là đường dẫn ảnh (png, jpg, webp, svg).";
  }
  if (favicon !== "" && !isImageUrl(favicon)) {
    errors.favicon = "Favicon phải là đường dẫn ảnh (png, jpg, webp, svg).";
  }
  return { values: { siteName, slogan, logo, favicon }, errors };
}

export function validateContactValues(input: {
  hotline?: string;
  zalo?: string;
  email?: string;
  address?: string;
  openHours?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
}): {
  values: Pick<
    ShopSettings,
    "hotline" | "zalo" | "email" | "address" | "openHours" | "facebook" | "instagram" | "tiktok"
  >;
  errors: SettingsFieldErrors;
} {
  const hotline = normalizePhone(input.hotline ?? "");
  const zalo = normalizePhone(input.zalo ?? "");
  const email = (input.email ?? "").trim();
  const address = (input.address ?? "").trim();
  const openHours = (input.openHours ?? "").trim();
  const facebook = (input.facebook ?? "").trim();
  const instagram = (input.instagram ?? "").trim();
  const tiktok = (input.tiktok ?? "").trim();
  const errors: SettingsFieldErrors = {};
  const hotlineError = checkPhone(hotline);
  if (hotlineError) errors.hotline = hotlineError;
  const zaloError = checkPhone(zalo);
  if (zaloError) errors.zalo = zaloError;
  if (email !== "" && !isEmail(email)) errors.email = "Email không hợp lệ.";
  if (address.length > 200) errors.address = "Địa chỉ tối đa 200 ký tự.";
  if (openHours.length > 200) errors.openHours = "Giờ làm việc tối đa 200 ký tự.";
  const facebookError = checkSocialUrl(facebook);
  if (facebookError) errors.facebook = facebookError;
  const instagramError = checkSocialUrl(instagram);
  if (instagramError) errors.instagram = instagramError;
  const tiktokError = checkSocialUrl(tiktok);
  if (tiktokError) errors.tiktok = tiktokError;
  return {
    values: { hotline, zalo, email, address, openHours, facebook, instagram, tiktok },
    errors,
  };
}

// Đọc các khóa đã lưu (không cache — lớp cache ở settings-cache.ts).
export async function readSettingsFromDb(): Promise<Partial<ShopSettings>> {
  const rows = await db.siteSetting.findMany();
  const out: Partial<ShopSettings> = {};
  for (const row of rows) {
    const field = KEY_TO_FIELD[row.key];
    if (field) out[field] = row.value;
  }
  return out;
}

// Gộp giá trị DB lên trên mặc định. Chuỗi rỗng trong DB vẫn tính là
// đã đặt (vd Henry xóa giờ mở cửa → footer ẩn dòng đó).
export function mergeSettings(partial: Partial<ShopSettings>): ShopSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

// Ghi một nhóm đã kiểm hợp lệ: chỉ ghi các khóa ĐÃ ĐỔI, ghi nhật ký
// (audit) cho từng khóa đổi, trong một transaction.
export async function saveSettingsToDb(
  group: SettingsGroup,
  values: Partial<ShopSettings>,
  updatedBy: string,
): Promise<string[]> {
  const fields = group === "general" ? GENERAL_FIELDS : CONTACT_FIELDS;
  const saved: string[] = [];
  await db.$transaction(async (tx) => {
    for (const field of fields) {
      const key = SETTING_KEYS[field];
      const newValue = values[field] ?? "";
      const existing = await tx.siteSetting.findUnique({ where: { key } });
      // "Đã đổi" so với giá trị HIỆU DỤNG (giá trị DB nếu có, không
      // thì mặc định): lưu "" khi mặc định đã là "" thì không đổi,
      // không ghi dòng thừa và không ghi nhật ký.
      const oldEffective = existing?.value ?? DEFAULT_SETTINGS[field];
      if (oldEffective === newValue) continue;
      await tx.siteSetting.upsert({
        where: { key },
        update: { value: newValue, updatedBy },
        create: { key, value: newValue, updatedBy },
      });
      await tx.settingsAudit.create({
        data: { key, oldValue: existing?.value ?? null, newValue, updatedBy },
      });
      saved.push(key);
    }
  });
  return saved;
}

// Seed mặc định: CHỈ khi bảng trống (seed-guard) — không ghi đè dữ
// liệu Henry đã nhập. Trả số dòng đã tạo (0 khi bảng đã có dữ liệu).
export async function seedDefaultSettings(): Promise<number> {
  const count = await db.siteSetting.count();
  if (count > 0) return 0;
  const rows = (Object.keys(DEFAULT_SETTINGS) as Array<keyof ShopSettings>).map((field) => ({
    key: SETTING_KEYS[field],
    value: DEFAULT_SETTINGS[field],
    updatedBy: "seed",
  }));
  await db.siteSetting.createMany({ data: rows });
  return rows.length;
}
