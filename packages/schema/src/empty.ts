import { DEFAULT_LAYOUT, RESUME_VERSION } from './constants';
import type { EducationEntry, EmploymentEntry, QualificationEntry, Resume } from './resume';

/** 新しい応募者ID（UUID）。ブラウザと Node.js の両方にある crypto.randomUUID を使う */
export function newApplicantId(): string {
  // このパッケージは DOM・Node.js どちらの型定義にも依存しないため、使う部分だけ型を付ける
  return (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID();
}

/** 入力前の空の履歴書。createdAt は「履歴書の日付」の初期値（通常は当日、YYYY-MM-DD）。 */
export function createEmptyResume(createdAt: string, id = newApplicantId()): Resume {
  return {
    version: RESUME_VERSION,
    id,
    createdAt,
    layout: { ...DEFAULT_LAYOUT },
    personal: {
      familyName: '',
      givenName: '',
      middleName: '',
      familyNameKana: '',
      givenNameKana: '',
      middleNameKana: '',
      birthDate: '',
      gender: '',
      postalCode: '',
      address: { prefecture: '', city: '', street: '', building: '' },
      phone: '',
      email: '',
    },
    education: [],
    employment: [],
    qualifications: [],
    motivation: '',
    selfIntroduction: '',
    preferences: '',
  };
}

const emptyYearMonth = () => ({ year: null, month: null });

export function createEmptyEducation(): EducationEntry {
  return { school: '', department: '', degree: '', start: emptyYearMonth(), end: emptyYearMonth(), status: '', note: '' };
}

export function createEmptyEmployment(): EmploymentEntry {
  return { company: '', department: '', position: '', start: emptyYearMonth(), end: emptyYearMonth(), note: '' };
}

export function createEmptyQualification(): QualificationEntry {
  return { year: null, month: null, name: '', note: '' };
}
