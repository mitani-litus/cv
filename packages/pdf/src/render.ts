import {
  calcAge,
  CURRENTLY_EMPLOYED_TEXT,
  describeEducation,
  describeEmployment,
  describeQualification,
  formatAddress,
  formatDateJa,
  isCurrentlyEmployed,
  outputGender,
} from '@cv/core';
import type { Resume } from '@cv/schema';
import { create as openFont } from 'fontkit';
import PDFDocument from 'pdfkit';
import { wrapText, type MeasureText } from './text';

/**
 * PDFに埋め込むフォント（Noto Sans JP）。TTF を渡すこと
 * （WOFF2 だと必要な文字だけを取り出せず、フォント全体が埋め込まれて PDF が数十MBになる）。
 * bold を省くと、太字の箇所も regular で描く（ブラウザでは読み込む量を減らすため regular だけを使う）。
 */
export interface PdfFonts {
  regular: Uint8Array;
  bold?: Uint8Array | undefined;
}

/** PDFに添付する履歴書JSONのファイル名（packages/web の取り込み画面と合わせる） */
export const EMBEDDED_JSON_NAME = 'resume.json';

/*
 * 帳票のレイアウト（A4 縦・2ページの固定様式）
 *   1ページ目: 表題・日付、基本情報、学歴・職歴（ROWS_PAGE1 行）
 *   2ページ目: 学歴・職歴の続き（ROWS_PAGE2 行）、免許・資格（ROWS_QUALIFICATION 行）、
 *             志望動機、自己PR、本人希望記入欄
 * 枠の大きさは入力内容によらず同じ。文章は枠に収まるよう文字を小さくする。
 * 行や文章が収まらない場合だけ、3ページ目以降に「別紙」として続きを記載する。
 * 一般的な日本の履歴書（厚生労働省の履歴書様式例など）を参考にしている。
 * 写真欄（空欄。写真は印刷後にはる）と性別欄（記載は任意）は、利用者が選んだときだけ設ける。
 * 写真そのものは扱わない（PDFに埋め込まない）。
 */

// 座標は左上が原点で、下向きに y が増える（pt）
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 40;
const CONTENT_W = 595.28 - MARGIN_X * 2;
const PAGE_BOTTOM = PAGE_H - MARGIN_BOTTOM;

const LINE = '#333333';
const LABEL = '#595959';
const TEXT = '#1a1a1a';
const HEAD_BG = '#f2f2f2';
const ROW_LINE = '#8c8c8c';
const LINE_WIDTH = 0.6;

const BODY = 10.5;
const LABEL_SIZE = 8.5;
const MIN_SIZE = 8;
const LEADING = 1.5;
const PAD = 6;
const LABEL_W = 70;
/** フォントの高さ（Noto Sans JP の上端から下端まで、文字サイズに対する比） */
const FONT_BOX = 1.45;

const COL_YEAR = 46;
const COL_MONTH = 30;
const ROW_H = 24;
const HEAD_H = 20;

/** 1mm（pt） */
const MM = 72 / 25.4;
/** 写真をはる欄（縦40mm×横30mm） */
const PHOTO_W = 30 * MM;
const PHOTO_H = 40 * MM;
const PHOTO_GAP = 10;
const PHOTO_SIZE = 6.5;
const PHOTO_TEXT = [
  '写真をはる位置',
  '',
  '写真をはる必要が',
  'ある場合',
  '1. 縦 36〜40mm',
  '   横 24〜30mm',
  '2. 本人単身胸から上',
  '3. 裏面のりづけ',
];
/** 性別欄（生年月日の行の右側） */
const GENDER_LABEL_W = 34;
const GENDER_VALUE_W = 64;
const GENDER_NOTE = '※性別欄：記載は任意です。未記載とすることも可能です。';

/** 基本情報の各行の高さ */
const KANA_H = 22;
const NAME_H = 48;
const BIRTH_H = 26;

const ROWS_PAGE1 = 21;
const ROWS_PAGE2 = 5;
const ROWS_QUALIFICATION = 5;

type Doc = InstanceType<typeof PDFDocument>;
type FontName = 'regular' | 'bold';

/** 表の1行（年・月・本文） */
interface GridLine {
  year: string;
  month: string;
  text: string;
  align?: 'left' | 'center' | 'right';
}

interface TextSection {
  title: string;
  /** 2ページ目の見出しに添える説明（小さい文字） */
  note?: string;
  text: string;
  height: number;
}

class Writer {
  y = MARGIN_TOP;

  constructor(readonly doc: Doc) {}

  newPage() {
    this.doc.addPage();
    this.y = MARGIN_TOP;
  }

  measure(size: number, font: FontName = 'regular'): MeasureText {
    return (text) => this.doc.font(font).fontSize(size).widthOfString(text);
  }

  /** 1行の文字を、上端 top の位置に描く（折り返さない） */
  text(text: string, x: number, top: number, opts: { size?: number; font?: FontName; color?: string } = {}) {
    if (text === '') return;
    this.doc
      .font(opts.font ?? 'regular')
      .fontSize(opts.size ?? BODY)
      .fillColor(opts.color ?? TEXT)
      .text(text, x, top, { lineBreak: false });
  }

  /** 高さ h の帯の中で、上下中央に1行を描く */
  textInBand(text: string, x: number, top: number, h: number, size = BODY, color = TEXT, font: FontName = 'regular') {
    this.text(text, x, top + (h - size * FONT_BOX) / 2, { size, color, font });
  }

  /** 幅 width・高さ h の枠の中央に1行を描く */
  centered(text: string, x: number, width: number, top: number, h: number, size = BODY, color = TEXT) {
    this.textInBand(text, x + (width - this.measure(size)(text)) / 2, top, h, size, color);
  }

  rect(x: number, top: number, w: number, h: number, fill?: string) {
    this.doc.lineWidth(LINE_WIDTH);
    if (fill) this.doc.rect(x, top, w, h).fillAndStroke(fill, LINE);
    else this.doc.rect(x, top, w, h).stroke(LINE);
  }

  /** 表の行の区切り線（印刷して読みやすいよう、枠より細く薄い実線） */
  rowLine(x: number, top: number, w: number) {
    this.doc.lineWidth(0.4).moveTo(x, top).lineTo(x + w, top).stroke(ROW_LINE);
  }

  vline(x: number, top: number, h: number) {
    this.doc.lineWidth(LINE_WIDTH).moveTo(x, top).lineTo(x, top + h).stroke(LINE);
  }
}

/**
 * 文章が枠（幅 width・高さ height）に収まる文字サイズを探す。
 * 最小の文字サイズでも収まらなければ null。
 */
function fitText(w: Writer, text: string, width: number, height: number, max = BODY): { size: number; lines: string[] } | null {
  for (let size = max; size >= MIN_SIZE; size -= 0.5) {
    const lines = wrapText(w.measure(size), text, width);
    if (lines.length * size * LEADING <= height) return { size, lines };
  }
  return null;
}

/** 1行の文字が幅に収まる文字サイズ（最小でも収まらなければ最小サイズ） */
function fitSize(w: Writer, text: string, width: number, max: number, min = MIN_SIZE): number {
  let size = max;
  while (size > min && w.measure(size)(text) > width) size -= 0.5;
  return size;
}

function drawLines(w: Writer, lines: string[], x: number, top: number, size: number) {
  let y = top + (size * LEADING - size * FONT_BOX) / 2;
  for (const line of lines) {
    w.text(line, x, y, { size });
    y += size * LEADING;
  }
}

/** ラベル列つきの1行（基本情報）。rowW は行全体の幅 */
function labeledRow(w: Writer, label: string, h: number, draw: (x: number, width: number, top: number) => void, rowW = CONTENT_W) {
  const top = w.y;
  w.rect(MARGIN_X, top, rowW, h);
  w.rect(MARGIN_X, top, LABEL_W, h, HEAD_BG);
  w.textInBand(label, MARGIN_X + PAD, top, h, LABEL_SIZE, LABEL);
  draw(MARGIN_X + LABEL_W + PAD, rowW - LABEL_W - PAD * 2, top);
  w.y += h;
}

/** 写真をはる欄（空欄）。案内の文字だけを描く */
function photoBox(w: Writer, x: number, top: number) {
  w.rect(x, top, PHOTO_W, PHOTO_H);
  const lines = PHOTO_TEXT.flatMap((t) => (t === '' ? [''] : wrapText(w.measure(PHOTO_SIZE), t, PHOTO_W - PAD * 2)));
  const blockH = lines.length * PHOTO_SIZE * LEADING;
  let y = top + (PHOTO_H - blockH) / 2;
  lines.forEach((line, i) => {
    // 1行目（写真をはる位置）だけ中央に、案内は左にそろえる
    if (i === 0) w.centered(line, x, PHOTO_W, y, PHOTO_SIZE * LEADING, PHOTO_SIZE, LABEL);
    else w.textInBand(line, x + PAD, y, PHOTO_SIZE * LEADING, PHOTO_SIZE, LABEL);
    y += PHOTO_SIZE * LEADING;
  });
}

/** 基本情報のうち、写真欄の左に並ぶ部分（フリガナ・氏名・生年月日）の高さ */
const NAME_BLOCK_H = KANA_H + NAME_H + BIRTH_H;

function personalBlock(w: Writer, resume: Resume) {
  const p = resume.personal;
  const { photoBox: withPhoto, genderField: withGender } = resume.layout;
  // 写真欄を設けるときは、フリガナ・氏名・生年月日の行を写真欄の左に収める
  const rowW = withPhoto ? CONTENT_W - PHOTO_W - PHOTO_GAP : CONTENT_W;
  if (withPhoto) photoBox(w, MARGIN_X + CONTENT_W - PHOTO_W, w.y + NAME_BLOCK_H - PHOTO_H);

  labeledRow(w, 'フリガナ', KANA_H, (x, width, top) => w.textInBand(p.nameKana, x, top, KANA_H, fitSize(w, p.nameKana, width, 9)), rowW);
  labeledRow(w, '氏名', NAME_H, (x, width, top) => w.textInBand(p.name, x, top, NAME_H, fitSize(w, p.name, width, 20, 10)), rowW);
  const age = calcAge(p.birthDate, resume.createdAt);
  const birth = p.birthDate === '' ? '' : `${formatDateJa(p.birthDate)}生${age === null ? '' : `（満${age}歳）`}`;
  const genderW = withGender ? GENDER_LABEL_W + GENDER_VALUE_W : 0;
  labeledRow(
    w,
    '生年月日',
    BIRTH_H,
    (x, width, top) => {
      w.textInBand(birth, x, top, BIRTH_H, fitSize(w, birth, width - genderW, BODY));
      if (!withGender) return;
      // 性別欄（記載は任意。空欄のままでもよい）
      const gx = MARGIN_X + rowW - genderW;
      const gender = outputGender(resume);
      w.vline(gx, top, BIRTH_H);
      w.rect(gx, top, GENDER_LABEL_W, BIRTH_H, HEAD_BG);
      w.centered('性別', gx, GENDER_LABEL_W, top, BIRTH_H, LABEL_SIZE, LABEL);
      w.centered(gender, gx + GENDER_LABEL_W, GENDER_VALUE_W, top, BIRTH_H, fitSize(w, gender, GENDER_VALUE_W - PAD * 2, BODY, 6));
    },
    rowW,
  );
  const address = [p.postalCode === '' ? '' : `〒${p.postalCode}`, formatAddress(p.address)].filter((s) => s !== '').join('\n');
  labeledRow(w, '現住所', 56, (x, width, top) => {
    const fit = fitText(w, address, width, 56 - PAD * 2) ?? { size: MIN_SIZE, lines: wrapText(w.measure(MIN_SIZE), address, width).slice(0, 4) };
    const blockH = fit.lines.length * fit.size * LEADING;
    drawLines(w, fit.lines, x, top + (56 - blockH) / 2, fit.size);
  });

  // 電話番号・メールアドレス（左右に並べる）
  const h = 26;
  const top = w.y;
  const colW = CONTENT_W / 2;
  (
    [
      ['電話番号', p.phone],
      ['メール', p.email],
    ] as const
  ).forEach(([label, value], i) => {
    const x = MARGIN_X + colW * i;
    w.rect(x, top, colW, h);
    w.rect(x, top, LABEL_W, h, HEAD_BG);
    w.textInBand(label, x + PAD, top, h, LABEL_SIZE, LABEL);
    w.textInBand(value, x + LABEL_W + PAD, top, h, fitSize(w, value, colW - LABEL_W - PAD * 2, BODY, 6));
  });
  w.y += h;

  if (withGender) {
    const size = 7;
    w.text(GENDER_NOTE, MARGIN_X + CONTENT_W - w.measure(size)(GENDER_NOTE), w.y + 3, { size, color: LABEL });
  }
}

/** 学歴・職歴などを、表の行（1行の高さは固定）に並べる。長い本文は次の行に続ける */
function toGridLines(w: Writer, rows: GridLine[]): GridLine[] {
  const width = CONTENT_W - COL_YEAR - COL_MONTH - PAD * 2;
  return rows.flatMap((row) => {
    const wrapped = wrapText(w.measure(BODY), row.text, width);
    return wrapped.map((text, i) => ({ ...row, year: i === 0 ? row.year : '', month: i === 0 ? row.month : '', text }));
  });
}

/** 年・月・本文の表を、固定の行数で描く（行が足りなければ空行のまま） */
function gridTable(w: Writer, title: string, lines: GridLine[], rows: number) {
  const top = w.y;
  const textX = MARGIN_X + COL_YEAR + COL_MONTH;
  const textW = CONTENT_W - COL_YEAR - COL_MONTH;
  const h = HEAD_H + ROW_H * rows;
  // 見出し
  w.rect(MARGIN_X, top, CONTENT_W, HEAD_H, HEAD_BG);
  w.centered('年', MARGIN_X, COL_YEAR, top, HEAD_H, LABEL_SIZE, LABEL);
  w.centered('月', MARGIN_X + COL_YEAR, COL_MONTH, top, HEAD_H, LABEL_SIZE, LABEL);
  w.centered(title, textX, textW, top, HEAD_H, LABEL_SIZE, LABEL);
  // 罫線
  w.rect(MARGIN_X, top, CONTENT_W, h);
  w.vline(MARGIN_X + COL_YEAR, top, h);
  w.vline(textX, top, h);
  for (let i = 1; i < rows; i++) w.rowLine(MARGIN_X, top + HEAD_H + ROW_H * i, CONTENT_W);
  // 中身
  lines.slice(0, rows).forEach((line, i) => {
    const rowTop = top + HEAD_H + ROW_H * i;
    w.centered(line.year, MARGIN_X, COL_YEAR, rowTop, ROW_H);
    w.centered(line.month, MARGIN_X + COL_YEAR, COL_MONTH, rowTop, ROW_H);
    const lw = w.measure(BODY)(line.text);
    const x = line.align === 'center' ? textX + (textW - lw) / 2 : line.align === 'right' ? textX + textW - PAD * 3 - lw : textX + PAD;
    w.textInBand(line.text, x, rowTop, ROW_H);
  });
  w.y += h;
}

/**
 * 見出し付きの文章欄。収まれば描いて null を、最小の文字でも収まらなければ「別紙のとおり」と書いて
 * 全文を返す（別紙に記載する）。
 */
function textSection(w: Writer, section: TextSection): string | null {
  const top = w.y;
  w.rect(MARGIN_X, top, CONTENT_W, HEAD_H, HEAD_BG);
  w.textInBand(section.title, MARGIN_X + PAD, top, HEAD_H, LABEL_SIZE, LABEL);
  if (section.note) {
    w.textInBand(section.note, MARGIN_X + PAD + w.measure(LABEL_SIZE)(section.title) + 8, top, HEAD_H, 7, LABEL);
  }
  const boxTop = top + HEAD_H;
  const boxH = section.height - HEAD_H;
  w.rect(MARGIN_X, boxTop, CONTENT_W, boxH);
  w.y += section.height;
  const fit = fitText(w, section.text, CONTENT_W - PAD * 2, boxH - PAD * 2);
  if (fit) {
    drawLines(w, fit.lines, MARGIN_X + PAD, boxTop + PAD, fit.size);
    return null;
  }
  w.text('別紙のとおり', MARGIN_X + PAD, boxTop + PAD);
  return section.text;
}

/** 別紙：入りきらなかった表の行と文章を、ページをまたいで続けて記載する */
function appendix(w: Writer, overflows: { title: string; lines?: GridLine[]; text?: string }[]) {
  if (overflows.length === 0) return;
  w.newPage();
  w.text('別紙', MARGIN_X, w.y, { size: 14, font: 'bold' });
  w.y += 30;
  for (const item of overflows) {
    if (item.lines) {
      let rest = item.lines;
      while (rest.length > 0) {
        const fit = Math.floor((PAGE_BOTTOM - w.y - HEAD_H) / ROW_H);
        if (fit < 2) {
          w.newPage();
          continue;
        }
        const count = Math.min(fit, rest.length);
        gridTable(w, item.title, rest, count);
        rest = rest.slice(count);
        w.y += 14;
      }
    }
    if (item.text !== undefined) {
      const lines = wrapText(w.measure(BODY), item.text, CONTENT_W - PAD * 2);
      let index = 0;
      while (index < lines.length) {
        const fit = Math.floor((PAGE_BOTTOM - w.y - HEAD_H - PAD * 2) / (BODY * LEADING));
        if (fit < 3) {
          w.newPage();
          continue;
        }
        const chunk = lines.slice(index, index + fit);
        const h = HEAD_H + chunk.length * BODY * LEADING + PAD * 2;
        w.rect(MARGIN_X, w.y, CONTENT_W, HEAD_H, HEAD_BG);
        w.textInBand(index === 0 ? item.title : `${item.title}（続き）`, MARGIN_X + PAD, w.y, HEAD_H, LABEL_SIZE, LABEL);
        w.rect(MARGIN_X, w.y + HEAD_H, CONTENT_W, h - HEAD_H);
        drawLines(w, chunk, MARGIN_X + PAD, w.y + HEAD_H + PAD, BODY);
        w.y += h + 14;
        index += chunk.length;
      }
    }
  }
}

function entryLines<T extends { year: number | null; month: number | null }>(items: T[], describe: (item: T) => string): GridLine[] {
  return items
    .map((item) => ({ year: item.year === null ? '' : String(item.year), month: item.month === null ? '' : String(item.month), text: describe(item) }))
    .filter((r) => r.year !== '' || r.month !== '' || r.text !== '');
}

function toBytes(doc: Doc): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    doc.on('end', () => {
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      resolve(out);
    });
    doc.on('error', reject);
  });
}

/**
 * 履歴書PDFを作る（A4・2ページの固定様式）。ブラウザでも Node.js（Lambda）でも動く。
 * 履歴書JSONを添付ファイル（resume.json）として埋め込み、取り込み画面でCSVにできるようにする。
 * 処理はすべてメモリ上で行い、ファイルには書き出さない。
 */
export async function renderResumePdf(resume: Resume, fonts: PdfFonts, now = new Date()): Promise<Uint8Array> {
  // フォントは一度だけ解析して使い回す
  // fontkit の型定義は Node.js の Buffer を求めるが、Uint8Array で動く
  type FontSource = Parameters<typeof openFont>[0];
  const regular = openFont(fonts.regular as FontSource);
  const bold = fonts.bold ? openFont(fonts.bold as FontSource) : regular;
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    lang: 'ja-JP',
    // 既定のフォント（Helvetica）は使わない。ブラウザ版には含まれないため
    font: regular as unknown as string,
    // 文書情報には個人情報を入れない
    info: { Title: '履歴書', Creator: '履歴書データ化（cv）', Producer: 'PDFKit', CreationDate: now, ModDate: now },
    displayTitle: true,
  });
  const output = toBytes(doc);
  // 使った文字だけを埋め込む（サブセット化）
  doc.registerFont('regular', regular as unknown as string);
  doc.registerFont('bold', bold as unknown as string);
  const w = new Writer(doc);

  // ---------- 1ページ目 ----------
  w.text('履 歴 書', MARGIN_X, w.y, { size: 20, font: 'bold' });
  const dateText = `${formatDateJa(resume.createdAt)}現在`;
  // 写真欄を設けるときは、日付を写真欄の左に置く
  const dateRight = MARGIN_X + CONTENT_W - (resume.layout.photoBox ? PHOTO_W + PHOTO_GAP : 0);
  w.text(dateText, dateRight - w.measure(BODY)(dateText), w.y + 10);
  w.y += 38;
  personalBlock(w, resume);
  w.y += 16;

  const education = entryLines(resume.education, describeEducation);
  const employment = entryLines(resume.employment, describeEmployment);
  const none: GridLine = { year: '', month: '', text: 'なし', align: 'center' };
  const history = toGridLines(w, [
    { year: '', month: '', text: '学歴', align: 'center' },
    ...(education.length > 0 ? education : [none]),
    { year: '', month: '', text: '職歴', align: 'center' },
    ...(employment.length > 0 ? employment : [none]),
    ...(isCurrentlyEmployed(resume.employment) ? [{ year: '', month: '', text: CURRENTLY_EMPLOYED_TEXT }] : []),
    { year: '', month: '', text: '以上', align: 'right' as const },
  ]);
  gridTable(w, '学歴・職歴', history, ROWS_PAGE1);

  // ---------- 2ページ目 ----------
  w.newPage();
  gridTable(w, '学歴・職歴（続き）', history.slice(ROWS_PAGE1), ROWS_PAGE2);
  w.y += 14;
  const qualifications = toGridLines(w, entryLines(resume.qualifications, describeQualification));
  gridTable(w, '免許・資格', qualifications, ROWS_QUALIFICATION);
  w.y += 14;

  const overflowTexts: { title: string; text: string }[] = [];
  const sections: TextSection[] = [
    { title: '志望動機', text: resume.motivation, height: 148 },
    { title: '自己PR', text: resume.selfIntroduction, height: 148 },
    { title: '本人希望記入欄', note: '特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入', text: resume.preferences, height: 120 },
  ];
  sections.forEach((section, i) => {
    if (i > 0) w.y += 12;
    const overflow = textSection(w, section);
    if (overflow !== null) overflowTexts.push({ title: section.title, text: overflow });
  });

  // ---------- 別紙（入りきらなかった場合だけ） ----------
  const historyRest = history.slice(ROWS_PAGE1 + ROWS_PAGE2);
  const qualificationRest = qualifications.slice(ROWS_QUALIFICATION);
  appendix(w, [
    ...(historyRest.length > 0 ? [{ title: '学歴・職歴（続き）', lines: historyRest }] : []),
    ...(qualificationRest.length > 0 ? [{ title: '免許・資格（続き）', lines: qualificationRest }] : []),
    ...overflowTexts,
  ]);

  // 取り込み用の履歴書JSON
  doc.file(new TextEncoder().encode(JSON.stringify(resume)) as unknown as string, {
    name: EMBEDDED_JSON_NAME,
    type: 'application/json',
    description: '履歴書データ（JSON）',
    creationDate: now,
    modifiedDate: now,
  });

  doc.end();
  return output;
}
