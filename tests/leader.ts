// Leader mode soak: with AI minds on, nothing gets built, sown or cooked until colonists agree to it
// in conversation; conversations (the offline talk engine, through the same Conversation class the
// talk screen uses) create duties; duties get done; colonists ask for audiences; trust moves with
// how they're treated; low trust refuses the draft; everything survives a save/load.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../src/core/constants';
import { perceive } from '../src/mind/perceive';
import { buildMessages, SYSTEM_LEADER } from '../src/mind/prompt';
import { mockDecide } from '../src/mind/mock';
import { mindDue } from '../src/sim/minds';
import { lead, leaderTick, allowedWork } from '../src/sim/leader';
import { Conversation, parseOutcome, talkState, TALK_SYSTEM } from '../src/mind/talk';
import { serializeWorld, deserializeWorld } from '../src/sim/save';
import type { Pawn } from '../src/sim/types';

let fails = 0;
const ok = (c: boolean, m: string) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// reply parsing
const po = parseOutcome('```json\n{"say":"*sighs* Fine. I will cook.","emotion":"Irritated","agree":["cook"],"trust":"2"}\n```');
ok(po?.say === 'Fine. I will cook.' && po.emotion === 'annoyed' && po.agree?.[0].work === 'cook' && po.trust === 2, 'parses fenced replies, strips stage directions, maps emotions, accepts bare work ids');
ok(parseOutcome('{"emotion":"happy"}') === null && parseOutcome('nope') === null, 'rejects replies with nothing said');

const w = createWorld({ seed: 'leader1', mapSize: 120, storyteller: 'classic', difficulty: 1, maxPlayers: 1 });
const [cx, cy] = addColony(w, { slot: 0, playerName: 'Boss', colonyName: 'Leaders', colonists: generateStartingColonists(w, 4, 'leader1'), isHost: true });
const F = 10, m = w.map;
const cells = (x0: number, y0: number, x1: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) o.push(m.idx(x, y)); return o; };
applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 3, cy + 4, cx + 3, cy + 8) });
applyCommand(w, F, { c: 'zone', op: 'new', kind: 'grow', plant: 'potato', cells: cells(cx + 6, cy - 6, cx + 11, cy - 1) });
applyCommand(w, F, { c: 'build', def: 'campfire', rot: 0, cells: [[cx - 2, cy - 3]] });
const wallCells: [number, number][] = [];
for (let x = cx - 9; x <= cx - 5; x++) wallCells.push([x, cy - 8]);
applyCommand(w, F, { c: 'build', def: 'wall', stuff: 'wood', rot: 0, cells: wallCells });
const r = applyCommand(w, F, { c: 'minds', on: true });
ok(r.ok !== false && w.playerByFaction(F)!.leader !== false, 'minds on: leader mode is the default');
ok(w.letters.some(l => /You lead/.test(l.title)), 'the leader-mode intro letter arrives');
const cols = () => w.colonists(F);
ok(cols().every(p => allowedWork(w, p).every(x => x === 'firefight' || x === 'doctor')), 'nobody starts with any work agreed');

const bpCount = () => [...w.blueprints.values()].filter(b => b.faction === F).length;
const sown = () => cells(cx + 6, cy - 6, cx + 11, cy - 1).filter(i => m.plant[i] && m.plantDef(i)?.id === 'potato').length;
let errors = 0, asked = 0, decisions = 0, promptMax = 0;
const errLog = console.error;
console.error = (...a: any[]) => { errors++; if (errors < 5) errLog(...a); };
const run = (days: number) => {
  for (let t = 0; t < days * TICKS_PER_DAY; t++) {
    simTick(w);
    if (t % 30 !== 0) continue;
    for (const p of cols()) {
      if (lead(p).audience) asked++;
      if (!mindDue(w, p)) continue;
      const pc = perceive(w, p);
      const msgs = buildMessages(pc);
      promptMax = Math.max(promptMax, msgs.reduce((s, x) => s + x.content.length, 0));
      if ((msgs[0].content === SYSTEM_LEADER) !== (w.playerByFaction(F)!.leader !== false)) { errors++; console.log('wrong system prompt for the mode'); }
      applyCommand(w, F, { c: 'mind', pawn: p.id, d: JSON.parse(JSON.stringify(mockDecide(pc))), seen: pc.seen });
      decisions++;
    }
  }
};
const bp0 = bpCount();
run(1);
ok(bpCount() === bp0, `no work without agreement: blueprints untouched (${bpCount()}/${bp0})`);
ok(sown() === 0, `no work without agreement: nothing sown (${sown()})`);
ok(asked > 0, 'colonists ask the leader for a word on their own');
console.log(`   ${decisions} decisions, largest prompt ≈ ${Math.round(promptMax / 4)} tokens`);

// talking, through the same Conversation class the talk screen uses (offline replies)
const g: any = {
  world: w, faction: F, net: null, ui: null,
  minds: { provider: 'offline', overBudget: () => false, settings: {}, stats: { usage: { hit: 0, miss: 0, out: 0 }, cost: 0, calls: 0, fails: 0 }, account() {}, goOffline() {} },
  cmd: (c: any) => applyCommand(w, F, c),
};
async function persuade(p: Pawn, work: string, line: string, tries = 8): Promise<boolean> {
  for (let k = 0; k < tries; k++) {
    const conv = new Conversation(g, [p.id], 'one');
    await conv.open();
    await conv.say(line);
    const last = conv.turns[conv.turns.length - 1];
    if (lead(p).duties.some(d => d.work === work)) { conv.close(); return true; }
    if (last && /if I get|what's in it|I want/i.test(last.text)) { await conv.say('Deal. You have my word, I promise.'); }
    conv.close();
    if (lead(p).duties.some(d => d.work === work)) return true;
  }
  return false;
}
const [a, b, c2] = cols().filter(p => !p.disabled.includes('construct'));
const trust0 = lead(a).trust;
ok(await persuade(a, 'construct', 'Could you please build the walls for us every day? We need shelter before winter, and I would really appreciate it.'), `${a.name.nick} agreed to build after being asked nicely`);
ok(lead(a).chat.some(l => l.who === 0) && lead(a).chat.some(l => l.who === a.id), 'the conversation is logged on both sides');
ok(lead(a).trust >= trust0 - 1, `asking nicely doesn't cost trust (${trust0.toFixed(1)} → ${lead(a).trust.toFixed(1)})`);
const growers = cols().filter(p => !p.disabled.includes('grow'));
let grower = false;
for (const p of growers) if (await persuade(p, 'grow', 'Would you please take care of the crops for us? We need food so that nobody starves.', 4)) { grower = true; break; }
ok(grower, 'someone agreed to farm');
// insult
const t1 = lead(b).trust;
const conv = new Conversation(g, [b.id], 'one');
await conv.open();
await conv.say('You are useless and lazy, you idiot.');
conv.close();
ok(lead(b).trust < t1, `insults cost trust (${t1.toFixed(1)} → ${lead(b).trust.toFixed(1)})`);
ok(b.thoughts.some(t => t.id === 'leader_insulted'), 'and leave a bad memory');
// mediation and a speech to everyone
const med = new Conversation(g, [b.id, c2.id], 'mediate');
await med.open();
await med.say('Can you two work this out and make peace?');
med.close();
ok(med.turns.filter(t => t.who !== 0).length >= 2, 'in a mediation both sides answer');
const all = new Conversation(g, cols().map(p => p.id), 'address');
await all.open();
await all.say('Everyone, thank you. You have all done great work.');
all.close();
ok(all.turns.filter(t => t.who !== 0).length === cols().length, 'a speech to the colony gets an answer from everyone');
// prompts: the static rules are shared by everyone, the state stays a sensible size
const st = talkState(w, a, 'The leader has walked up to you to talk.', w.tick);
ok(TALK_SYSTEM.length < 9000 && st.length < 9000, `talk prompts stay compact (rules ${TALK_SYSTEM.length} chars, state ${st.length} chars)`);

// the agreed work happens
const bp1 = bpCount();
run(1.5);
ok(bpCount() < bp1, `agreed work gets done: blueprints ${bp1} → ${bpCount()}`);
ok(sown() > 0, `agreed farming happens: ${sown()} potatoes sown`);
ok(lead(a).duties.find(d => d.work === 'construct')!.done > 0, 'duty completions are counted');

// ignored requests go stale and sting
const L = lead(c2);
L.audience = { t: w.tick - TICKS_PER_DAY, topic: 'request', text: 'Can we talk?' };
const t2 = L.trust;
leaderTick(w, c2);
ok(!L.audience && L.trust < t2, 'an ignored request goes stale and costs trust');
// releasing a duty
const d0 = lead(a).duties[0];
applyCommand(w, F, { c: 'duty', pawn: a.id, id: d0.id, op: 'drop' });
ok(!lead(a).duties.some(d => d.id === d0.id), 'the leader can always release someone from a duty');
// the draft needs trust
lead(c2).trust = -95;
let refused = 0;
for (let k = 0; k < 20; k++) { const res = applyCommand(w, F, { c: 'draft', pawns: [c2.id], on: true }); if (res.ok === false) refused++; applyCommand(w, F, { c: 'draft', pawns: [c2.id], on: false }); }
ok(refused > 5, `people who have lost faith refuse to be drafted (${refused}/20)`);
lead(c2).trust = 0;
// save/load keeps it all
const w2 = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(w))));
const a2 = w2.pawns.get(a.id)!;
ok(JSON.stringify(a2.mind?.lead) === JSON.stringify(a.mind?.lead), 'duties, trust, promises and talk survive save/load');
// leader mode off: back to picking work freely
applyCommand(w, F, { c: 'leadermode', on: false });
run(0.5);
console.error = errLog;
ok(errors === 0, `no errors (${errors})`);
ok(cols().length >= 3, `colony survives (${cols().length})`);
console.log(fails ? `${fails} FAILURES` : 'leader checks passed');
process.exit(fails ? 1 : 0);
