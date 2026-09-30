// Player commands. Every player action goes through here (locally in single player, over the network in multiplayer).
import { applyOutcome, lead, refusesDraft } from './leader';
import { speak, mindEvent } from './minds';
import { newMind, applyDecision } from './minds';
import type { World } from './world';
import type { Pawn, Blueprint, Building, Zone, Item } from './types';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN, TERRAIN_INDEX } from '../data/terrain';
import { ITEMS } from '../data/items';
import { RECIPES, RESEARCH } from '../data/recipes';
import { PLANTS } from '../data/plants';
import { canPlaceBuilding, makeBuilding, newBill, spawnItem, blueprintCost, pawnShortName, placeItem } from './things';
import { isResearched, canStartResearch } from './research';
import { DESIG } from './map';
import { newZone, addCellsToZone, removeCellsFromZones, deleteZone, findStorageFor } from './zones';
import { mkJob, dropCarry } from './jobs';
import { assignJob, assignBed, endJob } from './ai';
import { executeTrade, executeP2P, type P2POffer } from './trade';
import { findBedFor, findMedicine } from './work';
import { isAnimal } from './stats';
import { destroyBuilding, addStarterBills } from './construction';
import { TICKS_PER_DAY } from '../core/constants';
import { addThoughtToAll } from './mood';

export type Command = { c: string; [k: string]: any };

export interface CmdResult { ok: boolean; msg?: string }
const OK: CmdResult = { ok: true };
const ERR = (msg: string): CmdResult => ({ ok: false, msg });

function ownPawns(w: World, f: number, ids: number[]): Pawn[] {
  return (ids || []).map(id => w.pawns.get(id)).filter((p): p is Pawn => !!p && p.faction === f && !p.dead && !p.guest && (p.race === 'human' || !!p.animal?.tamed));
}
function otherHome(w: World, f: number, i: number) {
  for (const p of w.players) if (p.faction !== f && w.map.inHome(i, p.slot) && !w.map.inHome(i, w.slotOf(f))) return p.faction;
  return 0;
}

export function applyCommand(w: World, f: number, cmd: Command): CmdResult {
  const h = HANDLERS[cmd.c];
  if (!h) return ERR('Unknown command');
  try { return h(w, f, cmd) || OK; } catch (e) { console.error('command failed', cmd, e); return ERR(String(e)); }
}

type Handler = (w: World, f: number, c: Command) => CmdResult | void;
const HANDLERS: Record<string, Handler> = {};

// ---------------- designations ----------------
HANDLERS.designate = (w, f, c) => {
  const m = w.map;
  const kind: string = c.kind;
  let n = 0;
  for (const i of (c.cells || []) as number[]) {
    if (i < 0 || i >= m.n) continue;
    const foreign = otherHome(w, f, i);
    const war = foreign && w.hostile(foreign, f);
    switch (kind) {
      case 'mine': if (m.rock[i] && (!foreign || war)) { m.setDesig(i, DESIG.mine, f); n++; } break;
      case 'chop': if (m.plant[i] && PLANTS[m.plant[i]].kind === 'tree' && (!foreign || war)) { m.setDesig(i, DESIG.chop, f); n++; } break;
      case 'cut': if (m.plant[i] && (!foreign || war)) { m.setDesig(i, DESIG.cut, f); n++; } break;
      case 'harvest': { const pd = m.plantDef(i); if (pd?.harvestItem && m.growth[i] >= (pd.harvestMin ?? 1) - 0.001 && (!foreign || war)) { m.setDesig(i, DESIG.harvest, f); n++; } break; }
      case 'home_add': if (!foreign) { m.setHome(i, w.slotOf(f), true); n++; } break;
      case 'home_remove': m.setHome(i, w.slotOf(f), false); n++; break;
      case 'roof_build': if (!m.roof[i] && !m.rock[i] && !foreign) { m.setRoofDesig(i, 1, f); n++; } break;
      case 'roof_remove': if ((m.roof[i] === 1 || m.roof[i] === 2) && !foreign) { m.setRoofDesig(i, 2, f); n++; } break;
      case 'noroof_add': m.noRoof[i] |= 1 << w.slotOf(f); m.touch(i, false); if (m.roofDesig[i] === 1) m.setRoofDesig(i, 0, 0); break;
      case 'noroof_remove': m.noRoof[i] &= ~(1 << w.slotOf(f)); m.touch(i, false); break;
      case 'remove_floor': if (m.floor[i] && !foreign) { m.setFloor(i, 0); n++; } break;
      case 'cancel': {
        if (m.desig[i] && m.desigF[i] === f) m.setDesig(i, 0, 0);
        if (m.roofDesig[i] && m.roofDesigF[i] === f) m.setRoofDesig(i, 0, 0);
        const bp = m.bp[i] ? w.blueprints.get(m.bp[i]) : null;
        if (bp && bp.faction === f) cancelBlueprint(w, bp);
        const bpf = m.bpFloor[i] ? w.blueprints.get(m.bpFloor[i]) : null;
        if (bpf && bpf.faction === f) cancelBlueprint(w, bpf);
        const b = m.bld[i] ? w.buildings.get(m.bld[i]) : null;
        if (b && b.desig && (b.faction === f || b.faction === 0 || BUILDINGS[b.def].natural)) b.desig = undefined;
        for (const p of w.pawnsAt(i % m.w, (i / m.w) | 0)) if (p.desig && isAnimal(p)) p.desig = undefined;
        n++;
        break;
      }
      case 'deconstruct': {
        const b = m.bld[i] ? w.buildings.get(m.bld[i]) : null;
        if (b && (b.faction === f || b.faction === 0 || w.hostile(b.faction, f)) && b.def !== 'geyser') { if (BUILDINGS[b.def].work === 0) destroyBuilding(w, b, 'deconstruct'); else b.desig = 'deconstruct'; n++; }
        if (m.conduit[i] === f) { m.setConduit(i, 0); spawnItem(w, 'steel', 1, i % m.w, (i / m.w) | 0); m.lightDirty = true; }
        break;
      }
      case 'forbid': case 'unforbid': {
        const ids = m.items[i];
        if (ids) for (const id of ids) { const it = w.items.get(id); if (it && (!foreign || war)) { it.forbidden = kind === 'forbid'; n++; } }
        break;
      }
      case 'hunt': case 'tame': case 'slaughter': {
        for (const p of w.pawnsAt(i % m.w, (i / m.w) | 0)) {
          if (!isAnimal(p) || p.dead) continue;
          if (kind === 'slaughter' && p.faction !== f) continue;
          if ((kind === 'hunt' || kind === 'tame') && p.faction !== 0) continue;
          p.desig = kind; n++;
        }
        break;
      }
    }
  }
  for (const id of (c.things || []) as number[]) {
    const t = w.things.get(id);
    if (!t) continue;
    if (t.kind === 'item') { if (kind === 'forbid') t.forbidden = true; if (kind === 'unforbid') t.forbidden = false; }
    if (t.kind === 'building' && kind === 'deconstruct' && (t.faction === f || t.faction === 0 || w.hostile(t.faction, f))) t.desig = 'deconstruct';
    if (t.kind === 'pawn' && isAnimal(t) && ['hunt', 'tame', 'slaughter'].includes(kind)) {
      if (kind === 'slaughter' && t.faction !== f) continue;
      if (kind !== 'slaughter' && t.faction !== 0) continue;
      t.desig = kind;
    }
    if (kind === 'cancel') { if (t.kind === 'building' || t.kind === 'pawn') t.desig = undefined; if (t.kind === 'blueprint' && t.faction === f) cancelBlueprint(w, t); }
  }
  return { ok: true, msg: n ? undefined : 'Nothing to designate there' };
};

function cancelBlueprint(w: World, bp: Blueprint) {
  for (const [k, v] of Object.entries(bp.delivered)) if (v > 0) spawnItem(w, k, v, bp.x, bp.y, { owner: bp.faction });
  w.despawn(bp);
}

// ---------------- building ----------------
function expandHome(w: World, f: number, x0: number, y0: number, x1: number, y1: number) {
  const m = w.map;
  const slot = w.slotOf(f);
  for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    if (otherHome(w, f, i)) continue;
    m.setHome(i, slot, true);
  }
}

HANDLERS.build = (w, f, c) => {
  const def = c.def as string;
  const d = BUILDINGS[def];
  if (!d || d.hidden) return ERR('Unknown building');
  if (d.research && !isResearched(w, f, d.research)) return ERR('Not researched');
  let stuff: string | undefined = c.stuff;
  if (d.stuffCats) {
    if (!stuff || !ITEMS[stuff]?.stuff || !ITEMS[stuff].stuff!.cats.some(x => d.stuffCats!.includes(x))) stuff = d.stuffCats.includes('woody') ? 'wood' : d.stuffCats.includes('metallic') ? 'steel' : 'cloth';
  } else stuff = undefined;
  const rot = (c.rot || 0) & 3;
  let placed = 0, lastErr = '';
  for (const [x, y] of (c.cells || []) as [number, number][]) {
    if (d.conduit) {
      const i = w.map.idx(x, y);
      if (!w.map.inb(x, y) || w.map.conduit[i] || w.map.rock[i] || otherHome(w, f, i)) continue;
      if (w.map.bpFloor[i]) continue;
    }
    const chk = canPlaceBuilding(w, def, x, y, rot, f);
    if (!chk.ok) { lastErr = chk.reason || ''; continue; }
    if (d.work === 0) {
      const b = makeBuilding(w, def, x, y, rot, stuff, f);
      w.register(b);
      addStarterBills(w, b);
    } else {
      const bp: Blueprint = { id: w.newId(), kind: 'blueprint', def, x, y, rot: d.rotatable ? rot : 0, stuff, faction: f, delivered: {}, work: 0 };
      w.register(bp);
      // designate trees/bushes under the footprint for cutting
      for (const i of w.footprint(x, y, d.size, bp.rot)) {
        const pd = w.map.plantDef(i);
        if (pd && (pd.kind === 'tree' || pd.kind === 'bush') && !d.conduit) w.map.setDesig(i, DESIG.cut, f);
      }
    }
    const [bw, bh] = w.rotSize(d.size, rot);
    expandHome(w, f, x, y, x + bw - 1, y + bh - 1);
    placed++;
  }
  if (!placed) return ERR(lastErr || 'Cannot place here');
  w.sound('place', c.cells[0][0], c.cells[0][1]);
};

/** conduit blueprints complete into the conduit tile layer */
export function completeConduit(w: World, bp: Blueprint) {
  const i = w.map.idx(bp.x, bp.y);
  w.despawn(bp);
  w.map.setConduit(i, bp.faction);
}

HANDLERS.floor = (w, f, c) => {
  const t = TERRAIN.find(t => t.id === c.def);
  if (!t || !t.floor) return ERR('Unknown floor');
  if (t.research && !isResearched(w, f, t.research)) return ERR('Not researched');
  const m = w.map;
  let n = 0;
  for (const i of (c.cells || []) as number[]) {
    if (i < 0 || i >= m.n) continue;
    if (m.rock[i] || m.isWater(i) || m.floor[i] === TERRAIN_INDEX[t.id] || m.bpFloor[i]) continue;
    if (!TERRAIN[m.terrain[i]].canBuild && !m.floor[i]) continue;
    if (otherHome(w, f, i)) continue;
    const x = i % m.w, y = (i / m.w) | 0;
    const bp: Blueprint = { id: w.newId(), kind: 'blueprint', def: t.id, floor: true, x, y, rot: 0, faction: f, delivered: {}, work: 0 };
    w.register(bp);
    const pd = m.plantDef(i);
    if (pd && (pd.kind === 'tree' || pd.kind === 'bush')) m.setDesig(i, DESIG.cut, f);
    n++;
  }
  if (!n) return ERR('Cannot place floor here');
  const cells = c.cells as number[];
  const xs = cells.map(i => i % m.w), ys = cells.map(i => (i / m.w) | 0);
  expandHome(w, f, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
};

// ---------------- zones ----------------
HANDLERS.zone = (w, f, c) => {
  const m = w.map;
  const cells = ((c.cells || []) as number[]).filter(i => i >= 0 && i < m.n && !otherHome(w, f, i));
  if (c.op === 'new') {
    const z = newZone(w, f, c.kind || 'stockpile');
    if (c.kind === 'grow' && c.plant && PLANTS.find(p => p.id === c.plant)) z.plant = c.plant;
    addCellsToZone(w, z, cells);
    if (!w.zones.has(z.id)) return ERR(c.kind === 'grow' ? 'Needs fertile soil' : 'Invalid area');
    expandHome(w, f, Math.min(...cells.map(i => i % m.w)), Math.min(...cells.map(i => (i / m.w) | 0)), Math.max(...cells.map(i => i % m.w)), Math.max(...cells.map(i => (i / m.w) | 0)));
    return { ok: true, msg: String(z.id) };
  }
  if (c.op === 'add') { const z = w.zones.get(c.zone); if (!z || z.faction !== f) return ERR('No zone'); addCellsToZone(w, z, cells); return; }
  if (c.op === 'remove') { removeCellsFromZones(w, f, cells); return; }
  if (c.op === 'delete') { const z = w.zones.get(c.zone); if (z && z.faction === f) deleteZone(w, z); return; }
  if (c.op === 'set') {
    const z = w.zones.get(c.zone);
    if (!z || z.faction !== f) return ERR('No zone');
    const s = c.settings || {};
    if (s.priority !== undefined) z.priority = Math.max(1, Math.min(5, s.priority | 0));
    if (s.plant && PLANTS.find(p => p.id === s.plant)) z.plant = s.plant;
    if (s.allowSow !== undefined) z.allowSow = !!s.allowSow;
    if (s.name) z.name = String(s.name).slice(0, 30);
    if (s.cats) z.filter.cats = s.cats;
    if (s.deny) z.filter.deny = s.deny;
    if (s.allowRotten !== undefined) z.filter.allowRotten = !!s.allowRotten;
  }
};

// ---------------- pawn orders ----------------
HANDLERS.draft = (w, f, c) => {
  const refused: string[] = [];
  for (const p of ownPawns(w, f, c.pawns)) {
    if (p.race !== 'human' || p.downed) continue;
    if (p.mental) continue;
    if (c.on && !p.drafted) {
      const no = refusesDraft(w, p);
      if (no) { speak(w, p, no); mindEvent(w, p, 'The leader tried to order you into battle and you refused.'); refused.push(`${pawnShortName(p)}: "${no}"`); continue; }
    }
    p.drafted = !!c.on;
    if (p.job) endJob(w, p, 'done');
    p.queue = [];
    if (p.carry && p.drafted) dropCarry(w, p);
  }
  if (refused.length) return ERR(`Refused to fight: ${refused.join(' · ')}`);
};
HANDLERS.firewill = (w, f, c) => { for (const p of ownPawns(w, f, c.pawns)) p.fireAtWill = !!c.on; };

HANDLERS.move = (w, f, c) => {
  const m = w.map;
  const pawns = ownPawns(w, f, c.pawns).filter(p => !p.downed && !p.mental);
  const used = new Set<number>();
  const cells: number[] = [];
  // spiral formation
  for (let r = 0; r < 6 && cells.length < pawns.length; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = c.x + dx, y = c.y + dy;
      if (!m.inb(x, y)) continue;
      const i = m.idx(x, y);
      if (!m.passable(i) || used.has(i)) continue;
      used.add(i); cells.push(i);
    }
  }
  pawns.forEach((p, k) => {
    if (p.race === 'human') p.drafted = true;
    const cell = cells[k] ?? m.idx(c.x, c.y);
    if (c.queue && p.job) p.queue.push(mkJob('goto', { c: cell, forced: true }));
    else assignJob(w, p, mkJob('goto', { c: cell, forced: true }));
  });
};

HANDLERS.attack = (w, f, c) => {
  const t = w.things.get(c.target);
  if (!t || (t.kind !== 'pawn' && t.kind !== 'building')) return ERR('Invalid target');
  for (const p of ownPawns(w, f, c.pawns)) {
    if (p.downed || p.mental) continue;
    if (p.race === 'human') p.drafted = true;
    if (t.kind === 'pawn' && t.faction !== f && !w.hostile(f, t.faction) && t.faction !== 0) {
      // attacking a neutral: make hostile
      if (w.isPlayerFaction(t.faction)) { if (w.diplo(f, t.faction) !== 'war') return ERR('Declare war first (Diplomacy)'); }
      else { t.hostileTo = [...(t.hostileTo || []), f]; const fa = w.faction(f); if (fa) fa.goodwill[t.faction] = (fa.goodwill[t.faction] || 0) - 50; }
    }
    assignJob(w, p, mkJob('attack', { t: t.id, forced: true, data: { kill: !!c.kill } }));
  }
};

HANDLERS.prioritize = (w, f, c) => {
  const p = ownPawns(w, f, [c.pawn])[0];
  if (!p || p.downed) return ERR('Invalid pawn');
  const t = c.target ? w.things.get(c.target) : undefined;
  const m = w.map;
  let job = null as any;
  switch (c.job) {
    case 'haul': {
      if (!t || t.kind !== 'item') return ERR('Nothing to haul');
      const dest = findStorageFor(w, p, t);
      if (!dest) return ERR('No stockpile space');
      w.reserve('t' + t.id, p.id); w.reserve('c' + dest.cell, p.id);
      job = mkJob('haul', { t: t.id, c: dest.cell, count: t.count, forced: true }); break;
    }
    case 'equip': if (t?.kind === 'item' && ITEMS[t.def].weapon) job = mkJob('equip', { t: t.id, forced: true }); break;
    case 'wear': if (t?.kind === 'item' && ITEMS[t.def].apparel) job = mkJob('wear', { t: t.id, forced: true }); break;
    case 'eat': if (t?.kind === 'item' && ITEMS[t.def].food) job = mkJob('eat', { t: t.id, forced: true }); break;
    case 'rescue': case 'capture': {
      if (!t || t.kind !== 'pawn' || !t.downed) return ERR('Target is not downed');
      const bed = findBedFor(w, t, f, c.job === 'capture');
      if (!bed) return ERR(c.job === 'capture' ? 'No prisoner bed (mark a bed "For prisoners")' : 'No free bed');
      job = mkJob('rescue', { t: t.id, t2: bed.id, forced: true, data: { capture: c.job === 'capture' } }); break;
    }
    case 'tend': {
      if (!t || t.kind !== 'pawn') return ERR('Invalid patient');
      const med = findMedicine(w, p);
      job = mkJob('tend', { t: t.id, t2: med?.id, forced: true }); break;
    }
    case 'construct': if (t?.kind === 'blueprint') job = mkJob('construct', { t: t.id, forced: true }); break;
    case 'mine': if (c.cell !== undefined && m.rock[c.cell]) { m.setDesig(c.cell, DESIG.mine, f); job = mkJob('mine', { c: c.cell, forced: true }); } break;
    case 'cut': if (c.cell !== undefined && m.plant[c.cell]) { m.setDesig(c.cell, DESIG.cut, f); job = mkJob('cut', { c: c.cell, forced: true }); } break;
    case 'bed': if (t?.kind === 'building' && BUILDINGS[t.def].bed) job = mkJob('sleep', { t: t.id, forced: true }); break;
    case 'strip': break;
  }
  if (!job) return ERR('Cannot do that');
  if (p.drafted) p.drafted = false;
  assignJob(w, p, job);
};

HANDLERS.work = (w, f, c) => {
  const p = ownPawns(w, f, [c.pawn])[0];
  if (!p || p.race !== 'human') return;
  if (p.disabled.includes(c.wt)) return ERR('Incapable');
  p.work[c.wt as keyof Pawn['work']] = Math.max(0, Math.min(4, c.prio | 0));
};
HANDLERS.schedule = (w, f, c) => {
  const p = ownPawns(w, f, [c.pawn])[0];
  if (!p) return;
  const s = p.schedule.split('');
  if (c.hour >= 0 && c.hour < 24 && 'SWJA'.includes(c.val)) s[c.hour] = c.val;
  if (c.all && typeof c.all === 'string' && c.all.length === 24) { p.schedule = c.all; return; }
  p.schedule = s.join('');
};
HANDLERS.rename = (w, f, c) => {
  const p = ownPawns(w, f, [c.pawn])[0];
  if (!p) return;
  const s = String(c.name || '').slice(0, 16).trim();
  if (!s) return;
  if (p.race === 'human') p.name.nick = s; else if (p.animal) p.animal.name = s;
};
HANDLERS.drop = (w, f, c) => {
  const p = ownPawns(w, f, [c.pawn])[0];
  if (!p) return;
  if (c.what === 'weapon' && p.equip) { spawnDrop(w, p, p.equip); p.equip = null; }
  if (c.what === 'apparel') { const a = p.apparel.find(a => a.id === c.id); if (a) { p.apparel.splice(p.apparel.indexOf(a), 1); spawnDrop(w, p, a); } }
  if (c.what === 'carry' && p.carry) dropCarry(w, p);
};
function spawnDrop(w: World, p: Pawn, it: Item) { it.owner = p.faction; placeItem(w, it, p.x, p.y); }

HANDLERS.prisoner = (w, f, c) => {
  const p = w.pawns.get(c.pawn);
  if (!p || !p.guest || p.guest.host !== f) return;
  if (['recruit', 'hold', 'release'].includes(c.mode)) p.guest.mode = c.mode;
};

HANDLERS.bed_owner = (w, f, c) => {
  const b = w.buildings.get(c.bed);
  const p = w.pawns.get(c.pawn);
  if (!b || b.faction !== f || !BUILDINGS[b.def].bed) return;
  if (!p) { for (const o of b.owners || []) { const op = w.pawns.get(o); if (op) op.bed = 0; } b.owners = []; return; }
  if (p.faction !== f && p.guest?.host !== f) return;
  const d = BUILDINGS[b.def].bed!;
  if ((b.owners || []).length >= d.sleepers) { const out = b.owners!.shift(); const op = out ? w.pawns.get(out) : null; if (op) op.bed = 0; }
  assignBed(w, p, b);
};

// ---------------- buildings ----------------
HANDLERS.bld = (w, f, c) => {
  const b = w.buildings.get(c.id);
  if (!b || b.faction !== f) return ERR('Not yours');
  const d = BUILDINGS[b.def];
  switch (c.op) {
    case 'power': b.on = !!c.value; if (d.light) w.map.lightDirty = true; break;
    case 'forbid': b.forbidden = !!c.value; break;
    case 'hold_open': b.holdOpen = !!c.value; if (c.value) b.open = 999999; else b.open = 1; break;
    case 'medical': b.medical = !!c.value; if (c.value) b.prison = false; break;
    case 'prison': b.prison = !!c.value; if (c.value) { b.medical = false; for (const o of b.owners || []) { const op = w.pawns.get(o); if (op && !op.guest) op.bed = 0; } b.owners = []; } break;
    case 'temp': b.tgt = Math.max(-30, Math.min(50, +c.value || 21)); break;
    case 'priority': b.priority = Math.max(1, Math.min(5, c.value | 0)); break;
    case 'filter': if (b.filter) { if (c.value.cats) b.filter.cats = c.value.cats; if (c.value.deny) b.filter.deny = c.value.deny; } break;
    case 'plant': if (d.plantPot && ['rose', 'daylily'].includes(c.value)) b.plant = c.value; break;
    case 'start_reactor': return startReactor(w, f, b);
    case 'uninstall': destroyBuilding(w, b, 'deconstruct'); break;
  }
};

function shipStatus(w: World, f: number) {
  const parts = { reactor: 0, engine: 0, computer: 0, casket: 0, beam: 0 };
  for (const b of w.buildings.values()) if (b.faction === f && BUILDINGS[b.def].ship) (parts as any)[BUILDINGS[b.def].ship!]++;
  return parts;
}
export { shipStatus };
function startReactor(w: World, f: number, b: Building): CmdResult {
  if (!b.reactor) return ERR('Not a reactor');
  const s = shipStatus(w, f);
  if (!s.engine || !s.computer || !s.casket) return ERR('The ship needs an engine, a computer core and at least one cryptosleep casket.');
  if (b.reactor.started) return ERR('Already started');
  b.reactor.started = true; b.reactor.t = w.tick + TICKS_PER_DAY * 3;
  w.letter(f, 'Ship reactor started!', 'The reactor is warming up. In 3 days your ship will launch — but every raider on the planet has detected the energy signature. Defend the ship at all costs!', 'threat', b.x, b.y, b.id);
  addThoughtToAll(w, f, 'hopeful_launch');
  for (const pl of w.players) if (pl.faction !== f) w.letter(pl.faction, 'Rival ship launch!', `${w.faction(f)?.colonyName || 'Another colony'} has started their ship reactor. They will escape in 3 days...`, 'info', b.x, b.y);
  return OK;
}

// ---------------- bills ----------------
HANDLERS.bill = (w, f, c) => {
  const b = w.buildings.get(c.bench);
  if (!b || b.faction !== f || !b.bills) return ERR('No bench');
  const d = BUILDINGS[b.def];
  if (c.op === 'add') {
    if (!d.bench!.recipes.includes(c.recipe)) return ERR('Recipe not available here');
    const rec = RECIPES[c.recipe];
    if (rec.research && !isResearched(w, f, rec.research)) return ERR('Not researched');
    if (b.bills.length >= 12) return ERR('Too many bills');
    const bill = newBill(w, c.recipe);
    if (rec.special === 'stuffed' || rec.products?.[0] && ITEMS[rec.products[0].item].cat !== 'resource') { bill.mode = 'count'; bill.target = 1; }
    if (c.recipe.startsWith('cook') || c.recipe === 'make_pemmican') { bill.mode = 'until'; bill.target = 10; }
    if (c.recipe === 'butcher') bill.mode = 'forever';
    b.bills.push(bill);
    return;
  }
  const bill = b.bills.find(x => x.id === c.bill);
  if (!bill) return ERR('No bill');
  if (c.op === 'remove') b.bills = b.bills.filter(x => x !== bill);
  if (c.op === 'update') {
    const v = c.data || {};
    if (v.mode && ['count', 'until', 'forever'].includes(v.mode)) bill.mode = v.mode;
    if (v.target !== undefined) bill.target = Math.max(1, Math.min(999, v.target | 0));
    if (v.suspended !== undefined) bill.suspended = !!v.suspended;
    if (v.stuff !== undefined) bill.stuff = v.stuff;
    if (v.radius !== undefined) bill.radius = Math.max(5, Math.min(200, v.radius | 0));
    if (v.done !== undefined) bill.done = v.done | 0;
  }
  if (c.op === 'up') { const k = b.bills.indexOf(bill); if (k > 0) { b.bills.splice(k, 1); b.bills.splice(k - 1, 0, bill); } }
};

HANDLERS.research = (w, f, c) => {
  const rs = w.research[f];
  if (!rs) return;
  if (c.clearQueue) { rs.queue = []; return; }
  if (c.unqueue) { rs.queue = (rs.queue || []).filter(q => q !== c.unqueue); return; }
  if (c.id === null) { rs.cur = null; return; }
  if (!RESEARCH[c.id]) return ERR('Unknown project');
  if (c.queue) {
    // queue the project together with every missing prerequisite, in an order that can be researched
    const path = researchPath(w, f, c.id);
    rs.queue = rs.queue || [];
    for (const id of path) if (!rs.queue.includes(id) && id !== rs.cur) rs.queue.push(id);
    if (!rs.cur) { const next = rs.queue.find(q => canStartResearch(w, f, q)); if (next) { rs.cur = next; rs.queue = rs.queue.filter(q => q !== next); } }
    return;
  }
  if (!canStartResearch(w, f, c.id)) return ERR('Prerequisites not met');
  rs.cur = c.id;
  if (rs.queue) rs.queue = rs.queue.filter(q => q !== c.id);
};
/** unresearched projects needed to reach id (prerequisites first), including id */
export function researchPath(w: World, f: number, id: string): string[] {
  const out: string[] = [];
  const visit = (r: string) => {
    if (isResearched(w, f, r) || out.includes(r) || !RESEARCH[r]) return;
    for (const p of RESEARCH[r].prereqs) visit(p);
    out.push(r);
  };
  visit(id);
  return out;
}

// ---------------- trade ----------------
HANDLERS.trade = (w, f, c) => {
  let stock: Item[] | undefined, x = 0, y = 0, drop = false;
  if (c.lord === 'orbital') {
    const o = (w as any).orbital?.[f];
    if (!o || o.until < w.tick) return ERR('The orbital trader has left');
    stock = o.stock;
    const cons = [...w.buildings.values()].find(b => b.faction === f && b.def === 'comms_console');
    if (!cons || !cons.powered) return ERR('Need a powered comms console');
    x = cons.x; y = cons.y + 2; drop = true;
  } else {
    const l = w.lords.get(c.lord);
    if (!l || l.kind !== 'trade' || !l.stock) return ERR('No trader');
    if (l.target !== f && !w.playerFactions().includes(f)) return ERR('Not your trader');
    stock = l.stock;
    const trader = l.pawns.map(id => w.pawns.get(id)).find(p => p?.trader);
    if (!trader) return ERR('Trader is gone');
    x = trader.x; y = trader.y;
  }
  const err = executeTrade(w, f, stock!, c.lines || [], x, y, drop);
  if (err) return ERR(err);
  w.sound('trade', x, y);
  return { ok: true, msg: 'Trade complete' };
};

// ---------------- diplomacy & player trade ----------------
HANDLERS.diplo = (w, f, c) => {
  const other = c.target as number;
  if (!w.isPlayerFaction(other) || other === f) return ERR('Invalid');
  const key = w.diploKey(f, other);
  const offers: any[] = ((w as any).diploOffers ||= []);
  const me = w.faction(f)?.colonyName || 'A colony', them = w.faction(other)?.colonyName || 'a colony';
  if (c.op === 'war') {
    if (!w.settings.pvp) return ERR('PvP is disabled in this game');
    w.diplomacy[key] = 'war';
    w.letter(other, 'War declared!', `${me} has declared war on you! Their colonists may now attack yours and raid your stockpiles.`, 'threat');
    w.letter(f, 'War declared', `You are now at war with ${them}.`, 'bad');
  } else if (c.op === 'peace' || c.op === 'ally') {
    const existing = offers.find(o => o.from === other && o.to === f && o.kind === c.op);
    if (existing) {
      w.diplomacy[key] = c.op === 'peace' ? 'neutral' : 'ally';
      offers.splice(offers.indexOf(existing), 1);
      w.letter(other, c.op === 'peace' ? 'Peace!' : 'Alliance formed', `${me} accepted your ${c.op === 'peace' ? 'peace treaty' : 'alliance'}.`, 'good');
      w.letter(f, c.op === 'peace' ? 'Peace!' : 'Alliance formed', `You are now ${c.op === 'peace' ? 'at peace' : 'allied'} with ${them}.`, 'good');
    } else {
      offers.push({ from: f, to: other, kind: c.op, tick: w.tick });
      w.letter(other, c.op === 'peace' ? 'Peace offered' : 'Alliance offered', `${me} proposes ${c.op === 'peace' ? 'peace' : 'an alliance'}. Open Diplomacy to accept.`, 'info');
    }
  } else if (c.op === 'break') {
    w.diplomacy[key] = 'neutral';
    w.letter(other, 'Alliance ended', `${me} ended your alliance.`, 'bad');
  }
};

HANDLERS.p2p_offer = (w, f, c) => {
  if (!w.isPlayerFaction(c.to) || c.to === f) return ERR('Invalid');
  const offers: P2POffer[] = ((w as any).p2p ||= []);
  const o: P2POffer = { id: w.newId(), from: f, to: c.to, give: c.give || [], want: c.want || [], tick: w.tick, note: String(c.note || '').slice(0, 120) };
  offers.push(o);
  w.letter(c.to, 'Trade offer', `${w.faction(f)?.colonyName} sent you a trade offer. Open Diplomacy to review it.`, 'info');
};
HANDLERS.p2p_respond = (w, f, c) => {
  const offers: P2POffer[] = ((w as any).p2p ||= []);
  const o = offers.find(x => x.id === c.id);
  if (!o || (o.to !== f && o.from !== f)) return ERR('No offer');
  offers.splice(offers.indexOf(o), 1);
  if (!c.accept || o.from === f) { w.letter(o.from, 'Offer declined', `${w.faction(o.to)?.colonyName} declined your trade offer.`, 'neutral'); return; }
  const err = executeP2P(w, o);
  if (err) return ERR(err);
  w.letter(o.from, 'Offer accepted', `${w.faction(o.to)?.colonyName} accepted your trade. Goods are arriving by drop pod.`, 'good');
  w.letter(o.to, 'Trade complete', 'Goods are arriving by drop pod.', 'good');
};

// ---------------- AI minds ----------------
function leaderIntro(w: World, f: number) {
  const pl = w.playerByFaction(f);
  if (!pl || pl.leaderIntro || !pl.minds || pl.leader === false) return;
  pl.leaderIntro = true;
  w.letter(f, 'You lead. They decide.', 'Your colonists think for themselves now, and nobody takes orders. Nothing gets done unless someone agrees to do it. Talk to each of them (tap a colonist, then Talk, or open the Work tab): ask, explain, persuade, bargain. Tap the mic and speak, or type. They will come to you too, with requests, complaints and quarrels. Trust is earned, so keep your promises.', 'info');
}
HANDLERS.minds = (w, f, c) => {
  const pl = w.playerByFaction(f);
  if (!pl) return;
  pl.minds = !!c.on;
  if (c.on) leaderIntro(w, f);
  for (const p of w.colonists(f)) {
    if (c.on) { if (!p.mind) p.mind = newMind(); else { p.mind.on = true; p.mind.want = p.mind.want || w.tick; p.mind.why = 'your mind is your own again'; } }
    else if (p.mind) p.mind.on = false;
  }
};
// ---------------- leader mode ----------------
HANDLERS.leadermode = (w, f, c) => { const pl = w.playerByFaction(f); if (pl) { pl.leader = !!c.on; if (c.on) leaderIntro(w, f); } };
/** a conversation turn with the leader: what they said, and what the colonist said and agreed to */
HANDLERS.agree = (w, f, c) => {
  const p = w.pawns.get(c.pawn);
  if (!p || p.faction !== f || !p.mind || p.dead || !c.o || typeof c.o !== 'object') return ERR('Nobody to talk to');
  const L = lead(p);
  if (c.audience && L.audience) { L.audience = null; L.trust = Math.min(100, L.trust + 1); } // being heard out counts for something
  applyOutcome(w, p, c.o, String(c.said || ''));
};
HANDLERS.audience = (w, f, c) => {
  const p = w.pawns.get(c.pawn);
  if (!p || p.faction !== f || !p.mind) return;
  const L = lead(p);
  if (c.op === 'later' && L.audience) { L.audience.t = w.tick; L.trust = Math.max(-100, L.trust - 1); mindEvent(w, p, 'The leader said they would talk to you later.'); return; } // "not now": resets the clock before it goes stale
  L.audience = null;
};
/** a face-to-face talk opened or closed: the colonist stops what they're doing to listen */
HANDLERS.talking = (w, f, c) => {
  for (const id of Array.isArray(c.pawns) ? c.pawns.slice(0, 12) : []) {
    const p = w.pawns.get(id);
    if (!p || p.faction !== f || !p.mind || p.dead) continue;
    const L = lead(p);
    if (c.on) {
      L.talking = w.tick;
      if (p.job && !p.drafted && !p.job.forced && !['rescue', 'tend', 'flee', 'firefight'].includes(p.job.type) && !p.downed) { if (p.carry) dropCarry(w, p); endJob(w, p, 'done'); }
      p.asleep = false;
    } else if (L.talking) {
      // afterwards the colonist's own mind takes stock of what was said and agreed
      const said = L.chat.filter(l => l.t >= L.talking!).slice(-4).map(l => `${l.who === 0 ? 'Leader' : 'You'}: "${l.text.slice(0, 90)}"`);
      L.talking = undefined;
      if (said.length) mindEvent(w, p, `You just talked with the leader. ${said.join(' ')}`.slice(0, 160), true);
    }
  }
};
/** the leader can always release someone from a duty or change its order; asking for more needs a talk */
HANDLERS.duty = (w, f, c) => {
  const p = w.pawns.get(c.pawn);
  if (!p || p.faction !== f || !p.mind) return;
  const L = lead(p);
  const k = L.duties.findIndex(d => d.id === c.id);
  if (k < 0) return;
  if (c.op === 'drop') { const [d] = L.duties.splice(k, 1); mindEvent(w, p, `The leader released you from ${d.work} duty.`); }
  if (c.op === 'up' && k > 0) { const [d] = L.duties.splice(k, 1); L.duties.splice(k - 1, 0, d); }
};

HANDLERS.mind = (w, f, c) => {
  const p = w.pawns.get(c.pawn);
  if (!p || p.faction !== f || !p.mind?.on || p.dead) return;
  if (c.fail) { p.mind.want = 0; p.mind.last = w.tick; return; } // model unavailable: carry on with routine for a while
  if (!c.d || typeof c.d !== 'object') return ERR('Bad decision');
  applyDecision(w, p, c.d, c.seen | 0);
};

HANDLERS.chat = (w, f, c) => {
  const pl = w.playerByFaction(f);
  w.chat.push({ from: pl?.name || 'Player', text: String(c.text || '').slice(0, 200), tick: w.tick, color: pl?.color || '#fff', n: ++w.seq });
  if (w.chat.length > 100) w.chat.splice(0, w.chat.length - 100);
};

HANDLERS.letter_dismiss = (w, f, c) => { w.letters = w.letters.filter(l => !(l.id === c.id && (l.faction === f || l.faction === 0))); };

export { pawnShortName, blueprintCost };
