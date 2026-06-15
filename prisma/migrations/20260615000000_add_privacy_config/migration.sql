-- CreateTable
CREATE TABLE "PrivacyConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "purposes" TEXT[],
    "collectedItems" TEXT[],
    "usesCookies" BOOLEAN NOT NULL DEFAULT true,
    "usesAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "analyticsNote" TEXT,
    "sharesThirdParty" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyNote" TEXT,
    "disclosureContact" TEXT,
    "extraNote" TEXT,
    "pageId" TEXT,
    "pageUrl" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyConfig_shop_key" ON "PrivacyConfig"("shop");
