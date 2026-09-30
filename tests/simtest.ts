// Headless simulation soak test: builds a small colony and runs it for several days.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { jobLabel } from '../src/sim/jobs';
import { TICKS_PER_DAY } from '../src/core/constants';
import { ITEMS } from '../src/data/items';

const days = +(process.argv[2] || 6);
const size = +(process.argv[3] || 120);
const seed = process.argv[4] || 'soak1';
const t0 = Date.now();
const w = createWorld({ seed, mapSize: size, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
console.log('world gen ms', Date.now() - t0, 'things', w.things.size, 'pawns', w.pawns.size);
const cols = generateStartingColonists(w, 3, seed);
const [cx, cy] = addColony(w, { slot: 0, playerName: 'Tester', colonyName: 'Testville', colonists: cols, isHost: true });
const F = 10;
console.log('site', cx, cy);
const m = w.map;
const cells = (x0: number, y0: number, x1: number, y1: number) => { const out: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) out.push(m.idx(x, y)); return out; };
const log = (r: any, what: string) => { if (!r.ok) console.log('CMD FAIL', what, r.msg); };
// find buildable offsets near site
function open(x0: number, y0: number, w0: number, h0: number) { for (let y = y0; y < y0 + h0; y++) for (let x = x0; x < x0 + w0; x++) { if (!m.inb(x, y)) return false; const i = m.idx(x, y); if (m.rock[i] || m.isWater(i) || m.bld[i]) return false; } return true; }
log(applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 3, cy + 4, cx + 3, cy + 8) }), 'stockpile');
{ let gx = cx + 6, gy = cy - 4; for (let k = 0; k < 40 && !open(gx, gy, 7, 7); k++) { gx = cx + ((k * 7) % 30) - 15; gy = cy + Math.floor(k / 4) * 3 - 15; } log(applyCommand(w, F, { c: 'zone', op: 'new', kind: 'grow', plant: 'potato', cells: cells(gx, gy, gx + 6, gy + 6) }), 'grow'); }
// room with walls
const rx = cx - 12, ry = cy - 6, rw = 8, rh = 7;
const wallCells: [number, number][] = [];
for (let x = rx; x < rx + rw; x++) { wallCells.push([x, ry]); wallCells.push([x, ry + rh - 1]); }
for (let y = ry + 1; y < ry + rh - 1; y++) { wallCells.push([rx, y]); wallCells.push([rx + rw - 1, y]); }
const doorCell: [number, number] = [rx + 3, ry + rh - 1];
log(applyCommand(w, F, { c: 'build', def: 'wall', stuff: 'wood', rot: 0, cells: wallCells.filter(c => !(c[0] === doorCell[0] && c[1] === doorCell[1])) }), 'walls');
log(applyCommand(w, F, { c: 'build', def: 'door', stuff: 'wood', rot: 0, cells: [doorCell] }), 'door');
log(applyCommand(w, F, { c: 'build', def: 'bed', stuff: 'wood', rot: 0, cells: [[rx + 1, ry + 1], [rx + 3, ry + 1], [rx + 5, ry + 1]] }), 'beds');
log(applyCommand(w, F, { c: 'build', def: 'campfire', rot: 0, cells: [[cx - 2, cy - 3]] }), 'campfire');
log(applyCommand(w, F, { c: 'build', def: 'butcher_spot', rot: 0, cells: [[cx + 2, cy - 3]] }), 'butcher');
{ let bx = cx - 1, by = cy - 8; for (let k = 0; k < 40 && !open(bx, by, 3, 2); k++) { bx = cx + ((k * 5) % 20) - 10; by = cy + Math.floor(k / 4) * 2 - 10; } log(applyCommand(w, F, { c: 'build', def: 'research_bench', stuff: 'wood', rot: 0, cells: [[bx, by]] }), 'research'); }
log(applyCommand(w, F, { c: 'research', id: 'electricity' }), 'research set');
// designate some trees
const treeCells = cells(cx - 25, cy - 25, cx + 25, cy + 25).filter(i => m.plant[i] && ['oak', 'poplar', 'pine', 'birch'].some(t => m.plantDef(i)!.id === t)).slice(0, 30);
log(applyCommand(w, F, { c: 'designate', kind: 'chop', cells: treeCells }), 'chop');
const rockCells = cells(cx - 30, cy - 30, cx + 30, cy + 30).filter(i => m.rock[i]).slice(0, 20);
if (rockCells.length) log(applyCommand(w, F, { c: 'designate', kind: 'mine', cells: rockCells }), 'mine');

let campfire = [...w.buildings.values()].find(b => b.def === 'campfire');
const tStart = Date.now();
let lastReport = 0;
let errors = 0;
for (let t = 0; t < days * TICKS_PER_DAY; t++) {
  try { simTick(w); } catch (e) { errors++; if (errors < 5) console.error('TICK ERROR', w.tick, e); if (errors > 50) break; }
  if (!campfire) { campfire = [...w.buildings.values()].find(b => b.def === 'campfire'); if (campfire) applyCommand(w, F, { c: 'bill', op: 'add', bench: campfire.id, recipe: 'cook_simple' }); }
  if (w.tick - lastReport >= TICKS_PER_DAY / 2) {
    lastReport = w.tick;
    const colonists = w.colonists(F);
    const bp = [...w.blueprints.values()].length;
    const meals = [...w.items.values()].filter(i => ITEMS[i.def].cat === 'meal').reduce((s, i) => s + i.count, 0);
    const wood = [...w.items.values()].filter(i => i.def === 'wood').reduce((s, i) => s + i.count, 0);
    console.log(`day ${(w.tick / TICKS_PER_DAY).toFixed(1)} h${w.hour.toFixed(1)} temp ${w.outdoorTemp.toFixed(1)} weather ${w.weather.cur} | cols ${colonists.length} bp ${bp} meals ${meals} wood ${wood} bld ${w.buildings.size} pawns ${w.pawns.size} lords ${w.lords.size} research ${JSON.stringify(w.research[F].prog)} done ${w.research[F].done}`);
    for (const b of w.blueprints.values()) console.log('   BP', b.def, b.x, b.y, JSON.stringify(b.delivered), b.work.toFixed(0));
    for (const p of colonists) console.log(`   ${p.name.nick.padEnd(10)} ${(p.job?.type || '-').padEnd(8)} ${jobLabel(w, p).padEnd(28)} food ${p.needs.food.toFixed(2)} rest ${p.needs.rest.toFixed(2)} joy ${p.needs.joy.toFixed(2)} mood ${p.needs.mood.toFixed(2)} hp ${p.hediffs.length} ${p.downed ? 'DOWNED' : ''} @${p.x},${p.y}`);
  }
}
const el = (Date.now() - tStart) / 1000;
console.log(`ran ${days} days in ${el.toFixed(1)}s => ${(days * TICKS_PER_DAY / el).toFixed(0)} ticks/s, errors ${errors}`);
const letters = w.letters.map(l => `[d${(l.tick / TICKS_PER_DAY).toFixed(1)}] ${l.title}`);
console.log('letters:', letters.join(' | '));
// debug: why idle?
import { think } from '../src/sim/ai';
import { findWork } from '../src/sim/work';
for (const p of w.colonists(F)) {
  const j = findWork(w, p);
  console.log('findWork', p.name.nick, j?.type, j?.label, 'sched', p.schedule[Math.floor(w.hour)]);
}
import { blueprintNeeds } from '../src/sim/things';
import { itemAccessible } from '../src/sim/zones';
for (const bp of w.blueprints.values()) {
  console.log('BP', bp.def, bp.x, bp.y, blueprintNeeds(bp), 'res d', w.reservations.get('d' + bp.id + 'wood'), 'res t', w.reservations.get('t' + bp.id));
  const p = w.colonists(F)[0];
  console.log('connected', w.map.connected(w.map.idx(p.x, p.y), w.map.idx(bp.x, bp.y)), 'region', w.map.region[w.map.idx(bp.x, bp.y)], w.map.region[w.map.idx(p.x, p.y)], 'cost', w.map.cost[w.map.idx(bp.x, bp.y)], 'bld', w.map.bld[w.map.idx(bp.x, bp.y)]);
  const woods = [...w.items.values()].filter(i => i.def === 'wood');
  for (const it of woods) console.log('  wood', it.id, it.count, it.x, it.y, 'forb', it.forbidden, 'acc', itemAccessible(w, p, it), 'res', w.reservations.get('t' + it.id), 'conn', w.map.connected(w.map.idx(p.x, p.y), w.map.idx(it.x, it.y)));
}
