import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import type { ActionFunctionArgs } from "@remix-run/node";

/**
 * Shopify Webhook ハンドラー
 * - app/uninstalled: アプリアンインストール時にセッションとデータを削除
 * - customers/data_request: GDPRデータリクエスト（消費者庁のAPPI対応）
 * - customers/redact: GDPRデータ削除リクエスト
 * - shop/redact: GDPRショップデータ削除リクエスト
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  console.log(`Received webhook: ${topic} from ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      // アンインストール時にショップ設定を削除（ただし法的義務のある記録は保持期間後に削除）
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      // Note: ShopConfigは削除しない（事業者の記録として保持。必要に応じてretention policyを設定）
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // GDPRデータリクエスト — 本アプリは顧客個人データを収集しないため対応不要
      // ただし、ショップオーナーに通知することが望ましい
      console.log(
        `GDPR data request for shop ${shop}. This app does not store customer personal data.`
      );
      break;

    case "CUSTOMERS_REDACT":
      // GDPRデータ削除 — 顧客データを保存していないため対応不要
      console.log(
        `GDPR customer redact for shop ${shop}. No customer data to redact.`
      );
      break;

    case "SHOP_REDACT":
      // ショップデータ削除 — アンインストールから48時間後に呼ばれる
      await prisma.shopConfig.deleteMany({ where: { shop } });
      await prisma.session.deleteMany({ where: { shop } });
      console.log(`Shop data redacted for ${shop}`);
      break;

    default:
      // 認証済み（HMAC検証通過）だが未処理のトピックは 200 を返す。
      // 404 を返すと Shopify がエンドポイントを不健全とみなし再送する。
      console.log(`Unhandled webhook topic: ${topic}`);
      break;
  }

  return new Response("OK", { status: 200 });
};
