// Shopify の billingAddress.province は英語/ローマ字（例: "Tōkyō"）で返るため、
// 日本のお客様向けの特商法ページでは漢字（例: "東京都"）に変換する。
// provinceCode（ISO 3166-2:JP の番号）が最も確実なので優先し、無ければローマ字名から推定する。

// ISO 3166-2:JP 番号 → 漢字
const CODE_TO_KANJI: Record<string, string> = {
  "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県", "05": "秋田県",
  "06": "山形県", "07": "福島県", "08": "茨城県", "09": "栃木県", "10": "群馬県",
  "11": "埼玉県", "12": "千葉県", "13": "東京都", "14": "神奈川県", "15": "新潟県",
  "16": "富山県", "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
  "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県", "25": "滋賀県",
  "26": "京都府", "27": "大阪府", "28": "兵庫県", "29": "奈良県", "30": "和歌山県",
  "31": "鳥取県", "32": "島根県", "33": "岡山県", "34": "広島県", "35": "山口県",
  "36": "徳島県", "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
  "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県", "45": "宮崎県",
  "46": "鹿児島県", "47": "沖縄県",
};

// ローマ字（マクロン・空白を除去して小文字化したもの）→ 漢字
const ROMAJI_TO_KANJI: Record<string, string> = {
  hokkaido: "北海道", aomori: "青森県", iwate: "岩手県", miyagi: "宮城県",
  akita: "秋田県", yamagata: "山形県", fukushima: "福島県", ibaraki: "茨城県",
  tochigi: "栃木県", gunma: "群馬県", saitama: "埼玉県", chiba: "千葉県",
  tokyo: "東京都", kanagawa: "神奈川県", niigata: "新潟県", toyama: "富山県",
  ishikawa: "石川県", fukui: "福井県", yamanashi: "山梨県", nagano: "長野県",
  gifu: "岐阜県", shizuoka: "静岡県", aichi: "愛知県", mie: "三重県",
  shiga: "滋賀県", kyoto: "京都府", osaka: "大阪府", hyogo: "兵庫県",
  nara: "奈良県", wakayama: "和歌山県", tottori: "鳥取県", shimane: "島根県",
  okayama: "岡山県", hiroshima: "広島県", yamaguchi: "山口県", tokushima: "徳島県",
  kagawa: "香川県", ehime: "愛媛県", kochi: "高知県", fukuoka: "福岡県",
  saga: "佐賀県", nagasaki: "長崎県", kumamoto: "熊本県", oita: "大分県",
  miyazaki: "宮崎県", kagoshima: "鹿児島県", okinawa: "沖縄県",
};

/** ローマ字を正規化：マクロン除去・小文字化・英字以外を除去 */
function normalizeRomaji(s: string): string {
  return s
    .normalize("NFD") // マクロン等を分解
    .replace(/[̀-ͯ]/g, "") // 結合ダイアクリティカルマーク除去
    .replace(/ō/gi, "o")
    .replace(/ū/gi, "u")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * provinceCode（例 "JP-13" や "13"）またはローマ字名から漢字の都道府県名を返す。
 * 判定できない場合は元の name をそのまま返す（ユーザーが手で直せる）。
 */
export function toKanjiPrefecture(
  name: string | null | undefined,
  code: string | null | undefined
): string {
  if (code) {
    const digits = code.replace(/\D/g, "").padStart(2, "0");
    if (CODE_TO_KANJI[digits]) return CODE_TO_KANJI[digits];
  }
  if (name) {
    // すでに漢字（県/都/府/道 を含む）ならそのまま
    if (/[都道府県]/.test(name)) return name;
    const key = normalizeRomaji(name);
    if (ROMAJI_TO_KANJI[key]) return ROMAJI_TO_KANJI[key];
  }
  return name || "";
}
