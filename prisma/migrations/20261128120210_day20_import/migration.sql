-- Ngày 20 C1 — bộ nhập sản phẩm (chỉ thêm, quay lại được).
-- SQL do `prisma migrate diff --from-schema-datasource --to-schema-datamodel`
-- sinh ra (live DB → schema); đã LOẠI một AlterTable ngoài phạm vi:
-- `admin_two_factor` (SET DEFAULT 1 / DROP DEFAULT updatedAt) là
-- lệch có sẵn từ migration Ngày 19, không thuộc Ngày 20 — xem báo cáo.
-- CreateEnum
CREATE TYPE "ImportBatchKind" AS ENUM ('file', 'feed');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('pending', 'running', 'done', 'cancelled');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "importBatchId" INTEGER,
ADD COLUMN     "importedAt" TIMESTAMP(3),
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "sourceName" TEXT NOT NULL,
    "kind" "ImportBatchKind" NOT NULL,
    "fileName" TEXT,
    "sourceUrl" TEXT,
    "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'pending',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "payload" JSONB,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_importBatchId_idx" ON "products"("importBatchId");

-- CreateIndex
CREATE INDEX "products_needsReview_idx" ON "products"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "products_sourceName_externalId_key" ON "products"("sourceName", "externalId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
