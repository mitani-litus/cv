import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// ローカル開発では /api を PDF生成API（docker compose の gateway）へ転送する。
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:9000';

/**
 * 本番ビルドの index.html に Content-Security-Policy を <meta> で入れる。
 * GitHub Pages では HTTP ヘッダーを設定できないため。
 * （AWS 構成では CloudFront も同じ内容のヘッダーを付ける。<meta> では frame-ancestors は効かない）
 */
function contentSecurityPolicy(adUrl: string): Plugin {
  const frameSrc = adUrl ? new URL(adUrl).origin : "'none'";
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    `frame-src ${frameSrc}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return {
    name: 'cv-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  };
}

/**
 * 画面のURL（/form、/import）を直接開いても表示できるよう、index.html を各パスにも置く。
 * GitHub Pages のような静的ホスティングには、アプリ側でURLを振り分ける仕組みがないため。
 * 404.html も置き、それ以外のURLでもトップページを表示する。
 */
function staticRoutes(routes: string[]): Plugin {
  let outDir = 'dist';
  return {
    name: 'cv-static-routes',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const index = join(outDir, 'index.html');
      for (const route of routes) {
        mkdirSync(join(outDir, route), { recursive: true });
        copyFileSync(index, join(outDir, route, 'index.html'));
      }
      copyFileSync(index, join(outDir, '404.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_AD_URL ?? ''), staticRoutes(['form', 'import'])],
    // 公開するパス（GitHub Pages の独自ドメインや CloudFront ではルート）
    base: env.VITE_BASE ?? '/',
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false },
      },
    },
    build: {
      // ソースマップは公開しない（必要なら開発時に生成する）
      sourcemap: false,
      // pdf.js と PDFKit は、使う画面・操作のときだけ読み込む別のファイルにしている
      chunkSizeWarningLimit: 1500,
    },
  };
});
