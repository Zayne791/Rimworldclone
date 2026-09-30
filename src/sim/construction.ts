// Completing construction, deconstruction, destruction, mining and plant cutting.
import type { World } from './world';
import type { Building, Blueprint, Pawn } from './types';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN_INDEX, ROCKS } from '../data/terrain';
import { PLANTS } from '../data/plants';
import { makeBuilding, blueprintCost, placeItem, makeItem, spawnItem, buildingLabel, pawnShortName } from './things';
import { skillLevel } from './stats';
import { checkRoofCollapse } from './rooms';
import { clamp } from '../core/util';
import { CHUNK, FILTH } from './map';
import { addThought } from './mood';
import { explode } from './combat';

export function rollQuality(w: World, skill: number, inspired = false): number {
  const mean = 1 + skill * 0.17 + (inspired ? 1 : 0);
  let q = Math.round(w.rng.gauss(mean, 0.9));
  if (q >= 6 && !inspired && w.rng.chance(0.7)) q = 5;
  return clamp(q, 0, 6);
}

const ART_NAMES_A = ['Dawn', 'Sorrow', 'The Wanderer', 'Starfall', 'Memory', 'The Last Harvest', 'Rust and Bone', 'Longing', 'The Crash', 'Hope', 'Silent Muffalo', 'Ember', 'The Hunt', 'Two Lovers', 'Mechanoid Dream', 'Frontier', 'The Lost Ship', 'Winter Song'];
const ART_NAMES_B = ['in Stone', 'Rising', 'Remembered', 'at Dusk', 'Eternal', 'Unbound', 'No. 7', 'Revisited', '', '', ''];

export function completeBlueprint(w: World, bp: Blueprint, builder: Pawn | null) {
  const m = w.map;
  w.despawn(bp);
  if (bp.floor) {
    const i = m.idx(bp.x, bp.y);
    m.setFloor(i, TERRAIN_INDEX[bp.def]);
    if (m.plant[i]) m.setPlant(i, 0);
    w.sound('build_done', bp.x, bp.y);
    return;
  }
  const d = BUILDINGS[bp.def];
  if (d.conduit) { m.setConduit(m.idx(bp.x, bp.y), bp.faction); return; }
  // wall-mounted replaces existing wall
  if (d.wallMounted) { const ex = w.buildingAt(bp.x, bp.y); if (ex && ex.def === 'wall') destroyBuilding(w, ex, 'replaced'); }
  if (d.geyser) { for (const i of w.footprint(bp.x, bp.y, d.size, bp.rot)) { const g = w.buildings.get(m.bld[i]); if (g && g.def === 'geyser') w.despawn(g); } }
  const b = makeBuilding(w, bp.def, bp.x, bp.y, bp.rot, bp.stuff, bp.faction);
  if (d.quality && builder) {
    const skill = skillLevel(builder, d.art ? 'artistic' : 'construction');
    b.quality = rollQuality(w, skill, builder.inspired === 'creativity');
    if (b.quality >= 4 && builder.race === 'human') {
      if (d.art) addThought(w, builder, 'beautiful_sculpture');
      w.letter(bp.faction, `${['awful', 'poor', 'normal', 'good', 'excellent', 'masterwork', 'legendary'][b.quality]} ${d.label}`, `${pawnShortName(builder)} has created a ${['awful', 'poor', 'normal', 'good', 'excellent', 'masterwork', 'legendary'][b.quality]} ${buildingLabel(b)}!`, 'good', b.x, b.y, b.id);
    }
  }
  if (d.art) b.artName = `"${w.rng.pick(ART_NAMES_A)} ${w.rng.pick(ART_NAMES_B)}"`.replace(' "', '"').replace(/ "$/, '"');
  // clear plants under footprint
  const cells = w.footprint(b.x, b.y, d.size, b.rot);
  for (const i of cells) { if (m.plant[i] && !d.growBasin) m.setPlant(i, 0); }
  w.register(b);
  // push items and pawns out if impassable
  if (d.pass !== 'pass' && !d.storage) {
    for (const i of cells) {
      const ids = m.items[i];
      if (ids) for (const id of [...ids]) { const it = w.items.get(id); if (it) { w.despawn(it); placeItem(w, it, i % m.w, ((i / m.w) | 0) + 1); } }
      for (const p of w.pawnsAt(i % m.w, (i / m.w) | 0)) nudgePawn(w, p);
    }
  }
  if (d.light || d.blocksLight) m.lightDirty = true;
  w.sound('build_done', bp.x, bp.y);
}

export function nudgePawn(w: World, p: Pawn) {
  const m = w.map;
  for (let r = 1; r < 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (m.inb(x, y) && m.passable(m.idx(x, y))) { w.movePawnCell(p, x, y); p.nx = x; p.ny = y; p.mp = 0; p.path = null; return; }
  }
}

export function destroyBuilding(w: World, b: Building, reason: 'deconstruct' | 'destroyed' | 'burned' | 'replaced' | 'uninstall') {
  if (!w.buildings.has(b.id)) return;
  const d = BUILDINGS[b.def];
  const m = w.map;
  const [cx, cy] = [b.x, b.y];
  // unassign owners
  if (b.owners) for (const o of b.owners) { const p = w.pawns.get(o); if (p && p.bed === b.id) p.bed = 0; }
  if (b.graveCorpse) placeItem(w, b.graveCorpse, b.x, b.y);
  w.despawn(b);
  if (reason === 'deconstruct') {
    if (b.def === 'ship_chunk') {
      spawnItem(w, 'steel', w.rng.int(35, 60), cx, cy, { owner: b.faction });
      spawnItem(w, 'components', w.rng.int(2, 5), cx, cy);
    } else {
      const cost = blueprintCost({ def: b.def, stuff: b.stuff });
      for (const [k, v] of Object.entries(cost)) { const n = Math.floor(v * 0.75); if (n > 0) spawnItem(w, k, n, cx, cy); }
    }
  } else if (reason === 'destroyed') {
    const cost = blueprintCost({ def: b.def, stuff: b.stuff });
    if ((cost.steel || 0) >= 20 || (b.stuff === 'steel' && (d.stuffCount || 0) >= 20)) placeItem(w, makeItem(w, 'chunk_slag'), cx, cy);
    m.addFilth(cx, cy, FILTH.rubble, 50);
    if (d.turret) explode(w, cx, cy, 1.9, 12, 0, false);
    if (d.power?.battery && (b.stored || 0) > 100) explode(w, cx, cy, 2.5, 18, 0, true);
    w.emit({ k: 'dust', x: cx, y: cy });
  } else if (reason === 'burned') {
    m.addFilth(cx, cy, FILTH.ash, 60);
  }
  if (d.supportsRoof) checkRoofCollapse(w, cx, cy);
  if (d.light || d.blocksLight) m.lightDirty = true;
}

export function mineCell(w: World, i: number, miner: Pawn | null) {
  const m = w.map;
  const r = m.rock[i];
  if (!r) return;
  const rd = ROCKS[r];
  const x = i % m.w, y = (i / m.w) | 0;
  const skill = miner ? skillLevel(miner, 'mining') : 5;
  const yieldF = clamp(0.6 + skill * 0.025, 0.6, 1.1);
  m.setRock(i, 0);
  m.setDesig(i, 0, 0);
  // floor under mined ore uses base stone
  if (rd.ore) m.setTerrain(i, TERRAIN_INDEX['rough_' + m.stoneBase] || m.terrain[i]);
  if (rd.yieldItem) spawnItem(w, rd.yieldItem, Math.max(1, Math.round((rd.yieldCount || 1) * yieldF)), x, y, { owner: miner?.faction });
  else if (rd.chunk && w.rng.chance(0.4)) placeItem(w, makeItem(w, rd.chunk, 1, { owner: miner?.faction }), x, y);
  m.addFilth(x, y, FILTH.rubble, 25);
  w.emit({ k: 'dust', x, y });
  w.sound('mine_done', x, y);
}

export function cutPlant(w: World, i: number, cutter: Pawn | null, harvestOnly = false) {
  const m = w.map;
  const p = m.plant[i];
  if (!p) return;
  const pd = PLANTS[p];
  const g = m.growth[i];
  const x = i % m.w, y = (i / m.w) | 0;
  const skill = cutter ? skillLevel(cutter, 'plants') : 5;
  const yieldF = clamp(0.55 + skill * 0.03, 0.55, 1.15);
  const owner = cutter?.faction;
  if (pd.harvestItem && g >= (pd.harvestMin ?? 1) - 0.001) {
    const n = Math.max(1, Math.round((pd.harvestYield || 1) * yieldF * (pd.kind === 'crop' ? 1 : 0.8)));
    spawnItem(w, pd.harvestItem, n, x, y, { owner });
    if (pd.regrow !== undefined) { m.setGrowth(i, pd.regrow); m.setDesig(i, 0, 0); return; }
  } else if (pd.woodYield && g > 0.15) {
    const n = Math.max(1, Math.round(pd.woodYield * g * yieldF));
    spawnItem(w, 'wood', n, x, y, { owner });
  }
  if (harvestOnly && pd.regrow !== undefined) return;
  m.setPlant(i, 0);
  m.setDesig(i, 0, 0);
  if (pd.kind === 'tree') w.sound('tree_fall', x, y);
}
