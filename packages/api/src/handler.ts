import { validateResume, type FieldError } from '@cv/schema';
import { loadFonts } from './fonts';
import { log } from './log';
import { renderResumePdf } from './pdf/render';

/** API Gateway HTTP API（ペイロード 2.0）のイベントのうち、使う部分だけ */
export interface HttpEvent {
  requestContext?: { requestId?: string; http?: { method?: string } };
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/** 受け付ける本文の上限。正しい履歴書（上限いっぱい）でも 40KB 程度に収まる */
export const MAX_BODY_BYTES = 64 * 1024;

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// CORS のヘッダー（Access-Control-Allow-Origin など）は返さない。
// 画面とAPIは同じ CloudFront の下にあり、同一オリジンからしか呼ばれないため。

function json(statusCode: number, body: { error: string; errors?: FieldError[] }): HttpResult {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  };
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function header(event: HttpEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  // HTTP API は小文字で渡すが、念のため大文字小文字を区別しない
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

/**
 * POST /api/pdf：履歴書JSONを受け取り、PDFを返す。
 * 受け取ったデータはこの関数の中（メモリ）だけで使い、保存もログ出力もしない。
 */
export async function handler(event: HttpEvent): Promise<HttpResult> {
  const started = Date.now();
  const requestId = event.requestContext?.requestId ?? 'local';
  const reject = (statusCode: number, reason: NonNullable<Parameters<typeof log>[2]['reason']>, error: string) => {
    log('warn', 'request_rejected', { requestId, status: statusCode, reason });
    return json(statusCode, { error });
  };

  try {
    if (event.requestContext?.http?.method !== 'POST') return reject(405, 'method', 'method_not_allowed');

    // ブラウザが付ける Origin を確認し、許可したサイト以外からの呼び出しを拒否する（CSRF対策）。
    // 許可リストが空なら、すべて拒否する。
    const origin = header(event, 'origin');
    if (origin === undefined || !allowedOrigins().includes(origin)) return reject(403, 'origin', 'forbidden');

    if (!(header(event, 'content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return reject(415, 'content_type', 'unsupported_media_type');
    }

    const raw = event.body ?? '';
    if (raw.length > MAX_BODY_BYTES * 2) return reject(413, 'too_large', 'payload_too_large');
    const bytes = event.isBase64Encoded ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'utf8');
    if (bytes.length > MAX_BODY_BYTES) return reject(413, 'too_large', 'payload_too_large');

    let input: unknown;
    try {
      input = JSON.parse(bytes.toString('utf8'));
    } catch {
      return reject(400, 'json', 'invalid_json');
    }

    // ブラウザでもチェック済みだが、APIでも同じ規則で必ずチェックする
    const result = validateResume(input);
    if (!result.ok) {
      log('warn', 'validation_failed', { requestId, status: 422, errorCount: result.errors.length });
      // エラー文には入力値が含まれない（@cv/schema の約束）
      return json(422, { error: 'invalid', errors: result.errors });
    }

    const pdf = await renderResumePdf(result.value, loadFonts());
    log('info', 'pdf_generation_completed', { requestId, status: 200, durationMs: Date.now() - started });
    return {
      statusCode: 200,
      headers: {
        ...BASE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="resume.pdf"; filename*=UTF-8''${encodeURIComponent('履歴書.pdf')}`,
      },
      body: pdf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    log('error', 'pdf_generation_failed', {
      requestId,
      status: 500,
      errorName: e instanceof Error ? e.name : 'unknown',
      durationMs: Date.now() - started,
    });
    return json(500, { error: 'internal' });
  }
}
