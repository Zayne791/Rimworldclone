// Talking to DeepSeek. Three ways to get a key into the request:
//  - "server": the deployment's own key (DEEPSEEK_API_KEY on Vercel / the relay / `npm run dev`), via /api/llm
//  - "key": the player's own key, sent through /api/llm (or straight to DeepSeek if there is no proxy)
//  - "offline": no network at all; a small rule-based mind stands in (for trying the mode without a key)
import type { Msg } from './prompt';

export const DEFAULT_MODEL = 'deepseek-flash';
export interface LLMSettings {
  provider: 'server' | 'key' | 'offline';
  key: string;
  password: string;       // optional shared secret if the deployment sets LLM_PASSWORD
  endpoint: string;
  model: string;
  perMin: number;         // max decisions per real minute (all colonists together)
  budget: number;         // stop after this many US$ this session
}
const KEY = 'starfall.llm';
export function loadSettings(): LLMSettings {
  let s: Partial<LLMSettings> = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
  const env = (import.meta as any).env || {};
  return { provider: s.provider || 'server', key: s.key || '', password: s.password || '', endpoint: s.endpoint || env.VITE_LLM_ENDPOINT || '/api/llm', model: s.model || env.VITE_LLM_MODEL || DEFAULT_MODEL, perMin: s.perMin || 20, budget: s.budget ?? 1 };
}
export function saveSettings(s: LLMSettings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

export interface Usage { hit: number; miss: number; out: number }
/** DeepSeek list prices for deepseek-flash, US$ per million tokens; off-peak is half */
export const PRICE = { hit: 0.006, miss: 0.3, out: 1.2 };
export function isPeak(d = new Date()): boolean {
  const day = d.getUTCDay(), h = d.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}
export function costOf(u: Usage, peak = isPeak()): number {
  const f = peak ? 1 : 0.5;
  return (u.hit * PRICE.hit + u.miss * PRICE.miss + u.out * PRICE.out) * f / 1e6;
}

export class LLMError extends Error { constructor(msg: string, public status = 0, public fatal = false) { super(msg); } }

export async function chat(s: LLMSettings, messages: Msg[], signal?: AbortSignal): Promise<{ text: string; usage: Usage }> {
  const body = { model: s.model, messages, max_tokens: 260, temperature: 1.0 };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s.provider === 'key' && s.key) headers['X-DeepSeek-Key'] = s.key;
  if (s.password) headers['X-LLM-Password'] = s.password;
  let res: Response;
  try {
    res = await fetch(s.endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    // no proxy reachable: with their own key the player can still call DeepSeek directly
    if (s.provider === 'key' && s.key) return direct(s, body, signal);
    throw new LLMError('Could not reach the AI proxy (' + (e as Error).message + ')');
  }
  if ((res.status === 404 || res.status === 405) && s.provider === 'key' && s.key) return direct(s, body, signal);
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new LLMError(j.error || `AI proxy error ${res.status}`, res.status, res.status === 401 || res.status === 503 || res.status === 404);
  return { text: j.content || '', usage: j.usage || { hit: 0, miss: 0, out: 0 } };
}

async function direct(s: LLMSettings, body: any, signal?: AbortSignal) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.key}` },
    body: JSON.stringify({ ...body, response_format: { type: 'json_object' }, thinking: { type: 'disabled' }, stream: false }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new LLMError(j.error?.message || `DeepSeek error ${res.status}`, res.status, res.status === 401 || res.status === 402);
  return { text: j.choices?.[0]?.message?.content || '', usage: usageOf(j.usage) };
}

export function usageOf(u: any): Usage {
  if (!u) return { hit: 0, miss: 0, out: 0 };
  const hit = u.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.prompt_cache_hit_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0;
  const miss = u.prompt_cache_miss_tokens ?? u.prompt_tokens_details?.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens || 0) - hit);
  return { hit, miss, out: u.completion_tokens || 0 };
}
