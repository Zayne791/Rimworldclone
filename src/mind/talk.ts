// Face-to-face conversations between the leader (the player) and colonists. Each participant has
// their own message thread, so DeepSeek's prefix cache keeps every earlier turn of the talk cached:
//   [rules for all colonists][who you are][fixed ack][situation + first line][reply][next line]…
// A conversation can be one-on-one, a mediation between people in a dispute, or the leader
// addressing the whole colony. Every reply is applied to the world as an 'agree' command (what was
// said, duties taken on or dropped, trust, feelings, promises), so it saves and replicates.
import type { Game } from '../game';
import type { World } from '../sim/world';
import type { Pawn } from '../sim/types';
import type { Msg } from './prompt';
import { personaText, situation, openWork } from './perceive';
import { WORK_TYPES } from '../data/pawns';
import { lead, dutyText, WHENS, FELT, EMERGENCY_WORK, type Outcome } from '../sim/leader';
import { pawnShortName } from '../sim/things';
import { skillLevel, isIncapable } from '../sim/stats';
import { chat, LLMError } from './llm';
import { mockTalk, detectWork, type MockMemo } from './talkmock';
import { TICKS_PER_DAY } from '../core/constants';

export const EMOTIONS = ['neutral', 'happy', 'excited', 'sad', 'angry', 'annoyed', 'scared', 'thinking', 'surprised', 'embarrassed'] as const;
export type Emotion = typeof EMOTIONS[number];
export type TalkMode = 'one' | 'mediate' | 'address';
export interface Turn { who: number; text: string; emotion?: Emotion; agreed?: string[]; dropped?: string[]; trust?: number; promise?: string; end?: boolean; offline?: boolean }

const WORK_IDS = WORK_TYPES.filter(t => !t.hidden).map(t => `${t.id} (${t.desc.replace(/\.$/, '')})`).join('; ');

export const TALK_SYSTEM = `You are playing one colonist in Starfall Colony, a survival game on a harsh sci-fi frontier planet, in a face-to-face conversation with the colony's leader. The leader is a real person talking to you, usually out loud, so their words are transcribed speech and may have small errors.

The leader cannot force anyone. Work only gets done when a colonist agrees to it in conversation, as a one-off job or a regular duty. As this person, you decide whether to agree, haggle or refuse:
- Your traits, backstory, skills and passions decide what you like doing. Work you are skilled at or passionate about is easy to say yes to; work you are bad at, hate, or that is dirty or dangerous takes convincing.
- Trust matters. With high trust you give the leader the benefit of the doubt; with low trust you want proof, favours or an apology first. Broken promises sting.
- The bigger the ask, the more convincing it takes: a regular duty more than a one-off job, several things at once, night shifts, work while you are exhausted, hungry, hurt or miserable, or when you already carry more duties than the others.
- Good leaders explain why it matters, listen, praise honest work, offer something in return and keep their promises. Demands, threats, insults, guilt trips and ignoring your needs make you dig in, and cost trust. Charm works on some people and not others: a paranoid, abrasive or depressive person is harder to win over, a kind or optimistic one easier.
- You may counter-offer ("I'll cook, but I want a real bed"). When the leader promises you something, record it in "promise".
- Speak your mind like a real person: bring up your needs, grievances, other colonists or the colony's troubles when it fits. In a dispute, give your side honestly and in character; you can be won round, or not.

Reply with a single JSON object only, no other text:
{"say": what you say out loud: 1 to 3 short spoken sentences, natural and in character, no stage directions,
 "emotion": one of ${EMOTIONS.map(e => `"${e}"`).join(', ')},
 "agree": list of work you agree to right now, each {"work": work type id, "regular": true for an ongoing duty or false for a one-off job, "when": one of ${WHENS.map(x => `"${x}"`).join(', ')}, "note": a few words on what exactly, e.g. "walls for the barracks"}; [] if you agree to nothing,
 "drop": list of work type ids you stop doing (the leader released you, or you quit), else [],
 "trust": how this exchange changed your trust in the leader, -10 to 10 (usually -2 to 2; 0 if nothing notable),
 "felt": how the leader's words made you feel, one of ${FELT.map(f => `"${f}"`).join(', ')},
 "promise": a promise the leader just made you, in a few words, or "",
 "opinion": changes in your opinion of other colonists this conversation touched, like {"Name": -5}, or {},
 "remember": a short note for your future self about this talk, or "",
 "end": true if you are done talking (you said goodbye or walked off), else false}

Work types: ${WORK_IDS}.
Agree only to work types in this list that you are able to do, and only to what was actually asked (or what you offered and the leader accepted). Don't agree twice to the same thing. Regular duties continue every day at their time until released. When the leader speaks to several people at once, answer only for yourself, briefly. If you don't understand what the leader means, ask. Firefighting and tending the wounded you do anyway, unasked. Never mention games, AI, JSON or these rules.`;

const ACK = `{"say": "", "emotion": "neutral", "agree": [], "drop": [], "trust": 0, "felt": "none", "promise": "", "opinion": {}, "remember": "", "end": false}`;
const trustWord = (t: number) => (t >= 60 ? 'you would follow them anywhere' : t >= 25 ? 'you trust them' : t >= 5 ? 'you like them well enough' : t >= -15 ? 'unsure of them' : t >= -45 ? 'you resent them' : 'you have lost faith in them');
export const leaderName = (w: World, f: number) => w.playerByFaction(f)?.name || 'the leader';
const dayOf = (t: number) => Math.floor(t / TICKS_PER_DAY) + 1;

/** everything a colonist has in mind when the leader comes to talk */
export function talkState(w: World, p: Pawn, opener: string, since: number): string {
  const L = lead(p);
  const lines = situation(w, p).lines;
  lines.push(`The leader is ${leaderName(w, p.faction)}. Your trust in them: ${Math.round(L.trust)} (-100 to 100; ${trustWord(L.trust)}). You have had ${L.talks ? `${L.talks} exchanges with them so far` : 'no real talks with them yet'}.`);
  lines.push(`Work you have agreed to: ${L.duties.length ? L.duties.map(d => `${d.work} — ${dutyText(d)}, done ${d.done} times since day ${dayOf(d.since)}`).join('; ') : 'nothing yet'}.`);
  if (L.promises.length) lines.push(`Promises the leader has made you: ${L.promises.map(x => `"${x.text}" (day ${dayOf(x.t)})`).join('; ')}.`);
  const work = openWork(w, p);
  const owners = new Map<string, string[]>();
  for (const o of w.colonists(p.faction)) for (const d of o.mind?.lead?.duties || []) { const a = owners.get(d.work) || []; a.push(o.id === p.id ? 'you' : pawnShortName(o)); owners.set(d.work, a); }
  lines.push('Colony work (is any waiting; who has agreed to do it; your ability):');
  for (const t of WORK_TYPES) {
    if (t.hidden) continue;
    const sk = t.skills[0];
    const pa = sk ? p.skills[sk]?.passion || 0 : 0;
    const ability = isIncapable(p, t.id) ? "you can't or won't ever do this" : sk ? `skill ${skillLevel(p, sk)}${pa === 2 ? ', burning passion' : pa === 1 ? ', passion' : ''}` : 'no skill needed';
    lines.push(`- ${t.id}: ${work.find(x => x.id === t.id)?.open ? 'work waiting' : 'nothing waiting'}; ${owners.get(t.id)?.join(', ') || (EMERGENCY_WORK.includes(t.id) ? 'everyone, in emergencies' : 'nobody')}; ${ability}.`);
  }
  const load = w.colonists(p.faction).filter(o => o.id !== p.id).map(o => `${pawnShortName(o)} ${o.mind?.lead?.duties.length || 0}`);
  if (load.length) lines.push(`Duties the others carry: ${load.join(', ')}.`);
  if (p.mind?.memory.length) lines.push(`Things you decided to remember: ${p.mind.memory.map(s => `"${s}"`).join(' ')}`);
  const earlier = L.chat.filter(l => l.t < since).slice(-8);
  if (earlier.length) lines.push(`Earlier talks with the leader: ${earlier.map(l => `[day ${dayOf(l.t)}] ${l.who === 0 ? 'Leader' : 'You'}: "${l.text.slice(0, 160)}"`).join(' | ')}`);
  const inbox = p.mind?.inbox.slice(-5) || [];
  if (inbox.length) lines.push(`On your mind lately: ${inbox.map(e => e.text).join(' | ')}`);
  lines.push('', opener);
  return lines.join('\n');
}

/** tolerant parse of a conversation reply */
export function parseOutcome(text: string): Outcome | null {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  let o: any;
  try { o = JSON.parse(text.slice(s, e + 1)); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  let say = [o.say, o.text, o.reply, o.speech].find(x => typeof x === 'string') as string | undefined || '';
  say = say.replace(/\*[^*]{1,60}\*/g, '').replace(/^\s*\([^)]{1,60}\)\s*/, '').replace(/\s+/g, ' ').trim();
  if (!say && !o.end) return null;
  const emo = String(o.emotion || '').toLowerCase().trim();
  const EMO_SYN: Record<string, Emotion> = { joy: 'happy', glad: 'happy', pleased: 'happy', content: 'happy', amused: 'happy', grateful: 'happy', proud: 'happy', eager: 'excited', thrilled: 'excited', upset: 'sad', tired: 'sad', hurt: 'sad', worried: 'scared', afraid: 'scared', anxious: 'scared', nervous: 'scared', mad: 'angry', furious: 'angry', irritated: 'annoyed', frustrated: 'annoyed', skeptical: 'thinking', curious: 'thinking', doubtful: 'thinking', shocked: 'surprised', shy: 'embarrassed', calm: 'neutral' };
  const emotion: Emotion = (EMOTIONS as readonly string[]).includes(emo) ? emo as Emotion : EMO_SYN[emo] || 'neutral';
  const list = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []);
  const agree = list(o.agree).map(a => (typeof a === 'string' ? { work: a } : a)).filter((a: any) => a && typeof a.work === 'string').slice(0, 4)
    .map((a: any) => ({ work: a.work.toLowerCase().trim(), regular: a.regular === true || a.regular === 'true', when: (WHENS as string[]).includes(String(a.when).toLowerCase()) ? String(a.when).toLowerCase() : 'any', note: typeof a.note === 'string' ? a.note.slice(0, 80) : '' }));
  const drop = list(o.drop).map((d: any) => String(typeof d === 'object' && d ? d.work : d).toLowerCase().trim()).filter(Boolean).slice(0, 8);
  const felt = (FELT as readonly string[]).includes(String(o.felt)) ? String(o.felt) : 'none';
  const opinion: Record<string, number> = {};
  if (o.opinion && typeof o.opinion === 'object' && !Array.isArray(o.opinion)) for (const [k, v] of Object.entries(o.opinion).slice(0, 4)) if (Number.isFinite(Number(v))) opinion[k] = Number(v);
  return {
    say: say.slice(0, 400), emotion, agree, drop, trust: Number.isFinite(Number(o.trust)) ? Number(o.trust) : 0, felt,
    promise: typeof o.promise === 'string' ? o.promise.slice(0, 120) : '', opinion,
    remember: typeof o.remember === 'string' ? o.remember.slice(0, 110) : '', end: o.end === true || o.end === 'true',
  };
}

function pushUser(thread: Msg[], content: string) {
  const last = thread[thread.length - 1];
  if (last.role === 'user') last.content += '\n\n' + content;
  else thread.push({ role: 'user', content });
}

export class Conversation {
  turns: Turn[] = [];
  thinking = new Set<number>();
  left = new Set<number>();          // participants who walked off
  closed = false;
  readonly started: number;
  private threads = new Map<number, Msg[]>();
  private heard = new Map<number, string[]>();
  private memo = new Map<number, MockMemo>();
  private cleared = new Set<number>();
  onUpdate: () => void = () => {};
  onReply: (t: Turn) => void = () => {};

  constructor(public g: Game, public ids: number[], public mode: TalkMode) {
    this.started = g.world.tick;
  }
  get world() { return this.g.world; }
  pawn(id: number) { const p = this.world.pawns.get(id); return p && !p.dead ? p : null; }
  get present(): Pawn[] { return this.ids.filter(id => !this.left.has(id)).map(id => this.pawn(id)).filter(Boolean) as Pawn[]; }
  get offline() { return this.g.minds.provider === 'offline' || this.g.minds.overBudget(); }
  get busy() { return this.thinking.size > 0; }

  private opener(p: Pawn): string {
    const w = this.world, L = lead(p);
    const others = this.ids.filter(id => id !== p.id).map(id => this.pawn(id)).filter(Boolean).map(o => pawnShortName(o!));
    if (this.mode === 'address') return `The leader has gathered the whole colony (${others.join(', ') || 'just you'} and you) and is speaking to everyone at once. Answer only for yourself, in one or two short sentences.`;
    if (this.mode === 'mediate') {
      const asked = this.ids.map(id => this.pawn(id)).find(o => o && lead(o).audience);
      const a = asked ? lead(asked).audience! : null;
      return `The leader has brought you together with ${others.join(' and ')} to talk things out.${a ? ` ${asked!.id === p.id ? 'You' : pawnShortName(asked!)} asked for this: "${a.text}"` : ''} Speak for yourself; the others hear everything you say.`;
    }
    const woke = p.asleep ? 'You were asleep; the leader just woke you up. ' : '';
    if (woke) return woke + 'The leader wants to talk. React the way this person would to being woken, then hear them out.';
    if (L.audience) return `You asked the leader for this talk (${L.audience.topic}${L.audience.about && this.pawn(L.audience.about) ? `, about ${pawnShortName(this.pawn(L.audience.about)!)}` : ''}). They have come over to hear you out.`;
    void w;
    return 'The leader has walked up to you to talk. Greet them in a few words, the way this person would, given how you feel about them and how your day is going.';
  }

  /** start the talk: people who asked for it open with their request; otherwise the colonist greets the leader */
  async open() {
    const w = this.world;
    this.g.cmd({ c: 'talking', pawns: this.ids, on: true });
    for (const id of this.ids) {
      const p = this.pawn(id);
      if (!p) continue;
      this.threads.set(id, [
        { role: 'system', content: TALK_SYSTEM },
        { role: 'user', content: `Who you are:\n${personaText(w, p)}` },
        { role: 'assistant', content: ACK },
        { role: 'user', content: talkState(w, p, this.opener(p), this.started) },
      ]);
      this.heard.set(id, []);
      this.memo.set(id, {});
    }
    if (this.mode === 'address') return;
    const asker = this.present.find(p => lead(p).audience);
    if (asker) {
      const a = lead(asker).audience!;
      const o: Outcome = { say: a.text, emotion: a.topic === 'complaint' || a.topic === 'dispute' ? 'annoyed' : a.topic === 'warning' ? 'scared' : a.topic === 'offer' ? 'happy' : a.topic === 'feelings' || a.topic === 'quit' ? 'sad' : 'neutral' };
      const m = this.memo.get(asker.id)!;
      m.topic = a.topic; if (a.topic === 'offer' || a.topic === 'request') m.offer = detectWork(a.text) || undefined;
      this.threads.get(asker.id)!.push({ role: 'assistant', content: JSON.stringify({ say: a.text, emotion: o.emotion, agree: [], drop: [], trust: 0, felt: 'none', promise: '', opinion: {}, remember: '', end: false }) });
      this.record(asker, o, '');
      return;
    }
    if (this.mode === 'one') await this.reply(this.present[0], null);
  }

  /** the leader says something; the right people answer */
  async say(text: string) {
    text = text.replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!text || this.closed || this.busy) return;
    this.turns.push({ who: 0, text });
    this.onUpdate();
    const people = this.present;
    if (!people.length) return;
    const low = text.toLowerCase();
    let who = people.filter(p => [p.name.nick, p.name.first].some(n => n && new RegExp(`\\b${n.toLowerCase().replace(/[^a-z0-9]/g, '.')}\\b`).test(low)));
    if (!who.length || this.mode === 'address') who = people;
    // whoever spoke last answers last, so the other side gets a word in first
    const lastSpoke = [...this.turns].reverse().find(t => t.who)?.who;
    who.sort((a, b) => (a.id === lastSpoke ? 1 : 0) - (b.id === lastSpoke ? 1 : 0));
    const addressed = who.length === people.length ? '' : ` (to ${who.map(pawnShortName).join(' and ')})`;
    for (const p of people) if (!who.includes(p)) this.heard.get(p.id)?.push(`Leader${addressed}: "${text}"`);
    if (this.mode === 'address' || who.length > 3) {
      // a speech to everyone: all answer at once (a few at a time), each only for themselves
      const queue = [...who];
      const lane = async () => { for (let p = queue.shift(); p; p = queue.shift()) await this.reply(p, text); };
      await Promise.all([lane(), lane(), lane(), lane()]);
    } else for (const p of who) { if (this.closed) break; await this.reply(p, text); }
  }

  /** ask one participant for their reply (leaderLine null = they speak first) */
  private async reply(p: Pawn, leaderLine: string | null) {
    const thread = this.threads.get(p.id);
    if (!thread) return;
    const heard = this.heard.get(p.id)!.splice(0);
    const parts = [...heard];
    if (leaderLine !== null) parts.push(`Leader: "${leaderLine}"`);
    parts.push(`(Answer as ${pawnShortName(p)} with the JSON object.)`);
    pushUser(thread, parts.join('\n'));
    this.thinking.add(p.id);
    this.onUpdate();
    const mc = this.g.minds;
    let o: Outcome | null = null;
    let offline = this.offline;
    if (!offline) {
      try {
        const r = await chat(mc.settings, thread, undefined, 380);
        mc.account(r.usage);
        o = parseOutcome(r.text);
        if (!o) { mc.stats.fails++; mc.stats.lastError = 'Unreadable reply: ' + r.text.slice(0, 80); }
      } catch (e) {
        const err = e instanceof LLMError ? e : new LLMError((e as Error)?.message || String(e));
        mc.stats.fails++; mc.stats.lastError = err.message;
        if (err.fatal) mc.goOffline(err.message);
        else this.g.ui?.toast(`${pawnShortName(p)} didn't quite catch that (${err.message}). Answering offline.`, 'bad');
      }
      if (!o) offline = true;
    }
    if (!o) o = mockTalk(this.world, p, leaderLine, this.memo.get(p.id)!, { mode: this.mode, others: this.present.filter(x => x.id !== p.id), turns: this.turns.length });
    thread.push({ role: 'assistant', content: JSON.stringify(o) });
    this.thinking.delete(p.id);
    if (this.closed) return;
    this.record(p, o, leaderLine || '', offline);
  }

  private record(p: Pawn, o: Outcome, leaderLine: string, offline = false) {
    const clearAudience = this.mode !== 'address' && !this.cleared.has(p.id);
    this.cleared.add(p.id);
    this.g.cmd({ c: 'agree', pawn: p.id, o, said: leaderLine, audience: clearAudience });
    const turn: Turn = {
      who: p.id, text: o.say || '…', emotion: (o.emotion as Emotion) || 'neutral', offline,
      agreed: (o.agree || []).map(a => a.work), dropped: o.drop, trust: o.trust, promise: o.promise, end: o.end,
    };
    this.turns.push(turn);
    for (const q of this.present) if (q.id !== p.id && this.mode !== 'address') this.heard.get(q.id)?.push(`${pawnShortName(p)}: "${turn.text}"`);
    if (o.end) this.left.add(p.id);
    this.onReply(turn);
    this.onUpdate();
  }

  /** bring someone else into the conversation (turns a one-on-one into a mediation) */
  invite(p: Pawn) {
    if (this.ids.includes(p.id) || this.closed || this.mode === 'address') return;
    this.ids.push(p.id);
    this.mode = 'mediate';
    this.g.cmd({ c: 'talking', pawns: [p.id], on: true });
    const w = this.world;
    const so_far = this.turns.slice(-8).map(t => `${t.who === 0 ? 'Leader' : pawnShortName(this.pawn(t.who) || p)}: "${t.text}"`).join('\n');
    this.threads.set(p.id, [
      { role: 'system', content: TALK_SYSTEM },
      { role: 'user', content: `Who you are:\n${personaText(w, p)}` },
      { role: 'assistant', content: ACK },
      { role: 'user', content: talkState(w, p, `The leader has called you over to join a conversation with ${this.ids.filter(id => id !== p.id).map(id => this.pawn(id)).filter(Boolean).map(o => pawnShortName(o!)).join(' and ')}. So far:\n${so_far}`, this.started) },
    ]);
    this.heard.set(p.id, []);
    this.memo.set(p.id, {});
    this.onUpdate();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.g.cmd({ c: 'talking', pawns: this.ids, on: false });
  }
}
