import { describe, expect, it } from 'vitest';
import { migrateResume, validateResume } from './index';

/** 以前の形式（1.0）の履歴書JSON */
function v1() {
  return {
    version: '1.0',
    createdAt: '2026-10-07',
    layout: { photoBox: true, genderField: true },
    personal: {
      name: '箕谷 祐也',
      nameKana: 'ミタニ　ユウヤ',
      birthDate: '1981-10-03',
      gender: '男',
      postalCode: '192-0361',
      address: { prefecture: '東京都', city: '八王子市', street: '越野32-23', building: '' },
      phone: '03-4500-7765',
      email: 'mitani@example.jp',
    },
    education: [
      { year: 2000, month: 4, category: '入学', school: '工学院大学', department: '工学部情報工学科', note: '' },
      { year: 2004, month: 3, category: '卒業', school: '工学院大学', department: '工学部情報工学科', note: '' },
      { year: 2004, month: 4, category: '入学', school: '工学院大学大学院', department: '', note: '' },
      { year: 2006, month: 3, category: '修了', school: '工学院大学大学院', department: '', note: '' },
      { year: 2007, month: 3, category: '中途退学', school: '○○専門学校', department: '', note: '' },
      { year: 2008, month: null, category: 'その他', school: '高卒認定', department: '', note: '合格' },
    ],
    employment: [
      { year: 2006, month: 4, category: '入社', company: '株式会社A', department: '開発部', position: '', note: '' },
      { year: 2009, month: 6, category: '退職', company: '株式会社A', department: '', position: '', note: '' },
      { year: 2009, month: 7, category: '入社', company: '株式会社B', department: '', position: 'SE', note: '設計を担当' },
    ],
    qualifications: [{ year: 2004, month: 8, name: '普通自動車第一種運転免許', note: '' }],
    motivation: '',
    selfIntroduction: '',
    preferences: '',
  };
}

describe('migrateResume（1.0 → 2.0）', () => {
  it('変換したものは今の形式の入力チェックを通る', () => {
    const result = validateResume(v1());
    expect(result.ok).toBe(true);
  });

  it('氏名を最初の空白で姓と名に分ける（空白がなければすべて姓）', () => {
    const m = migrateResume(v1()) as { personal: Record<string, unknown> };
    expect(m.personal).toMatchObject({ familyName: '箕谷', givenName: '祐也', familyNameKana: 'ミタニ', givenNameKana: 'ユウヤ' });
    expect(m.personal).not.toHaveProperty('name');
    const single = v1();
    single.personal.name = '箕谷祐也';
    expect(migrateResume(single)).toMatchObject({ personal: { familyName: '箕谷祐也', givenName: '' } });
  });

  it('入学と卒業・修了・中途退学の行を1件にまとめ、対にならない行はそのまま1件にする', () => {
    const m = migrateResume(v1()) as { education: unknown[] };
    expect(m.education).toEqual([
      { school: '工学院大学', department: '工学部情報工学科', degree: '', note: '', start: { year: 2000, month: 4 }, end: { year: 2004, month: 3 }, status: '卒業' },
      { school: '工学院大学大学院', department: '', degree: '', note: '', start: { year: 2004, month: 4 }, end: { year: 2006, month: 3 }, status: '修了' },
      { school: '○○専門学校', department: '', degree: '', note: '', start: { year: null, month: null }, end: { year: 2007, month: 3 }, status: '中退' },
      { school: '高卒認定', department: '', degree: '', note: '合格', start: { year: 2008, month: null }, end: { year: null, month: null }, status: '' },
    ]);
  });

  it('入社と退職の行を1件にまとめ、退職の行がなければ在職中にする', () => {
    const m = migrateResume(v1()) as { employment: unknown[] };
    expect(m.employment).toEqual([
      { company: '株式会社A', department: '開発部', position: '', note: '', start: { year: 2006, month: 4 }, end: { year: 2009, month: 6 } },
      { company: '株式会社B', department: '', position: 'SE', note: '設計を担当', start: { year: 2009, month: 7 }, end: { year: null, month: null } },
    ]);
  });

  it('性別は選択肢に置き換え、当てはまらない値は空欄にする', () => {
    expect(migrateResume(v1())).toMatchObject({ personal: { gender: '男性' } });
    const other = v1();
    other.personal.gender = 'あ';
    expect(migrateResume(other)).toMatchObject({ personal: { gender: '' } });
  });

  it('応募者IDを作り、様式の選択がなければ既定値にする', () => {
    const { layout: _layout, ...withoutLayout } = v1();
    const m = migrateResume(withoutLayout) as { id: string; version: string; layout: unknown };
    expect(m.version).toBe('2.0');
    expect(m.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(m.layout).toEqual({ photoBox: true, genderField: false });
  });

  it('1.0 以外はそのまま返す', () => {
    const input = { version: '2.0', foo: 1 };
    expect(migrateResume(input)).toBe(input);
    expect(migrateResume(null)).toBeNull();
  });
});
