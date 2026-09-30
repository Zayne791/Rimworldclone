// Modal windows: work, schedule, research, colony, factions/diplomacy, chat, trade, bills, letters, menu.
import type { UI } from './ui';
import { itemIconURL, portraitURL } from './ui';
import type { Pawn, Item, Letter } from '../sim/types';
import { iconImg } from '../render/art/icons';
import { escapeHtml, fmtNum, pct, cap } from '../core/util';
import { VISIBLE_WORK, WORK_TYPES } from '../data/pawns';
import { RESEARCH, RECIPES } from '../data/recipes';
import { BUILDINGS } from '../data/buildings';
import { ITEMS, stuffsFor } from '../data/items';
import { ANIMALS } from '../data/animals';
import { canStartResearch, isResearched } from '../sim/research';
import { skillLevel } from '../sim/stats';
import { pawnShortName, itemLabel } from '../sim/things';
import { colonyTradeables, colonySilver, priceFactor, unitValue, tradeKey, negotiator } from '../sim/trade';
import { jobLabel } from '../sim/jobs';
import { saveToDb, listSaves, exportSave } from '../sim/save';
import { TICKS_PER_DAY, GAME_NAME, VERSION } from '../core/constants';
import { PRIORITY_LABELS } from '../sim/zones';

const closeBtn = `<button class="btn sm" data-a="closemodal">${iconImg('close', 'ico s')}</button>`;
const tabsHtml = (ui: UI, tabs: [string, string][], cur: string) => `<div class="row wrap">${tabs.map(([id, l]) => `<button class="btn sm ${cur === id ? 'on' : ''}" data-a="w:tab" data-v="${id}">${l}</button>`).join('')}</div>`;

interface WState { tab: string; paint?: string; rsel?: string; trade?: { lord: number | 'orbital'; lines: Record<string, number> }; bench?: number; bed?: number; store?: number; p2p?: { to: number; give: Record<string, number>; want: Record<string, number> } }
const st: WState = { tab: '' };

export function openWindow(ui: UI, kind: string) {
  ui.modalArg = null;
  st.tab = '';
  renderWindow(ui, kind);
}
export function refreshWindow(ui: UI) {
  const k = ui.modalKind;
  if (!k) return;
  if (k === 'colony' && st.tab === 'chat') { updateChatLog(ui); return; }
  if (k === 'more' || k === 'letter' || k === 'trade' || k === 'p2p' || k === 'bills' && document.activeElement?.tagName === 'INPUT') return;
  renderWindow(ui, k);
}

function renderWindow(ui: UI, kind: string) {
  switch (kind) {
    case 'work': return workWindow(ui);
    case 'research': return researchWindow(ui);
    case 'colony': return colonyWindow(ui);
    case 'more': return moreWindow(ui);
    case 'trade': return tradeWindow(ui);
    case 'bills': return billsWindow(ui);
    case 'assign': return assignWindow(ui);
    case 'storage': return storageWindow(ui);
    case 'p2p': return p2pWindow(ui);
    case 'letter': return letterWindow(ui);
    case 'help': return helpWindow(ui);
  }
}

// ---------------- work & schedule ----------------
function workWindow(ui: UI) {
  const g = ui.g;
  if (!st.tab) st.tab = 'work';
  const cols = g.world.colonists(g.faction);
  let body = '';
  if (st.tab === 'work') {
    body += `<div class="small dim" style="margin-bottom:6px">Tap a cell to cycle priority: 1 (highest) → 4 → off. Colonists do higher-priority work first. Gold border = their best at it.</div><div class="scroll-x"><table class="wgrid"><tr><th></th>${VISIBLE_WORK.map(w => `<th>${w.label}</th>`).join('')}</tr>`;
    for (const p of cols) {
      body += `<tr><td class="nm"><img class="ico s" src="${portraitURL(p)}"> ${escapeHtml(pawnShortName(p))}</td>`;
      for (const wt of VISIBLE_WORK) {
        if (p.disabled.includes(wt.id)) { body += `<td><div class="wcell x"></div></td>`; continue; }
        const v = p.work[wt.id] || 0;
        const sk = wt.skills.length ? Math.max(...wt.skills.map(s => skillLevel(p, s))) : -1;
        const best = sk >= 0 && cols.every(o => o === p || o.disabled.includes(wt.id) || Math.max(...wt.skills.map(s => skillLevel(o, s))) <= sk) && sk >= 5;
        body += `<td><div class="wcell p${v} ${best ? 'best' : ''}" data-a="w:work" data-p="${p.id}" data-w="${wt.id}">${v || ''}</div>${sk >= 0 ? `<div class="tiny faint">${sk}</div>` : ''}</td>`;
      }
      body += `</tr>`;
    }
    body += `</table></div>`;
  } else {
    const paint = st.paint || 'W';
    body += `<div class="row wrap" style="margin-bottom:6px">${[['S', 'Sleep'], ['W', 'Work'], ['J', 'Recreation'], ['A', 'Anything']].map(([k, l]) => `<button class="btn sm ${paint === k ? 'on' : ''}" data-a="w:paint" data-v="${k}"><span class="sc ${k}" style="display:inline-block;width:14px;height:14px"></span>${l}</button>`).join('')}</div>`;
    body += `<div class="scroll-x"><table class="sched"><tr><td></td>${Array.from({ length: 24 }, (_, h) => `<td class="tiny dim center">${h}</td>`).join('')}</tr>`;
    for (const p of cols) body += `<tr><td class="nm small">${escapeHtml(pawnShortName(p))} <button class="btn sm flat tiny" data-a="w:schedall" data-p="${p.id}">all</button></td>${p.schedule.split('').map((c, h) => `<td><div class="sc ${c}" data-a="w:sched" data-p="${p.id}" data-h="${h}"></div></td>`).join('')}</tr>`;
    body += `</table></div><div class="small dim" style="margin-top:6px">Tap hours to paint. "all" copies this colonist's schedule to everyone.</div>`;
  }
  ui.showModal('work', `<div class="wh"><h2>${st.tab === 'work' ? 'Work' : 'Schedule'}</h2>${tabsHtml(ui, [['work', 'Work'], ['sched', 'Schedule']], st.tab)}${closeBtn}</div><div class="wb">${body}</div>`, 'wide');
}

// ---------------- research ----------------
function researchWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const rs = w.research[g.faction] || { cur: null, prog: {}, done: [] };
  const nodes = Object.values(RESEARCH);
  const sel0 = st.rsel || rs.cur || '';
  const maxTier = Math.max(...nodes.map(n => n.tier)), maxCol = Math.max(...nodes.map(n => n.col));
  const cols = maxCol + 1, rows = maxTier + 1;
  // size nodes to fit the window width (portrait iPad fits all six columns; phones scroll sideways)
  const GX = 14, GY = 28, PAD = 8;
  const avail = Math.min(window.innerWidth - 16, 1100) - 28;
  const NW = Math.max(112, Math.min(168, Math.floor((avail - PAD * 2 - GX * (cols - 1)) / cols)));
  const NH = 62;
  const TW = PAD * 2 + cols * NW + (cols - 1) * GX, TH = PAD * 2 + rows * NH + (rows - 1) * GY;
  const pos = (n: typeof nodes[number]) => [PAD + n.col * (NW + GX), PAD + n.tier * (NH + GY)];
  // related to selection: its prerequisites (recursively) light up
  const lit = new Set<string>();
  const walk = (id: string) => { if (lit.has(id)) return; lit.add(id); for (const pr of RESEARCH[id]?.prereqs || []) walk(pr); };
  if (sel0) walk(sel0);
  // edges are routed through the gaps between cards (circuit-board style) so no line crosses a card
  const kids = new Map<string, string[]>();
  for (const n of nodes) for (const pr of n.prereqs) { if (!kids.has(pr)) kids.set(pr, []); kids.get(pr)!.push(n.id); }
  const paths: { d: string; c: string; z: number }[] = [];
  for (const n of nodes) n.prereqs.forEach((pr, pi) => {
    const a = RESEARCH[pr]; if (!a) return;
    const [ax, ay] = pos(a), [bx, by] = pos(n);
    const sib = [...(kids.get(pr) || [])].sort((u, v) => RESEARCH[u].col - RESEARCH[v].col || RESEARCH[u].tier - RESEARCH[v].tier);
    const k = sib.indexOf(n.id), nk = sib.length;
    const sx = Math.round(ax + NW / 2 + Math.max(-NW / 2 + 10, Math.min(NW / 2 - 10, (k - (nk - 1) / 2) * 7)));
    const ex = Math.round(bx + NW / 2 + (pi - (n.prereqs.length - 1) / 2) * 12);
    const lane = (a.col - 2.5) * 2;
    const y1 = Math.round(ay + NH + GY / 2 + lane);
    let d: string;
    if (n.tier === a.tier + 1) d = `M${sx} ${ay + NH}V${y1}H${ex}V${by}`;
    else {
      const gx = Math.round(n.col > a.col || n.col === 0 ? bx - GX / 2 : bx + NW + GX / 2) + (n.col === a.col ? 0 : Math.sign(a.col - n.col) * 2);
      const y2 = Math.round(by - GY / 2 + lane);
      d = `M${sx} ${ay + NH}V${y1}H${gx}V${y2}H${ex}V${by}`;
    }
    const done = rs.done.includes(pr);
    const hot = lit.has(n.id) && lit.has(pr);
    paths.push({ d, c: hot ? '#ffd24a' : done ? '#7fd67a' : '#4a4258', z: hot ? 2 : done ? 1 : 0 });
  });
  paths.sort((u, v) => u.z - v.z);
  let svg = `<svg width="${TW}" height="${TH}" style="position:absolute;left:0;top:0" shape-rendering="crispEdges">`;
  for (const pth of paths) svg += `<path d="${pth.d}" stroke="${pth.c}" stroke-width="2" fill="none"/>`;
  svg += `</svg>`;
  let html = `<div class="rtree" style="width:${TW}px;height:${TH}px;margin:0 auto">${svg}`;
  for (const n of nodes) {
    const [x, y] = pos(n);
    const done = rs.done.includes(n.id);
    const can = canStartResearch(w, g.faction, n.id);
    const prog = (rs.prog[n.id] || 0) / n.cost;
    html += `<div class="rnode ${done ? 'done' : ''} ${rs.cur === n.id ? 'cur' : ''} ${!done && !can ? 'locked' : ''} ${n.id === sel0 ? 'sel' : ''}" style="left:${x}px;top:${y}px;width:${NW}px;height:${NH}px" data-a="w:rsel" data-v="${n.id}"><b>${escapeHtml(n.label)}</b><div class="tiny dim">${done ? '✔ complete' : `${n.cost} pts${n.hiTech ? ' · hi-tech' : ''}`}</div>${!done && prog > 0 ? `<div class="bar"><i style="width:${Math.round(prog * 100)}%"></i></div>` : ''}</div>`;
  }
  html += `</div>`;
  const sel = st.rsel ? RESEARCH[st.rsel] : rs.cur ? RESEARCH[rs.cur] : null;
  let foot = '';
  if (sel) {
    const done = rs.done.includes(sel.id);
    const unlocks = Object.values(BUILDINGS).filter(b => b.research === sel.id).map(b => b.label).concat(Object.values(RECIPES).filter(r => r.research === sel.id).map(r => r.label));
    foot = `<div class="grow"><b>${escapeHtml(sel.label)}</b> <span class="dim small">${Math.round(rs.prog[sel.id] || 0)}/${sel.cost}</span><div class="small">${escapeHtml(sel.desc)}</div>${unlocks.length ? `<div class="tiny dim">Unlocks: ${escapeHtml(unlocks.slice(0, 8).join(', '))}</div>` : ''}${sel.prereqs.length ? `<div class="tiny dim">Requires: ${sel.prereqs.map(p => RESEARCH[p].label).join(', ')}</div>` : ''}</div>
      ${done ? '<span class="good">Done</span>' : rs.cur === sel.id ? `<button class="btn" data-a="w:rstop">Stop</button>` : `<button class="btn good ${canStartResearch(w, g.faction, sel.id) ? '' : 'dis'}" data-a="w:rstart" data-v="${sel.id}">Research</button>`}`;
  } else foot = `<div class="dim small grow">Tap a project. Build a research bench and colonists with Research work will study it.</div>`;
  ui.showModal('research', `<div class="wh"><h2>Research</h2>${closeBtn}</div><div class="wb" style="overflow:auto;touch-action:pan-x pan-y">${html}</div><div class="wf" style="justify-content:flex-start;align-items:center">${foot}</div>`, 'wide');
}

// ---------------- colony ----------------
function colonyWindow(ui: UI) {
  const g = ui.g, w = g.world;
  if (!st.tab) st.tab = 'colonists';
  const mp = w.players.length > 1 || !!g.net;
  const tabs: [string, string][] = [['colonists', 'Colonists'], ['animals', 'Animals'], ['factions', mp ? 'Diplomacy' : 'Factions'], ['stats', 'Stats'], ['log', 'Log']];
  if (mp) tabs.push(['chat', 'Chat']);
  let body = '';
  if (st.tab === 'colonists') {
    const cols = w.colonists(g.faction);
    const prisoners = [...w.pawns.values()].filter(p => p.guest?.prisoner && p.guest.host === g.faction);
    body += cols.map(p => `<div class="row" style="padding:4px 0;border-bottom:1px solid #2a2432" data-a="w:jump" data-id="${p.id}"><img class="ico l" src="${portraitURL(p)}"><div class="grow"><b>${escapeHtml(pawnShortName(p))}</b> <span class="small dim">${escapeHtml(jobLabel(w, p))}</span><div class="row small"><span style="width:60px">Mood ${pct(p.needs.mood)}</span><span style="width:70px">Food ${pct(p.needs.food)}</span><span>Rest ${pct(p.needs.rest)}</span></div></div>${p.drafted ? '<span class="chip bad">drafted</span>' : ''}</div>`).join('');
    if (prisoners.length) body += `<h3>Prisoners</h3>` + prisoners.map(p => `<div class="row" data-a="w:jump" data-id="${p.id}"><img class="ico" src="${portraitURL(p)}"><span class="grow">${escapeHtml(pawnShortName(p))}</span><span class="small dim">resistance ${p.guest!.resistance.toFixed(1)} · ${p.guest!.mode}</span></div>`).join('');
  } else if (st.tab === 'animals') {
    const an = [...w.pawns.values()].filter(p => p.faction === g.faction && p.animal?.tamed);
    body += an.length ? an.map(p => `<div class="row" data-a="w:jump" data-id="${p.id}"><img class="ico l" src="${portraitURL(p)}"><div class="grow"><b>${escapeHtml(p.animal?.name || '')}</b> <span class="small dim">${ANIMALS[p.race].label} · ${escapeHtml(jobLabel(w, p))}</span></div></div>`).join('') : '<div class="dim">No tame animals. Use Orders → Tame on wild animals.</div>';
  } else if (st.tab === 'factions') {
    const me = w.faction(g.faction)!;
    const others = w.players.filter(p => p.faction !== g.faction);
    if (others.length) {
      body += `<h3>Other colonies</h3>`;
      const offers: any[] = (w as any).diploOffers || [];
      for (const o of others) {
        const rel = w.diplo(g.faction, o.faction);
        const inc = offers.filter(x => x.from === o.faction && x.to === g.faction);
        body += `<div class="px" style="padding:6px;margin:4px 0"><div class="row"><span style="color:${o.color}">■</span><b class="grow">${escapeHtml(o.colonyName)}</b><span class="small dim">${escapeHtml(o.name)} ${o.connected ? '' : '(offline)'}</span><span class="chip ${rel === 'war' ? 'bad' : rel === 'ally' ? 'good' : ''}">${rel}</span></div>
          <div class="row wrap" style="margin-top:4px">
            ${rel !== 'war' && w.settings.pvp ? `<button class="btn sm bad" data-a="w:diplo" data-op="war" data-v="${o.faction}">Declare war</button>` : ''}
            ${rel === 'war' ? `<button class="btn sm" data-a="w:diplo" data-op="peace" data-v="${o.faction}">Offer peace</button>` : ''}
            ${rel === 'neutral' ? `<button class="btn sm good" data-a="w:diplo" data-op="ally" data-v="${o.faction}">Offer alliance</button>` : ''}
            ${rel === 'ally' ? `<button class="btn sm" data-a="w:diplo" data-op="break" data-v="${o.faction}">End alliance</button>` : ''}
            <button class="btn sm blue" data-a="w:p2p" data-v="${o.faction}">${iconImg('trade', 'ico s')} Trade / gift</button>
            <button class="btn sm" data-a="w:jumpcolony" data-v="${o.faction}">View</button>
          </div>
          ${inc.map(x => `<div class="row small" style="margin-top:4px"><span class="grow accent">They propose ${x.kind === 'peace' ? 'peace' : 'an alliance'}</span><button class="btn sm good" data-a="w:diplo" data-op="${x.kind}" data-v="${o.faction}">Accept</button></div>`).join('')}
        </div>`;
      }
      const p2p: any[] = ((w as any).p2p || []).filter((o: any) => o.to === g.faction || o.from === g.faction);
      if (p2p.length) {
        body += `<h3>Trade offers</h3>`;
        for (const o of p2p) {
          const incoming = o.to === g.faction;
          const other = w.faction(incoming ? o.from : o.to);
          const list = (arr: any[]) => arr.map((l: any) => `${l.n}× ${escapeHtml(ITEMS[l.key.split('|')[0]]?.label || l.key)}`).join(', ') || 'nothing';
          body += `<div class="px small" style="padding:6px;margin:4px 0"><b>${incoming ? 'From' : 'To'} ${escapeHtml(other?.colonyName || '')}</b><div>They give: ${list(incoming ? o.give : o.want)}</div><div>You give: ${list(incoming ? o.want : o.give)}</div>${o.note ? `<div class="dim">"${escapeHtml(o.note)}"</div>` : ''}
            <div class="row" style="margin-top:4px">${incoming ? `<button class="btn sm good" data-a="w:p2presp" data-id="${o.id}" data-v="1">Accept</button><button class="btn sm bad" data-a="w:p2presp" data-id="${o.id}" data-v="0">Decline</button>` : `<span class="dim">Waiting…</span><button class="btn sm" data-a="w:p2presp" data-id="${o.id}" data-v="0">Withdraw</button>`}</div></div>`;
        }
      }
    }
    body += `<h3>Factions</h3>`;
    for (const f of w.factions) {
      if (f.kind === 'player' || f.kind === 'wild') continue;
      const gw = me.goodwill[f.id] ?? 0;
      const hostile = w.hostile(g.faction, f.id);
      body += `<div class="row" style="padding:3px 0"><span style="color:${f.color}">■</span><span class="grow">${escapeHtml(f.name)}<div class="tiny dim">${f.kind}${f.leader ? ' · led by ' + escapeHtml(f.leader) : ''}</div></span><span class="${hostile ? 'bad' : gw > 20 ? 'good' : ''}">${hostile ? 'hostile' : gw > 50 ? 'ally' : 'neutral'} (${gw})</span></div>`;
    }
  } else if (st.tab === 'stats') {
    const h = w.history.slice(-60);
    const vals = h.map(x => x.wealth[g.faction] || 0);
    const mx = Math.max(1, ...vals);
    body += `<div class="kv"><span>Colony wealth</span><span>${fmtNum(w.story[g.faction]?.wealth || 0)}</span><span>Colonists</span><span>${w.colonists(g.faction).length}</span><span>Days survived</span><span>${w.day}</span><span>Storyteller</span><span>${w.settings.storyteller} · difficulty ${['peaceful', 'easy', 'normal', 'hard', 'brutal'][w.settings.difficulty]}</span><span>Kills</span><span>${w.colonists(g.faction).reduce((s, p) => s + p.kills, 0)}</span></div>`;
    body += `<h3>Wealth over time</h3><svg viewBox="0 0 300 80" style="width:100%;height:120px;background:#120f18;border:2px solid #0a080e"><polyline fill="none" stroke="#f0c850" stroke-width="2" points="${vals.map((v, k) => `${(k / Math.max(1, vals.length - 1)) * 300},${78 - (v / mx) * 74}`).join(' ')}"/></svg>`;
    if (w.players.length > 1) {
      body += `<h3>Colonies</h3>` + w.players.map(p => `<div class="row"><span style="color:${p.color}">■</span><span class="grow">${escapeHtml(p.colonyName)}</span><span>${w.colonists(p.faction).length} colonists · ${fmtNum(w.story[p.faction]?.wealth || 0)} wealth${p.won ? ' · <span class="good">escaped!</span>' : p.defeated ? ' · <span class="bad">lost</span>' : ''}</span></div>`).join('');
    }
  } else if (st.tab === 'log') {
    const ls = w.letters.filter(l => l.faction === g.faction || l.faction === 0).slice(-40).reverse();
    body += ls.map(l => `<div class="row" style="padding:3px 0;border-bottom:1px solid #2a2432" data-a="w:openletter" data-id="${l.id}"><span class="tiny dim" style="width:52px">day ${Math.floor(l.tick / TICKS_PER_DAY) + 1}</span><span class="${l.kind === 'threat' || l.kind === 'death' ? 'bad' : l.kind === 'good' ? 'good' : ''} grow">${escapeHtml(l.title)}</span></div>`).join('') || '<div class="dim">Nothing yet.</div>';
  } else if (st.tab === 'chat') {
    body += `<div class="chatlog px" id="chatlog" style="padding:6px"></div><div class="row" style="margin-top:6px"><input id="chatin" class="grow" maxlength="200" placeholder="Say something…" data-in="chat"><button class="btn good" data-a="w:chatsend">Send</button></div>`;
  }
  ui.showModal('colony', `<div class="wh"><h2>Colony</h2>${closeBtn}</div><div style="padding:6px 10px 0">${tabsHtml(ui, tabs, st.tab)}</div><div class="wb">${body}</div>`);
  if (st.tab === 'chat') updateChatLog(ui);
}
function updateChatLog(ui: UI) {
  const el = document.getElementById('chatlog');
  if (!el) return;
  const html = ui.g.world.chat.slice(-60).map(c => `<div><b style="color:${c.color}">${escapeHtml(c.from)}:</b> ${escapeHtml(c.text)}</div>`).join('') || '<div class="dim">No messages yet.</div>';
  if (el.innerHTML !== html) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
}

// ---------------- menu ----------------
function moreWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const a = g.audio;
  const net = g.net;
  let mpHtml = '';
  if (net) {
    mpHtml = `<h3>Multiplayer</h3><div class="small">${net.isHost ? 'You are hosting.' : 'Connected to host.'} ${net.roomCode ? `Room code: <b class="accent" style="font-size:1.3em;letter-spacing:2px">${escapeHtml(net.roomCode)}</b>` : ''}</div>
      ${net.roomCode ? `<div class="row wrap" style="margin-top:4px"><button class="btn sm" data-a="w:copylink">Copy invite link</button></div>` : ''}
      <div style="margin-top:4px">${w.players.map(p => `<div class="row small"><span style="color:${p.color}">■</span><span class="grow">${escapeHtml(p.name)} — ${escapeHtml(p.colonyName)}${p.isHost ? ' (host)' : ''}</span><span class="${p.connected ? 'good' : 'dim'}">${p.connected ? (p.ping ? p.ping + 'ms' : 'online') : 'offline'}</span></div>`).join('')}</div>
      <div class="small dim">${net.status || ''}</div>`;
  }
  const body = `
    <div class="col">
      ${g.isHost ? `<button class="btn" data-a="w:save">${iconImg('save')} Save game</button><button class="btn" data-a="w:export">${iconImg('save')} Export save file</button>` : ''}
      <button class="btn" data-a="w:help">${iconImg('help')} How to play</button>
    </div>
    ${mpHtml}
    <h3>Sound</h3>
    <div class="field"><label>Effects ${Math.round(a.sfxVol * 100)}%</label><input type="range" min="0" max="100" value="${Math.round(a.sfxVol * 100)}" data-in="sfx"></div>
    <div class="field"><label>Music ${Math.round(a.musicVol * 100)}%</label><input type="range" min="0" max="100" value="${Math.round(a.musicVol * 100)}" data-in="music"></div>
    <div class="row"><button class="btn sm ${a.muted ? 'on' : ''}" data-a="w:mute">${a.muted ? 'Unmute' : 'Mute all'}</button></div>
    <h3>Display</h3>
    <div class="row wrap"><button class="btn sm ${g.view.labels ? 'on' : ''}" data-a="w:view" data-v="labels">Names</button><button class="btn sm ${g.view.zones ? 'on' : ''}" data-a="w:view" data-v="zones">Zones</button><button class="btn sm ${g.view.temps ? 'on' : ''}" data-a="w:view" data-v="temps">Temperature</button><button class="btn sm ${g.view.roofs ? 'on' : ''}" data-a="w:view" data-v="roofs">Roofs</button></div>
    <h3>Graphics</h3>
    <div class="row wrap">${([['auto', 'Auto'], ['sharp', 'Sharp'], ['fast', 'Fast']] as const).map(([k, l]) => `<button class="btn sm ${g.gfx === k ? 'on' : ''}" data-a="w:gfx" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="tiny dim">Auto lowers resolution on slower devices to keep the game smooth. Now ${g.renderer.dpr}×.</div>
    <div class="small dim" style="margin-top:8px">${GAME_NAME} v${VERSION} · ${Math.round(1000 / Math.max(1, g.frameTimes.reduce((s, x) => s + x, 0) / Math.max(1, g.frameTimes.length)))} fps budget · ${w.pawns.size} pawns</div>`;
  ui.showModal('more', `<div class="wh"><h2>Menu</h2>${closeBtn}</div><div class="wb">${body}</div><div class="wf"><button class="btn bad" data-a="w:exit">Exit to main menu</button></div>`, 'narrow');
}

function helpWindow(ui: UI) {
  const rows: [string, string][] = [
    ['Pan', 'Drag with one finger (or two fingers while using a tool)'], ['Zoom', 'Pinch, or mouse wheel'], ['Select', 'Tap a colonist, item or building. Tap again to cycle through what\'s there.'],
    ['Select many', 'Double-tap a colonist, or Orders → Select box'], ['Context actions', 'Long-press the map (right-click on desktop) with a colonist selected: equip, rescue, capture, haul…'],
    ['Combat', 'Select colonists → Draft. Then tap the ground to move, tap enemies to attack.'], ['Build', 'Build tab → pick a structure → tap or drag on the map. Walls: drag diagonally to outline a whole room!'],
    ['Zones', 'Zones tab → Stockpile / Growing zone → drag an area.'], ['Work', 'Work tab: set who does what (1 = highest priority).'], ['Research', 'Build a research bench, then pick a project in Research.'],
    ['Speed', 'Top-right buttons. Space bar pauses on desktop.'], ['Goal', 'Survive, grow, research Starflight and build a ship to escape.'],
  ];
  const tips = ['Start with: stockpile zone, a campfire + cook bill, beds under a roof, then a growing zone of rice or potatoes.', 'Walls + a door enclose a room; roofs are added automatically.', 'Colonists get sad from raw food, sleeping on the ground and ugly rooms.', 'Hunt animals for meat, but beware — some fight back!', 'In winter, crops die outdoors. Build a freezer (room + cooler) to store food.', 'Raiders flee after losing half their group. Fight from behind sandbags and walls.'];
  ui.showModal('help', `<div class="wh"><h2>How to play</h2>${closeBtn}</div><div class="wb"><div class="help-grid">${rows.map(([k, v]) => `<b class="accent">${k}</b><span>${v}</span>`).join('')}</div><h3>Tips</h3>${tips.map(t => `<div class="small" style="margin:3px 0">• ${t}</div>`).join('')}</div>`);
}

// ---------------- letters ----------------
export function openLetter(ui: UI, id: number) { ui.modalArg = id; renderWindow(ui, 'letter'); }
function letterWindow(ui: UI) {
  const g = ui.g;
  const l = g.world.letters.find(x => x.id === ui.modalArg) as Letter | undefined;
  if (!l) { ui.closeModal(); return; }
  l.read = true;
  const col = l.kind === 'threat' || l.kind === 'death' ? 'bad' : l.kind === 'good' ? 'good' : 'accent';
  ui.showModal('letter', `<div class="wh"><h2 class="${col}">${escapeHtml(l.title)}</h2>${closeBtn}</div><div class="wb"><div style="white-space:pre-line">${escapeHtml(l.text)}</div><div class="tiny dim" style="margin-top:8px">Day ${Math.floor(l.tick / TICKS_PER_DAY) + 1}</div></div>
    <div class="wf">${l.x !== undefined && l.x >= 0 ? `<button class="btn" data-a="w:letterjump">Jump to</button>` : ''}<button class="btn" data-a="w:letterdismiss">Dismiss</button><button class="btn good" data-a="closemodal">OK</button></div>`, 'narrow');
}

// ---------------- trade ----------------
export function openTrade(ui: UI, lord: number | 'orbital') { st.trade = { lord, lines: {} }; renderWindow(ui, 'trade'); }
function tradeWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const t = st.trade!;
  let stock: Item[] = [], name = 'Trader';
  if (t.lord === 'orbital') { const o = (w as any).orbital?.[g.faction]; if (!o || o.until < w.tick) { ui.closeModal(); ui.toast('No orbital trader in range.', 'bad'); return; } stock = o.stock; name = o.name; }
  else { const l = w.lords.get(t.lord); if (!l?.stock) { ui.closeModal(); return; } stock = l.stock; name = l.traderName || 'Caravan'; }
  const pf = priceFactor(w, g.faction);
  const neg = negotiator(w, g.faction);
  const mine = colonyTradeables(w, g.faction);
  const keys = new Map<string, { def: string; stuff?: string; quality?: number; have: number; theirs: number; sample: Item }>();
  for (const it of mine) { const k = tradeKey(it); const e = keys.get(k) || { def: it.def, stuff: it.stuff, quality: it.quality, have: 0, theirs: 0, sample: it }; e.have += it.count; keys.set(k, e); }
  for (const it of stock) { const k = tradeKey(it); const e = keys.get(k) || { def: it.def, stuff: it.stuff, quality: it.quality, have: 0, theirs: 0, sample: it }; e.theirs += it.count; keys.set(k, e); }
  let silver = 0;
  const rows = [...keys.entries()].filter(([k]) => !k.startsWith('silver|')).sort((a, b) => ITEMS[a[1].def].cat.localeCompare(ITEMS[b[1].def].cat) || a[1].def.localeCompare(b[1].def));
  let html = `<table class="tradeT"><tr class="tiny dim"><td></td><td>You</td><td class="center">Trade</td><td>Them</td><td>Price</td></tr>`;
  for (const [k, e] of rows) {
    const n = t.lines[k] || 0;
    const uv = unitValue(e.sample);
    const buy = Math.ceil(uv * pf.buy), sell = Math.floor(uv * pf.sell);
    if (n > 0) silver -= buy * n; else if (n < 0) silver += sell * -n;
    html += `<tr><td><img class="ico s" src="${itemIconURL(e.def, e.stuff)}"> ${escapeHtml(itemLabel({ ...e.sample, count: 1 }))}</td><td>${e.have - Math.max(0, -n)}</td>
      <td><div class="qty"><button class="btn" data-a="w:tq" data-k="${k}" data-v="${-(e.have)}">«</button><button class="btn" data-a="w:tq" data-k="${k}" data-v="-1">−</button><b class="${n > 0 ? 'good' : n < 0 ? 'warn' : ''}">${n > 0 ? '+' + n : n}</b><button class="btn" data-a="w:tq" data-k="${k}" data-v="1">+</button><button class="btn" data-a="w:tq" data-k="${k}" data-v="${e.theirs}">»</button></div></td>
      <td>${e.theirs - Math.max(0, n)}</td><td class="tiny">${buy}/${sell}</td></tr>`;
  }
  html += `</table>`;
  const mySilver = colonySilver(w, g.faction), theirSilver = stock.filter(s => s.def === 'silver').reduce((s, i) => s + i.count, 0);
  const ok = silver < 0 ? mySilver >= -silver : theirSilver >= silver;
  ui.showModal('trade', `<div class="wh"><h2>${escapeHtml(name)}</h2>${closeBtn}</div><div class="wb">
    <div class="small dim">Negotiator: ${neg ? escapeHtml(pawnShortName(neg)) + ` (Social ${skillLevel(neg, 'social')})` : 'none'}. Price shown buy/sell. Sell items from your stockpiles & home area.</div>${html}</div>
    <div class="wf" style="align-items:center"><span class="grow">Your silver: <b>${mySilver}</b> · Theirs: <b>${theirSilver}</b> · <span class="${silver >= 0 ? 'good' : 'warn'}">${silver >= 0 ? '+' : ''}${silver}</span></span><button class="btn" data-a="w:treset">Reset</button><button class="btn good ${ok ? '' : 'dis'}" data-a="w:tconfirm">Accept deal</button></div>`, 'wide');
}

// ---------------- p2p trade ----------------
function p2pWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const s = st.p2p!;
  const other = w.faction(s.to);
  const mine = colonyTradeables(w, g.faction), theirs = colonyTradeables(w, s.to);
  const group = (items: Item[]) => { const m = new Map<string, { it: Item; n: number }>(); for (const it of items) { if (it.corpse) continue; const k = tradeKey(it); const e = m.get(k) || { it, n: 0 }; e.n += it.count; m.set(k, e); } return [...m.entries()].sort((a, b) => a[1].it.def.localeCompare(b[1].it.def)); };
  const list = (arr: [string, { it: Item; n: number }][], sel: Record<string, number>, side: string) => arr.map(([k, e]) => `<div class="row small" style="padding:2px 0"><img class="ico s" src="${itemIconURL(e.it.def, e.it.stuff)}"><span class="grow">${escapeHtml(itemLabel({ ...e.it, count: 1 }))} <span class="dim">(${e.n})</span></span><button class="btn sm" data-a="w:pq" data-side="${side}" data-k="${k}" data-v="-10">−</button><b style="min-width:34px;text-align:center">${sel[k] || 0}</b><button class="btn sm" data-a="w:pq" data-side="${side}" data-k="${k}" data-v="10">+</button><button class="btn sm" data-a="w:pq" data-side="${side}" data-k="${k}" data-v="${e.n}">all</button></div>`).join('') || '<div class="dim small">Nothing in storage.</div>';
  ui.showModal('p2p', `<div class="wh"><h2>Trade with ${escapeHtml(other?.colonyName || '')}</h2>${closeBtn}</div><div class="wb">
    <div class="small dim">Offer items from your stockpiles and ask for theirs. Leave "you want" empty to send a gift. Goods travel by drop pod once accepted.</div>
    <h3>You give</h3><div class="scroll" style="max-height:28vh">${list(group(mine), s.give, 'give')}</div>
    <h3>You want</h3><div class="scroll" style="max-height:28vh">${list(group(theirs), s.want, 'want')}</div>
    <div class="field"><label>Note</label><input id="p2pnote" maxlength="120" placeholder="Optional message"></div></div>
    <div class="wf"><button class="btn good" data-a="w:p2psend">Send offer</button></div>`, 'wide');
}

// ---------------- bills ----------------
export function openBills(ui: UI, bench: number) { st.bench = bench; renderWindow(ui, 'bills'); }
function billsWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const b = w.buildings.get(st.bench!);
  if (!b || !b.bills) { ui.closeModal(); return; }
  const d = BUILDINGS[b.def];
  let html = '';
  for (const bill of b.bills) {
    const rec = RECIPES[bill.recipe];
    const stuffs = rec.special === 'stuffed' ? stuffsFor(rec.stuffCats) : [];
    html += `<div class="px" style="padding:6px;margin-bottom:6px"><div class="row"><b class="grow">${escapeHtml(rec.label)}</b><button class="btn sm" data-a="w:bup" data-id="${bill.id}">▲</button><button class="btn sm ${bill.suspended ? 'on' : ''}" data-a="w:bsusp" data-id="${bill.id}">${bill.suspended ? 'Resume' : 'Pause'}</button><button class="btn sm bad" data-a="w:bdel" data-id="${bill.id}">✕</button></div>
      <div class="row wrap small" style="margin-top:4px">${(['count', 'until', 'forever'] as const).map(m => `<button class="btn sm ${bill.mode === m ? 'on' : ''}" data-a="w:bmode" data-id="${bill.id}" data-v="${m}">${m === 'count' ? 'Do X times' : m === 'until' ? 'Until you have X' : 'Forever'}</button>`).join('')}
      ${bill.mode !== 'forever' ? `<button class="btn sm" data-a="w:bt" data-id="${bill.id}" data-v="-5">−5</button><button class="btn sm" data-a="w:bt" data-id="${bill.id}" data-v="-1">−</button><b>${bill.mode === 'count' ? `${bill.done}/` : ''}${bill.target}</b><button class="btn sm" data-a="w:bt" data-id="${bill.id}" data-v="1">+</button><button class="btn sm" data-a="w:bt" data-id="${bill.id}" data-v="5">+5</button>` : ''}</div>
      ${stuffs.length ? `<div class="row wrap small" style="margin-top:4px"><span class="dim">Material:</span><button class="btn sm ${!bill.stuff ? 'on' : ''}" data-a="w:bstuff" data-id="${bill.id}" data-v="">Any</button>${stuffs.map(s => `<button class="btn sm ${bill.stuff === s ? 'on' : ''}" data-a="w:bstuff" data-id="${bill.id}" data-v="${s}">${escapeHtml(ITEMS[s].label)}</button>`).join('')}</div>` : ''}
      <div class="tiny dim" style="margin-top:3px">Needs: ${rec.ings.map(i => `${i.count} ${i.label}`).join(', ')} · ${rec.skill}${rec.minSkill ? ' ' + rec.minSkill + '+' : ''}</div></div>`;
  }
  const avail = d.bench!.recipes.map(r => RECIPES[r]).filter(Boolean);
  const add = avail.map(r => { const locked = r.research && !isResearched(w, g.faction, r.research); return `<button class="btn sm ${locked ? 'dis' : ''}" data-a="w:badd" data-v="${r.id}">${locked ? '🔒 ' : '+ '}${escapeHtml(r.label)}</button>`; }).join('');
  ui.showModal('bills', `<div class="wh"><h2>Bills: ${escapeHtml(d.label)}</h2>${closeBtn}</div><div class="wb">${html || '<div class="dim">No bills yet. Add one below — colonists with the right work type will do them.</div>'}<h3>Add bill</h3><div class="row wrap">${add}</div></div>`);
}

// ---------------- beds & storage ----------------
export function openAssignBed(ui: UI, bed: number) { st.bed = bed; renderWindow(ui, 'assign'); }
function assignWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const b = w.buildings.get(st.bed!);
  if (!b) { ui.closeModal(); return; }
  const cands = b.prison ? [...w.pawns.values()].filter(p => p.guest?.prisoner && p.guest.host === g.faction) : w.colonists(g.faction);
  const html = cands.map(p => `<div class="row" style="padding:3px 0"><img class="ico" src="${portraitURL(p)}"><span class="grow">${escapeHtml(pawnShortName(p))}${p.bed === b.id ? ' <span class="good">(owner)</span>' : p.bed ? ' <span class="dim">(has bed)</span>' : ''}</span><button class="btn sm ${p.bed === b.id ? 'on' : ''}" data-a="w:assignp" data-v="${p.id}">Assign</button></div>`).join('');
  ui.showModal('assign', `<div class="wh"><h2>Assign owner</h2>${closeBtn}</div><div class="wb">${html}</div><div class="wf"><button class="btn" data-a="w:assignp" data-v="0">Unassign all</button></div>`, 'narrow');
}
export function openStorage(ui: UI, id: number) { st.store = id; renderWindow(ui, 'storage'); }
function storageWindow(ui: UI) {
  const g = ui.g, w = g.world;
  const b = w.buildings.get(st.store!);
  if (!b || !b.filter) { ui.closeModal(); return; }
  const cats = ['resource', 'raw_food', 'meal', 'medicine', 'weapon', 'apparel', 'textile', 'animal_product', 'feed', 'drug', 'chunk', 'misc'];
  ui.showModal('storage', `<div class="wh"><h2>Storage</h2>${closeBtn}</div><div class="wb"><h3>Priority</h3><div class="row wrap">${[1, 2, 3, 4, 5].map(p => `<button class="btn sm ${b.priority === p ? 'on' : ''}" data-a="w:sprio" data-v="${p}">${PRIORITY_LABELS[p]}</button>`).join('')}</div>
    <h3>Allowed</h3><div class="row wrap">${cats.map(c => `<button class="btn sm ${b.filter!.cats.includes(c) ? 'on' : ''}" data-a="w:scat" data-v="${c}">${cap(c.replace('_', ' '))}</button>`).join('')}</div></div>`, 'narrow');
}

// ---------------- actions ----------------
export function windowAction(ui: UI, a: string, el: HTMLElement) {
  const g = ui.g, w = g.world;
  const d = el.dataset;
  g.audio.play('click');
  const again = () => renderWindow(ui, ui.modalKind);
  switch (a) {
    case 'tab': st.tab = d.v!; again(); break;
    case 'work': {
      const p = w.pawns.get(+d.p!); if (!p) break;
      const cur = p.work[d.w as keyof Pawn['work']] || 0;
      const next = cur === 0 ? 1 : cur === 4 ? 0 : cur + 1;
      g.cmd({ c: 'work', pawn: p.id, wt: d.w, prio: next });
      setTimeout(again, 50); break;
    }
    case 'paint': st.paint = d.v; again(); break;
    case 'sched': g.cmd({ c: 'schedule', pawn: +d.p!, hour: +d.h!, val: st.paint || 'W' }); setTimeout(again, 50); break;
    case 'schedall': { const p = w.pawns.get(+d.p!); if (p) for (const o of w.colonists(g.faction)) g.cmd({ c: 'schedule', pawn: o.id, all: p.schedule }); setTimeout(again, 60); break; }
    case 'rsel': st.rsel = d.v; again(); break;
    case 'rstart': g.cmd({ c: 'research', id: d.v }); setTimeout(again, 60); break;
    case 'rstop': g.cmd({ c: 'research', id: null }); setTimeout(again, 60); break;
    case 'jump': { const p = w.pawns.get(+d.id!); if (p) { g.select([p.id]); g.jumpTo(p.x, p.y); ui.closeModal(); } break; }
    case 'jumpcolony': { const pl = w.playerByFaction(+d.v!); if (pl?.startX !== undefined) { g.jumpTo(pl.startX, pl.startY!); ui.closeModal(); } break; }
    case 'diplo': g.cmd({ c: 'diplo', target: +d.v!, op: d.op }); setTimeout(again, 80); break;
    case 'p2p': st.p2p = { to: +d.v!, give: {}, want: {} }; renderWindow(ui, 'p2p'); break;
    case 'pq': { const s = st.p2p!; const side = d.side === 'give' ? s.give : s.want; side[d.k!] = Math.max(0, (side[d.k!] || 0) + +d.v!); renderWindow(ui, 'p2p'); break; }
    case 'p2psend': {
      const s = st.p2p!;
      const note = (document.getElementById('p2pnote') as HTMLInputElement)?.value || '';
      const give = Object.entries(s.give).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }));
      const want = Object.entries(s.want).filter(([, n]) => n > 0).map(([key, n]) => ({ key, n }));
      if (!give.length && !want.length) { ui.toast('Choose something to trade', 'bad'); break; }
      g.cmd({ c: 'p2p_offer', to: s.to, give, want, note });
      ui.toast('Offer sent', 'good'); st.tab = 'factions'; openWindow(ui, 'colony'); st.tab = 'factions'; renderWindow(ui, 'colony');
      break;
    }
    case 'p2presp': g.cmd({ c: 'p2p_respond', id: +d.id!, accept: d.v === '1' }); setTimeout(again, 100); break;
    case 'chatsend': sendChat(ui); break;
    case 'openletter': openLetter(ui, +d.id!); break;
    case 'letterjump': { const l = w.letters.find(x => x.id === ui.modalArg); if (l && l.x !== undefined) { g.jumpTo(l.x, l.y!); if (l.thing && w.things.has(l.thing)) g.select([l.thing]); } ui.closeModal(); break; }
    case 'letterdismiss': { ui.letterQueue = ui.letterQueue.filter(id => id !== ui.modalArg); ui.renderLetters(); ui.closeModal(); break; }
    case 'tq': {
      const t = st.trade!;
      const cur = t.lines[d.k!] || 0;
      const v = +d.v!;
      let n = Math.abs(v) > 1 ? v : cur + v;
      t.lines[d.k!] = n;
      renderWindow(ui, 'trade'); break;
    }
    case 'treset': st.trade!.lines = {}; renderWindow(ui, 'trade'); break;
    case 'tconfirm': {
      const t = st.trade!;
      const lines = Object.entries(t.lines).filter(([, n]) => n).map(([key, n]) => ({ key, n }));
      g.cmdAsync({ c: 'trade', lord: t.lord, lines }).then(r => { if (r.ok) { t.lines = {}; renderWindow(ui, 'trade'); } });
      break;
    }
    case 'badd': g.cmd({ c: 'bill', op: 'add', bench: st.bench, recipe: d.v }); setTimeout(again, 60); break;
    case 'bdel': g.cmd({ c: 'bill', op: 'remove', bench: st.bench, bill: +d.id! }); setTimeout(again, 60); break;
    case 'bup': g.cmd({ c: 'bill', op: 'up', bench: st.bench, bill: +d.id! }); setTimeout(again, 60); break;
    case 'bsusp': { const b = w.buildings.get(st.bench!); const bill = b?.bills?.find(x => x.id === +d.id!); if (bill) g.cmd({ c: 'bill', op: 'update', bench: st.bench, bill: bill.id, data: { suspended: !bill.suspended } }); setTimeout(again, 60); break; }
    case 'bmode': g.cmd({ c: 'bill', op: 'update', bench: st.bench, bill: +d.id!, data: { mode: d.v } }); setTimeout(again, 60); break;
    case 'bt': { const b = w.buildings.get(st.bench!); const bill = b?.bills?.find(x => x.id === +d.id!); if (bill) g.cmd({ c: 'bill', op: 'update', bench: st.bench, bill: bill.id, data: { target: Math.max(1, bill.target + +d.v!) } }); setTimeout(again, 60); break; }
    case 'bstuff': g.cmd({ c: 'bill', op: 'update', bench: st.bench, bill: +d.id!, data: { stuff: d.v || null } }); setTimeout(again, 60); break;
    case 'assignp': g.cmd({ c: 'bed_owner', bed: st.bed, pawn: +d.v! || 0 }); setTimeout(again, 60); break;
    case 'sprio': g.cmd({ c: 'bld', id: st.store, op: 'priority', value: +d.v! }); setTimeout(again, 60); break;
    case 'scat': { const b = w.buildings.get(st.store!); if (b?.filter) { const c = d.v!; const cats = b.filter.cats.includes(c) ? b.filter.cats.filter(x => x !== c) : [...b.filter.cats, c]; g.cmd({ c: 'bld', id: b.id, op: 'filter', value: { cats } }); } setTimeout(again, 60); break; }
    case 'save': saveToDb('save:' + w.seed + ':' + Date.now(), w, { colony: w.playerByFaction(g.faction)?.colonyName }).then(() => ui.toast('Game saved', 'good')).catch(e => ui.toast('Save failed: ' + e, 'bad')); break;
    case 'export': exportSave(w).then(blob => { const a2 = document.createElement('a'); a2.href = URL.createObjectURL(blob); a2.download = `starfall-day${w.day + 1}.sfsave`; a2.click(); }); break;
    case 'help': renderWindow(ui, 'help'); break;
    case 'mute': g.audio.muted = !g.audio.muted; g.audio.applyVolumes(); g.audio.saveSettings(); again(); break;
    case 'view': (g.view as any)[d.v!] = !(g.view as any)[d.v!]; again(); break;
    case 'gfx': g.setGfx(d.v as any); again(); break;
    case 'copylink': { const url = location.origin + location.pathname + '?join=' + encodeURIComponent(g.net?.roomCode || ''); navigator.clipboard?.writeText(url).then(() => ui.toast('Invite link copied', 'good')).catch(() => prompt('Copy this link:', url)); break; }
    case 'exit': if (confirm(g.isHost ? 'Exit to main menu? The game autosaves each day; save first if you want your latest progress.' : 'Leave this game?')) { ui.closeModal(); g.onExit?.(); } break;
  }
}

export function windowInput(ui: UI, a: string, el: HTMLInputElement, type: string) {
  const g = ui.g;
  if (a === 'sfx') { g.audio.sfxVol = +el.value / 100; g.audio.applyVolumes(); g.audio.saveSettings(); }
  if (a === 'music') { g.audio.musicVol = +el.value / 100; g.audio.applyVolumes(); g.audio.saveSettings(); }
  if (a === 'chat' && type === 'change') sendChat(ui);
}
function sendChat(ui: UI) {
  const inp = document.getElementById('chatin') as HTMLInputElement | null;
  if (!inp || !inp.value.trim()) return;
  ui.g.cmd({ c: 'chat', text: inp.value.trim() });
  inp.value = '';
  setTimeout(() => updateChatLog(ui), 100);
}
export { WORK_TYPES, listSaves };
