-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('EXPRESS_2H', 'SAME_DAY', 'SCHEDULED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "deliverySurcharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_senderPhone_createdAt_idx" ON "orders"("senderPhone", "createdAt");
