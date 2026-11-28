-- Ngày 19 Phần C — TOTP cho admin. CHỈ THÊM (không DROP, không sửa
-- bảng cũ). Rollback: DROP TABLE "admin_pending_sessions";
-- DROP TABLE "admin_two_factor";
CREATE TABLE "admin_two_factor" (
    "id" INTEGER NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "lastUsedStep" INTEGER,
    "recoveryCodeHashes" TEXT[] NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_two_factor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_pending_sessions" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "admin_pending_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_pending_sessions_tokenHash_key" ON "admin_pending_sessions"("tokenHash");
