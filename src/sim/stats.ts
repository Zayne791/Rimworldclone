// Derived pawn stats: capacities, speeds, accuracy, comfort temperature, etc.
import type { Pawn } from './types';
import type { World } from './world';
import { HUMAN_BODY, ANIMAL_BODY, MECH_BODY, DISEASES, PAIN_PER_HP, type Capacity, type PartDef } from '../data/health';
import { TRAITS } from '../data/pawns';
import { ANIMALS } from '../data/animals';
import { ITEMS, QUALITY_STAT, stuffOf } from '../data/items';
import type { SkillId, WorkType } from '../data/types';
import { clamp } from '../core/util';
import { fx } from './techfx';

export function bodyOf(p: Pawn): PartDef[] {
  if (p.race === 'human') return HUMAN_BODY;
  return ANIMALS[p.race]?.mech ? MECH_BODY : ANIMAL_BODY;
}
export function isMech(p: Pawn) { return p.race !== 'human' && !!ANIMALS[p.race]?.mech; }
export function isAnimal(p: Pawn) { return p.race !== 'human' && !ANIMALS[p.race]?.mech; }
export function isHuman(p: Pawn) { return p.race === 'human'; }

/** health scale factor (animals by size) */
export function hpScale(p: Pawn): number {
  if (p.race === 'human') return 1;
  const a = ANIMALS[p.race];
  return a ? a.hp / 100 : 1;
}
export function partMaxHp(p: Pawn, part: PartDef) { return Math.max(1, Math.round(part.hp * hpScale(p))); }

export function partDamage(p: Pawn, partId: string): number {
  let d = 0;
  for (const h of p.hediffs) if (h.part === partId && (h.type === 'injury' || h.type === 'scar')) d += h.sev;
  return d;
}
export function partMissing(p: Pawn, partId: string): boolean {
  const body = bodyOf(p);
  let cur: PartDef | undefined = body.find(b => b.id === partId);
  while (cur) {
    if (p.hediffs.some(h => h.type === 'missing' && h.part === cur!.id)) return true;
    cur = cur.parent ? body.find(b => b.id === cur!.parent) : undefined;
  }
  return false;
}
export function partHealth(p: Pawn, part: PartDef): number {
  if (partMissing(p, part.id)) return 0;
  const max = partMaxHp(p, part);
  return clamp(1 - partDamage(p, part.id) / max, 0, 1);
}

export function pain(p: Pawn): number {
  if (isMech(p)) return 0;
  let pn = 0;
  const scale = hpScale(p);
  for (const h of p.hediffs) {
    if (h.type === 'injury') pn += h.sev * (PAIN_PER_HP[h.kind || 'cut'] || 0.0125) / scale * (h.tended !== undefined ? 0.5 : 1) * 1.6;
    else if (h.type === 'missing') pn += h.age !== undefined && h.age < 60000 * 3 ? 0.1 : 0;
    else if (h.type === 'disease') pn += (DISEASES[h.kind!]?.pain || 0) * h.sev * 2;
    else if (h.type === 'food_poisoning') pn += 0.2 * h.sev;
    else if (h.type === 'scar') pn += h.sev * 0.004;
  }
  if (p.traits.includes('tough')) pn *= 0.9;
  if (p.race === 'human') pn *= Math.max(0.2, 1 - fx(p.faction, 'painReduce'));
  return clamp(pn, 0, 1);
}

export function bloodLoss(p: Pawn) { return p.hediffs.find(h => h.type === 'bloodloss')?.sev || 0; }

let STAT_TICK = 0;
export function setStatTick(t: number) { STAT_TICK = t; }
const CAPS: Capacity[] = ['consciousness', 'moving', 'manipulation', 'sight', 'breathing', 'bloodPumping'];
function hedKey(p: Pawn) { let s = 0; for (const h of p.hediffs) s += h.sev; return p.hediffs.length * 100000 + Math.round(s * 20); }
export function capacity(p: Pawn, cap: Capacity): number {
  const c = (p as any)._caps;
  const key = hedKey(p);
  if (c && c.k === key && STAT_TICK - c.t < 90 && STAT_TICK >= c.t) return c.v[cap];
  const v: Record<string, number> = {};
  (p as any)._caps = null;
  for (const k of CAPS) v[k] = capacityCalc(p, k);
  (p as any)._caps = { k: key, t: STAT_TICK, v };
  return v[cap];
}
function capacityCalc(p: Pawn, cap: Capacity): number {
  const body = bodyOf(p);
  let v = 1;
  // part-based
  let weightSum = 0, healthSum = 0;
  for (const part of body) {
    const c = part.capacity?.find(c => c.cap === cap);
    if (!c) continue;
    weightSum += c.weight;
    healthSum += c.weight * partHealth(p, part);
  }
  if (weightSum > 0) v = healthSum / weightSum;
  if (cap === 'moving' || cap === 'manipulation') {
    // limbs: compensate a bit (the other side helps)
    v = Math.pow(v, 0.85);
  }
  const bl = bloodLoss(p);
  const pn = pain(p);
  if (cap === 'consciousness') {
    v -= bl * 0.4 + Math.max(0, pn - 0.1) * 0.4;
    for (const h of p.hediffs) {
      if (h.type === 'disease') v += (DISEASES[h.kind!]?.cap?.consciousness || 0) * h.sev * 2;
      if (h.type === 'hypothermia' || h.type === 'heatstroke') v -= Math.max(0, h.sev - 0.3) * 0.8;
      if (h.type === 'malnutrition') v -= Math.max(0, h.sev - 0.2) * 0.5;
      if (h.type === 'toxic') v -= Math.max(0, h.sev - 0.4) * 0.6;
      if (h.type === 'exhaustion') v -= 0.2;
    }
    v *= capacityRaw(p, 'bloodPumping') * 0.3 + 0.7;
    v *= capacityRaw(p, 'breathing') * 0.3 + 0.7;
  } else {
    for (const h of p.hediffs) if (h.type === 'disease') v += (DISEASES[h.kind!]?.cap?.[cap] || 0) * h.sev * 2;
    if (cap === 'moving' || cap === 'manipulation') {
      const cons = capacityCalc(p, 'consciousness');
      v *= Math.min(1, cons);
      if (cap === 'moving') v -= bl * 0.3;
    }
  }
  return clamp(v, 0, 1.5);
}
function capacityRaw(p: Pawn, cap: Capacity) {
  const body = bodyOf(p);
  let weightSum = 0, healthSum = 0;
  for (const part of body) {
    const c = part.capacity?.find(c => c.cap === cap);
    if (!c) continue;
    weightSum += c.weight; healthSum += c.weight * partHealth(p, part);
  }
  return weightSum > 0 ? healthSum / weightSum : 1;
}

export function painThreshold(p: Pawn) { return p.traits.includes('wimp') ? 0.4 : 0.8; }

export function shouldBeDowned(p: Pawn): boolean {
  if (isMech(p)) return capacity(p, 'moving') < 0.1 || capacity(p, 'consciousness') < 0.3;
  if (pain(p) >= painThreshold(p)) return true;
  if (capacity(p, 'consciousness') < 0.3) return true;
  if (capacity(p, 'moving') < 0.15) return true;
  return false;
}

// ---------------- speed ----------------
export function moveSpeed(p: Pawn): number { // tiles/second at 1x
  let base = 4.6;
  if (p.race !== 'human') base = ANIMALS[p.race]?.speed || 4;
  let f = 1;
  for (const t of p.traits) f *= TRAITS[t]?.moveF || 1;
  for (const a of p.apparel) f *= ITEMS[a.def].apparel?.moveF || 1;
  f *= 0.25 + 0.75 * capacity(p, 'moving');
  if (p.carry && ITEMS[p.carry.def]?.mass * p.carry.count > 40) f *= 0.8;
  if (p.carry?.corpse) f *= 0.75;
  if (p.race === 'human') f *= 1 + fx(p.faction, 'moveSpeed');
  return Math.max(0.3, base * f);
}
export function ticksPerCell(p: Pawn): number { return 60 / moveSpeed(p) * (13 / 13); }

export function skillLevel(p: Pawn, s: SkillId): number { return p.skills?.[s]?.lvl ?? (p.race === 'human' ? 0 : 3); }

export function globalWorkSpeed(p: Pawn): number {
  let f = 1;
  for (const t of p.traits) f *= TRAITS[t]?.workF || 1;
  f *= 0.2 + 0.8 * Math.min(1, capacity(p, 'manipulation'));
  f *= 0.6 + 0.4 * Math.min(1, capacity(p, 'consciousness'));
  if (p.inspired === 'frenzy') f *= 2;
  if (p.race === 'human') f *= 1 + fx(p.faction, 'globalWork');
  return f;
}
/** skill-based work speed multiplier (1.0 at level ~8) */
export function skillSpeed(p: Pawn, s: SkillId): number {
  const l = skillLevel(p, s);
  return (0.35 + l * 0.08) * globalWorkSpeed(p);
}
/** research bonus key for each work type's speed */
const WORK_FX: Partial<Record<WorkType, string>> = {
  construct: 'constructSpeed', mine: 'mineSpeed', grow: 'plantSpeed', plantcut: 'plantSpeed', cook: 'cookSpeed',
  research: 'researchSpeed', smith: 'craftSpeed', tailor: 'craftSpeed', craft: 'craftSpeed', clean: 'cleanSpeed',
};
export function workFx(p: Pawn, wt: WorkType): number { const k = WORK_FX[wt]; return k ? 1 + fx(p.faction, k) : 1; }
export function workSpeedFor(p: Pawn, wt: WorkType): number {
  const f = workFx(p, wt);
  switch (wt) {
    case 'construct': return skillSpeed(p, 'construction') * f;
    case 'mine': return skillSpeed(p, 'mining') * f;
    case 'grow': case 'plantcut': return skillSpeed(p, 'plants') * f;
    case 'cook': return skillSpeed(p, 'cooking') * f;
    case 'research': return skillSpeed(p, 'intellectual') * f;
    case 'doctor': return skillSpeed(p, 'medical');
    case 'art': return skillSpeed(p, 'artistic');
    case 'smith': case 'tailor': case 'craft': return skillSpeed(p, 'crafting') * f;
    default: return globalWorkSpeed(p) * f;
  }
}

export function shootAccPerCell(p: Pawn): number {
  let s = skillLevel(p, 'shooting');
  if (isMech(p)) s = 8;
  let acc = 1 - 0.11 * Math.pow(0.87, s); // 0.89 .. 0.993
  for (const t of p.traits) acc = 1 - (1 - acc) / (TRAITS[t]?.shootAcc || 1);
  if (p.race === 'human') acc = 1 - (1 - acc) * Math.max(0.3, 1 - fx(p.faction, 'shootAcc'));
  acc *= 0.5 + 0.5 * Math.min(1, capacity(p, 'sight'));
  return clamp(acc, 0.5, 0.995);
}
export function meleeHitChance(p: Pawn): number {
  const s = p.race === 'human' ? skillLevel(p, 'melee') : 8;
  let c = 0.6 + s * 0.017;
  for (const t of p.traits) c *= TRAITS[t]?.meleeHit || 1;
  if (p.race === 'human') c += fx(p.faction, 'meleeHit');
  return clamp(c * (0.5 + 0.5 * capacity(p, 'manipulation')), 0.3, 0.98);
}
export function meleeDodge(p: Pawn): number {
  const s = p.race === 'human' ? skillLevel(p, 'melee') : 4;
  let c = s * 0.01;
  if (p.traits.includes('nimble')) c += 0.15;
  return clamp(c, 0, 0.4);
}

// ---------------- apparel ----------------
export function armorFor(p: Pawn, group: string, kind: 'sharp' | 'blunt' | 'heat'): number {
  let a = 0;
  if (isMech(p) || isAnimal(p)) {
    const ad = ANIMALS[p.race];
    if (kind === 'sharp') a = ad?.armorSharp || 0;
    if (kind === 'blunt') a = ad?.armorBlunt || 0;
  }
  for (const it of p.apparel) {
    const ap = ITEMS[it.def].apparel!;
    if (!ap.cover.includes(group as any) && !(group === 'head' && ap.cover.includes('fullhead'))) continue;
    const s = stuffOf(it.stuff);
    const q = QUALITY_STAT[it.quality ?? 2];
    const base = kind === 'sharp' ? ap.armorSharp : kind === 'blunt' ? ap.armorBlunt : ap.armorHeat;
    a = 1 - (1 - a) * (1 - base * (s ? s.armorF : 1) * q);
  }
  return clamp(a, 0, 2);
}
export function insulation(p: Pawn): { cold: number; heat: number } {
  let cold = 0, heat = 0;
  for (const it of p.apparel) {
    const ap = ITEMS[it.def].apparel!;
    const s = stuffOf(it.stuff);
    const q = QUALITY_STAT[it.quality ?? 2];
    cold += (ap.insCold + (s ? s.insCold * 0.3 : 0)) * q;
    heat += ap.insHeat * q;
  }
  return { cold, heat };
}
export function comfyTemp(p: Pawn): [number, number] {
  if (p.race !== 'human') {
    const a = ANIMALS[p.race];
    return [a?.minTemp ?? -15, a?.maxTemp ?? 42];
  }
  const ins = insulation(p);
  return [16 - ins.cold, 26 + ins.heat];
}

export function socialImpact(p: Pawn) {
  const s = skillLevel(p, 'social');
  return 0.8 + s * 0.04;
}

export function learnRate(p: Pawn, s: SkillId): number {
  const sk = p.skills[s];
  let f = sk.passion === 2 ? 1.5 : sk.passion === 1 ? 1 : 0.35;
  for (const t of p.traits) f *= TRAITS[t]?.learnF || 1;
  return f * (1 + fx(p.faction, 'learnRate'));
}

export function weaponOf(p: Pawn): import('../data/types').WeaponProps | null {
  if (p.equip) return ITEMS[p.equip.def].weapon || null;
  const a = ANIMALS[p.race];
  if (a?.weapon) return ITEMS[a.weapon].weapon || null;
  return null;
}
export function weaponDef(p: Pawn): string | null {
  if (p.equip) return p.equip.def;
  const a = ANIMALS[p.race];
  if (a?.weapon) return a.weapon;
  return null;
}

export function isIncapable(p: Pawn, wt: WorkType) { return p.disabled.includes(wt); }

export function bodySize(p: Pawn) { return p.race === 'human' ? 1 : ANIMALS[p.race]?.size || 1; }

export function marketValuePawn(p: Pawn): number {
  if (p.race !== 'human') return ANIMALS[p.race]?.value || 50;
  let v = 600;
  for (const s in p.skills) v += (p.skills as any)[s].lvl * 25;
  return v;
}
