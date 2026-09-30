// What a colonist knows right now, as compact text for the language model (plus a structured
// copy for the offline mind). The persona part is stable so it stays in DeepSeek's prompt cache.
import type { World } from '../sim/world';
import type { Pawn } from '../sim/types';
import type { WorkType } from '../data/types';
import { TRAITS, BACKSTORIES, SKILLS, WORK_TYPES } from '../data/pawns';
import { RESEARCH } from '../data/research';
import { ITEMS } from '../data/items';
import { GIVERS } from '../sim/work';
import { thoughtMood, breakThresholds } from '../sim/mood';
import { injuryLabel } from '../sim/health';
import { countResource } from '../sim/zones';
import { jobLabel } from '../sim/jobs';
import { roomAt } from '../sim/rooms';
import { pawnShortName } from '../sim/things';
import { fullName } from '../sim/pawngen';
import { isIncapable, skillLevel } from '../sim/stats';
import { SEASONS, TICKS_PER_DAY } from '../core/constants';
import { dist } from '../core/util';
import { inLeaderMode, lead, dutyActive, dutyText, workLabel, EMERGENCY_WORK } from '../sim/leader';

export interface Perception {
  persona: string;
  state: string;
  seen: number;                 // inbox entries included (the host drops these once the decision lands)
  // for the offline mind
  name: string;
  needs: Pawn['needs'];
  work: { id: WorkType; label: string; skill: number; prio: number; open: boolean }[];
  people: { name: string; op: number; near: boolean; awake: boolean; mood: number; kind?: string }[];
  threat: boolean;
  traits: string[];
  heard: string[];
  armed: boolean;
  // leader mode
  leader: boolean;
  duties: { work: WorkType; active: boolean; regular: boolean }[];
  trust: number;
  asked: boolean;               // already waiting to talk to the leader
  unowned: WorkType[];          // work waiting that nobody has agreed to do
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const needWord = (v: number, low: string, ok = 'fine') => (v < 0.15 ? `very ${low}` : v < 0.35 ? low : ok);
const clock = (w: World) => { const h = w.hour; const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${hh}:${String(mm).padStart(2, '0')}`; };

export function personaText(w: World, p: Pawn): string {
  const bs = (id?: string) => BACKSTORIES.find(b => b.id === id);
  const child = bs(p.story?.child), adult = bs(p.story?.adult);
  const traits = p.traits.map(t => TRAITS[t]).filter(Boolean).map(t => `${t.label} (${t.desc})`).join('; ') || 'none';
  const skills = SKILLS.map(s => ({ s, l: skillLevel(p, s.id), pa: p.skills[s.id]?.passion || 0 })).sort((a, b) => b.l - a.l)
    .map(x => `${x.s.label} ${x.l}${x.pa === 2 ? ' (burning passion)' : x.pa === 1 ? ' (passion)' : ''}`).join(', ');
  const cant = p.disabled.length ? p.disabled.map(d => WORK_TYPES.find(t => t.id === d)?.label || d).join(', ') : 'nothing';
  return [
    `You are ${fullName(p)}, called ${pawnShortName(p)}. ${p.gender === 'f' ? 'Woman' : 'Man'}, ${Math.floor(p.age)} years old.`,
    child ? `Childhood: ${child.title} — ${child.desc}` : '',
    adult ? `Adulthood: ${adult.title} — ${adult.desc}` : '',
    `Traits: ${traits}.`,
    `Skills (0-20): ${skills}.`,
    `You refuse or are unable to do: ${cant}.`,
    `Play this person truthfully: their history, traits and moods decide what they want, how hard they work and how they talk.`,
  ].filter(Boolean).join('\n');
}

/** which kinds of work have something waiting right now (probing givers must not keep their reservations) */
export function openWork(w: World, p: Pawn): Perception['work'] {
  const out: Perception['work'] = [];
  const snap = new Map(w.reservations);
  const jobBefore = p.job;
  for (const t of WORK_TYPES) {
    if (t.hidden || isIncapable(p, t.id)) continue;
    const g = GIVERS[t.id];
    let open = false;
    try { open = !!(g && g(w, p)); } catch { open = false; }
    const sk = t.skills[0] ? skillLevel(p, t.skills[0]) : -1;
    out.push({ id: t.id, label: t.label, skill: sk, prio: p.work[t.id] || 0, open });
  }
  w.reservations = snap;
  p.job = jobBefore;
  return out;
}

/** time, place, body, feelings, colony, danger and people: shared by decisions and conversations */
export function situation(w: World, p: Pawn): { lines: string[]; people: Perception['people']; threat: boolean } {
  const f = p.faction;
  const lines: string[] = [];
  const room = roomAt(w, p.x, p.y);
  const temp = p.temp ?? w.outdoorTemp;
  lines.push(`Day ${w.day + 1}, ${clock(w)}, ${SEASONS[w.season]}. Weather: ${w.weather.cur}, ${Math.round(w.outdoorTemp)}°C outside.`);
  lines.push(`Where you are: ${room && !room.outdoors ? `indoors (${room.role}, ${Math.round(room.temp)}°C)` : `outside (${Math.round(temp)}°C)`}. Doing: ${jobLabel(w, p) || 'nothing'}${p.carry ? `, carrying ${ITEMS[p.carry.def]?.label || p.carry.def}` : ''}${p.equip ? `. Weapon: ${ITEMS[p.equip.def]?.label || p.equip.def}` : '. Unarmed'}.`);
  const n = p.needs;
  const th = breakThresholds(p);
  lines.push(`Needs: hunger ${needWord(n.food, 'hungry')} (${pct(n.food)} fed), rest ${needWord(n.rest, 'tired')} (${pct(n.rest)}), recreation ${needWord(n.joy, 'bored')} (${pct(n.joy)}), mood ${pct(n.mood)}${n.mood < th.major ? ' — close to breaking down' : n.mood < th.minor ? ' — stressed' : n.mood > 0.75 ? ' — happy' : ''}.`);
  const tm = thoughtMood(p).filter(t => Math.abs(t.mood) >= 2).slice(0, 7).map(t => `${t.label} ${t.mood > 0 ? '+' : ''}${t.mood}`);
  if (tm.length) lines.push(`Feelings: ${tm.join(', ')}.`);
  const hurts = p.hediffs.filter(h => h.type !== 'scar' || h.sev > 5).slice(0, 5).map(h => injuryLabel(h) + (h.tended !== undefined ? ' (tended)' : ''));
  lines.push(`Health: ${p.downed ? 'DOWNED. ' : ''}${hurts.length ? hurts.join(', ') : 'healthy'}.${p.bed ? '' : ' You have no bed of your own.'}`);
  // colony
  const res = (id: string) => countResource(w, f, id);
  const meals = res('meal_simple') + res('meal_fine') + res('meal_lavish') + res('meal_survival') + res('meal_paste') + Math.floor(res('pemmican') / 20);
  const rs = w.research[f];
  lines.push(`Colony stores: ${meals} meals, ${res('wood')} wood, ${res('steel')} steel, ${res('components')} components, ${res('medicine') + res('medicine_herbal')} medicine, ${res('silver')} silver. Research: ${rs?.cur ? `${RESEARCH[rs.cur].label} (${pct((rs.prog[rs.cur] || 0) / RESEARCH[rs.cur].cost)})` : 'no project chosen'}.`);
  // threats
  const hostiles = [...w.pawns.values()].filter(o => !o.dead && !o.downed && w.hostile(f, o.faction) && (o.lord || (o.animal?.manhunter || 0) > w.tick));
  const threat = hostiles.length > 0;
  if (threat) {
    const near = hostiles.reduce((a, b) => (dist(a.x, a.y, p.x, p.y) < dist(b.x, b.y, p.x, p.y) ? a : b));
    lines.push(`DANGER: ${hostiles.length} hostile${hostiles.length > 1 ? 's' : ''} on the map (${[...new Set(hostiles.map(h => h.race === 'human' ? 'raiders' : h.race))].join(', ')}); nearest ${Math.round(dist(near.x, near.y, p.x, p.y))} tiles away.`);
  }
  // people
  const people: Perception['people'] = [];
  const others = [...w.pawns.values()].filter(o => o.id !== p.id && o.race === 'human' && !o.dead && (o.faction === f || (o.guest && o.guest.host === f)));
  if (others.length) {
    lines.push('People you know:');
    for (const o of others.slice(0, 12)) {
      const r = p.rel[o.id];
      const op = Math.round(r?.op || 0);
      const d = dist(p.x, p.y, o.x, o.y);
      const near = d < 12;
      people.push({ name: pawnShortName(o), op, near, awake: !o.asleep, mood: o.needs.mood, kind: r?.kind });
      const status = o.downed ? 'DOWNED' : o.asleep ? 'asleep' : o.mental ? `having a breakdown (${o.mental.kind.replace(/_/g, ' ')})` : jobLabel(w, o) || 'idle';
      lines.push(`- ${pawnShortName(o)}${o.guest?.prisoner ? ' (prisoner)' : ''}: ${status}, ${near ? `${Math.round(d)} tiles away` : 'elsewhere'}, mood ${pct(o.needs.mood)}. Your opinion ${op > 0 ? '+' : ''}${op}${r?.kind ? ` (${r.kind})` : ''}; theirs of you ${Math.round(o.rel[p.id]?.op || 0)}.`);
    }
  } else lines.push('You are alone.');
  return { lines, people, threat };
}

export function perceive(w: World, p: Pawn): Perception {
  const f = p.faction;
  const mind = p.mind!;
  const sit = situation(w, p);
  const lines = sit.lines, people = sit.people, threat = sit.threat;
  // animals nearby
  const beasts = [...w.pawns.values()].filter(o => o.race !== 'human' && !o.dead && dist(o.x, o.y, p.x, p.y) < 10).slice(0, 4).map(o => `${o.animal?.tamed ? o.animal.name + ' the ' : ''}${o.race}${(o.animal?.manhunter || 0) > w.tick ? ' (enraged!)' : ''}`);
  if (beasts.length) lines.push(`Animals nearby: ${beasts.join(', ')}.`);
  // work
  const work = openWork(w, p);
  const open = work.filter(x => x.open);
  const leader = inLeaderMode(w, p);
  let duties: Perception['duties'] = [], unowned: WorkType[] = [], trust = 0, asked = false;
  if (!leader) lines.push(`Work waiting that you can do: ${open.length ? open.map(x => `${x.id}${x.skill >= 0 ? ` (skill ${x.skill})` : ''}${x.prio ? ` [colony asks priority ${x.prio}]` : ''}`).join(', ') : 'none right now'}.`);
  else {
    const L = lead(p);
    trust = Math.round(L.trust); asked = !!L.audience;
    duties = L.duties.map(d => ({ work: d.work, active: dutyActive(d, w.hour), regular: d.regular }));
    const lname = w.playerByFaction(f)?.name || 'the leader';
    lines.push(`Your leader is ${lname}. You only do work you have agreed to with them. Your duties: ${L.duties.length ? L.duties.map(d => `${d.work} — ${dutyText(d)}${dutyActive(d, w.hour) ? ', on now' : ', not now'}${work.find(x => x.id === d.work)?.open ? '' : ', nothing to do'}`).join('; ') : 'none — you have not agreed to any work'}. Emergencies (${EMERGENCY_WORK.map(workLabel).join(', ').toLowerCase()}) you may always do.`);
    const taken = new Set<string>();
    for (const o of w.colonists(f)) for (const d of o.mind?.lead?.duties || []) taken.add(d.work);
    unowned = open.filter(x => !taken.has(x.id) && !EMERGENCY_WORK.includes(x.id)).map(x => x.id);
    if (unowned.length) lines.push(`Work waiting that nobody has agreed to do: ${unowned.map(id => { const x = work.find(y => y.id === id)!; return `${id}${x.skill >= 0 ? ` (your skill ${x.skill})` : ''}`; }).join(', ')}.`);
    lines.push(`Your trust in the leader: ${trust} (-100 to 100; ${trust >= 50 ? 'you would follow them anywhere' : trust >= 20 ? 'you trust them' : trust >= -10 ? 'unsure of them' : trust >= -40 ? 'you resent them' : 'you have lost faith in them'}).`);
    if (L.promises.length) lines.push(`The leader promised you: ${L.promises.map(x => `"${x.text}" (${Math.max(0, Math.round((w.tick - x.t) / TICKS_PER_DAY * 10) / 10)} days ago)`).join('; ')}.`);
    const said = L.chat.slice(-4).map(l => `${l.who === 0 ? 'Leader' : 'You'}: "${l.text.slice(0, 120)}"`);
    if (said.length) lines.push(`Last talk with the leader: ${said.join(' | ')}`);
    if (L.audience) lines.push(`You already asked the leader for a talk (${L.audience.topic}: "${L.audience.text}") and are waiting.`);
  }
  // memory & recent events
  if (mind.memory.length) lines.push(`Things you decided to remember: ${mind.memory.map(s => `"${s}"`).join(' ')}`);
  const recent = w.talk.filter(l => l.kind === 'say' && (l.from === p.id || l.to === p.id) && w.tick - l.t < TICKS_PER_DAY).slice(-4)
    .map(l => `${l.from === p.id ? 'You' : pawnShortName(w.pawns.get(l.from)!)}${l.to ? ` to ${l.to === p.id ? 'you' : pawnShortName(w.pawns.get(l.to)!)}` : ''}: "${l.text}"`);
  if (recent.length) lines.push(`Recent conversation: ${recent.join(' | ')}`);
  const inbox = mind.inbox.slice(-8);
  if (inbox.length) lines.push(`What just happened: ${inbox.map(e => e.text).join(' | ')}`);
  if (mind.goal) lines.push(`Your previous plan: ${mind.goal.label}${mind.thought ? ` (you thought: "${mind.thought}")` : ''}.`);
  lines.push(`Reason for deciding now: ${mind.why || 'routine'}.`);
  return {
    persona: personaText(w, p), state: lines.join('\n'), seen: mind.inbox.length,
    name: pawnShortName(p), needs: { ...p.needs }, work, people, threat, traits: p.traits, heard: inbox.map(e => e.text), armed: !!p.equip,
    leader, duties, trust, asked, unowned,
  };
}
