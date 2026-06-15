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
