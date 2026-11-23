-- Trang quản trị Ngày 7: phiên đăng nhập + giới hạn thử sai.
-- Chỉ lưu hash sha256 của token phiên và của IP, không lưu giá trị gốc.
CREATE TABLE "admin_sessions" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_sessions_tokenHash_key" ON "admin_sessions"("tokenHash");

CREATE TABLE "admin_login_attempts" (
    "id" SERIAL NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_login_attempts_ipHash_createdAt_idx" ON "admin_login_attempts"("ipHash", "createdAt");
