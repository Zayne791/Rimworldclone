// The research tree: a pannable, zoomable map of every project. Columns are tiers grouped into
// eras, rows are branch lanes. Built once per open; later refreshes only patch node state.
import type { UI } from './ui';
import { itemIconURL } from './ui';
import { floorURL } from './drawers';
import { RESEARCH, BRANCHES, ERAS, eraOf, type Branch } from '../data/research';
import { BUILDINGS } from '../data/buildings';
import { canStartResearch, unlocksOf, effectsOf, hasHiTechBench, type Unlock } from '../sim/research';
import { researchPath } from '../sim/commands';
import { iconURL, iconImg } from '../render/art/icons';
import { escapeHtml, fmtNum } from '../core/util';

const NW = 158, NH = 58, CG = 62, RG = 10, LANE_PAD = 12, LANE_TOP = 30, TOP = 24, LEFT = 20;
const BR = Object.fromEntries(BRANCHES.map(b => [b.id, b])) as Record<Branch, typeof BRANCHES[number]>;

interface Pos { x: number; y: number }
interface Layout { pos: Record<string, Pos>; lanes: { id: Branch; y: number; h: number }[]; W: number; H: number; maxTier: number; kids: Record<string, string[]> }
let LAYOUT: Layout | null = null;

function layout(): Layout {
  if (LAYOUT) return LAYOUT;
  const nodes = Object.values(RESEARCH);
  const maxTier = Math.max(...nodes.map(n => n.tier));
  const kids: Record<string, string[]> = {};
  for (const n of nodes) for (const p of n.prereqs) (kids[p] ||= []).push(n.id);
  const pos: Record<string, Pos> = {};
  const lanes: Layout['lanes'] = [];
  let y = TOP;
  for (const b of BRANCHES) {
    const cols: string[][] = [];
    for (let t = 0; t <= maxTier; t++) cols.push(nodes.filter(n => n.branch === b.id && n.tier === t).map(n => n.id));
    const rows = Math.max(1, ...cols.map(c => c.length));
    const row: Record<string, number> = {};
    // order each column by the rows of same-lane prerequisites (fewer crossing lines), then declaration order
    for (const col of cols) {
      const want = col.map((id, k) => {
        const own = RESEARCH[id].prereqs.filter(p => row[p] !== undefined);
        return { id, v: own.length ? own.reduce((s, p) => s + row[p], 0) / own.length : k * (rows / Math.max(1, col.length)) };
      }).sort((a, c) => a.v - c.v);
      let last = -1;
      const placed = want.map(o => (last = Math.max(last + 1, Math.round(o.v))));
      const over = (placed[placed.length - 1] ?? 0) - (rows - 1);
      want.forEach((o, k) => { row[o.id] = Math.max(k, placed[k] - Math.max(0, over)); });
    }
    const top = y + LANE_TOP;
    for (const id in row) pos[id] = { x: LEFT + RESEARCH[id].tier * (NW + CG), y: top + row[id] * (NH + RG) };
    const h = rows * (NH + RG) - RG + LANE_TOP + LANE_PAD;
    lanes.push({ id: b.id, y, h });
    y += h;
  }
  LAYOUT = { pos, lanes, W: LEFT * 2 + (maxTier + 1) * (NW + CG) - CG, H: y + 10, maxTier, kids };
  return LAYOUT;
}

const view = { x: 0, y: 0, z: 1, sel: '' as string, branch: '' as string, q: '', init: false };
const defaultStuff = (id: string) => { const c = BUILDINGS[id].stuffCats; return !c ? '' : c.includes('woody') ? 'wood' : c.includes('metallic') ? 'steel' : c.includes('stony') ? 'blocks_marble' : 'cloth'; };
function unlockIcon(u: Unlock): string {
  if (u.kind === 'building') return iconURL('bld:' + u.id + ':' + defaultStuff(u.id), 2);
  if (u.kind === 'item') return itemIconURL(u.id);
  if (u.kind === 'floor') return floorURL(u.id);
  if (u.kind === 'plant') return iconURL('grow', 2);
  return iconURL('work', 2);
}
function nodeIcon(id: string): string {
  const u = unlocksOf(id);
  const pick = u.find(k => k.kind === 'building') || u.find(k => k.kind === 'item') || u.find(k => k.kind === 'floor') || u.find(k => k.kind === 'plant');
  return pick ? unlockIcon(pick) : iconURL(RESEARCH[id].effects ? 'star' : BR[RESEARCH[id].branch as Branch].icon, 2);
}

function edgePath(a: Pos, b: Pos): string {
  const x0 = a.x + NW, y0 = a.y + NH / 2, x1 = b.x, y1 = b.y + NH / 2;
  const dx = Math.max(26, (x1 - x0) * 0.5);
  return `M${x0} ${y0}C${x0 + dx} ${y0} ${x1 - dx} ${y1} ${x1} ${y1}`;
}

function worldHtml(): string {
  const L = layout();
  let bg = '';
  ERAS.forEach((e, k) => {
    const x0 = LEFT - CG / 2 + e.tiers[0] * (NW + CG), x1 = Math.min(L.W, LEFT - CG / 2 + (e.tiers[e.tiers.length - 1] + 1) * (NW + CG));
    bg += `<div class="tt-era" style="left:${Math.max(0, x0)}px;width:${x1 - Math.max(0, x0)}px;height:${L.H}px;--ec:${e.color}${k % 2 ? ';opacity:.7' : ''}"></div>`;
  });
  for (const ln of L.lanes) bg += `<div class="tt-lane" style="top:${ln.y}px;height:${ln.h}px;width:${L.W}px;--bc:${BR[ln.id].color}"></div>`;
  let svg = `<svg class="tt-edges" width="${L.W}" height="${L.H}">`;
  for (const n of Object.values(RESEARCH)) for (const p of n.prereqs) svg += `<path data-f="${p}" data-t="${n.id}" d="${edgePath(L.pos[p], L.pos[n.id])}"/>`;
  svg += `</svg>`;
  let nodes = '';
  for (const n of Object.values(RESEARCH)) {
    const p = L.pos[n.id];
    const nu = unlocksOf(n.id).length;
    nodes += `<div class="tt-node" id="tt-${n.id}" data-a="w:ttsel" data-v="${n.id}" style="left:${p.x}px;top:${p.y}px;--bc:${BR[n.branch as Branch].color}">`
      + `<img class="tt-ic" src="${nodeIcon(n.id)}" alt="" draggable="false">`
      + `<div class="tt-tx"><b>${escapeHtml(n.label)}</b><span class="tt-sub">${fmtNum(n.cost)}${nu ? ` · ${nu} unlock${nu > 1 ? 's' : ''}` : ''}${n.effects ? ' · ★' : ''}</span></div>`
      + `<div class="tt-pb"><i></i></div><span class="tt-qn"></span></div>`;
  }
  return `<div class="tt-world" style="width:${L.W}px;height:${L.H}px">${bg}${svg}${nodes}</div>`;
}

let SHELL = '';
function shell(): string {
  if (SHELL) return SHELL;
  const chips = `<button class="btn sm tt-br" data-a="w:ttbr" data-v="">All</button>` + BRANCHES.map(b => `<button class="btn sm tt-br" data-a="w:ttbr" data-v="${b.id}" style="--bc:${b.color}">${iconImg(b.icon, 'ico s', 2)}${escapeHtml(b.label)}</button>`).join('');
  SHELL = `<div class="wh tt-head"><h2>Research</h2><span class="tt-stat small dim"></span><div class="grow"></div>
    <input class="tt-search" type="search" placeholder="Search" autocomplete="off" enterkeyhint="search">
    <button class="btn sm" data-a="w:ttzoom" data-v="-1" aria-label="zoom out">−</button><button class="btn sm" data-a="w:ttzoom" data-v="1" aria-label="zoom in">+</button><button class="btn sm" data-a="w:ttfit">Fit</button>
    <button class="btn sm" data-a="closemodal">${iconImg('close', 'ico s')}</button></div>
    <div class="tt-chips">${chips}</div>
    <div class="tt-cur"></div>
    <div class="tt-view"><div class="tt-pan">${worldHtml()}</div><div class="tt-eras"></div><div class="tt-lanes"></div></div>
    <div class="tt-detail"></div>`;
  return SHELL;
}

// ---------------- camera ----------------
function el<T extends HTMLElement = HTMLElement>(ui: UI, sel: string): T | null { return ui.modal?.querySelector(sel) as T | null; }
function clampView(ui: UI) {
  const v = el(ui, '.tt-view'); if (!v) return;
  const L = layout();
  const vw = v.clientWidth, vh = v.clientHeight;
  view.z = Math.max(0.22, Math.min(1.6, view.z));
  const w = L.W * view.z, h = L.H * view.z;
  view.x = w < vw ? (vw - w) / 2 : Math.min(40, Math.max(vw - w - 40, view.x));
  view.y = h < vh ? (vh - h) / 2 : Math.min(40, Math.max(vh - h - 40, view.y));
}
function applyView(ui: UI) {
  clampView(ui);
  const pan = el(ui, '.tt-pan'); if (!pan) return;
  pan.style.transform = `translate(${Math.round(view.x)}px,${Math.round(view.y)}px) scale(${view.z})`;
  const L = layout();
  const eras = el(ui, '.tt-eras');
  if (eras) eras.innerHTML = ERAS.map(e => {
    const x0 = LEFT - CG / 2 + e.tiers[0] * (NW + CG), x1 = LEFT - CG / 2 + (e.tiers[e.tiers.length - 1] + 1) * (NW + CG);
    const l = Math.max(0, view.x + x0 * view.z), r = view.x + x1 * view.z;
    return r - l < 24 ? '' : `<div style="left:${l}px;width:${r - l}px;--ec:${e.color}">${r - l > 70 ? escapeHtml(e.label) : ''}</div>`;
  }).join('');
  const lanes = el(ui, '.tt-lanes');
  if (lanes) lanes.innerHTML = L.lanes.map(ln => {
    const top = view.y + ln.y * view.z, stuck = top < 22;
    return `<div style="top:${stuck ? Math.min(22, view.y + (ln.y + ln.h) * view.z - 24) : top}px;--bc:${BR[ln.id].color}"><span>${iconImg(BR[ln.id].icon, 'ico s', 2)}${view.z > 0.45 && !stuck ? escapeHtml(BR[ln.id].label) : ''}</span></div>`;
  }).join('');
}
function centerOn(ui: UI, id: string, z?: number) {
  const v = el(ui, '.tt-view'); const p = layout().pos[id]; if (!v || !p) return;
  if (z) view.z = z;
  view.x = v.clientWidth / 2 - (p.x + NW / 2) * view.z;
  view.y = v.clientHeight / 2 - (p.y + NH / 2) * view.z;
  applyView(ui);
}
function zoomAt(ui: UI, f: number, cx: number, cy: number) {
  const z0 = view.z, z1 = Math.max(0.22, Math.min(1.6, z0 * f));
  view.x = cx - (cx - view.x) * (z1 / z0); view.y = cy - (cy - view.y) * (z1 / z0); view.z = z1;
  applyView(ui);
}
function fit(ui: UI) {
  const v = el(ui, '.tt-view'); if (!v) return;
  const L = layout();
  view.z = Math.min(v.clientWidth / L.W, v.clientHeight / L.H);
  applyView(ui);
}

function bindGestures(ui: UI) {
  const v = el(ui, '.tt-view');
  if (!v || v.dataset.bound) return;
  v.dataset.bound = '1';
  const pts = new Map<number, { x: number; y: number }>();
  let moved = 0, last: { x: number; y: number; d: number } | null = null;
  const mid = () => { const a = [...pts.values()]; const r = v.getBoundingClientRect(); const x = a.reduce((s, p) => s + p.x, 0) / a.length - r.left, y = a.reduce((s, p) => s + p.y, 0) / a.length - r.top; const d = a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0; return { x, y, d }; };
  v.addEventListener('pointerdown', e => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) moved = 0; last = mid(); });
  v.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = mid();
    if (last) {
      moved += Math.abs(m.x - last.x) + Math.abs(m.y - last.y);
      if (moved > 6) {
        if (!v.hasPointerCapture(e.pointerId)) try { v.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        view.x += m.x - last.x; view.y += m.y - last.y;
        if (pts.size > 1 && last.d > 0 && m.d > 0) { const z0 = view.z, z1 = Math.max(0.22, Math.min(1.6, z0 * m.d / last.d)); view.x = m.x - (m.x - view.x) * (z1 / z0); view.y = m.y - (m.y - view.y) * (z1 / z0); view.z = z1; }
        applyView(ui);
      }
    }
    last = m;
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); last = pts.size ? mid() : null; };
  v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  // a drag must not also count as a tap on the node under the finger
  v.addEventListener('click', e => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  v.addEventListener('wheel', e => {
    e.preventDefault();
    const r = v.getBoundingClientRect();
    if (e.ctrlKey || Math.abs(e.deltaY) > 40 && !e.deltaX && e.deltaMode === 0 && !e.shiftKey) zoomAt(ui, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    else { view.x -= e.deltaX || (e.shiftKey ? e.deltaY : 0); view.y -= e.shiftKey ? 0 : e.deltaY; applyView(ui); }
  }, { passive: false });
  const search = el<HTMLInputElement>(ui, '.tt-search');
  if (search) {
    search.value = view.q;
    search.addEventListener('input', () => { view.q = search.value.trim().toLowerCase(); patch(ui, true); });
    search.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const hit = Object.values(RESEARCH).find(r => matches(r.id));
      if (hit) { view.sel = hit.id; centerOn(ui, hit.id, Math.max(view.z, 0.8)); patch(ui, true); }
      search.blur();
    });
  }
  window.addEventListener('resize', () => applyView(ui), { once: true });
}
function matches(id: string): boolean {
  if (!view.q) return false;
  const r = RESEARCH[id];
  return r.label.toLowerCase().includes(view.q) || unlocksOf(id).some(u => u.label.toLowerCase().includes(view.q));
}

// ---------------- state patching ----------------
let lastSig = '';
function patch(ui: UI, force = false) {
  const g = ui.g, w = g.world, f = g.faction;
  const rs = w.research[f] || { cur: null, prog: {}, done: [] };
  const queue = rs.queue || [];
  const sel = view.sel || rs.cur || '';
  const sig = [rs.done.length, rs.cur, queue.join(','), sel, view.branch, view.q, Math.round((rs.cur ? rs.prog[rs.cur] || 0 : 0) / 5)].join('|');
  if (!force && sig === lastSig) return;
  lastSig = sig;
  const done = new Set(rs.done);
  // highlight: everything the selection needs (gold) and everything it leads to (blue)
  const need = new Set<string>(), lead = new Set<string>();
  if (sel) {
    const up = (id: string) => { for (const p of RESEARCH[id].prereqs) if (!need.has(p)) { need.add(p); up(p); } };
    const down = (id: string) => { for (const k of layout().kids[id] || []) if (!lead.has(k)) { lead.add(k); down(k); } };
    up(sel); down(sel);
  }
  for (const n of Object.values(RESEARCH)) {
    const node = el(ui, '#tt-' + n.id); if (!node) continue;
    const isDone = done.has(n.id), can = !isDone && n.prereqs.every(p => done.has(p));
    const qi = queue.indexOf(n.id);
    const cls = ['tt-node', isDone ? 'done' : can ? 'avail' : 'locked'];
    if (rs.cur === n.id) cls.push('cur');
    if (qi >= 0) cls.push('queued');
    if (n.id === sel) cls.push('sel');
    else if (need.has(n.id)) cls.push('need');
    else if (lead.has(n.id)) cls.push('lead');
    if (view.branch && n.branch !== view.branch && n.id !== sel) cls.push('dim');
    if (view.q) cls.push(matches(n.id) ? 'hit' : 'dim');
    const c = cls.join(' ');
    if (node.className !== c) node.className = c;
    const pr = isDone ? 1 : (rs.prog[n.id] || 0) / n.cost;
    const bar = node.querySelector('.tt-pb > i') as HTMLElement;
    const wv = Math.round(pr * 100) + '%';
    if (bar.style.width !== wv) bar.style.width = wv;
    const qn = node.querySelector('.tt-qn') as HTMLElement;
    const qt = qi >= 0 ? String(qi + 1) : rs.cur === n.id ? '▶' : '';
    if (qn.textContent !== qt) qn.textContent = qt;
  }
  const svg = el(ui, '.tt-edges');
  if (svg) for (const pth of svg.querySelectorAll('path')) {
    const a = (pth as SVGPathElement).dataset.f!, b = (pth as SVGPathElement).dataset.t!;
    const hot = sel && ((need.has(a) || a === sel) && (need.has(b) || b === sel));
    const fwd = sel && ((a === sel || lead.has(a)) && lead.has(b));
    const cls = hot ? 'hot' : fwd ? 'fwd' : done.has(a) && done.has(b) ? 'done' : done.has(a) ? 'open' : '';
    const dimmed = view.branch && RESEARCH[a].branch !== view.branch && RESEARCH[b].branch !== view.branch && !hot && !fwd;
    const c = cls + (dimmed ? ' dim' : '');
    if (pth.getAttribute('class') !== c) pth.setAttribute('class', c);
  }
  // header stats, current project and queue
  const stat = el(ui, '.tt-stat');
  if (stat) stat.textContent = `${rs.done.length}/${Object.keys(RESEARCH).length} complete`;
  for (const b of ui.modal?.querySelectorAll('.tt-br') || []) (b as HTMLElement).classList.toggle('on', ((b as HTMLElement).dataset.v || '') === view.branch);
  const cur = el(ui, '.tt-cur');
  if (cur) {
    const benches = [...w.buildings.values()].some(b => b.faction === f && BUILDINGS[b.def].bench?.research);
    let h = '';
    if (rs.cur) {
      const r = RESEARCH[rs.cur], p = (rs.prog[rs.cur] || 0) / r.cost;
      h += `<div class="tt-now" data-a="w:ttsel" data-v="${r.id}"><img class="tt-ic" src="${nodeIcon(r.id)}" alt=""><div class="grow"><b>${escapeHtml(r.label)}</b> <span class="dim small">${fmtNum(Math.floor(rs.prog[rs.cur] || 0))} / ${fmtNum(r.cost)}</span><div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div></div></div>`;
    } else h += `<div class="tt-now idle small">${benches ? '<span class="warn">No project selected.</span> Pick one below, or queue a far-off goal and its prerequisites will be researched in order.' : '<span class="warn">Build a research bench</span> (Build → Production) so your colonists can study.'}</div>`;
    if (queue.length) h += `<div class="tt-queue"><span class="tiny dim">Next:</span>${queue.map((q, k) => `<span class="chip" data-a="w:ttsel" data-v="${q}">${k + 1}. ${escapeHtml(RESEARCH[q].label)}<b data-a="w:ttunq" data-v="${q}">×</b></span>`).join('')}<button class="btn sm" data-a="w:ttclear">Clear</button></div>`;
    if (cur.innerHTML !== h) cur.innerHTML = h;
  }
  const det = el(ui, '.tt-detail');
  if (det) det.innerHTML = sel ? detailHtml(ui, sel) : `<div class="dim small">Tap a project to see what it unlocks. Drag to pan, pinch or use +/− to zoom. Queue a distant project and your researchers will work through its whole prerequisite chain.</div>`;
}

function detailHtml(ui: UI, id: string): string {
  const g = ui.g, w = g.world, f = g.faction;
  const rs = w.research[f] || { cur: null, prog: {}, done: [] };
  const r = RESEARCH[id];
  const done = rs.done.includes(id);
  const can = canStartResearch(w, f, id);
  const br = BR[r.branch as Branch];
  const era = ERAS[eraOf(r.tier)];
  const prog = rs.prog[id] || 0;
  const unl = unlocksOf(id), fx = effectsOf(id);
  const kids = layout().kids[id] || [];
  const chip = (p: string) => `<span class="chip ${rs.done.includes(p) ? 'ok' : ''}" data-a="w:ttsel" data-v="${p}">${rs.done.includes(p) ? '✔ ' : ''}${escapeHtml(RESEARCH[p].label)}</span>`;
  const path = done ? [] : researchPath(w, f, id);
  const queued = (rs.queue || []).includes(id);
  let btns = '';
  if (done) btns = `<span class="good pix">✔ Researched</span>`;
  else if (rs.cur === id) btns = `<button class="btn" data-a="w:ttstop">Stop</button>`;
  else {
    if (can) btns += `<button class="btn good" data-a="w:ttstart" data-v="${id}">Research now</button>`;
    if (!queued) btns += `<button class="btn" data-a="w:ttqueue" data-v="${id}">${can ? 'Add to queue' : `Queue path (${path.length})`}</button>`;
    else btns += `<button class="btn" data-a="w:ttunq" data-v="${id}">Unqueue</button>`;
  }
  const hi = r.hiTech && !done ? `<div class="tiny ${hasHiTechBench(w, f) ? 'dim' : 'warn'}">Needs a hi-tech research bench${hasHiTechBench(w, f) ? '' : ' (you have none yet)'}.</div>` : '';
  return `<div class="tt-dh"><img class="tt-ic l" src="${nodeIcon(id)}" alt=""><div class="grow"><div class="tt-dt">${escapeHtml(r.label)}</div>
      <div class="tiny"><span class="tt-tag" style="--bc:${br.color}">${escapeHtml(br.label)}</span> <span class="tt-tag" style="--bc:${era.color}">${escapeHtml(era.label)} era</span> <span class="dim">${done ? 'complete' : `${fmtNum(Math.floor(prog))} / ${fmtNum(r.cost)} pts`}</span></div></div>
      <div class="tt-btns">${btns}</div></div>
    ${!done && prog > 0 ? `<div class="bar"><i style="width:${Math.round(prog / r.cost * 100)}%"></i></div>` : ''}
    <div class="small tt-desc">${escapeHtml(r.desc)}</div>${hi}
    ${unl.length ? `<div class="tt-sec">Unlocks</div><div class="tt-unl">${unl.map(u => `<div class="tt-u" title="${escapeHtml(u.label)}"><img src="${unlockIcon(u)}" alt=""><span>${escapeHtml(u.label)}</span></div>`).join('')}</div>` : ''}
    ${fx.length ? `<div class="tt-sec">Colony bonus</div><div class="tt-fx">${fx.map(t => `<span class="chip good">★ ${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    ${r.prereqs.length ? `<div class="tt-sec">Requires</div><div>${r.prereqs.map(chip).join('')}</div>` : ''}
    ${kids.length ? `<div class="tt-sec">Leads to</div><div>${kids.map(chip).join('')}</div>` : ''}`;
}

// ---------------- entry points ----------------
export function techTreeWindow(ui: UI) {
  const fresh = !el(ui, '.tt-view') || ui.modalKind !== 'research';
  ui.showModal('research', shell(), 'tt-win');
  bindGestures(ui);
  if (fresh) {
    lastSig = '';
    const rs = ui.g.world.research[ui.g.faction];
    requestAnimationFrame(() => {
      if (!view.init) { view.init = true; view.z = window.innerWidth < 600 ? 0.62 : 0.8; }
      const focus = view.sel || rs?.cur || Object.values(RESEARCH).find(r => canStartResearch(ui.g.world, ui.g.faction, r.id))?.id;
      if (focus) centerOn(ui, focus); else applyView(ui);
    });
  }
  patch(ui, fresh);
}

export function techTreeAction(ui: UI, a: string, d: DOMStringMap): boolean {
  const g = ui.g;
  const later = () => setTimeout(() => patch(ui, true), 80);
  switch (a) {
    case 'ttsel': if (view.sel === d.v) { centerOn(ui, d.v!); } view.sel = d.v || ''; patch(ui, true); return true;
    case 'ttstart': g.cmd({ c: 'research', id: d.v }); later(); return true;
    case 'ttstop': g.cmd({ c: 'research', id: null }); later(); return true;
    case 'ttqueue': g.cmd({ c: 'research', id: d.v, queue: true }); ui.toast(`Queued ${RESEARCH[d.v!].label}`, 'good'); later(); return true;
    case 'ttunq': g.cmd({ c: 'research', unqueue: d.v }); later(); return true;
    case 'ttclear': g.cmd({ c: 'research', clearQueue: true }); later(); return true;
    case 'ttbr': {
      view.branch = view.branch === d.v ? '' : d.v || '';
      const ln = layout().lanes.find(l => l.id === view.branch);
      const v = el(ui, '.tt-view');
      if (ln && v) { view.y = v.clientHeight * 0.1 - ln.y * view.z; applyView(ui); }
      patch(ui, true); return true;
    }
    case 'ttzoom': { const v = el(ui, '.tt-view'); if (v) zoomAt(ui, +d.v! > 0 ? 1.25 : 0.8, v.clientWidth / 2, v.clientHeight / 2); return true; }
    case 'ttfit': fit(ui); return true;
  }
  return false;
}
