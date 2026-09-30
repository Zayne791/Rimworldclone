// Ranged & melee combat, projectiles, explosions, turrets and cover.
import type { World } from './world';
import type { Pawn, Building, Projectile } from './types';
import { ITEMS, QUALITY_STAT, stuffOf } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { ANIMALS } from '../data/animals';
import type { WeaponProps } from '../data/types';
import { applyDamage } from './health';
import { lineOfSight } from './path';
import { shootAccPerCell, meleeHitChance, meleeDodge, weaponOf, weaponDef, skillLevel, isMech, bodySize } from './stats';
import { destroyBuilding } from './construction';
import { WEATHERS, startFire } from './environment';
import { clamp, dist } from '../core/util';
import { PLANTS } from '../data/plants';
import { addThought } from './mood';
import { FILTH } from './map';

export function weaponAccAt(wp: WeaponProps, d: number): number {
  const a = wp.acc || [0.8, 0.8, 0.8, 0.8];
  if (d <= 3) return a[0];
  if (d <= 12) return a[0] + (a[1] - a[0]) * (d - 3) / 9;
  if (d <= 25) return a[1] + (a[2] - a[1]) * (d - 12) / 13;
  return a[2] + (a[3] - a[2]) * Math.min(1, (d - 25) / 15);
}

/** cover value provided to target at (tx,ty) against shooter at (sx,sy), and the thing id providing it */
export function coverFor(w: World, sx: number, sy: number, tx: number, ty: number): { v: number; id: number; cell: number } {
  const m = w.map;
  const d = dist(sx, sy, tx, ty);
  if (d < 1.9) return { v: 0, id: 0, cell: -1 };
  const ang = Math.atan2(sy - ty, sx - tx);
  let best = { v: 0, id: 0, cell: -1 };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const a2 = Math.atan2(dy, dx);
    let diff = Math.abs(ang - a2); if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 1.15) continue;
    const x = tx + dx, y = ty + dy;
    if (!m.inb(x, y)) continue;
    const i = m.idx(x, y);
    let v = 0, id = 0;
    if (m.rock[i]) v = 0.75;
    const bid = m.bld[i];
    if (bid) { const b = w.buildings.get(bid); if (b) { const bd = BUILDINGS[b.def]; if ((bd.cover || 0) > v) { v = bd.cover || 0; id = b.id; } } }
    if (m.plant[i]) { const pd = PLANTS[m.plant[i]]; if ((pd.cover || 0) * m.growth[i] > v) { v = (pd.cover || 0) * m.growth[i]; id = 0; } }
    const falloff = diff < 0.5 ? 1 : 0.6;
    v *= falloff;
    if (v > best.v) best = { v, id, cell: i };
  }
  return best;
}

export function hitChance(w: World, shooter: Pawn | null, wp: WeaponProps, sx: number, sy: number, tx: number, ty: number, targetSize = 1, turretSkill = 5): number {
  const d = dist(sx, sy, tx, ty);
  let acc = shooter ? shootAccPerCell(shooter) : 1 - 0.11 * Math.pow(0.87, turretSkill);
  let hc = Math.pow(acc, d) * weaponAccAt(wp, d);
  hc *= WEATHERS[w.weather.cur]?.accuracy ?? 1;
  hc *= clamp(0.75 + targetSize * 0.25, 0.6, 1.4);
  return clamp(hc, 0.02, 0.98);
}

export function inRange(wp: WeaponProps, d: number) { return d <= (wp.range || 1.5); }

/** Execute a ranged shot. Returns true if a projectile was fired. */
export function fireAt(w: World, shooter: Pawn | null, turret: Building | null, weapon: string, sx: number, sy: number, target: Pawn | Building, faction: number) {
  const wp = ITEMS[weapon].weapon!;
  const [tx, ty] = target.kind === 'pawn' ? [target.x, target.y] : w.center(target);
  const tSize = target.kind === 'pawn' ? bodySize(target) : 2;
  const hc = hitChance(w, shooter, wp, sx, sy, tx, ty, tSize);
  const cover = target.kind === 'pawn' ? coverFor(w, sx, sy, Math.round(tx), Math.round(ty)) : { v: 0, id: 0, cell: -1 };
  const r = w.rng.f();
  let destX = tx, destY = ty, hit = false, coverHit = 0;
  if (r < hc) {
    // on target, but cover may absorb
    if (cover.v > 0 && w.rng.chance(cover.v)) {
      coverHit = cover.id || -1;
      destX = cover.cell % w.map.w; destY = (cover.cell / w.map.w) | 0;
    } else hit = true;
  } else {
    const d = dist(sx, sy, tx, ty);
    const spread = Math.min(3, 0.6 + d * 0.08);
    destX = tx + w.rng.range(-spread, spread); destY = ty + w.rng.range(-spread, spread);
  }
  let damage = wp.damage;
  const q = shooter?.equip?.quality;
  if (q !== undefined) damage *= QUALITY_STAT[q];
  const proj: Projectile = {
    id: w.newId(), kind: 'projectile', def: weapon, x: sx, y: sy, sx, sy, tx: destX, ty: destY,
    speed: wp.projSpeed || 1, shooter: shooter?.id || turret?.id || 0, shooterFaction: faction, target: target.id,
    hit, coverHit, damage, pen: wp.pen, dmgType: wp.dmgType, proj: wp.proj || 'bullet', explosive: wp.explosive,
  };
  w.register(proj);
  w.sound(wp.sound || 'rifle', sx, sy);
  w.emit({ k: 'muzzle', x: sx, y: sy, x2: destX, y2: destY });
  if (shooter) {
    shooter.aimX = tx; shooter.aimY = ty;
    if (shooter.race === 'human') gainXp(shooter, 'shooting', 12);
  }
  return true;
}

export function gainXp(p: Pawn, s: string, amt: number) {
  const sk = (p.skills as any)[s];
  if (!sk) return;
  const f = sk.passion === 2 ? 1.5 : sk.passion === 1 ? 1 : 0.35;
  sk.xp += amt * f;
  const need = 1000 + sk.lvl * 400;
  if (sk.xp >= need && sk.lvl < 20) { sk.xp -= need; sk.lvl++; }
}

export function projectileTick(w: World, pr: Projectile) {
  const dx = pr.tx - pr.x, dy = pr.ty - pr.y;
  const d = Math.hypot(dx, dy);
  if (d > pr.speed) { pr.x += dx / d * pr.speed; pr.y += dy / d * pr.speed; return; }
  pr.x = pr.tx; pr.y = pr.ty;
  impact(w, pr);
  w.despawn(pr);
}

function impact(w: World, pr: Projectile) {
  const m = w.map;
  const cx = Math.round(pr.x), cy = Math.round(pr.y);
  if (pr.explosive) { explode(w, pr.x, pr.y, pr.explosive.radius, pr.explosive.damage, pr.shooter, !!pr.explosive.fire); return; }
  const shooter = w.pawns.get(pr.shooter) || null;
  if (pr.hit) {
    const t = w.things.get(pr.target);
    if (t && t.kind === 'pawn' && !t.dead && Math.abs(t.x - cx) <= 1 && Math.abs(t.y - cy) <= 1) {
      hitPawn(w, t, pr, shooter);
      return;
    }
    if (t && t.kind === 'building') { damageBuilding(w, t, pr.damage, pr.shooter); w.emit({ k: 'hit', x: cx, y: cy }); return; }
  }
  if (pr.coverHit) {
    const b = pr.coverHit > 0 ? w.buildings.get(pr.coverHit) : null;
    if (b) damageBuilding(w, b, pr.damage * 0.5, pr.shooter);
    w.emit({ k: 'hit', x: cx, y: cy, s: 'cover' });
    return;
  }
  // stray: may hit something at landing cell
  if (m.inb(cx, cy)) {
    for (const p of w.pawnsAt(cx, cy)) {
      if (p.dead || p.id === pr.shooter) continue;
      if (p.faction === pr.shooterFaction && dist(pr.sx, pr.sy, cx, cy) < 5) continue;
      if (w.rng.chance(p.downed ? 0.1 : 0.4)) { hitPawn(w, p, pr, shooter); return; }
    }
    const b = w.buildingAt(cx, cy);
    if (b && BUILDINGS[b.def].pass !== 'pass' && w.rng.chance(0.6)) { damageBuilding(w, b, pr.damage * 0.5, pr.shooter); }
  }
  w.emit({ k: 'hit', x: pr.x, y: pr.y, s: 'miss' });
}

function hitPawn(w: World, t: Pawn, pr: Projectile, shooter: Pawn | null) {
  const wasAlive = !t.dead, wasUp = !t.downed;
  applyDamage(w, t, { amount: pr.damage, type: pr.dmgType, pen: pr.pen, instigator: pr.shooter, weapon: pr.def });
  w.emit({ k: 'hit', x: t.x, y: t.y, s: 'flesh' });
  if (shooter) onHitResult(w, shooter, t, wasAlive, wasUp);
}

function onHitResult(w: World, attacker: Pawn, t: Pawn, wasAlive: boolean, wasUp: boolean) {
  if (wasAlive && t.dead) {
    attacker.kills++;
    if (attacker.race === 'human' && w.hostile(attacker.faction, t.faction)) {
      addThought(w, attacker, attacker.traits.includes('bloodlust') ? 'bloodlust_killed' : 'killed_enemy');
    }
  }
}

export function meleeAttack(w: World, a: Pawn, target: Pawn | Building) {
  let dmg = 6, type = 'blunt', pen = 0.1, cd = 100, label = 'punch';
  if (a.equip && ITEMS[a.equip.def].weapon?.melee) {
    const wp = ITEMS[a.equip.def].weapon!;
    const s = stuffOf(a.equip.stuff);
    const f = s ? (wp.dmgType === 'blunt' ? s.bluntF : s.sharpF) : 1;
    dmg = wp.damage * f * QUALITY_STAT[a.equip.quality ?? 2]; type = wp.dmgType; pen = wp.pen; cd = wp.cooldown; label = ITEMS[a.equip.def].label;
  } else if (a.equip) {
    dmg = 7; type = 'blunt'; cd = 110; label = 'gun butt';
  } else if (a.race !== 'human') {
    const ad = ANIMALS[a.race];
    const atk = w.rng.pick(ad.attacks);
    dmg = atk.damage; type = atk.type; cd = atk.cooldown; label = atk.label; pen = 0.15;
  }
  a.cd = cd;
  if (a.race === 'human') { dmg *= 0.85 + skillLevel(a, 'melee') * 0.02; gainXp(a, 'melee', 15); }
  a.aimX = target.x; a.aimY = target.y;
  if (target.kind === 'building') {
    damageBuilding(w, target, dmg * 1.5, a.id);
    w.sound('bash', target.x, target.y);
    return;
  }
  const hit = w.rng.chance(meleeHitChance(a) * (1 - meleeDodge(target) * (target.downed ? 0 : 1)));
  if (!hit) { w.text(target.x, target.y - 0.5, 'miss', '#ddd'); w.sound('swing', a.x, a.y); return; }
  const wasAlive = !target.dead, wasUp = !target.downed;
  applyDamage(w, target, { amount: dmg, type, pen, instigator: a.id, weapon: label });
  w.sound(type === 'blunt' ? 'punch' : 'slash', target.x, target.y);
  onHitResult(w, a, target, wasAlive, wasUp);
}

export function damageBuilding(w: World, b: Building, amount: number, instigator: number) {
  const d = BUILDINGS[b.def];
  if (d.natural && b.def === 'geyser') return;
  b.hp -= amount;
  w.emit({ k: 'hit', x: b.x, y: b.y, s: 'bld' });
  if (b.hp <= 0) destroyBuilding(w, b, 'destroyed');
  else if (w.isPlayerFaction(b.faction) && d.blocksRoom) w._cache.lastBash = w.tick;
}

export function explode(w: World, x: number, y: number, radius: number, damage: number, instigator: number, fire: boolean) {
  const m = w.map;
  w.emit({ k: 'explosion', x, y, x2: radius });
  w.sound('explosion', x, y);
  const r = Math.ceil(radius);
  const cx = Math.round(x), cy = Math.round(y);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = cx + dx, yy = cy + dy;
    if (!m.inb(xx, yy)) continue;
    const d = Math.hypot(xx - x, yy - y);
    if (d > radius) continue;
    if (!lineOfSight(w, cx, cy, xx, yy) && d > 1) continue;
    const f = 1 - (d / radius) * 0.6;
    for (const p of w.pawnsAt(xx, yy)) applyDamage(w, p, { amount: damage * f, type: fire ? 'burn' : 'bomb', pen: 0.1, instigator });
    const b = w.buildingAt(xx, yy);
    if (b) damageBuilding(w, b, damage * f * 1.2, instigator);
    const items = m.items[m.idx(xx, yy)];
    if (items) for (const id of [...items]) { const it = w.items.get(id); if (it && !it.corpse) { it.hp -= damage * f; if (it.hp <= 0) w.despawn(it); } }
    if (fire && w.rng.chance(0.6)) startFire(w, xx, yy, 0.5);
    else if (!fire && w.rng.chance(0.15)) m.addFilth(xx, yy, FILTH.ash, 20);
  }
}

// ---------------- target finding ----------------
export function pawnHostileTo(w: World, a: Pawn, b: Pawn): boolean {
  if (a.id === b.id || b.dead) return false;
  if (a.mental?.kind === 'berserk' || b.mental?.kind === 'berserk') return b.race === 'human' || a.race === 'human' || true;
  const aMan = a.animal?.manhunter && a.animal.manhunter > w.tick, bMan = b.animal?.manhunter && b.animal.manhunter > w.tick;
  if (aMan) return b.race === 'human' || !!b.animal?.tamed;
  if (bMan) return a.race === 'human' || !!a.animal?.tamed;
  if (a.target === b.id && a.race !== 'human' && !a.animal?.tamed) return true; // revenge / hunting prey
  if (b.target === a.id && b.race !== 'human' && !b.animal?.tamed && (b.animal?.manhunter || 0) > 0) return true;
  if (a.guest?.prisoner || b.guest?.prisoner) return false;
  if (a.faction === 0 || b.faction === 0) return false;
  if (a.hostileTo?.includes(b.faction) || b.hostileTo?.includes(a.faction)) return true;
  return w.hostile(a.faction, b.faction);
}

export function findEnemy(w: World, p: Pawn, radius: number, needLOS = true, includeDowned = false): Pawn | null {
  let best: Pawn | null = null, bestD = radius * radius;
  for (const o of w.pawns.values()) {
    if (o.dead || (o.downed && !includeDowned) || !pawnHostileTo(w, p, o)) continue;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > bestD) continue;
    if (needLOS && !lineOfSight(w, p.x, p.y, o.x, o.y)) continue;
    best = o; bestD = d2;
  }
  return best;
}

export function findHostileBuilding(w: World, p: Pawn, radius: number): Building | null {
  let best: Building | null = null, bestD = radius * radius;
  for (const b of w.buildings.values()) {
    if (!w.isPlayerFaction(b.faction) || !w.hostile(p.faction, b.faction)) continue;
    const d = BUILDINGS[b.def];
    if (d.conduit || d.floorLevel) continue;
    const dx = b.x - p.x, dy = b.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = b; }
  }
  return best;
}

// ---------------- turrets ----------------
export function turretTick(w: World, b: Building) {
  const d = BUILDINGS[b.def];
  if (!d.turret) return;
  if (b.cd && b.cd > 0) { b.cd--; return; }
  const weapon = d.turret.weapon;
  const wp = ITEMS[weapon].weapon!;
  let target = b.target ? w.pawns.get(b.target) : undefined;
  const fakeFaction = b.faction;
  const valid = (p: Pawn | undefined) => !!p && !p.dead && !p.downed && dist(p.x, p.y, b.x, b.y) <= (wp.range || 20) &&
    (w.hostile(fakeFaction, p.faction) || (p.animal?.manhunter || 0) > w.tick || p.mental?.kind === 'berserk') && lineOfSight(w, b.x, b.y, p.x, p.y);
  if (!valid(target)) {
    target = undefined; b.target = 0;
    if (w.tick % 15 === (b.id % 15)) {
      let bestD = 1e9;
      for (const p of w.pawns.values()) {
        if (!valid(p)) continue;
        const dd = dist(p.x, p.y, b.x, b.y);
        if (dd < bestD) { bestD = dd; target = p; }
      }
      if (target) { b.target = target.id; b.warm = wp.warmup || 30; }
    }
    if (!target) return;
  }
  if (!target) return;
  b.aim = Math.atan2(target.y - b.y, target.x - b.x);
  if (b.warm && b.warm > 0) { b.warm--; return; }
  fireAt(w, null, b, weapon, b.x, b.y, target, b.faction);
  b.burst = (b.burst || 0) + 1;
  if (b.burst >= (wp.burst || 1)) { b.burst = 0; b.cd = wp.cooldown; }
  else b.cd = wp.burstDelay || 6;
}

export { weaponOf, weaponDef, isMech };
