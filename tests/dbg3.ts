// Diagnose stuck blueprints in the soak colony.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { blueprintNeeds } from '../src/sim/things';
const seed = process.argv[2] || 'soak7';
const w = createWorld({ seed, mapSize: 160, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
const cols = generateStartingColonists(w, 3, seed);
const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: cols, isHost: true });
const F = 10, m = w.map;
const rx = cx - 12, ry = cy - 6, rw = 8, rh = 7;
const wallCells: [number, number][] = [];
for (let x = rx; x < rx + rw; x++) { wallCells.push([x, ry]); wallCells.push([x, ry + rh - 1]); }
for (let y = ry + 1; y < ry + rh - 1; y++) { wallCells.push([rx, y]); wallCells.push([rx + rw - 1, y]); }
console.log(applyCommand(w, F, { c: 'build', def: 'wall', stuff: 'wood', rot: 0, cells: wallCells }));
console.log(applyCommand(w, F, { c: 'build', def: 'bed', stuff: 'wood', rot: 0, cells: [[rx + 1, ry + 1], [rx + 3, ry + 1], [rx + 5, ry + 1]] }));
for (let t = 0; t < 20000; t++) simTick(w);
for (const bp of w.blueprints.values()) {
  const i = m.idx(bp.x, bp.y);
  console.log('BP', bp.def, bp.x, bp.y, 'needs', blueprintNeeds(bp), 'plant', m.plantDef(i)?.id, 'rock', m.rock[i], 'bld', m.bld[i], 'items', m.items[i], 'pawns', m.pawns[i], 'terrain', m.terrain[i], 'water', m.isWater(i), 'fail', [...(w as any).failMarks?.entries?.() || []].filter(([k]: any) => k.includes(String(bp.id))));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = m.idx(bp.x + dx, bp.y + dy); console.log('  ', dx, dy, 'bld', m.bld[j], w.buildings.get(m.bld[j])?.def, 'plant', m.plantDef(j)?.id, 'rock', m.rock[j]); }
}
import { findPath, pathOptsFor } from '../src/sim/path';
import { findWork } from '../src/sim/work';
for (const bp of w.blueprints.values()) {
  for (const p of w.colonists(F)) {
    const path = findPath(w, p.x, p.y, bp.x, bp.y, pathOptsFor(w, p), true, 1, 1);
    console.log(p.name.nick, '@', p.x, p.y, 'path', path ? path.length : null, 'reach', w.map.connected(w.map.idx(p.x, p.y), w.map.idx(bp.x, bp.y)), 'res', w.reservations.get('t' + bp.id), w.reservations.get('d' + bp.id + 'wood'), 'job', p.job?.type, JSON.stringify(findWork(w, p)?.type));
  }
}
m.ensureRegions();
for (let y = 72; y <= 82; y++) { let s = ''; for (let x = 66; x <= 78; x++) { const i = m.idx(x, y); s += (m.cost[i] >= 9999 ? '#' : String(m.region[i] % 36 .toString(36))).padStart(3); } console.log(y, s); }
console.log('cost bp', m.cost[m.idx(69,74)], 'region dirty', m.regionDirty);
