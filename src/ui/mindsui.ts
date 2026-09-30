// AI minds UI: the settings window (provider, key, budget, live cost), the inspector's Mind tab
// and the colony's conversation log.
import type { UI } from './ui';
import type { Pawn } from '../sim/types';
import { escapeHtml } from '../core/util';
import { iconImg } from '../render/art/icons';
import { pawnShortName } from '../sim/things';
import { costOf, isPeak, PRICE, chat, LLMError } from '../mind/llm';
import { TICKS_PER_HOUR, TICKS_PER_DAY } from '../core/constants';
import { leaderMode, lead, dutyText } from '../sim/leader';
import { speechSupported } from './voice';

const closeBtn = `<button class="btn sm" data-a="closemodal">${iconImg('close', 'ico s')}</button>`;
const money = (v: number) => (v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`);
const when = (t: number) => { const d = Math.floor(t / TICKS_PER_DAY) + 1, h = Math.floor((t % TICKS_PER_DAY) / TICKS_PER_HOUR); return `D${d} ${String(h).padStart(2, '0')}h`; };

export function mindsWindow(ui: UI) {
  const g = ui.g, mc = g.minds, s = mc.settings, st = mc.stats;
  const on = mc.enabled;
  const lm = leaderMode(g.world, g.faction);
  const prov = (id: string, label: string, sub: string) => `<button class="btn sm ${s.provider === id ? 'on' : ''}" data-a="w:mprov" data-v="${id}">${label}<small class="dim"> ${sub}</small></button>`;
  const u = st.usage;
  const avg = st.calls ? st.cost / st.calls : 0;
  const body = `
    <div class="small">Each colonist is played by <b>DeepSeek</b> (${escapeHtml(s.model)}, thinking off). It reads what they see, feel and remember, then decides their work, rest, fun, what they say and to whom. Your draft orders still come first, and bodies still collapse, flee danger and break down.</div>
    <div class="row wrap" style="margin-top:8px">
      <button class="btn ${on ? 'good' : ''}" data-a="w:mindson" data-v="${on ? '0' : '1'}">${on ? '✔ AI minds ON' : 'Turn AI minds on'}</button>
      <button class="btn sm" data-a="w:mtest">Test connection</button>
    </div>
    <h3>Leader mode</h3>
    <div class="small">${lm ? 'On: <b>no work orders</b>. Colonists only do work they have agreed to in conversation with you, and come to you with requests, complaints and disputes. Talk to them from the inspector (Talk), the Work tab (People) or when they ask.' : 'Off: colonists choose their own work from what the colony needs.'}</div>
    <div class="row wrap" style="margin-top:6px"><button class="btn sm ${lm ? 'on' : ''}" data-a="w:mleader" data-v="${lm ? '0' : '1'}">${lm ? '✔ Leader mode' : 'Turn leader mode on'}</button></div>
    <div class="tiny dim" style="margin-top:4px">Voice: ${speechSupported() ? 'your browser can hear you. Tap the mic in a conversation and speak; the colonist answers in their own voice.' : "this browser has no speech recognition, so you'll type (Safari on iPad/iPhone and Chrome support voice)."}</div>
    <h3>Where the AI runs</h3>
    <div class="seg col">${prov('server', 'This server\'s key', '(DEEPSEEK_API_KEY on Vercel or the relay)')}${prov('key', 'My own DeepSeek key', '(kept on this device)')}${prov('offline', 'Offline mind', '(no AI, simple rules; free)')}</div>
    ${s.provider === 'key' ? `<div class="field"><label>DeepSeek API key</label><input type="password" autocomplete="off" placeholder="sk-…" value="${escapeHtml(s.key)}" data-in="mkey"><div class="tiny dim">Get one at platform.deepseek.com. It is stored only in this browser and sent only to the game's /api/llm proxy or DeepSeek.</div></div>` : ''}
    ${s.provider === 'server' ? `<div class="field"><label>Server password (only if the host set LLM_PASSWORD)</label><input type="password" autocomplete="off" value="${escapeHtml(s.password)}" data-in="mpass"></div>` : ''}
    <h3>Cost control</h3>
    <div class="field"><label>Stop after this much per session: <b>$${s.budget.toFixed(2)}</b></label><input type="range" min="0" max="500" step="5" value="${Math.round(s.budget * 100)}" data-in="mbudget"></div>
    <div class="field"><label>At most <b>${s.perMin}</b> decisions per minute (all colonists)</label><input type="range" min="4" max="60" step="2" value="${s.perMin}" data-in="mrate"></div>
    <div class="kv small">
      <span>Decisions this session</span><span>${st.calls}${st.fails ? ` <span class="warn">(${st.fails} failed)</span>` : ''}</span>
      <span>Tokens in (cached / new)</span><span>${u.hit.toLocaleString()} / ${u.miss.toLocaleString()}</span>
      <span>Tokens out</span><span>${u.out.toLocaleString()}</span>
      <span>Spent</span><span class="${mc.overBudget() ? 'bad' : 'good'}">${money(st.cost)}${st.calls ? ` · ${money(avg)} each` : ''}</span>
      <span>Price now</span><span>${isPeak() ? 'peak' : 'off-peak (half price)'}: $${PRICE.miss}/M new, $${PRICE.hit}/M cached, $${PRICE.out}/M out</span>
      <span>Status</span><span>${mc.provider === 'offline' && s.provider !== 'offline' ? '<span class="warn">using offline mind</span>' : st.thinking ? `${st.thinking} thinking…` : on ? 'ready' : 'off'}${st.lastMs ? ` · last reply ${(st.lastMs / 1000).toFixed(1)} s` : ''}</span>
    </div>
    ${st.lastError ? `<div class="tiny warn" style="margin-top:4px">${escapeHtml(st.lastError)}</div>` : ''}
    <div class="tiny dim" style="margin-top:6px">Typical cost is a few tenths of a cent per colonist-hour of play: prompts share a cached prefix and replies are short. Minds ask for a new decision when a plan runs out, when someone talks to them, when they're hurt or when big news breaks.</div>`;
  ui.showModal('minds', `<div class="wh"><h2>AI minds</h2>${closeBtn}</div><div class="wb">${body}</div>`, 'narrow');
}

export function mindsAction(ui: UI, a: string, d: DOMStringMap): boolean {
  const g = ui.g, mc = g.minds;
  const again = () => setTimeout(() => mindsWindow(ui), 60);
  switch (a) {
    case 'mindson': g.cmd({ c: 'minds', on: d.v === '1' }); if (d.v === '1') ui.toast('Your colonists now think for themselves', 'good'); again(); return true;
    case 'mprov': mc.settings.provider = d.v as any; mc.save(); again(); return true;
    case 'mleader': g.cmd({ c: 'leadermode', on: d.v === '1' }); ui.toast(d.v === '1' ? 'Leader mode: nothing gets done unless you ask' : 'Colonists pick their own work again', 'good'); again(); return true;
    case 'mtest': {
      if (mc.settings.provider === 'offline') { ui.toast('Offline mind needs no connection', 'good'); return true; }
      ui.toast('Asking DeepSeek…');
      const t0 = performance.now();
      chat(mc.settings, [{ role: 'system', content: 'Reply with a JSON object {"ok": true, "word": one cheerful word}.' }, { role: 'user', content: 'ping (answer in json)' }])
        .then(r => { mc.stats.usage.hit += r.usage.hit; mc.stats.usage.miss += r.usage.miss; mc.stats.usage.out += r.usage.out; mc.stats.cost += costOf(r.usage); ui.toast(`DeepSeek answered in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${r.text.slice(0, 60)}`, 'good'); mc.save(); again(); })
        .catch((e: LLMError) => { ui.toast(`AI connection failed: ${e.message}`, 'bad'); mc.stats.lastError = e.message; again(); });
      return true;
    }
  }
  return false;
}
export function mindsInput(ui: UI, a: string, el: HTMLInputElement, type: string): boolean {
  const mc = ui.g.minds, s = mc.settings;
  if (a === 'mkey') { s.key = el.value.trim(); mc.save(); return true; }
  if (a === 'mpass') { s.password = el.value; mc.save(); return true; }
  if (a === 'mbudget') { s.budget = +el.value / 100; mc.save(); if (type === 'change') mindsWindow(ui); else { const l = el.previousElementSibling?.querySelector('b'); if (l) l.textContent = `$${s.budget.toFixed(2)}`; } return true; }
  if (a === 'mrate') { s.perMin = +el.value; mc.save(); const l = el.previousElementSibling?.querySelector('b'); if (l) l.textContent = String(s.perMin); return true; }
  return false;
}

/** inspector tab for a colonist with a mind */
export function mindTab(ui: UI, p: Pawn): string {
  const g = ui.g, w = g.world, m = p.mind;
  if (!m) return `<div class="dim small">This colonist follows the work tab. Turn on <b>AI minds</b> in the Menu to let DeepSeek play them.</div>`;
  const thinking = g.minds.isThinking(p.id);
  let lh = '';
  if (leaderMode(w, p.faction) && m.on) {
    const L = lead(p);
    lh = `<div class="row"><span class="grow small">Trust in you <b class="${L.trust >= 0 ? 'good' : 'bad'}">${L.trust > 0 ? '+' : ''}${Math.round(L.trust)}</b> · ${L.talks} exchanges</span><button class="btn sm good" data-a="talkopen" data-id="${p.id}">💬 Talk</button></div>`;
    lh += `<h3>Agreed work</h3>` + (L.duties.length ? L.duties.map(d => `<div class="small">• ${escapeHtml(dutyText(d))} <span class="dim tiny">done ${d.done}×</span></div>`).join('') : '<div class="small warn">Nothing agreed. They won\'t work unless you talk to them.</div>');
    if (L.promises.length) lh += `<h3>You promised</h3>` + L.promises.map(x => `<div class="small">• ${escapeHtml(x.text)} <span class="dim tiny">${when(x.t)}</span></div>`).join('');
    if (L.audience) lh += `<div class="small accent" style="margin-top:4px">💬 Wants to talk: “${escapeHtml(L.audience.text)}”</div>`;
  }
  let h = lh + `<div class="mind-now">${thinking ? '<span class="accent">💭 thinking…</span>' : m.want ? '<span class="dim">waiting to decide…</span>' : ''}</div>`;
  if (m.thought) h += `<div class="mind-thought">“${escapeHtml(m.thought)}”</div>`;
  if (m.goal) {
    const left = Math.max(0, m.goal.until - w.tick);
    h += `<div class="small"><b>Plan:</b> ${escapeHtml(m.goal.label)}${m.goal.say ? ` — to say “${escapeHtml(m.goal.say)}”` : ''} <span class="dim">(${left > 0 ? `${(left / TICKS_PER_HOUR).toFixed(1)} h left` : 'done'})</span></div>`;
  }
  if (m.memory.length) h += `<h3>Remembers</h3>` + m.memory.slice().reverse().map(s => `<div class="small">• ${escapeHtml(s)}</div>`).join('');
  const lines = w.talk.filter(l => l.from === p.id || l.to === p.id).slice(-10).reverse();
  if (lines.length) h += `<h3>Lately</h3>` + lines.map(l => talkLine(ui, l)).join('');
  if (m.inbox.length) h += `<h3>Hasn't reacted to yet</h3>` + m.inbox.slice(-4).map(e => `<div class="tiny dim">• ${escapeHtml(e.text)}</div>`).join('');
  h += `<div class="tiny dim" style="margin-top:6px">${m.n} decisions made${m.on ? '' : ' · mind switched off'}</div>`;
  return h;
}

export function talkLine(ui: UI, l: import('../sim/minds').TalkLine): string {
  const w = ui.g.world;
  const a = w.pawns.get(l.from), b = l.to ? w.pawns.get(l.to) : null;
  const who = a ? escapeHtml(pawnShortName(a)) : '?';
  if (l.kind === 'thought') return `<div class="talk inner"><span class="tiny dim">${when(l.t)}</span> <b>${who}</b> <i>thinks “${escapeHtml(l.text)}”</i></div>`;
  return `<div class="talk"><span class="tiny dim">${when(l.t)}</span> <b>${who}</b>${b ? ` → <b>${escapeHtml(pawnShortName(b))}</b>` : ''}${l.tone && l.tone !== 'friendly' ? ` <span class="tone ${l.tone}">${l.tone}</span>` : ''}: “${escapeHtml(l.text)}”</div>`;
}

export function voicesHtml(ui: UI): string {
  const g = ui.g, w = g.world;
  const mine = (id: number) => w.pawns.get(id)?.faction === g.faction;
  const lines = w.talk.filter(l => mine(l.from)).slice(-60).reverse();
  if (!lines.length) return `<div class="dim small">${g.minds.enabled ? 'Nothing said yet. Give them a moment.' : 'Turn on <b>AI minds</b> (Menu → AI minds) and your colonists will think, talk and argue on their own. Their words appear here.'}</div>`;
  return lines.map(l => talkLine(ui, l)).join('');
}
