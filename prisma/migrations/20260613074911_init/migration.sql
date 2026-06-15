-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('INDIVIDUAL', 'CORPORATION');

-- CreateEnum
CREATE TYPE "ReturnPolicy" AS ENUM ('STANDARD', 'NO_RETURN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ShippingBurden" AS ENUM ('CUSTOMER', 'SELLER', 'DEPENDS');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopConfig" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "businessType" "BusinessType" NOT NULL DEFAULT 'INDIVIDUAL',
    "sellerName" TEXT NOT NULL,
    "representativeName" TEXT,
    "responsibleName" TEXT,
    "postalCode" TEXT,
    "prefecture" TEXT,
    "address" TEXT NOT NULL,
    "buildingName" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "salesPrice" TEXT NOT NULL DEFAULT '各商品ページに記載',
    "shippingFee" TEXT NOT NULL DEFAULT '全国一律500円（税込）',
    "paymentMethods" TEXT[],
    "paymentTiming" TEXT NOT NULL DEFAULT 'クレジットカード：注文時決済',
    "deliveryTiming" TEXT NOT NULL DEFAULT 'ご注文確認後3〜5営業日以内に発送',
    "returnPolicy" "ReturnPolicy" NOT NULL DEFAULT 'STANDARD',
    "returnDeadline" TEXT NOT NULL DEFAULT '商品到着後8日以内',
    "returnCondition" TEXT NOT NULL DEFAULT '未使用・未開封のもの',
    "returnShipping" "ShippingBurden" NOT NULL DEFAULT 'CUSTOMER',
    "returnNote" TEXT,
    "otherCosts" TEXT,
    "softwareRequirements" TEXT,
    "subscriptionTerms" TEXT,
    "specialConditions" TEXT,
    "contactNote" TEXT,
    "pageId" TEXT,
    "pageUrl" TEXT,
    "lastPublishedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopConfig_shop_key" ON "ShopConfig"("shop");
