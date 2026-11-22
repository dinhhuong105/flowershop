-- AlterTable
ALTER TABLE "products" ADD COLUMN "sku" TEXT,
ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
