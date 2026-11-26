-- Cài đặt shop (Ngày 11 B2): bảng key-value + nhật ký thay đổi.
-- Quay lại: tạo migration mới với DROP TABLE "settings_audit";
-- DROP TABLE "site_settings"; (Prisma không có down-migration).
CREATE TABLE "site_settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "settings_audit" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "settings_audit_key_createdAt_idx" ON "settings_audit"("key", "createdAt");
