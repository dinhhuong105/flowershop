import { PrismaClient, type Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Bật ghi log truy vấn SQL khi PRISMA_LOG_QUERIES=1 (dùng để đếm truy vấn
// cho D3-23; mặc định tắt, không ảnh hưởng chạy thường).
const prismaOptions: Prisma.PrismaClientOptions =
  process.env.PRISMA_LOG_QUERIES === "1"
    ? { log: [{ emit: "stdout", level: "query" }] }
    : {};

export const db = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
