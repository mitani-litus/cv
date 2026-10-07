import {
  createEmptyEducation,
  createEmptyEmployment,
  createEmptyQualification,
  createEmptyResume,
  EDUCATION_CATEGORIES,
  EMPLOYMENT_CATEGORIES,
  LIMITS,
  PREFECTURES,
  type Resume,
} from '@cv/schema';

/** 今日の日付（端末の時刻、YYYY-MM-DD） */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {};
}

function str(v: unknown, max = 2000): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function oneOf<T extends string>(v: unknown, options: readonly T[]): T | '' {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : '';
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function list(v: unknown): Obj[] {
  return Array.isArray(v) ? v.slice(0, LIMITS.entries).map(obj) : [];
}

/**
 * 保存したJSONを、入力途中のデータとして読み込む。
 * 入力途中で保存したものは必須項目が空のこともあるため、入力チェックはせず、
 * 形が合う値だけを取り出す（想定外の項目は捨てる）。内容のチェックは各ステップで行う。
 */
export function coerceDraft(input: unknown, fallbackCreatedAt: string): Resume {
  const root = obj(input);
  const p = obj(root.personal);
  const a = obj(p.address);
  const layout = obj(root.layout);
  const base = createEmptyResume(str(root.createdAt) || fallbackCreatedAt);
  return {
    ...base,
    layout: {
      photoBox: bool(layout.photoBox, base.layout.photoBox),
      genderField: bool(layout.genderField, base.layout.genderField),
    },
    personal: {
      name: str(p.name),
      nameKana: str(p.nameKana),
      birthDate: str(p.birthDate),
      gender: str(p.gender),
      postalCode: str(p.postalCode),
      address: {
        prefecture: oneOf(a.prefecture, PREFECTURES),
        city: str(a.city),
        street: str(a.street),
        building: str(a.building),
      },
      phone: str(p.phone),
      email: str(p.email),
    },
    education: list(root.education).map((e) => ({
      ...createEmptyEducation(),
      year: int(e.year),
      month: int(e.month),
      category: oneOf(e.category, EDUCATION_CATEGORIES),
      school: str(e.school),
      department: str(e.department),
      note: str(e.note),
    })),
    employment: list(root.employment).map((e) => ({
      ...createEmptyEmployment(),
      year: int(e.year),
      month: int(e.month),
      category: oneOf(e.category, EMPLOYMENT_CATEGORIES),
      company: str(e.company),
      department: str(e.department),
      position: str(e.position),
      note: str(e.note),
    })),
    qualifications: list(root.qualifications).map((q) => ({
      ...createEmptyQualification(),
      year: int(q.year),
      month: int(q.month),
      name: str(q.name),
      note: str(q.note),
    })),
    motivation: str(root.motivation),
    selfIntroduction: str(root.selfIntroduction),
    preferences: str(root.preferences),
  };
}

/** 保存したJSONファイルを読み込む。JSONとして読めなければ null */
export async function readDraftFile(file: File, fallbackCreatedAt: string): Promise<Resume | null> {
  if (file.size > 1024 * 1024) return null;
  try {
    return coerceDraft(JSON.parse(await file.text()), fallbackCreatedAt);
  } catch {
    return null;
  }
}

/** 何か入力されているか（ページを離れるときの確認に使う）。様式の選択だけなら入力とみなさない */
export function hasInput(resume: Resume): boolean {
  const empty = createEmptyResume(resume.createdAt);
  return JSON.stringify({ ...resume, layout: empty.layout }) !== JSON.stringify(empty);
}
