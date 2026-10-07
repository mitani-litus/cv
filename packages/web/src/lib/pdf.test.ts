import { createEmptyResume } from '@cv/schema';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const render = vi.fn(async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]));
vi.mock('@cv/pdf', () => ({ renderResumePdf: render }));

const FONT = new Uint8Array([0, 1, 0, 0, 9, 9, 9]);

function resume() {
  const r = createEmptyResume('2026-10-07');
  r.personal.familyName = '山田';
  return r;
}

beforeEach(() => {
  vi.resetModules();
  render.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('createPdf（ブラウザで作る：既定）', () => {
  it('フォント（gzip）だけを読み込み、履歴書データはどこにも送らない', async () => {
    const fetchMock = vi.fn(async () => new Response(gzipSync(FONT)));
    vi.stubGlobal('fetch', fetchMock);
    const { createPdf } = await import('./pdf');

    const blob = await createPdf(resume());

    expect(blob.type).toBe('application/pdf');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/fonts/NotoSansJP-Regular.ttf.gz');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body).toBeUndefined();
    // 展開したフォントで PDF を作る
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ personal: expect.objectContaining({ familyName: '山田' }) }), {
      regular: FONT,
    });
  });

  it('配信元が展開済みのフォントを返しても（Content-Encoding: gzip）、そのまま使う', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(FONT)));
    const { createPdf } = await import('./pdf');
    await createPdf(resume());
    expect(render).toHaveBeenCalledWith(expect.anything(), { regular: FONT });
  });

  it('フォントは2回目から読み込まない', async () => {
    const fetchMock = vi.fn(async () => new Response(gzipSync(FONT)));
    vi.stubGlobal('fetch', fetchMock);
    const { createPdf } = await import('./pdf');
    await createPdf(resume());
    await createPdf(resume());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('フォントを読み込めなければ font のエラーにし、次は読み込み直す', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { createPdf } = await import('./pdf');
    await expect(createPdf(resume())).rejects.toMatchObject({ kind: 'font' });
    await expect(createPdf(resume())).rejects.toMatchObject({ kind: 'font' });
    expect(render).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('createPdf（サーバーで作る：VITE_PDF_API を設定した構成）', () => {
  it('API に履歴書JSONを送り、Cookie などは送らない', async () => {
    vi.stubEnv('VITE_PDF_API', '/api/pdf');
    const fetchMock = vi.fn(async () => new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { createPdf } = await import('./pdf');

    await createPdf(resume());

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/pdf');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string).personal.familyName).toBe('山田');
    expect(render).not.toHaveBeenCalled();
  });

  it('混み合っているときは busy のエラーにする', async () => {
    vi.stubEnv('VITE_PDF_API', '/api/pdf');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const { createPdf } = await import('./pdf');
    await expect(createPdf(resume())).rejects.toMatchObject({ kind: 'busy' });
  });
});
