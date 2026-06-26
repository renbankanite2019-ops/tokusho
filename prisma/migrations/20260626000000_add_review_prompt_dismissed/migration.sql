-- App Store レビュー依頼バナーの表示制御フィールド（閉じた／レビューした時刻を記録）
ALTER TABLE "ShopConfig" ADD COLUMN "reviewPromptDismissedAt" TIMESTAMP(3);
