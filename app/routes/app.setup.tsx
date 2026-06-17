import { useState } from "react";
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
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  ChoiceList,
  Checkbox,
  FormLayout,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { validateConfig } from "../lib/tokushoTemplate";

const PAYMENT_OPTIONS = [
  { label: "クレジットカード（VISA・Mastercard・JCB・AMEX）", value: "credit_card" },
  { label: "コンビニ払い", value: "convenience" },
  { label: "銀行振込", value: "bank_transfer" },
  { label: "代金引換", value: "cash_on_delivery" },
  { label: "PayPay", value: "paypay" },
  { label: "LINE Pay", value: "line_pay" },
  { label: "Amazon Pay", value: "amazon_pay" },
  { label: "Shopify Payments", value: "shopify_payments" },
];

const RETURN_POLICY_OPTIONS = [
  { label: "法定通り（商品到着後8日以内、未使用・未開封品）", value: "STANDARD" },
  { label: "返品不可（デジタル商品・食品等）", value: "NO_RETURN" },
  { label: "独自ポリシーを設定する", value: "CUSTOM" },
];

const RETURN_SHIPPING_OPTIONS = [
  { label: "お客様負担", value: "CUSTOMER" },
  { label: "当店負担", value: "SELLER" },
  {
    label: "条件による（初期不良は当店負担、お客様都合はお客様負担）",
    value: "DEPENDS",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const config = await prisma.shopConfig.findUnique({
    where: { shop: session.shop },
  });
  return json({ config });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const data = {
    shop: session.shop,
    businessType: formData.get("businessType") as "INDIVIDUAL" | "CORPORATION",
    sellerName: (formData.get("sellerName") as string) || "",
    representativeName: (formData.get("representativeName") as string) || null,
    responsibleName: (formData.get("responsibleName") as string) || null,
    postalCode: (formData.get("postalCode") as string) || null,
    prefecture: (formData.get("prefecture") as string) || null,
    address: (formData.get("address") as string) || "",
    buildingName: (formData.get("buildingName") as string) || null,
    phone: (formData.get("phone") as string) || "",
    email: (formData.get("email") as string) || "",
    websiteUrl: (formData.get("websiteUrl") as string) || null,
    salesPrice: (formData.get("salesPrice") as string) || "各商品ページに記載",
    shippingFee: (formData.get("shippingFee") as string) || "",
    paymentMethods: formData.getAll("paymentMethods") as string[],
    paymentTiming: (formData.get("paymentTiming") as string) || "",
    deliveryTiming: (formData.get("deliveryTiming") as string) || "",
    returnPolicy: (formData.get("returnPolicy") as "STANDARD" | "NO_RETURN" | "CUSTOM") || "STANDARD",
    returnDeadline: (formData.get("returnDeadline") as string) || "商品到着後8日以内",
    returnCondition: (formData.get("returnCondition") as string) || "未使用・未開封のもの",
    returnShipping: (formData.get("returnShipping") as "CUSTOMER" | "SELLER" | "DEPENDS") || "DEPENDS",
    returnNote: (formData.get("returnNote") as string) || null,
    otherCosts: (formData.get("otherCosts") as string) || null,
    applicationPeriod: (formData.get("applicationPeriod") as string) || null,
    contractLiability: (formData.get("contractLiability") as string) || null,
    sellsDigital: formData.get("sellsDigital") === "on",
    softwareRequirements: (formData.get("softwareRequirements") as string) || null,
    sellsSubscription: formData.get("sellsSubscription") === "on",
    subscriptionTerms: (formData.get("subscriptionTerms") as string) || null,
    specialConditions: (formData.get("specialConditions") as string) || null,
    contactNote: (formData.get("contactNote") as string) || null,
    accentColor: (formData.get("accentColor") as string) || "#008060",
    templateStyle: (formData.get("templateStyle") as string) || "table",
  };

  const errors = validateConfig(data);
  if (errors.length > 0) {
    return json({ errors }, { status: 400 });
  }

  await prisma.shopConfig.upsert({
    where: { shop: session.shop },
    create: data,
    update: data,
  });

  return redirect("/app/preview");
};

export default function Setup() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // ChoiceList の選択状態
  const [businessType, setBusinessType] = useState<string[]>([
    config?.businessType || "INDIVIDUAL",
  ]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    config?.paymentMethods?.length ? config.paymentMethods : ["credit_card"]
  );
  const [returnPolicy, setReturnPolicy] = useState<string[]>([
    config?.returnPolicy || "STANDARD",
  ]);
  const [returnShipping, setReturnShipping] = useState<string[]>([
    config?.returnShipping || "DEPENDS",
  ]);
  const [sellsDigital, setSellsDigital] = useState(config?.sellsDigital ?? false);
  const [sellsSubscription, setSellsSubscription] = useState(
    config?.sellsSubscription ?? false
  );
  const [templateStyle, setTemplateStyle] = useState<string[]>([
    config?.templateStyle || "table",
  ]);

  // TextField の入力状態（Polaris v13 は controlled が必須）
  const [fields, setFields] = useState({
    sellerName: config?.sellerName || "",
    representativeName: config?.representativeName || "",
    responsibleName: config?.responsibleName || "",
    postalCode: config?.postalCode || "",
    prefecture: config?.prefecture || "",
    address: config?.address || "",
    buildingName: config?.buildingName || "",
    phone: config?.phone || "",
    email: config?.email || "",
    websiteUrl: config?.websiteUrl || "",
    salesPrice: config?.salesPrice || "各商品ページに記載",
    shippingFee: config?.shippingFee || "全国一律500円（税込）",
    otherCosts: config?.otherCosts || "",
    applicationPeriod: config?.applicationPeriod || "",
    contractLiability: config?.contractLiability || "",
    paymentTiming: config?.paymentTiming || "クレジットカード：注文時決済。コンビニ払い：注文後3日以内",
    deliveryTiming: config?.deliveryTiming || "ご注文確認後3〜5営業日以内に発送",
    returnDeadline: config?.returnDeadline || "商品到着後8日以内",
    returnCondition: config?.returnCondition || "未使用・未開封のもの",
    returnNote: config?.returnNote || "",
    softwareRequirements: config?.softwareRequirements || "",
    subscriptionTerms: config?.subscriptionTerms || "",
    specialConditions: config?.specialConditions || "",
    contactNote: config?.contactNote || "",
    accentColor: config?.accentColor || "#008060",
  });
  const setField = (key: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <Page
      title="事業者情報を入力"
      backAction={{ content: "ダッシュボード", url: "/app" }}
    >
      <Form method="post">
        {/* ChoiceList の選択値を hidden input でフォームに送信 */}
        <input type="hidden" name="businessType" value={businessType[0]} />
        {paymentMethods.map((m) => (
          <input key={m} type="hidden" name="paymentMethods" value={m} />
        ))}
        <input type="hidden" name="returnPolicy" value={returnPolicy[0]} />
        <input type="hidden" name="returnShipping" value={returnShipping[0]} />
        {sellsDigital && <input type="hidden" name="sellsDigital" value="on" />}
        {sellsSubscription && (
          <input type="hidden" name="sellsSubscription" value="on" />
        )}
        <input type="hidden" name="templateStyle" value={templateStyle[0]} />

        <Layout>
          {actionData?.errors && (
            <Layout.Section>
              <Banner title="入力内容をご確認ください" tone="critical">
                <ul>
                  {actionData.errors.map((e: string, i: number) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </Banner>
            </Layout.Section>
          )}

          {/* 1. 事業者情報 */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  1. 事業者情報
                </Text>
                <FormLayout>
                  <ChoiceList
                    title="事業者種別"
                    choices={[
                      { label: "個人事業主", value: "INDIVIDUAL" },
                      { label: "法人（株式会社・合同会社等）", value: "CORPORATION" },
                    ]}
                    selected={businessType}
                    onChange={setBusinessType}
                  />

                  <TextField
                    label="販売業者名 / 屋号 *"
                    name="sellerName"
                    value={fields.sellerName}
                    onChange={setField("sellerName")}
                    autoComplete="organization"
                    helpText="登記上の法人名または屋号を入力してください"
                  />

                  {businessType[0] === "CORPORATION" && (
                    <TextField
                      label="代表者名（法人の場合必須）"
                      name="representativeName"
                      value={fields.representativeName}
                      onChange={setField("representativeName")}
                      autoComplete="name"
                      helpText="例：山田 太郎"
                    />
                  )}

                  <TextField
                    label="通信販売責任者名"
                    name="responsibleName"
                    value={fields.responsibleName}
                    onChange={setField("responsibleName")}
                    autoComplete="name"
                    helpText="代表者と異なる場合のみ入力"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 2. 所在地・連絡先 */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  2. 所在地・連絡先
                </Text>
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="郵便番号"
                      name="postalCode"
                      value={fields.postalCode}
                      onChange={setField("postalCode")}
                      autoComplete="postal-code"
                      placeholder="000-0000"
                    />
                    <TextField
                      label="都道府県"
                      name="prefecture"
                      value={fields.prefecture}
                      onChange={setField("prefecture")}
                      autoComplete="address-level1"
                      placeholder="東京都"
                    />
                  </FormLayout.Group>

                  <TextField
                    label="住所（市区町村・番地） *"
                    name="address"
                    value={fields.address}
                    onChange={setField("address")}
                    autoComplete="street-address"
                    placeholder="渋谷区渋谷1-1-1"
                  />

                  <TextField
                    label="建物名・部屋番号"
                    name="buildingName"
                    value={fields.buildingName}
                    onChange={setField("buildingName")}
                    autoComplete="address-line2"
                    placeholder="○○ビル 101号"
                  />

                  <TextField
                    label="電話番号 *"
                    name="phone"
                    value={fields.phone}
                    onChange={setField("phone")}
                    autoComplete="tel"
                    type="tel"
                    placeholder="03-0000-0000"
                    helpText="お客様からのお問い合わせ用の電話番号"
                  />

                  <TextField
                    label="メールアドレス *"
                    name="email"
                    value={fields.email}
                    onChange={setField("email")}
                    autoComplete="email"
                    type="email"
                    placeholder="info@example.com"
                  />

                  <TextField
                    label="ウェブサイトURL"
                    name="websiteUrl"
                    value={fields.websiteUrl}
                    onChange={setField("websiteUrl")}
                    autoComplete="url"
                    placeholder="https://example.com"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 3. 販売条件 */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  3. 販売条件
                </Text>
                <FormLayout>
                  <TextField
                    label="販売価格"
                    name="salesPrice"
                    value={fields.salesPrice}
                    onChange={setField("salesPrice")}
                    autoComplete="off"
                    helpText="例：各商品ページに記載（税込）"
                    multiline={2}
                  />

                  <TextField
                    label="送料"
                    name="shippingFee"
                    value={fields.shippingFee}
                    onChange={setField("shippingFee")}
                    autoComplete="off"
                    helpText="例：全国一律500円（税込）、5,000円以上購入で送料無料"
                    multiline={2}
                  />

                  <TextField
                    label="商品代金・送料以外に発生する費用"
                    name="otherCosts"
                    value={fields.otherCosts}
                    onChange={setField("otherCosts")}
                    autoComplete="off"
                    helpText="コンビニ払い手数料、代引き手数料など。なければ空白"
                    multiline={2}
                  />

                  <ChoiceList
                    title="お支払い方法 *"
                    choices={PAYMENT_OPTIONS}
                    selected={paymentMethods}
                    onChange={setPaymentMethods}
                    allowMultiple
                  />

                  <TextField
                    label="お支払い時期"
                    name="paymentTiming"
                    value={fields.paymentTiming}
                    onChange={setField("paymentTiming")}
                    autoComplete="off"
                    multiline={2}
                  />

                  <TextField
                    label="商品の引渡し時期"
                    name="deliveryTiming"
                    value={fields.deliveryTiming}
                    onChange={setField("deliveryTiming")}
                    autoComplete="off"
                    multiline={2}
                  />

                  <TextField
                    label="申込みの有効期限"
                    name="applicationPeriod"
                    value={fields.applicationPeriod}
                    onChange={setField("applicationPeriod")}
                    autoComplete="off"
                    multiline={2}
                    helpText="期間限定販売・予約販売など、申込みに期限がある場合のみ記載"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 4. 返品・キャンセルポリシー */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  4. 返品・キャンセルポリシー
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  ※ 返品特約の内容は広告上で省略できない必須表示項目です（特商法）
                </Text>
                <FormLayout>
                  <ChoiceList
                    title="返品ポリシー"
                    choices={RETURN_POLICY_OPTIONS}
                    selected={returnPolicy}
                    onChange={setReturnPolicy}
                  />

                  {returnPolicy[0] !== "NO_RETURN" && (
                    <>
                      <TextField
                        label="返品・交換期限"
                        name="returnDeadline"
                        value={fields.returnDeadline}
                        onChange={setField("returnDeadline")}
                        autoComplete="off"
                      />

                      <TextField
                        label="返品・交換条件"
                        name="returnCondition"
                        value={fields.returnCondition}
                        onChange={setField("returnCondition")}
                        autoComplete="off"
                        multiline={2}
                      />

                      <ChoiceList
                        title="返品送料負担"
                        choices={RETURN_SHIPPING_OPTIONS}
                        selected={returnShipping}
                        onChange={setReturnShipping}
                      />
                    </>
                  )}

                  <TextField
                    label="返品に関する補足"
                    name="returnNote"
                    value={fields.returnNote}
                    onChange={setField("returnNote")}
                    autoComplete="off"
                    multiline={3}
                    helpText="セール品・カスタム品の返品不可など"
                  />

                  <TextField
                    label="契約不適合責任"
                    name="contractLiability"
                    value={fields.contractLiability}
                    onChange={setField("contractLiability")}
                    autoComplete="off"
                    multiline={2}
                    helpText="届いた商品が注文と異なる・欠陥がある場合の対応。責任を免除・限定する場合は明記が必要です"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 5. その他（任意） */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  5. その他（該当する場合のみ）
                </Text>
                <FormLayout>
                  <Checkbox
                    label="デジタル商品（ソフトウェア・ダウンロード商品）を販売している"
                    checked={sellsDigital}
                    onChange={setSellsDigital}
                  />
                  {sellsDigital && (
                    <TextField
                      label="ソフトウェア動作環境 *"
                      name="softwareRequirements"
                      value={fields.softwareRequirements}
                      onChange={setField("softwareRequirements")}
                      autoComplete="off"
                      multiline={2}
                      helpText="対応OS・ブラウザ・必要スペック等。デジタル商品販売時は必須です"
                    />
                  )}

                  <Checkbox
                    label="継続課金・定期購入（サブスクリプション）を販売している"
                    checked={sellsSubscription}
                    onChange={setSellsSubscription}
                  />
                  {sellsSubscription && (
                    <TextField
                      label="継続契約条件 *"
                      name="subscriptionTerms"
                      value={fields.subscriptionTerms}
                      onChange={setField("subscriptionTerms")}
                      autoComplete="off"
                      multiline={2}
                      helpText="課金サイクル・解約方法・最低利用期間等。継続課金販売時は必須です"
                    />
                  )}

                  <TextField
                    label="特別販売条件"
                    name="specialConditions"
                    value={fields.specialConditions}
                    onChange={setField("specialConditions")}
                    autoComplete="off"
                    multiline={2}
                    helpText="数量限定・会員限定など特別な条件がある場合"
                  />

                  <TextField
                    label="お問い合わせに関する注意"
                    name="contactNote"
                    value={fields.contactNote}
                    onChange={setField("contactNote")}
                    autoComplete="off"
                    multiline={2}
                    helpText="対応時間・対応言語など"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 6. デザイン */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  6. デザイン
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  ※ デザインのカスタマイズは Basic プラン以上で公開ページに反映されます（Freeプランは標準デザイン）。
                </Text>
                <FormLayout>
                  <TextField
                    label="アクセントカラー"
                    name="accentColor"
                    value={fields.accentColor}
                    onChange={setField("accentColor")}
                    autoComplete="off"
                    placeholder="#008060"
                    helpText="見出し・表のヘッダーに使う色（例：#008060）"
                  />
                  <ChoiceList
                    title="レイアウト"
                    choices={[
                      { label: "標準（枠線あり）", value: "table" },
                      { label: "ミニマル（枠線控えめ）", value: "minimal" },
                    ]}
                    selected={templateStyle}
                    onChange={setTemplateStyle}
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 送信ボタン */}
          <Layout.Section>
            <InlineStack align="end" gap="300">
              <Button url="/app" variant="plain">
                キャンセル
              </Button>
              <Button
                variant="primary"
                submit
                loading={isSubmitting}
                size="large"
              >
                保存してプレビューへ →
              </Button>
            </InlineStack>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
