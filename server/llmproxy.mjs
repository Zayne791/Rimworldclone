// Shared DeepSeek proxy used by the Vercel function (api/llm.js), the Vite dev server and
// server/relay.mjs. Keeps the API key off the client, forces cheap settings (non-thinking mode,
// JSON output, short answers) and applies a per-IP rate limit.
//
// Environment:
//   DEEPSEEK_API_KEY   the key used when the player doesn't bring their own
//   DEEPSEEK_MODEL     model id (default deepseek-flash)
//   LLM_PASSWORD       optional: players must enter this to use the server key
//   LLM_RATE_PER_MIN   optional: requests per minute per IP with the server key (default 90)
//   DEEPSEEK_BASE_URL  optional: API base (default https://api.deepseek.com)

const CHEAP = new Set(['deepseek-flash', 'deepseek-v4-flash', 'deepseek-chat']);
const hits = new Map();

function rateLimited(ip, perMin) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60000) hits.delete(k);
  return list.length > perMin;
}

export function usageOf(u) {
  if (!u) return { hit: 0, miss: 0, out: 0 };
  const d = u.prompt_tokens_details || {};
  const hit = u.prompt_cache_hit_tokens ?? d.prompt_cache_hit_tokens ?? d.cached_tokens ?? 0;
  const miss = u.prompt_cache_miss_tokens ?? d.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens || 0) - hit);
  return { hit, miss, out: u.completion_tokens || 0 };
}

/** @returns {Promise<{status:number, json:any}>} */
export async function handleLLM({ body, headers = {}, env = {}, ip = '?' }) {
  const h = k => headers[k] || headers[k.toLowerCase()] || '';
  const userKey = String(h('x-deepseek-key') || '').trim();
  const key = userKey || env.DEEPSEEK_API_KEY;
  if (!key) return { status: 503, json: { error: 'This server has no DeepSeek key (set DEEPSEEK_API_KEY), so enter your own key' } };
  if (!userKey && env.LLM_PASSWORD && h('x-llm-password') !== env.LLM_PASSWORD) return { status: 401, json: { error: 'Wrong or missing AI password' } };
  if (!userKey && rateLimited(ip, +(env.LLM_RATE_PER_MIN || 90))) return { status: 429, json: { error: 'Too many AI requests, slow down' } };
  const msgs = Array.isArray(body?.messages) ? body.messages : null;
  if (!msgs || !msgs.length || msgs.length > 12) return { status: 400, json: { error: 'Bad messages' } };
  let total = 0;
  for (const m of msgs) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return { status: 400, json: { error: 'Bad message' } };
    total += m.content.length;
  }
  if (total > 40000) return { status: 413, json: { error: 'Prompt too long' } };
  let model = String(env.DEEPSEEK_MODEL || body.model || 'deepseek-flash');
  if (!userKey && !CHEAP.has(model) && !env.DEEPSEEK_MODEL) model = 'deepseek-flash';
  const req = {
    model,
    messages: msgs.map(m => ({ role: m.role, content: m.content })),
    max_tokens: Math.max(16, Math.min(600, +body.max_tokens || 260)),
    temperature: Math.max(0, Math.min(1.6, body.temperature ?? 1)),
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    stream: false,
  };
  let res;
  try {
    res = await fetch(`${(env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(req),
    });
  } catch (e) {
    return { status: 502, json: { error: 'Could not reach DeepSeek: ' + (e && e.message) } };
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j?.error?.message || `DeepSeek error ${res.status}`;
    // 401/402 mean a bad or empty key: report them so the client stops trying
    return { status: res.status === 401 || res.status === 402 ? 401 : res.status, json: { error: msg } };
  }
  return { status: 200, json: { content: j.choices?.[0]?.message?.content || '', usage: usageOf(j.usage), model: j.model } };
}
