// Lambda 用にビルドする：ソースを1つのファイルにまとめ、フォントを同梱する
import { build } from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = 'dist';
rmSync(out, { recursive: true, force: true });

await build({
  entryPoints: ['src/handler.ts'],
  outfile: join(out, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  // PDFKit が __dirname を使うため CommonJS で出力する
  format: 'cjs',
  minify: false,
  sourcemap: false,
  legalComments: 'external',
  logLevel: 'warning',
  // PDFKit は CommonJS 版を使う（ESM 版は import.meta.url で補助データを探すため、まとめると壊れる）
  alias: { pdfkit: require.resolve('pdfkit') },
});

// dist は CommonJS として読み込ませる（Lambda のタスクルートにそのままコピーする）。
// PDFKit は標準フォントの寸法を "#standard-fonts/*" から実行時に読み込むため、その対応表も置く
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify({ type: 'commonjs', imports: { '#standard-fonts/*': './standard-fonts/*.cjs' } }, null, 2) + '\n',
);
cpSync(join(dirname(require.resolve('pdfkit')), 'standard-fonts'), join(out, 'standard-fonts'), {
  recursive: true,
  filter: (src) => !src.endsWith('.mjs'),
});

// PDFKit の補助データ（標準フォントの寸法、色プロファイル）
const pdfkitData = join(dirname(require.resolve('pdfkit')), 'data');
mkdirSync(join(out, 'data'), { recursive: true });
for (const file of ['sRGB_IEC61966_2_1.icc']) {
  try {
    copyFileSync(join(pdfkitData, file), join(out, 'data', file));
  } catch {
    // 古い版にはないため無視する
  }
}

// Noto Sans JP（SIL Open Font License 1.1）。Lambda では FONT_DIR から読む
const fontPkg = dirname(require.resolve('@expo-google-fonts/noto-sans-jp/package.json'));
mkdirSync(join(out, 'fonts'), { recursive: true });
for (const file of ['400Regular/NotoSansJP_400Regular.ttf', '700Bold/NotoSansJP_700Bold.ttf']) {
  copyFileSync(join(fontPkg, file), join(out, 'fonts', file.split('/')[1]));
}
copyFileSync(join(fontPkg, 'LICENSE_FONT'), join(out, 'fonts', 'OFL.txt'));
console.log('built', out);
