import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
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
  Icon,
  List,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { validateConfig } from "../lib/tokushoTemplate";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const config = await prisma.shopConfig.findUnique({
    where: { shop },
  });

  const errors = config ? validateConfig(config) : ["まだ情報が入力されていません"];

  return json({ config, errors, shop });
};

export default function Index() {
  const { config, errors, shop } = useLoaderData<typeof loader>();

  const isComplete = errors.length === 0;
  const isPublished = config?.isPublished && config?.pageUrl;

  return (
    <Page title="特定商取引法ページ管理">
      <Layout>
        {/* ステータスバナー */}
        <Layout.Section>
          {isPublished ? (
            <Banner
              title="特商法ページは公開中です"
              tone="success"
              action={{
                content: "ページを確認する",
                onAction: () => window.open(config.pageUrl!, "_blank", "noopener,noreferrer"),
              }}
            >
              <p>
                最終更新:{" "}
                {config.lastPublishedAt
                  ? new Date(config.lastPublishedAt).toLocaleDateString("ja-JP")
                  : "不明"}
              </p>
            </Banner>
          ) : (
            <Banner
              title="特商法ページがまだ公開されていません"
              tone="warning"
            >
              <p>
                特定商取引法に基づく表記ページは、日本でオンライン販売を行うすべての事業者に義務付けられています。
                下記のフォームで情報を入力し、ページを公開してください。
              </p>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Layout>
            {/* メイン：チェックリスト */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    必須項目チェック
                  </Text>

                  {isComplete ? (
                    <InlineStack gap="200" align="start">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text as="p" tone="success">
                        すべての必須項目が入力されています
                      </Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      {errors.map((error, i) => (
                        <InlineStack key={i} gap="200" align="start">
                          <Icon source={AlertCircleIcon} tone="caution" />
                          <Text as="p" tone="caution">
                            {error}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}

                  <InlineStack gap="300">
                    <Button
                      variant="primary"
                      url="/app/setup"
                      size="large"
                    >
                      {config ? "情報を編集する" : "情報を入力する"}
                    </Button>

                    {isComplete && (
                      <Button
                        url="/app/preview"
                        size="large"
                      >
                        プレビュー・公開
                      </Button>
                    )}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* サイド：法律の要件説明 */}
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    特商法とは
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    特定商取引法（法第11条）により、通信販売を行うすべての事業者は以下の情報を表示する義務があります。
                  </Text>
                  <List type="bullet">
                    <List.Item>販売価格・送料</List.Item>
                    <List.Item>支払い方法・時期</List.Item>
                    <List.Item>商品引渡し時期</List.Item>
                    <List.Item>返品・キャンセル条件</List.Item>
                    <List.Item>事業者名・住所・電話番号</List.Item>
                    <List.Item>代表者名（法人の場合）</List.Item>
                  </List>
                  <Button
                    url="https://www.no-trouble.caa.go.jp/what/mailorder/"
                    external
                    variant="plain"
                  >
                    消費者庁の公式ガイド →
                  </Button>
                </BlockStack>
              </Card>

              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingMd">プラン</Text>
                      <Badge>{config?.plan || "FREE"}</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      Freeプランでは基本的な特商法ページを作成できます。
                    </Text>
                    <Button url="/app/billing" variant="plain">
                      プランをアップグレード
                    </Button>
                  </BlockStack>
                </Card>
              </Box>
            </Layout.Section>
          </Layout>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
