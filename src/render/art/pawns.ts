// Procedural pixel-art characters: colonists (4 facings, walk cycle), animals and mechanoids.
import { Pix, C, ramp, mix, addSprite, h2, type Sprite } from '../pixel';
import type { Pawn } from '../../sim/types';
import { ANIMALS } from '../../data/animals';
import { lookOf, lookKey, personPix, portraitBust, PERSON_W, PERSON_H, type Expr } from './people';

export const PAWN_W = PERSON_W, PAWN_H = PERSON_H;
export { lookOf };

// ---------------- animals ----------------
interface Quad { w: number; h: number; len: number; ht: number; leg: number; head: number; neck: number; tail: string; ears: string; horns: string; wool?: boolean; sac?: boolean; spots?: boolean; snout: number }
const QUADS: Record<string, Quad> = {
  hare: { w: 16, h: 14, len: 6, ht: 4, leg: 2, head: 2.4, neck: 0, tail: 'puff', ears: 'long', horns: '', snout: 1 },
  squirrel: { w: 16, h: 14, len: 5, ht: 3.4, leg: 2, head: 2.2, neck: 0, tail: 'bushy', ears: 'pointy', horns: '', snout: 1 },
  cat: { w: 16, h: 14, len: 6.5, ht: 3.2, leg: 3, head: 2.6, neck: 0, tail: 'long', ears: 'pointy', horns: '', snout: 0 },
  dog: { w: 22, h: 18, len: 9, ht: 4.2, leg: 4, head: 3.2, neck: 1, tail: 'curl', ears: 'pointy', horns: '', snout: 2 },
  deer: { w: 24, h: 22, len: 10, ht: 4.6, leg: 6, head: 3, neck: 3, tail: 'short', ears: 'round', horns: 'antlers', snout: 2 },
  boar: { w: 24, h: 18, len: 11, ht: 5.6, leg: 3, head: 4, neck: 0, tail: 'short', ears: 'pointy', horns: 'tusks', snout: 3 },
  wolf: { w: 24, h: 18, len: 10.5, ht: 4.4, leg: 5, head: 3.4, neck: 1, tail: 'bushy', ears: 'pointy', horns: '', snout: 3 },
  cougar: { w: 26, h: 18, len: 11.5, ht: 4.2, leg: 4.5, head: 3.3, neck: 1, tail: 'long', ears: 'round', horns: '', snout: 1 },
  alpaca: { w: 24, h: 24, len: 9, ht: 5, leg: 5, head: 2.8, neck: 6, tail: 'short', ears: 'long', horns: '', wool: true, snout: 1 },
  boomalope: { w: 26, h: 22, len: 11, ht: 5, leg: 5, head: 3.2, neck: 2, tail: 'short', ears: 'round', horns: 'curved', sac: true, snout: 2 },
  muffalo: { w: 32, h: 26, len: 14, ht: 7.5, leg: 5, head: 5, neck: 0, tail: 'short', ears: 'round', horns: 'curved', wool: true, snout: 2 },
  bear: { w: 32, h: 24, len: 14, ht: 7, leg: 5, head: 4.6, neck: 0, tail: 'short', ears: 'round', horns: '', snout: 2 },
  cow: { w: 30, h: 24, len: 13, ht: 6, leg: 5, head: 4, neck: 1, tail: 'long', ears: 'round', horns: 'curved', spots: true, snout: 2 },
  thrumbo: { w: 38, h: 30, len: 17, ht: 8.5, leg: 6, head: 5.4, neck: 1, tail: 'long', ears: 'round', horns: 'horn', wool: true, snout: 2 },
};

function quadPix(race: string, frame: number): Pix {
  const q = QUADS[race] || QUADS.dog;
  const a = ANIMALS[race];
  const base = C(a.color), light = C(a.color2 || a.color), dark = C(a.color3 || ramp(base, 0.62));
  const p = new Pix(q.w, q.h);
  const ground = q.h - 2;
  const cx = q.w / 2 - 1, cy = ground - q.leg - q.ht * 0.9;
  p.ellipse(cx, ground + 0.5, q.len * 0.9, 1.5, [20, 16, 30, 70]);
  // legs (far pair darker)
  const legXs = [cx - q.len * 0.62, cx + q.len * 0.55];
  legXs.forEach((lx, k) => {
    const sw = frame === 0 ? (k ? 1 : -1) : (k ? -1 : 1);
    const far = ramp(base, 0.62);
    p.rect(Math.round(lx + sw), Math.round(cy + q.ht * 0.5), 2, Math.round(ground - cy - q.ht * 0.5), far);
    p.rect(Math.round(lx - sw + 1), Math.round(cy + q.ht * 0.5), 2, Math.round(ground - cy - q.ht * 0.5), ramp(base, 0.85));
    p.hline(Math.round(lx - sw + 1), Math.round(lx - sw + 2), ground, ramp(dark, 0.7));
  });
  // tail
  const tx = cx - q.len - 0.5, ty = cy - q.ht * 0.3;
  if (q.tail === 'long') { p.line(tx + 1, ty, tx - 3, ty + 3 + frame, base); p.line(tx, ty, tx - 3, ty + 4 + frame, ramp(base, 0.8)); }
  else if (q.tail === 'bushy') { p.blob(tx - 2, ty + 1 - frame, 3, 2, race === 'squirrel' ? base : light); }
  else if (q.tail === 'curl') { p.line(tx + 1, ty, tx - 1, ty - 3, light); p.set(tx, ty - 3, light); }
  else if (q.tail === 'puff') { p.blob(tx + 0.5, ty, 1.6, 1.4, C('#f4f0e8')); }
  else p.set(Math.round(tx), Math.round(ty), ramp(base, 0.8));
  // body
  p.ellipse(cx, cy, q.len, q.ht, (x, y, nx, ny) => {
    const l = -ny * 0.9 - nx * 0.15 + (q.wool ? (h2(x, y, 4) - 0.5) * 0.5 : 0);
    let c = l > 0.45 ? ramp(base, 1.14) : l > -0.35 ? base : ramp(base, 0.8);
    if (ny > 0.35 && !q.wool) c = mix(c, light, 0.6);
    if (q.spots && h2(Math.floor(x / 3), Math.floor(y / 3), 5) > 0.6) c = ramp(dark, 1.1);
    return c;
  });
  if (q.wool) for (let k = 0; k < q.len * 2; k++) { const x = cx + (h2(k, 1, 9) - 0.5) * q.len * 1.8, y = cy - q.ht * 0.6 + h2(k, 2, 9) * q.ht; if (p.opaque(Math.round(x), Math.round(y))) p.set(x, y, ramp(light, 0.95)); }
  if (q.sac) p.blob(cx - 1, cy - q.ht - 1, q.len * 0.55, q.ht * 0.7, C(a.color2 || '#d86030'));
  // neck & head
  const hx = cx + q.len * 0.9 + q.head * 0.3, hy = cy - q.ht * 0.6 - q.neck;
  if (q.neck > 0) p.poly([[cx + q.len * 0.5, cy - q.ht * 0.2], [cx + q.len * 0.95, cy - q.ht * 0.6], [hx + 1, hy + 1], [hx - 1.5, hy + 1.5]], base);
  p.ellipse(hx, hy, q.head, q.head * 0.85, (x, y, nx, ny) => (ny < -0.2 ? ramp(base, 1.1) : base));
  if (q.snout) p.rect(Math.round(hx + q.head * 0.5), Math.round(hy), Math.round(q.snout + 1), Math.max(2, Math.round(q.head * 0.7)), ramp(light, 0.95));
  p.set(Math.round(hx + q.head * 0.5 + q.snout + 0.5), Math.round(hy), C('#1e1a24'));
  p.set(Math.round(hx + q.head * 0.2), Math.round(hy - q.head * 0.3), C('#1e1a24'));
  // ears
  if (q.ears === 'long') { p.rect(Math.round(hx - 1), Math.round(hy - q.head - 4), 1, 4, base); p.rect(Math.round(hx), Math.round(hy - q.head - 3), 1, 3, ramp(light, 0.9)); }
  else if (q.ears === 'pointy') { p.set(hx - 1, hy - q.head, base); p.set(hx - 1, hy - q.head - 1, ramp(base, 0.8)); p.set(hx, hy - q.head, ramp(base, 0.9)); }
  else if (q.ears === 'round') p.blob(hx - 1.5, hy - q.head + 0.3, 1.2, 1, ramp(base, 0.85));
  // horns
  if (q.horns === 'antlers') { const ax = Math.round(hx), ay = Math.round(hy - q.head); p.line(ax, ay, ax - 1, ay - 4, C('#d8c8a8')); p.line(ax - 1, ay - 2, ax - 3, ay - 3, C('#d8c8a8')); p.line(ax, ay - 3, ax + 2, ay - 5, C('#c8b898')); }
  else if (q.horns === 'curved') { const ax = Math.round(hx - 1), ay = Math.round(hy - q.head + 1); p.line(ax, ay, ax - 2, ay - 2, C('#e8e0c8')); p.line(ax - 2, ay - 2, ax - 1, ay - 4, C('#c8c0a8')); }
  else if (q.horns === 'tusks') { p.set(hx + q.head * 0.5 + q.snout, hy + q.head * 0.5, C('#f4f0e0')); p.set(hx + q.head * 0.5 + q.snout, hy + q.head * 0.5 - 1, C('#f4f0e0')); }
  else if (q.horns === 'horn') { const ax = Math.round(hx + q.head * 0.4), ay = Math.round(hy - q.head * 0.8); p.line(ax, ay, ax + 3, ay - 6, C('#f0e0a0')); p.line(ax + 1, ay, ax + 4, ay - 6, C('#c8b070')); }
  p.outline(undefined, false, true);
  return p;
}

function chickenPix(frame: number): Pix {
  const p = new Pix(14, 14);
  p.ellipse(7, 12.5, 4, 1, [20, 16, 30, 70]);
  const w = C('#f0ece0');
  p.vline(6 - frame, 10, 12, C('#e0a030')); p.vline(8 + frame, 10, 12, C('#e0a030'));
  p.blob(6.5, 7.5, 4, 3, w);
  p.blob(3, 6, 1.6, 2, ramp(w, 0.9));
  p.blob(9.5, 4.5, 2, 2, w);
  p.set(11, 4, C('#e0a030')); p.set(10, 4, C('#1e1a24')); p.set(9, 2, C('#d8402a')); p.set(10, 2, C('#d8402a'));
  p.outline();
  return p;
}

function mechPix(race: string, frame: number): Pix {
  const a = ANIMALS[race];
  const body = C(a.color), eye = C(a.color2 || '#e04040'), dark = ramp(body, 0.55);
  if (race === 'centipede') {
    const p = new Pix(38, 18);
    p.ellipse(19, 16.5, 16, 1.5, [20, 16, 30, 70]);
    for (let s = 0; s < 5; s++) {
      const x = 5 + s * 6.5;
      for (let l = 0; l < 2; l++) p.line(x + l * 2, 11, x + l * 2 + ((frame + s + l) % 2 ? 1 : -1), 15, dark);
      p.blob(x + 2, 8.5, 4, 3.6, ramp(body, 0.95 + (s % 2) * 0.08));
    }
    p.blob(34, 8, 3.2, 3, body); p.set(36, 7, eye); p.rect(14, 3, 8, 2, C(a.color2 || '#e0a040'));
    p.outline();
    return p;
  }
  const p = new Pix(22, 26);
  p.ellipse(11, 24.5, 5, 1.3, [20, 16, 30, 70]);
  const f = frame ? 1 : -1;
  // legs (digitigrade)
  p.line(9, 15, 7 + f, 19, dark); p.line(7 + f, 19, 8 + f, 24, dark);
  p.line(12, 15, 14 - f, 19, body); p.line(14 - f, 19, 13 - f, 24, body);
  // torso
  if (race === 'scyther') {
    p.poly([[7, 16], [10, 7], [14, 7], [13, 16]], body);
    p.blob(13, 5, 3, 2.5, body); p.set(15, 5, eye); p.set(15, 4, ramp(eye, 1.3));
    // blades
    p.line(12, 9, 19, 5 - frame, C('#e8ecf0')); p.line(12, 10, 20, 12 + frame, C('#e8ecf0')); p.set(20, 12 + frame, C('#ffffff'));
  } else {
    p.rect(7, 7, 8, 9, body); p.hline(7, 14, 7, ramp(body, 1.2));
    p.blob(11, 5, 3, 2.4, body); p.set(13, 5, eye);
    // lance
    p.rect(12, 10, 9, 2, C('#4a5058')); p.set(20, 10, eye);
  }
  p.outline();
  return p;
}

// ---------------- caches ----------------
const cache = new Map<string, Sprite>();

/** frame: 0 standing, 1..3 walk cycle (animals use 0/1) */
export function pawnSprite(p: Pawn, facing: number, frame: number, drafted = false): { s: Sprite; flip: boolean } {
  if (p.race === 'human') {
    const L = lookOf(p);
    const f = facing === 3 ? 1 : facing;
    const key = 'h' + lookKey(L) + ':' + f + ':' + frame + (drafted ? 'd' : '');
    let s = cache.get(key);
    if (!s) { s = addSprite(personPix(L, f, frame, drafted), -2, 14 - 25); cache.set(key, s); }
    return { s, flip: facing === 3 };
  }
  const a = ANIMALS[p.race];
  const key = 'a' + p.race + ':' + (frame & 1);
  let s = cache.get(key);
  if (!s) {
    const px = a?.mech ? mechPix(p.race, frame & 1) : p.race === 'chicken' ? chickenPix(frame & 1) : quadPix(p.race, frame & 1);
    s = addSprite(px, Math.round((16 - px.w) / 2), 16 - px.h + 1);
    cache.set(key, s);
  }
  // animals face left/right only
  const flip = facing === 3 || (facing !== 1 && ((p.seed || 0) & 1) === 1 && (p as any)._lastH === 3);
  return { s, flip };
}

/** lying/downed/corpse sprite */
export function lyingSprite(p: Pawn, dead: boolean): Sprite {
  const key = 'l' + (p.race === 'human' ? lookKey(lookOf(p)) : p.race) + (dead ? 'd' : '');
  let s = cache.get(key);
  if (s) return s;
  let px = p.race === 'human' ? personPix(lookOf(p), 0, 0) : ANIMALS[p.race]?.mech ? mechPix(p.race, 0) : p.race === 'chicken' ? chickenPix(0) : quadPix(p.race, 0);
  // drop shadow row removal
  px.map((c) => (c[3] < 120 ? null : c));
  px = p.race === 'human' ? px.rot90(1) : px.rot90(0);
  if (p.race !== 'human') { const f = new Pix(px.w, px.h); for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const c = px.get(x, px.h - 1 - y); if (c) f.set(x, y, c); } px = f; }
  if (dead) px.map(c => mix(c, [120, 120, 110, c[3]], 0.35));
  s = addSprite(px, Math.round((16 - px.w) / 2), Math.round((16 - px.h) / 2));
  cache.set(key, s);
  return s;
}

/** the face shown in the colonist bar and inspector reacts to how the colonist is doing */
export function expressionOf(p: Pawn): Expr {
  if (p.dead) return 'hurt';
  if (p.downed) return 'hurt';
  if (p.mental) return p.mental.kind === 'berserk' || p.mental.kind === 'tantrum' ? 'angry' : 'sad';
  const m = p.needs?.mood ?? 0.5;
  return m > 0.66 ? 'happy' : m < 0.32 ? 'sad' : 'neutral';
}

export function portraitSprite(p: Pawn): Sprite {
  const expr = p.race === 'human' ? expressionOf(p) : 'neutral';
  const key = 'p' + (p.race === 'human' ? lookKey(lookOf(p)) + expr : p.race);
  let s = cache.get(key);
  if (s) return s;
  let px: Pix;
  if (p.race === 'human') px = portraitBust(lookOf(p), expr);
  else {
    // animals: centre the standing sprite on a 32x32 canvas
    const src = ANIMALS[p.race]?.mech ? mechPix(p.race, 0) : p.race === 'chicken' ? chickenPix(0) : quadPix(p.race, 0);
    px = new Pix(Math.max(32, src.w), Math.max(32, src.h));
    px.blit(src, Math.floor((px.w - src.w) / 2), Math.floor((px.h - src.h) / 2));
  }
  s = addSprite(px);
  cache.set(key, s);
  return s;
}
