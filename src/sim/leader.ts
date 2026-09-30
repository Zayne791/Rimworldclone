// Leader mode: with AI minds on, colonists don't take work orders. They only do work they've
// agreed to in conversation with the leader (the player): one-off jobs or regular duties, each
// with a time of day. They keep a trust score for the leader, remember promises, and come to the
// leader themselves with requests, reports, complaints and disputes. Everything here is plain
// data on the pawn's mind, changed only through commands, so it saves and replicates like the rest.
import type { World } from './world';
import type { Pawn, Job } from './types';
import type { WorkType } from '../data/types';
import { WORK_TYPES } from '../data/pawns';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../core/constants';
import { GIVERS } from './work';
import { isIncapable } from './stats';
import { addThought, changeOpinion } from './mood';
import { pawnShortName } from './things';
import { mindEvent } from './minds';

export type When = 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
export const WHENS: When[] = ['any', 'morning', 'afternoon', 'evening', 'night'];
export const WHEN_HOURS: Record<When, [number, number]> = { any: [0, 24], morning: [6, 12], afternoon: [12, 18], evening: [18, 23], night: [22, 30] };
/** work people will do unasked when it matters: putting out fires, tending and rescuing the hurt */
export const EMERGENCY_WORK: WorkType[] = ['firefight', 'doctor'];

export interface Duty { id: number; work: WorkType; regular: boolean; when: When; note: string; since: number; done: number; idle: number }
export interface Audience { t: number; topic: string; text: string; about?: number; urgent?: boolean }
export interface ChatLine { t: number; who: number; text: string; emotion?: string }   // who: 0 = the leader
export interface Lead {
  trust: number;                // -100 .. 100
  duties: Duty[];
  promises: { t: number; text: string }[];
  audience: Audience | null;
  lastAudience: number;
  chat: ChatLine[];             // recent conversation with the leader (both sides)
  talks: number;
  talking?: number;             // tick a face-to-face talk with the leader began (they stand still for it)
}

export function lead(p: Pawn): Lead {
  const m = p.mind!;
  if (!m.lead) m.lead = { trust: 10, duties: [], promises: [], audience: null, lastAudience: 0, chat: [], talks: 0 };
  return m.lead;
}
export function leaderMode(w: World, faction: number): boolean {
  const pl = w.playerByFaction(faction);
  return !!pl?.minds && pl.leader !== false;
}
export function inLeaderMode(w: World, p: Pawn): boolean { return !!p.mind?.on && leaderMode(w, p.faction); }

export function dutyActive(d: Duty, hour: number): boolean {
  const [a, b] = WHEN_HOURS[d.when] || WHEN_HOURS.any;
  const h = hour < a ? hour + 24 : hour;
  return h >= a && h < b;
}
/** work types this colonist may do right now (agreed duties that are on at this hour, plus emergencies) */
export function allowedWork(w: World, p: Pawn): WorkType[] {
  const L = lead(p);
  const out = L.duties.filter(d => dutyActive(d, w.hour)).map(d => d.work);
  for (const e of EMERGENCY_WORK) if (!out.includes(e)) out.push(e);
  return out;
}
export const workLabel = (id: string) => WORK_TYPES.find(t => t.id === id)?.label || id;
export function dutyText(d: Duty): string {
  return `${workLabel(d.work)}${d.regular ? ` (regular${d.when !== 'any' ? `, ${d.when}s` : ''})` : ' (one-off)'}${d.note ? ` — "${d.note}"` : ''}`;
}

/** routine fallback in leader mode: take work only from agreed duties, in the order they were agreed */
export function findDutyWork(w: World, p: Pawn): Job | null {
  const L = lead(p);
  for (const d of L.duties) {
    if (!dutyActive(d, w.hour) || isIncapable(p, d.work)) continue;
    const g = GIVERS[d.work];
    const j = g ? g(w, p) : null;
    if (j) { j.label = workLabel(d.work); j.data = { ...(j.data || {}), duty: d.id }; d.idle = 0; return j; }
  }
  // emergencies (fire, the wounded) are done unasked by anyone able to
  for (const e of EMERGENCY_WORK) {
    if (isIncapable(p, e) || L.duties.some(d => d.work === e)) continue;
    const j = GIVERS[e]?.(w, p);
    if (j) { j.label = workLabel(e); return j; }
  }
  return null;
}

/** a job finished: count it toward its duty */
export function dutyJobDone(w: World, p: Pawn, j: Job) {
  if (!j.data?.duty || !p.mind) return;
  const d = lead(p).duties.find(x => x.id === j.data.duty);
  if (d) d.done++;
}

const clampNum = (v: unknown, lo: number, hi: number, dflt: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt; };
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

export const FELT = ['none', 'praised', 'inspired', 'comforted', 'thanked', 'insulted', 'threatened', 'dismissed', 'guilted'] as const;
const FELT_THOUGHT: Record<string, string> = { praised: 'leader_praised', inspired: 'leader_inspired', comforted: 'leader_comforted', thanked: 'leader_thanked', insulted: 'leader_insulted', threatened: 'leader_threatened', dismissed: 'leader_dismissed', guilted: 'leader_guilted' };

export interface Outcome {
  say?: string; emotion?: string;
  agree?: { work: string; regular?: boolean; when?: string; note?: string }[];
  drop?: string[];
  trust?: number; felt?: string; promise?: string; remember?: string;
  opinion?: Record<string, number>;
  end?: boolean;
}

/** apply the result of a conversation turn with the leader (host side, 'agree' command) */
export function applyOutcome(w: World, p: Pawn, o: Outcome, leaderLine: string) {
  if (!p.mind || p.dead) return;
  const L = lead(p);
  const t = w.tick;
  if (leaderLine) pushChat(L, { t, who: 0, text: clean(leaderLine, 300) });
  const say = clean(o.say, 400);
  if (say) {
    pushChat(L, { t, who: p.id, text: say, emotion: clean(o.emotion, 16) });
    p.speech = { text: say.length > 90 ? say.slice(0, 88) + '…' : say, t: t + 240 + Math.min(420, say.length * 6) };
  }
  // duties
  for (const a of (o.agree || []).slice(0, 4)) {
    const wt = WORK_TYPES.find(x => x.id === a.work || x.label.toLowerCase() === String(a.work || '').toLowerCase());
    if (!wt || wt.hidden || isIncapable(p, wt.id)) continue;
    const when = (WHENS as string[]).includes(String(a.when)) ? a.when as When : 'any';
    const existing = L.duties.find(d => d.work === wt.id);
    const note = clean(a.note, 80);
    if (existing) { existing.regular = existing.regular || !!a.regular; existing.when = when; if (note) existing.note = note; existing.idle = 0; }
    else if (L.duties.length < 8) L.duties.push({ id: ++w.seq, work: wt.id, regular: !!a.regular, when, note, since: t, done: 0, idle: 0 });
    mindEvent(w, p, `You agreed with the leader to ${a.regular ? 'regularly ' : ''}do ${wt.label.toLowerCase()}${note ? ` (${note})` : ''}.`);
  }
  for (const d of o.drop || []) {
    const k = L.duties.findIndex(x => x.work === d || String(x.id) === String(d));
    if (k >= 0) L.duties.splice(k, 1);
  }
  L.trust = Math.max(-100, Math.min(100, L.trust + clampNum(o.trust, -12, 12, 0)));
  const felt = String(o.felt || 'none');
  if (FELT_THOUGHT[felt]) addThought(w, p, FELT_THOUGHT[felt]);
  if (felt === 'inspired' && !p.inspired && w.rng.chance(0.25)) {
    p.inspired = 'frenzy'; p.inspiredT = t + TICKS_PER_DAY * 0.5;
    w.letter(p.faction, `Inspired: ${pawnShortName(p)}`, `Your words got through to ${pawnShortName(p)}. They're working like never before.`, 'good', p.x, p.y, p.id);
  }
  const promise = clean(o.promise, 120);
  if (promise) { L.promises.push({ t, text: promise }); if (L.promises.length > 6) L.promises.shift(); }
  const remember = clean(o.remember, 110);
  if (remember) { p.mind.memory.push(remember); if (p.mind.memory.length > 10) p.mind.memory.shift(); }
  for (const [name, dv] of Object.entries(o.opinion || {})) {
    const other = [...w.pawns.values()].find(x => x.race === 'human' && !x.dead && [x.name.nick, x.name.first].some(n => n && n.toLowerCase() === name.toLowerCase()));
    if (other && other.id !== p.id) changeOpinion(p, other.id, clampNum(dv, -15, 15, 0));
  }
  L.talks++;
}
function pushChat(L: Lead, l: ChatLine) { L.chat.push(l); if (L.chat.length > 24) L.chat.splice(0, L.chat.length - 24); }

/** a colonist asks to speak to the leader (from a mind decision) */
export function requestAudience(w: World, p: Pawn, topic: string, text: string, about?: Pawn | null) {
  const L = lead(p);
  const urgent = topic === 'warning' || topic === 'emergency';
  if (L.audience && !urgent) return false;
  if (!urgent && w.tick - L.lastAudience < TICKS_PER_HOUR * 3) return false;
  L.audience = { t: w.tick, topic: clean(topic, 16) || 'chat', text: clean(text, 220) || 'Got a minute?', about: about?.id, urgent };
  L.lastAudience = w.tick;
  w.fx.push({ k: 'audience', x: p.x, y: p.y, f: p.faction, id: p.id, s: L.audience.text });
  return true;
}

/** hourly upkeep: trust drifts with how life is going; ignored requests sting; duties that ran dry end */
export function leaderTick(w: World, p: Pawn) {
  if (!p.mind?.on || p.dead || !leaderMode(w, p.faction)) return;
  const L = lead(p);
  const mood = p.needs.mood;
  let d = 0;
  if (mood > 0.7 && L.trust < 40) d += 0.25;
  if (mood < 0.3) d -= 0.35;
  const regular = L.duties.filter(x => x.regular).length;
  const tolerance = p.traits.includes('lazy') || p.traits.includes('slothful') ? 1 : p.traits.includes('industrious') || p.traits.includes('hard_worker') ? 4 : 2;
  if (regular > tolerance + 1) d -= 0.2 * (regular - tolerance - 1);
  if (!p.bed && w.hour > 21) d -= 0.1;
  L.trust = Math.max(-100, Math.min(100, L.trust + d));
  // an unanswered request goes stale after half a day, and the colonist notices
  if (L.audience && w.tick - L.audience.t > TICKS_PER_DAY * 0.5) {
    L.trust = Math.max(-100, L.trust - 4);
    mindEvent(w, p, `The leader never answered when you asked to talk ("${L.audience.text.slice(0, 60)}").`);
    L.audience = null;
    addThought(w, p, 'leader_dismissed');
  }
  // one-off duties end once there's been nothing left to do for a couple of hours
  for (let k = L.duties.length - 1; k >= 0; k--) {
    const du = L.duties[k];
    if (du.regular) continue;
    const g = GIVERS[du.work];
    let open = false;
    const snap = new Map(w.reservations);
    try { open = !!(g && g(w, p)); } catch { open = true; }
    w.reservations = snap;
    du.idle = open ? 0 : du.idle + 1;
    if (du.idle >= 2 && du.done > 0 || du.idle >= 12) {
      L.duties.splice(k, 1);
      mindEvent(w, p, `You finished the job the leader asked for: ${workLabel(du.work).toLowerCase()}${du.note ? ` (${du.note})` : ''}.`);
    }
  }
  // someone who has lost all faith eventually walks away
  if (L.trust <= -80 && mood < 0.35 && !p.mental && w.rng.chance(0.04)) {
    p.mental = { kind: 'give_up', t: TICKS_PER_DAY };
    w.letter(p.faction, `${pawnShortName(p)} is leaving`, `${pawnShortName(p)} has lost all faith in your leadership and is walking away from the colony.`, 'bad', p.x, p.y, p.id);
  }
}

/** drafting is an order too: people who don't trust you may refuse to fight for you */
export function refusesDraft(w: World, p: Pawn): string | null {
  if (!inLeaderMode(w, p)) return null;
  const tr = lead(p).trust;
  if (tr > -30) return null;
  const chance = Math.min(0.85, (-tr - 30) / 60 + (p.traits.includes('wimp') ? 0.2 : 0));
  if (!w.rng.chance(chance)) return null;
  return ['Fight them yourself!', "I'm not dying for you.", 'Find someone else.', 'No. Not after how you treated me.'][w.rng.int(0, 3)];
}
