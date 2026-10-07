import { validateResume, type Resume } from '@cv/schema';

/** PDF生成時に添付する履歴書JSONのファイル名（packages/api と合わせる） */
export const EMBEDDED_JSON_NAME = 'resume.json';
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type ImportResult =
  | { ok: true; resume: Resume }
  | { ok: false; reason: 'not-pdf' | 'too-large' | 'no-data' | 'invalid' };

/**
 * このサービスで作成したPDFから、添付された履歴書JSONを取り出す。
 * 読み込みはブラウザの中だけで行い、ファイルをサーバーへ送らない。
 */
export async function importResumeFromPdf(file: File): Promise<ImportResult> {
  if (file.size > MAX_PDF_BYTES) return { ok: false, reason: 'too-large' };
  const data = new Uint8Array(await file.arrayBuffer());
  // 拡張子やMIMEタイプではなく、ファイルの先頭で判定する
  if (new TextDecoder().decode(data.subarray(0, 5)) !== '%PDF-') return { ok: false, reason: 'not-pdf' };

  // pdf.js は大きいため、この画面を開いたときだけ読み込む
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  let json: string | null = null;
  const task = pdfjs.getDocument({ data, enableXfa: false });
  try {
    const doc = await task.promise;
    const attachments = await doc.getAttachments();
    for (const [id, attachment] of attachments ?? []) {
      if (attachment.filename !== EMBEDDED_JSON_NAME) continue;
      const content = attachment.content ?? (await doc.getAttachmentContent(id));
      if (content) json = new TextDecoder().decode(content);
      break;
    }
  } catch {
    return { ok: false, reason: 'not-pdf' };
  } finally {
    await task.destroy();
  }
  if (json === null) return { ok: false, reason: 'no-data' };

  try {
    const result = validateResume(JSON.parse(json));
    return result.ok ? { ok: true, resume: result.value } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
