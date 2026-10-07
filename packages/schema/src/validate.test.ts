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
    name: '山田 太郎',
    nameKana: 'ヤマダ タロウ',
    birthDate: '1985-04-01',
    gender: '',
    postalCode: '100-0001',
    address: { prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: '' },
    phone: '090-1234-5678',
    email: 'taro@example.jp',
  };
  r.education = [
    { ...createEmptyEducation(), year: 2001, month: 4, category: '入学', school: '○○高等学校' },
    { ...createEmptyEducation(), year: 2004, month: 3, category: '卒業', school: '○○高等学校' },
  ];
  r.employment = [
    { ...createEmptyEmployment(), year: 2008, month: 4, category: '入社', company: '株式会社○○', department: '営業部' },
  ];
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
    r.personal.name = '山田 太郎';
    r.personal.nameKana = 'ヤマダ タロウ';
    r.personal.phone = '0312345678';
    r.personal.email = 'taro@example.jp';
    expect(validateResume(r).ok).toBe(true);
  });

  describe('必須チェック', () => {
    it('氏名・フリガナ・電話番号・メールアドレスが空ならエラー', () => {
      const r = createEmptyResume('2026-10-07');
      expect(errorPaths(r)).toEqual(
        expect.arrayContaining(['personal.name', 'personal.nameKana', 'personal.phone', 'personal.email']),
      );
      expect(messageFor(r, 'personal.name')).toBe('氏名を入力してください。');
    });

    it('空白だけの氏名はエラー', () => {
      const r = validResume();
      r.personal.name = '　 ';
      expect(errorPaths(r)).toContain('personal.name');
    });

    it('1項目につきエラーは1件だけ返す', () => {
      const r = validResume();
      r.personal.nameKana = '';
      const result = validateResume(r);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.filter((e) => e.path === 'personal.nameKana')).toHaveLength(1);
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
      r.personal.nameKana = 'やまだ たろう';
      expect(messageFor(r, 'personal.nameKana')).toContain('カタカナ');
      r.personal.nameKana = 'ヤマダ　タロウ';
      expect(errorPaths(r)).not.toContain('personal.nameKana');
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
      r.education[0] = { ...r.education[0]!, year: 1899, month: 13 };
      expect(errorPaths(r)).toEqual(expect.arrayContaining(['education.0.year', 'education.0.month']));
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

    it('区分は選択肢以外を拒否する', () => {
      const r = validResume() as unknown as { employment: { category: string }[] };
      r.employment[0]!.category = '入学';
      expect(errorPaths(r)).toContain('employment.0.category');
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
      r.personal.gender = '女';
      expect(validateResume(r).ok).toBe(true);
    });

    it('写真欄・性別欄の設定と性別がない、以前の形式も受け付け、既定値にする', () => {
      const r = validResume() as unknown as Record<string, unknown> & { personal: Record<string, unknown> };
      delete r.layout;
      delete r.personal.gender;
      const result = validateResume(r);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.layout).toEqual({ photoBox: true, genderField: false });
      expect(result.value.personal.gender).toBe('');
    });

    it('性別の文字数の上限と改行をチェックする', () => {
      const r = validResume();
      r.personal.gender = 'あ'.repeat(LIMITS.gender + 1);
      expect(errorPaths(r)).toContain('personal.gender');
      r.personal.gender = '女\n性';
      expect(errorPaths(r)).toContain('personal.gender');
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
      r.personal.name = '山田\n太郎';
      expect(errorPaths(r)).toContain('personal.name');
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
      const r = validResume() as unknown as { education: { year: unknown }[] };
      r.education[0]!.year = '2001';
      expect(errorPaths(r)).toContain('education.0.year');
    });

    it.each([null, undefined, 'string', 42, []])('オブジェクト以外（%s）を拒否する', (input) => {
      expect(validateResume(input).ok).toBe(false);
    });

    it('対応していない version を拒否する', () => {
      expect(errorPaths({ ...validResume(), version: '2.0' })).toContain('version');
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
          name: secret + '\n',
          nameKana: secret,
          birthDate: secret,
          postalCode: secret,
          phone: secret,
          email: secret,
          address: { prefecture: secret, city: 123, street: secret, building: secret },
        },
        education: [{ year: secret, month: secret, category: secret, school: 1, department: secret, note: secret }],
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
      ['personal.email', 'personal.name', 'personal.nameKana', 'personal.phone'].sort(),
    );
  });
});
