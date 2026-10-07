import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

export interface FontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
}

const FILES = {
  regular: '400Regular/NotoSansJP_400Regular.ttf',
  bold: '700Bold/NotoSansJP_700Bold.ttf',
} as const;

let cache: FontBytes | undefined;

/**
 * Noto Sans JP（SIL Open Font License 1.1）を読み込む。
 * Lambda では FONT_DIR（イメージ内の読み取り専用領域）から、開発時は node_modules から読む。
 * 一度読んだら、同じ実行環境では使い回す（履歴書データではないので保持してよい）。
 */
export function loadFonts(): FontBytes {
  if (cache) return cache;
  const dir = process.env.FONT_DIR;
  // 開発時は作業ディレクトリから node_modules をたどって探す（Lambda 用のビルドでは使わない）
  const resolve = (file: string) =>
    dir ? join(dir, file.split('/')[1]!) : createRequire(join(process.cwd(), 'index.js')).resolve(`@expo-google-fonts/noto-sans-jp/${file}`);
  cache = {
    regular: readFileSync(resolve(FILES.regular)),
    bold: readFileSync(resolve(FILES.bold)),
  };
  return cache;
}

export const FONT_FILES = FILES;
