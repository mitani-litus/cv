import type { EducationEntry, EmploymentEntry, QualificationEntry, Resume } from '@cv/schema';

/** 年月を "2015/04" の形にする。年がなければ空文字、月がなければ "2015" */
export function formatYearMonth(year: number | null, month: number | null): string {
  if (year === null) return '';
  return month === null ? String(year) : `${year}/${String(month).padStart(2, '0')}`;
}

/** 年月を "2015年4月" の形にする（画面・PDF用） */
export function formatYearMonthJa(year: number | null, month: number | null): string {
  if (year === null) return '';
  return month === null ? `${year}年` : `${year}年${month}月`;
}

/** "YYYY-MM-DD" を "1985年4月1日" の形にする。空文字はそのまま */
export function formatDateJa(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

/** 出力する性別。性別欄を設けない様式では、入力があっても出力しない */
export function outputGender(resume: Pick<Resume, 'layout' | 'personal'>): string {
  return resume.layout.genderField ? resume.personal.gender.trim() : '';
}

/** 住所を1行にまとめる（建物名の前だけ全角スペースで区切る） */
export function formatAddress(address: Resume['personal']['address']): string {
  const main = `${address.prefecture}${address.city}${address.street}`;
  return address.building === '' ? main : `${main}　${address.building}`;
}

function joinWords(words: string[]): string {
  return words.map((w) => w.trim()).filter((w) => w !== '').join(' ');
}

function withNote(text: string, note: string): string {
  const n = note.trim();
  return n === '' ? text : `${text}（${n}）`;
}

/** 学歴1件の本文（年月を除く）。例: "○○高等学校 普通科 卒業" */
export function describeEducation(e: EducationEntry): string {
  return withNote(joinWords([e.school, e.department, e.category]), e.note);
}

/** 職歴1件の本文（年月を除く）。例: "株式会社○○ 営業部 主任 入社" */
export function describeEmployment(e: EmploymentEntry): string {
  return withNote(joinWords([e.company, e.department, e.position, e.category]), e.note);
}

/** 資格・免許1件の本文（年月を除く） */
export function describeQualification(q: QualificationEntry): string {
  return withNote(joinWords([q.name]), q.note);
}

/** 年月と本文をつないだ1行。例: "2015/04 ○○高等学校 入学"。年月も本文もなければ空文字 */
export function entryLine(year: number | null, month: number | null, text: string): string {
  return joinWords([formatYearMonth(year, month), text]);
}
