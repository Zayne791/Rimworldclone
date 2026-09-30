// Procedural pixel-art characters: colonists (4 facings, walk cycle), animals and mechanoids.
import { Pix, C, ramp, mix, addSprite, h2, type Sprite, type RGBA } from '../pixel';
import type { Pawn } from '../../sim/types';
import { ITEMS } from '../../data/items';
import { ANIMALS } from '../../data/animals';

export const PAWN_W = 16, PAWN_H = 24;

interface Look { skin: RGBA; hair: RGBA; hairStyle: string; beard: boolean; body: number; torso: RGBA | null; legs: RGBA | null; coat: RGBA | null; coatLong: boolean; head: string | null; headCol: RGBA | null; armor: boolean; female: boolean }

export function lookOf(p: Pawn): Look {
  let torso: RGBA | null = null, legs: RGBA | null = null, coat: RGBA | null = null, coatLong = false, head: string | null = null, headCol: RGBA | null = null, armor = false;
  const order = ['skin', 'middle', 'outer'];
  const sorted = [...p.apparel].sort((a, b) => {
    const la = Math.max(...ITEMS[a.def].apparel!.layers.map(l => order.indexOf(l)));
    const lb = Math.max(...ITEMS[b.def].apparel!.layers.map(l => order.indexOf(l)));
    return la - lb;
  });
  for (const a of sorted) {
    const d = ITEMS[a.def].apparel!;
    const col = C(a.color || (a.stuff ? ITEMS[a.stuff]?.stuff?.color || '#888' : d.color || '#7a8a9a'));
    const tcol = a.def === 'shirt' || a.def === 'tshirt' ? C(a.color || p.look.color || '#5a6a8c') : col;
    if (d.layers.includes('head')) { head = d.style; headCol = col; continue; }
    if (d.style === 'armor') armor = true;
    if (d.layers.includes('outer')) { coat = col; coatLong = d.cover.includes('legs'); if (d.style === 'armor') { torso = col; legs = ramp(col, 0.85); } continue; }
    if (d.cover.includes('torso')) torso = d.style === 'vest' && torso ? torso : tcol;
    if (d.style === 'vest') coat = col;
    if (d.cover.includes('legs')) legs = d.style === 'tribal' ? col : col;
  }
  return {
    skin: C(p.look.skin), hair: C(p.look.hairColor), hairStyle: p.look.hair, beard: !!p.look.beard, body: p.look.body ?? 1,
    torso, legs, coat, coatLong, head, headCol, armor, female: p.gender === 'f',
  };
}

function hairFront(p: Pix, L: Look, x0: number, y0: number, back: boolean) {
  const h = L.hair, hd = ramp(h, 0.72), hl = ramp(h, 1.25);
  const s = L.hairStyle;
  const cap = (rows: number) => { for (let y = 0; y < rows; y++) p.hline(x0 + (y === 0 ? 1 : 0), x0 + 7 - (y === 0 ? 1 : 0), y0 + y, y === 0 ? hl : h); };
  if (s === 'bald') { if (back) p.hline(x0 + 1, x0 + 6, y0 + 1, ramp(L.skin, 0.9)); return; }
  if (s === 'buzz') { p.hline(x0 + 1, x0 + 6, y0, hd); p.hline(x0, x0 + 7, y0 + 1, h); if (back) p.rect(x0, y0, 8, 4, h); return; }
  if (s === 'mohawk') { p.rect(x0 + 3, y0 - 2, 2, 4, h); p.set(x0 + 3, y0 - 2, hl); if (back) p.rect(x0 + 3, y0, 2, 6, h); return; }
  if (s === 'curly') { for (let y = -1; y < 3; y++) for (let x = -1; x < 9; x++) if ((x + y) % 2 === 0 || y < 2) p.set(x0 + x, y0 + y, (x * 3 + y) % 4 === 0 ? hl : h); p.set(x0 - 1, y0 + 3, h); p.set(x0 + 8, y0 + 3, h); if (back) p.rect(x0 - 1, y0, 10, 6, h); return; }
  if (s === 'spiky') { cap(2); for (let x = 0; x < 8; x += 2) { p.set(x0 + x, y0 - 1, h); p.set(x0 + x + 1, y0 - 2, hl); } if (back) p.rect(x0, y0, 8, 5, h); return; }
  cap(2);
  p.vline(x0, y0, y0 + 3, h); p.vline(x0 + 7, y0, y0 + 3, h);
  if (s === 'long') { p.vline(x0 - 1, y0 + 2, y0 + 9, hd); p.vline(x0, y0 + 4, y0 + 8, h); p.vline(x0 + 8, y0 + 2, y0 + 9, hd); p.vline(x0 + 7, y0 + 4, y0 + 8, h); }
  if (s === 'bob') { p.vline(x0 - 1, y0 + 1, y0 + 6, hd); p.vline(x0 + 8, y0 + 1, y0 + 6, hd); p.vline(x0, y0 + 4, y0 + 6, h); p.vline(x0 + 7, y0 + 4, y0 + 6, h); }
  if (s === 'bun') { p.blob(x0 + 3.5, y0 - 1.5, 2.2, 1.8, h); }
  if (s === 'ponytail' && back) { p.vline(x0 + 3, y0 + 6, y0 + 10, h); p.vline(x0 + 4, y0 + 6, y0 + 9, hd); }
  if (back) { p.rect(x0, y0, 8, s === 'long' ? 9 : s === 'bob' ? 7 : 5, h); for (let y = 1; y < 5; y++) p.set(x0 + 2 + (y % 3), y0 + y, hd); }
}

function headgear(p: Pix, L: Look, x0: number, y0: number, side: boolean) {
  if (!L.head || !L.headCol) return;
  const c = L.headCol, d = ramp(c, 0.72), l = ramp(c, 1.25);
  switch (L.head) {
    case 'helmet': p.rect(x0 - 1, y0 - 1, 10, 4, c); p.hline(x0, x0 + 7, y0 - 2, l); p.hline(x0 - 1, x0 + 8, y0 + 2, d); break;
    case 'marinehelmet': p.rect(x0 - 1, y0 - 2, 10, 9, c); p.hline(x0, x0 + 7, y0 - 3, l); if (!side) { p.rect(x0 + 1, y0 + 2, 6, 2, C('#1e2a38')); p.hline(x0 + 1, x0 + 6, y0 + 2, C('#6fb0f0')); } else { p.rect(x0 + 4, y0 + 2, 4, 2, C('#1e2a38')); p.set(x0 + 7, y0 + 2, C('#6fb0f0')); } p.hline(x0 - 1, x0 + 8, y0 + 6, d); break;
    case 'cowboyhat': p.hline(x0 - 3, x0 + 10, y0 + 1, d); p.hline(x0 - 2, x0 + 9, y0 + 1, c); p.rect(x0 + 1, y0 - 3, 6, 4, c); p.hline(x0 + 1, x0 + 6, y0 - 3, l); p.hline(x0 + 1, x0 + 6, y0, C('#3a2a1a')); break;
    case 'tuque': p.rect(x0, y0 - 2, 8, 4, c); p.hline(x0 - 1, x0 + 8, y0 + 1, d); p.hline(x0, x0 + 7, y0 - 2, l); p.blob(x0 + 3.5, y0 - 3, 1.5, 1.3, C('#f0f0f0')); break;
  }
}

/** facing: 0 S, 1 E, 2 N ; frame 0/1 */
export function humanPix(L: Look, facing: number, frame: number, drafted = false): Pix {
  const p = new Pix(PAWN_W, PAWN_H);
  const bob = frame === 1 ? 1 : 0;
  const skin = L.skin, sd = ramp(skin, 0.78);
  const torso = L.torso || skin;
  const legs = L.legs || ramp(skin, 0.9);
  const shoe = C('#3a2c24');
  const bw = L.armor ? 10 : [6, 8, 10][L.body] ?? 8;
  const tx0 = 8 - bw / 2;
  const headY = 4 + bob, torsoY = 11 + bob;
  // shadow
  p.ellipse(8, 22.5, 5, 1.5, [20, 16, 30, 70]);
  if (facing === 1) {
    // side view (facing right)
    const lf = frame === 0 ? 0 : 1;
    // back leg, front leg
    p.rect(6 - lf, 17 + bob, 2, 5 - bob, ramp(legs, 0.8)); p.set(6 - lf, 21, ramp(shoe, 0.8)); p.set(7 - lf, 21, ramp(shoe, 0.8));
    p.rect(8 + lf, 17 + bob, 2, 5 - bob, legs); p.hline(8 + lf, 10 + lf, 21, shoe);
    // torso
    p.rect(5, torsoY, 6, 6, torso); p.hline(5, 10, torsoY, ramp(torso, 1.15)); p.vline(10, torsoY, torsoY + 5, ramp(torso, 0.82));
    if (L.coat) { p.rect(5, torsoY, 6, L.coatLong ? 9 - bob : 6, L.coat); p.vline(10, torsoY, torsoY + (L.coatLong ? 8 : 5), ramp(L.coat, 0.8)); }
    // arm
    const ax = drafted ? 9 : 7 + (frame ? 1 : -1);
    p.rect(ax, torsoY + 1, 2, 4, ramp(L.coat || torso, 0.9)); p.set(ax + (drafted ? 1 : 0), torsoY + 5, sd);
    // head
    p.rect(5, headY, 7, 7, skin); p.hline(5, 11, headY + 6, sd); p.vline(11, headY + 1, headY + 5, ramp(skin, 0.92));
    p.set(12, headY + 3, skin); // nose
    p.set(10, headY + 3, C('#1e1a24')); // eye
    if (L.beard) { p.rect(8, headY + 5, 4, 2, L.hair); }
    // hair (side)
    if (L.hairStyle !== 'bald') {
      const h = L.hair;
      const s = L.hairStyle;
      p.rect(5, headY - 1, 7, 2, h); p.rect(5, headY, 3, s === 'long' ? 8 : s === 'bob' ? 6 : 4, h);
      if (s === 'mohawk') { p.rect(6, headY - 3, 4, 2, h); p.clear(11, headY - 1); }
      if (s === 'buzz') { p.clear(11, headY - 1); p.rect(5, headY, 2, 3, h); }
      if (s === 'ponytail') { p.vline(4, headY + 2, headY + 7, h); }
      if (s === 'bun') p.blob(5.5, headY - 1, 2, 1.8, h);
      if (s === 'curly') { p.rect(4, headY - 2, 8, 3, h); p.rect(4, headY, 3, 5, h); }
      p.hline(6, 10, headY - 1, ramp(h, 1.25));
    }
    headgear(p, L, 5, headY, true);
  } else {
    const back = facing === 2;
    // legs
    const l1 = frame === 1 ? 1 : 0, l2 = frame === 1 ? 0 : 0;
    p.rect(tx0 + 1, 17 + bob, 2, 5 - bob - l1, legs); p.rect(tx0 + bw - 3, 17 + bob, 2, 5 - bob - l2, ramp(legs, 0.9));
    p.hline(tx0 + 1, tx0 + 2, 21 - l1, shoe); p.hline(tx0 + bw - 3, tx0 + bw - 2, 21, shoe);
    // torso + arms
    p.rect(tx0, torsoY, bw, 6, torso);
    p.hline(tx0, tx0 + bw - 1, torsoY, ramp(torso, 1.15));
    p.hline(tx0, tx0 + bw - 1, torsoY + 5, ramp(torso, 0.8));
    if (L.coat) { p.rect(tx0, torsoY, bw, L.coatLong ? 9 - bob : 6, L.coat); p.hline(tx0, tx0 + bw - 1, torsoY, ramp(L.coat, 1.15)); if (!back) p.vline(8, torsoY + 1, torsoY + (L.coatLong ? 8 : 5), ramp(L.coat, 0.75)); }
    if (!back && L.torso && !L.coat) { p.set(7, torsoY, ramp(torso, 0.7)); p.set(8, torsoY, ramp(torso, 0.7)); }
    const armC = ramp(L.coat || torso, 0.88);
    p.rect(tx0 - 1, torsoY + 1 + (frame ? 1 : 0), 1, 4, armC); p.rect(tx0 + bw, torsoY + 1 + (frame ? 0 : 1), 1, 4, armC);
    p.set(tx0 - 1, torsoY + 5 + (frame ? 1 : 0), sd); p.set(tx0 + bw, torsoY + 5 + (frame ? 0 : 1), sd);
    // belt
    if (!L.coatLong) p.hline(tx0, tx0 + bw - 1, torsoY + 6, ramp(legs, 0.7));
    // head
    const hx = 4;
    p.rect(hx, headY, 8, 7, skin);
    p.hline(hx, hx + 7, headY + 6, sd); p.vline(hx + 7, headY + 1, headY + 5, ramp(skin, 0.9));
    p.clear(hx, headY); p.clear(hx + 7, headY); p.clear(hx, headY + 6); p.clear(hx + 7, headY + 6);
    if (!back) {
      p.set(hx + 2, headY + 3, C('#1e1a24')); p.set(hx + 5, headY + 3, C('#1e1a24'));
      p.set(hx + 2, headY + 2, ramp(L.hair, 0.8)); p.set(hx + 5, headY + 2, ramp(L.hair, 0.8));
      if (L.beard) { p.rect(hx + 1, headY + 5, 6, 2, L.hair); p.set(hx + 3, headY + 5, ramp(skin, 0.8)); p.set(hx + 4, headY + 5, ramp(skin, 0.8)); }
      else p.set(hx + 3, headY + 5, ramp(skin, 0.7));
    }
    hairFront(p, L, hx, headY - 1, back);
    headgear(p, L, hx, headY, false);
  }
  p.outline(undefined, false, true);
  return p;
}

export function portraitPix(L: Look): Pix {
  const src = humanPix(L, 0, 0);
  const p = new Pix(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = src.get(x, y + 1); if (c) p.set(x, y, c); }
  return p;
}

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
function lookKey(L: Look) {
  const c = (x: RGBA | null) => (x ? x.join(',') : '-');
  return `${c(L.skin)}|${c(L.hair)}|${L.hairStyle}|${L.beard ? 1 : 0}|${L.body}|${c(L.torso)}|${c(L.legs)}|${c(L.coat)}|${L.coatLong ? 1 : 0}|${L.head}|${c(L.headCol)}|${L.armor ? 1 : 0}`;
}

export function pawnSprite(p: Pawn, facing: number, frame: number, drafted = false): { s: Sprite; flip: boolean } {
  if (p.race === 'human') {
    const L = lookOf(p);
    const f = facing === 3 ? 1 : facing;
    const key = 'h' + lookKey(L) + ':' + f + ':' + frame + (drafted ? 'd' : '');
    let s = cache.get(key);
    if (!s) { s = addSprite(humanPix(L, f, frame, drafted), 0, 16 - PAWN_H); cache.set(key, s); }
    return { s, flip: facing === 3 };
  }
  const a = ANIMALS[p.race];
  const key = 'a' + p.race + ':' + frame;
  let s = cache.get(key);
  if (!s) {
    const px = a?.mech ? mechPix(p.race, frame) : p.race === 'chicken' ? chickenPix(frame) : quadPix(p.race, frame);
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
  let px = p.race === 'human' ? humanPix(lookOf(p), 0, 0) : ANIMALS[p.race]?.mech ? mechPix(p.race, 0) : p.race === 'chicken' ? chickenPix(0) : quadPix(p.race, 0);
  // drop shadow row removal
  px.map((c) => (c[3] < 120 ? null : c));
  px = p.race === 'human' ? px.rot90(1) : px.rot90(0);
  if (p.race !== 'human') { const f = new Pix(px.w, px.h); for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) { const c = px.get(x, px.h - 1 - y); if (c) f.set(x, y, c); } px = f; }
  if (dead) px.map(c => mix(c, [120, 120, 110, c[3]], 0.35));
  s = addSprite(px, Math.round((16 - px.w) / 2), Math.round((16 - px.h) / 2));
  cache.set(key, s);
  return s;
}

export function portraitSprite(p: Pawn): Sprite {
  const key = 'p' + (p.race === 'human' ? lookKey(lookOf(p)) : p.race);
  let s = cache.get(key);
  if (s) return s;
  let px: Pix;
  if (p.race === 'human') px = portraitPix(lookOf(p));
  else {
    const src = ANIMALS[p.race]?.mech ? mechPix(p.race, 0) : p.race === 'chicken' ? chickenPix(0) : quadPix(p.race, 0);
    px = src;
  }
  s = addSprite(px);
  cache.set(key, s);
  return s;
}
