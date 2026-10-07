import { describe, expect, it } from 'vitest';
import {
  createEmptyEducation,
  createEmptyEmployment,
  createEmptyQualification,
  createEmptyResume,
  type Resume,
} from '@cv/schema';
import {
  calcAge,
  CSV_HEADERS,
  escapeCsvCell,
  formatAddress,
  formatDateJa,
  formatYearMonth,
  formatYearMonthJa,
  isCurrentlyEmployed,
  toCsv,
  toCsvRow,
  toHalfWidthDigits,
} from './index';

function sampleResume(): Resume {
  const r = createEmptyResume('2026-10-07');
  r.personal = {
    name: '山田 太郎',
    nameKana: 'ヤマダ タロウ',
    birthDate: '1985-04-01',
    postalCode: '100-0001',
    address: { prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: '○○ビル101' },
    phone: '090-1234-5678',
    email: 'taro@example.jp',
  };
  r.education = [
    { ...createEmptyEducation(), year: 2001, month: 4, category: '入学', school: '○○高等学校', department: '普通科' },
    { ...createEmptyEducation(), year: 2004, month: 3, category: '卒業', school: '○○高等学校', department: '普通科' },
  ];
  r.employment = [
    {
      ...createEmptyEmployment(),
      year: 2008,
      month: 4,
      category: '入社',
      company: '株式会社○○',
      department: '営業部',
      position: '主任',
      note: '法人営業を担当',
    },
  ];
  r.qualifications = [{ ...createEmptyQualification(), year: 2004, month: 8, name: '普通自動車第一種運転免許 取得' }];
  r.motivation = '1行目\r\n2行目';
  r.preferences = '貴社の規定に従います。';
  return r;
}

/** BOM と末尾の改行を除き、RFC 4180 に沿って行・セルに分解する（テスト用） */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = csv.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && s[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += c;
  }
  return rows;
}

describe('calcAge', () => {
  it.each([
    ['1985-04-01', '2026-10-07', 41],
    ['1985-10-07', '2026-10-07', 41],
    ['1985-10-08', '2026-10-07', 40],
    ['2026-10-07', '2026-10-07', 0],
    ['2000-02-29', '2025-02-28', 24],
    ['2000-02-29', '2025-03-01', 25],
    ['2000-02-29', '2024-02-29', 24],
  ])('%s 生まれは %s に %i 歳', (birth, on, age) => {
    expect(calcAge(birth, on)).toBe(age);
  });

  it.each([
    ['', '2026-10-07'],
    ['1985-02-30', '2026-10-07'],
    ['2027-01-01', '2026-10-07'],
  ])('計算できない場合は null（%s, %s）', (birth, on) => {
    expect(calcAge(birth, on)).toBeNull();
  });
});

describe('整形', () => {
  it('年月', () => {
    expect(formatYearMonth(2015, 4)).toBe('2015/04');
    expect(formatYearMonth(2015, null)).toBe('2015');
    expect(formatYearMonth(null, null)).toBe('');
    expect(formatYearMonthJa(2015, 4)).toBe('2015年4月');
    expect(formatYearMonthJa(2015, null)).toBe('2015年');
  });

  it('日付', () => {
    expect(formatDateJa('1985-04-01')).toBe('1985年4月1日');
    expect(formatDateJa('')).toBe('');
  });

  it('住所', () => {
    expect(formatAddress({ prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: '' })).toBe(
      '東京都千代田区千代田1-1',
    );
    expect(formatAddress({ prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: 'A棟' })).toBe(
      '東京都千代田区千代田1-1　A棟',
    );
  });

  it('全角の数字とハイフンを半角にする', () => {
    expect(toHalfWidthDigits('０９０－１２３４ー５６７８')).toBe('090-1234-5678');
    expect(toHalfWidthDigits('〒１００−０００１')).toBe('〒100-0001');
    expect(toHalfWidthDigits('＋８１（３）')).toBe('+81(3)');
  });
});

describe('escapeCsvCell', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+81-90-1234-5678', "'+81-90-1234-5678"],
    ['+SUM(1,2)', `"'+SUM(1,2)"`],
    ['-2', "'-2"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tcmd', "'\tcmd"],
    ['=HYPERLINK("http://example.com","x")', `"'=HYPERLINK(""http://example.com"",""x"")"`],
  ])('数式として解釈される値 %j を無害化する', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it('CR で始まる値も無害化し、セル内改行として囲む', () => {
    expect(escapeCsvCell('\r=1')).toBe(`"'\n=1"`);
  });

  it.each([
    ['山田 太郎', '山田 太郎'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['1行目\r\n2行目', '"1行目\n2行目"'],
    ['1行目\r2行目', '"1行目\n2行目"'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });
});

describe('toCsv', () => {
  it('BOM付き・CRLF区切りで、ヘッダー行と1応募者1行を出力する', () => {
    const csv = toCsv(sampleResume());
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(CSV_HEADERS);
  });

  it('各列の値', () => {
    const row = parseCsv(toCsv(sampleResume()))[1]!;
    const byHeader = Object.fromEntries(CSV_HEADERS.map((h, i) => [h, row[i]]));
    expect(byHeader).toEqual({
      履歴書の日付: '2026-10-07',
      氏名: '山田 太郎',
      氏名フリガナ: 'ヤマダ タロウ',
      生年月日: '1985-04-01',
      年齢: '41',
      郵便番号: '100-0001',
      住所: '東京都千代田区千代田1-1　○○ビル101',
      電話番号: '090-1234-5678',
      メールアドレス: 'taro@example.jp',
      学歴: '2001/04 ○○高等学校 普通科 入学\n2004/03 ○○高等学校 普通科 卒業',
      職歴: '2008/04 株式会社○○ 営業部 主任 入社（法人営業を担当）',
      '資格・免許': '2004/08 普通自動車第一種運転免許 取得',
      志望動機: '1行目\n2行目',
      自己PR: '',
      本人希望: '貴社の規定に従います。',
    });
  });

  it('件数が多くても1列にすべて入る（切り捨てない）', () => {
    const r = sampleResume();
    r.education = Array.from({ length: 30 }, (_, i) => ({
      ...createEmptyEducation(),
      year: 1990 + i,
      school: `学校${i + 1}`,
    }));
    const row = toCsvRow(r);
    expect(row[CSV_HEADERS.indexOf('学歴')]!.split('\n')).toHaveLength(30);
  });

  it('空の行は出力しない', () => {
    const r = sampleResume();
    r.qualifications = [createEmptyQualification(), ...r.qualifications, createEmptyQualification()];
    expect(toCsvRow(r)[CSV_HEADERS.indexOf('資格・免許')]).toBe('2004/08 普通自動車第一種運転免許 取得');
  });

  it('生年月日がなければ年齢は空', () => {
    const r = sampleResume();
    r.personal.birthDate = '';
    expect(toCsvRow(r)[CSV_HEADERS.indexOf('年齢')]).toBe('');
  });

  it('どの列の数式も無害化される', () => {
    const r = sampleResume();
    r.personal.name = '=cmd|"/c calc"!A1';
    r.motivation = '+SUM(1,2)';
    r.education[0]!.school = '=1+1';
    const row = parseCsv(toCsv(r))[1]!;
    expect(row[CSV_HEADERS.indexOf('氏名')]).toBe(`'=cmd|"/c calc"!A1`);
    expect(row[CSV_HEADERS.indexOf('志望動機')]).toBe("'+SUM(1,2)");
    // 学歴は年月で始まるため数式にならない
    expect(row[CSV_HEADERS.indexOf('学歴')]!.startsWith('2001/04 =1+1')).toBe(true);
  });

  it('電話番号の列では + で始まる国際形式をそのまま出力する', () => {
    const r = sampleResume();
    r.personal.phone = '+81-90-1234-5678';
    const row = parseCsv(toCsv(r))[1]!;
    expect(row[CSV_HEADERS.indexOf('電話番号')]).toBe('+81-90-1234-5678');
  });

  it('電話番号の列でも、電話番号の形でない値は無害化する', () => {
    expect(escapeCsvCell('+81(3)1234-5678', { allowLeadingPlus: true })).toBe('+81(3)1234-5678');
    expect(escapeCsvCell('+SUM(1,2)', { allowLeadingPlus: true })).toBe(`"'+SUM(1,2)"`);
    expect(escapeCsvCell('=1+1', { allowLeadingPlus: true })).toBe("'=1+1");
    expect(escapeCsvCell('-1', { allowLeadingPlus: true })).toBe("'-1");
  });

  it('電話番号以外の列では + で始まる値を無害化する', () => {
    const r = sampleResume();
    r.personal.postalCode = '+81';
    r.preferences = '+81-90-1234-5678';
    const row = parseCsv(toCsv(r))[1]!;
    expect(row[CSV_HEADERS.indexOf('郵便番号')]).toBe("'+81");
    expect(row[CSV_HEADERS.indexOf('本人希望')]).toBe("'+81-90-1234-5678");
  });

  it('複数の履歴書を1ファイルにできる', () => {
    expect(parseCsv(toCsv([sampleResume(), sampleResume()]))).toHaveLength(3);
  });
});

describe('isCurrentlyEmployed', () => {
  const job = (category: '入社' | '退職' | '', company = '株式会社○○') => ({ ...createEmptyEmployment(), year: 2008, category, company });

  it('最後の行が入社なら在職中', () => {
    expect(isCurrentlyEmployed([job('入社')])).toBe(true);
    expect(isCurrentlyEmployed([job('入社'), job('退職'), job('入社', '株式会社△△')])).toBe(true);
  });

  it('最後の行が退職、または職歴がなければ在職中ではない', () => {
    expect(isCurrentlyEmployed([job('入社'), job('退職')])).toBe(false);
    expect(isCurrentlyEmployed([])).toBe(false);
  });

  it('空の行は無視する', () => {
    expect(isCurrentlyEmployed([job('入社'), createEmptyEmployment()])).toBe(true);
  });
});
