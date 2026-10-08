// ======================================================
// SEEKER PRIVACY
//
// Shared privacy rules for every response that may be
// exposed to a Job Seeker.
//
// Admin / Staff / Provider internal APIs can continue
// using the original database values.
// ======================================================

// ======================================================
// EMPLOYER LABEL
// ======================================================

const SEEKER_EMPLOYER_LABEL = "Vision Career Partner Company";

// ======================================================
// JAPAN PREFECTURES
// ======================================================

const JAPAN_PREFECTURES = [
  { en: "Hokkaido", ja: "北海道", short: "北海道" },
  { en: "Aomori", ja: "青森県", short: "青森" },
  { en: "Iwate", ja: "岩手県", short: "岩手" },
  { en: "Miyagi", ja: "宮城県", short: "宮城" },
  { en: "Akita", ja: "秋田県", short: "秋田" },
  { en: "Yamagata", ja: "山形県", short: "山形" },
  { en: "Fukushima", ja: "福島県", short: "福島" },
  { en: "Ibaraki", ja: "茨城県", short: "茨城" },
  { en: "Tochigi", ja: "栃木県", short: "栃木" },
  { en: "Gunma", ja: "群馬県", short: "群馬" },
  { en: "Saitama", ja: "埼玉県", short: "埼玉" },
  { en: "Chiba", ja: "千葉県", short: "千葉" },
  { en: "Tokyo", ja: "東京都", short: "東京" },
  { en: "Kanagawa", ja: "神奈川県", short: "神奈川" },
  { en: "Niigata", ja: "新潟県", short: "新潟" },
  { en: "Toyama", ja: "富山県", short: "富山" },
  { en: "Ishikawa", ja: "石川県", short: "石川" },
  { en: "Fukui", ja: "福井県", short: "福井" },
  { en: "Yamanashi", ja: "山梨県", short: "山梨" },
  { en: "Nagano", ja: "長野県", short: "長野" },
  { en: "Gifu", ja: "岐阜県", short: "岐阜" },
  { en: "Shizuoka", ja: "静岡県", short: "静岡" },
  { en: "Aichi", ja: "愛知県", short: "愛知" },
  { en: "Mie", ja: "三重県", short: "三重" },
  { en: "Shiga", ja: "滋賀県", short: "滋賀" },
  { en: "Kyoto", ja: "京都府", short: "京都" },
  { en: "Osaka", ja: "大阪府", short: "大阪" },
  { en: "Hyogo", ja: "兵庫県", short: "兵庫" },
  { en: "Nara", ja: "奈良県", short: "奈良" },
  { en: "Wakayama", ja: "和歌山県", short: "和歌山" },
  { en: "Tottori", ja: "鳥取県", short: "鳥取" },
  { en: "Shimane", ja: "島根県", short: "島根" },
  { en: "Okayama", ja: "岡山県", short: "岡山" },
  { en: "Hiroshima", ja: "広島県", short: "広島" },
  { en: "Yamaguchi", ja: "山口県", short: "山口" },
  { en: "Tokushima", ja: "徳島県", short: "徳島" },
  { en: "Kagawa", ja: "香川県", short: "香川" },
  { en: "Ehime", ja: "愛媛県", short: "愛媛" },
  { en: "Kochi", ja: "高知県", short: "高知" },
  { en: "Fukuoka", ja: "福岡県", short: "福岡" },
  { en: "Saga", ja: "佐賀県", short: "佐賀" },
  { en: "Nagasaki", ja: "長崎県", short: "長崎" },
  { en: "Kumamoto", ja: "熊本県", short: "熊本" },
  { en: "Oita", ja: "大分県", short: "大分" },
  { en: "Miyazaki", ja: "宮崎県", short: "宮崎" },
  { en: "Kagoshima", ja: "鹿児島県", short: "鹿児島" },
  { en: "Okinawa", ja: "沖縄県", short: "沖縄" },
];

// ======================================================
// HELPERS
// ======================================================

const containsJapanese = (value) => {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(value);
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const matchesEnglishPrefecture = (input, prefecture) => {
  const escaped = escapeRegex(prefecture);

  const regex = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");

  return regex.test(input);
};

// ======================================================
// SEEKER-VISIBLE WORK LOCATION
//
// Example:
//
// 東京都新宿区西新宿2-8-1
// -> 東京都
//
// 2-10-1 Yokohama, Kanagawa
// -> Kanagawa
//
// If no safe prefecture can be determined:
//
// -> Japan / 日本
//
// NEVER return an unknown original address.
// ======================================================

const toSeekerVisibleWorkLocation = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const japanese = containsJapanese(raw);

  for (const prefecture of JAPAN_PREFECTURES) {
    if (raw.includes(prefecture.ja) || raw.includes(prefecture.short)) {
      return japanese ? prefecture.ja : prefecture.en;
    }

    if (matchesEnglishPrefecture(raw, prefecture.en)) {
      return japanese ? prefecture.ja : prefecture.en;
    }
  }

  const remoteEnglish = /\b(remote|fully remote|work from home|wfh)\b/i.test(
    raw,
  );

  const remoteJapanese = /リモート|在宅勤務|在宅ワーク|在宅/.test(raw);

  if (remoteEnglish || remoteJapanese) {
    return japanese ? "日本（リモート）" : "Japan (Remote)";
  }

  return japanese ? "日本" : "Japan";
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  SEEKER_EMPLOYER_LABEL,
  toSeekerVisibleWorkLocation,
};
