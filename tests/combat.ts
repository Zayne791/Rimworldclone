// Combat balance: 3 starting colonists (auto-drafted, attacking nearest) vs a raid of N points.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { incidentRaid } from '../src/sim/storyteller';
import { pawnHostileTo } from '../src/sim/combat';
import { TICKS_PER_DAY } from '../src/core/constants';
const pointsList = (process.argv[2] || '35,60,90,130,200').split(',').map(Number);
const trials = +(process.argv[3] || 10);
for (const pts of pointsList) {
  let wins = 0, deaths = 0, raiders = 0, dur = 0;
  for (let k = 0; k < trials; k++) {
    const seed = 'cb' + k;
    const w = createWorld({ seed, mapSize: 100, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
    const cols = generateStartingColonists(w, 3, seed);
    const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: cols, isHost: true });
    const F = 10;
    for (let t = 0; t < 600; t++) simTick(w);
    incidentRaid(w, F, pts);
    const lord = [...w.lords.values()].pop()!;
    raiders += lord.pawns.length;
    let t = 0;
    for (; t < TICKS_PER_DAY; t++) {
      simTick(w);
      if (t % 60 === 0) {
        const cs = w.colonists(F).filter(p => !p.downed && !p.dead);
        const en = [...w.pawns.values()].filter(e => e.lord === lord.id && !e.dead && !e.downed);
        if (!cs.length || !en.length || lord.stage === 'flee') break;
        if (en.some(e => Math.hypot(e.x - cx, e.y - cy) < 40)) for (const c of cs) {
          if (c.job?.type === 'attack' && w.pawns.get(c.job.t!) && !w.pawns.get(c.job.t!)!.downed) continue;
          const e = en.reduce((a, b) => Math.hypot(a.x - c.x, a.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? a : b);
          applyCommand(w, F, { c: 'attack', pawns: [c.id], target: e.id });
        }
      }
    }
    const alive = w.colonists(F).filter(p => !p.downed && !p.dead).length;
    if (alive) wins++;
    deaths += 3 - w.colonists(F).filter(p => !p.dead).length;
    dur += t;
  }
  console.log(`pts ${pts}: raiders/raid ${(raiders / trials).toFixed(1)} win ${wins}/${trials} deaths/raid ${(deaths / trials).toFixed(2)} avg fight ${(dur / trials / 60).toFixed(0)}s`);
}
