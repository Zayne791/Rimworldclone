// Vercel Edge Function: POST /api/llm → DeepSeek. Set DEEPSEEK_API_KEY in the Vercel project's
// environment variables (see README, "AI minds"). Logic lives in server/llmproxy.mjs.
import { handleLLM } from '../server/llmproxy.mjs';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  const body = await req.json().catch(() => null);
  const headers = Object.fromEntries(req.headers.entries());
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '?';
  const env = { DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY, DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL, LLM_PASSWORD: process.env.LLM_PASSWORD, LLM_RATE_PER_MIN: process.env.LLM_RATE_PER_MIN, DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL };
  const { status, json } = await handleLLM({ body, headers, env, ip });
  return new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
