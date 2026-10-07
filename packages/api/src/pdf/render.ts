import {
  calcAge,
  describeEducation,
  describeEmployment,
  describeQualification,
  formatAddress,
  formatDateJa,
} from '@cv/core';
import type { Resume } from '@cv/schema';
import PDFDocument from 'pdfkit';
import type { FontBytes } from '../fonts';
import { wrapText, type MeasureText } from './text';

/** PDFに添付する履歴書JSONのファイル名（packages/web の取り込み画面と合わせる） */
export const EMBEDDED_JSON_NAME = 'resume.json';

// A4（pt）。座標は左上が原点で、下向きに y が増える
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const PAGE_BOTTOM = PAGE_H - MARGIN_BOTTOM;

const LINE = '#333333';
const LABEL = '#595959';
const TEXT = '#1a1a1a';
const HEAD_BG = '#f2f2f2';
const LINE_WIDTH = 0.6;

const BODY = 10.5;
const LABEL_SIZE = 9;
const LEADING = 1.55;
const PAD = 6;
const LABEL_W = 72;

/** 年・月・本文の3列の表（学歴・職歴、資格・免許） */
const COL_YEAR = 48;
const COL_MONTH = 30;
const ROW_MIN = 26;
const HEAD_H = 22;

type Doc = InstanceType<typeof PDFDocument>;
type FontName = 'regular' | 'bold';

interface HistoryRow {
  year: string;
  month: string;
  text: string;
  align?: 'left' | 'center' | 'right';
}

function lineHeight(size: number) {
  return size * LEADING;
}

/** ページと縦位置を管理し、入りきらなければ次のページへ送る */
class Writer {
  y = MARGIN_TOP;

  constructor(readonly doc: Doc) {}

  /** 高さ h が入らなければ改ページする。改ページしたら true */
  ensure(h: number): boolean {
    if (this.y + h <= PAGE_BOTTOM) return false;
    this.doc.addPage();
    this.y = MARGIN_TOP;
    return true;
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

  /** 幅 width の中で、上下中央にそろえて1行を描く */
  centeredText(text: string, x: number, width: number, top: number, h: number, size = BODY, color = TEXT) {
    const w = this.measure(size)(text);
    this.text(text, x + (width - w) / 2, top + (h - size * 1.45) / 2, { size, color });
  }

  rect(x: number, top: number, w: number, h: number, fill?: string) {
    this.doc.lineWidth(LINE_WIDTH);
    if (fill) this.doc.rect(x, top, w, h).fillAndStroke(fill, LINE);
    else this.doc.rect(x, top, w, h).stroke(LINE);
  }

  vline(x: number, top: number, h: number) {
    this.doc.lineWidth(LINE_WIDTH).moveTo(x, top).lineTo(x, top + h).stroke(LINE);
  }
}

/** ラベル列と値の列がある1行。値は折り返す */
function labeledRow(w: Writer, label: string, value: string, opts: { minHeight: number; size?: number }) {
  const size = opts.size ?? BODY;
  const lines = wrapText(w.measure(size), value, CONTENT_W - LABEL_W - PAD * 2);
  const blockH = lines.length * lineHeight(size);
  const h = Math.max(opts.minHeight, blockH + PAD * 2);
  w.ensure(h);
  const top = w.y;
  w.rect(MARGIN_X, top, CONTENT_W, h);
  w.rect(MARGIN_X, top, LABEL_W, h, HEAD_BG);
  w.text(label, MARGIN_X + PAD, top + (h - LABEL_SIZE * 1.45) / 2, { size: LABEL_SIZE, color: LABEL });
  let y = top + (h - blockH) / 2 + (lineHeight(size) - size * 1.45) / 2;
  for (const line of lines) {
    w.text(line, MARGIN_X + LABEL_W + PAD, y, { size });
    y += lineHeight(size);
  }
  w.y += h;
}

/** 2つの項目を左右に並べた1行（電話番号・メールアドレス）。長い値は文字を小さくして収める */
function splitRow(w: Writer, items: [string, string][], h: number) {
  w.ensure(h);
  const top = w.y;
  const colW = CONTENT_W / items.length;
  items.forEach(([label, value], i) => {
    const x = MARGIN_X + colW * i;
    w.rect(x, top, colW, h);
    w.rect(x, top, LABEL_W, h, HEAD_BG);
    w.text(label, x + PAD, top + (h - LABEL_SIZE * 1.45) / 2, { size: LABEL_SIZE, color: LABEL });
    const max = colW - LABEL_W - PAD * 2;
    let size = BODY;
    while (size > 6 && w.measure(size)(value) > max) size -= 0.5;
    w.text(value, x + LABEL_W + PAD, top + (h - size * 1.45) / 2, { size });
  });
  w.y += h;
}

function historyHeader(w: Writer, title: string) {
  const top = w.y;
  w.rect(MARGIN_X, top, CONTENT_W, HEAD_H, HEAD_BG);
  w.vline(MARGIN_X + COL_YEAR, top, HEAD_H);
  w.vline(MARGIN_X + COL_YEAR + COL_MONTH, top, HEAD_H);
  w.centeredText('年', MARGIN_X, COL_YEAR, top, HEAD_H, LABEL_SIZE, LABEL);
  w.centeredText('月', MARGIN_X + COL_YEAR, COL_MONTH, top, HEAD_H, LABEL_SIZE, LABEL);
  w.centeredText(title, MARGIN_X + COL_YEAR + COL_MONTH, CONTENT_W - COL_YEAR - COL_MONTH, top, HEAD_H, LABEL_SIZE, LABEL);
  w.y += HEAD_H;
}

/** 年・月・本文の表。ページをまたぐときは見出し行をくり返す */
function historyTable(w: Writer, title: string, rows: HistoryRow[]) {
  const textX = MARGIN_X + COL_YEAR + COL_MONTH;
  const textW = CONTENT_W - COL_YEAR - COL_MONTH;
  const measure = w.measure(BODY);
  w.ensure(HEAD_H + ROW_MIN);
  historyHeader(w, title);
  for (const row of rows) {
    const lines = wrapText(measure, row.text, textW - PAD * 2);
    const h = Math.max(ROW_MIN, lines.length * lineHeight(BODY) + PAD * 2);
    if (w.ensure(h)) historyHeader(w, title);
    const top = w.y;
    w.rect(MARGIN_X, top, CONTENT_W, h);
    w.vline(MARGIN_X + COL_YEAR, top, h);
    w.vline(textX, top, h);
    const firstLineTop = top + (h - lines.length * lineHeight(BODY)) / 2;
    w.centeredText(row.year, MARGIN_X, COL_YEAR, firstLineTop, lineHeight(BODY));
    w.centeredText(row.month, MARGIN_X + COL_YEAR, COL_MONTH, firstLineTop, lineHeight(BODY));
    let y = firstLineTop + (lineHeight(BODY) - BODY * 1.45) / 2;
    for (const line of lines) {
      const lw = measure(line);
      const x = row.align === 'center' ? textX + (textW - lw) / 2 : row.align === 'right' ? textX + textW - PAD * 2 - lw : textX + PAD;
      w.text(line, x, y);
      y += lineHeight(BODY);
    }
    w.y += h;
  }
}

/** 見出し付きの文章欄（志望動機など）。長い文章はページをまたいで続ける */
function textBox(w: Writer, title: string, text: string, minLines: number) {
  const lines = wrapText(w.measure(BODY), text, CONTENT_W - PAD * 2);
  while (lines.length < minLines) lines.push('');
  let index = 0;
  while (index < lines.length) {
    w.ensure(HEAD_H + lineHeight(BODY) * Math.min(3, lines.length - index) + PAD * 2);
    w.rect(MARGIN_X, w.y, CONTENT_W, HEAD_H, HEAD_BG);
    w.text(index === 0 ? title : `${title}（続き）`, MARGIN_X + PAD, w.y + (HEAD_H - LABEL_SIZE * 1.45) / 2, { size: LABEL_SIZE, color: LABEL });
    w.y += HEAD_H;
    const available = Math.max(1, Math.floor((PAGE_BOTTOM - w.y - PAD * 2) / lineHeight(BODY)));
    const chunk = lines.slice(index, index + available);
    const h = chunk.length * lineHeight(BODY) + PAD * 2;
    w.rect(MARGIN_X, w.y, CONTENT_W, h);
    let y = w.y + PAD + (lineHeight(BODY) - BODY * 1.45) / 2;
    for (const line of chunk) {
      w.text(line, MARGIN_X + PAD, y);
      y += lineHeight(BODY);
    }
    w.y += h;
    index += chunk.length;
  }
}

function historyRows<T extends { year: number | null; month: number | null }>(items: T[], describe: (item: T) => string): HistoryRow[] {
  return items
    .map((item) => ({ year: item.year === null ? '' : String(item.year), month: item.month === null ? '' : String(item.month), text: describe(item) }))
    .filter((r) => r.year !== '' || r.month !== '' || r.text !== '');
}

function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * 履歴書PDFを作る。顔写真欄・性別欄は設けない。
 * 履歴書JSONを添付ファイル（resume.json）として埋め込み、取り込み画面でCSVにできるようにする。
 * 処理はすべてメモリ上で行い、ファイルには書き出さない。
 */
export async function renderResumePdf(resume: Resume, fonts: FontBytes, now = new Date()): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    lang: 'ja-JP',
    // 文書情報には個人情報を入れない
    info: { Title: '履歴書', Creator: '履歴書データ化（cv）', Producer: 'PDFKit', CreationDate: now, ModDate: now },
    displayTitle: true,
  });
  const output = toBuffer(doc);
  // 使った文字だけを埋め込む（サブセット化）
  doc.registerFont('regular', Buffer.from(fonts.regular));
  doc.registerFont('bold', Buffer.from(fonts.bold));

  const w = new Writer(doc);
  const p = resume.personal;

  // 表題と日付
  w.text('履 歴 書', MARGIN_X, w.y, { size: 20, font: 'bold' });
  const dateText = `${formatDateJa(resume.createdAt)}現在`;
  w.text(dateText, MARGIN_X + CONTENT_W - w.measure(BODY)(dateText), w.y + 8);
  w.y += 40;

  // 基本情報
  labeledRow(w, 'フリガナ', p.nameKana, { minHeight: 22, size: 9 });
  labeledRow(w, '氏名', p.name, { minHeight: 46, size: 18 });
  const age = calcAge(p.birthDate, resume.createdAt);
  const birth = p.birthDate === '' ? '' : `${formatDateJa(p.birthDate)}生${age === null ? '' : `（満${age}歳）`}`;
  labeledRow(w, '生年月日', birth, { minHeight: 26 });
  const address = [p.postalCode === '' ? '' : `〒${p.postalCode}`, formatAddress(p.address)].filter((s) => s !== '').join('\n');
  labeledRow(w, '現住所', address, { minHeight: 48 });
  splitRow(
    w,
    [
      ['電話番号', p.phone],
      ['メール', p.email],
    ],
    26,
  );
  w.y += 18;

  // 学歴・職歴
  const none: HistoryRow = { year: '', month: '', text: 'なし', align: 'center' };
  const educationRows = historyRows(resume.education, describeEducation);
  const employmentRows = historyRows(resume.employment, describeEmployment);
  historyTable(w, '学歴・職歴', [
    { year: '', month: '', text: '学歴', align: 'center' },
    ...(educationRows.length > 0 ? educationRows : [none]),
    { year: '', month: '', text: '職歴', align: 'center' },
    ...(employmentRows.length > 0 ? employmentRows : [none]),
    { year: '', month: '', text: '以上', align: 'right' },
  ]);
  w.y += 18;

  // 資格・免許
  const qualificationRows = historyRows(resume.qualifications, describeQualification);
  historyTable(w, '資格・免許', qualificationRows.length > 0 ? qualificationRows : [none]);
  w.y += 18;

  // 志望動機・自己PR・本人希望
  textBox(w, '志望動機', resume.motivation, 4);
  w.y += 12;
  textBox(w, '自己PR', resume.selfIntroduction, 4);
  w.y += 12;
  textBox(w, '本人希望', resume.preferences, 2);

  // 取り込み用の履歴書JSON
  doc.file(Buffer.from(JSON.stringify(resume), 'utf8'), {
    name: EMBEDDED_JSON_NAME,
    type: 'application/json',
    description: '履歴書データ（JSON）',
    creationDate: now,
    modifiedDate: now,
  });

  doc.end();
  return output;
}
