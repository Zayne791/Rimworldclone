// Pathfinding load in a running colony: calls, failures, node expansions per game hour.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { PATH_STATS } from '../src/sim/path';
import { TICKS_PER_DAY } from '../src/core/constants';
const days = +(process.argv[2] || 2);
const w = createWorld({ seed: 'soak7', mapSize: 160, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: generateStartingColonists(w, 3, 'soak7'), isHost: true });
const t0 = Date.now();
for (let t = 0; t < days * TICKS_PER_DAY; t++) simTick(w);
const hours = days * 24;
console.log(`ticks/s ${Math.round(days * TICKS_PER_DAY / ((Date.now() - t0) / 1000))} | per game hour: calls ${(PATH_STATS.calls / hours).toFixed(0)} fails ${(PATH_STATS.fails / hours).toFixed(0)} nodes ${(PATH_STATS.nodes / hours).toFixed(0)} | nodes/call ${(PATH_STATS.nodes / PATH_STATS.calls).toFixed(0)}`);
