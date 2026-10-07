import { DEFAULT_LAYOUT, GENDERS, RESUME_VERSION } from './constants';
import { newApplicantId } from './empty';

/*
 * 以前の形式（version 1.0）の履歴書JSONを、今の形式（2.0）に変換する。
 * 以前に保存したJSONや、以前に作成したPDFに添付されたJSONを読み込めるようにするため。
 *
 * 1.0 からの主な変更
 * - 氏名（name, nameKana）を姓・名に分ける（最初の空白で区切る。空白がなければすべて姓にする）
 * - 学歴・職歴を「1行 = 1つの出来事（入学、卒業など）」から「1件 = 1校・1社」にする
 *   （「入学」とすぐ後の同じ学校の「卒業」などを1件にまとめる。対にならない行はそのまま1件にする）
 * - 性別を選択式にする（選択肢に当てはまらない値は空欄にする）
 * - 応募者ID（id）を新しく作る
 *
 * 形の合わない値は変換せずにそのまま残し、入力チェック（validateResume）でエラーにする。
 */

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function yearMonthOf(e: Obj) {
  return { year: e.year ?? null, month: e.month ?? null };
}

const EMPTY_YEAR_MONTH = { year: null, month: null };

/** "山田 太郎" → ["山田", "太郎"]（全角・半角の空白で区切る） */
function splitName(v: unknown): [string, string] {
  const s = str(v).trim();
  const m = /^(\S+?)[\s　]+(.+)$/u.exec(s);
  return m ? [m[1]!, m[2]!.trim()] : [s, ''];
}

const GENDER_ALIASES: Record<string, (typeof GENDERS)[number]> = { 男: '男性', 女: '女性' };

function migrateGender(v: unknown): string {
  const s = str(v).trim();
  if ((GENDERS as readonly string[]).includes(s)) return s;
  return GENDER_ALIASES[s] ?? '';
}

const EDUCATION_END: Record<string, string> = { 卒業: '卒業', 修了: '修了', 中途退学: '中退' };

function migrateEducation(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  const out: Obj[] = [];
  let open: Obj | null = null;
  for (const row of rows) {
    if (!isObj(row)) return rows;
    const base = { school: row.school, department: row.department, degree: '', note: row.note };
    const status = EDUCATION_END[str(row.category)];
    if (row.category === '入学') {
      open = { ...base, start: yearMonthOf(row), end: EMPTY_YEAR_MONTH, status: '' };
      out.push(open);
    } else if (status !== undefined && open !== null && open.school === row.school) {
      open.end = yearMonthOf(row);
      open.status = status;
      if (str(open.note) === '') open.note = row.note;
      open = null;
    } else if (status !== undefined) {
      out.push({ ...base, start: EMPTY_YEAR_MONTH, end: yearMonthOf(row), status });
      open = null;
    } else {
      // 「その他」など：年月を始まりに置いて、そのまま1件にする
      out.push({ ...base, start: yearMonthOf(row), end: EMPTY_YEAR_MONTH, status: '' });
      open = null;
    }
  }
  return out;
}

function migrateEmployment(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows;
  const out: Obj[] = [];
  let open: Obj | null = null;
  for (const row of rows) {
    if (!isObj(row)) return rows;
    const base = { company: row.company, department: row.department, position: row.position, note: row.note };
    if (row.category === '入社') {
      open = { ...base, start: yearMonthOf(row), end: EMPTY_YEAR_MONTH };
      out.push(open);
    } else if (row.category === '退職' && open !== null && open.company === row.company) {
      open.end = yearMonthOf(row);
      if (str(open.note) === '') open.note = row.note;
      open = null;
    } else if (row.category === '退職') {
      out.push({ ...base, start: EMPTY_YEAR_MONTH, end: yearMonthOf(row) });
      open = null;
    } else {
      out.push({ ...base, start: yearMonthOf(row), end: EMPTY_YEAR_MONTH });
      open = null;
    }
  }
  return out;
}

/** 以前の形式なら今の形式に変換する。それ以外（今の形式、想定外の値）はそのまま返す */
export function migrateResume(input: unknown): unknown {
  if (!isObj(input) || input.version !== '1.0') return input;
  const { name, nameKana, ...personal } = isObj(input.personal) ? input.personal : ({} as Obj);
  const [familyName, givenName] = splitName(name);
  const [familyNameKana, givenNameKana] = splitName(nameKana);
  return {
    ...input,
    version: RESUME_VERSION,
    id: newApplicantId(),
    layout: input.layout ?? { ...DEFAULT_LAYOUT },
    personal: {
      ...personal,
      familyName,
      givenName,
      familyNameKana,
      givenNameKana,
      gender: migrateGender(personal.gender),
    },
    education: migrateEducation(input.education),
    employment: migrateEmployment(input.employment),
  };
}
