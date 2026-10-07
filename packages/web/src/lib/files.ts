import { toCsvZip } from '@cv/core';
import type { Resume } from '@cv/schema';
import { downloadBlob, FILE_NAMES } from './download';

export function downloadJson(resume: Resume): void {
  downloadBlob(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), FILE_NAMES.json);
}

/** CSV（resume.csv・education.csv・work.csv）を1つのZIPにまとめて保存させる */
export function downloadCsv(resume: Resume): void {
  downloadBlob(new Blob([toCsvZip(resume)], { type: 'application/zip' }), FILE_NAMES.csvZip);
}
