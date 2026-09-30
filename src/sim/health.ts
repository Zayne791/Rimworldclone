// Damage, injuries, bleeding, disease, healing, downing and death.
import type { World } from './world';
import type { Pawn, Hediff, Item } from './types';
import { bodyOf, partMaxHp, partMissing, partDamage, shouldBeDowned, isMech, isAnimal, armorFor, hpScale, comfyTemp, capacity, skillLevel } from './stats';
import { BLEED_RATE, INFECTION_CHANCE, DISEASES, INJURY_LABELS, type PartDef } from '../data/health';
import { ANIMALS } from '../data/animals';
import { FILTH } from './map';
import { clamp } from '../core/util';
import { makeItem, placeItem, pawnShortName } from './things';
import { TICKS_PER_DAY } from '../core/constants';
import { addThought, addThoughtToAll } from './mood';
import { ambientTemp } from './rooms';
import { explode } from './combat';

export const HEALTH_INTERVAL = 60;

function armorKind(t: string): 'sharp' | 'blunt' | 'heat' {
  if (t === 'blunt' || t === 'crush') return 'blunt';
  if (t === 'burn') return 'heat';
  return 'sharp';
}

function pickPart(w: World, p: Pawn, preferGroup?: string): PartDef | null {
  const body = bodyOf(p);
  const candidates = body.filter(b => !b.internal && !partMissing(p, b.id) && (!preferGroup || b.group === preferGroup));
  if (!candidates.length) return body[0];
  return w.rng.weighted(candidates, b => b.coverage);
}

export interface DamageInfo { amount: number; type: string; pen?: number; instigator?: number; part?: string; group?: string; noArmor?: boolean; weapon?: string }

export function applyDamage(w: World, p: Pawn, di: DamageInfo): number {
  if (p.dead) return 0;
  if (w.mode !== 'host') return 0;
  let amount = di.amount;
  let type = di.type;
  let part = di.part ? bodyOf(p).find(b => b.id === di.part) || null : pickPart(w, p, di.group);
  if (!part) return 0;
  // armor
  if (!di.noArmor) {
    const armor = armorFor(p, part.group || 'torso', armorKind(type));
    const eff = Math.max(0, armor - (di.pen || 0));
    const r = w.rng.f();
    if (r < eff * 0.5) { w.text(p.x, p.y - 0.5, 'deflected', '#bbb'); w.sound('ricochet', p.x, p.y); return 0; }
    if (r < eff) { amount *= 0.5; if (armorKind(type) === 'sharp') type = 'blunt'; }
  }
  if (p.traits.includes('tough')) amount *= 0.5;
  amount = Math.max(1, Math.round(amount * 10) / 10);
  // penetrate to internal organ
  const children = bodyOf(p).filter(b => b.parent === part!.id && b.internal && !partMissing(p, b.id));
  if (children.length && armorKind(type) === 'sharp' && w.rng.chance(part.id === 'head' ? 0.4 : 0.35)) {
    const inner = w.rng.weighted(children, c => c.coverage);
    const split = amount * 0.6;
    addInjury(w, p, part, amount - split, type, di);
    part = inner; amount = split;
  }
  addInjury(w, p, part, amount, type, di);
  // blood
  if (!isMech(p) && armorKind(type) === 'sharp' && w.rng.chance(0.7)) w.map.addFilth(p.x, p.y, FILTH.blood, 30);
  if (isMech(p)) w.emit({ k: 'spark', x: p.x, y: p.y });
  w.text(p.x, p.y - 0.6, String(Math.round(amount)), '#ff6060');
  p.lastHit = w.tick;
  if (!p.dead) checkDowned(w, p);
  // revenge from animals
  if (!p.dead && di.instigator && isAnimal(p) && !p.animal?.tamed) {
    const a = ANIMALS[p.race];
    const src = w.pawns.get(di.instigator);
    // only people (and their pets/turrets) can drive an animal into a manhunting rage; wild fights stay between the two
    const wild = !!src && isAnimal(src) && !src.animal?.tamed;
    if (wild) {
      if (a.predator) { p.target = src!.id; p.fleeing = false; }
      else { p.fleeing = true; p.target = src!.id; }
    } else if (p.animal && !p.animal.manhunter && w.rng.chance(a.manhunterChance ?? 0.1)) {
      p.animal.manhunter = w.tick + TICKS_PER_DAY * 0.5;
      p.target = di.instigator;
      w.text(p.x, p.y - 1, 'Revenge!', '#ff4040');
    } else if (a.flees || !a.predator) { p.fleeing = true; p.target = di.instigator; }
  }
  if (!p.dead && di.instigator && p.mental?.kind === 'catatonic') { /* nothing */ }
  return amount;
}

function addInjury(w: World, p: Pawn, part: PartDef, amount: number, type: string, di: DamageInfo) {
  if (p.dead) return;
  const kind = type === 'sharp' ? 'cut' : type;
  const h: Hediff = { type: 'injury', part: part.id, kind, sev: amount, age: 0, src: di.weapon };
  p.hediffs.push(h);
  const max = partMaxHp(p, part);
  if (partDamage(p, part.id) >= max) destroyPart(w, p, part);
}

function destroyPart(w: World, p: Pawn, part: PartDef) {
  const body = bodyOf(p);
  // remove injuries on part and its descendants
  const ids = new Set<string>([part.id]);
  let grew = true;
  while (grew) { grew = false; for (const b of body) if (b.parent && ids.has(b.parent) && !ids.has(b.id)) { ids.add(b.id); grew = true; } }
  p.hediffs = p.hediffs.filter(h => !(h.part && ids.has(h.part) && (h.type === 'injury' || h.type === 'scar' || h.type === 'missing')));
  p.hediffs.push({ type: 'missing', part: part.id, sev: 0, age: 0 });
  if (!isMech(p)) {
    // big bleed spike
    const bl = getOrAdd(p, 'bloodloss');
    bl.sev = clamp(bl.sev + 0.1, 0, 1);
  }
  if (part.vital) die(w, p, `${part.label} destroyed`);
  else if (w.isColonist(p)) w.letter(p.faction, `${pawnShortName(p)} lost a ${part.label}`, `${pawnShortName(p)}'s ${part.label} was destroyed.`, 'bad', p.x, p.y, p.id);
}

function getOrAdd(p: Pawn, type: Hediff['type'], kind?: string): Hediff {
  let h = p.hediffs.find(h => h.type === type && (!kind || h.kind === kind));
  if (!h) { h = { type, kind, sev: 0, age: 0 }; p.hediffs.push(h); }
  return h;
}

export function bleedRate(p: Pawn): number { // fraction of blood per day
  if (isMech(p)) return 0;
  let b = 0;
  const scale = hpScale(p);
  for (const h of p.hediffs) {
    if (h.type !== 'injury' || h.tended !== undefined) continue;
    b += (BLEED_RATE[h.kind || 'cut'] || 0) * h.sev / scale;
  }
  return b;
}

export function needsTending(p: Pawn): boolean {
  if (p.dead || isMech(p)) return false;
  for (const h of p.hediffs) {
    if (h.type === 'injury' && h.tended === undefined) return true;
    if (h.type === 'disease' && (h.tendT ?? 0) <= 0) return true;
  }
  return false;
}
export function isSeriouslyHurt(p: Pawn) {
  return bleedRate(p) > 0.1 || p.hediffs.some(h => h.type === 'disease' && h.sev > 0.2) || p.downed;
}

export function tend(w: World, doctor: Pawn | null, patient: Pawn, medPotency: number) {
  const skill = doctor ? skillLevel(doctor, 'medical') : 0;
  let q = (0.25 + skill * 0.065) * (medPotency > 0 ? 0.55 + medPotency * 0.45 : 0.45);
  if (doctor === patient) q *= 0.7;
  q = clamp(q + w.rng.range(-0.15, 0.15), 0.05, 1);
  let n = 0;
  for (const h of patient.hediffs) {
    if (h.type === 'injury' && h.tended === undefined) { h.tended = q; n++; if (n > 6) break; }
    if (h.type === 'disease' && (h.tendT ?? 0) <= 0) { h.tended = q; h.tendT = TICKS_PER_DAY * 0.8; }
  }
  w.text(patient.x, patient.y - 0.8, `tended ${Math.round(q * 100)}%`, '#8fe08f');
  if (patient.race === 'human') addThought(w, patient, 'tended');
  return q;
}

export function checkDowned(w: World, p: Pawn) {
  if (p.dead) return;
  const should = shouldBeDowned(p);
  if (should && !p.downed) setDowned(w, p, true);
  else if (!should && p.downed) setDowned(w, p, false);
}

export function setDowned(w: World, p: Pawn, v: boolean) {
  if (p.downed === v) return;
  p.downed = v;
  if (v) {
    p.drafted = false;
    if (p.carry) { placeItem(w, p.carry, p.x, p.y); p.carry = null; }
    p.job = null; p.queue = []; p.path = null; p.nx = p.x; p.ny = p.y; p.mp = 0;
    w.releaseAll(p.id);
    if (p.mental && p.mental.kind !== 'catatonic') p.mental = null;
    if (w.isColonist(p)) w.letter(p.faction, `${pawnShortName(p)} is down`, `${pawnShortName(p)} has been incapacitated and needs rescue.`, 'bad', p.x, p.y, p.id);
    if (isMech(p)) die(w, p, 'disabled');
  }
}

export function die(w: World, p: Pawn, cause: string) {
  if (p.dead) return;
  p.dead = true; p.downed = true;
  const x = p.x, y = p.y;
  if (p.carry) { placeItem(w, p.carry, x, y); p.carry = null; }
  if (p.equip) { const eq = p.equip; p.equip = null; placeItem(w, eq, x, y); }
  for (const it of p.inv) placeItem(w, it, x, y);
  p.inv = [];
  p.job = null; p.queue = []; p.path = null; p.mental = null; p.drafted = false;
  w.releaseAll(p.id);
  // unassign bed
  if (p.bed) { const b = w.buildings.get(p.bed); if (b?.owners) b.owners = b.owners.filter(o => o !== p.id); }
  const lord = p.lord ? w.lords.get(p.lord) : null;
  w.despawn(p);
  if (lord) lord.pawns = lord.pawns.filter(id => id !== p.id);
  const corpseData: Pawn = { ...p, path: null, job: null, queue: [] };
  const corpse = makeItem(w, 'corpse', 1, { corpse: corpseData, age: 0, owner: p.faction });
  placeItem(w, corpse, x, y);
  w.map.addFilth(x, y, isMech(p) ? FILTH.ash : FILTH.blood, 60);
  const a = ANIMALS[p.race];
  if (a?.explodes) {
    explode(w, x, y, 2.9, 20, p.id, true);
  }
  if (w.isPlayerFaction(p.faction) && p.race === 'human' && !p.guest) {
    w.letter(p.faction, `${pawnShortName(p)} died`, `${p.name.first} '${p.name.nick}' ${p.name.last} has died (${cause}).`, 'death', x, y);
    addThoughtToAll(w, p.faction, 'colonist_died', p.id);
    for (const other of w.pawns.values()) {
      const r = other.rel?.[p.id];
      if (!r || other.dead) continue;
      if (r.kind === 'lover' || r.kind === 'spouse') addThought(w, other, 'lover_died', p.id);
      else if (r.op > 40) addThought(w, other, 'friend_died', p.id);
    }
  } else if (p.race !== 'human' && p.animal?.tamed && p.animal.bonded) {
    const b = w.pawns.get(p.animal.bonded);
    if (b) addThought(w, b, 'bonded_animal_died');
  }
  w.sound(isMech(p) ? 'mechdie' : 'die', x, y);
}

/** periodic health update, called every HEALTH_INTERVAL ticks */
export function healthTick(w: World, p: Pawn) {
  if (p.dead) return;
  const dt = HEALTH_INTERVAL / TICKS_PER_DAY; // fraction of a day
  const mech = isMech(p);
  const inBed = !!(p.job?.type === 'sleep' || p.job?.type === 'rest') && p.asleep;
  let changed = false;
  // bleeding
  if (!mech) {
    const br = bleedRate(p);
    const bl = p.hediffs.find(h => h.type === 'bloodloss');
    if (br > 0) {
      const h = bl || getOrAdd(p, 'bloodloss');
      h.sev += br * dt;
      if (w.rng.chance(Math.min(0.5, br * 0.6))) w.map.addFilth(p.x, p.y, FILTH.blood, 15);
      changed = true;
      if (h.sev >= 1) { die(w, p, 'blood loss'); return; }
    } else if (bl) {
      bl.sev -= 0.33 * dt;
      if (bl.sev <= 0) p.hediffs.splice(p.hediffs.indexOf(bl), 1);
    }
  }
  // injuries & diseases
  const scale = hpScale(p);
  for (let k = p.hediffs.length - 1; k >= 0; k--) {
    const h = p.hediffs[k];
    h.age = (h.age || 0) + HEALTH_INTERVAL;
    if (h.type === 'injury') {
      if (mech) continue; // mechs don't heal
      const healPerDay = (h.tended !== undefined ? 3 + 9 * h.tended : 1.2) * (inBed ? 1.5 : 1) * Math.max(0.5, scale * 0.6);
      h.sev -= healPerDay * dt;
      // infection roll once at ~6h
      if (!h.perm && h.age >= 15000 && h.age < 15000 + HEALTH_INTERVAL) {
        const base = INFECTION_CHANCE[h.kind || 'cut'] || 0;
        const f = h.tended !== undefined ? (1 - h.tended) * 0.6 : 1;
        if (base > 0 && w.rng.chance(base * f * 0.7) && !p.hediffs.some(o => o.type === 'disease' && o.kind === 'infection' && o.part === h.part)) {
          p.hediffs.push({ type: 'disease', kind: 'infection', part: h.part, sev: 0.05, imm: 0, age: 0 });
          if (w.isColonist(p)) w.letter(p.faction, `Infection: ${pawnShortName(p)}`, `${pawnShortName(p)}'s wound has become infected. Keep it tended so their immune system can win.`, 'bad', p.x, p.y, p.id);
        }
      }
      if (h.sev <= 0) {
        p.hediffs.splice(k, 1); changed = true;
      }
    } else if (h.type === 'disease') {
      const d = DISEASES[h.kind!];
      if (!d) continue;
      if (h.tendT !== undefined && h.tendT > 0) h.tendT -= HEALTH_INTERVAL;
      const tended = (h.tendT ?? 0) > 0;
      const rate = tended ? d.sevPerDayTended * (1.4 - (h.tended || 0)) : d.sevPerDay;
      h.sev += rate * dt;
      const fed = p.needs.food > 0.1 ? 1 : 0.6;
      h.imm = (h.imm || 0) + d.immPerDay * dt * fed * (inBed ? 1.15 : 1);
      if (h.imm >= 1) {
        p.hediffs.splice(k, 1); changed = true;
        if (w.isColonist(p)) w.text(p.x, p.y - 1, 'immune!', '#8fe08f');
      } else if (h.sev >= 1 && d.lethal) { die(w, p, d.label); return; }
    } else if (h.type === 'food_poisoning') {
      h.sev -= 1.5 * dt;
      if (w.rng.chance(0.01)) { w.map.addFilth(p.x, p.y, FILTH.vomit, 40); w.text(p.x, p.y - 1, 'vomits', '#9c6'); }
      if (h.sev <= 0) { p.hediffs.splice(k, 1); changed = true; }
    } else if (h.type === 'toxic') {
      h.sev -= 0.08 * dt;
      if (h.sev >= 1) { die(w, p, 'toxic buildup'); return; }
      if (h.sev <= 0) { p.hediffs.splice(k, 1); changed = true; }
    } else if (h.type === 'malnutrition') {
      h.sev += (p.needs.food <= 0.001 ? 0.35 : -0.6) * dt;
      if (h.sev >= 1) { die(w, p, 'starvation'); return; }
      if (h.sev <= 0) { p.hediffs.splice(k, 1); changed = true; }
    }
  }
  if (!mech && p.race === 'human' && p.needs.food <= 0.001 && !p.hediffs.some(h => h.type === 'malnutrition')) p.hediffs.push({ type: 'malnutrition', sev: 0.01, age: 0 });
  // temperature
  if (!mech) {
    const t = ambientTemp(w, p.x, p.y);
    p.temp = t;
    const [lo, hi] = comfyTemp(p);
    const hypo = p.hediffs.find(h => h.type === 'hypothermia');
    const heat = p.hediffs.find(h => h.type === 'heatstroke');
    if (t < lo - 10) {
      const h = hypo || getOrAdd(p, 'hypothermia');
      h.sev += Math.min(0.9, (lo - 10 - t) * 0.04) * dt * 2;
      if (h.sev > 0.45 && w.rng.chance(0.004)) {
        const ext = bodyOf(p).filter(b => ['hand_l', 'hand_r', 'foot_l', 'foot_r', 'eye_l'].includes(b.id) && !partMissing(p, b.id));
        if (ext.length) applyDamage(w, p, { amount: 4, type: 'frost', part: w.rng.pick(ext).id, noArmor: true });
      }
      if (h.sev >= 1) { die(w, p, 'hypothermia'); return; }
    } else if (hypo) { hypo.sev -= 1.2 * dt; if (hypo.sev <= 0) p.hediffs.splice(p.hediffs.indexOf(hypo), 1); }
    if (t > hi + 10) {
      const h = heat || getOrAdd(p, 'heatstroke');
      h.sev += Math.min(0.9, (t - hi - 10) * 0.04) * dt * 2;
      if (h.sev >= 1) { die(w, p, 'heatstroke'); return; }
    } else if (heat) { heat.sev -= 1.2 * dt; if (heat.sev <= 0) p.hediffs.splice(p.hediffs.indexOf(heat), 1); }
    if (w.hasCondition('toxic') && w.map.roof[w.map.idx(p.x, p.y)] === 0 && !mech) {
      const h = getOrAdd(p, 'toxic');
      h.sev += 0.35 * dt;
    }
  }
  if (changed || w.tick % 300 < HEALTH_INTERVAL) checkDowned(w, p);
}

export function injuryLabel(h: Hediff): string {
  if (h.type === 'injury') return (INJURY_LABELS[h.kind || 'cut'] || ['wound'])[0];
  if (h.type === 'scar') return (INJURY_LABELS[h.kind || 'cut'] || ['', 'scar'])[1];
  if (h.type === 'missing') return 'missing';
  if (h.type === 'disease') return DISEASES[h.kind!]?.label || h.kind || 'disease';
  if (h.type === 'bloodloss') return 'blood loss';
  if (h.type === 'food_poisoning') return 'food poisoning';
  if (h.type === 'hypothermia') return 'hypothermia';
  if (h.type === 'heatstroke') return 'heatstroke';
  if (h.type === 'malnutrition') return 'malnutrition';
  if (h.type === 'toxic') return 'toxic buildup';
  return h.type;
}

export function giveDisease(w: World, p: Pawn, kind: string) {
  if (p.hediffs.some(h => h.type === 'disease' && h.kind === kind)) return;
  p.hediffs.push({ type: 'disease', kind, sev: 0.1, imm: 0, age: 0 });
}

export function totalHealthPct(p: Pawn): number {
  const body = bodyOf(p);
  let tot = 0, cur = 0;
  for (const b of body) {
    if (b.internal) continue;
    const mx = partMaxHp(p, b);
    tot += mx;
    cur += partMissing(p, b.id) ? 0 : Math.max(0, mx - partDamage(p, b.id));
  }
  return clamp((cur / tot) * (1 - bloodLoss(p) * 0.5), 0, 1);
}
function bloodLoss(p: Pawn) { return p.hediffs.find(h => h.type === 'bloodloss')?.sev || 0; }

export function dropItem(w: World, p: Pawn, it: Item) { placeItem(w, it, p.x, p.y); }
export { capacity };
