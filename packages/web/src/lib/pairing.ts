import {
  createEmptyEducation,
  createEmptyEmployment,
  LIMITS,
  type EducationEntry,
  type EmploymentEntry,
} from '@cv/schema';

const EDUCATION_ENDS: readonly string[] = ['卒業', '中途退学', '修了'];

/**
 * 学歴の区分を変える。「入学」にしたとき、すぐ下に同じ学校の終わりの行（卒業・中途退学・修了）が
 * なければ「卒業」の行を追加する（学校名・学部は写す。年月は空）。
 */
export function setEducationCategory(items: EducationEntry[], index: number, category: EducationEntry['category']): EducationEntry[] {
  const item = items[index];
  if (!item) return items;
  const next = items.map((e, i) => (i === index ? { ...e, category } : e));
  if (category !== '入学' || items.length >= LIMITS.entries) return next;
  const following = items[index + 1];
  if (following && EDUCATION_ENDS.includes(following.category) && following.school === item.school) return next;
  const pair: EducationEntry = { ...createEmptyEducation(), category: '卒業', school: item.school, department: item.department };
  return [...next.slice(0, index + 1), pair, ...next.slice(index + 1)];
}

/**
 * 学歴の学校名・学部を変える。「入学」の行を変えたときは、すぐ下の対になる行（同じ内容だったもの）も合わせて変える。
 */
export function setEducationText(items: EducationEntry[], index: number, patch: Partial<Pick<EducationEntry, 'school' | 'department'>>): EducationEntry[] {
  const item = items[index];
  if (!item) return items;
  return items.map((e, i) => {
    if (i === index) return { ...e, ...patch };
    if (i === index + 1 && item.category === '入学' && EDUCATION_ENDS.includes(e.category)) {
      const synced: Partial<EducationEntry> = {};
      if (patch.school !== undefined && e.school === item.school) synced.school = patch.school;
      if (patch.department !== undefined && e.department === item.department) synced.department = patch.department;
      return { ...e, ...synced };
    }
    return e;
  });
}

/**
 * 職歴の区分を変える。「入社」にしたとき、すぐ下に同じ会社の「退職」の行がなければ追加する（会社名を写す）。
 * 在職中なら、利用者が退職の行を削除する（履歴書には「現在に至る」と記載される）。
 */
export function setEmploymentCategory(items: EmploymentEntry[], index: number, category: EmploymentEntry['category']): EmploymentEntry[] {
  const item = items[index];
  if (!item) return items;
  const next = items.map((e, i) => (i === index ? { ...e, category } : e));
  if (category !== '入社' || items.length >= LIMITS.entries) return next;
  const following = items[index + 1];
  if (following && following.category === '退職' && following.company === item.company) return next;
  const pair: EmploymentEntry = { ...createEmptyEmployment(), category: '退職', company: item.company };
  return [...next.slice(0, index + 1), pair, ...next.slice(index + 1)];
}

/** 職歴の会社名を変える。「入社」の行を変えたときは、すぐ下の「退職」の行（同じ会社名だったもの）も合わせて変える */
export function setEmploymentCompany(items: EmploymentEntry[], index: number, company: string): EmploymentEntry[] {
  const item = items[index];
  if (!item) return items;
  return items.map((e, i) => {
    if (i === index) return { ...e, company };
    if (i === index + 1 && item.category === '入社' && e.category === '退職' && e.company === item.company) return { ...e, company };
    return e;
  });
}
