/**
 * 全角の数字・ハイフン類を半角にそろえる（郵便番号・電話番号・年月の入力用）。
 * 入力チェックの前に、ブラウザ側で値を整えるために使う。
 */
export function toHalfWidthDigits(value: string): string {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－−‐‑–—ー―]/g, '-')
    .replace(/＋/g, '+')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}
