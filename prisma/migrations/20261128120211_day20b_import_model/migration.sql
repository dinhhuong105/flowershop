-- Ngày 20 (bản sau Retry) B1 — căn chỉnh mô hình nhập sản phẩm
-- (chỉ thêm + đổi tên giữ dữ liệu, quay lại được).
-- SQL gốc do `prisma migrate diff --from-migrations --to-schema-datamodel`
-- sinh ra; đã sửa tay 4 chỗ:
--   1) Enum ImportBatchStatus: USING có CASE ánh xạ giá trị cũ
--      (pending→PREVIEW, running→RUNNING, done→DONE,
--      cancelled→ROLLED_BACK nếu ghi chú có "hoàn tác", còn lại
--      PREVIEW để chạy tiếp được) thay vì ép kiểu trực tiếp (vỡ
--      vì giá trị cũ không thuộc enum mới).
--   2) Đổi tên cột giữ dữ liệu (RENAME) thay vì DROP+ADD:
--      products.externalId→sourceExternalId,
--      createdCount→created, updatedCount→updated,
--      skippedCount→skipped, errorCount→failed.
--   3) LOẠI dòng AlterTable ngoài phạm vi: `admin_two_factor`
--      (SET DEFAULT 1 / DROP DEFAULT updatedAt) là lệch có sẵn từ
--      migration Ngày 19, không thuộc Ngày 20 — xem báo cáo.
--   4) Chuyển dữ liệu lô cũ sang mô hình mới: sourceKind suy từ
--      kind/fileName; rowsTotal đếm payload.rows; import_rows sao
--      từ payload.rows (đều PENDING — chạy lại an toàn nhờ khóa
--      duy nhất (sourceName, sourceExternalId)); mappingJson sao
--      từ payload; payload gọn lại (chỉ runStartedAt, hạn giữ lô,
--      lỗi đọc ban đầu).
-- CreateEnum
CREATE TYPE "ImportSourceKind" AS ENUM ('CSV', 'JSON', 'FEED_URL');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'CREATED', 'UPDATED', 'SKIPPED', 'ERROR');

-- AlterEnum
BEGIN;
CREATE TYPE "ImportBatchStatus_new" AS ENUM ('PREVIEW', 'RUNNING', 'DONE', 'FAILED', 'ROLLED_BACK');
ALTER TABLE "public"."import_batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "import_batches" ALTER COLUMN "status" TYPE "ImportBatchStatus_new" USING (CASE "status"::text
  WHEN 'pending' THEN 'PREVIEW'
  WHEN 'running' THEN 'RUNNING'
  WHEN 'done' THEN 'DONE'
  WHEN 'cancelled' THEN (CASE WHEN "notes" LIKE '%hoàn tác%' THEN 'ROLLED_BACK' ELSE 'PREVIEW' END)
  END::"ImportBatchStatus_new");
ALTER TYPE "ImportBatchStatus" RENAME TO "ImportBatchStatus_old";
ALTER TYPE "ImportBatchStatus_new" RENAME TO "ImportBatchStatus";
DROP TYPE "public"."ImportBatchStatus_old";
ALTER TABLE "import_batches" ALTER COLUMN "status" SET DEFAULT 'PREVIEW';
COMMIT;

-- Đổi tên cột giữ dữ liệu (thay DROP+ADD của diff)
ALTER TABLE "import_batches" RENAME COLUMN "createdCount" TO "created";
ALTER TABLE "import_batches" RENAME COLUMN "updatedCount" TO "updated";
ALTER TABLE "import_batches" RENAME COLUMN "skippedCount" TO "skipped";
ALTER TABLE "import_batches" RENAME COLUMN "errorCount" TO "failed";
ALTER TABLE "products" RENAME COLUMN "externalId" TO "sourceExternalId";
ALTER INDEX "products_sourceName_externalId_key" RENAME TO "products_sourceName_sourceExternalId_key";

-- Thêm cột mới cho import_batches
ALTER TABLE "import_batches" ADD COLUMN     "fileSha256" TEXT,
ADD COLUMN     "mappingJson" JSONB,
ADD COLUMN     "rightsConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "rightsConfirmedBy" TEXT,
ADD COLUMN     "rowsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceKind" "ImportSourceKind" NOT NULL DEFAULT 'CSV';

-- CreateTable
CREATE TABLE "import_rows" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "productId" INTEGER,
    "payload" JSONB,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mappings" (
    "sourceName" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("sourceName")
);

-- CreateIndex
CREATE INDEX "import_rows_batchId_status_idx" ON "import_rows"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_batchId_rowIndex_key" ON "import_rows"("batchId", "rowIndex");

-- CreateIndex
CREATE INDEX "products_source_idx" ON "products"("source");

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Chuyển dữ liệu lô cũ sang mô hình mới (chỉ có tác dụng khi đã
-- có lô cũ; DB hiện tại chưa có lô nào nên các lệnh này ảnh
-- hưởng 0 dòng — giữ lại để migration đúng trên mọi DB).
-- sourceKind suy từ kind/fileName.
UPDATE "import_batches" SET "sourceKind" = 'FEED_URL' WHERE "kind" = 'feed';
UPDATE "import_batches" SET "sourceKind" = 'JSON' WHERE "kind" = 'file' AND "fileName" ILIKE '%.json';

-- rowsTotal = số dòng đã đọc trong payload.rows.
UPDATE "import_batches"
SET "rowsTotal" = CASE WHEN jsonb_typeof("payload"->'rows') = 'array'
  THEN jsonb_array_length("payload"->'rows') ELSE 0 END
WHERE "payload" IS NOT NULL;

-- import_rows sao từ payload.rows (đều PENDING; chạy lại an toàn
-- nhờ khóa duy nhất (sourceName, sourceExternalId); productId nối
-- lại với SP đã tạo từ hàng đó nếu có).
INSERT INTO "import_rows" ("batchId", "rowIndex", "externalId", "status", "message", "productId", "payload")
SELECT b."id", (r.ord - 1), COALESCE(r.row->>'externalId', ''), 'PENDING', NULL,
  (SELECT p."id" FROM "products" p
    WHERE p."sourceName" = b."sourceName"
      AND p."sourceExternalId" = COALESCE(r.row->>'externalId', '')
    LIMIT 1),
  r.row
FROM "import_batches" b,
  LATERAL jsonb_array_elements(COALESCE(b."payload"->'rows', '[]'::jsonb)) WITH ORDINALITY AS r(row, ord)
WHERE b."payload" IS NOT NULL AND jsonb_typeof(b."payload"->'rows') = 'array';

-- mappingJson sao từ payload (mapping, ánh xạ danh mục, danh mục
-- mặc định, tùy chọn giá, cờ đã lưu ánh xạ).
UPDATE "import_batches"
SET "mappingJson" = jsonb_build_object(
  'mapping', COALESCE("payload"->'mapping', '{}'::jsonb),
  'categoryMapping', COALESCE("payload"->'categoryMapping', '{}'::jsonb),
  'defaultCategoryId', "payload"->'defaultCategoryId',
  'priceOptions', COALESCE("payload"->'priceOptions', jsonb_build_object('multiplier', 1, 'rounding', 'none')),
  'mappingSaved', COALESCE(("payload"->>'mappingSaved')::boolean, false))
WHERE "payload" IS NOT NULL;

-- Gọn payload cũ: bỏ các khóa đã chuyển sang import_rows /
-- mappingJson; lỗi đọc ban đầu đổi tên errors → parseErrors.
UPDATE "import_batches"
SET "payload" = (("payload"
    - 'rows' - 'mapping' - 'categoryMapping' - 'defaultCategoryId'
    - 'processed' - 'runErrors' - 'overwriteHandEdited' - 'mappingSaved')
  || jsonb_build_object('parseErrors', COALESCE("payload"->'errors', '[]'::jsonb)))
  - 'errors'
WHERE "payload" IS NOT NULL;
