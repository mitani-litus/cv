import type { FieldError } from '@cv/schema';

export const STEPS = [
  { id: 'basic', label: '基本情報', title: '基本情報' },
  { id: 'education', label: '学歴', title: '学歴' },
  { id: 'employment', label: '職歴', title: '職歴' },
  { id: 'qualifications', label: '資格・免許', title: '資格・免許' },
  { id: 'texts', label: '志望動機など', title: '志望動機・自己PR・本人希望' },
  { id: 'confirm', label: '確認', title: '入力内容を確認してください' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

/** 各項目のエラーがどのステップに属するか */
export function stepOfPath(path: string): StepId {
  const head = path.split('.')[0] ?? '';
  switch (head) {
    case 'personal':
      return 'basic';
    case 'education':
    case 'employment':
    case 'qualifications':
      return head;
    case 'motivation':
    case 'selfIntroduction':
    case 'preferences':
      return 'texts';
    default:
      return 'confirm';
  }
}

/** そのステップで表示するエラー。確認画面ではすべてのエラーを表示する */
export function errorsForStep(errors: FieldError[], step: StepId): FieldError[] {
  return step === 'confirm' ? errors : errors.filter((e) => stepOfPath(e.path) === step);
}

/** 項目の位置から入力欄の id を作る（エラー一覧からのリンク先） */
export function fieldId(path: string): string {
  return `f-${path.replace(/\./g, '-') || 'root'}`;
}
