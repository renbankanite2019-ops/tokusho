import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { generateTokushoHtml } from "../lib/tokushoTemplate";
import { PLANS } from "../lib/plans";
import { isTestBilling } from "../lib/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const config = await prisma.shopConfig.findUnique({
    where: { shop: session.shop },
  });

  if (!config) {
    return redirect("/app/setup");
  }

  // 有料プランのみウォーターマークを非表示にする（実際の課金状態で判定）
  const isTest = isTestBilling();
  let hasActivePayment = false;
  try {
    ({ hasActivePayment } = await billing.check({ plans: [PLANS.BASIC, PLANS.PRO], isTest }));
  } catch (e) {
    console.error("[preview loader] billing.check failed:", e);
  }

  const html = generateTokushoHtml(config as any, { hideWatermark: hasActivePayment });
  return json({ config, html });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);

  const config = await prisma.shopConfig.findUnique({
    where: { shop: session.shop },
  });

  if (!config) {
    return json({ error: "設定が見つかりません" }, { status: 400 });
  }

  const isTest = isTestBilling();
  let hasActivePayment = false;
  try {
    ({ hasActivePayment } = await billing.check({ plans: [PLANS.BASIC, PLANS.PRO], isTest }));
  } catch (e) {
    console.error("[preview action] billing.check failed:", e);
  }

  // 公開時刻を確定し、その時刻を「最終更新日」として埋め込む
  const publishedAt = new Date();
  const html = generateTokushoHtml(
    { ...config, lastPublishedAt: publishedAt } as any,
    { hideWatermark: hasActivePayment }
  );

  // Shopify Pages API でページを作成/更新
  const pageTitle = "特定商取引法に基づく表記";

  let pageId = config.pageId;
  let pageUrl = config.pageUrl;

  try {
    if (pageId) {
      // 既存ページを更新
      const updateResponse = await admin.graphql(
        `#graphql
        mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            id: pageId,
            page: {
              title: pageTitle,
              body: html,
              isPublished: true,
            },
          },
        }
      );

      const updateData = await updateResponse.json();
      const userErrors = updateData.data?.pageUpdate?.userErrors;
      if (userErrors?.length > 0) {
        throw new Error(userErrors.map((e: any) => e.message).join(", "));
      }
      const updatedPage = updateData.data?.pageUpdate?.page;
      if (updatedPage) {
        pageUrl = `https://${session.shop}/pages/${updatedPage.handle}`;
      }
    } else {
      // 新規ページ作成
      const createResponse = await admin.graphql(
        `#graphql
        mutation pageCreate($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            page: {
              title: pageTitle,
              handle: "tokushoho",
              body: html,
              isPublished: true,
            },
          },
        }
      );

      const createData = await createResponse.json();
      const userErrors = createData.data?.pageCreate?.userErrors;
      if (userErrors?.length > 0) {
        throw new Error(userErrors.map((e: any) => e.message).join(", "));
      }
      const createdPage = createData.data?.pageCreate?.page;
      if (createdPage) {
        pageId = createdPage.id;
        pageUrl = `https://${session.shop}/pages/${createdPage.handle}`;
      }
    }

    // DBを更新
    await prisma.shopConfig.update({
      where: { shop: session.shop },
      data: {
        pageId,
        pageUrl,
        isPublished: true,
        lastPublishedAt: publishedAt,
      },
    });

    return json({ success: true, pageUrl });
  } catch (error) {
    if (error instanceof Response) {
      // 再認証が必要な場合（リダイレクト or 再認可ヘッダ）だけ通す
      const reauth = error.headers.get(
        "x-shopify-api-request-failure-reauthorize"
      );
      if ((error.status >= 300 && error.status < 400) || reauth) {
        throw error;
      }
      // それ以外（403等）は本文を読んで実際のメッセージを表示する
      const body = await error
        .clone()
        .text()
        .catch(() => "");
      const detail = (body || error.statusText || "").slice(0, 300);
      console.error("[preview action] Pages API HTTP", error.status, detail);
      return json(
        { error: `ページの公開に失敗しました (HTTP ${error.status}): ${detail}` },
        { status: 500 }
      );
    }
    console.error("[preview action] Pages API error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return json(
      { error: `ページの公開に失敗しました: ${msg}` },
      { status: 500 }
    );
  }
};

export default function Preview() {
  const { config, html } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isPublishing = navigation.state === "submitting";

  return (
    <Page
      title="プレビュー・公開"
      backAction={{ content: "情報を編集する", url: "/app/setup" }}
    >
      <Layout>
        {actionData && "success" in actionData && actionData.success && (
          <Layout.Section>
            <Banner
              title="特商法ページを公開しました！"
              tone="success"
              action={{
                content: "ページを確認する",
                onAction: () => {
                  if (actionData.pageUrl) {
                    window.open(actionData.pageUrl, "_blank", "noopener,noreferrer");
                  }
                },
              }}
            >
              <p>
                お客様のストアに特定商取引法に基づく表記ページが公開されました。
                {actionData.pageUrl && (
                  <> URL: <strong>{actionData.pageUrl}</strong></>
                )}
              </p>
            </Banner>
          </Layout.Section>
        )}

        {actionData && "error" in actionData && (
          <Layout.Section>
            <Banner title="エラーが発生しました" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  ページプレビュー
                </Text>
                <Form method="post">
                  <Button
                    variant="primary"
                    submit
                    loading={isPublishing}
                    size="large"
                  >
                    {config.isPublished
                      ? "ページを更新して公開する"
                      : "ストアに公開する"}
                  </Button>
                </Form>
              </InlineStack>

              <Divider />

              {/* HTML プレビュー */}
              <Box
                background="bg-surface-secondary"
                padding="400"
                borderRadius="200"
              >
                <div
                  dangerouslySetInnerHTML={{ __html: html }}
                  style={{
                    fontFamily: "sans-serif",
                    lineHeight: "1.8",
                  }}
                />
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                公開について
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                「ストアに公開する」を押すと、あなたのShopifyストアに
                <strong>/pages/tokushoho</strong> のURLでページが作成されます。
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                情報を変更した場合は、再度「ページを更新して公開する」を押してください。
              </Text>
              <Divider />
              <Text as="p" variant="bodyMd" tone="caution">
                ⚠️ 本アプリは特商法ページの作成を補助するツールです。
                法的な正確性はお客様の責任においてご確認ください。
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
