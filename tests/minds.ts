// AI minds soak: colonists are driven by decisions (the offline mind stands in for DeepSeek, going
// through the same perceive → JSON → 'mind' command path). Checks the colony still functions,
// people talk, and measures prompt size to estimate what the real model would cost.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { jobLabel } from '../src/sim/jobs';
import { TICKS_PER_DAY } from '../src/core/constants';
import { perceive } from '../src/mind/perceive';
import { buildMessages, parseDecision, SYSTEM } from '../src/mind/prompt';
import { mockDecide } from '../src/mind/mock';
import { costOf } from '../src/mind/llm';
import { countResource } from '../src/sim/zones';
import { mindDue } from '../src/sim/minds';

const days = +(process.argv[2] || 3);
const seed = process.argv[3] || 'minds1';
let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// parser robustness
ok(parseDecision('```json\n{"action":"Work","work":"Grow","thought":"x"}\n```')?.work === 'grow', 'parses fenced JSON and lowercases');
ok(parseDecision('Sure! {"action":"socialize","target":"Kai"} hope that helps')?.action === 'talk', 'maps synonyms, ignores prose');
ok(parseDecision('no json here') === null && parseDecision('{"thought":"no action"}') === null, 'rejects answers without an action');

const w = createWorld({ seed, mapSize: 120, storyteller: 'classic', difficulty: 1, maxPlayers: 1 });
const cols = generateStartingColonists(w, 4, seed);
const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'Minds', colonists: cols, isHost: true });
const F = 10, m = w.map;
const cells = (x0: number, y0: number, x1: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) o.push(m.idx(x, y)); return o; };
applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 3, cy + 4, cx + 3, cy + 8) });
applyCommand(w, F, { c: 'zone', op: 'new', kind: 'grow', plant: 'potato', cells: cells(cx + 6, cy - 6, cx + 12, cy) });
applyCommand(w, F, { c: 'build', def: 'campfire', rot: 0, cells: [[cx - 2, cy - 3]] });
applyCommand(w, F, { c: 'build', def: 'butcher_spot', rot: 0, cells: [[cx + 2, cy - 3]] });
applyCommand(w, F, { c: 'build', def: 'research_bench', stuff: 'wood', rot: 0, cells: [[cx - 6, cy - 8]] });
applyCommand(w, F, { c: 'research', id: 'crop_rotation' });
applyCommand(w, F, { c: 'build', def: 'bed', stuff: 'wood', rot: 0, cells: [[cx - 8, cy + 2], [cx - 6, cy + 2], [cx - 4, cy + 2], [cx - 10, cy + 2]] });
const r = applyCommand(w, F, { c: 'minds', on: true });
applyCommand(w, F, { c: 'leadermode', on: process.env.LEADER === '1' }); // classic autonomy here; tests/leader.ts covers leader mode
ok(r.ok !== false && w.colonists(F).every(p => p.mind?.on), 'minds command gives every colonist a mind');

let decisions = 0, chars = 0, maxChars = 0, errors = 0;
const usage = { hit: 0, miss: 0, out: 0 };
const errLog = console.error;
console.error = (...a: any[]) => { errors++; if (errors < 5) errLog(...a); };
const t0 = Date.now();
const total = Math.round(days * TICKS_PER_DAY);
let lastPersona = new Map<number, string>();
for (let t = 0; t < total; t++) {
  simTick(w);
  if (t % 30 !== 0) continue;
  for (const p of w.colonists(F)) {
    if (!mindDue(w, p)) continue;
    const pc = perceive(w, p);
    const msgs = buildMessages(pc);
    const len = msgs.reduce((s, x) => s + x.content.length, 0);
    chars += len; maxChars = Math.max(maxChars, len);
    // cache model: system + persona prefix is reused (hit) once seen, the state message is new
    const prefix = SYSTEM.length + pc.persona.length + 120;
    const cached = lastPersona.get(p.id) === pc.persona ? prefix : SYSTEM.length;
    lastPersona.set(p.id, pc.persona);
    usage.hit += cached / 4; usage.miss += (len - cached) / 4; usage.out += 70;
    const d = mockDecide(pc);
    const res = applyCommand(w, F, { c: 'mind', pawn: p.id, d: JSON.parse(JSON.stringify(d)), seen: pc.seen });
    if (res.ok === false) console.log('mind cmd failed', res.msg);
    decisions++;
  }
  if (t % (TICKS_PER_DAY / 2) === 0) {
    console.log(`day ${(t / TICKS_PER_DAY).toFixed(1)} meals ${countResource(w, F, 'meal_simple')} decisions ${decisions} talk ${w.talk.filter(l => l.kind === 'say').length}`);
    for (const p of w.colonists(F)) console.log(`   ${p.name.nick.padEnd(10)} ${String(p.mind?.goal?.label || '-').padEnd(22)} ${jobLabel(w, p).padEnd(28)} food ${p.needs.food.toFixed(2)} rest ${p.needs.rest.toFixed(2)} joy ${p.needs.joy.toFixed(2)} mood ${p.needs.mood.toFixed(2)}`);
  }
}
console.error = errLog;
const alive = w.colonists(F).length;
const said = w.talk.filter(l => l.kind === 'say');
console.log(`ran ${days} days in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${decisions} decisions (${(decisions / alive / days).toFixed(1)} per colonist-day), ${said.length} lines spoken`);
console.log('sample lines:', said.slice(-6).map(l => `${w.pawns.get(l.from)?.name.nick}→${l.to ? w.pawns.get(l.to)?.name.nick : '*'} (${l.tone}): ${l.text}`).join(' | '));
const avgTok = chars / Math.max(1, decisions) / 4;
const cost = costOf(usage, true);
console.log(`prompt ≈ ${Math.round(avgTok)} tokens avg (max ${Math.round(maxChars / 4)}); est. cost at peak prices $${cost.toFixed(4)} = $${(cost / alive / days).toFixed(4)} per colonist-day (off-peak half)`);
ok(errors === 0, `no errors (${errors})`);
ok(alive >= 3, `colony survives (${alive} alive)`);
ok(decisions >= alive * days * 8, 'minds decide regularly');
ok(said.length >= days * 4, 'colonists talk to each other');
ok(w.colonists(F).some(p => p.thoughts.some(t => ['nice_chat', 'shared_joke', 'deep_talk', 'comforted', 'praised', 'insulted', 'argued'].includes(t.id))), 'conversations leave social thoughts');
ok(w.colonists(F).every(p => p.needs.food > 0.05), 'nobody is starving');
ok(maxChars / 4 < 3500, 'prompts stay compact');
console.log(fails ? `${fails} FAILURES` : 'minds checks passed');
process.exit(fails ? 1 : 0);
