// Needs, thoughts, mood, mental breaks and social interactions.
import type { World } from './world';
import { fx, fxw } from './techfx';
import { auraBuildings } from './auras';
import type { Pawn } from './types';
import { THOUGHTS, TRAITS, MENTAL_BREAKS } from '../data/pawns';
import { TICKS_PER_DAY } from '../core/constants';
import { clamp } from '../core/util';
import { pain, comfyTemp, socialImpact } from './stats';
import { BUILDINGS } from '../data/buildings';
import { buildingBeauty, pawnShortName } from './things';
import { ITEMS } from '../data/items';
import { TERRAIN } from '../data/terrain';
import { PLANTS } from '../data/plants';
import { roomAt } from './rooms';
import { lineOfSight } from './path';
import { applyDamage } from './health';

export const NEEDS_INTERVAL = 150;

export function addThought(w: World, p: Pawn, id: string, other?: number) {
  const d = THOUGHTS[id];
  if (!d || p.race !== 'human' || p.dead) return;
  if (p.traits.includes('psychopath') && ['colonist_died', 'observed_corpse', 'observed_rotting_corpse', 'executed_prisoner', 'sold_prisoner'].includes(id)) return;
  if (p.traits.includes('bloodlust') && ['observed_corpse', 'observed_rotting_corpse'].includes(id)) return;
  const dur = Math.round((d.days || 1) * TICKS_PER_DAY);
  const same = p.thoughts.filter(t => t.id === id && (other === undefined || t.o === other || !d.social));
  const limit = d.stack || 1;
  if (same.length >= limit) {
    // refresh the oldest
    same.sort((a, b) => a.t - b.t);
    same[0].t = dur;
  } else p.thoughts.push({ id, t: dur, o: other });
  if (d.social && other !== undefined) changeOpinion(p, other, d.social);
}

export function addThoughtToAll(w: World, faction: number, id: string, exclude?: number) {
  for (const p of w.pawns.values()) if (p.faction === faction && p.race === 'human' && !p.guest && p.id !== exclude) addThought(w, p, id);
}

export function changeOpinion(p: Pawn, other: number, delta: number) {
  const r = (p.rel[other] ||= { op: 0 });
  r.op = clamp(r.op + delta, -100, 100);
}

export function thoughtMood(p: Pawn): { label: string; mood: number; n: number }[] {
  const out: { label: string; mood: number; n: number }[] = [];
  const groups = new Map<string, number>();
  for (const t of p.thoughts) groups.set(t.id, (groups.get(t.id) || 0) + 1);
  for (const [id, n] of groups) {
    const d = THOUGHTS[id]; if (!d) continue;
    const sf = d.stackF ?? 1;
    let m = 0; for (let k = 0; k < n; k++) m += d.mood * Math.pow(sf, k);
    if (m !== 0) out.push({ label: d.label, mood: Math.round(m), n });
  }
  for (const [id, mood] of p.sit || []) {
    if (!mood) continue;
    out.push({ label: id === 'trait_mood' ? 'Disposition' : id === 'tech_mood' ? 'Colony progress (research)' : THOUGHTS[id]?.label || id, mood: Math.round(mood), n: 1 });
  }
  return out.sort((a, b) => b.mood - a.mood);
}

export function moodTarget(p: Pawn): number {
  let sum = 0;
  for (const t of thoughtMood(p)) sum += t.mood;
  return clamp((50 + sum) / 100, 0, 1);
}

export function breakThresholds(p: Pawn) {
  let f = 1;
  for (const t of p.traits) f *= TRAITS[t]?.breakF || 1;
  if (p.race === 'human') f *= Math.max(0.3, 1 - fx(p.faction, 'breakResist'));
  return { minor: 0.35 * f, major: 0.2 * f, extreme: 0.05 * f };
}

function expectationThought(w: World, p: Pawn): string {
  const wealth = w.story[p.faction]?.wealth || 0;
  if (wealth < 12000) return 'expect_extreme_low';
  if (wealth < 30000) return 'expect_very_low';
  if (wealth < 70000) return 'expect_low';
  if (wealth < 150000) return 'expect_moderate';
  return 'expect_high';
}

export function cellBeauty(w: World, i: number): number {
  const m = w.map;
  let b = TERRAIN[m.floor[i] || m.terrain[i]].beauty;
  if (m.plant[i]) b += PLANTS[m.plant[i]].beauty * Math.min(1, m.growth[i] + 0.3);
  if (m.filth[i]) b -= 1 + (m.filth[i] >> 5);
  const bid = m.bld[i];
  if (bid) { const bb = w.buildings.get(bid); if (bb) { const d = BUILDINGS[bb.def]; const [sw, sh] = d.size; b += buildingBeauty(bb) / (sw * sh); if (bb.hp < 0.5 * (d.hp || 1)) b -= 2; } }
  const items = m.items[i];
  if (items) for (const id of items) {
    const it = w.items.get(id); if (!it) continue;
    if (it.corpse) b -= 8; else if (it.rot && it.rot >= 1) b -= 4; else if (!BUILDINGS[w.buildings.get(bid)?.def || '']?.storage) b -= 0.4;
    b += ITEMS[it.def].beauty || 0;
  }
  if (m.rock[i]) b -= 0;
  return b;
}

function localBeauty(w: World, p: Pawn): number {
  const m = w.map;
  const room = roomAt(w, p.x, p.y);
  let sum = 0, n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    if (room && !room.outdoors && m.roomId[i] !== room.id) continue;
    if (m.rock[i]) continue;
    sum += cellBeauty(w, i); n++;
  }
  return n ? sum / n : 0;
}

export function needsTick(w: World, p: Pawn) {
  if (p.dead || p.race !== 'human') { if (p.race !== 'human' && !p.dead) animalNeeds(w, p); return; }
  const dt = NEEDS_INTERVAL / TICKS_PER_DAY;
  const n = p.needs;
  let foodF = 1;
  for (const t of p.traits) foodF *= TRAITS[t]?.foodF || 1;
  const asleep = !!p.asleep;
  n.food = clamp(n.food - 1.6 * foodF * dt * (asleep ? 0.6 : 1), 0, 1);
  if (!asleep) n.rest = clamp(n.rest - 1.35 * dt * (p.downed ? 0.3 : 1), 0, 1);
  const joying = p.job?.type === 'joy';
  if (!asleep && !joying) n.joy = clamp(n.joy - 0.55 * dt, 0, 1);
  // comfort drifts toward context
  const comfortTarget = p.job?.data?.comfort ?? (asleep ? 0.5 : 0.4);
  n.comfort += (comfortTarget - n.comfort) * 0.15;
  if (w.tick % (NEEDS_INTERVAL * 4) < NEEDS_INTERVAL || p.needs.beauty === undefined) {
    const lb = localBeauty(w, p);
    n.beauty = clamp(0.5 + lb * 0.12, 0, 1);
  }
  // situational thoughts
  const sit: [string, number][] = [];
  const add = (id: string, mood?: number) => sit.push([id, mood ?? THOUGHTS[id]?.mood ?? 0]);
  let traitMood = 0;
  for (const t of p.traits) traitMood += TRAITS[t]?.mood || 0;
  if (traitMood) add('trait_mood', traitMood);
  if (!p.guest) add(expectationThought(w, p));
  if (p.hediffs.some(h => h.type === 'malnutrition')) add('malnourished');
  else if (n.food < 0.08) add('ravenous'); else if (n.food < 0.25) add('hungry');
  if (n.rest < 0.08) add('exhausted'); else if (n.rest < 0.25) add('tired');
  if (n.joy < 0.12) add('joy_low'); else if (n.joy < 0.3) add('joy_some'); else if (n.joy > 0.8) add('joy_high');
  const pn = pain(p);
  if (pn > 0.65) add('pain_extreme'); else if (pn > 0.35) add('pain_serious'); else if (pn > 0.12) add('pain_minor');
  const beautyUnits = (n.beauty - 0.5) / 0.12;
  if (beautyUnits < -1.8) add('ugly_env'); else if (beautyUnits > 3.5) add('beautiful_env'); else if (beautyUnits > 1.4) add('pretty_env');
  if (!asleep && w.map.light[w.map.idx(p.x, p.y)] < 0.3 && !p.downed) add('in_darkness');
  const [lo, hi] = comfyTemp(p);
  if (p.temp !== undefined) { if (p.temp < lo) add('cold'); else if (p.temp > hi) add('hot'); }
  const covered = new Set<string>();
  for (const a of p.apparel) for (const c of ITEMS[a.def].apparel!.cover) covered.add(c);
  if (!covered.has('torso') || !covered.has('legs')) add('naked');
  if (p.apparel.some(a => a.hp < (ITEMS[a.def].hp || 150) * 0.5)) add('wearing_tattered');
  if (!p.guest && !p.bed && w.isPlayerFaction(p.faction) && w.day >= 1) add('no_bed');
  if (p.guest?.prisoner) add('prisoner');
  if (n.comfort > 0.75) add('comfy');
  if (p.traits.includes('greedy') && !p.guest) {
    const bed = p.bed ? w.buildings.get(p.bed) : null;
    const room = bed ? roomAt(w, bed.x, bed.y) : null;
    if (!room || room.impressiveness < 40) add('greedy_no_room');
  }
  if (p.traits.includes('ascetic')) add('ascetic_ok');
  const lover = Object.entries(p.rel).find(([, r]) => r.kind === 'lover' || r.kind === 'spouse');
  if (lover) {
    const lp = w.pawns.get(+lover[0]);
    if (lp && !lp.dead && lp.faction === p.faction) {
      if (p.bed && lp.bed === p.bed) add('shared_bed_lover'); else add('want_lover_bed');
    }
  }
  if (w.hasCondition('psychic_drone', p.faction)) add('psychic_drone');
  if (w.hasCondition('psychic_soothe', p.faction)) add('psychic_soothe');
  if (w.hasCondition('aurora')) add('aurora');
  if (w.hasCondition('eclipse')) add('eclipse_gloom');
  if (p.hediffs.some(h => h.type === 'toxic' && h.sev > 0.2)) add('toxic');
  if ([...w.buildings.values()].some(b => b.faction === p.faction && b.reactor?.started)) add('ship_countdown');
  if (p.wet > 0) add('soaked');
  if (!p.guest && w.isPlayerFaction(p.faction)) {
    const tm = fxw(w, p.faction, 'mood');
    if (tm) add('tech_mood', tm);
    for (const b of auraBuildings(w, 'awe')) {
      const r = BUILDINGS[b.def].aura!.radius;
      if ((b.x + 1 - p.x) ** 2 + (b.y + 1 - p.y) ** 2 <= r * r) { add('archotech_awe'); break; }
    }
  }
  p.sit = sit;
  // memory decay
  for (let k = p.thoughts.length - 1; k >= 0; k--) {
    p.thoughts[k].t -= NEEDS_INTERVAL;
    if (p.thoughts[k].t <= 0) p.thoughts.splice(k, 1);
  }
  const target = moodTarget(p);
  n.mood += (target - n.mood) * 0.05;
  // mental breaks
  if (!p.mental && !p.downed && !p.guest && w.isPlayerFaction(p.faction)) {
    const th = breakThresholds(p);
    let level: 'minor' | 'major' | 'extreme' | null = null;
    if (n.mood < th.extreme) level = 'extreme'; else if (n.mood < th.major) level = 'major'; else if (n.mood < th.minor) level = 'minor';
    if (level) {
      p.breakT = (p.breakT || 0) + NEEDS_INTERVAL;
      const mtbDays = level === 'extreme' ? 0.6 : level === 'major' ? 1 : 2.2;
      if (p.breakT > 2500 && w.rng.chance(dt / mtbDays)) startMentalBreak(w, p, level);
    } else p.breakT = 0;
  }
  if (p.mental) {
    p.mental.t -= NEEDS_INTERVAL;
    if (p.mental.t <= 0) endMentalState(w, p);
  }
  // wetness dries
  if (p.wet > 0) p.wet = Math.max(0, p.wet - NEEDS_INTERVAL);
  // inspiration (rare, when very happy)
  if (!p.inspired && n.mood > 0.8 && w.rng.chance(dt / 12)) {
    p.inspired = 'frenzy';
    p.mental = null;
    w.letter(p.faction, `Inspiration: ${pawnShortName(p)}`, `${pawnShortName(p)} is in a work frenzy! They'll work twice as fast for a day.`, 'good', p.x, p.y, p.id);
    p.inspiredT = w.tick + TICKS_PER_DAY;
  }
  if (p.inspired && (p.inspiredT || 0) < w.tick) p.inspired = undefined;
}

function animalNeeds(w: World, p: Pawn) {
  const dt = NEEDS_INTERVAL / TICKS_PER_DAY;
  const n = p.needs;
  if (p.faction === 2) return; // mechs
  n.food = clamp(n.food - 1.2 * dt * (p.asleep ? 0.6 : 1), 0, 1);
  if (!p.asleep) n.rest = clamp(n.rest - 1.2 * dt, 0, 1);
  if (p.animal?.manhunter && p.animal.manhunter < w.tick) { p.animal.manhunter = 0; p.target = 0; }
  if (n.food <= 0 && w.rng.chance(dt * 0.5) && p.animal?.tamed) {
    applyDamage(w, p, { amount: 3, type: 'blunt', noArmor: true, part: 'torso' });
  }
}

export function startMentalBreak(w: World, p: Pawn, level: 'minor' | 'major' | 'extreme', forced?: string) {
  const list = MENTAL_BREAKS[level];
  const b = forced ? list.find(x => x.id === forced) || list[0] : w.rng.pick(list);
  const dur = { minor: 0.35, major: 0.3, extreme: 0.25 }[level] * TICKS_PER_DAY * w.rng.range(0.7, 1.3);
  p.mental = { kind: b.id, t: Math.round(b.id === 'catatonic' ? TICKS_PER_DAY : dur) };
  p.drafted = false;
  p.job = null; p.queue = []; p.path = null;
  w.releaseAll(p.id);
  w.letter(p.faction, `${b.label}: ${pawnShortName(p)}`, `${p.name.first} '${p.name.nick}' ${p.name.last} ${b.desc}\n\nMental breaks happen when mood falls too low. Improve food, rest, comfort, and surroundings.`, level === 'extreme' ? 'bad' : 'neutral', p.x, p.y, p.id);
  if (b.id === 'give_up') p.exitMap = true;
  if (b.id === 'catatonic') { p.downed = true; }
}

export function endMentalState(w: World, p: Pawn) {
  const k = p.mental?.kind;
  p.mental = null;
  p.job = null; p.path = null;
  if (k === 'catatonic') { p.downed = false; }
  if (k === 'give_up') return;
  addThought(w, p, 'catharsis');
  if (k) w.text(p.x, p.y - 1, 'recovered', '#8fe08f');
}

// ---------------- social ----------------
export function socialTick(w: World, p: Pawn) {
  if (p.dead || p.downed || p.asleep || p.race !== 'human' || p.drafted) return;
  if (w.tick - p.lastSocial < 3000) return;
  const m = w.map;
  let partner: Pawn | null = null;
  for (let dy = -4; dy <= 4 && !partner; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (!m.inb(x, y)) continue;
    const ids = m.pawns[m.idx(x, y)];
    if (!ids) continue;
    for (const id of ids) {
      if (id === p.id) continue;
      const o = w.pawns.get(id);
      if (!o || o.race !== 'human' || o.dead || o.downed || o.asleep) continue;
      if (o.faction !== p.faction && !(o.guest && o.guest.host === p.faction)) continue;
      if (w.tick - o.lastSocial < 1500) continue;
      if (!lineOfSight(w, p.x, p.y, o.x, o.y)) continue;
      partner = o; break;
    }
  }
  if (!partner) return;
  if (!w.rng.chance(0.25)) { p.lastSocial = w.tick - 1500; return; }
  interact(w, p, partner);
}

function interact(w: World, a: Pawn, b: Pawn) {
  a.lastSocial = w.tick; b.lastSocial = w.tick;
  const opA = a.rel[b.id]?.op || 0;
  const r = w.rng.f();
  const abrasive = a.traits.includes('abrasive');
  const kind = a.traits.includes('kind');
  const insultChance = (abrasive ? 0.14 : kind ? 0 : 0.03) + (opA < -20 ? 0.12 : 0);
  if (a.mental?.kind === 'insulting_spree' || r < insultChance) {
    a.bubble = { icon: 'insult', t: w.tick + 200 };
    addThought(w, b, 'insulted', a.id);
    changeOpinion(a, b.id, -3);
    w.text(b.x, b.y - 1, 'insulted', '#ff9060');
    const opB = b.rel[a.id]?.op || 0;
    if (opB < -30 && w.rng.chance(0.25) && !b.guest) {
      // social fight
      w.text(a.x, a.y - 1, 'social fight!', '#ff5050');
      applyDamage(w, a, { amount: w.rng.range(2, 6), type: 'blunt', instigator: b.id });
      applyDamage(w, b, { amount: w.rng.range(2, 6), type: 'blunt', instigator: a.id });
      addThought(w, a, 'harmed_in_fight', b.id); addThought(w, b, 'harmed_in_fight', a.id);
    }
    return;
  }
  // romance
  const loverA = Object.values(a.rel).some(x => x.kind === 'lover' || x.kind === 'spouse');
  const loverB = Object.values(b.rel).some(x => x.kind === 'lover' || x.kind === 'spouse');
  if (!loverA && !loverB && a.gender !== b.gender && !b.guest && a.age > 18 && b.age > 18 && Math.abs(a.age - b.age) < 20 && opA > 35 && w.rng.chance(0.08)) {
    a.bubble = { icon: 'heart', t: w.tick + 240 };
    const opB = b.rel[a.id]?.op || 0;
    if (opB > 25 && w.rng.chance(0.5 + opB / 200)) {
      a.rel[b.id] = { op: Math.max(opA, 50), kind: 'lover' };
      b.rel[a.id] = { op: Math.max(opB, 50), kind: 'lover' };
      addThought(w, a, 'got_together'); addThought(w, b, 'got_together');
      w.letter(a.faction, 'New lovers', `${pawnShortName(a)} and ${pawnShortName(b)} have become lovers!`, 'good', a.x, a.y, a.id);
    } else {
      addThought(w, a, 'rebuffed', b.id);
    }
    return;
  }
  const deep = w.rng.chance(0.12);
  a.bubble = { icon: deep ? 'deep' : 'chat', t: w.tick + 200 };
  b.bubble = { icon: 'chat', t: w.tick + 160 };
  const f = socialImpact(a);
  addThought(w, a, deep ? 'deep_talk' : 'nice_chat', b.id);
  addThought(w, b, deep ? 'deep_talk' : 'nice_chat', a.id);
  changeOpinion(b, a.id, (a.traits.includes('beautiful') ? 2 : a.traits.includes('pretty') ? 1 : a.traits.includes('ugly') ? -1 : 0) * f);
  if (a.rel[b.id] && a.rel[b.id].op > 60 && !a.rel[b.id].kind) a.rel[b.id].kind = 'friend';
  if (b.rel[a.id] && b.rel[a.id].op > 60 && !b.rel[a.id].kind) b.rel[a.id].kind = 'friend';
  if (a.rel[b.id] && a.rel[b.id].op < -40 && !a.rel[b.id].kind) a.rel[b.id].kind = 'rival';
}
