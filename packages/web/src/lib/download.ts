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

/**
 * 保存するファイル名。日本語のファイル名は、ブラウザによっては無視されて "download" などになるため、
 * 英数字にしている。ファイル名には個人情報（氏名など）を含めない。
 */
export const FILE_NAMES = {
  pdf: 'resume.pdf',
  csvZip: 'resume-csv.zip',
  json: 'resume.json',
} as const;
