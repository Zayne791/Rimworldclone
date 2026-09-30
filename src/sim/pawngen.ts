// Procedural generation of colonists, raiders, traders, animals and mechanoids.
import type { World } from './world';
import type { Pawn, Skill } from './types';
import type { Rng } from '../core/rng';
import { SKILLS, WORK_TYPES, TRAITS, BACKSTORIES, FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, NICKNAMES, SKIN_TONES, HAIR_COLORS, HAIR_STYLES, APPAREL_COLORS } from '../data/pawns';
import { ANIMALS } from '../data/animals';
import type { SkillId, WorkType } from '../data/types';
import { makeItem } from './things';
import { clamp } from '../core/util';

export const DEFAULT_SCHEDULE = 'SSSSSSAWWWWWWWWWWWWWJJAS'.split('').map((c, i) => (i < 6 ? 'S' : i < 7 ? 'A' : i < 21 ? 'W' : i < 23 ? 'J' : 'S')).join('');

function basePawn(w: World, race: string, faction: number): Pawn {
  const skills = {} as Record<SkillId, Skill>;
  for (const s of SKILLS) skills[s.id] = { lvl: 0, xp: 0, passion: 0 };
  const work = {} as Record<WorkType, number>;
  for (const wt of WORK_TYPES) work[wt.id] = 3;
  return {
    id: w.newId(), kind: 'pawn', race, faction, x: 0, y: 0, nx: 0, ny: 0, mp: 0, path: null, pi: 0, rot: 0,
    name: { first: '', last: '', nick: '' }, gender: 'm', age: 30,
    look: { skin: '#e0b090', hair: 'short', hairColor: '#3a2a1a', body: 1, color: '#5a6a8c' },
    traits: [], skills, work, disabled: [], schedule: DEFAULT_SCHEDULE,
    needs: { food: 0.8, rest: 0.9, joy: 0.7, mood: 0.65, comfort: 0.5, beauty: 0.5 },
    thoughts: [], hediffs: [], downed: false, dead: false, equip: null, apparel: [], carry: null, inv: [],
    job: null, queue: [], drafted: false, fireAtWill: true, mental: null, bed: 0, rel: {}, guest: null,
    lord: 0, cd: 0, warm: 0, burst: 0, target: 0, lastSocial: 0, wet: 0, kills: 0, born: w.tick,
    seed: Math.floor(w.rng.f() * 1e9),
  };
}

export interface HumanOpts { kind?: 'colonist' | 'raider' | 'trader' | 'visitor' | 'prisoner'; tier?: number; rng?: Rng }

export function generateHuman(w: World, faction: number, opts: HumanOpts = {}): Pawn {
  const rng = opts.rng || w.rng;
  const p = basePawn(w, 'human', faction);
  p.gender = rng.chance(0.5) ? 'm' : 'f';
  p.name.first = rng.pick(p.gender === 'm' ? FIRST_NAMES_M : FIRST_NAMES_F);
  p.name.last = rng.pick(LAST_NAMES);
  p.name.nick = rng.chance(0.35) ? rng.pick(NICKNAMES) : p.name.first;
  p.age = rng.int(18, 62);
  const hairOpts = p.gender === 'm' ? ['short', 'buzz', 'mohawk', 'spiky', 'bald', 'curly', 'short', 'long'] : ['long', 'bob', 'bun', 'ponytail', 'curly', 'short', 'long', 'bob'];
  p.look = {
    skin: rng.pick(SKIN_TONES),
    hair: rng.pick(hairOpts),
    hairColor: p.age > 50 && rng.chance(0.6) ? rng.pick(['#c0c0c0', '#e0e0d8', '#9a9a9a']) : rng.pick(HAIR_COLORS.slice(0, 9)),
    body: rng.int(0, 2),
    beard: p.gender === 'm' && rng.chance(0.35),
    color: rng.pick(APPAREL_COLORS),
  };
  if (!HAIR_STYLES.includes(p.look.hair)) p.look.hair = 'short';
  // backstories
  const child = rng.pick(BACKSTORIES.filter(b => b.kind === 'child'));
  const adult = rng.pick(BACKSTORIES.filter(b => b.kind === 'adult'));
  p.story = { child: child.id, adult: adult.id };
  const disabled = new Set<WorkType>([...(child.disables || []), ...(adult.disables || [])]);
  // skills
  const ageF = clamp((p.age - 18) / 40, 0, 1);
  for (const s of SKILLS) {
    let lvl = rng.int(0, 3) + Math.round(ageF * rng.range(0, 3));
    lvl += (child.skills[s.id] || 0) + (adult.skills[s.id] || 0);
    if (opts.kind === 'raider' && (s.id === 'shooting' || s.id === 'melee')) lvl += rng.int(2, 5) + (opts.tier || 0);
    p.skills[s.id].lvl = clamp(lvl, 0, 20);
  }
  // passions on 2-4 skills, favoring higher ones
  const sorted = [...SKILLS].sort((a, b) => p.skills[b.id].lvl - p.skills[a.id].lvl + rng.range(-3, 3));
  const np = rng.int(2, 4);
  for (let k = 0; k < np; k++) p.skills[sorted[k].id].passion = rng.chance(0.35) ? 2 : 1;
  // traits
  const nt = rng.chance(0.25) ? 1 : rng.chance(0.75) ? 2 : 3;
  const all = Object.values(TRAITS);
  let guard = 0;
  while (p.traits.length < nt && guard++ < 50) {
    const t = rng.weighted(all, t => t.weight ?? 1);
    if (p.traits.includes(t.id) || p.traits.some(x => t.conflicts?.includes(x) || TRAITS[x].conflicts?.includes(t.id))) continue;
    p.traits.push(t.id);
    for (const d of t.disables || []) disabled.add(d);
  }
  // disabled skills zeroed
  p.disabled = [...disabled];
  for (const wt of WORK_TYPES) {
    if (disabled.has(wt.id)) { p.work[wt.id] = 0; for (const sk of wt.skills) { if (WORK_TYPES.filter(o => o.skills.includes(sk)).every(o => disabled.has(o.id))) { p.skills[sk].lvl = 0; p.skills[sk].passion = 0; } } }
  }
  // apparel
  const color = p.look.color;
  const shirt = makeItem(w, rng.chance(0.5) ? 'shirt' : 'tshirt', 1, { stuff: 'cloth' });
  const pants = makeItem(w, 'pants', 1, { stuff: 'cloth' });
  p.apparel.push(shirt, pants);
  (shirt as any).color = color;
  if (opts.kind === 'raider') {
    const tier = opts.tier || 0;
    if (tier >= 1 && rng.chance(0.5)) p.apparel.push(makeItem(w, 'flak_vest'));
    if (tier >= 1 && rng.chance(0.4)) p.apparel.push(makeItem(w, 'helmet_simple', 1, { stuff: 'steel' }));
    if (tier >= 3 && rng.chance(0.25)) { p.apparel = p.apparel.filter(a => a.def !== 'flak_vest'); p.apparel.push(makeItem(w, 'armor_marine')); p.apparel.push(makeItem(w, 'helmet_marine')); p.apparel = p.apparel.filter(a => a.def !== 'helmet_simple'); }
    if (rng.chance(0.3)) p.apparel.push(makeItem(w, 'duster', 1, { stuff: 'leather' }));
  } else if (rng.chance(0.3)) p.apparel.push(makeItem(w, rng.pick(['jacket', 'duster', 'cowboy_hat', 'tuque']), 1, { stuff: rng.pick(['cloth', 'leather']) }));
  for (const a of p.apparel) a.quality = rng.int(1, 3);
  return p;
}

export function raiderWeapon(w: World, tier: number): string {
  const r = w.rng.f();
  const pools = [
    ['knife', 'club', 'bow_short', 'revolver', 'revolver', 'autopistol', 'spear'],
    ['revolver', 'autopistol', 'rifle_bolt', 'shotgun', 'longsword', 'mace', 'bow_short', 'grenades_frag'],
    ['rifle_bolt', 'shotgun', 'rifle_assault', 'rifle_assault', 'longsword', 'lmg', 'rifle_sniper', 'grenades_frag'],
    ['rifle_assault', 'lmg', 'rifle_sniper', 'rifle_charge', 'longsword', 'grenades_frag', 'rifle_charge'],
  ];
  const pool = pools[clamp(tier, 0, 3)];
  return pool[Math.floor(r * pool.length)];
}

export function equipWeapon(w: World, p: Pawn, def: string) {
  const d = (makeItem as any);
  const it = d(w, def, 1, { quality: w.rng.int(1, 4) });
  p.equip = it;
}

export function generateAnimal(w: World, race: string, faction = 0, tamed = false): Pawn {
  const ad = ANIMALS[race];
  const p = basePawn(w, race, faction);
  p.gender = w.rng.chance(0.5) ? 'm' : 'f';
  p.name = { first: '', last: '', nick: '' };
  p.age = w.rng.int(1, 8);
  p.look = { skin: ad.color, hair: '', hairColor: ad.color2 || ad.color, body: 1, color: ad.color3 || ad.color };
  p.needs = { food: w.rng.range(0.5, 1), rest: w.rng.range(0.6, 1), joy: 1, mood: 0.5, comfort: 0.5, beauty: 0.5 };
  for (const s of SKILLS) p.skills[s.id].lvl = 0;
  p.work = {} as any;
  p.schedule = DEFAULT_SCHEDULE;
  p.apparel = [];
  if (!ad.mech) p.animal = { tamed, master: 0, products: {}, name: tamed ? petName(w) : undefined };
  return p;
}

const PET_NAMES = ['Biscuit', 'Rex', 'Pepper', 'Mochi', 'Bandit', 'Ziggy', 'Nugget', 'Waffles', 'Scout', 'Pickles', 'Sprocket', 'Tofu', 'Rocket', 'Clover', 'Boomer', 'Fuzz'];
export function petName(w: World) { return w.rng.pick(PET_NAMES); }

export function generateMech(w: World, race: string, faction: number): Pawn {
  const p = generateAnimal(w, race, faction);
  p.animal = undefined;
  p.name = { first: '', last: '', nick: '' };
  return p;
}

export function fullName(p: Pawn) {
  if (p.race !== 'human') return p.animal?.name || ANIMALS[p.race]?.label || p.race;
  return p.name.nick && p.name.nick !== p.name.first ? `${p.name.first} '${p.name.nick}' ${p.name.last}` : `${p.name.first} ${p.name.last}`;
}
