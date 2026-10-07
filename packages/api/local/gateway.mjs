// ローカル開発用の小さなHTTPサーバー。
// API Gateway の代わりに、HTTPリクエストを Lambda のイベント（HTTP API ペイロード 2.0）に変換して渡す。
//
// - docker compose では、Lambda コンテナ（AWS 公式の Runtime Interface Emulator）へ転送する
//     LAMBDA_INVOKE_URL=http://api-lambda:8080/2015-03-31/functions/function/invocations node local/gateway.mjs
// - npm run dev:api では、同じプロセスの中で handler を呼ぶ（src/local/dev-server.ts）
//
// 依存パッケージを使わないプレーンな JavaScript にしている（コンテナでそのまま動かすため）。
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BYTES = 256 * 1024;

/** @param {(event: object) => Promise<{statusCode:number, headers?:Record<string,string>, body?:string, isBase64Encoded?:boolean}>} invoke */
export function createGateway(invoke) {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/pdf') {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"not_found"}');
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json' }).end('{"error":"payload_too_large"}');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (res.writableEnded) return;
      /** @type {Record<string,string>} */
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k.toLowerCase()] = v;
      const event = {
        version: '2.0',
        rawPath: url.pathname,
        headers,
        requestContext: { requestId: randomUUID(), http: { method: req.method, path: url.pathname } },
        body: Buffer.concat(chunks).toString('base64'),
        isBase64Encoded: true,
      };
      try {
        const result = await invoke(event);
        const body = result.isBase64Encoded ? Buffer.from(result.body ?? '', 'base64') : Buffer.from(result.body ?? '', 'utf8');
        res.writeHead(result.statusCode, result.headers ?? {}).end(body);
      } catch {
        res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"bad_gateway"}');
      }
    });
  });
}

/** Lambda の Runtime Interface Emulator を呼ぶ */
export function invokeViaEmulator(invokeUrl) {
  return async (event) => {
    const res = await fetch(invokeUrl, { method: 'POST', body: JSON.stringify(event) });
    return res.json();
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const invokeUrl = process.env.LAMBDA_INVOKE_URL;
  if (!invokeUrl) {
    console.error('LAMBDA_INVOKE_URL を設定してください');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 9000);
  createGateway(invokeViaEmulator(invokeUrl)).listen(port, () => console.log(`gateway listening on :${port}`));
}
