-- 法令アップデートのメール通知用フィールド（Proプラン向け）
ALTER TABLE "ShopConfig" ADD COLUMN "lawAlertOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopConfig" ADD COLUMN "lawAlertNotifiedAt" TIMESTAMP(3);
