# Tokusho — Cloud Run 用 Dockerfile (Remix + Prisma)
FROM node:20-slim

WORKDIR /app

# Prisma の実行に openssl が必要
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 依存関係をインストール（ビルドに devDependencies が必要）
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ソースをコピーしてビルド
COPY . .
RUN npx prisma generate && npm run build

# 実行時は本番モード。Cloud Run は PORT 環境変数を注入する（既定 8080）
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# サーバー起動のみ（cold start を短くするため migrate はここで実行しない）。
# スキーマ変更時は別途 `npx prisma migrate deploy` を手動/CIで実行すること。
CMD ["npm", "run", "start"]
