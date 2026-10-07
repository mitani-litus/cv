/** ひらがなをカタカナにする（フリガナ欄の入力補助） */
export function toKatakana(value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
