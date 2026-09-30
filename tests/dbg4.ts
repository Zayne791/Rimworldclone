// Trace why animals disappear early.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { TICKS_PER_DAY } from '../src/core/constants';
const seed = process.argv[2] || 'soak7';
const w = createWorld({ seed, mapSize: 160, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
const cols = generateStartingColonists(w, 3, seed);
addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: cols, isHost: true });
const orig = w.despawn.bind(w);
(w as any).despawn = (t: any) => {
  if (t.kind === 'pawn') console.log('d', (w.tick / TICKS_PER_DAY).toFixed(2), 'DESPAWN', t.race, t.id, t.dead ? 'dead' : 'alive', 'job', t.job?.type, 'lord', t.lord, 'hp', t.hediffs.map((h: any) => h.type + ':' + (h.src || '')).join(','), '@', t.x, t.y);
  return orig(t);
};
const t0 = Date.now();
for (let t = 0; t < TICKS_PER_DAY * 1.2; t++) simTick(w);
console.log('ms', Date.now() - t0, 'pawns', w.pawns.size);
