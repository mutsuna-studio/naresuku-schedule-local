import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import {resolve} from 'node:path';
import {createLocalApi, localHosts} from './local/api.mjs';

export default defineConfig(({command, isPreview}) => {
  if (command !== 'serve' || isPreview) throw new Error('ローカル検証専用です。npm run dev を使用してください。');
  const handle = createLocalApi();
  return {
    envPrefix: 'LOCAL_DEMO_PUBLIC_',
    server: {host: '127.0.0.1', port: 5173, strictPort: true, cors: false, allowedHosts: ['localhost']},
    resolve: {alias: {'@': resolve(import.meta.dirname)}},
    plugins: [svelte(), tailwindcss(), {
      name: 'local-demo',
      configureServer(server) {
        if (!['127.0.0.1', 'localhost', '::1'].includes(String(server.config.server.host))) throw new Error('ループバックアドレスを指定してください。');
        server.middlewares.use(async (req, res, next) => {
          let url: URL;
          try { url = new URL(req.url || '/', `http://${req.headers.host}`); }
          catch { res.statusCode = 400; res.end(); return; }
          if (!localHosts.has(url.hostname) || (req.headers.origin && req.headers.origin !== url.origin) || req.headers['sec-fetch-site'] === 'cross-site') {
            res.statusCode = 403; res.end('Local requests only'); return;
          }
          res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws://127.0.0.1:5173 ws://localhost:5173; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
          if (!url.pathname.startsWith('/api/')) return next();
          try {
            const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 2_000_000) { res.statusCode = 413; res.end('Payload too large'); return; }
              chunks.push(Buffer.from(chunk));
            }
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(name, value);
            const method = req.method || 'GET';
            const request = new Request(url, {method, headers, ...(!['GET', 'HEAD'].includes(method) ? {body: Buffer.concat(chunks)} : {})});
            const response = await handle(request);
            res.statusCode = response.status;
            response.headers.forEach((value, name) => res.setHeader(name, value));
            res.end(await response.text());
          } catch { res.statusCode = 400; res.end(JSON.stringify({error: 'リクエストを確認してください'})); }
        });
      },
    }],
  };
});
