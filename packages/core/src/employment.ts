import type { EmploymentEntry } from '@cv/schema';

/**
 * 職歴の最後の行が「入社」なら在職中とみなす（履歴書では「現在に至る」と書く）。
 * 中身が空の行は無視する。
 */
export function isCurrentlyEmployed(employment: EmploymentEntry[]): boolean {
  const filled = employment.filter(
    (e) => e.year !== null || e.month !== null || e.category !== '' || e.company.trim() !== '',
  );
  return filled.at(-1)?.category === '入社';
}

export const CURRENTLY_EMPLOYED_TEXT = '現在に至る';
