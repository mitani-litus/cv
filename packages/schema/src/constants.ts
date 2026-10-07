/**
 * 履歴書JSONのバージョン。形式を変えたときに上げる。
 * 2.0: 氏名を姓・名に分け、学歴・職歴を「1件 = 1校・1社」（入学と卒業、入社と退職を1件に持つ）にした。
 * 以前のバージョンのJSONは migrate.ts で変換して読み込む。
 */
export const RESUME_VERSION = '2.0';

/**
 * PDFの様式の既定値。
 * - photoBox: 写真をはる欄（空欄）を設ける。写真そのものは扱わない
 * - genderField: 性別欄を設ける（記載は任意）
 */
export const DEFAULT_LAYOUT = { photoBox: true, genderField: false } as const;

/** 文字数・件数の上限。APIでも同じ値でチェックする。 */
export const LIMITS = {
  familyName: 50,
  givenName: 50,
  middleName: 50,
  familyNameKana: 50,
  givenNameKana: 50,
  middleNameKana: 50,
  city: 50,
  street: 100,
  building: 100,
  email: 254,
  phone: 20,
  entryText: 100,
  degree: 50,
  note: 200,
  motivation: 400,
  selfIntroduction: 400,
  preferences: 200,
  entries: 30,
  yearMin: 1900,
  yearMax: 2100,
} as const;

/** 学歴の区分（その学校をどう終えたか） */
export const EDUCATION_STATUSES = ['卒業', '修了', '中退', '在学中', '卒業見込'] as const;

/** 性別の選択肢（記載は任意。空欄も可） */
export const GENDERS = ['男性', '女性', 'その他', '回答しない'] as const;

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
