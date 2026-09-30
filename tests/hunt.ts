// Focused test: hunt a deer, then butcher and cook it.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { jobLabel } from '../src/sim/jobs';
import { generateAnimal } from '../src/sim/pawngen';
import { spawnGroupAt } from '../src/sim/lords';
import { TICKS_PER_DAY } from '../src/core/constants';
const seed = process.argv[2] || 'hunt1';
const w = createWorld({ seed, mapSize: 120, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
const cols = generateStartingColonists(w, 3, seed);
const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: cols, isHost: true });
const F = 10, m = w.map;
// no starting meals so the kitchen matters
for (const it of [...w.items.values()]) if (it.def === 'meal_survival') w.despawn(it);
const c = (x0: number, y0: number, x1: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) o.push(m.idx(x, y)); return o; };
console.log(applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: c(cx - 3, cy + 4, cx + 3, cy + 8) }));
console.log(applyCommand(w, F, { c: 'build', def: 'campfire', rot: 0, cells: [[cx - 2, cy - 3]] }));
console.log(applyCommand(w, F, { c: 'build', def: 'butcher_spot', rot: 0, cells: [[cx + 2, cy - 3]] }));
const deer = generateAnimal(w, 'deer', 0, false);
spawnGroupAt(w, [deer], cx + 18, cy + 4, null);
console.log(applyCommand(w, F, { c: 'designate', kind: 'hunt', cells: [m.idx(deer.x, deer.y)] }));
let killedAt = 0, butcheredAt = 0, cookedAt = 0;
for (let t = 0; t < TICKS_PER_DAY * 2; t++) {
  simTick(w);
  if (!killedAt && deer.dead) killedAt = w.tick;
  if (killedAt && !butcheredAt && [...w.items.values()].some(i => i.def === 'meat_deer' || i.def.startsWith('meat'))) butcheredAt = w.tick;
  if (!cookedAt && [...w.items.values()].some(i => i.def === 'meal_simple')) cookedAt = w.tick;
  if (w.tick % 3000 === 0) {
    console.log('t', w.tick, 'deer', deer.dead ? 'dead' : `${deer.x},${deer.y} hp${deer.hediffs.length}${deer.downed ? ' DOWN' : ''}${deer.fleeing ? ' flee' : ''} job ${deer.job?.type}`, '|', w.colonists(F).map(p => `${p.name.nick}:${p.job?.type}:${jobLabel(w, p)}@${p.x},${p.y} ${p.equip?.def}`).join(' | '));
    const cor = [...w.items.values()].filter(i => i.corpse); if (cor.length) console.log('   corpses', cor.map(i => `${i.corpse!.race}@${i.x},${i.y} forb ${i.forbidden} res ${w.reservations.get('t' + i.id)}`).join(', '));
  }
  if (cookedAt && w.tick > cookedAt + 600) break;
}
console.log('killed', killedAt, 'butchered', butcheredAt, 'cooked', cookedAt);
const benches = [...w.buildings.values()].filter(b => b.bills).map(b => `${b.def}: ${JSON.stringify(b.bills)}`);
console.log(benches.join('\n'));
