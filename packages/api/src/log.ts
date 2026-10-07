/**
 * 構造化ログ。個人情報を出さないよう、決められた項目しか受け付けない。
 * 履歴書の内容・エラーメッセージ・リクエスト本文は渡さないこと。
 */
type LogEvent =
  | 'request_rejected'
  | 'validation_failed'
  | 'pdf_generation_completed'
  | 'pdf_generation_failed';

interface LogFields {
  requestId: string;
  status?: number;
  reason?: 'method' | 'origin' | 'content_type' | 'too_large' | 'json';
  durationMs?: number;
  /** 例外の種類（Error の name）だけ。message は個人情報を含みうるので出さない */
  errorName?: string;
  errorCount?: number;
}

export function log(level: 'info' | 'warn' | 'error', event: LogEvent, fields: LogFields): void {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}
