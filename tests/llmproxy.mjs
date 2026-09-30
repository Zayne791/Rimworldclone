// Checks the /api/llm proxy against a local stand-in for DeepSeek: request shape (model, thinking
// disabled, JSON mode, capped tokens), usage parsing, key handling, password and errors.
import http from 'node:http';
import { handleLLM } from '../server/llmproxy.mjs';

let seen = null;
const fake = http.createServer((req, res) => {
  let raw = ''; req.on('data', c => (raw += c)); req.on('end', () => {
    seen = { auth: req.headers.authorization, url: req.url, body: JSON.parse(raw) };
    if (req.headers.authorization === 'Bearer bad') { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Authentication Fails' } })); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: 'deepseek-flash', choices: [{ message: { content: '{"thought":"hi","action":"work","work":"grow","hours":2}' } }], usage: { prompt_tokens: 1200, completion_tokens: 40, prompt_cache_hit_tokens: 900, prompt_cache_miss_tokens: 300 } }));
  });
}).listen(0);
await new Promise(r => fake.on('listening', r));
const base = `http://127.0.0.1:${fake.address().port}`;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const msgs = [{ role: 'system', content: 'rules json' }, { role: 'user', content: 'state' }];

let r = await handleLLM({ body: { messages: msgs, model: 'deepseek-v4-pro', max_tokens: 5000 }, env: { DEEPSEEK_API_KEY: 'srv', DEEPSEEK_BASE_URL: base } });
ok(r.status === 200 && r.json.content.includes('"work"'), 'server key: 200 with content');
ok(seen.url === '/chat/completions' && seen.auth === 'Bearer srv', 'calls /chat/completions with the server key');
ok(seen.body.model === 'deepseek-flash', 'server key cannot pick an expensive model (' + seen.body.model + ')');
ok(seen.body.thinking?.type === 'disabled' && seen.body.response_format?.type === 'json_object' && seen.body.stream === false, 'thinking disabled, JSON mode, no stream');
ok(seen.body.max_tokens === 600, 'max_tokens capped (' + seen.body.max_tokens + ')');
ok(r.json.usage.hit === 900 && r.json.usage.miss === 300 && r.json.usage.out === 40, 'usage parsed ' + JSON.stringify(r.json.usage));
r = await handleLLM({ body: { messages: msgs }, headers: { 'x-deepseek-key': 'mine' }, env: { DEEPSEEK_BASE_URL: base } });
ok(r.status === 200 && seen.auth === 'Bearer mine', "player's own key is forwarded");
r = await handleLLM({ body: { messages: msgs }, env: { DEEPSEEK_BASE_URL: base } });
ok(r.status === 503, 'no key anywhere → 503');
r = await handleLLM({ body: { messages: msgs }, env: { DEEPSEEK_API_KEY: 'srv', LLM_PASSWORD: 'pw', DEEPSEEK_BASE_URL: base } });
ok(r.status === 401, 'password required when set');
r = await handleLLM({ body: { messages: msgs }, headers: { 'x-llm-password': 'pw' }, env: { DEEPSEEK_API_KEY: 'srv', LLM_PASSWORD: 'pw', DEEPSEEK_BASE_URL: base } });
ok(r.status === 200, 'correct password accepted');
r = await handleLLM({ body: { messages: msgs }, headers: { 'x-deepseek-key': 'bad' }, env: { DEEPSEEK_BASE_URL: base } });
ok(r.status === 401 && /Authentication/.test(r.json.error), 'bad key → 401 with DeepSeek message');
r = await handleLLM({ body: { messages: [{ role: 'tool', content: 'x' }] }, env: { DEEPSEEK_API_KEY: 'srv', DEEPSEEK_BASE_URL: base } });
ok(r.status === 400, 'rejects odd roles');
r = await handleLLM({ body: { messages: [{ role: 'user', content: 'x'.repeat(50000) }] }, env: { DEEPSEEK_API_KEY: 'srv', DEEPSEEK_BASE_URL: base } });
ok(r.status === 413, 'rejects huge prompts');
let limited = false;
for (let k = 0; k < 5; k++) { r = await handleLLM({ body: { messages: msgs }, env: { DEEPSEEK_API_KEY: 'srv', DEEPSEEK_BASE_URL: base, LLM_RATE_PER_MIN: 3 }, ip: '9.9.9.9' }); if (r.status === 429) limited = true; }
ok(limited, 'per-IP rate limit');
fake.close();
console.log(fails ? `${fails} FAILURES` : 'proxy checks passed');
process.exit(fails ? 1 : 0);
