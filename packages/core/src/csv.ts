import type { Resume } from '@cv/schema';
import { formatYearMonthIso, outputGender } from './format';
import { toE164 } from './phone';
import { createZip } from './zip';

/*
 * CSVは3つのファイルに分ける（人事システムなどで機械的に取り込めるように）。
 *   resume.csv    1行 = 1人
 *   education.csv 1行 = 1校（入学と卒業・修了を1行に）
 *   work.csv      1行 = 1社（入社と退職を1行に）
 * 3つのファイルは、各ファイルの先頭列の「応募者ID」で紐づける。
 * 日付は ISO 8601（YYYY-MM-DD、年月だけなら YYYY-MM）、電話番号は E.164（+81...）にそろえる。
 */

const BOM = '﻿';
const ROW_SEPARATOR = '\r\n';

export const RESUME_CSV_HEADERS = [
  '応募者ID',
  '履歴書の日付',
  '姓',
  '名',
  'ミドルネーム',
  '姓カナ',
  '名カナ',
  'ミドルネームカナ',
  '生年月日',
  '性別',
  '郵便番号',
  '都道府県',
  '市区町村',
  '町名番地',
  '建物名',
  '電話番号',
  'メールアドレス',
  '資格・免許',
  '志望動機',
  '自己PR',
  '本人希望',
] as const;

export const EDUCATION_CSV_HEADERS = ['応募者ID', '学校名', '学部学科', '学位・課程', '入学', '卒業・修了', '区分', '備考'] as const;

/** 業種・雇用形態・退職理由は入力項目がないため、列だけ用意して空欄にする */
export const WORK_CSV_HEADERS = ['応募者ID', '会社名', '業種', '雇用形態', '部署', '役職・職種', '入社', '退職', '業務内容', '退職理由'] as const;

/** CSVのファイル名（ZIPの中のファイル名） */
export const CSV_FILE_NAMES = { resume: 'resume.csv', education: 'education.csv', work: 'work.csv' } as const;

/** 資格・免許の区切り（名称の中のセミコロンは全角にして、区切りと区別する） */
const QUALIFICATION_SEPARATOR = ';';

/** Excel などで数式として解釈される先頭文字（CSV Injection 対策の対象） */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** E.164 形式の電話番号。数字と先頭の + だけで、関数や外部参照を書けないため ' を付けない */
const SAFE_PHONE = /^\+[0-9]+$/;

/**
 * 1セル分の値をCSV用に変換する。
 * - 数式として解釈される文字で始まる値は、先頭に ' を付けて文字列として扱わせる
 *   （allowLeadingPlus のときは、E.164 形式の電話番号だけはそのまま出力する）
 * - セル内の改行は LF にそろえる（Excel のセル内改行）
 * - カンマ・ダブルクォート・改行を含む値はダブルクォートで囲む
 */
export function escapeCsvCell(value: string, options: { allowLeadingPlus?: boolean } = {}): string {
  const plusAllowed = options.allowLeadingPlus === true && SAFE_PHONE.test(value);
  let v = FORMULA_PREFIX.test(value) && !plusAllowed ? `'${value}` : value;
  v = v.replace(/\r\n?/g, '\n');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsvText(headers: readonly string[], rows: string[][], phoneColumn = -1): string {
  const lines = [Array.from(headers), ...rows].map((row) =>
    row.map((cell, i) => escapeCsvCell(cell, { allowLeadingPlus: i === phoneColumn })).join(','),
  );
  return BOM + lines.join(ROW_SEPARATOR) + ROW_SEPARATOR;
}

/** resume.csv の1行（ヘッダー順） */
export function toResumeRow(resume: Resume): string[] {
  const { personal: p } = resume;
  return [
    resume.id,
    resume.createdAt,
    p.familyName.trim(),
    p.givenName.trim(),
    p.middleName.trim(),
    p.familyNameKana.trim(),
    p.givenNameKana.trim(),
    p.middleNameKana.trim(),
    p.birthDate,
    outputGender(resume),
    p.postalCode,
    p.address.prefecture,
    p.address.city.trim(),
    p.address.street.trim(),
    p.address.building.trim(),
    toE164(p.phone),
    p.email.trim(),
    resume.qualifications
      .map((q) => q.name.trim().replaceAll(QUALIFICATION_SEPARATOR, '；'))
      .filter((name) => name !== '')
      .join(QUALIFICATION_SEPARATOR),
    resume.motivation,
    resume.selfIntroduction,
    resume.preferences,
  ];
}

/** education.csv の行（中身が空の件は出力しない） */
export function toEducationRows(resume: Resume): string[][] {
  return resume.education
    .map((e) => [
      resume.id,
      e.school.trim(),
      e.department.trim(),
      e.degree.trim(),
      formatYearMonthIso(e.start),
      formatYearMonthIso(e.end),
      e.status,
      e.note.trim(),
    ])
    .filter((row) => row.slice(1).some((cell) => cell !== ''));
}

/** work.csv の行（中身が空の件は出力しない）。退職が空なら在職中 */
export function toWorkRows(resume: Resume): string[][] {
  return resume.employment
    .map((e) => [
      resume.id,
      e.company.trim(),
      '',
      '',
      e.department.trim(),
      e.position.trim(),
      formatYearMonthIso(e.start),
      formatYearMonthIso(e.end),
      e.note.trim(),
      '',
    ])
    .filter((row) => row.slice(1).some((cell) => cell !== ''));
}

export interface CsvFile {
  name: string;
  /** BOM付きの文字列（UTF-8 で保存する） */
  content: string;
}

/** 履歴書（1人または複数人）を3つのCSVにする */
export function toCsvFiles(resumes: Resume | Resume[]): CsvFile[] {
  const list = [resumes].flat();
  return [
    { name: CSV_FILE_NAMES.resume, content: toCsvText(RESUME_CSV_HEADERS, list.map(toResumeRow), RESUME_CSV_HEADERS.indexOf('電話番号')) },
    { name: CSV_FILE_NAMES.education, content: toCsvText(EDUCATION_CSV_HEADERS, list.flatMap(toEducationRows)) },
    { name: CSV_FILE_NAMES.work, content: toCsvText(WORK_CSV_HEADERS, list.flatMap(toWorkRows)) },
  ];
}

/** 3つのCSVを1つのZIPにまとめる */
export function toCsvZip(resumes: Resume | Resume[], now = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  return createZip(
    toCsvFiles(resumes).map((f) => ({ name: f.name, data: encoder.encode(f.content) })),
    now,
  );
}
