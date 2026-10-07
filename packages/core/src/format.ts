import type { QualificationEntry, Resume, YearMonthValue } from '@cv/schema';

/** 年月を ISO 8601 の形（"2015-04"）にする。年がなければ空文字、月がなければ "2015"（CSV用） */
export function formatYearMonthIso(ym: Pick<YearMonthValue, 'year' | 'month'>): string {
  if (ym.year === null) return '';
  return ym.month === null ? String(ym.year) : `${ym.year}-${String(ym.month).padStart(2, '0')}`;
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

type Personal = Resume['personal'];

/**
 * 氏名を「姓 名 ミドルネーム」の順（在留カードと同じ順）に空白でつなぐ。
 * 例: "山田 太郎"、"SMITH JOHN MICHAEL"。空の項目は省く
 */
export function formatName(p: Pick<Personal, 'familyName' | 'givenName' | 'middleName'>): string {
  return joinWords([p.familyName, p.givenName, p.middleName]);
}

/** フリガナを氏名と同じ順につなぐ。例: "スミス ジョン マイケル" */
export function formatNameKana(p: Pick<Personal, 'familyNameKana' | 'givenNameKana' | 'middleNameKana'>): string {
  return joinWords([p.familyNameKana, p.givenNameKana, p.middleNameKana]);
}

/** 出力する性別。性別欄を設けない様式では、入力があっても出力しない */
export function outputGender(resume: Pick<Resume, 'layout' | 'personal'>): string {
  return resume.layout.genderField ? resume.personal.gender : '';
}

/** 住所を1行にまとめる（建物名の前だけ全角スペースで区切る）（画面・PDF用） */
export function formatAddress(address: Resume['personal']['address']): string {
  const main = `${address.prefecture}${address.city}${address.street}`;
  return address.building === '' ? main : `${main}　${address.building}`;
}

function joinWords(words: string[]): string {
  return words.map((w) => w.trim()).filter((w) => w !== '').join(' ');
}

/** 資格・免許1件の本文（年月を除く） */
export function describeQualification(q: QualificationEntry): string {
  const name = q.name.trim();
  const note = q.note.trim();
  return note === '' ? name : `${name}（${note}）`;
}
