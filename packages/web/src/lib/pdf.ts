import type { Resume } from '@cv/schema';
import { PDF_API } from '../config';
import { PdfRequestError, requestPdf } from './api';

const FONT_URL = `${import.meta.env.BASE_URL}fonts/NotoSansJP-Regular.ttf`;

let fontCache: Promise<Uint8Array> | undefined;

/**
 * PDF用のフォント（TTF）を読み込む。初回だけ通信し、以後はこのページを開いている間、使い回す。
 * gzip で圧縮した版（約3.3MB）をブラウザで展開する。展開できないブラウザでは TTF（約5.7MB）を読む。
 */
async function fetchFont(): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const res = await fetch(`${FONT_URL}.gz`, { credentials: 'omit' });
    if (res.ok) {
      const data = new Uint8Array(await res.arrayBuffer());
      // 配信元が Content-Encoding: gzip を付けると、ブラウザが展開済みのものを受け取る（vite preview など）
      if (data[0] !== 0x1f || data[1] !== 0x8b) return data;
      const stream = new Response(data).body!.pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
  }
  const res = await fetch(FONT_URL, { credentials: 'omit' });
  if (!res.ok) throw new Error(`font ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function loadFont(): Promise<Uint8Array> {
  fontCache ??= fetchFont()
    .catch((e: unknown) => {
      fontCache = undefined;
      throw e;
    });
  return fontCache;
}

/**
 * 履歴書PDFを作る。
 * - 既定：ブラウザの中で作る。入力内容は端末の外に出ない
 * - VITE_PDF_API を設定した構成：サーバー（Lambda）に依頼する
 */
export async function createPdf(resume: Resume): Promise<Blob> {
  if (PDF_API !== '') return requestPdf(PDF_API, resume);

  let font: Uint8Array;
  let render: typeof import('@cv/pdf').renderResumePdf;
  try {
    // PDFの作成処理（PDFKit）とフォントは大きいため、作成するときにだけ読み込む
    [font, { renderResumePdf: render }] = await Promise.all([loadFont(), import('@cv/pdf')]);
  } catch {
    throw new PdfRequestError('font');
  }
  try {
    const bytes = await render(resume, { regular: font });
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  } catch {
    throw new PdfRequestError('failed');
  }
}
