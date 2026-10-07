/**
 * 電話番号を E.164 形式（例: +81345007765）にそろえる（CSV用）。
 * - "+" で始まる番号は、記号と空白を除いて数字だけにする
 * - "0" で始まる国内の番号は、先頭の 0 を国番号 +81 に置き換える
 * - それ以外（想定外の形）は入力どおり返す
 * PDF には入力どおりに記載する。
 */
export function toE164(phone: string): string {
  const v = phone.trim();
  const digits = v.replace(/\D/g, '');
  if (v.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+81${digits.slice(1)}`;
  return v;
}
