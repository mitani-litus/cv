/** 履歴書JSONのバージョン。形式を変えたときに上げる。 */
export const RESUME_VERSION = '1.0';

/** 文字数・件数の上限。APIでも同じ値でチェックする。 */
export const LIMITS = {
  name: 50,
  nameKana: 100,
  city: 50,
  street: 100,
  building: 100,
  email: 254,
  phone: 20,
  entryText: 100,
  note: 200,
  motivation: 400,
  selfIntroduction: 400,
  preferences: 200,
  entries: 30,
  yearMin: 1900,
  yearMax: 2100,
} as const;

export const EDUCATION_CATEGORIES = ['入学', '卒業', '中途退学', '修了', 'その他'] as const;
export const EMPLOYMENT_CATEGORIES = ['入社', '退職', 'その他'] as const;

export const PREFECTURES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
  '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;
