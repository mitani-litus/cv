import type { Resume } from '@cv/schema';

export class PdfRequestError extends Error {
  constructor(readonly kind: 'invalid' | 'busy' | 'failed') {
    super(kind);
  }
}

/**
 * PDFの作成をAPIに依頼する。サーバーに履歴書データを送るのはこの処理だけ。
 * Cookie などの認証情報は送らない。
 */
export async function requestPdf(resume: Resume, signal?: AbortSignal): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resume),
      credentials: 'omit',
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new PdfRequestError('failed');
  }
  if (res.status === 400 || res.status === 413 || res.status === 422) throw new PdfRequestError('invalid');
  if (res.status === 429 || res.status === 503) throw new PdfRequestError('busy');
  if (!res.ok || !(res.headers.get('Content-Type') ?? '').startsWith('application/pdf')) {
    throw new PdfRequestError('failed');
  }
  return res.blob();
}
