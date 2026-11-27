-- Ngày 17 S9: bảng sự kiện cho giới hạn tốc độ dùng chung
-- (rate_limit_events) — một hàng = một lần dùng của một khóa.
-- Rollback: DROP TABLE "rate_limit_events";
CREATE TABLE "rate_limit_events" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rate_limit_events_key_createdAt_idx" ON "rate_limit_events"("key", "createdAt");
