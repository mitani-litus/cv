import { RESUME_VERSION } from './constants';
import type { EducationEntry, EmploymentEntry, QualificationEntry, Resume } from './resume';

/** 入力前の空の履歴書。createdAt は「履歴書の日付」の初期値（通常は当日、YYYY-MM-DD）。 */
export function createEmptyResume(createdAt: string): Resume {
  return {
    version: RESUME_VERSION,
    createdAt,
    personal: {
      name: '',
      nameKana: '',
      birthDate: '',
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

export function createEmptyEducation(): EducationEntry {
  return { year: null, month: null, category: '', school: '', department: '', note: '' };
}

export function createEmptyEmployment(): EmploymentEntry {
  return { year: null, month: null, category: '', company: '', department: '', position: '', note: '' };
}

export function createEmptyQualification(): QualificationEntry {
  return { year: null, month: null, name: '', note: '' };
}
