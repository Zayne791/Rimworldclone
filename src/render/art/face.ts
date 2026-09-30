// Close-up talking head for face-to-face conversations: a 48x52 bust with far more facial detail
// than the map portrait. Animated by mouth shape (lip-sync while speaking), blinking and a range of
// emotions (brows, eyelids, mouth, blush, tears, sweat, anger marks). Built from the same Look as
// the map sprites, so clothes, hair and headgear match what the colonist is wearing.
import { Pix, C, ramp, mix, type RGBA } from '../pixel';
import { type Look, INK, shade, torsoColors, armored } from './people';

export type FaceExpr = 'neutral' | 'happy' | 'excited' | 'sad' | 'angry' | 'annoyed' | 'scared' | 'thinking' | 'surprised' | 'embarrassed' | 'hurt';
export const FACE_W = 48, FACE_H = 52;
const CX = 23.5, CY = 21, RX = 11.5, RY = 13;

/** head silhouette: an egg that narrows toward the chin */
function inHead(x: number, y: number, pad = 0): boolean {
  const v = (y + 0.5 - CY) / (RY + pad);
  let rx = RX + pad;
  if (v > 0) rx *= 1 - 0.3 * Math.pow(v, 1.6);
  const u = (x + 0.5 - CX) / rx;
  return u * u + v * v <= 1;
}
const U = (x: number) => (x + 0.5 - CX) / RX;

export function talkFace(L: Look, expr: FaceExpr = 'neutral', mouth = 0, blink = 0): Pix {
  const p = new Pix(FACE_W, FACE_H);
  const skin = shade(L.skin), hair = shade(L.hair);
  backHair(p, L, hair);
  body(p, L, skin);
  // neck, with the jaw's shadow falling on it
  p.rect(19, 30, 10, 11, skin.b);
  p.vline(27, 30, 40, skin.d); p.vline(28, 30, 40, skin.d);
  p.hline(19, 28, 33, skin.d); p.hline(20, 27, 34, skin.d);
  // ears
  p.blob(11.6, 22, 1.8, 3.2, skin.b, false); p.set(11, 21, skin.d); p.set(11, 22, skin.dd); p.set(11, 23, skin.d);
  p.blob(35.4, 22, 1.8, 3.2, skin.d, false); p.set(36, 21, skin.dd); p.set(36, 22, skin.dd);
  // head, lit from the upper left
  for (let y = 0; y < FACE_H; y++) for (let x = 0; x < FACE_W; x++) {
    if (!inHead(x, y)) continue;
    const nx = (x + 0.5 - CX) / RX, ny = (y + 0.5 - CY) / RY;
    const l = -nx * 0.55 - ny * 0.3;
    p.set(x, y, l > 0.5 ? skin.l : l < -0.42 || nx > 0.82 ? skin.d : skin.b);
  }
  for (let x = 17; x <= 30; x++) if (inHead(x, 33) && !inHead(x, 34)) p.set(x, 33, skin.d); // under the chin
  face(p, L, expr, mouth, blink, skin, hair);
  frontHair(p, L, hair);
  headgear(p, L);
  extras(p, L, expr);
  p.outline(undefined, false, true);
  return p;
}

// ---------------- body ----------------
function body(p: Pix, L: Look, skin: ReturnType<typeof shade>) {
  const tc = torsoColors(L), t = shade(tc);
  const bulky = L.body === 2 || armored(L);
  const hw = bulky ? 21 : L.body === 0 || L.female ? 16 : 18.5;
  p.poly([[CX - 7, 37], [CX + 7, 37], [CX + hw, 44], [CX + hw, 52], [CX - hw, 52], [CX - hw, 44]], t.b);
  // light from the left, shadow on the right, folds
  for (let y = 38; y < 52; y++) for (let x = 0; x < FACE_W; x++) {
    if (!p.opaque(x, y) || y < 37) continue;
    const c = p.get(x, y); if (!c || c[0] !== t.b[0] || c[1] !== t.b[1] || c[2] !== t.b[2]) continue;
    const u = (x + 0.5 - CX) / hw;
    if (u < -0.72) p.set(x, y, t.l); else if (u > 0.7) p.set(x, y, t.d);
  }
  p.line(CX - 7, 37, CX - hw, 44, t.l); p.line(CX + 7, 37, CX + hw, 44, t.dd);
  p.line(CX - 9, 46, CX - 10, 51, t.d); p.line(CX + 10, 46, CX + 11, 51, t.dd);
  const o = L.outer, m = L.mid;
  if (o?.style === 'parka') {
    for (let x = Math.round(CX - 11); x <= CX + 11; x++) for (let y = 36; y <= 41; y++) if (Math.abs(x - CX) / 11 + Math.abs(y - 38.5) / 3.2 < 1.25) p.set(x, y, (x + y) % 3 ? C('#ece6da') : C('#d0c8ba'));
    p.vline(Math.round(CX), 42, 51, t.dd);
  } else if (o && armored(L)) {
    const s = shade(o.col);
    p.rect(Math.round(CX - hw), 42, 9, 6, s.l); p.rect(Math.round(CX + hw) - 9, 42, 9, 6, s.d);
    p.hline(Math.round(CX - hw), Math.round(CX - hw) + 8, 47, s.dd); p.hline(Math.round(CX + hw) - 9, Math.round(CX + hw) - 1, 47, s.dd);
    p.rect(16, 39, 16, 6, s.dd); p.rect(17, 40, 14, 4, s.d);
    if (o.style === 'armor') { p.hline(21, 26, 42, C('#7fd0ff')); p.hline(22, 25, 41, C('#bfe8ff')); }
    else for (let x = 18; x < 30; x += 3) p.set(x, 41, s.l);
  } else if (o || m?.style === 'jacket') {
    const c = shade(o?.col || m!.col);
    p.poly([[CX - 7, 37], [CX, 48], [CX + 7, 37], [CX + 5, 37], [CX, 45], [CX - 5, 37]], c.dd);
    p.poly([[CX - 5, 37], [CX, 45], [CX + 5, 37]], L.shirt || skin.d);
    p.set(Math.round(CX) + 4, 47, c.l); p.set(Math.round(CX) + 4, 50, c.l);
  } else if (L.shirt) {
    if (L.buttons) {
      p.poly([[CX - 6, 37], [CX, 42], [CX + 6, 37]], C('#f0ece0'));
      p.vline(Math.round(CX), 42, 51, ramp(L.shirt, 0.72));
      for (const y of [44, 47, 50]) p.set(Math.round(CX) + 1, y, C('#e8e4d8'));
    } else { p.poly([[CX - 5, 37], [CX, 40], [CX + 5, 37]], skin.d); p.line(CX - 5, 37, CX, 40, ramp(L.shirt, 0.8)); p.line(CX, 40, CX + 5, 37, ramp(L.shirt, 0.8)); }
  }
  if (m?.style === 'vest' && !o) { const v = shade(m.col); p.rect(Math.round(CX - hw) + 3, 43, 8, 9, v.b); p.rect(Math.round(CX + hw) - 11, 43, 8, 9, v.d); }
  if (L.fringe) for (let x = Math.round(CX - hw); x < CX + hw; x += 2) { p.set(x, 49, L.fringe); p.set(x + 1, 50, L.fringe); }
  if (L.shield) for (let x = 2; x < 46; x += 3) p.set(x, 51 - (x % 2), C('#7fd0ff'));
}

// ---------------- face ----------------
const EYE_Y = 19;
function face(p: Pix, L: Look, e: FaceExpr, mouth: number, blink: number, skin: ReturnType<typeof shade>, hair: ReturnType<typeof shade>) {
  const white = C('#f6f2ee');
  const big = e === 'surprised' || e === 'scared';
  const look = e === 'thinking' ? -1 : 0;
  const lidDrop = e === 'annoyed' ? 1 : 0;
  const shut = blink >= 2 || e === 'hurt';
  const half = blink === 1 || e === 'annoyed';
  const eye = (ex: number, left: boolean) => {
    const ey = EYE_Y - (big ? 1 : 0);
    const h = big ? 5 : 4;
    if (shut) {
      // closed: a soft arc (a tight squeeze when hurting)
      if (e === 'hurt') { p.line(ex, ey + 1, ex + 4, ey + 2, INK); p.line(ex, ey + 3, ex + 4, ey + 2, INK); return; }
      p.hline(ex, ex + 4, ey + 2, INK); p.set(ex - (left ? 1 : 0), ey + 3, INK); p.set(ex + 4 + (left ? 0 : 1), ey + 3, INK);
      p.hline(ex + 1, ex + 3, ey + 3, skin.d);
      return;
    }
    if (e === 'excited') {
      // beaming: upturned crescent eyes
      p.hline(ex + 1, ex + 3, ey + 1, INK); p.set(ex, ey + 2, INK); p.set(ex + 4, ey + 2, INK);
      return;
    }
    p.rect(ex, ey + 1, 5, h - 1, white);
    // iris & pupil
    const ix = ex + 1 + look, iy = ey + (big ? 2 : 1);
    const irisH = big ? 2 : 3;
    for (let yy = 0; yy < irisH; yy++) for (let xx = 0; xx < 3; xx++) p.set(ix + xx, iy + yy, yy === 0 ? ramp(L.eye, 0.72) : yy === irisH - 1 ? ramp(L.eye, 1.25) : L.eye);
    p.set(ix + 1, iy + (big ? 0 : 1), INK); if (!big) p.set(ix + 1, iy + 2, ramp(L.eye, 0.8));
    p.set(ix, iy, C('#ffffff'));
    // lids
    p.hline(ex, ex + 4, ey, INK);
    if (half) { p.hline(ex, ex + 4, ey + 1, skin.d); p.hline(ex, ex + 4, ey + 1 + lidDrop, INK); p.hline(ex, ex + 4, ey, skin.b); }
    if (e === 'angry') { const inner = left ? ex + 4 : ex; p.set(inner, ey + 1, INK); p.set(left ? inner - 1 : inner + 1, ey + 1, INK); p.set(inner, ey, skin.b); }
    if (e === 'sad') { const outer = left ? ex : ex + 4; p.set(outer, ey + 1, INK); p.set(outer, ey, skin.b); }
    if (e === 'happy') p.hline(ex + 1, ex + 3, ey + h, skin.d); // smiling cheeks push the lower lid up
    else p.hline(ex + 1, ex + 3, ey + h, ramp(L.skin, 0.9));
    if (L.female) { const o = left ? ex - 1 : ex + 5; p.set(o, ey, INK); p.set(left ? o - 1 : o + 1, ey - 1, INK); }
  };
  eye(15, true); eye(28, false);
  // brows: per-column height offsets from the outer end to the inner end
  const BROWS: Record<FaceExpr, number[]> = {
    neutral: [0, 0, 0, 0, 0, 0], happy: [0, -1, -1, -1, -1, 0], excited: [-1, -2, -2, -2, -2, -1], sad: [1, 1, 0, 0, -1, -2], hurt: [1, 1, 0, 0, -1, -2],
    angry: [-2, -1, 0, 1, 2, 2], annoyed: [0, 0, 1, 1, 1, 1], scared: [0, 0, -1, -1, -2, -3], thinking: [0, -1, -1, 0, 0, 0], surprised: [-1, -3, -3, -3, -3, -2], embarrassed: [0, 0, 0, -1, -1, -1],
  };
  const brow = ramp(L.hair, 0.55), browL = ramp(L.hair, 0.8);
  const by = EYE_Y - 3;
  const offs = BROWS[e] || BROWS.neutral;
  for (let k = 0; k < 6; k++) {
    // left brow runs outer (x 14) → inner (x 19); right brow mirrored
    const dyL = offs[k], dyR = e === 'thinking' ? 1 : offs[k];
    const xl = 14 + k, xr = 33 - k;
    p.set(xl, by + dyL, brow); if (k > 0 && k < 5) p.set(xl, by + dyL + 1, browL);
    p.set(xr, by + dyR, brow); if (k > 0 && k < 5) p.set(xr, by + dyR + 1, browL);
  }
  // nose
  p.set(23, 23, skin.l); p.set(23, 24, skin.l); p.set(24, 24, skin.d); p.set(24, 25, skin.d);
  p.set(22, 26, skin.dd); p.set(23, 26, skin.d); p.set(25, 26, skin.dd);
  // cheeks
  const blushAmt = e === 'embarrassed' ? 0.55 : e === 'excited' ? 0.42 : e === 'happy' ? 0.3 : L.female ? 0.2 : 0;
  if (blushAmt) {
    const b = mix(L.skin, C('#ff6a6a'), blushAmt);
    for (const cx of [15, 29]) { p.hline(cx, cx + 3, 25, b); p.hline(cx + 1, cx + 2, 26, b); }
    if (e === 'embarrassed') for (const cx of [15, 29]) { p.set(cx, 25, ramp(b, 0.85)); p.set(cx + 2, 25, ramp(b, 0.85)); }
  }
  if (L.freckles) for (const [x, y] of [[16, 24], [18, 25], [17, 26], [30, 24], [28, 25], [31, 26], [21, 24], [26, 24]] as [number, number][]) p.set(x, y, ramp(L.skin, 0.76));
  if (L.old) {
    p.hline(20, 23, 12, skin.d); p.hline(25, 27, 12, skin.d); p.hline(21, 26, 14, mix(skin.b, skin.d, 0.6));
    p.set(13, 20, skin.d); p.set(13, 21, skin.d); p.set(34, 20, skin.dd); p.set(34, 21, skin.dd);
    p.set(19, 27, skin.d); p.set(19, 28, skin.d); p.set(28, 27, skin.dd); p.set(28, 28, skin.dd);
  }
  if (L.beard) beard(p, L, hair);
  drawMouth(p, L, e, mouth, skin);
}

function beard(p: Pix, L: Look, hair: ReturnType<typeof shade>) {
  for (let y = 22; y < 37; y++) for (let x = 10; x < 38; x++) {
    if (!inHead(x, y, 0.6)) continue;
    const u = U(x);
    const side = Math.abs(u) > 0.8 && y < 27;
    if (!(y >= 27 || side)) continue;
    if (y >= 27 && y < 30 && Math.abs(u) < 0.62 && !(y === 27 && Math.abs(u) < 0.5)) {
      // moustache band, leaving the mouth free
      if (y === 28) { p.set(x, y, (x & 1) ? hair.d : hair.b); continue; }
      continue;
    }
    p.set(x, y, (x * 3 + y) % 5 === 0 ? hair.d : (x + y * 2) % 7 === 0 ? hair.l : hair.b);
  }
  for (let x = 19; x <= 28; x++) p.set(x, 27, x > 20 && x < 27 ? hair.b : hair.d);
}

const LIP = (L: Look) => mix(ramp(L.skin, 0.6), C('#b04848'), L.female ? 0.6 : 0.35);
function drawMouth(p: Pix, L: Look, e: FaceExpr, open: number, skin: ReturnType<typeof shade>) {
  const lip = LIP(L), dark = C('#3a1820'), teeth = C('#f4f0ea'), tongue = C('#d06070');
  const my = 30;
  if (!open) {
    switch (e) {
      case 'happy': case 'excited':
        p.hline(21, 26, my + 1, lip); p.set(20, my, lip); p.set(27, my, lip); p.set(19, my - 1, ramp(lip, 0.9)); p.set(28, my - 1, ramp(lip, 0.9));
        if (e === 'excited') { p.hline(21, 26, my, dark); p.hline(22, 25, my, teeth); }
        break;
      case 'sad': case 'hurt': p.hline(21, 26, my, lip); p.set(20, my + 1, lip); p.set(27, my + 1, lip); break;
      case 'angry': p.hline(20, 27, my + 1, ramp(lip, 0.75)); p.set(19, my + 2, ramp(lip, 0.75)); p.set(28, my + 2, ramp(lip, 0.75)); break;
      case 'annoyed': p.hline(21, 25, my, lip); p.set(26, my - 1, lip); break;
      case 'scared': case 'embarrassed': for (let x = 20; x <= 27; x++) p.set(x, my + ((x & 1) ? 0 : 1), lip); break;
      case 'surprised': p.rect(22, my - 1, 4, 3, dark); p.hline(22, 25, my - 2, lip); p.hline(22, 25, my + 2, lip); p.set(21, my, lip); p.set(26, my, lip); break;
      case 'thinking': p.hline(22, 25, my, lip); p.set(26, my - 1, lip); p.set(21, my + 1, ramp(lip, 0.85)); break;
      default: p.hline(21, 26, my, lip); p.hline(22, 25, my + 1, skin.d);
    }
    return;
  }
  // talking: open by the syllable (1 small, 2 open, 3 wide), shaped by the mood
  const wide = e === 'happy' || e === 'excited' ? 1 : e === 'sad' || e === 'scared' ? -1 : 0;
  const hgt = [0, 2, 3, 5][Math.min(3, open)];
  const w = (e === 'surprised' ? 4 : 6) + wide * 2 - (open === 1 ? 1 : 0);
  const x0 = Math.round(CX - w / 2), x1 = x0 + w - 1;
  const y0 = my - (open >= 3 ? 1 : 0);
  for (let y = y0; y < y0 + hgt; y++) {
    const inset = (y === y0 && e !== 'happy' && e !== 'excited') || y === y0 + hgt - 1 ? 1 : 0;
    const extra = (e === 'happy' || e === 'excited') && y === y0 + hgt - 1 ? 1 : 0;
    p.hline(x0 + inset + extra, x1 - inset - extra, y, dark);
  }
  if (hgt >= 3) p.hline(x0 + 1, x1 - 1, y0, teeth);
  if (e === 'angry' && hgt >= 3) p.hline(x0 + 1, x1 - 1, y0 + hgt - 1, teeth);
  else if (hgt >= 3) p.hline(x0 + 2, x1 - 2, y0 + hgt - 1, tongue);
  p.hline(x0, x1, y0 - 1, lip);
  p.hline(x0 + 1, x1 - 1, y0 + hgt, ramp(lip, 1.1));
  if (e === 'happy' || e === 'excited') { p.set(x0 - 1, y0 - 2, lip); p.set(x1 + 1, y0 - 2, lip); }
  if (e === 'sad' || e === 'angry') { p.set(x0 - 1, y0 + 1, lip); p.set(x1 + 1, y0 + 1, lip); }
}

// ---------------- hair ----------------
type Sh = ReturnType<typeof shade>;
function hairTone(h: Sh, x: number, y: number): RGBA {
  const u = U(x), v = (y + 0.5 - CY) / RY;
  if (u > -0.78 && u < -0.12 && v > -1.08 && v < -0.74 && (x + y) % 4 !== 0) return h.l;
  if ((x * 2 + (y >> 1)) % 6 === 0) return h.d;
  if (u > 0.68 || v > 0.25) return h.d;
  return h.b;
}
function fill(p: Pix, h: Sh, pred: (x: number, y: number) => boolean, y0 = 0, y1 = FACE_H - 1) {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < FACE_W; x++) if (pred(x, y)) p.set(x, y, hairTone(h, x, y));
}
/** where the hair ends on the forehead: a side-swept fringe, down to the ears at the temples */
function hairline(x: number, style: string): number {
  const u = U(x), a = Math.abs(u);
  if (a > 0.84) return style === 'buzz' ? 17 : 21;
  if (a > 0.7) return 16;
  if (style === 'bob') return 14.6;
  if (style === 'ponytail' || style === 'bun') return 11.8 + a * 2;
  if (style === 'buzz') return 11.5 + a * 3;
  return 12.3 + 2.6 * Math.max(0, 1 - Math.abs(u - 0.25) * 1.7);
}
function backHair(p: Pix, L: Look, h: Sh) {
  const s = L.hairStyle;
  if (s === 'long') fill(p, h, (x, y) => (x >= 8 && x <= 14 || x >= 33 && x <= 39) && y >= 14 && y <= 44 - Math.abs(x - (x < 24 ? 11 : 36)) && inHeadBand(x, y));
  if (s === 'bob') fill(p, h, (x, y) => (x >= 9 && x <= 14 || x >= 33 && x <= 38) && y >= 12 && y <= 33);
  if (s === 'ponytail') { fill(p, h, (x, y) => x >= 34 && x <= 38 && y >= 14 && y <= 42 - (x - 34) * 2); p.rect(34, 15, 4, 2, C('#c04848')); }
  if (s === 'curly') {
    fill(p, h, (x, y) => y < 31 && inHead(x, y + 2, 4.2));
  }
}
const inHeadBand = (x: number, y: number) => y < 48;
function frontHair(p: Pix, L: Look, h: Sh) {
  const s = L.hairStyle;
  if (s === 'bald') { p.blob(19, 11, 2.2, 1.4, ramp(L.skin, 1.18), false); return; }
  if (s === 'mohawk') {
    for (let y = 7; y < 17; y++) for (let x = 11; x < 37; x++) if (inHead(x, y, 0.5) && Math.abs(U(x)) > 0.28 && y < 15 && (x * 5 + y * 3) % 7 === 0) p.set(x, y, mix(L.skin, L.hair, 0.3));
    fill(p, h, (x, y) => Math.abs(x + 0.5 - CX) <= 2.6 - Math.max(0, 6 - y) * 0.25 && y >= 1 && (y < 12 || inHead(x, y, 0.8)) && y < 14);
    for (let y = 2; y < 11; y += 2) p.set(22, y, h.l);
    return;
  }
  if (s === 'curly') {
    fill(p, h, (x, y) => inHead(x, y, 1.6) && y < hairline(x, s) - 0.5);
    for (let k = 0; k <= 22; k++) {
      const a = Math.PI + (k / 22) * Math.PI;
      p.blob(CX + Math.cos(a) * (RX + 2.2), CY - 3 + Math.sin(a) * (RY + 1.4), 2.4, 2.1, k % 3 ? h.b : h.l);
    }
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) p.blob(CX + side * (RX + 1.6), 12 + k * 3, 2.2, 1.9, k % 2 ? h.d : h.b);
    for (let x = 14; x < 34; x += 3) p.blob(x, hairline(x, s) - 1, 1.7, 1.3, (x & 1) ? h.b : h.l);
    return;
  }
  fill(p, h, (x, y) => inHead(x, y, 1.4) && y < hairline(x, s) + ((s === 'spiky' && (x % 3 === 0)) ? 1 : 0));
  if (s !== 'buzz') { p.line(18, 8, 16, 13, h.dd); p.line(19, 8, 18, 11, h.d); }
  else for (let y = 8; y < 16; y++) for (let x = 10; x < 38; x++) if (p.opaque(x, y) && inHead(x, y, 1.4) && y < hairline(x, s) && (x + y * 3) % 4 === 0) p.set(x, y, mix(L.skin, L.hair, 0.6));
  if (s === 'spiky') for (let x = 12; x <= 34; x += 3) { p.set(x, 7, h.b); p.set(x + 1, 6, h.l); p.set(x + 1, 5, h.l); p.set(x + 1, 7, h.b); p.set(x + 2, 7, h.d); p.set(x + 1, 4, h.b); }
  if (s === 'long') { fill(p, h, (x, y) => (x >= 9 && x <= 13 || x >= 34 && x <= 38) && y >= 12 && y <= 46 - Math.abs(x - (x < 24 ? 11 : 36))); for (let y = 16; y < 44; y += 3) { p.set(10, y, h.l); p.set(37, y, h.dd); } }
  if (s === 'bob') { fill(p, h, (x, y) => (x >= 9 && x <= 13 || x >= 34 && x <= 38) && y >= 12 && y <= 32); p.hline(9, 13, 33, h.dd); p.hline(34, 38, 33, h.dd); for (let x = 14; x < 34; x += 2) p.set(x, 14, h.d); }
  if (s === 'bun') { p.blob(CX, 5, 4.6, 3.6, h.b); p.line(CX - 3, 4, CX + 1, 2, h.l); p.hline(20, 27, 8, C('#c04848')); }
  if (s === 'ponytail') p.hline(33, 36, 14, h.dd);
  if (s === 'short') { fill(p, h, (x, y) => (x >= 10 && x <= 12 || x >= 35 && x <= 37) && y >= 14 && y <= 22 && inHead(x, y, 1.6)); }
}

// ---------------- headgear ----------------
function headgear(p: Pix, L: Look) {
  if (!L.head) return;
  const s = shade(L.head.col);
  switch (L.head.style) {
    case 'helmet':
      for (let y = 3; y <= 13; y++) for (let x = 8; x < 40; x++) if (inHead(x, y, 2.2)) p.set(x, y, y < 7 ? s.l : U(x) > 0.55 ? s.d : s.b);
      p.hline(9, 38, 13, s.dd); p.hline(10, 37, 12, s.d); p.vline(24, 4, 11, s.l);
      break;
    case 'marinehelmet':
      for (let y = 2; y <= 38; y++) for (let x = 6; x < 42; x++) {
        if (!inHead(x, y, 3.2)) continue;
        const u = U(x), v = (y + 0.5 - CY) / RY;
        if (Math.abs(u) < 0.8 && v > -0.42 && v < 0.95) continue; // face opening
        p.set(x, y, v < -0.7 ? s.l : u > 0.6 ? s.d : s.b);
      }
      p.rect(13, 11, 22, 3, C('#1a2432')); p.hline(13, 34, 11, C('#7fc4ff')); p.hline(15, 20, 12, C('#bfe8ff'));
      for (let y = 26; y < 36; y += 2) { p.set(11, y, s.dd); p.set(36, y, s.dd); }
      break;
    case 'cowboyhat':
      p.ellipse(CX, 12.5, 19, 2.6, s.d); p.ellipse(CX, 11.8, 18, 1.8, s.b);
      for (let y = 1; y <= 11; y++) for (let x = 14; x <= 33; x++) { const r = y < 3 ? Math.abs(x + 0.5 - CX) < 8 - (3 - y) * 2 : true; if (r) p.set(x, y, x < 18 ? s.l : x > 30 ? s.d : s.b); }
      p.set(Math.round(CX), 1, s.d); p.set(Math.round(CX), 2, s.d);
      p.hline(14, 33, 9, C('#3a2a1a')); p.hline(14, 33, 10, C('#4a3824'));
      break;
    case 'tuque':
      for (let y = 3; y <= 13; y++) for (let x = 9; x < 39; x++) if (inHead(x, y, 1.8)) p.set(x, y, (x & 1) ? s.d : y < 6 ? s.l : s.b);
      p.rect(10, 11, 28, 3, s.d); for (let x = 10; x < 38; x += 2) { p.set(x, 12, s.dd); p.set(x, 11, s.b); }
      p.blob(CX, 2.4, 3.2, 2.6, C('#f0ece4'));
      break;
  }
}

// ---------------- emotion marks ----------------
function extras(p: Pix, L: Look, e: FaceExpr) {
  if (e === 'scared' || e === 'embarrassed') {
    const d = C('#9fd8ff');
    p.set(35, 12, d); p.rect(34, 13, 3, 2, d); p.hline(35, 35, 15, d); p.set(34, 13, C('#e8f8ff'));
  }
  if (e === 'angry') {
    const r = C('#e8484a');
    for (const [x, y] of [[33, 9], [34, 10], [36, 10], [37, 9], [33, 13], [34, 12], [36, 12], [37, 13]] as [number, number][]) p.set(x, y, r);
  }
  if (e === 'sad' || e === 'hurt') { const t = C('#9fd0ff'); p.set(15, EYE_Y + 4, t); p.set(15, EYE_Y + 5, t); p.set(15, EYE_Y + 6, C('#cfe8ff')); }
  if (e === 'excited') { const y = C('#fff4a0'); for (const [x, yy] of [[41, 6], [40, 7], [42, 7], [41, 8], [6, 12], [6, 11], [5, 12], [7, 12], [6, 13]] as [number, number][]) p.set(x, yy, y); }
  void L;
}
