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
  crc32,
  createZip,
  EDUCATION_CSV_HEADERS,
  educationLines,
  employmentLines,
  escapeCsvCell,
  formatAddress,
  formatDateJa,
  formatName,
  formatNameKana,
  formatYearMonthIso,
  formatYearMonthJa,
  isCurrentlyEmployed,
  RESUME_CSV_HEADERS,
  toCsvFiles,
  toCsvZip,
  toE164,
  toHalfWidthDigits,
  toResumeRow,
  WORK_CSV_HEADERS,
} from './index';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

function sampleResume(): Resume {
  const r = createEmptyResume('2026-10-07', ID);
  r.personal = {
    familyName: '箕谷',
    givenName: '祐也',
    familyNameKana: 'ミタニ',
    givenNameKana: 'ユウヤ',
    middleName: '',
    middleNameKana: '',
    birthDate: '1981-10-03',
    gender: '',
    postalCode: '192-0361',
    address: { prefecture: '東京都', city: '八王子市', street: '越野32-23', building: '○○マンション 101' },
    phone: '03-4500-7765',
    email: 'mitani@example.jp',
  };
  r.education = [
    { ...createEmptyEducation(), school: '工学院大学', department: '工学部情報工学科', degree: '学士', start: { year: 2000, month: 4 }, end: { year: 2004, month: 3 }, status: '卒業' },
    { ...createEmptyEducation(), school: '工学院大学大学院', department: '電気電子工学専攻', degree: '修士', start: { year: 2004, month: 4 }, end: { year: 2006, month: 3 }, status: '修了' },
  ];
  r.employment = [
    { ...createEmptyEmployment(), company: 'アロカシステムエンジニアリング株式会社', position: 'システムエンジニア', start: { year: 2006, month: 4 }, end: { year: 2009, month: 6 } },
    { ...createEmptyEmployment(), company: '株式会社○○', department: '開発部', start: { year: 2009, month: 7 }, note: '設計を担当' },
  ];
  r.qualifications = [
    { ...createEmptyQualification(), year: 2004, month: 8, name: '普通自動車第一種運転免許' },
    { ...createEmptyQualification(), year: 2005, month: 1, name: '基本情報技術者', note: '合格' },
  ];
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
    expect(formatYearMonthIso({ year: 2015, month: 4 })).toBe('2015-04');
    expect(formatYearMonthIso({ year: 2015, month: null })).toBe('2015');
    expect(formatYearMonthIso({ year: null, month: null })).toBe('');
    expect(formatYearMonthJa(2015, 4)).toBe('2015年4月');
    expect(formatYearMonthJa(2015, null)).toBe('2015年');
  });

  it('日付・氏名', () => {
    expect(formatDateJa('1985-04-01')).toBe('1985年4月1日');
    expect(formatDateJa('')).toBe('');
    expect(formatName({ familyName: '箕谷', givenName: '祐也', middleName: '' })).toBe('箕谷 祐也');
    // 在留カードと同じ「姓 名 ミドルネーム」の順。空の項目は省く
    expect(formatName({ familyName: 'SMITH', givenName: 'JOHN', middleName: 'MICHAEL' })).toBe('SMITH JOHN MICHAEL');
    expect(formatName({ familyName: '', givenName: 'Sukarno', middleName: '' })).toBe('Sukarno');
    expect(formatNameKana({ familyNameKana: 'スミス', givenNameKana: 'ジョン', middleNameKana: 'マイケル' })).toBe('スミス ジョン マイケル');
  });

  it('住所（町名番地の後に建物名）', () => {
    expect(formatAddress({ prefecture: '東京都', city: '八王子市', street: '越野32-23', building: '' })).toBe('東京都八王子市越野32-23');
    expect(formatAddress({ prefecture: '東京都', city: '八王子市', street: '越野32-23', building: 'A棟' })).toBe('東京都八王子市越野32-23　A棟');
  });

  it('全角の数字とハイフンを半角にする', () => {
    expect(toHalfWidthDigits('０９０－１２３４ー５６７８')).toBe('090-1234-5678');
    expect(toHalfWidthDigits('〒１００−０００１')).toBe('〒100-0001');
    expect(toHalfWidthDigits('＋８１（３）')).toBe('+81(3)');
  });
});

describe('toE164', () => {
  it.each([
    ['03-4500-7765', '+81345007765'],
    ['0345007765', '+81345007765'],
    ['090-1234-5678', '+819012345678'],
    ['(03) 4500 7765', '+81345007765'],
    ['+81345007765', '+81345007765'],
    ['+81-3-4500-7765', '+81345007765'],
    ['+1 (555) 010-0000', '+15550100000'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });
});

describe('学歴・職歴を履歴書の行にする', () => {
  it('学歴は入学と卒業・修了の2行にする', () => {
    const [university, graduate] = sampleResume().education;
    expect(educationLines(university!)).toEqual([
      { year: 2000, month: 4, text: '工学院大学 工学部情報工学科 学士 入学' },
      { year: 2004, month: 3, text: '工学院大学 工学部情報工学科 学士 卒業' },
    ]);
    expect(educationLines(graduate!).map((l) => l.text)).toEqual(['工学院大学大学院 電気電子工学専攻 修士 入学', '工学院大学大学院 電気電子工学専攻 修士 修了']);
  });

  it('中退・卒業見込み・在学中', () => {
    const e = { ...createEmptyEducation(), school: '○○大学', start: { year: 2024, month: 4 } };
    expect(educationLines({ ...e, end: { year: 2025, month: 9 }, status: '中退' }).at(-1)?.text).toBe('○○大学 中途退学');
    expect(educationLines({ ...e, end: { year: 2028, month: 3 }, status: '卒業見込' }).at(-1)?.text).toBe('○○大学 卒業見込み');
    expect(educationLines({ ...e, status: '在学中' })).toEqual([
      { year: 2024, month: 4, text: '○○大学 入学' },
      { year: null, month: null, text: '○○大学 在学中' },
    ]);
  });

  it('職歴は入社と退職の2行にし、業務内容は入社の行に添える', () => {
    const [first, second] = sampleResume().employment;
    expect(employmentLines(first!)).toEqual([
      { year: 2006, month: 4, text: 'アロカシステムエンジニアリング株式会社 システムエンジニア 入社' },
      { year: 2009, month: 6, text: 'アロカシステムエンジニアリング株式会社 退職' },
    ]);
    expect(employmentLines(second!)).toEqual([{ year: 2009, month: 7, text: '株式会社○○ 開発部 入社（設計を担当）' }]);
  });

  it('何も入力されていない件は行にしない', () => {
    expect(educationLines(createEmptyEducation())).toEqual([]);
    expect(employmentLines(createEmptyEmployment())).toEqual([]);
  });
});

describe('isCurrentlyEmployed', () => {
  const job = (end: number | null) => ({ ...createEmptyEmployment(), company: '株式会社○○', start: { year: 2008, month: 4 }, end: { year: end, month: null } });

  it('最後の1件に入社があり退職がなければ在職中', () => {
    expect(isCurrentlyEmployed([job(2010), job(null)])).toBe(true);
    expect(isCurrentlyEmployed([job(null), createEmptyEmployment()])).toBe(true);
  });

  it('最後の1件が退職済み、または職歴がなければ在職中ではない', () => {
    expect(isCurrentlyEmployed([job(null), job(2010)])).toBe(false);
    expect(isCurrentlyEmployed([])).toBe(false);
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

describe('toCsvFiles', () => {
  function files(r: Resume | Resume[] = sampleResume()) {
    return Object.fromEntries(toCsvFiles(r).map((f) => [f.name, f.content]));
  }

  function table(csv: string) {
    const [headers, ...rows] = parseCsv(csv);
    return rows.map((row) => Object.fromEntries(headers!.map((h, i) => [h, row[i]])));
  }

  it('resume.csv・education.csv・work.csv の3つを、BOM付き・CRLF区切りで出力する', () => {
    const f = files();
    expect(Object.keys(f)).toEqual(['resume.csv', 'education.csv', 'work.csv']);
    for (const content of Object.values(f)) {
      expect(content.startsWith('\uFEFF')).toBe(true);
      expect(content.endsWith('\r\n')).toBe(true);
    }
    expect(parseCsv(f['resume.csv']!)[0]).toEqual(RESUME_CSV_HEADERS);
    expect(parseCsv(f['education.csv']!)[0]).toEqual(EDUCATION_CSV_HEADERS);
    expect(parseCsv(f['work.csv']!)[0]).toEqual(WORK_CSV_HEADERS);
  });

  it('resume.csv：1行 = 1人。氏名・住所は列を分け、年齢は出力しない', () => {
    expect(table(files()['resume.csv']!)).toEqual([
      {
        応募者ID: ID,
        履歴書の日付: '2026-10-07',
        姓: '箕谷',
        名: '祐也',
        ミドルネーム: '',
        姓カナ: 'ミタニ',
        名カナ: 'ユウヤ',
        ミドルネームカナ: '',
        生年月日: '1981-10-03',
        性別: '',
        郵便番号: '192-0361',
        都道府県: '東京都',
        市区町村: '八王子市',
        町名番地: '越野32-23',
        建物名: '○○マンション 101',
        電話番号: '+81345007765',
        メールアドレス: 'mitani@example.jp',
        '資格・免許': '普通自動車第一種運転免許;基本情報技術者',
        志望動機: '1行目\n2行目',
        自己PR: '',
        本人希望: '貴社の規定に従います。',
      },
    ]);
    expect(RESUME_CSV_HEADERS).not.toContain('年齢');
  });

  it('education.csv：1行 = 1校。入学と卒業・修了を1行に、年月は YYYY-MM', () => {
    expect(table(files()['education.csv']!)).toEqual([
      { 応募者ID: ID, 学校名: '工学院大学', 学部学科: '工学部情報工学科', '学位・課程': '学士', 入学: '2000-04', '卒業・修了': '2004-03', 区分: '卒業', 備考: '' },
      { 応募者ID: ID, 学校名: '工学院大学大学院', 学部学科: '電気電子工学専攻', '学位・課程': '修士', 入学: '2004-04', '卒業・修了': '2006-03', 区分: '修了', 備考: '' },
    ]);
  });

  it('work.csv：1行 = 1社。入社と退職を1行に、在職中は退職を空欄', () => {
    expect(table(files()['work.csv']!)).toEqual([
      { 応募者ID: ID, 会社名: 'アロカシステムエンジニアリング株式会社', 業種: '', 雇用形態: '', 部署: '', '役職・職種': 'システムエンジニア', 入社: '2006-04', 退職: '2009-06', 業務内容: '', 退職理由: '' },
      { 応募者ID: ID, 会社名: '株式会社○○', 業種: '', 雇用形態: '', 部署: '開発部', '役職・職種': '', 入社: '2009-07', 退職: '', 業務内容: '設計を担当', 退職理由: '' },
    ]);
  });

  it('学歴・職歴がなければ、ヘッダー行だけを出力する。空の件は出力しない', () => {
    const r = sampleResume();
    r.education = [createEmptyEducation()];
    r.employment = [];
    expect(parseCsv(files(r)['education.csv']!)).toHaveLength(1);
    expect(parseCsv(files(r)['work.csv']!)).toHaveLength(1);
  });

  it('ミドルネームは名の後、ミドルネームカナは名カナの後の列に出力する', () => {
    const r = sampleResume();
    r.personal = { ...r.personal, familyName: 'SMITH', givenName: 'JOHN', middleName: 'MICHAEL', familyNameKana: 'スミス', givenNameKana: 'ジョン', middleNameKana: 'マイケル' };
    const row = toResumeRow(r);
    expect(RESUME_CSV_HEADERS.slice(2, 8)).toEqual(['姓', '名', 'ミドルネーム', '姓カナ', '名カナ', 'ミドルネームカナ']);
    expect(row.slice(2, 8)).toEqual(['SMITH', 'JOHN', 'MICHAEL', 'スミス', 'ジョン', 'マイケル']);
  });

  it('性別は、性別欄を設けたときだけ出力する', () => {
    const r = sampleResume();
    r.personal.gender = '回答しない';
    expect(toResumeRow(r)[RESUME_CSV_HEADERS.indexOf('性別')]).toBe('');
    r.layout = { ...r.layout, genderField: true };
    expect(toResumeRow(r)[RESUME_CSV_HEADERS.indexOf('性別')]).toBe('回答しない');
  });

  it('資格・免許の名称の中のセミコロンは全角にする', () => {
    const r = sampleResume();
    r.qualifications = [{ ...createEmptyQualification(), name: 'A;B' }, createEmptyQualification(), { ...createEmptyQualification(), name: 'C' }];
    expect(toResumeRow(r)[RESUME_CSV_HEADERS.indexOf('資格・免許')]).toBe('A；B;C');
  });

  it('どのファイルの数式も無害化される。電話番号の E.164 はそのまま', () => {
    const r = sampleResume();
    r.personal.familyName = '=cmd|"/c calc"!A1';
    r.motivation = '+SUM(1,2)';
    r.education[0]!.school = '=1+1';
    r.employment[0]!.note = '@SUM(A1)';
    const f = files(r);
    expect(table(f['resume.csv']!)[0]).toMatchObject({ 姓: `'=cmd|"/c calc"!A1`, 志望動機: "'+SUM(1,2)", 電話番号: '+81345007765' });
    expect(table(f['education.csv']!)[0]!['学校名']).toBe("'=1+1");
    expect(table(f['work.csv']!)[0]!['業務内容']).toBe("'@SUM(A1)");
  });

  it('複数人分をまとめると、各ファイルの行が応募者IDで紐づく', () => {
    const other = sampleResume();
    other.id = '9b2f6e1a-3c4d-4e5f-8a7b-1c2d3e4f5a6b';
    other.employment = [];
    const f = files([sampleResume(), other]);
    expect(table(f['resume.csv']!).map((row) => row['応募者ID'])).toEqual([ID, other.id]);
    expect(table(f['education.csv']!).map((row) => row['応募者ID'])).toEqual([ID, ID, other.id, other.id]);
    expect(table(f['work.csv']!).map((row) => row['応募者ID'])).toEqual([ID, ID]);
  });
});

/** ZIP（格納方式）からファイルを取り出す（テスト用。セントラルディレクトリを読む） */
function unzip(zip: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const offset = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLength));
    const dataStart = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const data = zip.subarray(dataStart, dataStart + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    p += 46 + nameLength;
  }
  return files;
}

describe('ZIP', () => {
  it('crc32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('3つのCSVを1つのZIPにまとめる', () => {
    const files = unzip(toCsvZip(sampleResume(), new Date(2026, 9, 7, 12, 0, 0)));
    expect([...files.keys()]).toEqual(['resume.csv', 'education.csv', 'work.csv']);
    const expected = toCsvFiles(sampleResume());
    for (const f of expected) expect(new TextDecoder().decode(files.get(f.name))).toBe(f.content.replace(/^\uFEFF/, ''));
    // BOM も含めて保存されている
    expect([...files.get('resume.csv')!.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('日本語のファイル名も UTF-8 で記録する', () => {
    const files = unzip(createZip([{ name: '履歴書.csv', data: new Uint8Array([1, 2, 3]) }]));
    expect([...files.get('履歴書.csv')!]).toEqual([1, 2, 3]);
  });
});
