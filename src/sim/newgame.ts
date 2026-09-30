// World creation and colony setup.
import { World, type Settings } from './world';
import type { Pawn } from './types';
import { generateMap, findStartSite, openness } from './mapgen';
import { generateHuman, generateAnimal, petName } from './pawngen';
import { makeBuilding, makeItem, placeItem, spawnItem, canPlaceBuilding } from './things';
import { WILD_ANIMALS, ANIMALS } from '../data/animals';
import { spawnGroupAt } from './lords';
import { TICKS_PER_HOUR, FIRST_PLAYER_FACTION } from '../core/constants';
import { TERRAIN } from '../data/terrain';
import { Rng } from '../core/rng';
import { ensureRooms } from './rooms';
import { recomputeLight, updateCombinedLight, seasonalTemp } from './environment';
import { ITEMS } from '../data/items';
import { PLAYER_COLORS } from './world';
import { clamp } from '../core/util';

export function createWorld(settings: Partial<Settings> & { seed: string; mapSize: number }): World {
  const w = new World(settings.seed, settings.mapSize, settings.mapSize, settings);
  w.tick = Math.round(TICKS_PER_HOUR * 7);
  generateMap(w);
  const rng = new Rng(settings.seed + ':features');
  // steam geysers
  const nGeysers = Math.round(2 + (w.map.n / (150 * 150)) * 2);
  for (let k = 0, tries = 0; k < nGeysers && tries < 400; tries++) {
    const x = rng.int(8, w.map.w - 10), y = rng.int(8, w.map.h - 10);
    if (openness(w, x, y, 2) < 0.95) continue;
    if (!canPlaceBuilding(w, 'geyser', x, y, 0, 0).ok) continue;
    const g = makeBuilding(w, 'geyser', x, y, 0, undefined, 0);
    for (const i of w.footprint(x, y, [2, 2], 0)) w.map.setPlant(i, 0);
    w.register(g); k++;
  }
  // ancient ruins
  const nRuins = rng.int(1, 3) + (w.map.n > 180 * 180 ? 1 : 0);
  for (let k = 0, tries = 0; k < nRuins && tries < 300; tries++) {
    const rw = rng.int(5, 9), rh = rng.int(5, 8);
    const x = rng.int(10, w.map.w - rw - 10), y = rng.int(10, w.map.h - rh - 10);
    if (openness(w, x + (rw >> 1), y + (rh >> 1), Math.max(rw, rh) >> 1) < 0.95) continue;
    const stuff = 'blocks_' + w.map.stoneBase;
    for (let dy = 0; dy < rh; dy++) for (let dx = 0; dx < rw; dx++) {
      const edge = dx === 0 || dy === 0 || dx === rw - 1 || dy === rh - 1;
      const i = w.map.idx(x + dx, y + dy);
      w.map.setPlant(i, 0);
      if (!edge) continue;
      if (rng.chance(0.3)) continue;
      const b = makeBuilding(w, 'wall', x + dx, y + dy, 0, stuff, 0);
      b.hp = Math.round(b.hp * rng.range(0.3, 0.9));
      w.register(b);
    }
    spawnItem(w, 'steel', rng.int(20, 70), x + (rw >> 1), y + (rh >> 1));
    if (rng.chance(0.7)) spawnItem(w, 'components', rng.int(1, 4), x + 1 + rng.int(0, rw - 3), y + 1 + rng.int(0, rh - 3));
    if (rng.chance(0.5)) { const d = rng.pick(['rifle_bolt', 'revolver', 'shotgun', 'longsword', 'flak_vest', 'helmet_simple', 'medicine']); placeItem(w, makeItem(w, d, 1, { quality: rng.int(0, 3), stuff: ITEMS[d].stuffCats ? 'steel' : undefined, hp: 60 }), x + 1 + rng.int(0, rw - 3), y + 1 + rng.int(0, rh - 3)); }
    if (rng.chance(0.4)) spawnItem(w, 'silver', rng.int(40, 200), x + 1, y + 1);
    k++;
  }
  // wildlife
  const target = Math.round(w.map.n / 700);
  let count = 0, guard = 0;
  while (count < target && guard++ < 200) {
    const ad = rng.weighted(WILD_ANIMALS, a => a.commonality);
    const n = ad.herd ? rng.int(ad.herd[0], ad.herd[1]) : 1;
    const x = rng.int(5, w.map.w - 6), y = rng.int(5, w.map.h - 6);
    if (!w.map.passable(w.map.idx(x, y))) continue;
    spawnGroupAt(w, Array.from({ length: n }, () => generateAnimal(w, ad.id)), x, y, null);
    count += n;
  }
  w.outdoorTemp = seasonalTemp(w);
  ensureRooms(w);
  recomputeLight(w);
  updateCombinedLight(w);
  return w;
}

/** default start sites for player slots */
export function defaultSitePref(w: World, slot: number, maxPlayers: number): [number, number] {
  const W = w.map.w, H = w.map.h;
  if (maxPlayers <= 1) return [W >> 1, H >> 1];
  const q: [number, number][] = [[0.3, 0.3], [0.7, 0.7], [0.7, 0.3], [0.3, 0.7]];
  const [fx, fy] = q[slot % 4];
  return [Math.round(W * fx), Math.round(H * fy)];
}

export function generateStartingColonists(w: World, n = 3, seed?: string): Pawn[] {
  const rng = new Rng(seed || String(Math.random()));
  const out: Pawn[] = [];
  for (let k = 0; k < n; k++) out.push(generateHuman(w, 0, { kind: 'colonist', rng }));
  return out;
}

export interface ColonySetup {
  slot: number;
  playerName: string;
  colonyName: string;
  colonists: Pawn[];
  site?: [number, number];
  token?: string;
  isHost?: boolean;
  pet?: string;
}

/** Sanitize pawns sent by a client and add a player colony to the world. */
export function addColony(w: World, s: ColonySetup): [number, number] {
  const faction = FIRST_PLAYER_FACTION + s.slot;
  w.addPlayerFaction(s.slot, s.playerName, s.colonyName);
  let pl = w.players.find(p => p.slot === s.slot);
  if (!pl) {
    pl = { slot: s.slot, faction, name: s.playerName, colonyName: s.colonyName, color: PLAYER_COLORS[s.slot % 4], connected: true, token: s.token || '', speed: 1, started: false, isHost: s.isHost };
    w.players.push(pl);
  }
  pl.name = s.playerName; pl.colonyName = s.colonyName; pl.defeated = false; pl.won = false;
  const others = w.players.filter(p => p.slot !== s.slot && p.started && p.startX !== undefined).map(p => [p.startX!, p.startY!] as [number, number]);
  let site = s.site;
  if (site) {
    const [sx, sy] = site;
    if (others.some(([ox, oy]) => Math.hypot(ox - sx, oy - sy) < 40) || openness(w, sx, sy, 5) < 0.75) site = undefined;
  }
  if (!site) {
    const pref = defaultSitePref(w, s.slot, Math.max(w.settings.maxPlayers, w.players.length));
    site = findStartSite(w, pref[0], pref[1], others, Math.min(60, w.map.w * 0.35));
  }
  const [cx, cy] = site;
  pl.startX = cx; pl.startY = cy; pl.started = true;
  // home area
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!w.map.inb(x, y)) continue;
    const i = w.map.idx(x, y);
    if (w.players.some(p => p.slot !== s.slot && w.map.inHome(i, p.slot))) continue;
    w.map.setHome(i, s.slot, true);
  }
  // colonists
  const pawns: Pawn[] = [];
  for (const src of s.colonists.slice(0, 6)) {
    const p: Pawn = JSON.parse(JSON.stringify(src));
    p.id = w.newId(); p.faction = faction; p.job = null; p.queue = []; p.path = null; p.lord = 0; p.guest = null; p.rel = {};
    p.born = w.tick; p.dead = false; p.downed = false; p.hediffs = []; p.thoughts = []; p.mental = null; p.drafted = false; p.bed = 0;
    for (const sk of Object.values(p.skills)) { sk.lvl = clamp(sk.lvl | 0, 0, 20); sk.passion = clamp(sk.passion | 0, 0, 2); sk.xp = 0; }
    p.traits = p.traits.slice(0, 3);
    p.apparel = (p.apparel || []).slice(0, 5).map(a => ({ ...a, id: w.newId() }));
    p.equip = null;
    p.carry = null; p.inv = [];
    p.needs = { food: 0.85, rest: 0.95, joy: 0.75, mood: 0.7, comfort: 0.5, beauty: 0.5 };
    pawns.push(p);
  }
  // starting relationships
  for (const a of pawns) for (const b of pawns) if (a !== b) a.rel[b.id] = { op: w.rng.int(0, 25) };
  spawnGroupAt(w, pawns, cx, cy, null);
  // gear
  const weapons = ['rifle_bolt', 'revolver', 'knife'];
  pawns.forEach((p, k) => {
    const wd = weapons[k % weapons.length];
    p.equip = makeItem(w, wd, 1, { quality: 2, stuff: wd === 'knife' ? 'plasteel' : undefined });
  });
  // pet
  const pet = generateAnimal(w, s.pet || w.rng.pick(['dog', 'cat', 'dog']), faction, true);
  pet.animal!.master = pawns[0]?.id || 0;
  spawnGroupAt(w, [pet], cx + 1, cy + 1, null);
  // supplies scattered like a crash site
  const supplies: [string, number][] = [['steel', 450], ['wood', 300], ['meal_survival', 40], ['medicine', 20], ['components', 30], ['silver', 800], ['cloth', 60]];
  supplies.forEach(([d, n], k) => {
    const a = (k / supplies.length) * Math.PI * 2;
    spawnItem(w, d, n, Math.round(cx + Math.cos(a) * 3), Math.round(cy + Math.sin(a) * 3), { owner: faction });
  });
  // ship wreckage
  for (let k = 0; k < 2; k++) {
    for (let t = 0; t < 20; t++) {
      const x = cx + w.rng.int(-9, 9), y = cy + w.rng.int(-9, 9);
      if (Math.abs(x - cx) < 4 && Math.abs(y - cy) < 4) continue;
      if (!canPlaceBuilding(w, 'ship_chunk', x, y, 0, 0).ok) continue;
      w.register(makeBuilding(w, 'ship_chunk', x, y, 0, undefined, 0));
      break;
    }
  }
  for (let k = 0; k < 3; k++) placeItem(w, makeItem(w, 'chunk_slag'), cx + w.rng.int(-6, 6), cy + w.rng.int(-6, 6));
  w.letter(faction, 'Crash landing', `Your escape pods have crashed on this uncharted rimworld. ${pawns.map(p => p.name.nick || p.name.first).join(', ')} survived the landing.\n\nBuild shelter, grow food and defend yourselves. Maybe, one day, you'll build a ship to escape.\n\nTip: Menu → How to play explains the touch controls. The hints on the left suggest what to do next.`, 'info', cx, cy);
  return site;
}
