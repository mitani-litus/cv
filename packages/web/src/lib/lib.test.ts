import { createEmptyResume, LIMITS, validateResume } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { coerceDraft, hasInput } from './draft';
import { toKatakana } from './kana';
import { errorsForStep, fieldId, stepOfPath } from './steps';

describe('coerceDraft', () => {
  it('入力途中（必須項目が空）のデータも読み込める', () => {
    const draft = coerceDraft({ version: '1.0', createdAt: '2026-01-05', personal: { name: '山田 太郎' } }, '2026-10-07');
    expect(draft.createdAt).toBe('2026-01-05');
    expect(draft.personal.name).toBe('山田 太郎');
    expect(draft.personal.email).toBe('');
  });

  it('形の合わない値や想定外の項目は捨てる', () => {
    const draft = coerceDraft(
      {
        photo: 'data:image/png;base64,AAAA',
        personal: { name: 123, address: { prefecture: '東京' }, photo: 'x' },
        education: [{ year: '2001', month: 4.5, category: '入社', school: '高校' }, 'garbage'],
        motivation: ['x'],
      },
      '2026-10-07',
    );
    expect(draft).not.toHaveProperty('photo');
    expect(draft.personal).not.toHaveProperty('photo');
    expect(draft.personal.name).toBe('');
    expect(draft.personal.address.prefecture).toBe('');
    expect(draft.education[0]).toEqual({ year: null, month: null, category: '', school: '高校', department: '', note: '' });
    expect(draft.education[1]?.school).toBe('');
    expect(draft.motivation).toBe('');
    // 取り出した結果は、必須項目以外のチェックを通る形になっている
    const result = validateResume(draft);
    expect(result.ok ? [] : result.errors.map((e) => e.path).sort()).toEqual(
      ['personal.email', 'personal.name', 'personal.nameKana', 'personal.phone'].sort(),
    );
  });

  it('行数の上限を超える分は捨てる', () => {
    const draft = coerceDraft({ qualifications: Array.from({ length: 100 }, () => ({ name: 'x' })) }, '2026-10-07');
    expect(draft.qualifications).toHaveLength(LIMITS.entries);
  });

  it.each([null, 'text', 42, []])('オブジェクト以外（%s）は空の履歴書になる', (input) => {
    expect(coerceDraft(input, '2026-10-07')).toEqual(createEmptyResume('2026-10-07'));
  });
});

describe('hasInput', () => {
  it('何か入力されているかを判定する', () => {
    const r = createEmptyResume('2026-10-07');
    expect(hasInput(r)).toBe(false);
    expect(hasInput({ ...r, motivation: 'a' })).toBe(true);
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
