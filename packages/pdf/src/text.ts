/** 文字列の幅（pt）を返す関数 */
export type MeasureText = (text: string) => number;

/** 行頭に置かない文字（句読点・閉じ括弧など）。行末にぶら下げる */
const NO_LINE_START = new Set([...'、。，．,.・：；:;？！?!）」』】〕〉》｝)]}ーゝゞヽヾ々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ']);

/**
 * 文字列を指定の幅で折り返す。日本語は1文字単位で折り返す。
 * 句読点や閉じ括弧は行頭に来ないよう、前の行の末尾にぶら下げる。
 * 改行はそのまま行の区切りにする。
 */
export function wrapText(measure: MeasureText, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    let width = 0;
    for (const ch of paragraph) {
      const w = measure(ch);
      if (width + w > maxWidth && line !== '' && !NO_LINE_START.has(ch)) {
        lines.push(line);
        line = '';
        width = 0;
      }
      line += ch;
      width += w;
    }
    lines.push(line);
  }
  return lines;
}
