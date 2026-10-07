// npm run dev:api：Docker を使わずに、同じプロセスで handler を動かす開発用サーバー
import { createGateway } from '../../local/gateway.mjs';
import { handler, type HttpEvent } from '../handler';

process.env.ALLOWED_ORIGINS ??= 'http://localhost:5173';
const port = Number(process.env.PORT ?? 9000);
createGateway((event) => handler(event as HttpEvent)).listen(port, () => {
  console.log(`api dev server listening on :${port} (allowed origins: ${process.env.ALLOWED_ORIGINS})`);
});
