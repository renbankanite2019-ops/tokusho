-- AlterTable: 特商法の追加表示項目（申込みの有効期限・契約不適合責任）とデジタル/継続課金の判定フラグ
ALTER TABLE "ShopConfig" ADD COLUMN "applicationPeriod" TEXT;
ALTER TABLE "ShopConfig" ADD COLUMN "contractLiability" TEXT;
ALTER TABLE "ShopConfig" ADD COLUMN "sellsDigital" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopConfig" ADD COLUMN "sellsSubscription" BOOLEAN NOT NULL DEFAULT false;
