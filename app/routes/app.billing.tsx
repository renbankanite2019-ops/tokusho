import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getPlanStatus, managedPricingUrl } from "../lib/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { isPaid, isPro, planName } = await getPlanStatus(billing);

  // ダッシュボードのバッジ表示用に DB の plan を実際の課金状態へ同期
  const dbPlan = isPro ? "PRO" : isPaid ? "BASIC" : "FREE";
  await prisma.shopConfig.updateMany({
    where: { shop: session.shop },
    data: { plan: dbPlan },
  });

  return json({
    currentPlanKey: dbPlan,
    currentPlanName: planName ?? "Free",
    pricingUrl: managedPricingUrl(session.shop),
  });
};

const PLAN_DETAILS = [
  {
    key: "FREE",
    name: "Free",
    price: "¥0",
    period: "永久無料",
    features: [
      "特商法ページの自動生成",
      "Shopifyストアへの直接公開",
      "法定の表示項目に対応",
      "ページの更新・再公開",
    ],
    limitations: ["ページ下部に「Powered by Tokusho」の表示が入ります"],
  },
  {
    key: "BASIC",
    name: "Basic",
    price: "$3.99",
    period: "/ month",
    features: [
      "Freeプランのすべての機能",
      "「Powered by Tokusho」表示を削除",
      "デザインカスタマイズ（アクセントカラー・レイアウト）",
      "日英併記（特商法ページ）",
      "メールサポート",
    ],
    limitations: [],
  },
  {
    key: "PRO",
    name: "Pro",
    price: "$7.99",
    period: "/ month",
    features: [
      "Basicプランのすべての機能",
      "プライバシーポリシー生成・公開",
      "追加ページ生成（会社概要・お問い合わせ・返品ポリシー）",
      "優先サポート",
    ],
    limitations: [],
  },
];

export default function Billing() {
  const { currentPlanKey, currentPlanName, pricingUrl } =
    useLoaderData<typeof loader>();

  return (
    <Page
      title="プラン・お支払い"
      backAction={{ content: "ダッシュボード", url: "/app" }}
    >
      <Layout>
        {/* 現在のプラン + プラン変更ボタン */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">現在のプラン</Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingLg" fontWeight="bold">
                    {currentPlanName}
                  </Text>
                  <Badge tone={currentPlanKey === "FREE" ? "info" : "success"}>
                    {currentPlanKey === "FREE" ? "無料プラン" : "有効"}
                  </Badge>
                </InlineStack>
              </BlockStack>
              <Button variant="primary" url={pricingUrl} target="_top">
                プランを選択・変更する
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* プラン一覧（情報表示） */}
        <Layout.Section>
          <Text as="h2" variant="headingMd">プラン内容</Text>
          <Box paddingBlockStart="400">
            <InlineStack gap="400" align="start" wrap={false}>
              {PLAN_DETAILS.map((plan) => {
                const isCurrent = plan.key === currentPlanKey;
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
                          {isCurrent && <Badge tone="success">現在のプラン</Badge>}
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
                プランの選択・変更・解約は、上の「プランを選択・変更する」から
                Shopify のプラン選択ページで行います。お支払いはすべて Shopify を通じて
                処理され、日割り計算で精算されます。
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
