/** Blob をファイルとして保存させる。データはこの端末の中だけで扱う */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // ダウンロードの開始を待ってから解放する
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const FILE_NAMES = {
  pdf: '履歴書.pdf',
  csv: '履歴書.csv',
  json: '履歴書.json',
} as const;
