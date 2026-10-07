import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ローカル開発では /api を PDF生成API（docker compose の api コンテナ）へ転送する。
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:9000';

export default defineConfig({
  plugins: [react()],
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
  },
});
