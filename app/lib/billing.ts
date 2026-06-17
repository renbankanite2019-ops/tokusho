/**
 * 課金をテストモードで実行するか判定する。
 *
 * - 環境変数 SHOPIFY_BILLING_TEST が "true"/"false" ならそれに従う
 * - 未設定なら NODE_ENV が production 以外のときだけテストモード
 *
 * 開発ストア（dev store）では実際の課金ができないため、本番ホスティング
 * （NODE_ENV=production）上で dev store に対してテストする間は
 * SHOPIFY_BILLING_TEST=true を設定する必要がある。
 * 実リリース時は SHOPIFY_BILLING_TEST=false（または未設定）にする。
 */
export function isTestBilling(): boolean {
  const flag = process.env.SHOPIFY_BILLING_TEST;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 現在の課金状態を取得する（Managed Pricing 対応）。
 * - plans を指定せず billing.check() を呼び、有効な購読の有無と名称を見る。
 * - isPaid: 何らかの有料プランが有効か（Basic以上の機能ゲートに使用）
 * - isPro : プラン名に "pro" を含むか（Pro機能ゲートに使用）
 * 失敗しても落ちないよう false を返す。
 */
export async function getPlanStatus(
  billing: { check: (opts: { isTest: boolean }) => Promise<any> }
): Promise<{ isPaid: boolean; isPro: boolean; planName: string | null }> {
  try {
    const result = await billing.check({ isTest: isTestBilling() });
    const planName = result?.hasActivePayment
      ? result?.appSubscriptions?.[0]?.name ?? null
      : null;
    return {
      isPaid: !!result?.hasActivePayment,
      isPro: !!planName && /pro/i.test(planName),
      planName,
    };
  } catch (e) {
    console.error("[billing] getPlanStatus failed:", e);
    return { isPaid: false, isPro: false, planName: null };
  }
}

/** Shopify Managed Pricing のプラン選択ページ URL を組み立てる */
export function managedPricingUrl(shop: string): string {
  const storeHandle = shop.replace(/\.myshopify\.com$/, "");
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "tokusho";
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}
