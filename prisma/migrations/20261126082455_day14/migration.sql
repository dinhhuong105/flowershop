-- Ngày 14 C1: cột legacyPath trên bảng pages (đường dẫn cũ được thay
-- thế, duy nhất khi có giá trị; NULL được phép nhiều dòng).
-- Rollback: DROP INDEX "pages_legacyPath_key"; ALTER TABLE "pages" DROP COLUMN "legacyPath";
ALTER TABLE "pages" ADD COLUMN "legacyPath" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pages_legacyPath_key" ON "pages"("legacyPath");

-- Ngày 14 D1: SEO riêng cho sản phẩm và danh mục (cho phép rỗng).
-- Rollback: ALTER TABLE "products" DROP COLUMN "seoTitle", DROP COLUMN "seoDescription";
--           ALTER TABLE "categories" DROP COLUMN "seoTitle", DROP COLUMN "seoDescription";
ALTER TABLE "products" ADD COLUMN "seoTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "seoDescription" TEXT NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN "seoTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "categories" ADD COLUMN "seoDescription" TEXT NOT NULL DEFAULT '';
