import { toCsv } from '@cv/core';
import type { Resume } from '@cv/schema';
import { downloadBlob, FILE_NAMES } from './download';

export function downloadJson(resume: Resume): void {
  downloadBlob(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), FILE_NAMES.json);
}

export function downloadCsv(resume: Resume): void {
  // toCsv は先頭に BOM を含む（Excel で文字化けしないように）
  downloadBlob(new Blob([toCsv(resume)], { type: 'text/csv;charset=utf-8' }), FILE_NAMES.csv);
}
