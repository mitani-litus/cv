import {
  createEmptyEducation,
  createEmptyEmployment,
  createEmptyQualification,
  createEmptyResume,
  LIMITS,
  type Resume,
} from '@cv/schema';
import { EMBEDDED_JSON_NAME, wrapText } from '@cv/pdf';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler, MAX_BODY_BYTES, type HttpEvent } from './handler';

const ORIGIN = 'https://cv.example.jp';
const SECRET = 'SECRET-山田-12345';

function resume(): Resume {
  const r = createEmptyResume('2026-10-07');
  r.personal = {
    name: '山田 太郎',
    nameKana: 'ヤマダ タロウ',
    birthDate: '1985-04-01',
    gender: '',
    postalCode: '100-0001',
    address: { prefecture: '東京都', city: '千代田区', street: '千代田1-1', building: '' },
    phone: '090-1234-5678',
    email: 'taro@example.jp',
  };
  r.education = [{ ...createEmptyEducation(), year: 2001, month: 4, category: '入学', school: '○○高等学校' }];
  r.employment = [{ ...createEmptyEmployment(), year: 2008, month: 4, category: '入社', company: '株式会社○○' }];
  r.qualifications = [{ ...createEmptyQualification(), year: 2004, month: 8, name: '普通自動車第一種運転免許' }];
  r.motivation = '貴社の事業に関心があり、志望しました。';
  return r;
}

function event(body: unknown, overrides: Partial<HttpEvent> & { headers?: Record<string, string | undefined> } = {}): HttpEvent {
  return {
    requestContext: { requestId: 'req-1', http: { method: 'POST' } },
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...overrides.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
    ...(overrides.requestContext ? { requestContext: overrides.requestContext } : {}),
    ...(overrides.isBase64Encoded !== undefined ? { isBase64Encoded: overrides.isBase64Encoded } : {}),
  };
}

/** PDFの各ページの文字を取り出す */
async function pageTexts(pdf: Buffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf) });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return texts;
}

/** PDFから添付ファイルを取り出す（ブラウザの取り込み画面と同じく pdf.js を使う） */
async function attachments(pdf: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(pdf), enableXfa: false });
  const doc = await task.promise;
  const files = await doc.getAttachments();
  const result = new Map<string, string>();
  for (const [id, a] of files ?? []) {
    const content = a.content ?? (await doc.getAttachmentContent(id));
    if (content) result.set(a.filename, new TextDecoder().decode(content));
  }
  const pages = doc.numPages;
  await task.destroy();
  return { files: result, pages };
}

let logs: string[];

beforeEach(() => {
  process.env.ALLOWED_ORIGINS = `${ORIGIN}, http://localhost:5173`;
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => void logs.push(args.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...args) => void logs.push(args.join(' ')));
  vi.spyOn(console, 'warn').mockImplementation((...args) => void logs.push(args.join(' ')));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/pdf', () => {
  it('履歴書JSONからPDFを作り、Base64で返す', async () => {
    const res = await handler(event(resume()));
    expect(res.statusCode).toBe(200);
    expect(res.isBase64Encoded).toBe(true);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers).not.toHaveProperty('Access-Control-Allow-Origin');
    const pdf = Buffer.from(res.body, 'base64');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('PDFに履歴書JSONが添付され、取り出すと元のデータに戻る', async () => {
    const input = resume();
    const res = await handler(event(input));
    const { files } = await attachments(Buffer.from(res.body, 'base64'));
    expect([...files.keys()]).toEqual([EMBEDDED_JSON_NAME]);
    expect(JSON.parse(files.get(EMBEDDED_JSON_NAME)!)).toEqual(input);
  });

  it('通常の分量なら A4 の2ページに収め、各欄を決まったページに置く', async () => {
    const r = resume();
    r.selfIntroduction = '前職では法人営業を担当しました。'.repeat(15);
    const res = await handler(event(r));
    const texts = await pageTexts(Buffer.from(res.body, 'base64'));
    expect(texts).toHaveLength(2);
    expect(texts[0]).toContain('山田 太郎');
    expect(texts[0]).toContain('学歴・職歴');
    expect(texts[1]).toContain('免許・資格');
    expect(texts[1]).toContain('志望動機');
    expect(texts[1]).toContain('自己PR');
    expect(texts[1]).toContain('本人希望記入欄');
    // 自己PR はページをまたがずに、2ページ目の枠に収まる
    expect(texts[1]).toContain('前職では法人営業を担当しました。');
    expect(texts[1]).not.toContain('別紙のとおり');
  });

  it('職歴の最後が入社なら「現在に至る」と記載し、退職なら記載しない', async () => {
    const working = await pageTexts(Buffer.from((await handler(event(resume()))).body, 'base64'));
    expect(working[0]).toContain('現在に至る');
    const r = resume();
    r.employment = [...r.employment, { ...createEmptyEmployment(), year: 2020, month: 3, category: '退職', company: '株式会社○○' }];
    const retired = await pageTexts(Buffer.from((await handler(event(r))).body, 'base64'));
    expect(retired[0]).not.toContain('現在に至る');
    expect(retired[0]).toContain('以上');
  });

  it('枠に収まらない文章は「別紙のとおり」とし、別紙に全文を記載する', async () => {
    const r = resume();
    r.selfIntroduction = 'か\n'.repeat(LIMITS.selfIntroduction / 2);
    const texts = await pageTexts(Buffer.from((await handler(event(r))).body, 'base64'));
    expect(texts.length).toBeGreaterThan(2);
    expect(texts[1]).toContain('別紙のとおり');
    expect(texts.slice(2).join('')).toContain('別紙');
    expect(texts.slice(2).join('').split('か').length - 1).toBe(LIMITS.selfIntroduction / 2);
  });

  it('PDFの文書情報に個人情報を入れない', async () => {
    const res = await handler(event(resume()));
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(Buffer.from(res.body, 'base64')) });
    const { info } = await (await task.promise).getMetadata();
    await task.destroy();
    expect(JSON.stringify(info)).not.toContain('山田');
    expect((info as { Title?: string }).Title).toBe('履歴書');
  });

  it('件数・文字数が上限いっぱいでも、ページを増やして作成できる', async () => {
    const r = resume();
    r.education = Array.from({ length: LIMITS.entries }, (_, i) => ({ ...createEmptyEducation(), year: 2000 + (i % 20), month: 4, school: 'あ'.repeat(LIMITS.entryText), note: 'い'.repeat(LIMITS.note) }));
    r.employment = Array.from({ length: LIMITS.entries }, () => ({ ...createEmptyEmployment(), company: 'う'.repeat(LIMITS.entryText) }));
    r.qualifications = Array.from({ length: LIMITS.entries }, () => ({ ...createEmptyQualification(), name: 'え'.repeat(LIMITS.entryText) }));
    r.motivation = 'お'.repeat(LIMITS.motivation);
    r.selfIntroduction = 'か\n'.repeat(LIMITS.selfIntroduction / 2);
    r.preferences = 'き'.repeat(LIMITS.preferences);
    const body = JSON.stringify(r);
    expect(Buffer.byteLength(body)).toBeLessThan(MAX_BODY_BYTES);
    const res = await handler(event(body));
    expect(res.statusCode).toBe(200);
    const { pages, files } = await attachments(Buffer.from(res.body, 'base64'));
    expect(pages).toBeGreaterThan(3);
    expect(JSON.parse(files.get(EMBEDDED_JSON_NAME)!)).toEqual(r);
  }, 30_000);

  it('Base64でエンコードされた本文も受け付ける', async () => {
    const res = await handler(event(Buffer.from(JSON.stringify(resume())).toString('base64'), { isBase64Encoded: true }));
    expect(res.statusCode).toBe(200);
  });

  describe('拒否', () => {
    it('POST 以外は 405', async () => {
      const res = await handler(event(resume(), { requestContext: { requestId: 'r', http: { method: 'GET' } } }));
      expect(res.statusCode).toBe(405);
    });

    it.each([undefined, 'https://evil.example.com', 'null', 'https://cv.example.jp.evil.com'])('許可していない Origin（%s）は 403', async (origin) => {
      const res = await handler(event(resume(), { headers: { origin } }));
      expect(res.statusCode).toBe(403);
    });

    it('許可リストが空なら、すべて 403', async () => {
      process.env.ALLOWED_ORIGINS = '';
      expect((await handler(event(resume()))).statusCode).toBe(403);
    });

    it('JSON 以外は 415', async () => {
      const res = await handler(event(resume(), { headers: { 'content-type': 'text/plain' } }));
      expect(res.statusCode).toBe(415);
    });

    it('大きすぎる本文は 413', async () => {
      const res = await handler(event('x'.repeat(MAX_BODY_BYTES + 1)));
      expect(res.statusCode).toBe(413);
    });

    it('JSONとして読めなければ 400', async () => {
      expect((await handler(event('{"version":'))).statusCode).toBe(400);
    });

    it('入力チェックに通らなければ 422 とエラー一覧（入力値は含めない）', async () => {
      const r = resume();
      r.personal.email = SECRET;
      const res = await handler(event(r));
      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.errors).toEqual([expect.objectContaining({ path: 'personal.email' })]);
      expect(res.body).not.toContain(SECRET);
    });

    it('画像データなど想定外の項目は 422', async () => {
      const res = await handler(event({ ...resume(), photo: 'data:image/png;base64,iVBORw0KGgo=' }));
      expect(res.statusCode).toBe(422);
    });
  });

  describe('ログ', () => {
    it('成功時も失敗時も、ログに個人情報を出さない', async () => {
      const r = resume();
      r.personal.name = SECRET;
      await handler(event(r));
      await handler(event({ ...r, personal: { ...r.personal, email: SECRET } }));
      await handler(event(`{"name":"${SECRET}"`));
      await handler(event(r, { headers: { origin: 'https://evil.example.com' } }));
      expect(logs.length).toBeGreaterThanOrEqual(4);
      for (const line of logs) {
        expect(line).not.toContain(SECRET);
        expect(line).not.toContain('taro@example.jp');
        expect(() => JSON.parse(line)).not.toThrow();
      }
      expect(logs.map((l) => JSON.parse(l).event)).toEqual([
        'pdf_generation_completed',
        'validation_failed',
        'request_rejected',
        'request_rejected',
      ]);
    });
  });
});

describe('wrapText', () => {
  const measure = (s: string) => s.length * 10;

  it('幅で折り返し、改行を保つ', () => {
    expect(wrapText(measure, 'あいうえおかきくけこ', 50)).toEqual(['あいうえお', 'かきくけこ']);
    expect(wrapText(measure, 'あい\nう', 50)).toEqual(['あい', 'う']);
    expect(wrapText(measure, '', 50)).toEqual(['']);
  });

  it('句読点・閉じ括弧を行頭に置かない', () => {
    expect(wrapText(measure, 'あいうえお、かきくけ', 50)).toEqual(['あいうえお、', 'かきくけ']);
    expect(wrapText(measure, 'あいうえお」。かき', 50)).toEqual(['あいうえお」。', 'かき']);
  });
});
