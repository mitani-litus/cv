import { migrateResume } from './migrate';
import { resumeSchema, type Resume } from './resume';

export interface FieldError {
  /** エラーのある項目の位置（例: "personal.email"、"education.0.year"）。ルート全体のときは "" */
  path: string;
  /** 利用者向けのメッセージ。入力値は含めない */
  message: string;
}

export type ValidationResult =
  | { ok: true; value: Resume }
  | { ok: false; errors: FieldError[] };

const FALLBACK_MESSAGE = '入力の形式が正しくありません。';

/**
 * 履歴書JSONを検証する。ブラウザ（入力チェック）とAPI（再チェック）の両方で使う。
 * 想定外の項目（画像データなど）が含まれている場合も拒否する。
 * 以前の形式（version 1.0）のJSONは、今の形式に変換してからチェックする。
 */
export function validateResume(input: unknown): ValidationResult {
  // 項目ごとのメッセージがない問題（型の違い、想定外の項目など）は共通の文言にする。
  // zod の既定メッセージには受け取った値の型や内容が入ることがあるため使わない。
  const result = resumeSchema.safeParse(migrateResume(input), { error: () => FALLBACK_MESSAGE });
  if (result.success) return { ok: true, value: result.data };

  const errors: FieldError[] = [];
  const seen = new Set<string>();
  for (const issue of result.error.issues) {
    const path = issue.path.map(String).join('.');
    // 1項目につき最初のエラーだけを返す（画面では1つずつ直してもらう）
    if (seen.has(path)) continue;
    seen.add(path);
    errors.push({ path, message: issue.message });
  }
  return { ok: false, errors };
}
