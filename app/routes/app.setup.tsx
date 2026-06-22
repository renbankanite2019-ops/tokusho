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
  Select,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { validateConfig } from "../lib/tokushoTemplate";
import { toKanjiPrefecture } from "../lib/jpPrefectures";

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

// 自由入力だった項目を「よく使う選択肢＋自由入力」に置き換える（Excel感をなくす）。
// value がそのまま特商法ページに表示される文言になる。
const DELIVERY_PRESETS = [
  { label: "ご注文確認後3〜5営業日以内に発送", value: "ご注文確認後3〜5営業日以内に発送いたします。" },
  { label: "ご注文確認後7日以内に発送", value: "ご注文確認後7日以内に発送いたします。" },
  { label: "ご注文確認後2週間以内に発送", value: "ご注文確認後2週間以内に発送いたします。" },
  { label: "ご決済後すぐに利用可能（デジタル商品）", value: "ご決済確認後、即時にダウンロード／ご利用いただけます。" },
  { label: "在庫状況により異なる（商品ページに記載）", value: "在庫状況により異なります。詳細は各商品ページに記載しております。" },
];

const PAYMENT_TIMING_PRESETS = [
  { label: "カードは注文時／コンビニ・振込は注文後3日以内", value: "クレジットカードは注文時に決済が確定します。コンビニ払い・銀行振込はご注文後3日以内にお支払いください。" },
  { label: "ご注文時にすべて即時決済", value: "ご注文時に即時決済されます。" },
  { label: "各お支払い方法の規定に従う", value: "各お支払い方法の規定に従います。" },
];

const RETURN_CONDITION_PRESETS = [
  { label: "未使用・未開封のもの", value: "未使用・未開封のもの" },
  { label: "未使用・未開封で、到着後8日以内にご連絡いただいたもの", value: "未使用・未開封で、商品到着後8日以内にご連絡いただいたもの" },
  { label: "タグ・付属品が揃った未使用のもの", value: "タグ・付属品が揃った未使用のもの" },
];

const CONTRACT_LIABILITY_PRESETS = [
  { label: "不良・欠陥時は当店負担で交換／返金（到着後8日以内連絡）", value: "商品に欠陥・不良があった場合は、商品到着後8日以内にご連絡いただければ、当店負担で交換または返金いたします。" },
  { label: "注文と異なる・不良品は送料当店負担で交換", value: "お届けした商品が注文内容と異なる場合や不良品であった場合は、送料当店負担にて良品と交換いたします。" },
];

// アクセントカラーのプリセット（落ち着いた中間色。白文字でも読めるトーン）
const PRESET_COLORS = [
  { label: "セージグリーン", value: "#5f7d6e" },
  { label: "スレートブルー", value: "#566784" },
  { label: "ダスティティール", value: "#4f7d7a" },
  { label: "モーヴ", value: "#7a6a82" },
  { label: "ダスティローズ", value: "#9c6b72" },
  { label: "テラコッタ", value: "#a9745c" },
  { label: "オリーブ", value: "#717c54" },
  { label: "グレー", value: "#6b7280" },
  { label: "チャコール", value: "#3f4756" },
];

// クイック設定：販売形態を選ぶと関連項目を自動でセットする
const SALES_TYPES = [
  { label: "物理商品（個人事業主）", value: "ind_physical" },
  { label: "物理商品（法人）", value: "corp_physical" },
  { label: "デジタル商品（ダウンロード・ソフト等）", value: "digital" },
  { label: "サブスク・定期購入", value: "subscription" },
];

/**
 * 色を「見て選ぶ」入力欄。プリセットのスウォッチ＋カラーピッカーで選び、
 * 解決後の16進カラーを hidden input(name="accentColor") で送信する。
 * ユーザーが #008060 のようなコードを知らなくても選べる。
 */
function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#5f7d6e";
  return (
    <BlockStack gap="200">
      <input type="hidden" name="accentColor" value={value} />
      <Text as="span" variant="bodyMd" fontWeight="medium">
        アクセントカラー
      </Text>
      <Text as="p" variant="bodySm" tone="subdued">
        見出し・表のヘッダーに使う色です。下から選ぶか、「自由に選ぶ」で好きな色を指定できます。
      </Text>
      <InlineStack gap="200" blockAlign="center">
        {PRESET_COLORS.map((c) => {
          const selected = value.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              title={c.label}
              aria-label={c.label}
              aria-pressed={selected}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: c.value,
                border: selected ? "3px solid #202223" : "1px solid #d2d5d8",
                boxShadow: selected ? "0 0 0 2px #fff inset" : "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          );
        })}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            marginInlineStart: 4,
          }}
        >
          <input
            type="color"
            value={normalized}
            onChange={(e) => onChange(e.target.value)}
            title="自由に色を選ぶ"
            style={{
              width: 34,
              height: 34,
              padding: 0,
              border: "1px solid #d2d5d8",
              borderRadius: 8,
              cursor: "pointer",
              background: "none",
            }}
          />
          <span style={{ fontSize: 12, color: "#6b7280" }}>自由に選ぶ</span>
        </label>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginInlineStart: 8,
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: normalized,
              border: "1px solid #d2d5d8",
            }}
          />
          <code style={{ fontSize: 12, color: "#6b7280" }}>
            {value || "#5f7d6e"}
          </code>
        </span>
      </InlineStack>
    </BlockStack>
  );
}

/**
 * 「よく使う選択肢から選ぶ／自由入力する」を切り替えられる入力欄。
 * value が presets のいずれかに一致すればプルダウン選択、しなければ自由入力モード。
 * 解決後の文字列を hidden input で送信するので action 側の処理は変更不要。
 */
function PresetField({
  label,
  name,
  value,
  onChange,
  presets,
  helpText,
  multiline = 2,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  presets: { label: string; value: string }[];
  helpText?: string;
  multiline?: number;
}) {
  const isPreset = presets.some((p) => p.value === value);
  const selectValue = isPreset ? value : "__custom__";
  const options = [
    ...presets,
    { label: "✏️ 自由に入力する", value: "__custom__" },
  ];
  return (
    <BlockStack gap="200">
      {/* 解決後の値を送信 */}
      <input type="hidden" name={name} value={value} />
      <Select
        label={label}
        options={options}
        value={selectValue}
        onChange={(v) => onChange(v === "__custom__" ? "" : v)}
        helpText={selectValue === "__custom__" ? undefined : helpText}
      />
      {selectValue === "__custom__" && (
        <TextField
          label={label}
          labelHidden
          value={value}
          onChange={onChange}
          autoComplete="off"
          multiline={multiline}
          placeholder="内容を入力してください"
          helpText={helpText}
        />
      )}
    </BlockStack>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Shopifyストアの設定から事業者情報の下書きを取得する（Excelには真似できない自動入力）。
  // 取得に失敗してもフォームは表示できるよう、エラーは握りつぶして null とする。
  const fetchPrefill = async () => {
    try {
      const res = await admin.graphql(
        `#graphql
        query shopInfo {
          shop {
            name
            email
            contactEmail
            billingAddress {
              address1 address2 city province provinceCode zip phone company
            }
            primaryDomain { url }
          }
        }`
      );
      const d = await res.json();
      const s = d.data?.shop;
      if (!s) return null;
      const a = s.billingAddress ?? {};
      return {
        sellerName: s.name || a.company || "",
        postalCode: a.zip || "",
        prefecture: toKanjiPrefecture(a.province, a.provinceCode),
        address: [a.city, a.address1].filter(Boolean).join(" "),
        buildingName: a.address2 || "",
        phone: a.phone || "",
        email: s.contactEmail || s.email || "",
        websiteUrl: s.primaryDomain?.url || "",
      };
    } catch (e) {
      console.error("[setup] shop info fetch failed:", e);
      return null;
    }
  };

  // DB取得とストア情報取得を並列化して初回表示を速くする。
  const [config, prefill] = await Promise.all([
    prisma.shopConfig.findUnique({ where: { shop: session.shop } }),
    fetchPrefill(),
  ]);

  // 販売形態の自動判定（read_products）は初回設定時のみ実行し、
  // 編集時は不要なAPI呼び出しを省いて高速化する。
  let detected = { digital: false, subscription: false };
  if (!config) {
    try {
      const res = await admin.graphql(
        `#graphql
        query detectTypes {
          products(first: 30) {
            nodes { variants(first: 1) { nodes { requiresShipping } } }
          }
          sellingPlanGroups(first: 1) { nodes { id } }
        }`
      );
      const d = await res.json();
      const nodes = d.data?.products?.nodes ?? [];
      const digitalCount = nodes.filter(
        (p: any) => p.variants?.nodes?.[0]?.requiresShipping === false
      ).length;
      detected = {
        digital: nodes.length > 0 && digitalCount > 0,
        subscription: (d.data?.sellingPlanGroups?.nodes?.length ?? 0) > 0,
      };
    } catch (e) {
      console.error("[setup] product detection failed (read_products scope?):", e);
    }
  }

  return json({ config, prefill, detected });
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
    bilingual: formData.get("bilingual") === "on",
    // チェックON=通知を受け取る → optOut は反転
    lawAlertOptOut: formData.get("lawAlertEmail") !== "on",
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
  const { config, prefill, detected } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // 初回設定（config が無い）のときだけ Shopify 設定の下書きを初期値に使う。
  const pf = config ? null : prefill;

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
  const [bilingual, setBilingual] = useState(config?.bilingual ?? false);
  // 法令アップデートのメール通知を受け取るか（既定ON。optOut の反転）
  const [lawAlertEmail, setLawAlertEmail] = useState(
    !(config?.lawAlertOptOut ?? false)
  );
  // クイック設定（販売形態）の選択状態
  const [salesType, setSalesType] = useState<string[]>([]);
  // Shopify 設定からの取込結果（確認メッセージ用）
  const [importInfo, setImportInfo] = useState<{
    count: number;
    missing: string[];
  } | null>(null);

  // TextField の入力状態（Polaris v13 は controlled が必須）
  // 連絡先系は初回のみ Shopify 設定（pf）を初期値にフォールバックする。
  const [fields, setFields] = useState({
    sellerName: config?.sellerName || pf?.sellerName || "",
    representativeName: config?.representativeName || "",
    responsibleName: config?.responsibleName || "",
    postalCode: config?.postalCode || pf?.postalCode || "",
    prefecture: config?.prefecture || pf?.prefecture || "",
    address: config?.address || pf?.address || "",
    buildingName: config?.buildingName || pf?.buildingName || "",
    phone: config?.phone || pf?.phone || "",
    email: config?.email || pf?.email || "",
    websiteUrl: config?.websiteUrl || pf?.websiteUrl || "",
    salesPrice: config?.salesPrice || "各商品ページに記載",
    shippingFee: config?.shippingFee || "全国一律500円（税込）",
    otherCosts: config?.otherCosts || "",
    applicationPeriod: config?.applicationPeriod || "",
    contractLiability: config?.contractLiability || CONTRACT_LIABILITY_PRESETS[0].value,
    paymentTiming: config?.paymentTiming || PAYMENT_TIMING_PRESETS[0].value,
    deliveryTiming: config?.deliveryTiming || DELIVERY_PRESETS[0].value,
    returnDeadline: config?.returnDeadline || "商品到着後8日以内",
    returnCondition: config?.returnCondition || RETURN_CONDITION_PRESETS[0].value,
    returnNote: config?.returnNote || "",
    softwareRequirements: config?.softwareRequirements || "",
    subscriptionTerms: config?.subscriptionTerms || "",
    specialConditions: config?.specialConditions || "",
    contactNote: config?.contactNote || "",
    accentColor: config?.accentColor || "#5f7d6e",
  });
  const setField = (key: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  // 販売形態を選ぶと関連項目をまとめてセットする（読むだけで設定が終わる）。
  const applySalesType = (selected: string[]) => {
    setSalesType(selected);
    const v = selected[0];
    if (v === "ind_physical" || v === "corp_physical") {
      setBusinessType([v === "corp_physical" ? "CORPORATION" : "INDIVIDUAL"]);
      setSellsDigital(false);
      setSellsSubscription(false);
      setReturnPolicy(["STANDARD"]);
      setField("deliveryTiming")(DELIVERY_PRESETS[0].value);
    } else if (v === "digital") {
      setSellsDigital(true);
      setSellsSubscription(false);
      setReturnPolicy(["NO_RETURN"]);
      setField("deliveryTiming")(DELIVERY_PRESETS[3].value); // 即時利用
    } else if (v === "subscription") {
      setSellsSubscription(true);
      setReturnPolicy(["STANDARD"]);
    }
  };

  // Shopify ストア設定から連絡先を取り込む（いつでも再取込可能）。
  const importFromShopify = () => {
    if (!prefill) return;
    // 取り込めた件数（Shopify 側に値があった項目）
    const importKeys: (keyof typeof prefill)[] = [
      "sellerName", "postalCode", "prefecture", "address",
      "buildingName", "phone", "email", "websiteUrl",
    ];
    const count = importKeys.filter((k) => prefill[k]).length;
    // 取込後も空のままの必須項目を洗い出す
    const requiredLabels: [keyof typeof fields, string][] = [
      ["sellerName", "販売業者名"],
      ["address", "所在地"],
      ["phone", "電話番号"],
      ["email", "メールアドレス"],
    ];
    const missing = requiredLabels
      .filter(([k]) => !(prefill[k as keyof typeof prefill] || fields[k]))
      .map(([, label]) => label);

    setFields((prev) => ({
      ...prev,
      sellerName: prefill.sellerName || prev.sellerName,
      postalCode: prefill.postalCode || prev.postalCode,
      prefecture: prefill.prefecture || prev.prefecture,
      address: prefill.address || prev.address,
      buildingName: prefill.buildingName || prev.buildingName,
      phone: prefill.phone || prev.phone,
      email: prefill.email || prev.email,
      websiteUrl: prefill.websiteUrl || prev.websiteUrl,
    }));
    setImportInfo({ count, missing });
  };

  // リアルタイムの表示チェック（特商法で求められる項目の抜け漏れを入力中に警告する）。
  const liveWarnings: string[] = [];
  if (!fields.sellerName.trim()) liveWarnings.push("販売業者名が未入力です（必須）");
  if (!fields.address.trim()) liveWarnings.push("所在地が未入力です（必須）");
  if (!fields.phone.trim()) liveWarnings.push("電話番号が未入力です（必須）");
  if (!fields.email.trim()) liveWarnings.push("メールアドレスが未入力です（必須）");
  if (businessType[0] === "CORPORATION" && !fields.representativeName.trim())
    liveWarnings.push("法人の場合は代表者名の記載が必要です");
  if (paymentMethods.length === 0)
    liveWarnings.push("お支払い方法を1つ以上選択してください");
  if (sellsDigital && !fields.softwareRequirements.trim())
    liveWarnings.push("デジタル商品の動作環境（対応OS・ブラウザ等）が未入力です");
  if (sellsSubscription && !fields.subscriptionTerms.trim())
    liveWarnings.push("継続課金の解約方法・契約期間・課金サイクルの記載が必要です");
  if (returnPolicy[0] === "NO_RETURN" && !fields.returnNote.trim())
    liveWarnings.push("返品不可の場合は、その旨と理由を明記することが推奨されます");

  // 推測した販売形態のうち、まだ反映されていないものだけ提案する。
  const suggestDigital = detected.digital && !sellsDigital;
  const suggestSubscription = detected.subscription && !sellsSubscription;

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
        {bilingual && <input type="hidden" name="bilingual" value="on" />}
        {lawAlertEmail && <input type="hidden" name="lawAlertEmail" value="on" />}

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

          {/* 0. クイック設定 */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  かんたん設定
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  販売形態を選ぶと、関連する項目を自動でセットし、不要な欄を省きます。
                  あとは内容を確認するだけで完成します。
                </Text>
                <ChoiceList
                  title="販売形態（任意）"
                  titleHidden
                  choices={SALES_TYPES}
                  selected={salesType}
                  onChange={applySalesType}
                />
                {(suggestDigital || suggestSubscription) && (
                  <Banner tone="info">
                    <BlockStack gap="200">
                      {suggestDigital && (
                        <InlineStack align="space-between" blockAlign="center" gap="300">
                          <Text as="p" variant="bodyMd">
                            🔍 ストアにデジタル商品（配送不要）が見つかりました。
                          </Text>
                          <Button onClick={() => applySalesType(["digital"])}>
                            デジタル商品に設定
                          </Button>
                        </InlineStack>
                      )}
                      {suggestSubscription && (
                        <InlineStack align="space-between" blockAlign="center" gap="300">
                          <Text as="p" variant="bodyMd">
                            🔍 サブスク（定期購入）の設定が見つかりました。
                          </Text>
                          <Button onClick={() => applySalesType(["subscription"])}>
                            サブスクに設定
                          </Button>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Banner>
                )}
                {prefill && (
                  <Box
                    background="bg-surface-secondary"
                    padding="300"
                    borderRadius="200"
                  >
                    <InlineStack align="space-between" blockAlign="center" gap="300">
                      <Text as="p" variant="bodyMd">
                        🏪 Shopifyストアの設定から事業者名・住所・電話・メールを自動入力できます。
                      </Text>
                      <Button onClick={importFromShopify}>Shopify設定から取込む</Button>
                    </InlineStack>
                  </Box>
                )}
                {importInfo && (
                  <Banner
                    tone={importInfo.missing.length ? "warning" : "success"}
                  >
                    <p>
                      Shopify設定から{importInfo.count}件を取り込みました。
                      {importInfo.missing.length
                        ? `未入力の必須項目：${importInfo.missing.join("、")} をご確認のうえ入力してください。`
                        : "内容に誤りがないかご確認ください。"}
                    </p>
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

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
                    placeholder="例：株式会社サンプル / サンプルショップ"
                    helpText="登記上の法人名または屋号を入力してください"
                  />

                  {businessType[0] === "CORPORATION" && (
                    <TextField
                      label="代表者名（法人の場合必須）"
                      name="representativeName"
                      value={fields.representativeName}
                      onChange={setField("representativeName")}
                      autoComplete="name"
                      placeholder="例：山田 太郎"
                    />
                  )}

                  <TextField
                    label="通信販売責任者名"
                    name="responsibleName"
                    value={fields.responsibleName}
                    onChange={setField("responsibleName")}
                    autoComplete="name"
                    placeholder="例：山田 太郎"
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
                      placeholder="例：150-0001"
                    />
                    <TextField
                      label="都道府県"
                      name="prefecture"
                      value={fields.prefecture}
                      onChange={setField("prefecture")}
                      autoComplete="address-level1"
                      placeholder="例：東京都"
                    />
                  </FormLayout.Group>

                  <TextField
                    label="住所（市区町村・番地） *"
                    name="address"
                    value={fields.address}
                    onChange={setField("address")}
                    autoComplete="street-address"
                    placeholder="例：渋谷区渋谷1-1-1"
                  />

                  <TextField
                    label="建物名・部屋番号"
                    name="buildingName"
                    value={fields.buildingName}
                    onChange={setField("buildingName")}
                    autoComplete="address-line2"
                    placeholder="例：○○ビル 101号"
                  />

                  <TextField
                    label="電話番号 *"
                    name="phone"
                    value={fields.phone}
                    onChange={setField("phone")}
                    autoComplete="tel"
                    type="tel"
                    placeholder="例：03-1234-5678"
                    helpText="お客様からのお問い合わせ用の電話番号"
                  />

                  <TextField
                    label="メールアドレス *"
                    name="email"
                    value={fields.email}
                    onChange={setField("email")}
                    autoComplete="email"
                    type="email"
                    placeholder="例：info@example.com"
                  />

                  <TextField
                    label="ウェブサイトURL"
                    name="websiteUrl"
                    value={fields.websiteUrl}
                    onChange={setField("websiteUrl")}
                    autoComplete="url"
                    placeholder="例：https://example.com"
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

                  {!sellsDigital && (
                    <TextField
                      label="送料"
                      name="shippingFee"
                      value={fields.shippingFee}
                      onChange={setField("shippingFee")}
                      autoComplete="off"
                      helpText="例：全国一律500円（税込）、5,000円以上購入で送料無料"
                      multiline={2}
                    />
                  )}

                  <TextField
                    label="商品代金・送料以外に発生する費用"
                    name="otherCosts"
                    value={fields.otherCosts}
                    onChange={setField("otherCosts")}
                    autoComplete="off"
                    placeholder="例：コンビニ払い手数料 220円、代引手数料 330円"
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

                  <PresetField
                    label="お支払い時期"
                    name="paymentTiming"
                    value={fields.paymentTiming}
                    onChange={setField("paymentTiming")}
                    presets={PAYMENT_TIMING_PRESETS}
                  />

                  <PresetField
                    label="商品の引渡し時期"
                    name="deliveryTiming"
                    value={fields.deliveryTiming}
                    onChange={setField("deliveryTiming")}
                    presets={DELIVERY_PRESETS}
                  />

                  <TextField
                    label="申込みの有効期限"
                    name="applicationPeriod"
                    value={fields.applicationPeriod}
                    onChange={setField("applicationPeriod")}
                    autoComplete="off"
                    multiline={2}
                    placeholder="例：予約商品（発送は2026年7月予定）／数量限定・なくなり次第終了"
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

                      <PresetField
                        label="返品・交換条件"
                        name="returnCondition"
                        value={fields.returnCondition}
                        onChange={setField("returnCondition")}
                        presets={RETURN_CONDITION_PRESETS}
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
                    placeholder="例：セール品・カスタムオーダー品は返品をお受けできません"
                    helpText="セール品・カスタム品の返品不可など"
                  />

                  <PresetField
                    label="契約不適合責任"
                    name="contractLiability"
                    value={fields.contractLiability}
                    onChange={setField("contractLiability")}
                    presets={CONTRACT_LIABILITY_PRESETS}
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
                    <>
                      <TextField
                        label="ソフトウェア動作環境 *"
                        name="softwareRequirements"
                        value={fields.softwareRequirements}
                        onChange={setField("softwareRequirements")}
                        autoComplete="off"
                        multiline={2}
                        placeholder="例：対応OS Windows 10以降 / ブラウザ Chrome・Safari 最新版"
                        helpText="対応OS・ブラウザ・必要スペック等。デジタル商品販売時は必須です"
                      />
                      <Banner tone="info">
                        <p>
                          デジタル商品（ダウンロード・オンライン提供）について：通信販売にクーリング・オフ制度は
                          適用されません。また、ダウンロード・利用開始後の返品はお受けできないとするのが一般的です。
                          その場合は<strong>返品不可である旨と理由を明記</strong>してください
                          （返品の可否・条件は法定の必須表示項目です）。
                          送料の欄は非表示にしています。最終的な表記は必要に応じて専門家にご確認ください。
                        </p>
                      </Banner>
                    </>
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
                      placeholder="例：毎月1日に課金。解約はマイページからいつでも可能（最低利用期間なし）"
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
                    placeholder="例：会員限定販売、数量限定（先着50名）"
                    helpText="数量限定・会員限定など特別な条件がある場合"
                  />

                  <TextField
                    label="お問い合わせに関する注意"
                    name="contactNote"
                    value={fields.contactNote}
                    onChange={setField("contactNote")}
                    autoComplete="off"
                    multiline={2}
                    placeholder="例：受付時間 平日10:00〜17:00（土日祝を除く）"
                    helpText="対応時間・対応言語など"
                  />
                  <Checkbox
                    label="法令アップデートのメール通知を受け取る（Proプラン）"
                    checked={lawAlertEmail}
                    onChange={setLawAlertEmail}
                    helpText="特商法等のテンプレート更新があった際、登録メールにお知らせします。アプリ内のお知らせは全プランで表示されます。"
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
                  ※ デザインのカスタマイズは Pro プランで公開ページに反映されます（Freeプランは標準デザイン）。
                </Text>
                <FormLayout>
                  <ColorField
                    value={fields.accentColor}
                    onChange={setField("accentColor")}
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
                  <Checkbox
                    label="日英併記（項目名に英語を併記）"
                    checked={bilingual}
                    onChange={setBilingual}
                    helpText="海外のお客様向けに項目名を英語でも表示します"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* 表示チェック（リアルタイム） */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  表示チェック
                </Text>
                {liveWarnings.length === 0 ? (
                  <Text as="p" tone="success">
                    ✅ 特商法で求められる必須項目はすべて入力されています。
                  </Text>
                ) : (
                  <BlockStack gap="100">
                    {liveWarnings.map((w, i) => (
                      <Text as="p" key={i} tone="caution" variant="bodyMd">
                        ⚠️ {w}
                      </Text>
                    ))}
                  </BlockStack>
                )}
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
