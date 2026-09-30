// Procedural pixel-art people: a layered paper doll (body, clothes by layer, hair, headgear) drawn
// in three facings with a four-frame walk, plus a larger bust for portraits with mood expressions.
import { Pix, C, ramp, mix, h2, type RGBA } from '../pixel';
import type { Pawn } from '../../sim/types';
import { ITEMS } from '../../data/items';

export const PERSON_W = 20, PERSON_H = 28;

type Sleeve = 'long' | 'short' | 'none';
export interface Look {
  skin: RGBA; hair: RGBA; hairStyle: string; beard: boolean; body: number; female: boolean; eye: RGBA; old: boolean; freckles: boolean;
  shirt: RGBA | null; sleeve: Sleeve; buttons: boolean;
  pants: RGBA | null;
  mid: { col: RGBA; style: string } | null;
  outer: { col: RGBA; style: string; long: boolean } | null;
  head: { col: RGBA; style: string } | null;
  fringe: RGBA | null;
  shield: boolean;
}

const EYES = ['#3a2616', '#2a4a7a', '#3a6a3a', '#5a4a26', '#4a4a58', '#5a3218'];
const colOf = (a: { def: string; stuff?: string; color?: string }, fallback = '#7a8a9a') => C(a.color || (a.stuff ? ITEMS[a.stuff]?.stuff?.color || fallback : ITEMS[a.def].apparel?.color || fallback));

export function lookOf(p: Pawn): Look {
  const seed = p.seed ?? p.id;
  const L: Look = {
    skin: C(p.look.skin), hair: C(p.look.hairColor), hairStyle: p.look.hair || 'short', beard: !!p.look.beard, body: p.look.body ?? 1,
    female: p.gender === 'f', eye: C(EYES[Math.floor(h2(seed, 3, 7) * EYES.length)]), old: p.age > 55,
    freckles: h2(seed, 9, 2) > 0.82 && C(p.look.skin)[0] > 200,
    shirt: null, sleeve: 'none', buttons: false, pants: null, mid: null, outer: null, head: null, fringe: null, shield: false,
  };
  for (const a of p.apparel) {
    const d = ITEMS[a.def].apparel;
    if (!d) continue;
    const col = colOf(a);
    if (d.shield) { L.shield = true; continue; }
    if (d.layers.includes('head')) { L.head = { col, style: d.style }; continue; }
    if (d.style === 'tribal') { L.shirt = col; L.sleeve = 'short'; L.pants = ramp(col, 0.9); L.fringe = ramp(col, 0.7); continue; }
    if (d.layers.includes('outer')) { L.outer = { col, style: d.style, long: d.cover.includes('legs') }; continue; }
    if (d.layers.includes('middle')) { L.mid = { col, style: d.style }; continue; }
    if (d.cover.includes('torso')) { L.shirt = a.def === 'shirt' || a.def === 'tshirt' ? C(a.color || p.look.color || '#5a6a8c') : col; L.sleeve = d.cover.includes('arms') ? 'long' : 'short'; L.buttons = d.style === 'shirt'; }
    if (d.cover.includes('legs')) L.pants = col;
  }
  // hats and helmets flatten tall hairstyles
  if (L.head) {
    const tall: Record<string, string> = { mohawk: 'buzz', spiky: 'short', bun: 'short', curly: 'short' };
    if (L.head.style === 'marinehelmet') L.hairStyle = 'buzz';
    else L.hairStyle = tall[L.hairStyle] || L.hairStyle;
  }
  return L;
}
export function lookKey(L: Look): string {
  const c = (x: RGBA | null | undefined) => (x ? x.join(',') : '-');
  return [c(L.skin), c(L.hair), L.hairStyle, +L.beard, L.body, +L.female, c(L.eye), +L.old, +L.freckles, c(L.shirt), L.sleeve, +L.buttons, c(L.pants),
    L.mid ? c(L.mid.col) + L.mid.style : '-', L.outer ? c(L.outer.col) + L.outer.style + +L.outer.long : '-', L.head ? c(L.head.col) + L.head.style : '-', c(L.fringe), +L.shield].join('|');
}

export const INK = C('#1e1a24');
const BOOT = C('#3e2e24');
export const shade = (c: RGBA) => ({ b: c, l: ramp(c, 1.16), d: ramp(c, 0.8), dd: ramp(c, 0.64) });
export const armored = (L: Look) => !!L.outer && (L.outer.style === 'armor' || L.outer.style === 'plate');

/** body box with light from the upper left */
function shadedRect(p: Pix, x: number, y: number, w: number, h: number, c: RGBA) {
  const s = shade(c);
  p.rect(x, y, w, h, s.b);
  p.vline(x, y, y + h - 1, s.l);
  p.vline(x + w - 1, y, y + h - 1, s.d);
  p.hline(x, x + w - 1, y + h - 1, s.d);
}

// ---------------- hair ----------------
/** front / back hair over a head whose box is (x0,y0,w,h) */
function hairFrontBack(p: Pix, L: Look, x0: number, y0: number, w: number, back: boolean) {
  const s = L.hairStyle, h = shade(L.hair);
  if (s === 'bald') { if (back) p.hline(x0 + 2, x0 + w - 3, y0 + 1, ramp(L.skin, 0.92)); else p.set(x0 + 3, y0 + 1, ramp(L.skin, 1.12)); return; }
  const x1 = x0 + w - 1;
  // cap over the top of the skull
  const cap = (rows: number) => {
    for (let r = 0; r < rows; r++) {
      const inset = r === 0 ? 1 : 0;
      p.hline(x0 + inset, x1 - inset, y0 - 1 + r, r === 0 ? h.l : h.b);
    }
    p.set(x0 + 2, y0, h.l); p.set(x0 + 3, y0, h.l);
    p.set(x1 - 1, y0 + rows - 2, h.d);
  };
  switch (s) {
    case 'buzz': p.hline(x0 + 1, x1 - 1, y0 - 1, h.d); p.hline(x0, x1, y0, h.b); if (back) p.rect(x0, y0, w, 4, h.b); else { p.set(x0, y0 + 1, h.b); p.set(x1, y0 + 1, h.b); } break;
    case 'mohawk': p.rect(x0 + 4, y0 - 3, 2, 5, h.b); p.set(x0 + 4, y0 - 3, h.l); p.set(x0 + 5, y0 - 2, h.d); if (back) p.rect(x0 + 4, y0, 2, 7, h.b); break;
    case 'spiky':
      cap(2);
      for (let x = x0; x <= x1; x += 2) { p.set(x, y0 - 2, h.b); p.set(x + 1, y0 - 3, h.l); }
      p.set(x0, y0 + 1, h.b); p.set(x1, y0 + 1, h.d);
      if (back) p.rect(x0, y0, w, 5, h.b);
      break;
    case 'curly':
      for (let y = -2; y < 3; y++) for (let x = -1; x <= w; x++) {
        const edge = (x === -1 || x === w) && y < 0;
        if (edge) continue;
        p.set(x0 + x, y0 + y, (x + y * 2) % 5 === 0 ? h.l : (x * 3 + y) % 7 === 0 ? h.d : h.b);
      }
      p.rect(x0 - 1, y0 + 2, 1, 4, h.b); p.rect(x1 + 1, y0 + 2, 1, 4, h.d);
      if (back) { p.rect(x0 - 1, y0, w + 2, 7, h.b); for (let k = 0; k < 8; k++) p.set(x0 + (k * 3) % w, y0 + 1 + (k * 5) % 6, (k % 2) ? h.d : h.l); }
      break;
    default: {
      cap(3);
      // side locks
      p.vline(x0, y0 + 1, y0 + 4, h.b); p.vline(x1, y0 + 1, y0 + 4, h.d);
      if (!back) { p.set(x0 + 1, y0 + 2, h.b); p.set(x0 + 2, y0 + 2, h.d); p.set(x1 - 1, y0 + 2, h.d); } // fringe
      if (s === 'long') { p.rect(x0 - 1, y0 + 2, 1, 9, h.d); p.rect(x1 + 1, y0 + 2, 1, 9, h.dd); p.vline(x0, y0 + 5, y0 + 10, h.b); p.vline(x1, y0 + 5, y0 + 10, h.d); }
      if (s === 'bob') { p.rect(x0 - 1, y0 + 1, 1, 6, h.d); p.rect(x1 + 1, y0 + 1, 1, 6, h.dd); p.vline(x0, y0 + 5, y0 + 6, h.b); p.vline(x1, y0 + 5, y0 + 6, h.d); }
      if (s === 'bun') { p.blob(x0 + w / 2 - 0.5, y0 - 2.5, 2.4, 2, h.b); p.set(x0 + w / 2 - 1, y0 - 3, h.l); }
      if (s === 'ponytail') { if (back) { p.rect(x0 + w / 2 - 1, y0 + 6, 2, 5, h.b); p.set(x0 + w / 2 - 1, y0 + 10, h.d); } else { p.set(x1 + 1, y0 + 3, h.d); p.set(x1 + 1, y0 + 4, h.dd); } }
      if (back) {
        const hh = s === 'long' ? 11 : s === 'bob' ? 7 : s === 'ponytail' ? 6 : 5;
        p.rect(x0, y0, w, hh, h.b);
        for (let y = 1; y < hh; y += 2) p.set(x0 + 2 + (y % 4), y0 + y, h.d);
        p.set(x0 + 2, y0 + 1, h.l); p.set(x0 + 3, y0 + 1, h.l);
      }
    }
  }
}

// ---------------- headgear ----------------
function headgearFront(p: Pix, L: Look, x0: number, y0: number, w: number, side: boolean) {
  if (!L.head) return;
  const s = shade(L.head.col), x1 = x0 + w - 1;
  switch (L.head.style) {
    case 'helmet':
      p.rect(x0 - 1, y0 - 2, w + 2, 4, s.b); p.hline(x0, x1, y0 - 3, s.l); p.hline(x0 - 1, x1 + 1, y0 + 1, s.dd); p.set(x0 + 1, y0 - 2, s.l);
      break;
    case 'marinehelmet':
      p.rect(x0 - 1, y0 - 2, w + 2, 10, s.b); p.hline(x0, x1, y0 - 3, s.l); p.vline(x0 - 1, y0 - 1, y0 + 7, s.l); p.vline(x1 + 1, y0 - 1, y0 + 7, s.d);
      if (side) { p.rect(x1 - 3, y0 + 2, 4, 3, C('#1e2a38')); p.hline(x1 - 3, x1, y0 + 2, C('#7fc4ff')); p.set(x1 + 1, y0 + 3, C('#9fd8ff')); }
      else { p.rect(x0 + 1, y0 + 2, w - 2, 3, C('#1e2a38')); p.hline(x0 + 1, x1 - 1, y0 + 2, C('#7fc4ff')); p.set(x0 + 2, y0 + 3, C('#bfe8ff')); }
      p.hline(x0 - 1, x1 + 1, y0 + 7, s.dd);
      break;
    case 'cowboyhat':
      p.hline(x0 - 3, x1 + 3, y0 + 1, s.d); p.hline(x0 - 2, x1 + 2, y0, s.b);
      p.rect(x0 + 1, y0 - 4, w - 2, 4, s.b); p.hline(x0 + 2, x1 - 2, y0 - 4, s.l); p.set(x0 + w / 2, y0 - 4, s.d);
      p.hline(x0 + 1, x1 - 1, y0 - 1, C('#3a2a1a'));
      break;
    case 'tuque':
      p.rect(x0, y0 - 3, w, 4, s.b); p.hline(x0 + 1, x1 - 1, y0 - 3, s.l); p.hline(x0 - 1, x1 + 1, y0 + 1, s.d);
      for (let x = x0; x <= x1; x += 2) p.set(x, y0, s.d);
      p.blob(x0 + w / 2 - 0.5, y0 - 4, 1.7, 1.4, C('#f0ece4'));
      break;
  }
}

// ---------------- body ----------------
interface Frame { bob: number; lstep: number; rstep: number; larm: number; rarm: number }
const FRONT_FRAMES: Frame[] = [
  { bob: 0, lstep: 0, rstep: 0, larm: 0, rarm: 0 },
  { bob: 0, lstep: 0, rstep: 1, larm: 1, rarm: -1 },
  { bob: -1, lstep: 0, rstep: 0, larm: 0, rarm: 0 },
  { bob: 0, lstep: 1, rstep: 0, larm: -1, rarm: 1 },
];

export function torsoColors(L: Look) {
  const base = L.outer && armored(L) ? L.outer.col : L.outer ? L.outer.col : L.mid ? L.mid.col : L.shirt || L.skin;
  return base;
}

/** facing: 0 S, 1 E, 2 N; frame 0..3 (0 = standing) */
export function personPix(L: Look, facing: number, frame: number, drafted = false): Pix {
  const p = new Pix(PERSON_W, PERSON_H);
  const f = FRONT_FRAMES[frame % 4];
  const skin = shade(L.skin);
  const pants = L.pants || (L.outer?.long ? L.outer.col : null);
  const bulky = armored(L);
  const bw = bulky ? (L.body === 2 ? 11 : 10) : L.female ? [7, 7, 9][L.body] ?? 7 : [7, 8, 10][L.body] ?? 8;
  const x0 = Math.round(10 - bw / 2);
  const up = f.bob; // -1 raises the whole upper body on passing frames
  const hy = 2 + up, ty = 12 + up;
  p.ellipse(10, 26, 5.5, 1.5, [20, 16, 30, 70]);
  if (facing === 1) return sidePix(p, L, frame, drafted, bulky);
  const back = facing === 2;
  // ---- legs & boots ----
  const lw = Math.max(3, Math.floor(bw / 2));
  const legTop = 19 + up;
  const legC = pants || L.skin;
  const legs = shade(legC);
  const drawLeg = (lx: number, lift: number, far: boolean) => {
    const bot = 24 - lift;
    p.rect(lx, legTop, lw, bot - legTop, far ? legs.d : legs.b);
    if (!far) p.vline(lx, legTop, bot - 1, legs.l);
    p.rect(lx, bot, lw, 2, BOOT); p.hline(lx, lx + lw - 1, bot, ramp(BOOT, 1.25));
    if (!pants) p.rect(lx, legTop, lw, 2, C('#e8e4d8')); // shorts/underwear when there are no trousers
  };
  drawLeg(x0, f.lstep, false);
  drawLeg(x0 + bw - lw, f.rstep, true);
  if (bw - 2 * lw >= 1) p.rect(x0 + lw, legTop, bw - 2 * lw, 1, legs.dd);
  else p.vline(x0 + lw - 1, legTop + 1, 22, legs.d);
  // ---- arms (behind body sides) ----
  const armC = L.outer ? L.outer.col : L.mid && L.mid.style === 'jacket' ? L.mid.col : L.sleeve === 'long' ? L.shirt! : null;
  const arm = (ax: number, swing: number, right: boolean) => {
    const top = ty + 1, len = 5;
    const c = armC ? shade(armC) : skin;
    const aw = 2;
    p.rect(ax, top + swing, aw, len, right ? c.d : c.b);
    if (!armC && L.sleeve === 'short' && L.shirt) p.rect(ax, top + swing, aw, 2, right ? ramp(L.shirt, 0.8) : L.shirt);
    p.rect(ax, top + len + swing, aw, 2, right ? skin.d : skin.b); // hand
    if (bulky) { p.rect(ax - (right ? 0 : 1), top - 1, 3, 3, right ? shade(L.outer!.col).d : shade(L.outer!.col).l); }
  };
  if (!drafted || back) { arm(x0 - 2, f.larm, false); arm(x0 + bw, f.rarm, true); }
  else { arm(x0 - 2, 0, false); arm(x0 + bw, -1, true); }
  // ---- torso ----
  const tc = torsoColors(L);
  shadedRect(p, x0, ty, bw, 7, tc);
  // shirt details
  if (!L.outer && !L.mid && L.shirt) {
    if (!back) {
      if (L.buttons) { p.vline(x0 + Math.floor(bw / 2), ty + 1, ty + 5, ramp(L.shirt, 0.72)); p.set(x0 + Math.floor(bw / 2) - 1, ty, C('#f0ece0')); p.set(x0 + Math.floor(bw / 2) + 1, ty, C('#f0ece0')); }
      else { p.set(x0 + Math.floor(bw / 2) - 1, ty, skin.d); p.set(x0 + Math.floor(bw / 2), ty, skin.d); }
    }
  } else if (!L.shirt && !L.mid && !L.outer) {
    // bare chest: a little muscle shading
    p.hline(x0 + 1, x0 + bw - 2, ty + 3, skin.d);
  }
  if (L.fringe) for (let x = x0; x < x0 + bw; x += 2) p.set(x, ty + 7, L.fringe);
  if (L.mid && !L.outer) {
    const m = shade(L.mid.col);
    if (L.mid.style === 'jacket' && !back) { const cx = x0 + Math.floor(bw / 2); p.rect(cx - 1, ty, 2, 7, L.shirt ? ramp(L.shirt, 0.95) : skin.b); p.vline(cx - 2, ty, ty + 6, m.d); p.vline(cx + 1, ty, ty + 6, m.dd); p.set(cx - 2, ty, m.l); p.set(cx + 1, ty, m.l); }
    if (L.mid.style === 'vest') { p.rect(x0 + 1, ty + 1, 2, 2, m.d); p.rect(x0 + bw - 3, ty + 1, 2, 2, m.d); p.hline(x0, x0 + bw - 1, ty + 4, m.dd); if (!back) p.rect(x0 + 1, ty + 4, bw - 2, 2, m.d); }
  }
  if (L.outer) {
    const o = shade(L.outer.col);
    const st = L.outer.style;
    if (st === 'duster' || st === 'parka') {
      const hem = L.outer.long ? (st === 'parka' ? 21 : 22) : ty + 7;
      p.rect(x0, ty, bw, hem - ty + up * 0, o.b); p.vline(x0, ty, hem - 1, o.l); p.vline(x0 + bw - 1, ty, hem - 1, o.d); p.hline(x0, x0 + bw - 1, hem - 1, o.dd);
      if (!back) { const cx = x0 + Math.floor(bw / 2); p.vline(cx, ty + 1, hem - 1, o.dd); p.set(cx - 1, ty, o.dd); p.set(cx + 1, ty, o.dd); }
      if (st === 'parka') { p.hline(x0 - 1, x0 + bw, ty, C('#ece6da')); p.hline(x0, x0 + bw - 1, ty + 1, C('#d8d2c6')); p.hline(x0, x0 + bw - 1, hem - 1, C('#e4ded2')); }
      else { p.set(x0 + 1, ty + 3, o.l); p.set(x0 + bw - 2, ty + 3, o.d); }
    } else if (st === 'plate') {
      for (let y = ty + 2; y < ty + 7; y += 2) p.hline(x0, x0 + bw - 1, y, o.d);
      p.rect(x0 + 2, ty + 1, bw - 4, 1, o.l);
      if (!back) p.set(x0 + Math.floor(bw / 2), ty + 3, ramp(L.outer.col, 1.4));
    } else if (st === 'armor') {
      if (!back) { p.rect(x0 + 2, ty + 1, bw - 4, 3, o.d); p.hline(x0 + 2, x0 + bw - 3, ty + 1, o.l); p.set(x0 + Math.floor(bw / 2), ty + 2, C('#7fd0ff')); p.set(x0 + Math.floor(bw / 2) - 1, ty + 2, C('#bfe8ff')); }
      else { p.rect(x0 + 2, ty + 1, bw - 4, 4, o.d); p.hline(x0 + 3, x0 + bw - 4, ty + 2, C('#3a4450')); }
      p.hline(x0, x0 + bw - 1, ty + 5, o.dd);
    }
  }
  // belt
  if (!(L.outer && L.outer.long)) {
    p.hline(x0, x0 + bw - 1, ty + 6, L.shield ? C('#3a4a6a') : ramp(legC, 0.6));
    if (L.shield) { p.set(x0 + Math.floor(bw / 2), ty + 6, C('#9fd8ff')); p.set(x0 + Math.floor(bw / 2) - 1, ty + 6, C('#5a9ae0')); }
    else if (!back) p.set(x0 + Math.floor(bw / 2), ty + 6, C('#c8a860'));
  }
  // ---- neck & head ----
  p.rect(9, hy + 9, 2, 2, skin.d);
  const hx = 5, hw = 10;
  p.rect(hx, hy, hw, 9, skin.b);
  p.vline(hx, hy + 1, hy + 7, skin.l); p.vline(hx + hw - 1, hy + 1, hy + 7, skin.d); p.hline(hx + 1, hx + hw - 2, hy + 8, skin.d);
  for (const [cx, cy] of [[hx, hy], [hx + hw - 1, hy], [hx, hy + 8], [hx + hw - 1, hy + 8]] as [number, number][]) p.clear(cx, cy);
  // ears
  p.set(hx - 1, hy + 4, skin.b); p.set(hx - 1, hy + 5, skin.d); p.set(hx + hw, hy + 4, skin.d); p.set(hx + hw, hy + 5, skin.dd);
  if (!back) face(p, L, hx, hy, drafted);
  hairFrontBack(p, L, hx, hy, hw, back);
  headgearFront(p, L, hx, hy, hw, false);
  p.outline(undefined, false, true);
  return p;
}

function face(p: Pix, L: Look, hx: number, hy: number, drafted: boolean) {
  const skin = shade(L.skin);
  const brow = ramp(L.hair, 0.75);
  const ey = hy + 4;
  // eyes: dark pupil over coloured iris, a glint on the outer corner
  for (const ex of [hx + 2, hx + 6]) {
    p.set(ex, ey, INK); p.set(ex + 1, ey, INK);
    p.set(ex, ey + 1, L.eye); p.set(ex + 1, ey + 1, ramp(L.eye, 0.8));
    p.set(ex + (ex < hx + 5 ? 0 : 1), ey, C('#f4f0f0'));
    // brows (angled when drafted)
    p.set(ex, ey - 1 - (drafted && ex > hx + 4 ? 0 : 0), brow); p.set(ex + 1, ey - 1 - (drafted ? (ex < hx + 5 ? 0 : 0) : 0), brow);
    if (drafted) { p.set(ex < hx + 5 ? ex + 1 : ex, ey - 1, ramp(brow, 0.7)); }
  }
  // nose & mouth
  p.set(hx + 4, ey + 2, skin.d); p.set(hx + 5, ey + 2, skin.d);
  if (L.beard) {
    p.rect(hx + 1, ey + 3, 8, 2, L.hair); p.hline(hx + 2, hx + 7, ey + 5 > hy + 8 ? hy + 8 : ey + 5, ramp(L.hair, 0.8));
    p.hline(hx + 4, hx + 5, ey + 3, ramp(L.skin, 0.62));
  } else {
    p.hline(hx + 4, hx + 5, ey + 3, mix(ramp(L.skin, 0.6), C('#a04848'), 0.4));
    if (L.female) { p.set(hx + 1, ey + 2, mix(L.skin, C('#e07070'), 0.3)); p.set(hx + 8, ey + 2, mix(L.skin, C('#e07070'), 0.3)); }
  }
  if (L.freckles) { p.set(hx + 2, ey + 2, ramp(L.skin, 0.8)); p.set(hx + 7, ey + 2, ramp(L.skin, 0.8)); }
  if (L.old) { p.set(hx + 1, ey + 1, skin.d); p.set(hx + 8, ey + 1, skin.dd); }
}

/** side view facing east */
function sidePix(p: Pix, L: Look, frame: number, drafted: boolean, bulky: boolean): Pix {
  const skin = shade(L.skin);
  const pants = L.pants || (L.outer?.long ? L.outer.col : null);
  const legC = pants || L.skin;
  const legs = shade(legC);
  const up = frame === 2 ? -1 : 0;
  const hy = 2 + up, ty = 12 + up;
  const stride = [0, 2, 0, -2][frame % 4];
  const bw = bulky ? 8 : L.body === 2 ? 7 : 6;
  const x0 = 10 - Math.floor(bw / 2);
  // legs: hip at (10, 19) to feet
  const leg = (dx: number, c: RGBA, boot: RGBA) => {
    const top = 19 + up;
    for (let y = top; y < 24; y++) {
      const t = (y - top) / (24 - top);
      const x = Math.round(9 + dx * t);
      p.set(x, y, c); p.set(x + 1, y, c); p.set(x + 2, y, ramp(c, 0.85));
    }
    const fx = Math.round(9 + dx);
    p.rect(fx, 24, 4, 2, boot); p.hline(fx, fx + 3, 24, ramp(boot, 1.25));
    if (!pants) { p.set(9, top, C('#e8e4d8')); p.set(10, top, C('#e8e4d8')); p.set(11, top, C('#e8e4d8')); }
  };
  leg(-stride, legs.dd, ramp(BOOT, 0.8));
  // back arm
  const armC = L.outer ? L.outer.col : L.mid && L.mid.style === 'jacket' ? L.mid.col : L.sleeve === 'long' ? L.shirt : null;
  const swing = [0, -2, 0, 2][frame % 4];
  const drawArm = (dx: number, far: boolean) => {
    const c = armC ? shade(armC) : skin;
    const ax = 9 + (far ? 0 : 0);
    if (drafted && !far) {
      p.rect(ax, ty + 2, 5, 2, c.b); p.rect(ax + 5, ty + 2, 2, 2, skin.b); // arm held out front
      return;
    }
    for (let y = 0; y < 6; y++) { const x = Math.round(ax + dx * (y / 6)); p.set(x, ty + 1 + y, far ? c.d : c.b); p.set(x + 1, ty + 1 + y, far ? c.dd : c.d); }
    const hx2 = Math.round(ax + dx);
    p.set(hx2, ty + 7, far ? skin.d : skin.b); p.set(hx2 + 1, ty + 7, far ? skin.dd : skin.d);
    if (!armC && L.sleeve === 'short' && L.shirt) { p.set(ax, ty + 1, L.shirt); p.set(ax + 1, ty + 1, ramp(L.shirt, 0.8)); }
  };
  drawArm(-swing, true);
  // torso
  const tc = torsoColors(L);
  shadedRect(p, x0, ty, bw, 7, tc);
  if (L.outer && (L.outer.style === 'duster' || L.outer.style === 'parka') && L.outer.long) {
    const o = shade(L.outer.col); const hem = L.outer.style === 'parka' ? 21 : 22;
    p.rect(x0, ty + 6, bw, hem - ty - 6, o.b); p.vline(x0 + bw - 1, ty, hem - 1, o.d); p.hline(x0, x0 + bw - 1, hem - 1, o.dd);
    if (L.outer.style === 'parka') { p.hline(x0, x0 + bw, ty, C('#ece6da')); p.hline(x0, x0 + bw - 1, hem - 1, C('#e4ded2')); }
  }
  if (L.outer?.style === 'armor') { p.rect(x0 + bw - 3, ty + 1, 2, 3, ramp(L.outer.col, 0.8)); p.set(x0 + bw - 1, ty + 2, C('#7fd0ff')); p.rect(x0 - 1, ty + 1, 2, 4, ramp(L.outer.col, 0.7)); }
  if (L.outer?.style === 'plate') for (let y = ty + 2; y < ty + 7; y += 2) p.hline(x0, x0 + bw - 1, y, ramp(L.outer.col, 0.8));
  if (L.mid?.style === 'vest' && !L.outer) { p.rect(x0 + bw - 3, ty + 1, 2, 2, ramp(L.mid.col, 0.8)); }
  if (L.fringe) for (let x = x0; x < x0 + bw; x += 2) p.set(x, ty + 7, L.fringe);
  if (!(L.outer && L.outer.long)) p.hline(x0, x0 + bw - 1, ty + 6, L.shield ? C('#3a4a6a') : ramp(legC, 0.6));
  if (L.shield) p.set(x0 + bw - 1, ty + 6, C('#9fd8ff'));
  leg(stride, legs.b, BOOT);
  drawArm(swing, false);
  // neck & head (profile)
  p.rect(9, hy + 9, 2, 2, skin.d);
  const hx = 6, hw = 9;
  p.rect(hx, hy, hw, 9, skin.b);
  p.vline(hx + hw - 1, hy + 1, hy + 7, skin.b); p.hline(hx + 1, hx + hw - 2, hy + 8, skin.d);
  p.clear(hx, hy); p.clear(hx + hw - 1, hy); p.clear(hx, hy + 8); p.clear(hx + hw - 1, hy + 8);
  p.set(hx + hw, hy + 5, skin.b); p.set(hx + hw, hy + 6, skin.d); // nose
  const ey = hy + 4;
  p.set(hx + hw - 3, ey, INK); p.set(hx + hw - 3, ey + 1, L.eye); p.set(hx + hw - 2, ey, C('#f4f0f0'));
  p.set(hx + hw - 3, ey - 1, ramp(L.hair, 0.75)); p.set(hx + hw - 2, ey - 1, ramp(L.hair, 0.75));
  p.set(hx + 4, ey + 1, skin.d); p.set(hx + 4, ey + 2, skin.dd); p.set(hx + 5, ey + 1, skin.b); // ear
  if (L.beard) { p.rect(hx + 3, ey + 3, 6, 2, L.hair); p.set(hx + hw - 1, ey + 3, ramp(L.skin, 0.62)); }
  else p.set(hx + hw - 2, ey + 3, mix(ramp(L.skin, 0.6), C('#a04848'), 0.4));
  // hair (profile): covers the back of the skull
  const h = shade(L.hair), s = L.hairStyle;
  if (s !== 'bald') {
    const back = s === 'long' ? 10 : s === 'bob' ? 7 : s === 'ponytail' ? 5 : s === 'buzz' ? 3 : 5;
    p.hline(hx + 1, hx + hw - 2, hy - 1, h.b); p.hline(hx + 2, hx + 5, hy - 1, h.l);
    p.rect(hx, hy, hw - 1, 2, h.b); p.hline(hx + 1, hx + 4, hy, h.l);
    p.rect(hx, hy + 2, 4, back - 2, h.b); p.vline(hx, hy + 2, hy + back - 1, h.d); p.vline(hx + 3, hy + 2, hy + back - 1, h.d);
    for (let y = hy + 3; y < hy + back; y += 2) p.set(hx + 1, y, h.l);
    if (s !== 'buzz') p.set(hx + hw - 2, hy + 2, h.d);
    if (s === 'buzz') { p.clear(hx + hw - 2, hy - 1); p.rect(hx, hy, hw - 2, 1, h.d); }
    if (s === 'mohawk') { p.rect(hx + 2, hy - 3, 5, 3, h.b); p.hline(hx + 2, hx + 6, hy - 3, h.l); p.rect(hx, hy + 2, 4, 3, ramp(L.skin, 0.95)); }
    if (s === 'spiky') for (let x = hx; x < hx + hw - 1; x += 2) p.set(x, hy - 2, h.l);
    if (s === 'curly') { p.rect(hx - 1, hy - 2, hw, 3, h.b); p.rect(hx - 1, hy, 5, 6, h.b); for (let k = 0; k < 6; k++) p.set(hx - 1 + (k * 3) % 8, hy - 2 + (k % 3), h.l); }
    if (s === 'ponytail') { p.rect(hx - 2, hy + 3, 2, 5, h.b); p.set(hx - 2, hy + 7, h.d); }
    if (s === 'bun') p.blob(hx + 0.5, hy - 1, 2, 2, h.b);
    if (s === 'long') p.rect(hx - 1, hy + 3, 1, 7, h.d);
  }
  headgearFront(p, L, hx, hy, hw, true);
  p.outline(undefined, false, true);
  return p;
}

// ---------------- portrait bust (32x32) ----------------
export type Expr = 'happy' | 'neutral' | 'sad' | 'angry' | 'hurt';
export function portraitBust(L: Look, expr: Expr = 'neutral'): Pix {
  const p = new Pix(32, 32);
  const skin = shade(L.skin), hair = shade(L.hair);
  // shoulders & clothing
  const tc = torsoColors(L);
  const t = shade(tc);
  const sw = L.body === 2 || armored(L) ? 26 : L.body === 0 || L.female ? 20 : 23;
  const sx = 16 - sw / 2;
  p.poly([[sx + 3, 24], [sx + sw - 3, 24], [sx + sw, 29], [sx + sw, 32], [sx, 32], [sx, 29]], t.b);
  p.line(sx + 3, 24, sx, 29, t.l); p.line(sx + sw - 3, 24, sx + sw, 29, t.d);
  for (let x = Math.round(sx); x < sx + sw; x++) p.set(x, 31, t.dd);
  // neckline
  p.rect(13, 21, 6, 4, skin.d); p.hline(13, 18, 21, skin.dd);
  if (L.outer?.style === 'parka') { p.rect(Math.round(sx) + 2, 23, sw - 4, 3, C('#ece6da')); for (let x = Math.round(sx) + 2; x < sx + sw - 2; x += 2) p.set(x, 25, C('#d0c8ba')); }
  else if (L.outer?.style === 'armor' || L.outer?.style === 'plate') {
    const o = shade(L.outer.col);
    p.rect(Math.round(sx), 25, 7, 4, o.l); p.rect(Math.round(sx + sw) - 7, 25, 7, 4, o.d);
    p.rect(12, 24, 8, 3, o.dd); if (L.outer.style === 'armor') { p.set(15, 27, C('#7fd0ff')); p.set(16, 27, C('#bfe8ff')); }
  } else if (L.outer || L.mid?.style === 'jacket') {
    const c = shade(L.outer?.col || L.mid!.col);
    p.poly([[12, 24], [16, 30], [20, 24], [19, 24], [16, 28], [13, 24]], c.dd);
    p.poly([[13, 24], [16, 28], [19, 24]], L.shirt || skin.d);
  } else if (L.shirt) {
    if (L.buttons) { p.poly([[13, 24], [16, 27], [19, 24]], C('#f0ece0')); p.vline(16, 27, 31, ramp(L.shirt, 0.72)); p.set(16, 29, C('#e8e4d8')); }
    else p.poly([[13, 24], [16, 26], [19, 24]], skin.d);
  }
  if (L.mid?.style === 'vest' && !L.outer) { const m = shade(L.mid.col); p.rect(Math.round(sx) + 2, 26, 5, 5, m.b); p.rect(Math.round(sx + sw) - 7, 26, 5, 5, m.d); p.rect(Math.round(sx) + 3, 27, 3, 2, m.dd); }
  if (L.fringe) for (let x = Math.round(sx); x < sx + sw; x += 2) p.set(x, 30, L.fringe);
  // head
  const hx = 8, hy = 5, hw = 16, hh = 16;
  p.ellipse(hx + hw / 2 - 0.5, hy + hh / 2, hw / 2, hh / 2, (x, y, nx, ny) => {
    const l = -nx * 0.55 - ny * 0.35;
    return l > 0.42 ? skin.l : l < -0.5 ? skin.d : skin.b;
  });
  // jaw shading + ears
  p.hline(hx + 5, hx + hw - 6, hy + hh - 1, skin.d);
  p.blob(hx - 0.5, hy + 9, 1.5, 2, skin.b); p.blob(hx + hw - 0.5, hy + 9, 1.5, 2, skin.d);
  p.set(hx - 1, hy + 9, skin.d);
  // eyes
  const ey = hy + 8;
  const eyeRow = (ex: number, left: boolean) => {
    const closed = expr === 'hurt';
    if (closed) { p.hline(ex, ex + 2, ey + 1, INK); return; }
    p.rect(ex, ey, 3, 2, C('#f4f0ec'));
    p.set(ex + (left ? 1 : 1), ey, L.eye); p.set(ex + (left ? 1 : 1), ey + 1, ramp(L.eye, 0.7));
    p.set(ex + (left ? 2 : 0), ey + 1, INK);
    p.set(ex + 1, ey, ramp(L.eye, 1.3));
    p.hline(ex, ex + 2, ey - 1, INK); // upper lid
  };
  eyeRow(hx + 3, true); eyeRow(hx + hw - 6, false);
  // brows
  const brow = hair.dd;
  const b1 = hx + 3, b2 = hx + hw - 6, by = ey - 3;
  if (expr === 'angry') { p.line(b1, by, b1 + 3, by + 1, brow); p.line(b2 - 1, by + 1, b2 + 2, by, brow); }
  else if (expr === 'sad' || expr === 'hurt') { p.line(b1, by + 1, b1 + 3, by, brow); p.line(b2 - 1, by, b2 + 2, by + 1, brow); }
  else { p.hline(b1, b1 + 2, by, brow); p.hline(b2, b2 + 2, by, brow); if (expr === 'happy') { p.set(b1 - 1, by + 1, brow); p.set(b2 + 3, by + 1, brow); } }
  // nose
  p.set(hx + 7, ey + 3, skin.d); p.set(hx + 8, ey + 3, skin.dd); p.set(hx + 7, ey + 2, skin.l);
  // mouth
  const my = ey + 5, mx = hx + 6;
  const lip = mix(ramp(L.skin, 0.55), C('#a03c3c'), 0.45);
  if (L.beard) {
    for (let y = ey + 3; y < hy + hh; y++) for (let x = hx + 2; x < hx + hw - 2; x++) {
      const inFace = p.opaque(x, y);
      if (!inFace) continue;
      if (y < ey + 5 && (x < hx + 4 || x > hx + hw - 5)) continue;
      p.set(x, y, (x + y) % 3 === 0 ? hair.d : hair.b);
    }
    p.hline(mx, mx + 3, my, ramp(L.skin, 0.5));
  } else if (expr === 'happy') { p.hline(mx, mx + 3, my, C('#f4f0ea')); p.hline(mx, mx + 3, my + 1, lip); p.set(mx - 1, my, lip); p.set(mx + 4, my, lip); p.set(mx - 1, my - 1, ramp(lip, 0.9)); p.set(mx + 4, my - 1, ramp(lip, 0.9)); }
  else if (expr === 'sad') { p.hline(mx, mx + 3, my, lip); p.set(mx - 1, my + 1, lip); p.set(mx + 4, my + 1, lip); p.set(hx + 4, ey + 2, C('#9fd0ff')); }
  else if (expr === 'angry' || expr === 'hurt') { p.hline(mx, mx + 3, my, ramp(lip, 0.8)); p.hline(mx + 1, mx + 2, my + 1, INK); }
  else p.hline(mx, mx + 3, my, lip);
  if (L.female && !L.beard) { p.set(hx + 2, ey + 3, mix(L.skin, C('#e87878'), 0.35)); p.set(hx + hw - 3, ey + 3, mix(L.skin, C('#e87878'), 0.35)); p.hline(hx + 3, hx + 5, ey - 1, INK); p.set(hx + 2, ey - 1, INK); p.set(hx + hw - 3, ey - 1, INK); }
  if (L.freckles) for (const [x, y] of [[hx + 3, ey + 3], [hx + 5, ey + 4], [hx + hw - 5, ey + 3], [hx + hw - 7, ey + 4]] as [number, number][]) p.set(x, y, ramp(L.skin, 0.78));
  if (L.old) { p.set(hx + 2, ey + 1, skin.d); p.set(hx + hw - 3, ey + 1, skin.d); p.hline(hx + 5, hx + 7, hy + 3, skin.d); p.set(mx - 1, my + 2, skin.d); p.set(mx + 4, my + 2, skin.d); }
  // hair
  bustHair(p, L, hx, hy, hw, hh);
  bustHeadgear(p, L, hx, hy, hw);
  p.outline(undefined, false, true);
  return p;
}

function bustHair(p: Pix, L: Look, hx: number, hy: number, hw: number, hh: number) {
  const s = L.hairStyle, h = shade(L.hair);
  if (s === 'bald') { p.set(hx + 4, hy + 2, ramp(L.skin, 1.2)); p.set(hx + 5, hy + 2, ramp(L.skin, 1.2)); p.set(hx + 5, hy + 3, ramp(L.skin, 1.1)); return; }
  const cx = hx + hw / 2 - 0.5, cy = hy + hh / 2;
  // stylised strands: light sheen on the upper left, darker strand lines and edges
  const tone = (x: number, y: number) => {
    const nx = (x - cx) / (hw / 2), ny = (y - cy) / (hh / 2);
    if (nx < -0.1 && ny < -0.55 && nx > -0.75) return h.l;
    if ((x * 2 + (y >> 1)) % 5 === 0) return h.d;
    if (nx > 0.62 || ny > 0.5) return h.d;
    return h.b;
  };
  const fill = (x0: number, y0: number, x1: number, y1: number, pred?: (x: number, y: number) => boolean) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!pred || pred(x, y)) p.set(x, y, tone(x, y));
  };
  const skull = (x: number, y: number, pad = 1) => ((x - cx) / (hw / 2 + pad)) ** 2 + ((y - cy) / (hh / 2 + pad)) ** 2 <= 1;
  if (s === 'buzz') { fill(hx, hy - 1, hx + hw - 1, hy + 5, (x, y) => skull(x, y, 0.5) && y < hy + 3 + Math.abs(x - cx) * 0.35); for (let x = hx + 2; x < hx + hw - 2; x += 2) p.set(x, hy + 1, h.d); return; }
  if (s === 'mohawk') { fill(Math.round(cx) - 2, hy - 5, Math.round(cx) + 2, hy + 4, (x, y) => y < hy + 1 || skull(x, y)); for (let y = hy - 5; y < hy + 2; y += 2) p.set(Math.round(cx) - 1, y, h.l); fill(hx, hy + 1, hx + hw - 1, hy + 4, (x, y) => skull(x, y, 0.3) && (x < hx + 2 || x > hx + hw - 3) && y > hy + 2); return; }
  if (s === 'curly') {
    // a ring of curls over the crown and down the sides, never across the face
    fill(hx - 1, hy - 2, hx + hw, hy + 4, (x, y) => skull(x, y, 1.5));
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI + (k / 16) * Math.PI;
      p.blob(cx + Math.cos(a) * (hw / 2 + 0.8), cy - 2 + Math.sin(a) * (hh / 2 + 0.3), 1.8, 1.6, k % 3 ? h.b : h.l);
    }
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) p.blob(cx + side * (hw / 2 + 0.3), hy + 6 + k * 2.5, 1.6, 1.5, k % 2 ? h.d : h.b);
    for (let k = 0; k < 10; k++) p.set(hx + 2 + ((k * 5) % (hw - 4)), hy - 1 + ((k * 3) % 4), h.l);
    return;
  }
  // shared cap with a side part and a fringe
  fill(hx - 1, hy - 2, hx + hw, hy + 6, (x, y) => skull(x, y, 1) && (y < hy + 3 || y < hy + 6 - Math.abs(x - cx) * 0.5 + (x < cx ? 2 : 0) || x < hx + 2 || x > hx + hw - 3));
  p.line(hx + 6, hy - 1, hx + 4, hy + 4, h.d); // part
  if (s === 'spiky') for (let x = hx; x < hx + hw; x += 3) { p.set(x, hy - 3, h.b); p.set(x + 1, hy - 4, h.l); p.set(x + 1, hy - 3, h.b); p.set(x + 2, hy - 3, h.d); }
  if (s === 'long') { fill(hx - 2, hy + 4, hx + 1, hy + 24); fill(hx + hw - 2, hy + 4, hx + hw + 1, hy + 24); for (let y = hy + 8; y < hy + 24; y += 3) { p.set(hx - 1, y, h.l); p.set(hx + hw, y, h.dd); } }
  if (s === 'bob') { fill(hx - 2, hy + 3, hx + 1, hy + 15); fill(hx + hw - 2, hy + 3, hx + hw + 1, hy + 15); p.hline(hx - 2, hx + 1, hy + 15, h.dd); p.hline(hx + hw - 2, hx + hw + 1, hy + 15, h.dd); }
  if (s === 'bun') { p.blob(cx, hy - 3, 4, 3, h.b); p.line(cx - 2, hy - 4, cx + 1, hy - 5, h.l); p.hline(Math.round(cx) - 2, Math.round(cx) + 2, hy - 1, h.dd); }
  if (s === 'ponytail') { fill(hx + hw, hy + 4, hx + hw + 2, hy + 18); p.rect(hx + hw, hy + 4, 3, 1, C('#c04848')); }
  if (s === 'short') { fill(hx - 1, hy + 3, hx + 1, hy + 9); fill(hx + hw - 2, hy + 3, hx + hw, hy + 9); }
}

function bustHeadgear(p: Pix, L: Look, hx: number, hy: number, hw: number) {
  if (!L.head) return;
  const s = shade(L.head.col);
  const cx = hx + hw / 2 - 0.5;
  switch (L.head.style) {
    case 'helmet': p.ellipse(cx, hy + 4, hw / 2 + 1.5, 6, (x, y, nx, ny) => (y > hy + 5 ? null : ny < -0.5 ? s.l : nx > 0.5 ? s.d : s.b)); p.hline(hx - 1, hx + hw, hy + 5, s.dd); break;
    case 'marinehelmet':
      p.ellipse(cx, hy + 9, hw / 2 + 2, 11, (x, y, nx, ny) => (ny < -0.6 ? s.l : nx > 0.6 ? s.d : s.b));
      p.rect(hx + 2, hy + 7, hw - 4, 5, C('#1a2432')); p.hline(hx + 2, hx + hw - 3, hy + 7, C('#7fc4ff')); p.hline(hx + 3, hx + 6, hy + 8, C('#bfe8ff'));
      p.rect(hx + 3, hy + 14, hw - 6, 3, s.d); for (let x = hx + 4; x < hx + hw - 4; x += 2) p.set(x, hy + 15, s.dd);
      break;
    case 'cowboyhat':
      p.ellipse(cx, hy + 3, hw / 2 + 5, 2.2, s.d); p.ellipse(cx, hy + 2.5, hw / 2 + 4, 1.6, s.b);
      p.rect(hx + 3, hy - 5, hw - 6, 7, s.b); p.hline(hx + 4, hx + hw - 5, hy - 5, s.l); p.set(Math.round(cx), hy - 5, s.d); p.hline(hx + 3, hx + hw - 4, hy + 1, C('#3a2a1a'));
      break;
    case 'tuque':
      p.ellipse(cx, hy + 3, hw / 2 + 1, 6, (x, y, nx, ny) => (y > hy + 4 ? null : ny < -0.4 ? s.l : s.b));
      p.rect(hx - 1, hy + 3, hw + 2, 3, s.d); for (let x = hx - 1; x < hx + hw + 1; x += 2) p.set(x, hy + 4, s.dd);
      p.blob(cx, hy - 3, 2.4, 2.2, C('#f0ece4'));
      break;
  }
}
