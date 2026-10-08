// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

describe('importResumeFromPdf', () => {
  it('pdf.js を読み込めない（ページを開いたまま新しい版が公開された）ときは outdated にする', async () => {
    vi.doMock('pdfjs-dist', () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    const { importResumeFromPdf } = await import('./pdfImport');
    const file = new File(['%PDF-1.7'], 'resume.pdf', { type: 'application/pdf' });
    await expect(importResumeFromPdf(file)).resolves.toEqual({ ok: false, reason: 'outdated' });
    vi.doUnmock('pdfjs-dist');
  });
});
