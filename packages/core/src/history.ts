import type { EducationEntry, EducationStatus, EmploymentEntry, YearMonthValue } from '@cv/schema';

/*
 * 学歴・職歴は「1件 = 1校・1社」で持つ（入学と卒業、入社と退職を1件に持つ）。
 * 履歴書（PDF・確認画面）では、一般的な様式に合わせて「1行 = 1つの出来事」に並べ直す。
 *   例: { 工学院大学, 2000/04〜2004/03, 卒業 } → 「2000年4月 工学院大学 入学」「2004年3月 工学院大学 卒業」
 */

/** 履歴書の1行（年月と本文） */
export interface HistoryLine {
  year: number | null;
  month: number | null;
  text: string;
}

function joinWords(words: string[]): string {
  return words.map((w) => w.trim()).filter((w) => w !== '').join(' ');
}

function withNote(text: string, note: string): string {
  const n = note.trim();
  return n === '' ? text : `${text}（${n}）`;
}

function hasDate(ym: YearMonthValue): boolean {
  return ym.year !== null || ym.month !== null;
}

/** 区分ごとの、終わりの行の書き方 */
const EDUCATION_END_TEXT: Record<EducationStatus, string> = {
  卒業: '卒業',
  修了: '修了',
  中退: '中途退学',
  卒業見込: '卒業見込み',
  在学中: '在学中',
};

/** 学歴1件を履歴書の行にする。何も入力されていなければ空 */
export function educationLines(e: EducationEntry): HistoryLine[] {
  const name = joinWords([e.school, e.department, e.degree]);
  const lines: HistoryLine[] = [];
  if (hasDate(e.start)) lines.push({ ...e.start, text: withNote(joinWords([name, '入学']), e.note) });
  if (hasDate(e.end) || e.status !== '') {
    const text = joinWords([name, e.status === '' ? '' : EDUCATION_END_TEXT[e.status]]);
    lines.push({ ...e.end, text: lines.length === 0 ? withNote(text, e.note) : text });
  }
  if (lines.length === 0 && (name !== '' || e.note.trim() !== '')) lines.push({ year: null, month: null, text: withNote(name, e.note) });
  return lines;
}

/** 職歴1件を履歴書の行にする。何も入力されていなければ空 */
export function employmentLines(e: EmploymentEntry): HistoryLine[] {
  const name = joinWords([e.company, e.department, e.position]);
  const lines: HistoryLine[] = [];
  if (hasDate(e.start)) lines.push({ ...e.start, text: withNote(joinWords([name, '入社']), e.note) });
  if (hasDate(e.end)) {
    const text = joinWords([e.company, '退職']);
    lines.push({ ...e.end, text: lines.length === 0 ? withNote(text, e.note) : text });
  }
  if (lines.length === 0 && (name !== '' || e.note.trim() !== '')) lines.push({ year: null, month: null, text: withNote(name, e.note) });
  return lines;
}

function isFilledEmployment(e: EmploymentEntry): boolean {
  return hasDate(e.start) || hasDate(e.end) || joinWords([e.company, e.department, e.position, e.note]) !== '';
}

/**
 * 職歴の最後の1件が、入社の年月があり退職の年月がなければ在職中とみなす（履歴書では「現在に至る」と書く）。
 * 中身が空の件は無視する。
 */
export function isCurrentlyEmployed(employment: EmploymentEntry[]): boolean {
  const last = employment.filter(isFilledEmployment).at(-1);
  return last !== undefined && last.start.year !== null && !hasDate(last.end);
}

export const CURRENTLY_EMPLOYED_TEXT = '現在に至る';
