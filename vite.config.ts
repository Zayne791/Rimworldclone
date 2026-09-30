import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleLLM } from './server/llmproxy.mjs';

/** `npm run dev` serves the same /api/llm endpoint as Vercel, reading DEEPSEEK_API_KEY from .env.local */
function llmDevProxy(env: Record<string, string>): Plugin {
  return {
    name: 'llm-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/llm', (req, res) => {
        let raw = '';
        req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
        req.on('end', async () => {
          let body: any = null;
          try { body = JSON.parse(raw); } catch { /* handled below */ }
          const out = req.method === 'POST' ? await handleLLM({ body, headers: req.headers as any, env, ip: req.socket.remoteAddress || '?' }) : { status: 405, json: { error: 'POST only' } };
          res.statusCode = out.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(out.json));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') } as Record<string, string>;
  return {
    base: './',
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 2000,
    },
    server: { host: true },
    plugins: [llmDevProxy(env)],
  };
});
