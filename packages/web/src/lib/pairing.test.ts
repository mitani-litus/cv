import { createEmptyEducation, createEmptyEmployment, LIMITS } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { setEducationCategory, setEducationText, setEmploymentCategory, setEmploymentCompany } from './pairing';

const school = (patch = {}) => ({ ...createEmptyEducation(), year: 2001, month: 4, school: '○○高校', department: '普通科', ...patch });
const job = (patch = {}) => ({ ...createEmptyEmployment(), year: 2008, month: 4, company: '株式会社○○', department: '営業部', ...patch });

describe('学歴の対の行', () => {
  it('「入学」にすると、学校名・学部を写した「卒業」の行を下に追加する', () => {
    const items = setEducationCategory([school()], 0, '入学');
    expect(items).toHaveLength(2);
    expect(items[0]!.category).toBe('入学');
    expect(items[1]).toEqual({ ...createEmptyEducation(), category: '卒業', school: '○○高校', department: '普通科' });
  });

  it('すでに対になる行があれば追加しない（中途退学なども含む）', () => {
    const items = [school({ category: '入学' }), school({ category: '中途退学', year: 2002 })];
    expect(setEducationCategory(items, 0, '入学')).toHaveLength(2);
  });

  it('「入学」以外にしても追加しない', () => {
    expect(setEducationCategory([school()], 0, '卒業')).toHaveLength(1);
  });

  it('行数の上限では追加しない', () => {
    const items = Array.from({ length: LIMITS.entries }, () => school());
    expect(setEducationCategory(items, 0, '入学')).toHaveLength(LIMITS.entries);
  });

  it('入学の行の学校名を変えると、対の行も変わる。自分で書き換えた行は変えない', () => {
    let items = setEducationCategory([school({ school: '' , department: '' })], 0, '入学');
    items = setEducationText(items, 0, { school: '△△高校' });
    expect(items[1]!.school).toBe('△△高校');
    items = setEducationText(items, 1, { school: '□□高校' });
    items = setEducationText(items, 0, { school: '××高校' });
    expect(items[1]!.school).toBe('□□高校');
  });
});

describe('職歴の対の行', () => {
  it('「入社」にすると、会社名を写した「退職」の行を下に追加する', () => {
    const items = setEmploymentCategory([job()], 0, '入社');
    expect(items[1]).toEqual({ ...createEmptyEmployment(), category: '退職', company: '株式会社○○' });
  });

  it('すでに退職の行があれば追加しない', () => {
    const items = [job({ category: '入社' }), job({ category: '退職' })];
    expect(setEmploymentCategory(items, 0, '入社')).toHaveLength(2);
  });

  it('入社の行の会社名を変えると、退職の行も変わる', () => {
    let items = setEmploymentCategory([job({ company: '' })], 0, '入社');
    items = setEmploymentCompany(items, 0, '株式会社△△');
    expect(items[1]!.company).toBe('株式会社△△');
  });
});
