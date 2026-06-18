import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
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
  Icon,
  List,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { generateTokushoHtml, validateConfig } from "../lib/tokushoTemplate";
import { generatePrivacyHtml } from "../lib/privacyTemplate";
import {
  PAGE_TYPES,
  PAGE_TYPE_LIST,
  defaultBody,
  renderCustomPageHtml,
} from "../lib/customPageTemplate";
import { getPlanStatus } from "../lib/billing";
import { publishPage } from "../lib/publishPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shop = session.shop;

  const [config, { isPro }] = await Promise.all([
    prisma.shopConfig.findUnique({ where: { shop } }),
    getPlanStatus(billing),
  ]);

  const errors = config ? validateConfig(config) : ["まだ情報が入力されていません"];

  return json({ config, errors, shop, isPro });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const { isPaid, isPro } = await getPlanStatus(billing);

  if (!isPro) {
    return json(
      { bulkError: "全ページの一括生成はProプラン限定の機能です。" },
      { status: 403 }
    );
  }

  const config = await prisma.shopConfig.findUnique({
    where: { shop: session.shop },
  });
  if (!config) {
    return json(
      { bulkError: "先に「事業者情報」を入力・保存してください。" },
      { status: 400 }
    );
  }
  const cfgErrors = validateConfig(config);
  if (cfgErrors.length > 0) {
    return json(
      { bulkError: "事業者情報に未入力の必須項目があります：" + cfgErrors.join("、") },
      { status: 400 }
    );
  }

  const publishedAt = new Date();
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const results: { name: string; pageUrl?: string; error?: string }[] = [];

  // 1) 特定商取引法に基づく表記
  try {
    const html = generateTokushoHtml(
      { ...config, lastPublishedAt: publishedAt } as any,
      { hideWatermark: isPaid, applyDesign: isPaid }
    );
    const r = await publishPage(admin, session.shop, {
      handle: "tokushoho",
      title: "特定商取引法に基づく表記",
      html,
      pageId: config.pageId,
    });
    await prisma.shopConfig.update({
      where: { shop: session.shop },
      data: { pageId: r.pageId, pageUrl: r.pageUrl, isPublished: true, lastPublishedAt: publishedAt },
    });
    results.push({ name: "特定商取引法に基づく表記", pageUrl: r.pageUrl });
  } catch (e) {
    if (e instanceof Response) throw e;
    results.push({ name: "特定商取引法に基づく表記", error: msg(e) });
  }

  // 2) プライバシーポリシー（未設定なら事業者情報から既定値を作成）
  let privacy = await prisma.privacyConfig.findUnique({
    where: { shop: session.shop },
  });
  if (!privacy) {
    privacy = await prisma.privacyConfig.create({
      data: {
        shop: session.shop,
        operatorName: config.sellerName,
        contactEmail: config.email,
        purposes: ["order_fulfillment", "customer_support"],
        collectedItems: ["name", "email", "address", "phone", "payment", "order_history"],
        usesCookies: true,
      },
    });
  }
  try {
    const html = generatePrivacyHtml(
      { ...privacy, lastPublishedAt: publishedAt } as any,
      config,
      { hideWatermark: true }
    );
    const r = await publishPage(admin, session.shop, {
      handle: "privacy-policy",
      title: "プライバシーポリシー",
      html,
      pageId: privacy.pageId,
    });
    await prisma.privacyConfig.update({
      where: { shop: session.shop },
      data: { pageId: r.pageId, pageUrl: r.pageUrl, isPublished: true, lastPublishedAt: publishedAt },
    });
    results.push({ name: "プライバシーポリシー", pageUrl: r.pageUrl });
  } catch (e) {
    if (e instanceof Response) throw e;
    results.push({ name: "プライバシーポリシー", error: msg(e) });
  }

  // 3) 会社概要・お問い合わせ・返品ポリシー（既存本文 or 事業者情報からの雛形）
  for (const type of PAGE_TYPE_LIST) {
    const meta = PAGE_TYPES[type];
    const where = { shop_pageType: { shop: session.shop, pageType: type } };
    const existing = await prisma.customPage.findUnique({ where });
    const body = existing?.body || defaultBody(type, config);
    try {
      const html = renderCustomPageHtml(meta.title, body);
      const r = await publishPage(admin, session.shop, {
        handle: meta.handle,
        title: meta.title,
        html,
        pageId: existing?.pageId,
      });
      await prisma.customPage.upsert({
        where,
        create: {
          shop: session.shop,
          pageType: type,
          body,
          pageId: r.pageId,
          pageUrl: r.pageUrl,
          isPublished: true,
          lastPublishedAt: publishedAt,
        },
        update: {
          body,
          pageId: r.pageId,
          pageUrl: r.pageUrl,
          isPublished: true,
          lastPublishedAt: publishedAt,
        },
      });
      results.push({ name: meta.title, pageUrl: r.pageUrl });
    } catch (e) {
      if (e instanceof Response) throw e;
      results.push({ name: meta.title, error: msg(e) });
    }
  }

  return json({ bulkResults: results });
};

export default function Index() {
  const { config, errors, isPro } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isBulkRunning = navigation.state === "submitting";

  const isComplete = errors.length === 0;
  const isPublished = config?.isPublished && config?.pageUrl;
  const bulkResults =
    actionData && "bulkResults" in actionData ? actionData.bulkResults : null;
  const bulkError =
    actionData && "bulkError" in actionData ? actionData.bulkError : null;

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

        {/* 一括生成の結果 */}
        {bulkError && (
          <Layout.Section>
            <Banner title="一括生成できませんでした" tone="critical">
              <p>{bulkError}</p>
            </Banner>
          </Layout.Section>
        )}
        {bulkResults && (
          <Layout.Section>
            <Banner
              title={
                bulkResults.every((r) => !r.error)
                  ? "すべてのページを公開しました！"
                  : "一部のページで問題がありました"
              }
              tone={bulkResults.every((r) => !r.error) ? "success" : "warning"}
            >
              <BlockStack gap="100">
                {bulkResults.map((r, i) => (
                  <Text as="p" key={i} variant="bodySm">
                    {r.error ? "⚠️" : "✅"} {r.name}
                    {r.pageUrl && (
                      <>
                        {" — "}
                        <a href={r.pageUrl} target="_blank" rel="noopener noreferrer">
                          {r.pageUrl}
                        </a>
                      </>
                    )}
                    {r.error && ` — ${r.error}`}
                  </Text>
                ))}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

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

              {/* 全ページ一括生成（Pro） */}
              <Box paddingBlockStart="400">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        全ページをワンクリックで生成
                      </Text>
                      <Badge tone="success">Pro</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      特定商取引法・プライバシーポリシー・会社概要・お問い合わせ・返品ポリシーの5ページを、
                      事業者情報をもとに一括で生成し、ストアに公開します。
                    </Text>
                    {isPro ? (
                      <Form method="post">
                        <InlineStack align="start">
                          <Button
                            variant="primary"
                            submit
                            size="large"
                            loading={isBulkRunning}
                            disabled={!isComplete}
                          >
                            5ページを一括生成・公開する
                          </Button>
                        </InlineStack>
                        {!isComplete && (
                          <Box paddingBlockStart="200">
                            <Text as="p" variant="bodySm" tone="caution">
                              先に事業者情報の必須項目を入力してください。
                            </Text>
                          </Box>
                        )}
                      </Form>
                    ) : (
                      <InlineStack align="start">
                        <Button url="/app/billing">Proプランにアップグレード</Button>
                      </InlineStack>
                    )}
                    <Text as="p" variant="bodySm" tone="subdued">
                      ※ 生成される各ページは雛形です。公開後、内容を確認・編集してください。
                      法的な内容は必要に応じて専門家にご確認ください。
                    </Text>
                  </BlockStack>
                </Card>
              </Box>
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
