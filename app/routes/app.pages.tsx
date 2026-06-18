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
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { getPlanStatus } from "../lib/billing";
import {
  PAGE_TYPES,
  PAGE_TYPE_LIST,
  isPageType,
  defaultBody,
  renderCustomPageHtml,
} from "../lib/customPageTemplate";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const { isPro } = await getPlanStatus(billing);

  const [shopConfig, rows] = await Promise.all([
    prisma.shopConfig.findUnique({ where: { shop: session.shop } }),
    prisma.customPage.findMany({ where: { shop: session.shop } }),
  ]);

  const pages = PAGE_TYPE_LIST.map((type) => {
    const existing = rows.find((r) => r.pageType === type);
    return {
      type,
      title: PAGE_TYPES[type].title,
      body: existing?.body || defaultBody(type, shopConfig),
      isPublished: existing?.isPublished ?? false,
      pageUrl: existing?.pageUrl ?? null,
    };
  });

  return json({ isPro, pages });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const { isPro } = await getPlanStatus(billing);
  if (!isPro) {
    return json({ error: "追加ページの作成はProプラン限定の機能です。" }, { status: 403 });
  }

  const formData = await request.formData();
  const type = formData.get("type") as string;
  const body = (formData.get("body") as string) || "";
  if (!isPageType(type)) {
    return json({ error: "不明なページ種別です。" }, { status: 400 });
  }

  const where = { shop_pageType: { shop: session.shop, pageType: type } };
  await prisma.customPage.upsert({
    where,
    create: { shop: session.shop, pageType: type, body },
    update: { body },
  });

  const meta = PAGE_TYPES[type];
  const html = renderCustomPageHtml(meta.title, body);
  const existing = await prisma.customPage.findUnique({ where });
  let pageId = existing?.pageId ?? null;
  let pageUrl = existing?.pageUrl ?? null;
  const publishedAt = new Date();

  try {
    // 既存の同ハンドルページを再利用（ハンドル重複エラー防止）
    if (!pageId) {
      const lookup = await admin.graphql(
        `#graphql
        query { pages(first: 100) { nodes { id handle } } }`
      );
      const data = await lookup.json();
      const found = (data.data?.pages?.nodes ?? []).find(
        (n: any) => n.handle === meta.handle
      );
      if (found) pageId = found.id;
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
        { variables: { id: pageId, page: { title: meta.title, body: html, isPublished: true } } }
      );
      const d = await res.json();
      const ue = d.data?.pageUpdate?.userErrors;
      if (ue?.length > 0) throw new Error(ue.map((e: any) => e.message).join(", "));
      const p = d.data?.pageUpdate?.page;
      if (p) pageUrl = `https://${session.shop}/pages/${p.handle}`;
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
            page: { title: meta.title, handle: meta.handle, body: html, isPublished: true },
          },
        }
      );
      const d = await res.json();
      const ue = d.data?.pageCreate?.userErrors;
      if (ue?.length > 0) throw new Error(ue.map((e: any) => e.message).join(", "));
      const p = d.data?.pageCreate?.page;
      if (p) {
        pageId = p.id;
        pageUrl = `https://${session.shop}/pages/${p.handle}`;
      }
    }

    await prisma.customPage.update({
      where,
      data: { pageId, pageUrl, isPublished: true, lastPublishedAt: publishedAt },
    });
    return json({ success: true, type, pageUrl });
  } catch (error) {
    if (error instanceof Response) {
      const reauth = error.headers.get("x-shopify-api-request-failure-reauthorize");
      if ((error.status >= 300 && error.status < 400) || reauth) throw error;
      const t = await error.clone().text().catch(() => "");
      return json(
        { error: `公開に失敗しました (HTTP ${error.status}): ${(t || error.statusText).slice(0, 300)}` },
        { status: 500 }
      );
    }
    const msg = error instanceof Error ? error.message : String(error);
    return json({ error: `公開に失敗しました: ${msg}` }, { status: 500 });
  }
};

export default function Pages() {
  const { isPro, pages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const [bodies, setBodies] = useState<Record<string, string>>(() =>
    Object.fromEntries(pages.map((p) => [p.type, p.body]))
  );

  if (!isPro) {
    return (
      <Page title="追加ページ" backAction={{ content: "ダッシュボード", url: "/app" }}>
        <Layout>
          <Layout.Section>
            <Banner title="Proプラン限定機能" tone="info">
              <p>会社概要・お問い合わせ・返品ポリシーページの作成は Pro プランの機能です。</p>
            </Banner>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Proプランでできること</Text>
                <List type="bullet">
                  <List.Item>会社概要（特商法の情報から雛形を自動生成）</List.Item>
                  <List.Item>お問い合わせページ</List.Item>
                  <List.Item>返品・交換ポリシーページ</List.Item>
                </List>
                <Box>
                  <Button variant="primary" url="/app/billing">Proプランにアップグレード</Button>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="追加ページ" backAction={{ content: "ダッシュボード", url: "/app" }}>
      <Layout>
        {actionData && "success" in actionData && actionData.success && (
          <Layout.Section>
            <Banner
              title="ページを公開しました！"
              tone="success"
              action={{
                content: "ページを確認する",
                onAction: () => {
                  if (actionData.pageUrl)
                    window.open(actionData.pageUrl, "_blank", "noopener,noreferrer");
                },
              }}
            >
              <p>{actionData.pageUrl && <>URL: <strong>{actionData.pageUrl}</strong></>}</p>
            </Banner>
          </Layout.Section>
        )}
        {actionData && "error" in actionData && (
          <Layout.Section>
            <Banner title="エラー" tone="critical"><p>{actionData.error}</p></Banner>
          </Layout.Section>
        )}

        {pages.map((p) => (
          <Layout.Section key={p.type}>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">{p.title}</Text>
                  {p.isPublished && p.pageUrl && (
                    <a
                      href={p.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#005bd3", textDecoration: "none", fontSize: 13 }}
                    >
                      公開中のページ →
                    </a>
                  )}
                </InlineStack>
                <Form method="post">
                  <input type="hidden" name="type" value={p.type} />
                  <BlockStack gap="300">
                    <TextField
                      label="ページ本文"
                      name="body"
                      value={bodies[p.type]}
                      onChange={(v) => setBodies((b) => ({ ...b, [p.type]: v }))}
                      autoComplete="off"
                      multiline={8}
                      helpText="プレーンテキストで入力（改行はそのまま反映されます）"
                    />
                    <InlineStack align="end">
                      <Button variant="primary" submit loading={submitting}>
                        {p.isPublished ? "更新して公開" : "公開する"}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        ))}

        <Layout.Section>
          <Banner tone="warning">
            <p>
              ⚠️ 返品ポリシー等の法的な内容は、生成された雛形をそのまま使わず、貴店の実態に合わせて
              加筆・修正し、必要に応じて専門家にご確認ください。
            </p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
