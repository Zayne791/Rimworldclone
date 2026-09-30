// Main menu, new-game setup, colonist selection, landing site picker, load screen, multiplayer lobby screens.
import { startDiorama, stopDiorama } from './diorama';
import type { Pawn } from '../sim/types';
import type { World } from '../sim/world';
import { createWorld, addColony, generateStartingColonists, defaultSitePref } from '../sim/newgame';
import { findStartSite, openness } from '../sim/mapgen';
import { listSaves, loadFromDb, deleteSave, importSave, type SaveMeta } from '../sim/save';
import { TERRAIN, ROCKS } from '../data/terrain';
import { PLANTS } from '../data/plants';
import { BACKSTORIES, TRAITS, SKILLS, WORK_TYPES } from '../data/pawns';
import { escapeHtml } from '../core/util';
import { portraitSprite } from '../render/art/pawns';
import { spriteToDataURL } from '../render/pixel';
import { fullName, generateHuman } from '../sim/pawngen';
import { Rng } from '../core/rng';
import { GAME_NAME, VERSION, FIRST_PLAYER_FACTION } from '../core/constants';
import { iconImg } from '../render/art/icons';
import type { AudioEngine } from '../audio/audio';
import { PLAYER_COLORS } from '../sim/world';

export interface MenuHooks {
  startSingle(w: World, faction: number): void;
  hostGame(w: World, faction: number, opts: { maxPlayers: number }): void;
  joinGame(code: string, name: string, colony: string): Promise<void>;
  audio: AudioEngine;
}

const root = () => document.getElementById('screens')!;
let hooks: MenuHooks;

function screen(html: string, home = false) {
  // the live colony diorama only runs behind the (translucent) title screen
  if (home) startDiorama(document.getElementById('view') as HTMLCanvasElement); else stopDiorama();
  root().innerHTML = `<div class="screen ${home ? 'home' : ''}">${html}</div>`;
}
const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';

// ---------------- logo ----------------
let logoURL = '';
function makeLogo(): string {
  if (logoURL) return logoURL;
  const W = 220, H = 56;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // falling pod trail
  for (let k = 0; k < 26; k++) { ctx.fillStyle = k < 8 ? '#fff4b0' : k < 16 ? '#ff9030' : '#8a3a24'; ctx.fillRect(176 - k * 2, 6 + k, 2, 2); }
  ctx.fillStyle = '#c8ccd4'; ctx.fillRect(176, 4, 5, 5); ctx.fillStyle = '#6a7580'; ctx.fillRect(177, 8, 4, 2);
  // text with a solid dark outline so it reads over the live colony behind it
  ctx.font = '700 16px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#120e18';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [1, 2], [0, 2]]) { ctx.fillText('STARFALL', W / 2 + dx, 27 + dy); ctx.fillText('COLONY', W / 2 + dx, 45 + dy); }
  ctx.fillStyle = '#f0c850'; ctx.fillText('STARFALL', W / 2, 27);
  ctx.fillStyle = '#efe9dd'; ctx.fillText('COLONY', W / 2, 45);
  // threshold alpha to crisp pixels
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 100 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  const big = document.createElement('canvas'); big.width = W * 3; big.height = H * 3;
  const b = big.getContext('2d')!; b.imageSmoothingEnabled = false; b.drawImage(c, 0, 0, W * 3, H * 3);
  logoURL = big.toDataURL();
  return logoURL;
}

// ---------------- main menu ----------------
export async function showMainMenu(h: MenuHooks) {
  hooks = h;
  const saves = await listSaves();
  const params = new URLSearchParams(location.search);
  const joinCode = params.get('join');
  screen(`
    <img class="logo" src="${makeLogo()}" width="660" alt="${GAME_NAME}">
    <div class="dim small">A pixel colony sim · v${VERSION}</div>
    <div class="menu">
      ${saves.length ? `<button class="btn big good" data-m="continue">▶ Continue <span class="small dim">${escapeHtml(saves[0].colony)} · day ${saves[0].day + 1}</span></button>` : ''}
      <button class="btn big ${saves.length ? '' : 'good'}" data-m="new">New colony</button>
      <button class="btn big blue" data-m="host">Host multiplayer</button>
      <button class="btn big blue" data-m="join">Join multiplayer</button>
      ${saves.length ? `<button class="btn" data-m="load">Load game</button>` : ''}
      <button class="btn" data-m="import">Import save file</button>
      <button class="btn" data-m="help">How to play</button>
    </div>
    <div class="tiny faint" style="margin-top:18px;max-width:420px;text-align:center">Tip: on iPad/iPhone use Share → "Add to Home Screen" for full-screen play.</div>
    <input type="file" id="importfile" accept=".sfsave,application/octet-stream" style="display:none">`, true);
  bind({
    continue: async () => { const w = await loadFromDb(saves[0].name); if (w) startLoaded(w); },
    new: () => newGameScreen(false),
    host: () => newGameScreen(true),
    join: () => joinScreen(joinCode || ''),
    load: () => loadScreen(),
    import: () => (document.getElementById('importfile') as HTMLInputElement).click(),
    help: () => helpScreen(),
  });
  (document.getElementById('importfile') as HTMLInputElement).onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { startLoaded(await importSave(f)); } catch (err) { alert('Could not load that file: ' + err); }
  };
  if (joinCode) joinScreen(joinCode);
}

function bind(map: Record<string, (el: HTMLElement) => void>) {
  root().onclick = (e) => {
    const t = (e.target as HTMLElement).closest('[data-m]') as HTMLElement | null;
    if (!t) return;
    hooks.audio.unlock(); hooks.audio.play('click');
    const fn = map[t.dataset.m!];
    if (fn) fn(t);
  };
}

function startLoaded(w: World) {
  const host = w.players.find(p => p.isHost) || w.players[0];
  if (w.players.length > 1) {
    if (confirm('This is a multiplayer save. Host it for your friends to rejoin? (Cancel = play offline)')) { hooks.hostGame(w, host.faction, { maxPlayers: w.settings.maxPlayers }); return; }
  }
  hooks.startSingle(w, host?.faction ?? FIRST_PLAYER_FACTION);
}

async function loadScreen() {
  const saves = await listSaves();
  const row = (s: SaveMeta) => `<div class="row px" style="padding:8px;margin:4px 0"><div class="grow"><b>${escapeHtml(s.colony)}</b> <span class="dim small">day ${s.day + 1}${s.mp ? ' · multiplayer' : ''}</span><div class="tiny dim">${new Date(s.time).toLocaleString()} · ${escapeHtml(s.name.startsWith('auto:') ? 'autosave' : 'manual save')}</div></div><button class="btn good" data-m="l" data-v="${escapeHtml(s.name)}">Load</button><button class="btn bad sm" data-m="d" data-v="${escapeHtml(s.name)}">✕</button></div>`;
  screen(`<h2>Load game</h2><div class="card">${saves.map(row).join('') || '<div class="dim">No saves yet.</div>'}</div><div class="menu"><button class="btn" data-m="back">Back</button></div>`);
  bind({
    l: async (el) => { const w = await loadFromDb(el.dataset.v!); if (w) startLoaded(w); },
    d: async (el) => { if (confirm('Delete this save?')) { await deleteSave(el.dataset.v!); loadScreen(); } },
    back: () => showMainMenu(hooks),
  });
}

function helpScreen() {
  screen(`<h2>How to play</h2><div class="card px small" style="line-height:1.5">
    <p><b class="accent">Your goal:</b> keep your crash-landed colonists alive on a hostile frontier world. Build shelter, farm, research technology, fend off raiders — and eventually build a starship to escape.</p>
    <p><b class="accent">Touch controls:</b> one finger drags the map, pinch zooms. Tap to select; tap again to cycle through stacked things. Long-press for actions (with a colonist selected: equip, rescue, haul, tend…). Double-tap a colonist to select all visible ones.</p>
    <p><b class="accent">Building:</b> Build tab → choose → tap or drag. Drag walls diagonally to lay out a whole room at once. Two fingers pan while a tool is active. Tap ✓ Done when finished.</p>
    <p><b class="accent">Fighting:</b> select colonists → Draft. Tap ground to move, tap enemies to attack. Use cover!</p>
    <p><b class="accent">First steps:</b> 1) Zones → Stockpile. 2) Build a campfire; add a "Cook simple meal" bill. 3) Build walls + door + beds (roof is automatic). 4) Growing zone (potatoes or rice). 5) Research bench → Electricity.</p>
    <p><b class="accent">Multiplayer:</b> the host shares a room code. Each friend lands their own colony on the same map. Trade, ally — or declare war and raid each other's stockpiles!</p>
    </div><div class="menu"><button class="btn" data-m="back">Back</button></div>`);
  bind({ back: () => showMainMenu(hooks) });
}

// ---------------- new game ----------------
interface Setup { mp: boolean; name: string; colony: string; seed: string; size: number; teller: 'classic' | 'chill' | 'chaos'; diff: number; maxPlayers: number; pvp: boolean }
const setup: Setup = { mp: false, name: 'Captain', colony: 'New Hope', seed: '', size: 140, teller: 'classic', diff: 2, maxPlayers: 4, pvp: true };
const COLONY_NAMES = ['New Hope', 'Last Light', 'Ember Rock', 'Driftwood', 'Haven', 'Starfall', 'Rustwater', 'Greenreach', 'Ironhold', 'Dawnridge', 'Hollowpine', 'Farstead'];

function newGameScreen(mp: boolean) {
  setup.mp = mp;
  try { const s = JSON.parse(localStorage.getItem('sf_setup') || '{}'); Object.assign(setup, s, { mp }); } catch { /* */ }
  if (!setup.seed) setup.seed = Math.random().toString(36).slice(2, 8);
  if (!setup.colony) setup.colony = COLONY_NAMES[Math.floor(Math.random() * COLONY_NAMES.length)];
  const seg = (key: string, opts: [string | number, string][], cur: any) => `<div class="seg">${opts.map(([v, l]) => `<button class="btn sm ${cur === v ? 'on' : ''}" data-m="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  screen(`<h2>${mp ? 'Host multiplayer' : 'New colony'}</h2><div class="card px">
    <div class="field"><label>Your name</label><input id="f-name" value="${escapeHtml(setup.name)}" maxlength="16"></div>
    <div class="field"><label>Colony name</label><input id="f-colony" value="${escapeHtml(setup.colony)}" maxlength="24"></div>
    <div class="field"><label>Storyteller</label>${seg('teller', [['classic', 'Steady Sol — balanced'], ['chill', 'Gentle Gaia — relaxed'], ['chaos', 'Wildcard Wren — chaos']], setup.teller)}</div>
    <div class="field"><label>Difficulty</label>${seg('diff', [[0, 'Peaceful'], [1, 'Easy'], [2, 'Normal'], [3, 'Hard'], [4, 'Brutal']], setup.diff)}</div>
    <div class="field"><label>Map size</label>${seg('size', mp ? [[160, 'Medium'], [200, 'Large'], [240, 'Huge']] : [[100, 'Small'], [140, 'Medium'], [180, 'Large']], setup.size)}</div>
    ${mp ? `<div class="field"><label>Max players</label>${seg('maxPlayers', [[2, '2'], [3, '3'], [4, '4']], setup.maxPlayers)}</div>
    <div class="field"><label>Player vs player</label>${seg('pvp', [[1, 'Wars allowed'], [0, 'Peaceful only']], setup.pvp ? 1 : 0)}</div>` : ''}
    <div class="field"><label>World seed</label><div class="row"><input id="f-seed" class="grow" value="${escapeHtml(setup.seed)}" maxlength="20"><button class="btn sm" data-m="reseed">🎲</button></div></div>
  </div><div class="menu"><button class="btn big good" data-m="next">Choose colonists →</button><button class="btn" data-m="back">Back</button></div>`);
  if (mp && setup.size < 160) setup.size = 200;
  const read = () => { setup.name = val('f-name') || 'Captain'; setup.colony = val('f-colony') || 'New Hope'; setup.seed = val('f-seed') || 'seed'; try { localStorage.setItem('sf_setup', JSON.stringify({ ...setup, seed: '' })); } catch { /* */ } };
  bind({
    set: (el) => { read(); const k = el.dataset.k!; const v = el.dataset.v!; (setup as any)[k] = k === 'teller' ? v : k === 'pvp' ? v === '1' : +v; newGameScreen(mp); },
    reseed: () => { read(); setup.seed = Math.random().toString(36).slice(2, 8); newGameScreen(mp); },
    next: () => { read(); worldPrep(); },
    back: () => showMainMenu(hooks),
  });
}

let prepWorld: World | null = null;
function worldPrep() {
  screen(`<h2>Generating world…</h2><div class="dim">Seed ${escapeHtml(setup.seed)}</div>`);
  setTimeout(() => {
    prepWorld = createWorld({ seed: setup.seed, mapSize: setup.size, storyteller: setup.teller, difficulty: setup.diff, maxPlayers: setup.mp ? setup.maxPlayers : 1, pvp: setup.pvp });
    colonistScreen(prepWorld, 0, (pawns, pet, site) => {
      const w = prepWorld!;
      addColony(w, { slot: 0, playerName: setup.name, colonyName: setup.colony, colonists: pawns, site, isHost: true, pet });
      const f = FIRST_PLAYER_FACTION;
      if (setup.mp) hooks.hostGame(w, f, { maxPlayers: setup.maxPlayers });
      else hooks.startSingle(w, f);
    });
  }, 30);
}

// ---------------- colonist selection ----------------
export function colonistScreen(w: World, slot: number, done: (pawns: Pawn[], pet: string, site?: [number, number]) => void, title = 'Your crew') {
  let rng = new Rng(Math.random() * 1e9);
  let pawns = generateStartingColonists(w, 3, String(Math.random()));
  let pet = 'dog';
  const render = () => {
    const card = (p: Pawn, k: number) => {
      const top = [...SKILLS].sort((a, b) => p.skills[b.id].lvl - p.skills[a.id].lvl).slice(0, 5);
      const c = BACKSTORIES.find(b => b.id === p.story?.child), a = BACKSTORIES.find(b => b.id === p.story?.adult);
      return `<div class="ccard px"><div class="top"><img src="${spriteToDataURL(portraitSprite(p), 4)}"><div class="grow"><b>${escapeHtml(fullName(p))}</b><div class="small dim">${p.gender === 'm' ? '♂' : '♀'} age ${p.age}</div><div class="small">${escapeHtml(c?.title || '')} → ${escapeHtml(a?.title || '')}</div></div></div>
        <div class="row wrap" style="margin:6px 0">${p.traits.map(t => `<span class="chip" title="${escapeHtml(TRAITS[t].desc)}">${escapeHtml(TRAITS[t].label)}</span>`).join('')}</div>
        ${top.map(s => `<div class="skill"><span>${s.label}</span><b>${p.skills[s.id].lvl}</b><div class="bar"><i style="width:${p.skills[s.id].lvl * 5}%"></i></div><span>${p.skills[s.id].passion === 2 ? '🔥' : p.skills[s.id].passion ? '♨' : ''}</span></div>`).join('')}
        ${p.disabled.length ? `<div class="tiny bad" style="margin-top:3px">Won't do: ${p.disabled.map(d => WORK_TYPES.find(x => x.id === d)?.label).join(', ')}</div>` : ''}
        <button class="btn sm" style="margin-top:6px;width:100%" data-m="reroll" data-k="${k}">🎲 Reroll</button></div>`;
    };
    screen(`<h2>${escapeHtml(title)}</h2><div class="dim small">Three survivors crawl out of the escape pods. Reroll anyone you don't like.</div>
      <div class="card"><div class="colpick">${pawns.map(card).join('')}</div></div>
      <div class="card px"><div class="row wrap"><span class="dim">Pet:</span>${['dog', 'cat'].map(pp => `<button class="btn sm ${pet === pp ? 'on' : ''}" data-m="pet" data-v="${pp}">${pp === 'dog' ? 'Husky' : 'Cat'}</button>`).join('')}</div></div>
      <div class="menu"><button class="btn big good" data-m="site">Choose landing site →</button><button class="btn" data-m="rerollall">🎲 Reroll all</button><button class="btn" data-m="back">Back</button></div>`);
  };
  render();
  bind({
    reroll: (el) => { const k = +el.dataset.k!; pawns[k] = generateHuman(w, 0, { kind: 'colonist', rng }); render(); },
    rerollall: () => { pawns = generateStartingColonists(w, 3, String(Math.random())); render(); },
    pet: (el) => { pet = el.dataset.v!; render(); },
    site: () => siteScreen(w, slot, site => done(pawns, pet, site)),
    back: () => showMainMenu(hooks),
  });
}

// ---------------- landing site ----------------
export function siteScreen(w: World, slot: number, done: (site: [number, number]) => void) {
  const m = w.map;
  const others = w.players.filter(p => p.started && p.startX !== undefined).map(p => [p.startX!, p.startY!] as [number, number]);
  const pref = defaultSitePref(w, slot, Math.max(w.settings.maxPlayers, w.players.length + 1));
  let site = findStartSite(w, pref[0], pref[1], others, Math.min(60, m.w * 0.35));
  const c = document.createElement('canvas'); c.width = m.w; c.height = m.h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(m.w, m.h);
  for (let i = 0; i < m.n; i++) {
    let col = TERRAIN[m.terrain[i]].colors[0];
    if (TERRAIN[m.terrain[i]].style === 'soil') col = '#5b8a33';
    if (m.rock[i]) col = ROCKS[m.rock[i]].ore ? ROCKS[m.rock[i]].speck || '#777' : ROCKS[m.rock[i]].color;
    else if (m.plant[i] && PLANTS[m.plant[i]].kind === 'tree') col = '#2e5a24';
    const [r, g, b] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    for (const pl of w.players) if (m.inHome(i, pl.slot)) { const pc = pl.color; img.data[i * 4] = parseInt(pc.slice(1, 3), 16); img.data[i * 4 + 1] = parseInt(pc.slice(3, 5), 16); img.data[i * 4 + 2] = parseInt(pc.slice(5, 7), 16); }
  }
  ctx.putImageData(img, 0, 0);
  const base = c.toDataURL();
  const render = () => {
    screen(`<h2>Landing site</h2><div class="dim small">Tap the map to choose where your pods come down. Open grassland is easiest; mountains give minerals and defense.</div>
      <div class="card" style="position:relative;display:flex;justify-content:center"><div style="position:relative;width:min(92vw,520px)"><img id="sitemap" class="sitemap" src="${base}" style="max-width:none;width:100%">
      <div style="position:absolute;left:${(site[0] / m.w) * 100}%;top:${(site[1] / m.h) * 100}%;width:20px;height:20px;margin:-10px;border:3px solid #f0c850;box-shadow:0 0 0 2px #000;pointer-events:none"></div>
      ${w.players.filter(p => p.started).map(p => `<div style="position:absolute;left:${(p.startX! / m.w) * 100}%;top:${(p.startY! / m.h) * 100}%;transform:translate(-50%,-140%);font-size:12px;color:${p.color};text-shadow:0 1px 0 #000;pointer-events:none;white-space:nowrap">${escapeHtml(p.colonyName)}</div>`).join('')}
      </div></div>
      <div class="dim small">Site: ${site[0]}, ${site[1]} · ${Math.round(openness(w, site[0], site[1], 6) * 100)}% open ground</div>
      <div class="menu"><button class="btn big good" data-m="go">Land here!</button><button class="btn" data-m="auto">Pick for me</button></div>`);
    const el = document.getElementById('sitemap') as HTMLImageElement;
    el.onclick = (e) => {
      const r = el.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * m.w), y = Math.floor(((e.clientY - r.top) / r.height) * m.h);
      const cand = findStartSite(w, x, y, others, 40);
      if (Math.hypot(cand[0] - x, cand[1] - y) > 25) { alert('Too close to another colony or no open ground there.'); return; }
      site = cand; render();
    };
  };
  render();
  bind({ go: () => done(site), auto: () => { site = findStartSite(w, pref[0], pref[1], others, 60); render(); } });
}

// ---------------- join ----------------
function joinScreen(code: string) {
  let name = setup.name, colony = COLONY_NAMES[Math.floor(Math.random() * COLONY_NAMES.length)];
  try { const s = JSON.parse(localStorage.getItem('sf_setup') || '{}'); if (s.name) name = s.name; } catch { /* */ }
  screen(`<h2>Join multiplayer</h2><div class="card px">
    <div class="field"><label>Room code (from the host)</label><input id="j-code" value="${escapeHtml(code)}" maxlength="12" style="text-transform:uppercase;letter-spacing:3px;font-size:22px" autocapitalize="characters"></div>
    <div class="field"><label>Your name</label><input id="j-name" value="${escapeHtml(name)}" maxlength="16"></div>
    <div class="field"><label>Colony name</label><input id="j-colony" value="${escapeHtml(colony)}" maxlength="24"></div>
    <div id="j-status" class="small dim"></div></div>
    <div class="menu"><button class="btn big good" data-m="go">Connect</button><button class="btn" data-m="back">Back</button></div>`);
  bind({
    go: async () => {
      const c = val('j-code').trim().toUpperCase();
      if (!c) return;
      const st = document.getElementById('j-status')!;
      st.textContent = 'Connecting…';
      setup.name = val('j-name') || 'Player';
      try { localStorage.setItem('sf_setup', JSON.stringify({ ...setup, seed: '' })); } catch { /* */ }
      try { await hooks.joinGame(c, setup.name, val('j-colony') || 'Outpost'); }
      catch (e) { st.innerHTML = `<span class="bad">${escapeHtml(String((e as any)?.message || e))}</span>`; }
    },
    back: () => { history.replaceState(null, '', location.pathname); showMainMenu(hooks); },
  });
}

export function statusScreen(title: string, msg: string, back?: () => void) {
  screen(`<h2>${escapeHtml(title)}</h2><div class="card px"><div>${msg}</div></div>${back ? '<div class="menu"><button class="btn" data-m="back">Back</button></div>' : ''}`);
  if (back) bind({ back });
}
export function clearScreens() { stopDiorama(); root().innerHTML = ''; root().onclick = null; }
export { PLAYER_COLORS, iconImg };
