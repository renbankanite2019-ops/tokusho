import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { PLANS } from "../lib/plans";
import { isTestBilling } from "../lib/billing";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);

  const isTest = isTestBilling();
  // 実際の課金状態を Shopify から取得（DBのキャッシュを信用しない）
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PLANS.BASIC, PLANS.PRO],
    isTest,
  });

  const activePlanName = hasActivePayment ? appSubscriptions[0]?.name ?? null : null;

  // DBのプラン値を実際の課金状態に合わせて同期しておく
  const dbPlan =
    activePlanName === PLANS.PRO ? "PRO" : activePlanName === PLANS.BASIC ? "BASIC" : "FREE";
  await prisma.shopConfig.updateMany({
    where: { shop: session.shop },
    data: { plan: dbPlan },
  });

  return json({
    currentPlan: activePlanName ?? "FREE",
    hasActivePayment,
    activePlanName,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;
  const intent = formData.get("intent") as string;

  const isTest = isTestBilling();

  if (intent === "cancel") {
    // Shopify 側の実サブスクリプションをキャンセルしてから DB を更新する
    const { appSubscriptions } = await billing.check({
      plans: [PLANS.BASIC, PLANS.PRO],
      isTest,
    });
    const sub = appSubscriptions[0];
    if (sub) {
      await billing.cancel({ subscriptionId: sub.id, isTest, prorate: true });
    }
    await prisma.shopConfig.updateMany({
      where: { shop: session.shop },
      data: { plan: "FREE" },
    });
    return json({ cancelled: true });
  }

  if (plan === PLANS.BASIC || plan === PLANS.PRO) {
    const appUrl = process.env.SHOPIFY_APP_URL || "";
    try {
      // billing.request は成功時に Shopify 決済ページへ redirect を throw する。
      // 本番 (NODE_ENV=production) では isTest=false で実際に課金される。
      await billing.request({
        plan,
        isTest,
        returnUrl: `${appUrl}/app/billing/return`,
      });
    } catch (e) {
      // redirect Response はそのまま通す
      if (e instanceof Response) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[billing] request failed:", msg);
      // Dev環境では "Apps without a public distribution cannot use the Billing API" が出る
      // App Store 公開後に解消される
      const isDistributionError = msg.includes("public distribution");
      return json({
        error: isDistributionError
          ? "開発環境ではBilling APIは使用できません。App Store公開後に有効になります。"
          : `サブスクリプション作成失敗: ${msg}`,
      }, { status: 500 });
    }
  }

  return json({ error: "無効なプランです" }, { status: 400 });
};

const PLAN_DETAILS = [
  {
    key: "FREE",
    name: "Free",
    price: "¥0",
    period: "永久無料",
    badge: "現在のプラン" as const,
    badgeTone: "info" as const,
    features: [
      "特商法ページの自動生成",
      "Shopifyストアへの直接公開",
      "法定必須項目すべて対応",
      "ページの更新・再公開",
    ],
    limitations: ["ページ下部に「Powered by Tokusho」の表示が入ります"],
    planValue: null,
  },
  {
    key: "BASIC",
    name: "Basic",
    price: "$3.99",
    period: "/ month",
    badge: "人気" as const,
    badgeTone: "success" as const,
    features: [
      "Freeプランのすべての機能",
      "「Powered by Tokusho」表示を削除",
      "メールサポート",
    ],
    limitations: [],
    planValue: PLANS.BASIC,
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$7.99",
    period: "/ month",
    badge: null,
    badgeTone: null,
    features: [
      "Basicプランのすべての機能",
      "プライバシーポリシー生成・公開",
      "優先サポート",
    ],
    limitations: [],
    planValue: PLANS.PRO,
  },
];

export default function Billing() {
  const { currentPlan, hasActivePayment, activePlanName } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page
      title="プラン・お支払い"
      backAction={{ content: "ダッシュボード", url: "/app" }}
    >
      <Layout>
        {actionData && "cancelled" in actionData && actionData.cancelled && (
          <Layout.Section>
            <Banner title="プランをキャンセルしました" tone="info">
              <p>Freeプランに戻りました。引き続きご利用いただけます。</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData && "error" in actionData && (
          <Layout.Section>
            <Banner title="エラー" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* 現在のプラン */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">現在のプラン</Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {activePlanName ?? "Free"}
                  </Text>
                  <Badge tone={hasActivePayment ? "success" : "info"}>
                    {hasActivePayment ? "有効" : "無料プラン"}
                  </Badge>
                </InlineStack>
              </BlockStack>

              {hasActivePayment && (
                <Form method="post">
                  <input type="hidden" name="intent" value="cancel" />
                  <Button
                    variant="plain"
                    tone="critical"
                    submit
                    loading={isSubmitting}
                  >
                    プランをキャンセル
                  </Button>
                </Form>
              )}
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* プラン一覧 */}
        <Layout.Section>
          <Text as="h2" variant="headingMd">プランを選択</Text>
          <Box paddingBlockStart="400">
            <InlineStack gap="400" align="start" wrap={false}>
              {PLAN_DETAILS.map((plan) => {
                const isCurrentPlan =
                  (!hasActivePayment && plan.key === "FREE") ||
                  activePlanName === plan.planValue;

                return (
                  <div key={plan.key} style={{ flex: 1, minWidth: 0 }}>
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="start">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingMd">{plan.name}</Text>
                            <InlineStack gap="100" blockAlign="baseline">
                              <Text as="p" variant="headingXl" fontWeight="bold">
                                {plan.price}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                {plan.period}
                              </Text>
                            </InlineStack>
                          </BlockStack>
                          {plan.badge && (
                            <Badge tone={plan.badgeTone ?? "info"}>{plan.badge}</Badge>
                          )}
                        </InlineStack>

                        <Divider />

                        <List type="bullet">
                          {plan.features.map((f, i) => (
                            <List.Item key={i}>{f}</List.Item>
                          ))}
                        </List>

                        {plan.limitations.length > 0 && (
                          <Text as="p" variant="bodySm" tone="subdued">
                            {plan.limitations.join(" / ")}
                          </Text>
                        )}

                        <Box paddingBlockStart="200">
                          {isCurrentPlan ? (
                            <Button disabled fullWidth>
                              現在のプラン
                            </Button>
                          ) : plan.planValue ? (
                            <Form method="post">
                              <input type="hidden" name="plan" value={plan.planValue} />
                              <Button
                                variant="primary"
                                submit
                                loading={isSubmitting}
                                fullWidth
                              >
                                {plan.name}プランにアップグレード
                              </Button>
                            </Form>
                          ) : (
                            <Button variant="plain" fullWidth disabled>
                              現在のプラン
                            </Button>
                          )}
                        </Box>
                      </BlockStack>
                    </Card>
                  </div>
                );
              })}
            </InlineStack>
          </Box>
        </Layout.Section>

        {/* 注意事項 */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">お支払いについて</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                お支払いはすべて Shopify Payments を通じて処理されます。
                プランはいつでもキャンセル可能で、日割り計算で精算されます。
                現在は開発用テストモードで動作しています（実際の請求は発生しません）。
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
