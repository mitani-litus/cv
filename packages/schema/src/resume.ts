import { z } from 'zod';
import {
  EDUCATION_CATEGORIES,
  EMPLOYMENT_CATEGORIES,
  LIMITS,
  PREFECTURES,
  RESUME_VERSION,
} from './constants';

// エラー文には入力値を含めない（APIのエラーレスポンスやログに個人情報が載らないようにするため）。

/** 改行・タブを含む制御文字（1行入力では使えない） */
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001f\u007f]/;
/** 改行以外の制御文字（複数行入力では改行だけ許可） */
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** カタカナ・長音・中黒・半角／全角スペース */
const KATAKANA = /^[゠-ヿ　 ]+$/;
const POSTAL_CODE = /^\d{3}-?\d{4}$/;
const PHONE_CHARS = /^\+?[0-9() -]+$/;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function line(max: number) {
  return z
    .string()
    .max(max, { error: `${max}文字以内で入力してください。` })
    .refine((v) => !SINGLE_LINE_FORBIDDEN.test(v), { error: '改行や制御文字は使えません。' });
}

function multiline(max: number) {
  return z
    .string()
    .max(max, { error: `${max}文字以内で入力してください。` })
    .refine((v) => !MULTI_LINE_FORBIDDEN.test(v), { error: '使えない文字が含まれています。' });
}

function required(schema: z.ZodString, message: string) {
  return schema.refine((v) => v.trim().length > 0, { error: message });
}

const year = z
  .int({ error: '年は数字で入力してください。' })
  .min(LIMITS.yearMin, { error: `年は${LIMITS.yearMin}〜${LIMITS.yearMax}の西暦で入力してください。` })
  .max(LIMITS.yearMax, { error: `年は${LIMITS.yearMin}〜${LIMITS.yearMax}の西暦で入力してください。` })
  .nullable();

const month = z
  .int({ error: '月は数字で入力してください。' })
  .min(1, { error: '月は1〜12で入力してください。' })
  .max(12, { error: '月は1〜12で入力してください。' })
  .nullable();

/** 月だけが入力されている行を拒否する */
function requireYearWithMonth<T extends { year: number | null; month: number | null }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.month !== null && value.year === null) {
    ctx.addIssue({ code: 'custom', path: ['year'], message: '月を入力した場合は、年も入力してください。' });
  }
}

const educationEntry = z
  .strictObject({
    year,
    month,
    category: z.union([z.enum(EDUCATION_CATEGORIES), z.literal('')], {
      error: '区分を選択肢から選んでください。',
    }),
    school: line(LIMITS.entryText),
    department: line(LIMITS.entryText),
    note: line(LIMITS.note),
  })
  .superRefine(requireYearWithMonth);

const employmentEntry = z
  .strictObject({
    year,
    month,
    category: z.union([z.enum(EMPLOYMENT_CATEGORIES), z.literal('')], {
      error: '区分を選択肢から選んでください。',
    }),
    company: line(LIMITS.entryText),
    department: line(LIMITS.entryText),
    position: line(LIMITS.entryText),
    note: line(LIMITS.note),
  })
  .superRefine(requireYearWithMonth);

const qualificationEntry = z
  .strictObject({
    year,
    month,
    name: line(LIMITS.entryText),
    note: line(LIMITS.note),
  })
  .superRefine(requireYearWithMonth);

const personal = z.strictObject({
  name: required(line(LIMITS.name), '氏名を入力してください。'),
  nameKana: required(line(LIMITS.nameKana), 'フリガナを入力してください。').refine(
    (v) => v.trim() === '' || KATAKANA.test(v),
    { error: 'フリガナはカタカナで入力してください（例：ヤマダ タロウ）。' },
  ),
  birthDate: z.string().refine((v) => v === '' || isValidIsoDate(v), {
    error: '生年月日は正しい日付で入力してください。',
  }),
  postalCode: z.string().refine((v) => v === '' || POSTAL_CODE.test(v), {
    error: '郵便番号は7桁の数字で入力してください（例：100-0001）。',
  }),
  address: z.strictObject({
    prefecture: z.union([z.enum(PREFECTURES), z.literal('')], {
      error: '都道府県を選択肢から選んでください。',
    }),
    city: line(LIMITS.city),
    street: line(LIMITS.street),
    building: line(LIMITS.building),
  }),
  phone: required(line(LIMITS.phone), '電話番号を入力してください。').refine(
    (v) => {
      if (v.trim() === '') return true;
      const digits = v.replace(/\D/g, '').length;
      return PHONE_CHARS.test(v) && digits >= 10 && digits <= 15;
    },
    { error: '電話番号は数字とハイフンで入力してください（例：090-1234-5678）。' },
  ),
  email: required(line(LIMITS.email), 'メールアドレスを入力してください。').refine(
    (v) => v.trim() === '' || EMAIL.test(v),
    { error: 'メールアドレスの形式が正しくありません。@ の後ろを確認してください（例：taro@example.jp）。' },
  ),
});

function entries<T extends z.ZodType>(entry: T, label: string) {
  return z.array(entry).max(LIMITS.entries, { error: `${label}は${LIMITS.entries}件まで入力できます。` });
}

export const resumeSchema = z
  .strictObject({
    version: z.literal(RESUME_VERSION, { error: `対応していない形式です（version は ${RESUME_VERSION}）。` }),
    createdAt: z.string().refine(isValidIsoDate, { error: '履歴書の日付は正しい日付で入力してください。' }),
    personal,
    education: entries(educationEntry, '学歴'),
    employment: entries(employmentEntry, '職歴'),
    qualifications: entries(qualificationEntry, '資格・免許'),
    motivation: multiline(LIMITS.motivation),
    selfIntroduction: multiline(LIMITS.selfIntroduction),
    preferences: multiline(LIMITS.preferences),
  })
  .superRefine((value, ctx) => {
    const { birthDate } = value.personal;
    if (birthDate !== '' && isValidIsoDate(birthDate) && isValidIsoDate(value.createdAt) && birthDate > value.createdAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['personal', 'birthDate'],
        message: '生年月日が履歴書の日付より後になっています。',
      });
    }
  });

export type Resume = z.infer<typeof resumeSchema>;
export type EducationEntry = Resume['education'][number];
export type EmploymentEntry = Resume['employment'][number];
export type QualificationEntry = Resume['qualifications'][number];
export type EducationCategory = (typeof EDUCATION_CATEGORIES)[number];
export type EmploymentCategory = (typeof EMPLOYMENT_CATEGORIES)[number];
export type Prefecture = (typeof PREFECTURES)[number];
