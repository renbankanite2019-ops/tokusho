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
  const { isPro, planName } = await getPlanStatus(billing);

  // ダッシュボードのバッジ表示用に DB の plan を実際の課金状態へ同期（Free / Pro の2プラン）
  const dbPlan = isPro ? "PRO" : "FREE";
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
    priceMain: "¥0",
    priceSub: "永久無料・ウォーターマークなし",
    badge: null as string | null,
    features: [
      "特商法ページの自動生成・公開",
      "法定の表示項目の入力をサポート",
      "Shopify設定からの自動入力・販売形態の自動判定",
      "ページの更新・再公開、法令変更のお知らせ",
    ],
    limitations: [],
  },
  {
    key: "PRO",
    name: "Pro",
    priceMain: "$49.99 / 年",
    priceSub: "または 月額 $4.99",
    badge: "年額なら約2ヶ月分お得",
    features: [
      "Freeプランのすべての機能",
      "デザインカスタマイズ（アクセントカラー・レイアウト）",
      "日英併記（特商法ページ）",
      "プライバシーポリシー生成・公開",
      "追加ページ生成（会社概要・お問い合わせ・返品ポリシー）",
      "5ページをワンクリックで一括生成",
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

        {/* 年額のおすすめ */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">年額プランがおすすめ</Text>
                <Badge tone="attention">おトク</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                特定商取引法ページは、内容に変更がなければ頻繁な更新は不要です（法改正や
                取引条件の変更時は修正・再公開が必要です）。年額プランなら、お支払いは1年に1度だけ。
                毎月の請求や管理の手間がなく、必要なときの修正・再公開はいつでも行えます。
              </Text>
            </BlockStack>
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
                            <Text as="p" variant="headingXl" fontWeight="bold">
                              {plan.priceMain}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {plan.priceSub}
                            </Text>
                            {plan.badge && (
                              <Box paddingBlockStart="100">
                                <Badge tone="attention">{plan.badge}</Badge>
                              </Box>
                            )}
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
                Shopify のプラン選択ページで行います。年額・月額はそのページで選べます。
                お支払いはすべて Shopify を通じて処理され、日割り計算で精算されます。
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
