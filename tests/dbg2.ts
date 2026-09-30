import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { TICKS_PER_DAY } from '../src/core/constants';
const w = createWorld({ seed: 'soak7', mapSize: 160, maxPlayers: 1 });
addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: generateStartingColonists(w, 3, 'soak7') });
const seen = new Set<number>();
const hit = new Map<number, number>();
for (let t = 0; t < TICKS_PER_DAY * 0.75; t++) {
  simTick(w);
  for (const p of w.pawns.values()) {
    if (p.lastHit && p.lastHit !== hit.get(p.id)) { hit.set(p.id, p.lastHit); console.log('d', (w.tick/60000).toFixed(3), 'HIT', p.race, p.id, 'fac', p.faction, JSON.stringify(p.hediffs.slice(-1))); }
    if (p.animal?.manhunter && !seen.has(p.id)) { seen.add(p.id); console.log('d', (w.tick/60000).toFixed(3), 'MANHUNTER', p.race, p.id, 'target', p.target, 'hed', JSON.stringify(p.hediffs)); }
  }
}
