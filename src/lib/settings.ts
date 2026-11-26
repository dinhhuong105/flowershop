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
import { validateTitleTemplate } from "./title-template";

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
  // Ngân hàng nhận chuyển khoản (Ngày 12 B1): nguồn thật duy nhất
  // là cài đặt này (trước đây là biến môi trường BANK_* — giờ env
  // chỉ còn là giá trị mặc định khi chưa lưu, xem DEFAULT_SETTINGS).
  bankCode: string; // mã BIN ngân hàng, 6 chữ số
  accountNumber: string; // STK, 6–19 chữ số
  accountName: string; // tên chủ TK, in hoa không dấu
  transferNoteTemplate: string; // mẫu nội dung, chứa {ORDER_CODE}
  bankEnabled: boolean; // false = ẩn "Chuyển khoản", chỉ còn COD
  // Telegram (Ngày 12 D1): chỉ lưu chat id; token bot ở biến môi
  // trường, KHÔNG BAO GIỜ lưu vào DB hay hiện ra giao diện/log.
  telegramChatId: string;
  telegramEnabled: boolean;
  // SEO (Ngày 13 C1): mẫu tiêu đề, mô tả mặc định, ảnh OG mặc
  // định, từ khóa, cho phép lập chỉ mục.
  titleTemplate: string; // chứa %s đúng một lần, vd "%s | Hoa Tươi Demo"
  defaultDescription: string;
  defaultOgImage: string; // URL ảnh jpg/png/webp, rỗng = không có
  metaKeywords: string;
  allowIndexing: boolean; // false = noindex toàn site + robots Disallow
};

export type SettingsGroup = "general" | "contact" | "bank" | "telegram" | "seo";

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
  bankCode: "bank.bankCode",
  accountNumber: "bank.accountNumber",
  accountName: "bank.accountName",
  transferNoteTemplate: "bank.transferNoteTemplate",
  bankEnabled: "bank.enabled",
  telegramChatId: "telegram.chatId",
  telegramEnabled: "telegram.enabled",
  titleTemplate: "seo.titleTemplate",
  defaultDescription: "seo.defaultDescription",
  defaultOgImage: "seo.defaultOgImage",
  metaKeywords: "seo.metaKeywords",
  allowIndexing: "seo.allowIndexing",
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
export const BANK_FIELDS = [
  "bankCode",
  "accountNumber",
  "accountName",
  "transferNoteTemplate",
  "bankEnabled",
] as const;
export const TELEGRAM_FIELDS = ["telegramChatId", "telegramEnabled"] as const;
export const SEO_FIELDS = [
  "titleTemplate",
  "defaultDescription",
  "defaultOgImage",
  "metaKeywords",
  "allowIndexing",
] as const;

// Trường boolean trong ShopSettings (lưu DB dạng "true"/"false").
const BOOLEAN_FIELDS = new Set<keyof ShopSettings>([
  "bankEnabled",
  "telegramEnabled",
  "allowIndexing",
]);

// Mặc định ngân hàng từ BIẾN MÔI TRƯỜNG hiện hành (B4: seed bank
// bằng đúng giá trị hiện hành, enabled giữ như hiện trạng để shop
// không đổi). Env trống (như production hiện nay: không có BANK_*)
// → bank chưa cấu hình, enabled = false. Nhận env làm tham số để
// test được trực tiếp (mặc định là process.env lúc gọi).
export function defaultBankFromEnv(
  env: Record<string, string | undefined> = process.env,
): Pick<
  ShopSettings,
  "bankCode" | "accountNumber" | "accountName" | "bankEnabled"
> {
  const bankCode = (env.BANK_BIN ?? "").trim();
  const accountNumber = (env.BANK_ACCOUNT ?? "").trim();
  const accountName = (env.BANK_ACCOUNT_NAME ?? "").trim();
  const configured =
    /^\d{6}$/.test(bankCode) &&
    /^\d{6,19}$/.test(accountNumber) &&
    accountName !== "";
  return {
    bankCode: /^\d{6}$/.test(bankCode) ? bankCode : "",
    accountNumber: /^\d{6,19}$/.test(accountNumber) ? accountNumber : "",
    accountName,
    bankEnabled: configured,
  };
}

// Mặc định Telegram từ BIẾN MÔI TRƯỜNG (Ngày 13 A2): trước Ngày
// 12, thông báo đơn gửi khi env có token + chat id. Khi chưa có
// dòng telegram trong DB, enabled phải suy ra từ env (có đủ thì
// bật) để hành vi không đổi. Chat id mặc định vẫn rỗng vì đường
// gửi đã fallback về env TELEGRAM_CHAT_ID (getTelegramChatId).
export function defaultTelegramEnabledFromEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    (env.TELEGRAM_BOT_TOKEN ?? "").trim() !== "" &&
    (env.TELEGRAM_CHAT_ID ?? "").trim() !== ""
  );
}

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
  ...defaultBankFromEnv(),
  // Khác B1 một chữ: mẫu mặc định là "DH {ORDER_CODE}" (đúng nội
  // dung chuyển khoản hiện hành từ Ngày 5), không phải "{ORDER_CODE}"
  // — để shop không đổi khi seed; xem "Độ lệch" báo cáo Ngày 12.
  transferNoteTemplate: "DH {ORDER_CODE}",
  telegramChatId: "",
  telegramEnabled: defaultTelegramEnabledFromEnv(),
  // SEO (Ngày 13 C1, Ngày 14 B1): mẫu tiêu đề mặc định dùng
  // {siteName} nên đổi tên shop trong Cài đặt chung thì tiêu đề đổi
  // theo; dòng DB cũ (nếu có) giữ nguyên mẫu chữ cứng cũ.
  titleTemplate: `%s | {siteName}`,
  defaultDescription: siteConfig.description,
  defaultOgImage: "",
  metaKeywords: "",
  allowIndexing: true,
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

// Che STK trong nhật ký (B3): chỉ giữ 4 số cuối.
export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `****${digits.slice(-4)}`;
}

// Dựng nội dung chuyển khoản từ mẫu (thuần): thay {ORDER_CODE} bằng
// mã đơn. Mẫu không chứa placeholder thì trả nguyên mẫu.
export function renderTransferContent(template: string, orderCode: string): string {
  return template.replaceAll("{ORDER_CODE}", orderCode);
}

// Kiểm hợp lệ nhóm bank (thuần, B1). enabled = false thì các trường
// được để trống (không hiện "Chuyển khoản"); enabled = true thì cả
// ba trường bắt buộc + đúng định dạng. Mẫu nội dung luôn phải có
// đúng một {ORDER_CODE}, chỉ chữ/số/khoảng trắng ASCII, ≤ 50 ký tự,
// kết quả cuối (với mã đơn 10 ký tự) ≤ 25 ký tự (giới hạn thực tế
// của buildVietQrPayload — xem B0).
export function validateBankValues(input: {
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  transferNoteTemplate?: string;
  bankEnabled?: boolean;
}): {
  values: Pick<
    ShopSettings,
    "bankCode" | "accountNumber" | "accountName" | "transferNoteTemplate" | "bankEnabled"
  >;
  errors: SettingsFieldErrors;
} {
  const bankCode = (input.bankCode ?? "").trim();
  const accountNumber = (input.accountNumber ?? "").trim();
  // Tên chủ TK: chuẩn hóa in hoa (không dấu vẫn phải tự nhập đúng —
  // có dấu thì báo lỗi, không tự bỏ dấu).
  const accountName = (input.accountName ?? "").trim().toUpperCase();
  const transferNoteTemplate = (input.transferNoteTemplate ?? "").trim();
  const bankEnabled = input.bankEnabled ?? false;
  const errors: SettingsFieldErrors = {};

  if (bankCode !== "" && !/^\d{6}$/.test(bankCode)) {
    errors.bankCode = "Mã BIN ngân hàng phải gồm đúng 6 chữ số.";
  } else if (bankEnabled && bankCode === "") {
    errors.bankCode = "Chọn ngân hàng khi bật chuyển khoản.";
  }
  if (accountNumber !== "" && !/^\d{6,19}$/.test(accountNumber)) {
    errors.accountNumber = "Số tài khoản chỉ gồm chữ số, từ 6 đến 19 ký tự.";
  } else if (bankEnabled && accountNumber === "") {
    errors.accountNumber = "Nhập số tài khoản khi bật chuyển khoản.";
  }
  if (accountName !== "" && !/^[A-Z0-9 ]{2,50}$/.test(accountName)) {
    errors.accountName =
      "Tên chủ tài khoản viết hoa không dấu, chỉ chữ/số/khoảng trắng, từ 2 đến 50 ký tự.";
  } else if (bankEnabled && accountName === "") {
    errors.accountName = "Nhập tên chủ tài khoản khi bật chuyển khoản.";
  }
  const placeholderCount = transferNoteTemplate.split("{ORDER_CODE}").length - 1;
  const templateBody = transferNoteTemplate.replaceAll("{ORDER_CODE}", "");
  if (transferNoteTemplate === "") {
    errors.transferNoteTemplate = "Nhập mẫu nội dung chuyển khoản.";
  } else if (placeholderCount !== 1) {
    errors.transferNoteTemplate = "Mẫu nội dung phải chứa đúng một lần {ORDER_CODE}.";
  } else if (!/^[A-Za-z0-9 ]*$/.test(templateBody)) {
    errors.transferNoteTemplate =
      "Mẫu nội dung chỉ gồm chữ/số/khoảng trắng (không dấu) và {ORDER_CODE}.";
  } else if (transferNoteTemplate.length > 50) {
    errors.transferNoteTemplate = "Mẫu nội dung tối đa 50 ký tự.";
  } else if (renderTransferContent(transferNoteTemplate, "0123456789").length > 25) {
    errors.transferNoteTemplate =
      "Nội dung chuyển khoản cuối cùng tối đa 25 ký tự (giới hạn VietQR).";
  }
  return {
    values: { bankCode, accountNumber, accountName, transferNoteTemplate, bankEnabled },
    errors,
  };
}

// Kiểm hợp lệ nhóm telegram (thuần, D1/D5). Chat id: số (âm được,
// cho nhóm/kênh) 5–20 chữ số, hoặc @tên-kênh. enabled = true thì
// chat id bắt buộc.
export function validateTelegramValues(input: {
  telegramChatId?: string;
  telegramEnabled?: boolean;
}): {
  values: Pick<ShopSettings, "telegramChatId" | "telegramEnabled">;
  errors: SettingsFieldErrors;
} {
  const telegramChatId = (input.telegramChatId ?? "").trim();
  const telegramEnabled = input.telegramEnabled ?? false;
  const errors: SettingsFieldErrors = {};
  const chatIdOk =
    telegramChatId === "" ||
    /^-?\d{5,20}$/.test(telegramChatId) ||
    /^@[A-Za-z0-9_]{5,}$/.test(telegramChatId);
  if (!chatIdOk) {
    errors.telegramChatId =
      "Chat id không đúng định dạng (số 5–20 chữ số, có thể âm, hoặc @tên-kênh).";
  } else if (telegramEnabled && telegramChatId === "") {
    errors.telegramChatId = "Nhập chat id khi bật thông báo Telegram.";
  }
  return { values: { telegramChatId, telegramEnabled }, errors };
}

// Kiểm hợp lệ nhóm seo (thuần, C1 + B1 Ngày 14). titleTemplate bắt
// buộc, chứa %s đúng một lần, {siteName} tối đa một lần, mọi {...}
// khác bị từ chối, ≤ 80 ký tự. defaultDescription ≤ 160 (được để
// trống — trống thì mặt shop dùng slogan). defaultOgImage: rỗng
// hoặc URL ảnh jpg/png/webp (không nhận SVG cho OG). metaKeywords
// ≤ 200, tùy chọn.
export function validateSeoValues(input: {
  titleTemplate?: string;
  defaultDescription?: string;
  defaultOgImage?: string;
  metaKeywords?: string;
  allowIndexing?: boolean;
}): {
  values: Pick<
    ShopSettings,
    "titleTemplate" | "defaultDescription" | "defaultOgImage" | "metaKeywords" | "allowIndexing"
  >;
  errors: SettingsFieldErrors;
} {
  const titleTemplate = (input.titleTemplate ?? "").trim();
  const defaultDescription = (input.defaultDescription ?? "").trim();
  const defaultOgImage = (input.defaultOgImage ?? "").trim();
  const metaKeywords = (input.metaKeywords ?? "").trim();
  const allowIndexing = input.allowIndexing ?? true;
  const errors: SettingsFieldErrors = {};
  const templateError = validateTitleTemplate(titleTemplate);
  if (templateError) errors.titleTemplate = templateError;
  if (defaultDescription.length > 160) {
    errors.defaultDescription = "Mô tả mặc định tối đa 160 ký tự.";
  }
  if (defaultOgImage !== "") {
    const ogOk =
      isImageUrl(defaultOgImage) &&
      /\.(png|jpe?g|webp)(\?|#|$)/i.test(defaultOgImage);
    if (!ogOk) {
      errors.defaultOgImage = "Ảnh OG phải là đường dẫn ảnh JPEG, PNG hoặc WebP.";
    }
  }
  if (metaKeywords.length > 200) {
    errors.metaKeywords = "Từ khóa tối đa 200 ký tự.";
  }
  return {
    values: { titleTemplate, defaultDescription, defaultOgImage, metaKeywords, allowIndexing },
    errors,
  };
}

// Đọc các khóa đã lưu (không cache — lớp cache ở settings-cache.ts).
export async function readSettingsFromDb(): Promise<Partial<ShopSettings>> {
  const rows = await db.siteSetting.findMany();
  const out: Partial<ShopSettings> = {};
  for (const row of rows) {
    const field = KEY_TO_FIELD[row.key];
    if (!field) continue;
    // Trường boolean lưu DB dạng "true"/"false".
    if (BOOLEAN_FIELDS.has(field)) {
      (out as Record<string, unknown>)[field] = row.value === "true";
    } else {
      (out as Record<string, unknown>)[field] = row.value;
    }
  }
  return out;
}

// Gộp giá trị DB lên trên mặc định. Chuỗi rỗng trong DB vẫn tính là
// đã đặt (vd Henry xóa giờ mở cửa → footer ẩn dòng đó).
export function mergeSettings(partial: Partial<ShopSettings>): ShopSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

// Chuyển giá trị trường về chuỗi lưu DB: boolean → "true"/"false",
// chuỗi thiếu → "" (giữ hành vi cũ cho general/contact), boolean
// thiếu → giá trị mặc định.
function fieldToDbString(field: keyof ShopSettings, value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === undefined || value === null) {
    const d = DEFAULT_SETTINGS[field];
    return typeof d === "boolean" ? (d ? "true" : "false") : "";
  }
  return String(value);
}

// Giá trị ghi nhật ký: STK chỉ giữ 4 số cuối (B3); các khóa khác
// giữ nguyên (đã là hành vi cũ).
function auditValueFor(field: keyof ShopSettings, dbValue: string): string {
  return field === "accountNumber" ? maskAccountNumber(dbValue) : dbValue;
}

const GROUP_FIELDS: Record<SettingsGroup, ReadonlyArray<keyof ShopSettings>> = {
  general: GENERAL_FIELDS,
  contact: CONTACT_FIELDS,
  bank: BANK_FIELDS,
  telegram: TELEGRAM_FIELDS,
  seo: SEO_FIELDS,
};

// Ghi một dòng nhật ký thủ công (không kèm thay đổi cài đặt): dùng
// cho "bank.notify" — kết quả gửi tin Telegram khi nhóm bank đổi
// (B3). Khóa "bank.notify" không phải khóa cài đặt nên không bị
// đọc nhầm thành cài đặt (readSettingsFromDb bỏ qua khóa lạ).
export async function recordSettingsAudit(
  key: string,
  oldValue: string | null,
  newValue: string,
  updatedBy: string,
): Promise<void> {
  await db.settingsAudit.create({ data: { key, oldValue, newValue, updatedBy } });
}

// Ghi một nhóm đã kiểm hợp lệ: chỉ ghi các khóa ĐÃ ĐỔI, ghi nhật ký
// (audit) cho từng khóa đổi, trong một transaction.
export async function saveSettingsToDb(
  group: SettingsGroup,
  values: Partial<ShopSettings>,
  updatedBy: string,
): Promise<string[]> {
  const fields = GROUP_FIELDS[group];
  const saved: string[] = [];
  await db.$transaction(async (tx) => {
    for (const field of fields) {
      // Trường không có trong values thì KHÔNG động tới (lưu từng
      // phần không được xóa các khóa còn lại của nhóm — lỗi phát hiện
      // khi viết test:db Ngày 12 cho bankEnabled).
      if (!Object.hasOwn(values, field) || values[field] === undefined) continue;
      const key = SETTING_KEYS[field];
      const newValue = fieldToDbString(field, values[field]);
      const existing = await tx.siteSetting.findUnique({ where: { key } });
      // "Đã đổi" so với giá trị HIỆU DỤNG (giá trị DB nếu có, không
      // thì mặc định): lưu "" khi mặc định đã là "" thì không đổi,
      // không ghi dòng thừa và không ghi nhật ký.
      const oldEffective = existing?.value ?? fieldToDbString(field, DEFAULT_SETTINGS[field]);
      if (oldEffective === newValue) continue;
      await tx.siteSetting.upsert({
        where: { key },
        update: { value: newValue, updatedBy },
        create: { key, value: newValue, updatedBy },
      });
      await tx.settingsAudit.create({
        data: {
          key,
          oldValue: existing?.value == null ? null : auditValueFor(field, existing.value),
          newValue: auditValueFor(field, newValue),
          updatedBy,
        },
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
    // Boolean lưu dạng "true"/"false" (xem fieldToDbString).
    value: fieldToDbString(field, DEFAULT_SETTINGS[field]),
    updatedBy: "seed",
  }));
  await db.siteSetting.createMany({ data: rows });
  return rows.length;
}
