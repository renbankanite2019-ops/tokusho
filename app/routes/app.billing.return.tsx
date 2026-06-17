import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getPlanStatus } from "../lib/billing";

/**
 * Managed Pricing のプラン選択ページから戻ってきた際の着地点。
 * 実際の課金状態を確認して DB の plan を同期し、課金画面へ戻す。
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { isPaid, isPro } = await getPlanStatus(billing);
  const dbPlan = isPro ? "PRO" : isPaid ? "BASIC" : "FREE";
  await prisma.shopConfig.updateMany({
    where: { shop: session.shop },
    data: { plan: dbPlan },
  });
  return redirect("/app/billing");
};
