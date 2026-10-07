import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createEmptyResume, type ResumeLayout } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { renderResumePdf } from './index';

const fontDir = join(createRequire(join(process.cwd(), 'index.js')).resolve('@expo-google-fonts/noto-sans-jp/package.json'), '..');
const regular = new Uint8Array(readFileSync(join(fontDir, '400Regular/NotoSansJP_400Regular.ttf')));

function resume() {
  const r = createEmptyResume('2026-10-07');
  r.personal = { ...r.personal, name: '山田 太郎', nameKana: 'ヤマダ タロウ', phone: '090-1234-5678', email: 'taro@example.jp' };
  return r;
}

/** 1ページ目の文字を取り出す */
async function firstPageText(pdf: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: pdf });
  const content = await (await (await task.promise).getPage(1)).getTextContent();
  await task.destroy();
  return content.items.map((item) => ('str' in item ? item.str : '')).join('');
}

async function render(layout: ResumeLayout, gender = '') {
  const r = resume();
  r.layout = layout;
  r.personal.gender = gender;
  return firstPageText(await renderResumePdf(r, { regular }));
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

  describe('写真欄・性別欄', () => {
    it('写真欄は、設けるときだけ空欄と案内を描く', async () => {
      expect(await render({ photoBox: true, genderField: false })).toContain('写真をはる位置');
      expect(await render({ photoBox: false, genderField: false })).not.toContain('写真をはる位置');
    });

    it('性別欄は、設けるときだけ描き、記載が任意であることを添える', async () => {
      const withGender = await render({ photoBox: true, genderField: true }, '女');
      expect(withGender).toContain('性別');
      expect(withGender).toContain('女');
      expect(withGender).toContain('記載は任意です');
      const without = await render({ photoBox: true, genderField: false }, '女');
      expect(without).not.toContain('性別');
      expect(without).not.toContain('女');
    });

    it('性別欄を設けて空欄のままでも作成できる', async () => {
      expect(await render({ photoBox: false, genderField: true })).toContain('性別');
    });
  });
});
