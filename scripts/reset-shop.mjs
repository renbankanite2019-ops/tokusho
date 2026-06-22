// 指定した店舗の入力データ（ShopConfig / PrivacyConfig / CustomPage）を削除する。
// Session（Shopify セッション）は削除しないので、再インストール／再認証は不要。
//
// 使い方（プロジェクト直下で、DATABASE_URL を読み込んで実行）:
//   node --env-file=.env scripts/reset-shop.mjs kizuna-digital.myshopify.com
//   （.env が無い場合は環境変数 DATABASE_URL を設定してから実行）
//
// 注意:
// - 既にストアフロントに公開済みの Shopify ページ（/pages/...）は店舗側のコンテンツのため
//   この処理では消えません。完全に消すには Shopify 管理画面 > オンラインストア > ページ から削除してください。
//   （消さなくても、再公開時は同じハンドルのページを再利用して上書きされます。）

import { PrismaClient } from "@prisma/client";

const shop = process.argv[2];
if (!shop) {
  console.error("Usage: node --env-file=.env scripts/reset-shop.mjs <shop.myshopify.com>");
  process.exit(1);
}
if (!shop.endsWith(".myshopify.com")) {
  console.error(`安全のため <shop>.myshopify.com 形式で指定してください: 受け取った値 = "${shop}"`);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const cp = await prisma.customPage.deleteMany({ where: { shop } });
  const pc = await prisma.privacyConfig.deleteMany({ where: { shop } });
  const sc = await prisma.shopConfig.deleteMany({ where: { shop } });
  console.log(
    `削除しました（shop=${shop}）: customPage=${cp.count} / privacyConfig=${pc.count} / shopConfig=${sc.count}`
  );
  console.log("Session は保持しています（再認証不要）。アプリを開くと初回設定の状態になります。");
} catch (e) {
  console.error("削除に失敗しました:", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
