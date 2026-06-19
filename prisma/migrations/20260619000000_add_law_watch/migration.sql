-- CreateTable: 法令変更の定期監視用（運用者向け）
CREATE TABLE "LawWatch" (
    "id" TEXT NOT NULL,
    "lawId" TEXT NOT NULL,
    "lawName" TEXT NOT NULL,
    "fingerprint" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawWatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawWatch_lawId_key" ON "LawWatch"("lawId");
