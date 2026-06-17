import { useState } from "react";
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
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Box,
  Divider,
  ChoiceList,
  Checkbox,
  FormLayout,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getPlanStatus } from "../lib/billing";
import {
  generatePrivacyHtml,
  validatePrivacyConfig,
} from "../lib/privacyTemplate";

const PURPOSE_OPTIONS = [
  { label: "商品の発送・代金の請求・本人確認のため", value: "order_fulfillment" },
  { label: "お問い合わせ・アフターサービス対応のため", value: "customer_support" },
  { label: "新商品・キャンペーン等のご案内のため", value: "marketing" },
  { label: "サービス・商品の改善、統計的分析のため", value: "improvement" },
  { label: "法令に基づく対応のため", value: "legal" },
];

const COLLECTED_OPTIONS = [
  { label: "氏名", value: "name" },
  { label: "メールアドレス", value: "email" },
  { label: "住所", value: "address" },
  { label: "電話番号", value: "phone" },
  { label: "決済情報（クレジットカード等）", value: "payment" },
  { label: "購入・取引履歴", value: "order_history" },
  { label: "Cookie・端末情報・アクセスログ", value: "cookie" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { isPro } = await getPlanStatus(billing);

  const [privacy, shopConfig] = await Promise.all([
    prisma.privacyConfig.findUnique({ where: { shop: session.shop } }),
    prisma.shopConfig.findUnique({ where: { shop: session.shop } }),
  ]);

  const html =
    privacy && isPro
      ? generatePrivacyHtml(privacy, shopConfig, { hideWatermark: true })
      : null;

  return json({ privacy, shopConfig, html, isPro });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  // Proプラン限定機能：サーバー側で必ず再確認する
  const { isPro } = await getPlanStatus(billing);
  if (!isPro) {
    return json(
      { error: "プライバシーポリシー生成はProプラン限定の機能です。" },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save") {
    const data = {
      shop: session.shop,
      operatorName: (formData.get("operatorName") as string) || "",
      contactEmail: (formData.get("contactEmail") as string) || "",
      purposes: formData.getAll("purposes") as string[],
      collectedItems: formData.getAll("collectedItems") as string[],
      usesCookies: formData.get("usesCookies") === "on",
      usesAnalytics: formData.get("usesAnalytics") === "on",
      analyticsNote: (formData.get("analyticsNote") as string) || null,
      sharesThirdParty: formData.get("sharesThirdParty") === "on",
      thirdPartyNote: (formData.get("thirdPartyNote") as string) || null,
      disclosureContact: (formData.get("disclosureContact") as string) || null,
      extraNote: (formData.get("extraNote") as string) || null,
    };

    const errors = validatePrivacyConfig(data);
    if (errors.length > 0) {
      return json({ errors }, { status: 400 });
    }

    await prisma.privacyConfig.upsert({
      where: { shop: session.shop },
      create: data,
      update: data,
    });
    return json({ saved: true });
  }

  if (intent === "publish") {
    const [privacy, shopConfig] = await Promise.all([
      prisma.privacyConfig.findUnique({ where: { shop: session.shop } }),
      prisma.shopConfig.findUnique({ where: { shop: session.shop } }),
    ]);
    if (!privacy) {
      return json({ error: "先に内容を保存してください。" }, { status: 400 });
    }

    const publishedAt = new Date();
    const html = generatePrivacyHtml(
      { ...privacy, lastPublishedAt: publishedAt },
      shopConfig,
      { hideWatermark: true }
    );
    const pageTitle = "プライバシーポリシー";

    let pageId = privacy.pageId;
    let pageUrl = privacy.pageUrl;

    try {
      // ストアに同じハンドルのページが既にあれば再利用する（ハンドル重複エラー防止）
      if (!pageId) {
        const lookup = await admin.graphql(
          `#graphql
          query { pages(first: 100) { nodes { id handle } } }`
        );
        const lookupData = await lookup.json();
        const existing = (lookupData.data?.pages?.nodes ?? []).find(
          (n: any) => n.handle === "privacy-policy"
        );
        if (existing) pageId = existing.id;
      }

      if (pageId) {
        const res = await admin.graphql(
          `#graphql
          mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              page { id handle }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              id: pageId,
              page: { title: pageTitle, body: html, isPublished: true },
            },
          }
        );
        const data = await res.json();
        const userErrors = data.data?.pageUpdate?.userErrors;
        if (userErrors?.length > 0) {
          throw new Error(userErrors.map((e: any) => e.message).join(", "));
        }
        const page = data.data?.pageUpdate?.page;
        if (page) pageUrl = `https://${session.shop}/pages/${page.handle}`;
      } else {
        const res = await admin.graphql(
          `#graphql
          mutation pageCreate($page: PageCreateInput!) {
            pageCreate(page: $page) {
              page { id handle }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              page: {
                title: pageTitle,
                handle: "privacy-policy",
                body: html,
                isPublished: true,
              },
            },
          }
        );
        const data = await res.json();
        const userErrors = data.data?.pageCreate?.userErrors;
        if (userErrors?.length > 0) {
          throw new Error(userErrors.map((e: any) => e.message).join(", "));
        }
        const page = data.data?.pageCreate?.page;
        if (page) {
          pageId = page.id;
          pageUrl = `https://${session.shop}/pages/${page.handle}`;
        }
      }

      await prisma.privacyConfig.update({
        where: { shop: session.shop },
        data: { pageId, pageUrl, isPublished: true, lastPublishedAt: publishedAt },
      });

      return json({ success: true, pageUrl });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[privacy publish] Pages API error:", msg);
      return json({ error: `ページの公開に失敗しました: ${msg}` }, { status: 500 });
    }
  }

  return json({ error: "不明な操作です。" }, { status: 400 });
};

export default function Privacy() {
  const { privacy, shopConfig, html, isPro } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [purposes, setPurposes] = useState<string[]>(privacy?.purposes ?? []);
  const [collectedItems, setCollectedItems] = useState<string[]>(
    privacy?.collectedItems ?? ["name", "email", "address"]
  );
  const [usesCookies, setUsesCookies] = useState(privacy?.usesCookies ?? true);
  const [usesAnalytics, setUsesAnalytics] = useState(privacy?.usesAnalytics ?? false);
  const [sharesThirdParty, setSharesThirdParty] = useState(
    privacy?.sharesThirdParty ?? false
  );
  const [fields, setFields] = useState({
    operatorName: privacy?.operatorName || shopConfig?.sellerName || "",
    contactEmail: privacy?.contactEmail || shopConfig?.email || "",
    analyticsNote: privacy?.analyticsNote || "",
    thirdPartyNote: privacy?.thirdPartyNote || "",
    disclosureContact: privacy?.disclosureContact || "",
    extraNote: privacy?.extraNote || "",
  });
  const setField = (key: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  if (!isPro) {
    return (
      <Page title="プライバシーポリシー生成" backAction={{ content: "ダッシュボード", url: "/app" }}>
        <Layout>
          <Layout.Section>
            <Banner title="Proプラン限定機能" tone="info">
              <p>
                プライバシーポリシー（個人情報保護方針）ページの自動生成は Pro プランの機能です。
                個人情報保護法を参考にした雛形から、数分でストアに公開できます。
              </p>
            </Banner>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Proプランでできること</Text>
                <List type="bullet">
                  <List.Item>個人情報の利用目的・取得項目をフォームで入力</List.Item>
                  <List.Item>第三者提供・Cookie・アクセス解析の記載に対応</List.Item>
                  <List.Item>ワンクリックで /pages/privacy-policy に公開</List.Item>
                </List>
                <Box>
                  <Button variant="primary" url="/app/billing">
                    Proプランにアップグレード
                  </Button>
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">
                  ※ 生成されるポリシーは雛形です。内容の法的正確性はご利用者の責任でご確認ください。
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="プライバシーポリシー生成" backAction={{ content: "ダッシュボード", url: "/app" }}>
      <Layout>
        {actionData && "saved" in actionData && actionData.saved && (
          <Layout.Section>
            <Banner title="保存しました" tone="success">
              <p>内容を保存しました。下のプレビューを確認して公開してください。</p>
            </Banner>
          </Layout.Section>
        )}
        {actionData && "success" in actionData && actionData.success && (
          <Layout.Section>
            <Banner
              title="プライバシーポリシーを公開しました！"
              tone="success"
              action={{
                content: "ページを確認する",
                onAction: () => {
                  if (actionData.pageUrl)
                    window.open(actionData.pageUrl, "_blank", "noopener,noreferrer");
                },
              }}
            >
              <p>ストアに公開されました。{actionData.pageUrl && <> URL: <strong>{actionData.pageUrl}</strong></>}</p>
            </Banner>
          </Layout.Section>
        )}
        {actionData && "error" in actionData && (
          <Layout.Section>
            <Banner title="エラー" tone="critical"><p>{actionData.error}</p></Banner>
          </Layout.Section>
        )}
        {actionData && "errors" in actionData && (
          <Layout.Section>
            <Banner title="入力内容をご確認ください" tone="critical">
              <ul>{actionData.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Form method="post">
            <input type="hidden" name="intent" value="save" />
            {purposes.map((p) => (
              <input key={p} type="hidden" name="purposes" value={p} />
            ))}
            {collectedItems.map((c) => (
              <input key={c} type="hidden" name="collectedItems" value={c} />
            ))}
            {usesCookies && <input type="hidden" name="usesCookies" value="on" />}
            {usesAnalytics && <input type="hidden" name="usesAnalytics" value="on" />}
            {sharesThirdParty && <input type="hidden" name="sharesThirdParty" value="on" />}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">プライバシーポリシーの内容</Text>
                <FormLayout>
                  <TextField
                    label="事業者名 *"
                    name="operatorName"
                    value={fields.operatorName}
                    onChange={setField("operatorName")}
                    autoComplete="organization"
                    helpText="特商法設定から自動入力されます"
                  />
                  <TextField
                    label="連絡先メールアドレス *"
                    name="contactEmail"
                    type="email"
                    value={fields.contactEmail}
                    onChange={setField("contactEmail")}
                    autoComplete="email"
                  />
                  <ChoiceList
                    title="取得する個人情報 *"
                    choices={COLLECTED_OPTIONS}
                    selected={collectedItems}
                    onChange={setCollectedItems}
                    allowMultiple
                  />
                  <ChoiceList
                    title="利用目的 *"
                    choices={PURPOSE_OPTIONS}
                    selected={purposes}
                    onChange={setPurposes}
                    allowMultiple
                  />
                  <Checkbox
                    label="Cookieを使用している"
                    checked={usesCookies}
                    onChange={setUsesCookies}
                  />
                  <Checkbox
                    label="アクセス解析ツールを使用している（Google Analytics等）"
                    checked={usesAnalytics}
                    onChange={setUsesAnalytics}
                  />
                  {usesAnalytics && (
                    <TextField
                      label="アクセス解析ツール名"
                      name="analyticsNote"
                      value={fields.analyticsNote}
                      onChange={setField("analyticsNote")}
                      autoComplete="off"
                      placeholder="Google Analytics"
                    />
                  )}
                  <Checkbox
                    label="個人情報を第三者に提供することがある"
                    checked={sharesThirdParty}
                    onChange={setSharesThirdParty}
                  />
                  {sharesThirdParty && (
                    <TextField
                      label="第三者提供の内容"
                      name="thirdPartyNote"
                      value={fields.thirdPartyNote}
                      onChange={setField("thirdPartyNote")}
                      autoComplete="off"
                      multiline={2}
                      helpText="提供先・提供する情報の内容を記載"
                    />
                  )}
                  <TextField
                    label="開示等の請求の窓口"
                    name="disclosureContact"
                    value={fields.disclosureContact}
                    onChange={setField("disclosureContact")}
                    autoComplete="off"
                    helpText="空欄の場合は連絡先メールが使用されます"
                  />
                  <TextField
                    label="補足事項"
                    name="extraNote"
                    value={fields.extraNote}
                    onChange={setField("extraNote")}
                    autoComplete="off"
                    multiline={3}
                  />
                </FormLayout>
                <InlineStack align="end">
                  <Button variant="primary" submit loading={isSubmitting}>
                    保存する
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        {html && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">プレビュー</Text>
                  <Form method="post">
                    <input type="hidden" name="intent" value="publish" />
                    <Button submit loading={isSubmitting}>
                      {privacy?.isPublished ? "更新して公開" : "ストアに公開する"}
                    </Button>
                  </Form>
                </InlineStack>
                <Divider />
                <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                  <div dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: "1.8" }} />
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Banner tone="warning">
            <p>
              ⚠️ 本機能が生成するプライバシーポリシーは一般的なひな形です。内容の法的な正確性・完全性・
              最新性、および個人情報保護法その他関係法令への適合を保証するものではありません。事業内容に
              合わせた加筆・修正と最終的な内容の確定は、お客様の責任において行ってください。法改正への自動的な
              追随は保証されません。利用に起因して生じた損害について当社は法令上許容される範囲で責任を負いません。
              必要に応じて弁護士等の専門家にご相談ください。
            </p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
