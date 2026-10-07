import { createEmptyResume, LIMITS, validateResume } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { coerceDraft, hasInput } from './draft';
import { toKatakana } from './kana';
import { errorsForStep, fieldId, stepOfPath } from './steps';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('coerceDraft', () => {
  it('入力途中（必須項目が空）のデータも読み込め、応募者IDを引き継ぐ', () => {
    const draft = coerceDraft({ version: '2.0', id: ID, createdAt: '2026-01-05', personal: { familyName: '山田' } }, '2026-10-07');
    expect(draft.id).toBe(ID);
    expect(draft.createdAt).toBe('2026-01-05');
    expect(draft.personal.familyName).toBe('山田');
    expect(draft.personal.email).toBe('');
  });

  it('以前の形式（1.0）のJSONは、今の形式に変換して読み込む', () => {
    const draft = coerceDraft(
      {
        version: '1.0',
        createdAt: '2026-01-05',
        personal: { name: '山田 太郎', nameKana: 'ヤマダ タロウ', gender: '女' },
        education: [
          { year: 2001, month: 4, category: '入学', school: '○○高校' },
          { year: 2004, month: 3, category: '卒業', school: '○○高校' },
        ],
        employment: [{ year: 2008, month: 4, category: '入社', company: '株式会社○○' }],
      },
      '2026-10-07',
    );
    expect(draft.personal).toMatchObject({ familyName: '山田', givenName: '太郎', familyNameKana: 'ヤマダ', givenNameKana: 'タロウ', gender: '女性' });
    expect(draft.education).toEqual([
      { school: '○○高校', department: '', degree: '', start: { year: 2001, month: 4 }, end: { year: 2004, month: 3 }, status: '卒業', note: '' },
    ]);
    expect(draft.employment[0]).toMatchObject({ company: '株式会社○○', start: { year: 2008, month: 4 }, end: { year: null, month: null } });
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('形の合わない値や想定外の項目は捨てる', () => {
    const draft = coerceDraft(
      {
        version: '2.0',
        id: 'A001',
        photo: 'data:image/png;base64,AAAA',
        personal: { familyName: 123, gender: 'あ', address: { prefecture: '東京' }, photo: 'x' },
        education: [{ start: { year: '2001', month: 4.5 }, status: '入学', school: '高校' }, 'garbage'],
        motivation: ['x'],
      },
      '2026-10-07',
    );
    expect(draft).not.toHaveProperty('photo');
    expect(draft.personal).not.toHaveProperty('photo');
    expect(draft.id).not.toBe('A001');
    expect(draft.personal.familyName).toBe('');
    expect(draft.personal.gender).toBe('');
    expect(draft.personal.address.prefecture).toBe('');
    expect(draft.education[0]).toEqual({
      school: '高校',
      department: '',
      degree: '',
      start: { year: null, month: null },
      end: { year: null, month: null },
      status: '',
      note: '',
    });
    expect(draft.education[1]?.school).toBe('');
    expect(draft.motivation).toBe('');
    // 取り出した結果は、必須項目以外のチェックを通る形になっている
    const result = validateResume(draft);
    expect(result.ok ? [] : result.errors.map((e) => e.path).sort()).toEqual(
      ['personal.email', 'personal.familyName', 'personal.familyNameKana', 'personal.givenName', 'personal.givenNameKana', 'personal.phone'].sort(),
    );
  });

  it('写真欄・性別欄の設定と性別を読み込む。ない場合は既定値にする', () => {
    const draft = coerceDraft({ version: '2.0', layout: { photoBox: false, genderField: true }, personal: { gender: '女性' } }, '2026-10-07');
    expect(draft.layout).toEqual({ photoBox: false, genderField: true });
    expect(draft.personal.gender).toBe('女性');
    const old = coerceDraft({ version: '2.0', layout: { photoBox: 'no' } }, '2026-10-07');
    expect(old.layout).toEqual({ photoBox: true, genderField: false });
  });

  it('行数の上限を超える分は捨てる', () => {
    const draft = coerceDraft({ qualifications: Array.from({ length: 100 }, () => ({ name: 'x' })) }, '2026-10-07');
    expect(draft.qualifications).toHaveLength(LIMITS.entries);
  });

  it.each([null, 'text', 42, []])('オブジェクト以外（%s）は空の履歴書になる', (input) => {
    const draft = coerceDraft(input, '2026-10-07');
    expect(draft).toEqual(createEmptyResume('2026-10-07', draft.id));
  });
});

describe('hasInput', () => {
  it('何か入力されているかを判定する', () => {
    const r = createEmptyResume('2026-10-07');
    expect(hasInput(r)).toBe(false);
    expect(hasInput({ ...r, motivation: 'a' })).toBe(true);
    // 様式の選択だけでは、入力ありとみなさない
    expect(hasInput({ ...r, layout: { photoBox: false, genderField: true } })).toBe(false);
  });
});

describe('steps', () => {
  it('エラーの位置からステップを決める', () => {
    expect(stepOfPath('personal.address.city')).toBe('basic');
    expect(stepOfPath('education.0.year')).toBe('education');
    expect(stepOfPath('preferences')).toBe('texts');
    expect(stepOfPath('createdAt')).toBe('confirm');
    expect(stepOfPath('')).toBe('confirm');
  });

  it('確認画面ではすべてのエラーを表示する', () => {
    const errors = [
      { path: 'personal.name', message: 'a' },
      { path: 'education.0.year', message: 'b' },
    ];
    expect(errorsForStep(errors, 'basic')).toEqual([errors[0]]);
    expect(errorsForStep(errors, 'confirm')).toEqual(errors);
  });

  it('入力欄の id', () => {
    expect(fieldId('education.0.year')).toBe('f-education-0-year');
    expect(fieldId('')).toBe('f-root');
  });
});

describe('toKatakana', () => {
  it('ひらがなだけをカタカナにする', () => {
    expect(toKatakana('やまだ たろう')).toBe('ヤマダ タロウ');
    expect(toKatakana('ヤマダ abc 山田')).toBe('ヤマダ abc 山田');
  });
});
