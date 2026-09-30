// AI minds: colonists whose choices come from a language model (DeepSeek) instead of the work
// priority list. The model picks a goal ("work: grow for 2h", "talk to Kai, friendly, 'Nice stew!'");
// this module turns goals into ordinary jobs, collects the events a mind should hear about, and
// applies the social effect of what they say. Decisions arrive as 'mind' commands, so saves,
// multiplayer and replays all work unchanged. The body keeps a few instincts the model can't
// override: collapsing from exhaustion, eating when starving, fleeing when a raider is in reach,
// mental breaks, and the player's draft orders.
import type { World } from './world';
import type { Pawn, Job } from './types';
import type { WorkType } from '../data/types';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/constants';
import { WORK_TYPES } from '../data/pawns';
import { GIVERS } from './work';
import { mkJob, dropCarry } from './jobs';
import { assignJob, eatJob, sleepJob, joyJob, wanderJob, findFleeCell, endJob } from './ai';
import { findEnemy } from './combat';
import { isIncapable } from './stats';
import { pawnShortName } from './things';
import { roomAt } from './rooms';
import { dist } from '../core/util';

export const ACTIONS = ['work', 'eat', 'sleep', 'relax', 'talk', 'tend', 'fight', 'flee', 'go', 'idle'] as const;
export const TONES = ['friendly', 'joke', 'deep', 'comfort', 'praise', 'flirt', 'apologize', 'argue', 'insult'] as const;
export type Action = typeof ACTIONS[number];
export type Tone = typeof TONES[number];

export interface MindGoal { type: Action; work?: WorkType; target?: number; tone?: Tone; say?: string; place?: string; until: number; label: string; used?: boolean }
export interface Mind {
  on: boolean;
  goal: MindGoal | null;
  thought?: string;
  want: number;                 // tick a new decision was requested (0 = not needed)
  why?: string;                 // what prompted the request
  inbox: { t: number; text: string }[];
  memory: string[];
  last: number;                 // tick of last decision
  n: number;                    // decisions so far
  fails: number;
}
/** a sanitized model decision */
export interface Decision { thought?: string; action: Action; work?: string; target?: string; tone?: string; say?: string; hours?: number; remember?: string; place?: string }
export interface TalkLine { t: number; from: number; to?: number; text: string; tone?: string; kind: 'say' | 'thought'; n?: number }

export function newMind(on = true): Mind { return { on, goal: null, want: 1, why: 'just woke up in the colony', inbox: [], memory: [], last: 0, n: 0, fails: 0 }; }
export function mindOn(p: Pawn) { return !!p.mind?.on; }

/** tell a mind something happened; urgent events ask for a fresh decision soon */
export function mindEvent(w: World, p: Pawn, text: string, urgent = false) {
  const m = p.mind;
  if (!m || !m.on || p.dead) return;
  m.inbox.push({ t: w.tick, text: text.slice(0, 160) });
  if (m.inbox.length > 12) m.inbox.splice(0, m.inbox.length - 12);
  if (urgent && !m.want && w.tick - m.last > 240) { m.want = w.tick; m.why = text.slice(0, 80); }
}
export function mindEventAll(w: World, faction: number, text: string, urgent = false, except?: number) {
  for (const p of w.colonists(faction)) if (p.id !== except) mindEvent(w, p, text, urgent);
}
/** minimum game time between routine decisions (urgent events can come sooner) */
export const MIN_GAP = 900;
function request(w: World, p: Pawn, why: string) {
  const m = p.mind!;
  if (!m.want) { m.want = Math.max(w.tick, m.last + MIN_GAP); m.why = why; }
}
/** is a decision due now? (want holds the tick it becomes due) */
export function mindDue(w: World, p: Pawn) { const m = p.mind; return !!m?.on && !!m.want && m.want <= w.tick && !p.dead; }

const DEFAULT_HOURS: Record<Action, number> = { work: 2, eat: 0.5, sleep: 7, relax: 1, talk: 0.3, tend: 0.5, fight: 0.5, flee: 0.4, go: 0.5, idle: 0.4 };
const clampNum = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** resolve a name the model wrote to a pawn the colonist can see or knows */
export function findByName(w: World, p: Pawn, name: string | undefined): Pawn | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/['"]/g, '').trim();
  if (!n) return null;
  let best: Pawn | null = null, bestD = 1e9;
  for (const o of w.pawns.values()) {
    if (o.id === p.id || o.dead) continue;
    const names = o.race === 'human' ? [o.name.nick, o.name.first, o.name.last, `${o.name.first} ${o.name.last}`] : [o.animal?.name || '', o.race];
    if (!names.some(x => x && x.toLowerCase() === n) && !names.some(x => x && n.includes(x.toLowerCase()) && x.length > 2)) continue;
    const d = dist(p.x, p.y, o.x, o.y) + (o.faction === p.faction ? 0 : 30);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/** apply a model decision (host side, from a 'mind' command) */
export function applyDecision(w: World, p: Pawn, raw: Decision, seen: number) {
  const m = p.mind;
  if (!m || p.dead) return;
  const action = (ACTIONS as readonly string[]).includes(raw.action) ? raw.action as Action : 'idle';
  const thought = clean(raw.thought, 160);
  const say = clean(raw.say, 140);
  const remember = clean(raw.remember, 110);
  const hours = clampNum(raw.hours, 0.15, 8, DEFAULT_HOURS[action]);
  const goal: MindGoal = { type: action, until: w.tick + Math.round(hours * TICKS_PER_HOUR), label: action };
  if (action === 'work') {
    const wt = WORK_TYPES.find(t => t.id === raw.work || t.label.toLowerCase() === String(raw.work || '').toLowerCase());
    if (wt) { goal.work = wt.id; goal.label = wt.label.toLowerCase(); } else { goal.type = 'idle'; goal.label = 'idle'; }
  }
  if (action === 'talk' || action === 'tend' || action === 'fight') {
    const t = findByName(w, p, raw.target);
    if (t) { goal.target = t.id; goal.label = `${action} ${pawnShortName(t)}`; }
    else if (action === 'talk') { goal.type = 'idle'; goal.label = 'looking for someone to talk to'; }
  }
  if (action === 'talk') { goal.tone = (TONES as readonly string[]).includes(String(raw.tone)) ? raw.tone as Tone : 'friendly'; goal.say = say; }
  if (action === 'go') goal.place = clean(raw.place || raw.target, 40);
  m.inbox.splice(0, Math.max(0, Math.min(seen, m.inbox.length)));
  m.goal = goal;
  m.thought = thought || m.thought;
  if (remember) { m.memory.push(remember); if (m.memory.length > 10) m.memory.shift(); }
  m.want = 0; m.why = undefined; m.last = w.tick; m.n++; m.fails = 0;
  if (thought) logTalk(w, { t: w.tick, from: p.id, text: thought, kind: 'thought' });
  // spoken aloud (a talk goal says its line when the two actually meet)
  if (say && action !== 'talk') speak(w, p, say);
  // switch now unless in the middle of something that shouldn't be dropped
  const j = p.job;
  if (j && !p.drafted && !j.forced && !['rescue', 'tend', 'flee', 'eat', 'talk'].includes(j.type) && !(j.type === 'sleep' && p.needs.rest < 0.25)) {
    if (p.carry) dropCarry(w, p);
    endJob(w, p, 'done');
  }
}

export function speak(w: World, p: Pawn, text: string, to?: Pawn, tone?: string) {
  p.speech = { text, t: w.tick + 180 + Math.min(420, text.length * 9), to: to?.id };
  logTalk(w, { t: w.tick, from: p.id, to: to?.id, text, tone, kind: 'say' });
}
function logTalk(w: World, l: TalkLine) {
  l.n = ++w.seq;
  w.talk.push(l);
  if (w.talk.length > 120) w.talk.splice(0, w.talk.length - 120);
}

/** called from think(): returns true when the mind chose this tick's job */
export function mindThink(w: World, p: Pawn): boolean {
  const m = p.mind!;
  // instincts the model can't overrule
  if (p.needs.food < 0.06) { const j = eatJob(w, p); if (j) { assignJob(w, p, j); mindEvent(w, p, 'You are starving and wolfed down some food.'); return true; } }
  if (p.needs.rest < 0.03) { assignJob(w, p, sleepJob(w, p)); mindEvent(w, p, 'You collapsed from exhaustion.'); return true; }
  const g = m.goal;
  if (!g || w.tick > g.until) {
    request(w, p, g ? `finished: ${g.label}` : 'deciding what to do');
    // keep doing the old goal for up to an hour while the model thinks, then fall back to routine
    if (!g || w.tick > g.until + TICKS_PER_HOUR) return false;
  }
  const j = goalJob(w, p, g);
  if (j) { assignJob(w, p, j); return true; }
  m.fails++;
  if (m.fails === 1 || m.fails % 6 === 0) {
    mindEvent(w, p, `You couldn't ${g.label} right now (${failReason(w, p, g)}).`, false);
    request(w, p, `couldn't ${g.label}`);
  }
  return false;
}

function failReason(w: World, p: Pawn, g: MindGoal): string {
  if (g.type === 'work' && g.work && isIncapable(p, g.work)) return 'you are incapable of that work';
  if (g.type === 'work') return 'there is nothing of that kind to do';
  if (g.type === 'eat') return 'no food you can reach';
  if (g.type === 'talk') return 'they are out of reach or busy';
  return 'not possible';
}

function goalJob(w: World, p: Pawn, g: MindGoal): Job | null {
  switch (g.type) {
    case 'work': {
      if (!g.work || isIncapable(p, g.work)) return null;
      const giver = GIVERS[g.work];
      const j = giver ? giver(w, p) : null;
      if (j) j.label = WORK_TYPES.find(t => t.id === g.work)?.label;
      return j;
    }
    case 'eat': return p.needs.food > 0.97 ? done(w, p, g) : eatJob(w, p);
    case 'sleep': return p.needs.rest > 0.97 ? done(w, p, g) : sleepJob(w, p);
    case 'relax': return p.needs.joy > 0.98 ? done(w, p, g) : joyJob(w, p) || wanderJob(w, p, 10);
    case 'talk': {
      const t = g.target ? w.pawns.get(g.target) : null;
      if (!t || t.dead) return null;
      if (g.used) return done(w, p, g); // one conversation per decision
      g.used = true;
      g.until = Math.min(g.until, w.tick + 1600);
      return mkJob('talk', { t: t.id, data: { tone: g.tone, say: g.say }, expire: w.tick + 1500 });
    }
    case 'tend': {
      const t = g.target ? w.pawns.get(g.target) : null;
      const doc = GIVERS.doctor?.(w, p) || null;
      if (doc && (!t || doc.t === t.id)) return doc;
      return doc;
    }
    case 'fight': {
      const t = g.target ? w.pawns.get(g.target) : findEnemy(w, p, 30, true);
      if (!t || t.dead || t.downed || !w.hostile(p.faction, t.faction)) return null;
      return mkJob('attack', { t: t.id, expire: w.tick + 900 });
    }
    case 'flee': {
      const e = findEnemy(w, p, 25, false);
      const home = homeCell(w, p);
      if (e) { const c = findFleeCell(w, p, e.x, e.y); if (c >= 0) return mkJob('flee', { c, expire: w.tick + 900 }); }
      return home >= 0 ? mkJob('goto', { c: home, expire: w.tick + 1200 }) : null;
    }
    case 'go': {
      const c = placeCell(w, p, g.place || '');
      if (c < 0) return wanderJob(w, p, 8);
      const [x, y] = [c % w.map.w, (c / w.map.w) | 0];
      if (dist(p.x, p.y, x, y) < 3) { const j = wanderJob(w, p, 3, x, y); if (j) j.count = 400; return j; }
      return mkJob('goto', { c, expire: w.tick + 2000 });
    }
    case 'idle': default: { const j = wanderJob(w, p, 5); if (j) { j.count = 300; j.label = 'lost in thought'; } return j; }
  }
}
function done(w: World, p: Pawn, g: MindGoal): null { g.until = w.tick; return null; }

function homeCell(w: World, p: Pawn): number {
  const bed = p.bed ? w.buildings.get(p.bed) : null;
  if (bed) return w.map.idx(bed.x, bed.y);
  const pl = w.playerByFaction(p.faction);
  return pl?.startX !== undefined ? w.map.idx(pl.startX, pl.startY!) : -1;
}
/** "kitchen", "bedroom", "fields", "storage", "home", "outside", "workshop", a colonist's name… */
function placeCell(w: World, p: Pawn, place: string): number {
  const q = place.toLowerCase();
  const m = w.map;
  const who = findByName(w, p, place);
  if (who) return m.idx(who.x, who.y);
  if (/bed|sleep|home/.test(q)) return homeCell(w, p);
  if (/field|farm|crop|grow/.test(q)) { for (const z of w.zones.values()) if (z.faction === p.faction && z.kind === 'grow' && z.cells.length) return z.cells[(z.cells.length / 2) | 0]; }
  if (/stock|stor|pile/.test(q)) { for (const z of w.zones.values()) if (z.faction === p.faction && z.kind === 'stockpile' && z.cells.length) return z.cells[(z.cells.length / 2) | 0]; }
  const roles: [RegExp, string][] = [[/kitchen|cook/, 'kitchen'], [/dining|eat/, 'dining room'], [/rec|fun|game/, 'rec room'], [/lab|research/, 'laboratory'], [/workshop|work/, 'workshop'], [/hospital|infirm/, 'hospital'], [/barracks/, 'barracks']];
  for (const [re, role] of roles) if (re.test(q)) { const r = w.rooms.find(r => !r.outdoors && r.faction === p.faction && r.role.includes(role)); if (r) return m.idx(r.cx, r.cy); }
  if (/out|walk|nature|tree|sky/.test(q)) { const r = roomAt(w, p.x, p.y); if (!r || r.outdoors) return m.idx(p.x, p.y); return homeCell(w, p); }
  return -1;
}

/** every so often a mind that has been doing the same thing asks for a re-think (keeps things lively) */
export function mindTick(w: World, p: Pawn) {
  const m = p.mind;
  if (!m?.on || p.dead || p.downed || m.want) return;
  if (m.goal && w.tick > m.goal.until) request(w, p, `finished: ${m.goal.label}`);
  else if (!m.goal) request(w, p, 'deciding what to do');
  else if (w.tick - m.last > TICKS_PER_DAY * 0.25) request(w, p, 'taking stock of the day');
}
