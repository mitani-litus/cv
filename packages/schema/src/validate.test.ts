import { describe, expect, it } from 'vitest';
import {
  createEmptyEducation,
  createEmptyEmployment,
  createEmptyQualification,
  createEmptyResume,
  isValidIsoDate,
  LIMITS,
  type Resume,
  validateResume,
} from './index';

function validResume(): Resume {
  const r = createEmptyResume('2026-10-07');
  r.personal = {
    familyName: '山田',
    givenName: '太郎',
    familyNameKana: 'ヤマダ',
    givenNameKana: 'タロウ',
    middleName: '',
    middleNameKana: '',
    birthDate: '1985-04-01',
    gender: '',
    postalCode: '100-0001',
    address: { prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: '' },
    phone: '090-1234-5678',
    email: 'taro@example.jp',
  };
  r.education = [
    { ...createEmptyEducation(), school: '○○高等学校', start: { year: 2001, month: 4 }, end: { year: 2004, month: 3 }, status: '卒業' },
  ];
  r.employment = [{ ...createEmptyEmployment(), company: '株式会社○○', department: '営業部', start: { year: 2008, month: 4 } }];
  r.qualifications = [{ ...createEmptyQualification(), year: 2004, month: 8, name: '普通自動車第一種運転免許 取得' }];
  r.motivation = '貴社の○○事業に関心があり、\n志望いたしました。';
  r.preferences = '貴社の規定に従います。';
  return r;
}

function errorPaths(input: unknown): string[] {
  const result = validateResume(input);
  return result.ok ? [] : result.errors.map((e) => e.path);
}

function messageFor(input: unknown, path: string): string | undefined {
  const result = validateResume(input);
  return result.ok ? undefined : result.errors.find((e) => e.path === path)?.message;
}

describe('validateResume', () => {
  it('正しい履歴書を受け付ける', () => {
    const result = validateResume(validResume());
    expect(result.ok).toBe(true);
  });

  it('必須項目以外が空でも受け付ける', () => {
    const r = createEmptyResume('2026-10-07');
    r.personal = { ...r.personal, familyName: '山田', givenName: '太郎', familyNameKana: 'ヤマダ', givenNameKana: 'タロウ' };
    r.personal.phone = '0312345678';
    r.personal.email = 'taro@example.jp';
    expect(validateResume(r).ok).toBe(true);
  });

  describe('必須チェック', () => {
    it('名・名のフリガナ・電話番号・メールアドレスが空ならエラー', () => {
      const r = createEmptyResume('2026-10-07');
      expect(errorPaths(r).sort()).toEqual(['personal.email', 'personal.givenName', 'personal.givenNameKana', 'personal.phone']);
      expect(messageFor(r, 'personal.givenName')).toBe('名を入力してください。');
      expect(messageFor(r, 'personal.givenNameKana')).toBe('名のフリガナを入力してください。');
    });

    it('空白だけの名はエラー', () => {
      const r = validResume();
      r.personal.givenName = '　 ';
      expect(errorPaths(r)).toContain('personal.givenName');
    });

    it('姓とミドルネームは任意。名だけでもよい', () => {
      const r = validResume();
      r.personal = { ...r.personal, familyName: '', familyNameKana: '', givenName: 'Sukarno', givenNameKana: 'スカルノ' };
      expect(validateResume(r).ok).toBe(true);
    });

    it('ミドルネームとそのフリガナを受け付け、フリガナはカタカナだけ', () => {
      const r = validResume();
      r.personal = { ...r.personal, middleName: 'MICHAEL', middleNameKana: 'マイケル・ジョー' };
      expect(validateResume(r).ok).toBe(true);
      r.personal.middleNameKana = 'まいける';
      expect(messageFor(r, 'personal.middleNameKana')).toBe('ミドルネームのフリガナはカタカナで入力してください。');
      r.personal.middleNameKana = '';
      r.personal.middleName = 'あ'.repeat(LIMITS.middleName + 1);
      expect(errorPaths(r)).toContain('personal.middleName');
    });

    it('ミドルネームがない、以前の 2.0 のJSONも受け付け、空にする', () => {
      const r = validResume() as unknown as { personal: Record<string, unknown> };
      delete r.personal.middleName;
      delete r.personal.middleNameKana;
      const result = validateResume(r);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.personal).toMatchObject({ middleName: '', middleNameKana: '' });
    });

    it('1項目につきエラーは1件だけ返す', () => {
      const r = validResume();
      r.personal.givenNameKana = '';
      const result = validateResume(r);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.filter((e) => e.path === 'personal.givenNameKana')).toHaveLength(1);
      }
    });
  });

  describe('形式チェック', () => {
    it.each(['taro', 'taro@example', 'taro@@example.jp', 'ta ro@example.jp', '@example.jp'])(
      'メールアドレス %s はエラー',
      (email) => {
        const r = validResume();
        r.personal.email = email;
        expect(errorPaths(r)).toContain('personal.email');
      },
    );

    it('フリガナはカタカナのみ', () => {
      const r = validResume();
      r.personal.familyNameKana = 'やまだ';
      expect(messageFor(r, 'personal.familyNameKana')).toContain('カタカナ');
      r.personal.familyNameKana = 'ヤマダ';
      expect(errorPaths(r)).not.toContain('personal.familyNameKana');
    });

    it.each(['100-0001', '1000001'])('郵便番号 %s を受け付ける', (postalCode) => {
      const r = validResume();
      r.personal.postalCode = postalCode;
      expect(validateResume(r).ok).toBe(true);
    });

    it.each(['100-001', '10000011', '１００-０００１', 'abc-defg'])('郵便番号 %s はエラー', (postalCode) => {
      const r = validResume();
      r.personal.postalCode = postalCode;
      expect(errorPaths(r)).toContain('personal.postalCode');
    });

    it.each(['090-1234-5678', '03-1234-5678', '0312345678', '+81-90-1234-5678'])(
      '電話番号 %s を受け付ける',
      (phone) => {
        const r = validResume();
        r.personal.phone = phone;
        expect(validateResume(r).ok).toBe(true);
      },
    );

    it.each(['090-1234', 'abc', '090-1234-5678 内線1'])('電話番号 %s はエラー', (phone) => {
      const r = validResume();
      r.personal.phone = phone;
      expect(errorPaths(r)).toContain('personal.phone');
    });

    it.each(['1985-02-30', '1985/04/01', '1985-4-1', 'yesterday'])('生年月日 %s はエラー', (birthDate) => {
      const r = validResume();
      r.personal.birthDate = birthDate;
      expect(errorPaths(r)).toContain('personal.birthDate');
    });

    it('生年月日が履歴書の日付より後ならエラー', () => {
      const r = validResume();
      r.personal.birthDate = '2026-10-08';
      expect(messageFor(r, 'personal.birthDate')).toBe('生年月日が履歴書の日付より後になっています。');
    });

    it('履歴書の日付が正しくなければエラー', () => {
      const r = validResume();
      r.createdAt = '2026-13-01';
      expect(errorPaths(r)).toContain('createdAt');
    });

    it('年月の範囲をチェックする', () => {
      const r = validResume();
      r.education[0] = { ...r.education[0]!, start: { year: 1899, month: 13 } };
      expect(errorPaths(r)).toEqual(expect.arrayContaining(['education.0.start.year', 'education.0.start.month']));
    });

    it('学歴・職歴の終わりの年月が始まりより前ならエラー', () => {
      const r = validResume();
      r.education[0] = { ...r.education[0]!, start: { year: 2004, month: 4 }, end: { year: 2004, month: 3 } };
      r.employment[0] = { ...r.employment[0]!, start: { year: 2010, month: null }, end: { year: 2009, month: 12 } };
      expect(messageFor(r, 'education.0.end.year')).toBe('卒業・修了の年月が、入学より前になっています。');
      expect(messageFor(r, 'employment.0.end.year')).toBe('退職の年月が、入社より前になっています。');
      // 同じ年月や、どちらかが空欄ならよい
      r.education[0] = { ...r.education[0]!, end: { year: 2004, month: 4 } };
      r.employment[0] = { ...r.employment[0]!, start: { year: null, month: null } };
      expect(validateResume(r).ok).toBe(true);
    });

    it('月だけ入力した行はエラー', () => {
      const r = validResume();
      r.qualifications[0] = { ...r.qualifications[0]!, year: null, month: 8 };
      expect(messageFor(r, 'qualifications.0.year')).toBe('月を入力した場合は、年も入力してください。');
    });

    it('年月は空欄でもよい', () => {
      const r = validResume();
      r.qualifications[0] = { ...r.qualifications[0]!, year: null, month: null };
      expect(validateResume(r).ok).toBe(true);
    });

    it.each([
      // [始まり, 終わり, エラーになるか]
      [[2004, 4], [2004, null], false],
      [[2004, null], [2004, 3], false],
      [[2004, null], [2004, null], false],
      [[2004, 4], [2004, 4], false],
      [[2004, 4], [2004, 3], true],
      [[2004, 4], [2003, null], true],
      [[2004, null], [2003, 12], true],
      [[null, null], [2003, 12], false],
    ] as const)('始まり %j・終わり %j → エラー %s（月が空なら同じ年の中では前後を決めない）', (start, end, isError) => {
      const r = validResume();
      r.employment[0] = { ...r.employment[0]!, start: { year: start[0], month: start[1] }, end: { year: end[0], month: end[1] } };
      r.education[0] = { ...r.education[0]!, start: { year: start[0], month: start[1] }, end: { year: end[0], month: end[1] } };
      const paths = errorPaths(r);
      expect(paths.includes('employment.0.end.year')).toBe(isError);
      expect(paths.includes('education.0.end.year')).toBe(isError);
    });

    it('学歴の区分は選択肢以外を拒否する', () => {
      const r = validResume() as unknown as { education: { status: string }[] };
      r.education[0]!.status = '入学';
      expect(errorPaths(r)).toContain('education.0.status');
    });

    it('職歴で退職の年月が空なら在職中として受け付ける', () => {
      const r = validResume();
      expect(r.employment[0]!.end).toEqual({ year: null, month: null });
      expect(validateResume(r).ok).toBe(true);
    });

    it.each(['男性', '女性', 'その他', '回答しない', ''])('性別 %s を受け付ける', (gender) => {
      const r = validResume() as unknown as { personal: { gender: string } };
      r.personal.gender = gender;
      expect(validateResume(r).ok).toBe(true);
    });

    it.each(['男', 'あ', 'male'])('性別 %s（選択肢以外）はエラー', (gender) => {
      const r = validResume() as unknown as { personal: { gender: string } };
      r.personal.gender = gender;
      expect(messageFor(r, 'personal.gender')).toBe('性別を選択肢から選んでください。');
    });

    it('応募者IDは UUID の形だけを受け付ける', () => {
      const r = validResume();
      r.id = 'A001';
      expect(errorPaths(r)).toContain('id');
    });

    it('都道府県は選択肢以外を拒否する', () => {
      const r = validResume() as unknown as { personal: { address: { prefecture: string } } };
      r.personal.address.prefecture = '東京';
      expect(errorPaths(r)).toContain('personal.address.prefecture');
    });
  });

  describe('上限', () => {
    it('文字数の上限を超えるとエラー', () => {
      const r = validResume();
      r.motivation = 'あ'.repeat(LIMITS.motivation + 1);
      expect(messageFor(r, 'motivation')).toBe(`${LIMITS.motivation}文字以内で入力してください。`);
      r.motivation = 'あ'.repeat(LIMITS.motivation);
      expect(validateResume(r).ok).toBe(true);
    });

    it('行数の上限を超えるとエラー', () => {
      const r = validResume();
      r.education = Array.from({ length: LIMITS.entries + 1 }, createEmptyEducation);
      expect(errorPaths(r)).toContain('education');
    });
  });

  describe('様式の選択と性別', () => {
    it('写真欄・性別欄の設定と性別を受け付ける', () => {
      const r = validResume();
      r.layout = { photoBox: false, genderField: true };
      r.personal.gender = '女性';
      expect(validateResume(r).ok).toBe(true);
    });

    it('様式の設定は真偽値だけを受け付け、想定外の項目を拒否する', () => {
      const r = validResume() as unknown as { layout: Record<string, unknown> };
      r.layout.photoBox = 'yes';
      expect(errorPaths(r)).toContain('layout.photoBox');
      const extra = validResume() as unknown as { layout: Record<string, unknown> };
      extra.layout.photo = 'data:image/png;base64,AAAA';
      expect(errorPaths(extra)).toContain('layout');
    });
  });

  describe('制御文字', () => {
    it('1行入力の改行を拒否する', () => {
      const r = validResume();
      r.personal.givenName = '太\n郎';
      expect(errorPaths(r)).toContain('personal.givenName');
    });

    it('複数行入力の改行は受け付け、それ以外の制御文字は拒否する', () => {
      const r = validResume();
      r.selfIntroduction = '1行目\r\n2行目';
      expect(validateResume(r).ok).toBe(true);
      r.selfIntroduction = '1行目\u0000';
      expect(errorPaths(r)).toContain('selfIntroduction');
    });
  });

  describe('想定外の入力', () => {
    it('想定外の項目（画像データなど）を拒否する', () => {
      const r = { ...validResume(), photo: 'data:image/png;base64,AAAA' };
      expect(errorPaths(r)).toContain('');
      const p = validResume() as unknown as { personal: Record<string, unknown> };
      p.personal.photo = 'data:image/png;base64,AAAA';
      expect(errorPaths(p)).toContain('personal');
    });

    it('型が違う値を拒否する', () => {
      const r = validResume() as unknown as { education: { start: { year: unknown } }[] };
      r.education[0]!.start.year = '2001';
      expect(errorPaths(r)).toContain('education.0.start.year');
    });

    it.each([null, undefined, 'string', 42, []])('オブジェクト以外（%s）を拒否する', (input) => {
      expect(validateResume(input).ok).toBe(false);
    });

    it('対応していない version を拒否する', () => {
      expect(errorPaths({ ...validResume(), version: '3.0' })).toContain('version');
    });
  });

  describe('エラー文に入力値を含めない', () => {
    it('どのエラーにも入力値が現れない', () => {
      const secret = 'SECRET-VALUE-12345';
      const r = {
        ...validResume(),
        version: secret,
        createdAt: secret,
        unknownKey: secret,
        personal: {
          ...validResume().personal,
          familyName: secret + '\n',
          givenNameKana: secret,
          gender: secret,
          birthDate: secret,
          postalCode: secret,
          phone: secret,
          email: secret,
          address: { prefecture: secret, city: 123, street: secret, building: secret },
        },
        education: [{ start: { year: secret, month: secret }, end: secret, status: secret, school: 1, department: secret, degree: secret, note: secret }],
      };
      const result = validateResume(r);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
    });
  });
});

describe('isValidIsoDate', () => {
  it.each([
    ['2024-02-29', true],
    ['2023-02-29', false],
    ['2026-10-07', true],
    ['2026-00-10', false],
    ['20261007', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidIsoDate(value)).toBe(expected);
  });
});

describe('createEmptyResume', () => {
  it('空の履歴書は必須項目のエラーだけになる', () => {
    expect(errorPaths(createEmptyResume('2026-10-07')).sort()).toEqual(
      ['personal.email', 'personal.givenName', 'personal.givenNameKana', 'personal.phone'].sort(),
    );
  });

  it('応募者IDは毎回ちがう UUID になる', () => {
    const a = createEmptyResume('2026-10-07').id;
    const b = createEmptyResume('2026-10-07').id;
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
