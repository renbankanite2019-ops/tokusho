-- AlterTable: デザイン・表示カスタマイズ（Basicプラン以上で反映）
ALTER TABLE "ShopConfig" ADD COLUMN "accentColor" TEXT NOT NULL DEFAULT '#008060';
ALTER TABLE "ShopConfig" ADD COLUMN "templateStyle" TEXT NOT NULL DEFAULT 'table';
ALTER TABLE "ShopConfig" ADD COLUMN "bilingual" BOOLEAN NOT NULL DEFAULT false;
