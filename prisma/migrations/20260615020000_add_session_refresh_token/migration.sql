-- AlterTable: shopify-app-session-storage-prisma v9 が要求するリフレッシュトークン用カラム
ALTER TABLE "Session" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "Session" ADD COLUMN "refreshTokenExpires" TIMESTAMP(3);
