import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createEmptyEducation, createEmptyEmployment, createEmptyResume, type Gender, type ResumeLayout } from '@cv/schema';
import { describe, expect, it } from 'vitest';
import { renderResumePdf } from './index';

const fontDir = join(createRequire(join(process.cwd(), 'index.js')).resolve('@expo-google-fonts/noto-sans-jp/package.json'), '..');
const regular = new Uint8Array(readFileSync(join(fontDir, '400Regular/NotoSansJP_400Regular.ttf')));

function resume() {
  const r = createEmptyResume('2026-10-07');
  r.personal = { ...r.personal, familyName: '山田', givenName: '太郎', familyNameKana: 'ヤマダ', givenNameKana: 'タロウ', phone: '090-1234-5678', email: 'taro@example.jp' };
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

async function render(layout: ResumeLayout, gender: Gender | '' = '') {
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
      const withGender = await render({ photoBox: true, genderField: true }, '女性');
      expect(withGender).toContain('性別');
      expect(withGender).toContain('女性');
      expect(withGender).toContain('記載は任意です');
      const without = await render({ photoBox: true, genderField: false }, '女性');
      expect(without).not.toContain('性別');
      expect(without).not.toContain('女性');
    });

    it('性別欄を設けて空欄のままでも作成できる', async () => {
      expect(await render({ photoBox: false, genderField: true })).toContain('性別');
    });
  });

  it('ミドルネームは在留カードと同じく「姓 名 ミドルネーム」の順に記載する', async () => {
    const r = resume();
    r.personal = { ...r.personal, familyName: 'SMITH', givenName: 'JOHN', middleName: 'MICHAEL', familyNameKana: 'スミス', givenNameKana: 'ジョン', middleNameKana: 'マイケル' };
    const text = await firstPageText(await renderResumePdf(r, { regular }));
    expect(text).toContain('SMITH JOHN MICHAEL');
    expect(text).toContain('スミス ジョン マイケル');
  });

  it('氏名は姓と名を空白でつなぎ、学歴・職歴は1件を入学・卒業、入社・退職の行にする', async () => {
    const r = resume();
    r.education = [{ ...createEmptyEducation(), school: '工学院大学', start: { year: 2000, month: 4 }, end: { year: 2004, month: 3 }, status: '卒業' }];
    r.employment = [{ ...createEmptyEmployment(), company: '株式会社○○', start: { year: 2006, month: 4 } }];
    const text = await firstPageText(await renderResumePdf(r, { regular }));
    expect(text).toContain('山田 太郎');
    expect(text).toContain('ヤマダ タロウ');
    expect(text).toContain('工学院大学 入学');
    expect(text).toContain('工学院大学 卒業');
    expect(text).toContain('株式会社○○ 入社');
    expect(text).toContain('現在に至る');
  });
});
