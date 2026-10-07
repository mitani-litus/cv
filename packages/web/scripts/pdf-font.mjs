// PDF作成用のフォント（Noto Sans JP Regular, TTF）を public/fonts に置く。
// ブラウザでPDFを作るときだけ読み込む。
//   - NotoSansJP-Regular.ttf.gz … gzip で圧縮したもの（約3.3MB）。ブラウザの DecompressionStream で展開する
//   - NotoSansJP-Regular.ttf    … 展開できない古いブラウザ向け（約5.7MB）
// ※ WOFF2 は小さいが、PDFKit（fontkit）が WOFF2 から必要な文字だけを取り出せず、PDF が数十MBになるため使わない。
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'fonts');
const fontPkg = dirname(require.resolve('@expo-google-fonts/noto-sans-jp/package.json'));
const src = join(fontPkg, '400Regular', 'NotoSansJP_400Regular.ttf');
const ttf = join(outDir, 'NotoSansJP-Regular.ttf');
const gz = `${ttf}.gz`;

if (existsSync(gz) && existsSync(ttf) && statSync(gz).mtimeMs >= statSync(src).mtimeMs) process.exit(0);

mkdirSync(outDir, { recursive: true });
copyFileSync(src, ttf);
writeFileSync(gz, gzipSync(readFileSync(src), { level: 9 }));
copyFileSync(join(fontPkg, 'LICENSE_FONT'), join(outDir, 'OFL.txt'));
console.log(`created ${gz}`);
