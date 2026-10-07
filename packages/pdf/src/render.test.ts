import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createEmptyResume } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { renderResumePdf } from './index';

const fontDir = join(createRequire(join(process.cwd(), 'index.js')).resolve('@expo-google-fonts/noto-sans-jp/package.json'), '..');
const regular = new Uint8Array(readFileSync(join(fontDir, '400Regular/NotoSansJP_400Regular.ttf')));

function resume() {
  const r = createEmptyResume('2026-10-07');
  r.personal = { ...r.personal, name: '山田 太郎', nameKana: 'ヤマダ タロウ', phone: '090-1234-5678', email: 'taro@example.jp' };
  return r;
}

describe('renderResumePdf', () => {
  it('太字のフォントがなくても（ブラウザと同じ条件）作成できる', async () => {
    const pdf = await renderResumePdf(resume(), { regular });
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
  });

  it('使った文字だけを埋め込むため、PDFは小さい（フォント全体は埋め込まない）', async () => {
    const pdf = await renderResumePdf(resume(), { regular });
    // フォント（TTF）は約5.7MB。サブセット化できていれば数十KBに収まる
    expect(pdf.length).toBeLessThan(200 * 1024);
  });
});
