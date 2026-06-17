-- CreateTable: 追加ページ（Pro機能: 会社概要 / お問い合わせ / 返品ポリシー）
CREATE TABLE "CustomPage" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pageId" TEXT,
    "pageUrl" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPage_shop_pageType_key" ON "CustomPage"("shop", "pageType");
