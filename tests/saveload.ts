// Save/load round trip mid-game, then keep simulating the loaded world.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { serializeWorld, deserializeWorld, gzip, gunzip } from '../src/sim/save';
import { TICKS_PER_DAY } from '../src/core/constants';
const w = createWorld({ seed: 'save1', mapSize: 120, storyteller: 'classic', difficulty: 2, maxPlayers: 2 });
const [cx, cy] = addColony(w, { slot: 0, playerName: 'A', colonyName: 'A', colonists: generateStartingColonists(w, 3, 'a'), isHost: true });
addColony(w, { slot: 1, playerName: 'B', colonyName: 'B', colonists: generateStartingColonists(w, 3, 'b'), isHost: false });
const m = w.map;
const cells = (x0: number, y0: number, x1: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) o.push(m.idx(x, y)); return o; };
applyCommand(w, 10, { c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 3, cy + 4, cx + 3, cy + 8) });
applyCommand(w, 10, { c: 'build', def: 'campfire', rot: 0, cells: [[cx - 2, cy - 3]] });
for (let t = 0; t < TICKS_PER_DAY * 3; t++) simTick(w);
const sig = (x: typeof w) => JSON.stringify({ tick: x.tick, pawns: [...x.pawns.values()].map(p => [p.id, p.x, p.y, p.hediffs.length, p.needs.food.toFixed(3)]), items: [...x.items.values()].map(i => [i.id, i.def, i.count]), blds: [...x.buildings.values()].map(b => [b.id, b.def, Math.round(b.hp)]), zones: [...x.zones.values()].map(z => z.cells.length), players: x.players.map(p => p.name + p.faction), research: x.research });
const t0 = Date.now();
const json = JSON.stringify(serializeWorld(w));
const gz = await gzip(json);
const w2 = deserializeWorld(JSON.parse(await gunzip(gz)));
console.log(`save ${(json.length / 1024).toFixed(0)} KB json, ${(gz.length / 1024).toFixed(0)} KB gzipped, round trip ${Date.now() - t0} ms`);
console.log('state identical after load:', sig(w) === sig(w2));
let errors = 0;
for (let t = 0; t < TICKS_PER_DAY * 2; t++) { try { simTick(w2); } catch (e) { if (errors++ < 3) console.error('TICK ERROR after load', w2.tick, e); } }
console.log('simulated 2 more days after load, errors', errors, 'colonists', w2.colonists(10).length, w2.colonists(11).length);
