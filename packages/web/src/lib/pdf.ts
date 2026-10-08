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

let rendererCache: Promise<typeof import('@cv/pdf')> | undefined;

/** PDFの作成処理（PDFKit）を読み込む。失敗したら、次は読み込み直す */
function loadRenderer(): Promise<typeof import('@cv/pdf')> {
  rendererCache ??= import('@cv/pdf').catch((e: unknown) => {
    rendererCache = undefined;
    throw e;
  });
  return rendererCache;
}

/**
 * PDFの作成処理を、入力画面を開いたときに先に読み込んでおく。
 * 作成処理のファイル名には版ごとのハッシュが付き、新しい版を公開すると古いファイルはなくなる。
 * 「履歴書を作成する」を押すまで読み込まないと、入力中に公開された場合に読み込めなくなるため。
 * フォントは大きく、ファイル名も版によらないため、ここでは読み込まない。
 */
export function preloadPdfRenderer(): void {
  if (PDF_API === '') loadRenderer().catch(() => undefined);
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

  // フォントは大きいため、作成するときにだけ読み込む（作成処理と並行して読み込む）
  const fontPromise = loadFont();
  fontPromise.catch(() => undefined);
  let render: typeof import('@cv/pdf').renderResumePdf;
  try {
    ({ renderResumePdf: render } = await loadRenderer());
  } catch {
    throw new PdfRequestError('outdated');
  }
  let font: Uint8Array;
  try {
    font = await fontPromise;
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
