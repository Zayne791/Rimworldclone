// HUD controller: top bar, colonist bar, letters, alerts, bottom tabs, drawers, sheets, modals, toasts.
import type { Game, CtxOption } from '../game';
import type { Pawn, Letter } from '../sim/types';
import { iconImg, iconURL } from '../render/art/icons';
import { spriteToDataURL } from '../render/pixel';
import { portraitSprite } from '../render/art/pawns';
import { itemSprite } from '../render/art/items';
import { escapeHtml, fmtNum } from '../core/util';
import { WEATHERS } from '../sim/environment';
import { renderInspector, inspectorAction } from './inspector';
import { renderDrawer, drawerAction } from './drawers';
import * as W from './windows';
import { ITEMS } from '../data/items';
import { countResource } from '../sim/zones';
import { computeAlerts, type Alert } from './alerts';
import { TICKS_PER_DAY } from '../core/constants';
import { pawnShortName } from '../sim/things';

export type Handler = (el: HTMLElement, ui: UI) => void;

export function h(tag: string, attrs: Record<string, any> = {}, html = ''): HTMLElement {
  const e = document.createElement(tag);
  for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.setAttribute('style', attrs[k]); else e.setAttribute(k, attrs[k]); }
  if (html) e.innerHTML = html;
  return e;
}
const portraitCache = new WeakMap<object, string>();
export function portraitURL(p: Pawn): string {
  const s = portraitSprite(p);
  let u = portraitCache.get(s);
  if (!u) { u = spriteToDataURL(s, 3); portraitCache.set(s, u); }
  return u;
}
const itemIconCache = new Map<string, string>();
export function itemIconURL(def: string, stuff?: string): string {
  const k = def + ':' + (stuff || '');
  let u = itemIconCache.get(k);
  if (!u) { u = spriteToDataURL(itemSprite(def, stuff), 3); itemIconCache.set(k, u); }
  return u;
}

export class UI {
  g: Game;
  root: HTMLElement;
  top!: HTMLElement; colbar!: HTMLElement; letters!: HTMLElement; alerts!: HTMLElement; bottom!: HTMLElement;
  drawer: HTMLElement | null = null; drawerTab = ''; drawerCat = '';
  sheet: HTMLElement | null = null; sheetTab = 'overview'; sheetCollapsed = false;
  banner: HTMLElement | null = null;
  modal: HTMLElement | null = null; modalKind = ''; modalArg: any = null;
  ctx: HTMLElement | null = null;
  resbox: HTMLElement | null = null;
  toasts!: HTMLElement;
  dragInfo!: HTMLElement;
  t = 0; tSheet = 0; tAlerts = 0; tModal = 0;
  sig: Record<string, string> = {};
  seenLetters = new Set<number>();
  letterQueue: number[] = [];
  handlers: Record<string, Handler> = {};
  alertList: Alert[] = [];

  constructor(g: Game) {
    this.g = g;
    this.root = document.getElementById('hud')!;
    this.root.innerHTML = '';
    this.build();
    for (const l of g.world.letters) if (l.faction === g.faction || l.faction === 0) { this.seenLetters.add(l.id); if (g.world.tick - l.tick < TICKS_PER_DAY * 2 && !l.read) this.letterQueue.push(l.id); }
    this.renderLetters();
    this.root.addEventListener('click', e => this.onClick(e));
    this.root.addEventListener('input', e => this.onInput(e));
    this.root.addEventListener('change', e => this.onInput(e));
    document.getElementById('screens')!.addEventListener('click', e => this.onClick(e));
    // stop map gestures from starting under HUD elements
    for (const ev of ['pointerdown', 'wheel']) this.root.addEventListener(ev, e => { if (e.target !== this.root) e.stopPropagation(); }, { passive: true });
  }

  build() {
    const r = this.root;
    this.top = h('div', { id: 'topbar', class: 'px' });
    this.colbar = h('div', { id: 'colbar' });
    this.letters = h('div', { id: 'letters' });
    this.alerts = h('div', { id: 'alerts' });
    this.bottom = h('div', { id: 'bottombar' });
    this.toasts = h('div', { id: 'toasts' });
    this.dragInfo = h('div', { class: 'dragInfo px', style: 'display:none' });
    const tabs: [string, string, string][] = [['build', 'build', 'Build'], ['orders', 'orders', 'Orders'], ['zones', 'zones', 'Zones'], ['work', 'work', 'Work'], ['research', 'research', 'Research'], ['colony', 'colony', 'Colony'], ['more', 'menu', 'Menu']];
    this.bottom.innerHTML = tabs.map(([id, ic, l]) => `<button class="btn tab" data-a="tab" data-v="${id}" id="tab-${id}">${iconImg(ic)}<span>${l}</span></button>`).join('');
    r.append(this.top, this.colbar, this.alerts, this.letters, this.bottom, this.toasts, this.dragInfo);
    this.renderTop(true);
  }

  // ---------------- event routing ----------------
  onClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
    if (!t) { if (this.ctx && !(e.target as HTMLElement).closest('.ctx')) this.closeFloating(); return; }
    const a = t.dataset.a!;
    e.stopPropagation();
    this.g.audio.unlock();
    const fn = this.handlers[a] || HANDLERS[a];
    if (fn) { fn(t, this); return; }
    if (a.startsWith('insp:')) { inspectorAction(this, a.slice(5), t); return; }
    if (a.startsWith('dr:')) { drawerAction(this, a.slice(3), t); return; }
    if (a.startsWith('w:')) { W.windowAction(this, a.slice(2), t); return; }
  }
  onInput(e: Event) {
    const t = e.target as HTMLElement;
    const a = t.dataset?.in;
    if (!a) return;
    W.windowInput(this, a, t as HTMLInputElement, e.type);
  }

  // ---------------- per-frame ----------------
  frame(dt: number) {
    this.t += dt; this.tSheet += dt; this.tAlerts += dt; this.tModal += dt;
    if (this.t > 0.25) { this.t = 0; this.renderTop(); this.renderColbar(); this.renderBanner(); }
    if (this.tSheet > 0.2) { this.tSheet = 0; this.renderSheet(); }
    if (this.tAlerts > 1.2) { this.tAlerts = 0; this.renderAlerts(); this.checkLetters(); }
    if (this.tModal > 0.5 && this.modal) { this.tModal = 0; W.refreshWindow(this); }
    const di = this.g.dragInfo;
    this.dragInfo.style.display = di && this.g.input.mode === 'tool' ? '' : 'none';
    if (di) this.dragInfo.textContent = di;
  }

  // ---------------- top bar ----------------
  renderTop(force = false) {
    const g = this.g, w = g.world;
    const wd = WEATHERS[w.weather.cur];
    const t = Math.round(w.outdoorTemp);
    const sp = g.mySpeed;
    const eff = g.effectiveSpeed();
    if (!this.top.querySelector('.date')) {
      this.top.innerHTML = `
      <button class="btn sm flat" data-a="tab" data-v="more" aria-label="menu">${iconImg('menu')}</button>
      <div class="date"><b class="d1"></b><span class="d2"></span></div>
      <div class="speed">${[0, 1, 2, 3].map(s => `<button class="btn" data-a="speed" data-v="${s}">${iconImg(s === 0 ? 'pause' : 'play' + s)}</button>`).join('')}</div>
      <button class="btn sm res" data-a="res">${iconImg('item:silver', 'ico')}</button>`;
    }
    const hour = Math.floor(w.hour);
    const hh = hour === 0 ? '12am' : hour < 12 ? hour + 'am' : hour === 12 ? '12pm' : hour - 12 + 'pm';
    const sun = hour >= 6 && hour < 19 ? '☀' : '☾';
    const waiting = g.net && eff < sp ? w.players.filter(p => p.connected && p.speed < sp).map(p => p.name).join(', ') : '';
    const d1 = `${hh} · ${window.innerWidth < 440 ? w.dateString().replace(/, \d+$/, '') : w.dateString()}`;
    const d2 = `${sun} ${wd.label} · ${t}°C${waiting ? ` · waiting: ${waiting}` : ''}`;
    const e1 = this.top.querySelector('.d1')!, e2 = this.top.querySelector('.d2')!;
    if (e1.textContent !== d1) e1.textContent = d1;
    if (e2.textContent !== d2) { e2.textContent = d2; (e2 as HTMLElement).classList.toggle('warn', !!waiting); }
    this.top.querySelectorAll('.speed .btn').forEach(b => {
      const v = +(b as HTMLElement).dataset.v!;
      b.classList.toggle('on', v === sp);
      b.classList.toggle('blue', v === eff && v !== sp);
    });
  }

  // ---------------- colonist bar ----------------
  renderColbar() {
    const g = this.g;
    const cols = g.world.colonists(g.faction);
    // one-tap "draft everyone" while a threat is on the map (or anyone is drafted)
    const able = cols.filter(p => !p.downed && !p.mental);
    const anyDrafted = able.some(p => p.drafted);
    const threat = threatActive(g);
    g.audio.setMusicMood(threat ? 'danger' : 'calm');
    const showDraft = able.length > 1 && (anyDrafted || threat);
    const keys = cols.map(p => p.id).join(',') + (showDraft ? '+d' : '');
    if (this.sig.colkeys !== keys) {
      this.sig.colkeys = keys; this.sig.col = '';
      this.colbar.innerHTML = cols.map(p => `<div class="cb" data-a="colsel" data-id="${p.id}"><img alt=""><div class="nm"></div><div class="mb"><i></i></div><div class="st"></div></div>`).join('')
        + (showDraft ? `<div class="cb cbdraft" data-a="draftall"><span class="ic">${iconImg('draft')}</span><div class="nm"></div></div>` : '');
    }
    if (showDraft) {
      const el = this.colbar.lastElementChild as HTMLElement;
      const all = able.every(p => p.drafted);
      const lbl = all ? 'Undraft' : 'Draft all';
      if (el && el.dataset.sig !== lbl) { el.dataset.sig = lbl; (el.querySelector('.nm') as HTMLElement).textContent = lbl; el.classList.toggle('on', all); }
    }
    const cards = this.colbar.children;
    cols.forEach((p, k) => {
      const el = cards[k] as HTMLElement;
      if (!el) return;
      const mood = p.needs.mood;
      const col = mood < 0.2 ? '#ff5a4a' : mood < 0.35 ? '#ffb44a' : mood < 0.6 ? '#d8d070' : '#7fd67a';
      const st = p.drafted ? '⚔' : p.downed ? '✚' : p.mental ? '!' : p.inspired ? '★' : '';
      const sig = `${p.drafted ? 1 : 0}${p.downed ? 1 : 0}${p.mental ? 1 : 0}${Math.round(mood * 50)}${g.selection.has(p.id) ? 1 : 0}${p.apparel.map(a => a.def).join()}${p.name.nick}${st}`;
      if (el.dataset.sig === sig) return;
      el.dataset.sig = sig;
      el.className = `cb ${g.selection.has(p.id) ? 'sel' : ''} ${p.drafted ? 'drafted' : ''} ${p.downed ? 'downed' : ''} ${p.mental ? 'break' : ''}`;
      const img = el.querySelector('img')!; const u = portraitURL(p); if (img.getAttribute('src') !== u) img.src = u;
      (el.querySelector('.nm') as HTMLElement).textContent = pawnShortName(p);
      const bar = el.querySelector('.mb i') as HTMLElement; bar.style.width = Math.round(mood * 100) + '%'; bar.style.background = col;
      (el.querySelector('.st') as HTMLElement).textContent = st;
    });
  }
  cycleColonist(dir: number) {
    const cols = this.g.world.colonists(this.g.faction);
    if (!cols.length) return;
    const cur = cols.findIndex(p => this.g.selection.has(p.id));
    const n = cols[(cur + dir + cols.length) % cols.length];
    this.g.select([n.id]); this.g.jumpTo(n.x, n.y);
  }

  // ---------------- alerts & letters ----------------
  renderAlerts() {
    this.alertList = computeAlerts(this.g);
    const sig = this.alertList.map(a => a.text).join('|');
    if (this.sig.alerts === sig) return;
    this.sig.alerts = sig;
    this.alerts.innerHTML = this.alertList.slice(0, 6).map((a, k) => `<div class="alert ${a.crit ? 'crit' : ''}" data-a="alert" data-k="${k}">${escapeHtml(a.text)}${a.tab ? ' <b class="accent">›</b>' : ''}</div>`).join('');
  }
  checkLetters() {
    for (const l of this.g.world.letters) {
      if (this.seenLetters.has(l.id)) continue;
      if (l.faction !== this.g.faction && l.faction !== 0) continue;
      this.onLetter(l.id);
    }
  }
  onLetter(id: number) {
    if (this.seenLetters.has(id)) return;
    const l = this.g.world.letters.find(x => x.id === id);
    if (!l) { setTimeout(() => this.checkLetters(), 300); return; }
    this.seenLetters.add(id);
    this.letterQueue.push(id);
    if (this.letterQueue.length > 12) this.letterQueue.shift();
    this.g.audio.play(l.kind === 'threat' ? 'raid' : l.kind === 'good' ? 'letter_good' : l.kind === 'bad' || l.kind === 'death' ? 'letter_bad' : 'letter_info');
    if (l.kind === 'threat' && this.g.mySpeed > 1) this.g.setSpeed(1);
    this.renderLetters();
  }
  renderLetters() {
    const ls = this.letterQueue.map(id => this.g.world.letters.find(l => l.id === id)).filter((l): l is Letter => !!l);
    const ic: Record<string, string> = { good: '✦', bad: '▲', threat: '⚠', death: '✝', neutral: '✉', info: '✉' };
    this.letters.innerHTML = ls.map(l => `<div class="letter ${l.kind}" data-a="letter" data-id="${l.id}" title="${escapeHtml(l.title)}">${ic[l.kind] || '✉'}</div>`).join('');
  }

  // ---------------- drawer (build/orders/zones) ----------------
  openTab(tab: string) {
    this.closeFloating();
    if (['build', 'orders', 'zones'].includes(tab)) {
      if (this.drawer && this.drawerTab === tab) { this.closeDrawer(); return; }
      this.closeModal();
      this.g.setTool(null);
      this.drawerTab = tab;
      if (!this.drawer) { this.drawer = h('div', { class: 'drawer px' }); this.root.appendChild(this.drawer); }
      this.hideSheet(true);
      this.renderDrawer();
    } else {
      this.closeDrawer();
      if (this.modal && this.modalKind === tab) { this.closeModal(); return; }
      W.openWindow(this, tab);
    }
    this.markTabs();
  }
  renderDrawer() { if (this.drawer) this.drawer.innerHTML = renderDrawer(this); }
  closeDrawer() { if (this.drawer) { this.drawer.remove(); this.drawer = null; this.drawerTab = ''; } this.markTabs(); this.hideSheet(false); }
  markTabs() {
    for (const b of this.bottom.querySelectorAll('.tab')) b.classList.toggle('on', (b as HTMLElement).dataset.v === this.drawerTab || (b as HTMLElement).dataset.v === this.modalKind);
  }

  // ---------------- tool banner ----------------
  onTool() {
    if (this.g.tool) { if (this.drawer) { this.drawer.style.display = 'none'; } }
    else if (this.drawer) this.drawer.style.display = '';
    this.sig.banner = '';
    this.renderBanner();
  }
  renderBanner() {
    const t = this.g.tool;
    if (!t) { if (this.banner) { this.banner.remove(); this.banner = null; } return; }
    const sig = `${t.id}|${t.stuff}|${t.rot}`;
    if (this.banner && this.sig.banner === sig) return;
    this.sig.banner = sig;
    if (!this.banner) { this.banner = h('div', { id: 'banner', class: 'px' }); this.root.appendChild(this.banner); }
    const stuffs = t.stuffOptions && t.stuffOptions.length > 1 ? `<div class="stuffs">${t.stuffOptions.map(s => {
      const have = countResource(this.g.world, this.g.faction, s);
      return `<button class="btn sm ${t.stuff === s ? 'on' : ''}" data-a="stuff" data-v="${s}"><img class="ico s" src="${itemIconURL(s)}">${ITEMS[s].label} <span class="dim">${fmtNum(have)}</span></button>`;
    }).join('')}</div>` : '';
    this.banner.innerHTML = `<div class="row">${iconImg(t.icon || 'build')}<div class="grow"><b>${escapeHtml(t.label)}</b><div class="hint">${escapeHtml(t.hint)} · two fingers to pan</div></div>
      ${t.rotatable ? `<button class="btn" data-a="rotate">${iconImg('rotate')}</button>` : ''}
      <button class="btn good" data-a="tooldone">${iconImg('check')} Done</button></div>${stuffs}`;
  }

  // ---------------- inspector sheet ----------------
  onSelection() {
    const g = this.g;
    if ((g.selection.size || g.selectedZone || g.selectedCell >= 0) && this.drawer && !g.tool) this.closeDrawer();
    this.sig.sheet = ''; this.renderSheet(); this.sig.col = '';
  }
  hideSheet(v: boolean) { if (this.sheet) this.sheet.style.display = v ? 'none' : ''; }
  renderSheet() {
    const g = this.g;
    const has = g.selection.size > 0 || g.selectedZone > 0 || g.selectedCell >= 0;
    if (!has || g.tool) { if (this.sheet) { this.sheet.remove(); this.sheet = null; } return; }
    const r = renderInspector(this);
    if (!r) { if (this.sheet) { this.sheet.remove(); this.sheet = null; } return; }
    if (!this.sheet) {
      this.sheet = h('div', { id: 'sheet', class: 'px' });
      this.root.appendChild(this.sheet);
      if (this.drawer) this.sheet.style.display = 'none';
    }
    this.sheet.classList.toggle('collapsed', this.sheetCollapsed);
    const head = `<div class="head" data-a="sheettoggle">${r.icon || ''}<div class="grow"><div class="title">${r.title}</div><div class="sub">${r.sub || ''}</div></div>
        <button class="btn sm flat" data-a="sheettoggle">${this.sheetCollapsed ? '▲' : '▼'}</button><button class="btn sm flat" data-a="deselect">${iconImg('close', 'ico s')}</button></div>`;
    const tabs = r.tabs && r.tabs.length > 1 ? `<div class="tabs">${r.tabs.map(([id, l]) => `<button class="btn ${this.sheetTab === id ? 'on' : ''}" data-a="sheettab" data-v="${id}">${l}</button>`).join('')}</div>` : '';
    const parts: [string, string, string][] = [['h', 'sh-head', head], ['t', 'sh-tabs', tabs], ['b', 'sh-body', r.body], ['g', 'sh-giz', r.gizmos || '']];
    if (!this.sheet.querySelector('.sh-head')) {
      this.sheet.innerHTML = `<div class="sh-head"></div><div class="sh-tabs"></div><div class="body scroll sh-body"></div><div class="gizmos sh-giz"></div>`;
      this.sig.sh_h = this.sig.sh_t = this.sig.sh_b = this.sig.sh_g = '';
    }
    for (const [k, cls, html] of parts) {
      if (this.sig['sh_' + k] === html) continue;
      this.sig['sh_' + k] = html;
      const el = this.sheet.querySelector('.' + cls) as HTMLElement;
      if (k === 'b') { const sc = el.scrollTop; el.innerHTML = html; el.scrollTop = sc; }
      else el.innerHTML = html;
      if (k === 'g') el.style.display = html ? '' : 'none';
      if (k === 't') el.style.display = html ? '' : 'none';
    }
  }

  // ---------------- modal / context / toast ----------------
  showModal(kind: string, html: string, cls = '') {
    this.closeFloating();
    if (!this.modal) { this.modal = h('div', { class: 'modal-bg' }); document.getElementById('screens')!.appendChild(this.modal); this.modal.addEventListener('pointerdown', e => { if (e.target === this.modal) this.closeModal(); }); }
    if (this.modalKind === kind && this.sig.modal === html) return;
    this.sig.modal = html;
    this.modalKind = kind;
    const body = this.modal.querySelector('.wb') as HTMLElement | null;
    const scroll = body ? body.scrollTop : 0;
    const scrollX = body ? body.scrollLeft : 0;
    this.modal.innerHTML = `<div class="win px ${cls}">${html}</div>`;
    const nb = this.modal.querySelector('.wb') as HTMLElement | null;
    if (nb && this.modalKind === kind) { nb.scrollTop = scroll; nb.scrollLeft = scrollX; }
    this.markTabs();
  }
  closeModal() { if (this.modal) { this.modal.remove(); this.modal = null; this.modalKind = ''; this.modalArg = null; this.sig.modal = ''; } this.markTabs(); }
  closeTop(): boolean {
    if (this.ctx || this.resbox) { this.closeFloating(); return true; }
    if (this.modal) { this.closeModal(); return true; }
    if (this.drawer) { this.closeDrawer(); return true; }
    return false;
  }
  closeFloating() { if (this.ctx) { this.ctx.remove(); this.ctx = null; } if (this.resbox) { this.resbox.remove(); this.resbox = null; } }

  ctxOpts: CtxOption[] = [];
  contextMenu(opts: CtxOption[], x: number, y: number, title = '') {
    this.closeFloating();
    if (!opts.length) return;
    this.ctxOpts = opts;
    const el = h('div', { class: 'ctx px' });
    el.innerHTML = (title ? `<div class="t">${escapeHtml(title)}</div>` : '') + opts.map((o, k) => `<button class="btn ${o.disabled ? 'dis' : ''}" data-a="ctxopt" data-k="${k}">${o.icon ? iconImg(o.icon, 'ico') : ''}<span>${escapeHtml(o.label)}</span></button>`).join('');
    document.getElementById('screens')!.appendChild(el);
    const W0 = window.innerWidth, H0 = window.innerHeight;
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(W0 - r.width - 6, x - r.width / 2)) + 'px';
    el.style.top = Math.max(50, Math.min(H0 - r.height - 80, y - 20)) + 'px';
    this.ctx = el;
    setTimeout(() => {
      const off = (e: PointerEvent) => { if (this.ctx && !(e.target as HTMLElement).closest('.ctx')) { this.closeFloating(); window.removeEventListener('pointerdown', off, true); } };
      window.addEventListener('pointerdown', off, true);
    }, 50);
  }

  toast(msg: string, kind: '' | 'good' | 'bad' = '') {
    const t = h('div', { class: 'toast ' + kind }, escapeHtml(msg));
    this.toasts.appendChild(t);
    setTimeout(() => t.remove(), 2600);
    while (this.toasts.children.length > 3) this.toasts.firstChild!.remove();
  }

  showVictory() {
    const el = h('div', { class: 'victory' });
    el.innerHTML = `<div class="win px narrow"><div class="wh"><h2>★ Victory! ★</h2></div><div class="wb center"><p>Your ship has broken free of the planet's gravity well.</p><p class="dim">The survivors drift into cryptosleep, dreaming of a gentler world.</p></div><div class="wf"><button class="btn good" data-a="closevictory">Continue watching</button><button class="btn" data-a="exitgame">Main menu</button></div></div>`;
    document.getElementById('screens')!.appendChild(el);
  }

  resources() {
    if (this.resbox) { this.closeFloating(); return; }
    const g = this.g;
    const list = ['silver', 'steel', 'wood', 'components', 'plasteel', 'gold', 'uranium', 'cloth', 'leather', 'medicine', 'medicine_herbal', 'meal_simple', 'meal_fine', 'meal_survival', 'pemmican', 'rice', 'potato', 'corn', 'berries', 'meat', 'blocks_granite', 'blocks_limestone', 'blocks_marble', 'blocks_sandstone', 'blocks_slate', 'adv_components', 'chemfuel', 'beer', 'hay'];
    const rows = list.map(d => [d, countResource(g.world, g.faction, d)] as [string, number]).filter(([, n]) => n > 0);
    const food = rows.filter(([d]) => ITEMS[d].food && ITEMS[d].cat !== 'feed').reduce((s, [d, n]) => s + n * (ITEMS[d].food!.nutrition), 0);
    const cols = g.world.colonists(g.faction).length || 1;
    const el = h('div', { id: 'resbox', class: 'px scroll' });
    el.innerHTML = `<div class="small dim">Food: ~${(food / (1.6 * cols)).toFixed(1)} days</div><div class="sep"></div>` + (rows.length ? rows.map(([d, n]) => `<div class="ri"><img class="ico s" src="${itemIconURL(d)}"> ${ITEMS[d].label}<b>${fmtNum(n)}</b></div>`).join('') : '<div class="dim">Nothing stored yet.<br>Make a stockpile zone!</div>');
    this.root.appendChild(el);
    this.resbox = el;
  }
}

function threatActive(g: Game): boolean {
  const w = g.world;
  for (const l of w.lords.values()) if ((l.kind === 'assault' || l.kind === 'mech') && l.stage !== 'flee' && l.target === g.faction) return true;
  for (const p of w.pawns.values()) if ((p.animal?.manhunter || 0) > w.tick && !p.dead) return true;
  return false;
}

// ---------------- global handlers ----------------
const HANDLERS: Record<string, Handler> = {
  tab: (el, ui) => ui.openTab(el.dataset.v!),
  speed: (el, ui) => ui.g.setSpeed(+el.dataset.v!),
  res: (el, ui) => ui.resources(),
  colsel: (el, ui) => {
    const id = +el.dataset.id!;
    const p = ui.g.world.pawns.get(id);
    if (!p) return;
    if (ui.g.selection.has(id) && ui.g.selection.size === 1) ui.g.jumpTo(p.x, p.y);
    else { ui.g.select([id]); }
    ui.g.audio.play('click');
  },
  draftall: (el, ui) => {
    const able = ui.g.world.colonists(ui.g.faction).filter(p => !p.downed && !p.mental);
    const on = !able.every(p => p.drafted);
    ui.g.cmd({ c: 'draft', pawns: able.map(p => p.id), on });
    if (on) ui.g.select(able.map(p => p.id));
    ui.g.audio.play(on ? 'draft' : 'click');
  },
  letter: (el, ui) => { W.openLetter(ui, +el.dataset.id!); },
  alert: (el, ui) => {
    const a = ui.alertList[+el.dataset.k!];
    if (!a) return;
    if (a.x !== undefined) ui.g.jumpTo(a.x, a.y!);
    if (a.id) ui.g.select([a.id]);
    if (a.tab) { if (a.cat) ui.drawerCat = a.cat; if (!(ui.drawer && ui.drawerTab === a.tab) && ui.modalKind !== a.tab) ui.openTab(a.tab); else if (ui.drawer) ui.renderDrawer(); }
    ui.g.audio.play('click');
  },
  tooldone: (el, ui) => { ui.g.setTool(null); },
  rotate: (el, ui) => { (ui.g.tool as any)?.rotate?.(); ui.sig.banner = ''; ui.renderBanner(); },
  stuff: (el, ui) => { if (ui.g.tool) { ui.g.tool.stuff = el.dataset.v; ui.sig.banner = ''; ui.renderBanner(); } },
  sheettoggle: (el, ui) => { ui.sheetCollapsed = !ui.sheetCollapsed; ui.sig.sheet = ''; ui.renderSheet(); },
  sheettab: (el, ui) => { ui.sheetTab = el.dataset.v!; ui.sig.sheet = ''; ui.renderSheet(); },
  deselect: (el, ui) => ui.g.clearSelection(),
  ctxopt: (el, ui) => { const o = ui.ctxOpts[+el.dataset.k!]; ui.closeFloating(); o?.action(); },
  closemodal: (el, ui) => ui.closeModal(),
  closevictory: (el) => el.closest('.victory')?.remove(),
  exitgame: (el, ui) => { el.closest('.victory')?.remove(); ui.g.onExit?.(); },
};
export { iconImg, iconURL };
