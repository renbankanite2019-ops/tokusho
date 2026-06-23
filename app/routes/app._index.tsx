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
  Divider,
} from "@shopify/polaris";
import { CheckCircleIcon, AlertCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import {
  generateTokushoHtml,
  validateConfig,
  TEMPLATE_UPDATED_AT,
  TEMPLATE_CHANGELOG,
} from "../lib/tokushoTemplate";
import { generatePrivacyHtml } from "../lib/privacyTemplate";
import {
  PAGE_TYPES,
  PAGE_TYPE_LIST,
  isPageType,
  defaultBody,
  renderCustomPageHtml,
} from "../lib/customPageTemplate";
import { getPlanStatus } from "../lib/billing";
import { publishPage } from "../lib/publishPage";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ダッシュボードはDBのplanで表示する（Shopifyへの課金確認APIを呼ばず高速化）。
  // 実際の機能ゲートは action 側で getPlanStatus によりライブ確認する。
  const [config, privacy, customPages] = await Promise.all([
    prisma.shopConfig.findUnique({ where: { shop } }),
    prisma.privacyConfig.findUnique({ where: { shop } }),
    prisma.customPage.findMany({ where: { shop } }),
  ]);
  const isPro = config?.plan === "PRO";

  const errors = config ? validateConfig(config) : ["まだ情報が入力されていません"];

  // 公開済みページが、最新テンプレート更新日より前に公開されていれば「古い」と判定。
  const isOutdated = !!(
    config?.isPublished &&
    config?.lastPublishedAt &&
    new Date(config.lastPublishedAt) < new Date(TEMPLATE_UPDATED_AT)
  );
  const latestChange = TEMPLATE_CHANGELOG[0] ?? null;

  // 公開中のページ一覧（特商法は上部バナーで表示済みのため、ここでは除外）。
  const publishedPages: { name: string; url: string }[] = [];
  if (privacy?.isPublished && privacy.pageUrl) {
    publishedPages.push({ name: "プライバシーポリシー", url: privacy.pageUrl });
  }
  for (const cp of customPages) {
    if (cp.isPublished && cp.pageUrl && isPageType(cp.pageType)) {
      publishedPages.push({ name: PAGE_TYPES[cp.pageType].title, url: cp.pageUrl });
    }
  }

  return json({ config, errors, shop, isPro, isOutdated, latestChange, publishedPages });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = (formData.get("intent") as string) || "publish_all";
  const { isPro } = await getPlanStatus(billing);

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

  // ---- 特商法ページを最新テンプレートで再公開（全プラン可）----
  if (intent === "republish_tokusho") {
    const publishedAt = new Date();
    try {
      const html = generateTokushoHtml(
        { ...config, lastPublishedAt: publishedAt } as any,
        { hideWatermark: true, applyDesign: isPro }
      );
      const r = await publishPage(admin, session.shop, {
        handle: "tokushoho",
        title: "特定商取引法に基づく表記",
        html,
        pageId: config.pageId,
      });
      await prisma.shopConfig.update({
        where: { shop: session.shop },
        data: {
          pageId: r.pageId,
          pageUrl: r.pageUrl,
          isPublished: true,
          lastPublishedAt: publishedAt,
        },
      });
      return json({ republished: true });
    } catch (e) {
      if (e instanceof Response) throw e;
      return json(
        {
          bulkError:
            "再公開に失敗しました：" + (e instanceof Error ? e.message : String(e)),
        },
        { status: 500 }
      );
    }
  }

  // ---- 以下は Pro 限定（5ページ一括）----
  if (!isPro) {
    return json(
      { bulkError: "全ページの一括生成はProプラン限定の機能です。" },
      { status: 403 }
    );
  }

  // ---- 公開前プレビュー（DBには書き込まない）----
  if (intent === "preview_all") {
    const privacyRow = await prisma.privacyConfig.findUnique({
      where: { shop: session.shop },
    });
    const privacy =
      privacyRow ?? {
        shop: session.shop,
        operatorName: config.sellerName,
        contactEmail: config.email,
        purposes: ["order_fulfillment", "customer_support"],
        collectedItems: ["name", "email", "address", "phone", "payment", "order_history"],
        usesCookies: true,
        usesAnalytics: false,
        analyticsNote: null,
        sharesThirdParty: false,
        thirdPartyNote: null,
        disclosureContact: null,
        extraNote: null,
        pageId: null,
        pageUrl: null,
        lastPublishedAt: null,
        isPublished: false,
        id: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    const customPages = await prisma.customPage.findMany({
      where: { shop: session.shop },
    });
    const cpMap: Record<string, any> = Object.fromEntries(
      customPages.map((c) => [c.pageType, c])
    );
    const previews = [
      {
        name: "特定商取引法に基づく表記",
        html: generateTokushoHtml(config as any, {
          hideWatermark: true,
          applyDesign: isPro,
        }),
      },
      {
        name: "プライバシーポリシー",
        html: generatePrivacyHtml(privacy as any, config, { hideWatermark: true }),
      },
      ...PAGE_TYPE_LIST.map((type) => ({
        name: PAGE_TYPES[type].title,
        html: renderCustomPageHtml(
          PAGE_TYPES[type].title,
          cpMap[type]?.body || defaultBody(type, config)
        ),
      })),
    ];
    return json({ previews });
  }

  const publishedAt = new Date();
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const results: { name: string; pageUrl?: string; error?: string }[] = [];

  // 1) 特定商取引法に基づく表記
  try {
    const html = generateTokushoHtml(
      { ...config, lastPublishedAt: publishedAt } as any,
      { hideWatermark: true, applyDesign: isPro }
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

  // 3) 会社概要・お問い合わせ・返品ポリシー
  for (const type of PAGE_TYPE_LIST) {
    const meta = PAGE_TYPES[type];
    const where = { shop_pageType: { shop: session.shop, pageType: type } };
    const existing = await prisma.customPage.findUnique({ where });
    const body = existing?.body || defaultBody(type, config);
    // 未入力プレースホルダが残るページはスキップ（未完成の公開を防ぐ）
    if (body.includes("（記入してください）")) {
      results.push({ name: meta.title, error: "「（記入してください）」が未入力のためスキップしました" });
      continue;
    }
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
  const { config, errors, isPro, isOutdated, latestChange, publishedPages } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navIntent = navigation.formData?.get("intent");
  const isPreviewing =
    navigation.state === "submitting" && navIntent === "preview_all";
  const isPublishing =
    navigation.state === "submitting" && navIntent === "publish_all";
  const isRepublishing =
    navigation.state === "submitting" && navIntent === "republish_tokusho";

  const isComplete = errors.length === 0;
  const isPublished = config?.isPublished && config?.pageUrl;
  const bulkResults =
    actionData && "bulkResults" in actionData ? actionData.bulkResults : null;
  const bulkError =
    actionData && "bulkError" in actionData ? actionData.bulkError : null;
  const previews =
    actionData && "previews" in actionData ? actionData.previews : null;
  const republished =
    actionData && "republished" in actionData ? actionData.republished : null;

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

        {/* その他の公開中のページ（特商法以外）。ページ名そのものをリンクにする。 */}
        {publishedPages.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  その他の公開中のページ
                </Text>
                <BlockStack gap="200">
                  {publishedPages.map((p, i) => (
                    <div key={i}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#005bd3", textDecoration: "none", fontSize: 14 }}
                      >
                        {p.name} →
                      </a>
                      {i < publishedPages.length - 1 && (
                        <Box paddingBlockStart="200">
                          <Divider />
                        </Box>
                      )}
                    </div>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* 法令・テンプレート更新の通知 */}
        {republished && (
          <Layout.Section>
            <Banner title="特商法ページを最新の内容で再公開しました" tone="success" />
          </Layout.Section>
        )}
        {isOutdated && !republished && (
          <Layout.Section>
            <Banner title="特商法ページに更新があります" tone="warning">
              <BlockStack gap="200">
                <Text as="p">
                  テンプレートまたは法令対応の更新がありました
                  {latestChange && `（${latestChange.date}：${latestChange.note}）`}
                  。現在公開中のページはこの更新より前に公開されています。
                  最新の内容で再公開することをおすすめします。
                </Text>
                <Form method="post">
                  <input type="hidden" name="intent" value="republish_tokusho" />
                  <InlineStack align="start">
                    <Button variant="primary" submit loading={isRepublishing}>
                      最新の内容で再公開する
                    </Button>
                  </InlineStack>
                </Form>
                <Text as="p" variant="bodySm" tone="subdued">
                  ※ 生成内容は雛形です。法令変更の直後は、必要に応じて専門家にご確認ください。
                </Text>
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

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
                    <InlineStack gap="100" align="start" blockAlign="center" wrap={false}>
                      <span style={{ display: "inline-flex", flex: "0 0 auto" }}>
                        <Icon source={CheckCircleIcon} tone="success" />
                      </span>
                      <Text as="p" tone="success">
                        すべての必須項目が入力されています
                      </Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      {errors.map((error, i) => (
                        <InlineStack key={i} gap="100" align="start" blockAlign="center" wrap={false}>
                          <span style={{ display: "inline-flex", flex: "0 0 auto" }}>
                            <Icon source={AlertCircleIcon} tone="caution" />
                          </span>
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
                      <BlockStack gap="400">
                        {!previews && !bulkResults && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="preview_all" />
                            <InlineStack align="start">
                              <Button
                                variant="primary"
                                submit
                                size="large"
                                loading={isPreviewing}
                                disabled={!isComplete}
                              >
                                5ページのプレビューを作成
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
                        )}

                        {previews && !bulkResults && (
                          <BlockStack gap="300">
                            <Text as="h3" variant="headingSm">
                              公開前プレビュー（{previews.length}ページ）— 内容を確認してから公開してください
                            </Text>
                            {previews.map((p, i) => (
                              <div
                                key={i}
                                style={{
                                  border: "1px solid #e1e3e5",
                                  borderRadius: 8,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    background: "#f6f6f7",
                                    padding: "8px 12px",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                >
                                  {p.name}
                                </div>
                                <div
                                  style={{
                                    maxHeight: 280,
                                    overflow: "auto",
                                    padding: 16,
                                    fontSize: 13,
                                    lineHeight: 1.7,
                                  }}
                                  dangerouslySetInnerHTML={{ __html: p.html }}
                                />
                              </div>
                            ))}
                            <InlineStack gap="300">
                              <Form method="post">
                                <input type="hidden" name="intent" value="publish_all" />
                                <Button
                                  variant="primary"
                                  submit
                                  size="large"
                                  loading={isPublishing}
                                >
                                  確認しました。5ページを公開する
                                </Button>
                              </Form>
                              <Button url="/app">キャンセル</Button>
                            </InlineStack>
                          </BlockStack>
                        )}
                      </BlockStack>
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
                  {/* 外部リンクは埋め込みiframe内で開くと X-Frame-Options:deny で表示拒否される。
                      新しいタブ（トップレベル）で開くため素の <a target="_blank"> を使う。 */}
                  <a
                    href="https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#005bd3", textDecoration: "none" }}
                  >
                    消費者庁の公式ガイド →
                  </a>
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
