import type { Resume } from '@cv/schema';
import { calcAge } from './age';
import {
  describeEducation,
  describeEmployment,
  describeQualification,
  entryLine,
  formatAddress,
} from './format';

const BOM = '﻿';
const ROW_SEPARATOR = '\r\n';

export const CSV_HEADERS = [
  '履歴書の日付',
  '氏名',
  '氏名フリガナ',
  '生年月日',
  '年齢',
  '郵便番号',
  '住所',
  '電話番号',
  'メールアドレス',
  '学歴',
  '職歴',
  '資格・免許',
  '志望動機',
  '自己PR',
  '本人希望',
] as const;

/** Excel などで数式として解釈される先頭文字（CSV Injection 対策の対象） */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * 1セル分の値をCSV用に変換する。
 * - 数式として解釈される文字で始まる値は、先頭に ' を付けて文字列として扱わせる
 * - セル内の改行は LF にそろえる（Excel のセル内改行）
 * - カンマ・ダブルクォート・改行を含む値はダブルクォートで囲む
 */
export function escapeCsvCell(value: string): string {
  let v = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  v = v.replace(/\r\n?/g, '\n');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function lines(items: string[]): string {
  return items.filter((s) => s !== '').join('\n');
}

/** 履歴書1件をCSVの1行分の値（ヘッダー順）に変換する */
export function toCsvRow(resume: Resume): string[] {
  const { personal } = resume;
  const age = calcAge(personal.birthDate, resume.createdAt);
  return [
    resume.createdAt,
    personal.name,
    personal.nameKana,
    personal.birthDate,
    age === null ? '' : String(age),
    personal.postalCode,
    formatAddress(personal.address),
    personal.phone,
    personal.email,
    lines(resume.education.map((e) => entryLine(e.year, e.month, describeEducation(e)))),
    lines(resume.employment.map((e) => entryLine(e.year, e.month, describeEmployment(e)))),
    lines(resume.qualifications.map((q) => entryLine(q.year, q.month, describeQualification(q)))),
    resume.motivation,
    resume.selfIntroduction,
    resume.preferences,
  ];
}

/**
 * 履歴書をCSVにする（BOM付きUTF-8で保存する前提の文字列）。
 * 1応募者 = 1行。学歴・職歴・資格・免許は1列にまとめ、1件ごとにセル内で改行する。
 */
export function toCsv(resumes: Resume | Resume[]): string {
  const rows = [Array.from(CSV_HEADERS), ...[resumes].flat().map(toCsvRow)];
  return BOM + rows.map((row) => row.map(escapeCsvCell).join(',')).join(ROW_SEPARATOR) + ROW_SEPARATOR;
}
