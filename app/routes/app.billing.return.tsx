import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { PLANS } from "../lib/plans";
import { isTestBilling } from "../lib/billing";

/**
 * Shopify billing confirmation の返り先
 * URL: /app/billing/return
 *
 * セキュリティ上の注意: 付与するプランは URL の ?plan= ではなく、
 * Shopify 側で実際にアクティブな課金 (billing.check) からのみ決定する。
 * （URLパラメータを信用すると、誰でも /app/billing/return?plan=PRO で
 *  無料で上位プランに昇格できてしまうため）
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const isTest = isTestBilling();
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLANS.BASIC, PLANS.PRO],
    isTest,
  });

  const activeName = hasActivePayment ? appSubscriptions[0]?.name : null;
  const dbPlan =
    activeName === PLANS.PRO ? "PRO" : activeName === PLANS.BASIC ? "BASIC" : "FREE";

  await prisma.shopConfig.updateMany({
    where: { shop: session.shop },
    data: { plan: dbPlan },
  });
  console.log(`[billing] Verified active plan for ${session.shop}: ${dbPlan}`);

  return redirect("/app/billing");
};
