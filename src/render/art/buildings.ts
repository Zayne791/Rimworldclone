// Procedural pixel-art buildings. Rot 0 art faces south; other rotations are pixel-exact 90° turns.
import { Pix, C, ramp, mix, addSprite, h2, bayer, type Sprite, type RGBA } from '../pixel';
import { BUILDINGS } from '../../data/buildings';
import { ITEMS } from '../../data/items';
import { TILE } from '../../core/constants';

const METAL = C('#8a939c'), DARKMETAL = C('#4a5058'), WOOD = C('#9a6a3e'), GLOW = C('#ffd27a');

export function stuffColor(stuff?: string): RGBA {
  const s = stuff ? ITEMS[stuff]?.stuff : undefined;
  return C(s?.color || '#8a939c');
}
function stuffKind(stuff?: string): 'wood' | 'stone' | 'metal' | 'fabric' | 'plain' {
  const s = stuff ? ITEMS[stuff]?.stuff : undefined;
  if (!s) return 'metal';
  if (s.cats.includes('woody')) return 'wood';
  if (s.cats.includes('stony')) return 'stone';
  if (s.cats.includes('metallic')) return 'metal';
  if (s.cats.includes('fabric') || s.cats.includes('leathery')) return 'fabric';
  return 'plain';
}

/** box with a top face and a front face of height fh */
function box(p: Pix, x: number, y: number, w: number, h: number, fh: number, top: RGBA, face?: RGBA) {
  const f = face || ramp(top, 0.62);
  p.rect(x, y, w, h - fh, top);
  p.rect(x, y + h - fh, w, fh, f);
  p.hline(x, x + w - 1, y, ramp(top, 1.18));
  p.vline(x, y, y + h - fh - 1, ramp(top, 1.08));
  p.vline(x + w - 1, y, y + h - fh - 1, ramp(top, 0.86));
  p.hline(x, x + w - 1, y + h - fh, ramp(top, 0.8));
  p.hline(x, x + w - 1, y + h - 1, ramp(f, 0.7));
}
function texture(p: Pix, x: number, y: number, w: number, h: number, kind: string, base: RGBA) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!p.opaque(xx, yy)) continue;
    const c = p.get(xx, yy)!;
    let f = 1;
    if (kind === 'wood') { if ((xx - x) % 4 === 3) f = 0.8; else if (h2(xx, yy, 3) > 0.9) f = 0.9; }
    else if (kind === 'stone') { const row = Math.floor((yy - y) / 4); if ((yy - y) % 4 === 3 || (xx - x + (row % 2) * 3) % 6 === 5) f = 0.78; else if ((yy - y) % 4 === 0) f = 1.08; }
    else if (kind === 'metal') { if ((xx - x) % 8 === 7 || (yy - y) % 8 === 7) f = 0.82; if (((xx - x) % 8 === 1) && ((yy - y) % 8 === 1)) f = 1.3; }
    else if (kind === 'fabric') { if ((xx + yy) % 2 === 0) f = 0.94; }
    if (f !== 1) p.set(xx, yy, ramp(c, f));
  }
}
function screen(p: Pix, x: number, y: number, w: number, h: number, col = C('#6fe0ff')) {
  p.rect(x, y, w, h, C('#12202a'));
  for (let yy = y + 1; yy < y + h - 1; yy += 2) p.hline(x + 1, x + w - 2, yy, ramp(col, 0.6 + ((yy * 7) % 5) * 0.08));
  p.set(x + 1, y + 1, col);
}
function legs(p: Pix, x: number, y: number, w: number, h: number, c: RGBA) {
  p.rect(x + 1, y + h - 2, 2, 2, ramp(c, 0.5)); p.rect(x + w - 3, y + h - 2, 2, 2, ramp(c, 0.5));
}

type Draw = (p: Pix, W: number, H: number, st: RGBA, kind: string, state: any) => void;

// Each drawer paints rot-0 art into a W x H pixel canvas where W,H = footprint*16 (+ extraTop rows above)
const DRAW: Record<string, Draw & { extraTop?: number }> = {};
const def = (id: string, d: Draw, extraTop = 0) => { (d as any).extraTop = extraTop; DRAW[id] = d; };

def('column', (p, W, H, st, k) => { box(p, 4, 2, 8, 14, 3, st); texture(p, 4, 2, 8, 12, k, st); p.rect(3, 1, 10, 2, ramp(st, 1.15)); });
def('sandbags', (p, W, H, st, k, s) => { const c = C('#b8a070'); for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) { const x = 1 + q * 5 - r * 2, y = 5 + r * 4; p.blob(x + 2.5, y + 2.5, 3, 2.4, ramp(c, 1 - r * 0.08)); } });
def('barricade', (p, W, H, st, k) => { box(p, 1, 5, 14, 9, 3, st); texture(p, 1, 5, 14, 6, 'stone', st); });
def('spike_trap', (p, W, H, st) => { for (let k = 0; k < 6; k++) { const x = 2 + (k % 3) * 5, y = 3 + Math.floor(k / 3) * 6; p.set(x, y, ramp(st, 1.3)); p.set(x, y + 1, st); p.set(x - 1, y + 2, ramp(st, 0.6)); p.set(x + 1, y + 2, ramp(st, 0.6)); } });
def('turret', (p, W, H, st, k, s) => {
  p.ellipse(8, 11, 6, 4, DARKMETAL); p.ellipse(8, 10, 5, 3.2, METAL);
  p.hline(4, 12, 13, ramp(DARKMETAL, 0.7));
});
def('bedroll', (p, W, H, st) => {
  p.rect(2, 3, 12, 27, st); p.rect(3, 4, 10, 6, C('#f0ece0')); p.hline(2, 13, 11, ramp(st, 0.75));
  texture(p, 2, 12, 12, 18, 'fabric', st);
});
function bed(p: Pix, x0: number, W: number, H: number, st: RGBA, blanket: RGBA, hosp = false) {
  box(p, x0 + 1, 0, W - 2, 32, 3, st);
  p.rect(x0 + 2, 2, W - 4, 7, C('#f4f0e6'));
  p.hline(x0 + 2, x0 + W - 3, 8, C('#c8c2b4'));
  p.rect(x0 + 2, 10, W - 4, 19, blanket);
  p.hline(x0 + 2, x0 + W - 3, 10, ramp(blanket, 1.25));
  for (let y = 13; y < 29; y += 4) p.hline(x0 + 3, x0 + W - 4, y, ramp(blanket, 0.9));
  p.vline(x0 + 2, 10, 28, ramp(blanket, 1.1));
  if (hosp) { p.rect(x0 + W / 2 - 1, 16, 2, 6, C('#d02828')); p.rect(x0 + W / 2 - 3, 18, 6, 2, C('#d02828')); }
}
def('bed', (p, W, H, st) => bed(p, 0, W, H, st, C('#5a7ab0')));
def('bed_double', (p, W, H, st) => { bed(p, 0, W, H, st, C('#8a4a6a')); p.vline(16, 2, 8, C('#b8b2a4')); });
def('bed_hospital', (p, W, H, st) => bed(p, 0, W, H, C('#c8ccd4'), C('#e8f0f4'), true));
def('table', (p, W, H, st, k) => { box(p, 1, 1, W - 2, H - 2, 3, st); texture(p, 2, 2, W - 4, H - 7, k, st); legs(p, 1, 1, W - 2, H - 1, st); });
def('stool', (p, W, H, st, k) => { p.ellipse(8, 8, 4.5, 3.5, st); p.ellipse(8, 7.4, 4, 2.8, ramp(st, 1.15)); p.vline(5, 10, 13, ramp(st, 0.6)); p.vline(11, 10, 13, ramp(st, 0.6)); });
def('chair', (p, W, H, st, k) => { box(p, 3, 2, 10, 4, 2, ramp(st, 0.9)); box(p, 3, 6, 10, 8, 2, st); texture(p, 3, 6, 10, 6, k, st); });
def('armchair', (p, W, H, st) => { box(p, 2, 1, 12, 5, 2, ramp(st, 0.85)); box(p, 2, 5, 3, 10, 2, ramp(st, 0.9)); box(p, 11, 5, 3, 10, 2, ramp(st, 0.9)); box(p, 5, 6, 6, 8, 2, st); texture(p, 2, 1, 12, 12, 'fabric', st); });
def('end_table', (p, W, H, st, k) => { box(p, 2, 3, 12, 11, 3, st); texture(p, 2, 3, 12, 8, k, st); p.blob(8, 6, 1.6, 1.6, C('#f0e090')); });
def('dresser', (p, W, H, st, k) => { box(p, 1, 2, W - 2, 12, 5, st); texture(p, 1, 2, W - 2, 7, k, st); for (let x = 4; x < W - 3; x += 7) p.hline(x, x + 3, 11, C('#e8c860')); });
def('shelf', (p, W, H, st, k) => { box(p, 0, 1, W, 14, 3, ramp(st, 0.85)); p.rect(2, 3, W - 4, 8, ramp(st, 0.55)); for (let x = 3; x < W - 3; x += 5) p.vline(x, 3, 10, ramp(st, 0.75)); texture(p, 0, 1, W, 3, k, st); });
def('plant_pot', (p, W, H, st, k, s) => {
  p.poly([[4, 9], [12, 9], [11, 15], [5, 15]], st); p.hline(4, 11, 9, ramp(st, 1.2)); p.ellipse(8, 9, 4, 1, C('#4a3020'));
  const fc = s.plant === 'daylily' ? C('#f08a30') : C('#e0405a');
  p.blob(8, 6, 4, 3.4, C('#4a8034'));
  for (const [x, y] of [[6, 4], [10, 5], [8, 3], [7, 7], [10, 7]] as [number, number][]) { p.set(x, y, fc); p.set(x + 1, y, ramp(fc, 0.8)); }
}, 4);
def('grave', (p, W, H, st, k, s) => {
  p.ellipse(8, 18, 6, 11, C('#6a5038')); p.ellipse(8, 17, 5, 10, C('#7e6044'));
  if (s.filled) { box(p, 4, 0, 8, 7, 2, C('#9a9aa0')); p.hline(6, 9, 3, C('#5a5a60')); p.vline(8, 1, 5, C('#5a5a60')); }
});
def('sculpture_small', (p, W, H, st, k, s) => {
  box(p, 3, 11, 10, 5, 2, ramp(st, 0.8));
  const seed = (s.seed || 1) % 5;
  if (seed === 0) { p.blob(8, 6, 4, 5, st); p.blob(8, 1.5, 2.5, 2.5, st); }
  else if (seed === 1) { p.poly([[4, 11], [8, -4], [12, 11]], st); }
  else if (seed === 2) { p.ellipse(8, 5, 4.5, 6, st); p.ellipse(8, 5, 2, 3, [0, 0, 0, 0]); p.map((c, x, y) => (Math.hypot(x - 8, (y - 5) * 0.75) < 2 ? null : c)); }
  else if (seed === 3) { p.blob(6, 7, 3, 4, st); p.blob(10, 4, 3, 5, ramp(st, 1.05)); }
  else { p.rect(5, -2, 6, 13, st); p.rect(3, 2, 10, 3, st); }
  p.map((c, x, y) => (y < 11 ? ramp(c, 1.25 - x * 0.03 - y * 0.01) : c));
}, 6);
def('sculpture_large', (p, W, H, st, k, s) => {
  box(p, 3, 24, 26, 8, 3, ramp(st, 0.8));
  p.blob(12, 12, 7, 10, st); p.blob(20, 10, 6, 12, ramp(st, 1.05)); p.blob(16, 0, 5, 6, st);
  p.map((c, x, y) => (y < 24 ? ramp(c, 1.3 - x * 0.02 - y * 0.008) : c));
}, 10);
def('campfire', (p, W, H, st, k, s) => {
  p.ellipse(8, 11, 6, 3.5, C('#4a4040'));
  for (const [x, y] of [[4, 9], [10, 9], [7, 12]] as [number, number][]) { p.rect(x, y, 4, 2, C('#6e4c30')); p.set(x + 3, y, C('#c8a070')); }
  for (let a = 0; a < 7; a++) { const ang = (a / 7) * Math.PI * 2; p.blob(8 + Math.cos(ang) * 6, 11 + Math.sin(ang) * 3.5, 1.3, 1, C('#8a8a8e')); }
});
def('butcher_spot', (p) => { p.ellipse(8, 8, 6, 5, [110, 30, 30, 120]); p.line(3, 3, 13, 13, [80, 20, 20, 200]); p.line(13, 3, 3, 13, [80, 20, 20, 200]); });
def('crafting_spot', (p) => { p.ellipse(8, 8, 6, 5, [120, 100, 70, 140]); p.rect(4, 6, 4, 1, C('#8a6038')); p.rect(9, 8, 3, 3, C('#9aa4ae')); p.line(5, 10, 8, 12, C('#6e4c30')); });
function bench(p: Pix, W: number, st: RGBA, k: string) { box(p, 0, 1, W, 14, 4, st); texture(p, 1, 2, W - 2, 9, k, st); legs(p, 0, 1, W, 15, st); }
def('butcher_table', (p, W, H) => { bench(p, W, METAL, 'metal'); p.rect(18, 4, 10, 5, C('#c8ccd4')); p.rect(26, 4, 3, 2, C('#4a3020')); p.ellipse(10, 7, 4, 2, C('#8a2222')); p.set(12, 6, C('#6e1a1a')); });
function stove(p: Pix, W: number, electric: boolean, lit: boolean) {
  bench(p, W, electric ? C('#c8ccd4') : C('#5a5e66'), 'metal');
  for (let q = 0; q < 3; q++) { const cx = 8 + q * 16; p.ellipse(cx, 6, 4, 2.6, C('#2a2a30')); p.ellipse(cx, 6, 2.6, 1.6, lit ? C(electric ? '#e06040' : '#ff9030') : C('#505058')); }
  if (!electric) { p.rect(W - 7, 10, 4, 2, lit ? C('#ffb040') : C('#301a10')); }
}
def('stove_fueled', (p, W, H, st, k, s) => stove(p, W, false, s.lit));
def('stove_electric', (p, W, H, st, k, s) => stove(p, W, true, s.lit));
def('tailor_bench', (p, W, H, st, k) => { bench(p, W, st, k); p.rect(4, 3, 8, 5, C('#c04848')); p.rect(14, 4, 8, 4, C('#4868c0')); p.ellipse(28, 6, 3, 2, C('#e8e0c8')); p.set(28, 6, C('#8a6038')); p.line(36, 3, 44, 8, C('#c8ccd4')); });
def('smithy', (p, W, H, st, k, s) => {
  bench(p, W, st, k);
  p.rect(4, 3, 12, 7, C('#3a3036')); p.rect(6, 5, 8, 3, s.lit ? C('#ff7a20') : C('#502018')); if (s.lit) p.hline(7, 12, 5, C('#ffd060'));
  p.poly([[26, 4], [38, 4], [36, 7], [30, 7], [30, 9], [27, 9]], C('#4a4e58')); p.hline(26, 37, 4, C('#8a939c'));
});
def('machining_table', (p, W, H) => {
  bench(p, W, C('#6a7580'), 'metal');
  p.rect(6, 3, 6, 6, C('#3a3e44')); p.rect(8, 2, 2, 3, C('#c8ccd4'));
  for (let q = 0; q < 3; q++) { p.ellipse(24 + q * 5, 6, 2, 2, C('#c8a040')); p.set(24 + q * 5, 6, C('#5a4a20')); }
  screen(p, 36, 3, 8, 5, C('#80ff90'));
});
def('stonecutter', (p, W, H, st, k) => { bench(p, W, st, k); p.ellipse(24, 6, 5, 5, C('#c8ccd4')); p.ellipse(24, 6, 1.5, 1.5, C('#4a4e58')); p.rect(6, 4, 8, 5, C('#8a8a90')); p.rect(34, 4, 8, 4, C('#9a9aa0')); });
def('fabrication_bench', (p, W, H) => { bench(p, W, C('#5a6878'), 'metal'); screen(p, 4, 2, 12, 6); screen(p, 32, 2, 12, 6, C('#ffc060')); p.rect(19, 3, 10, 5, C('#2a3040')); for (let x = 20; x < 28; x += 2) p.set(x, 5, C('#7fd0ff')); });
def('drug_lab', (p, W, H) => { bench(p, W, C('#d8dce0'), 'metal'); for (let q = 0; q < 4; q++) { const x = 6 + q * 10; p.rect(x, 2, 3, 6, [180, 220, 240, 200]); p.rect(x, 5, 3, 3, [q % 2 ? 120 : 200, q % 2 ? 220 : 100, 120, 220]); } });
def('research_bench', (p, W, H, st, k) => { bench(p, W, st, k); p.rect(4, 3, 9, 6, C('#f0ece0')); for (let y = 4; y < 8; y++) p.hline(5, 11, y, C('#8a8a90')); p.rect(18, 2, 4, 7, C('#3a3e44')); p.rect(19, 1, 2, 2, C('#c8ccd4')); p.rect(30, 3, 6, 5, C('#a04838')); p.rect(37, 4, 5, 4, C('#3858a0')); });
def('research_bench_hitech', (p, W, H) => { box(p, 0, 1, W, H - 2, 5, C('#5a6878')); texture(p, 1, 2, W - 2, H - 9, 'metal', C('#5a6878')); screen(p, 4, 4, 14, 10); screen(p, 20, 4, 8, 10, C('#a0ff80')); screen(p, 30, 4, 14, 10, C('#ffd060')); });
def('hydroponics', (p, W, H, st, k, s) => { box(p, 1, 0, 14, H, 3, C('#8a939c')); p.rect(3, 2, 10, H - 7, s.powered ? C('#3a6a8a') : C('#3a3e44')); for (let y = 4; y < H - 6; y += 6) p.hline(3, 12, y, C('#5a8aaa')); });
def('comms_console', (p, W, H) => { box(p, 1, 4, W - 2, H - 5, 5, C('#5a6878')); screen(p, 5, 8, 22, 12, C('#7fffb0')); p.vline(26, 0, 6, C('#c8ccd4')); p.set(26, 0, C('#ff4040')); p.rect(6, 22, 20, 2, C('#3a3e44')); }, 0);
def('battery', (p, W, H, st, k, s) => {
  box(p, 1, 1, 14, 30, 4, C('#6a7580'));
  p.rect(4, 4, 8, 20, C('#1e2430'));
  const fill = Math.round(20 * (s.charge || 0));
  for (let y = 0; y < fill; y++) p.hline(5, 10, 23 - y, y % 2 ? C('#50e070') : C('#70ff90'));
  p.rect(6, 0, 4, 2, C('#c8a040'));
});
def('gen_wood', (p, W, H, st, k, s) => { box(p, 1, 3, 30, 28, 6, C('#5a5e66')); texture(p, 2, 4, 28, 20, 'metal', C('#5a5e66')); p.rect(6, 20, 20, 4, s.lit ? C('#ff8020') : C('#301a10')); if (s.lit) p.hline(8, 23, 20, C('#ffd060')); box(p, 22, 0, 6, 12, 2, C('#3a3e44')); });
def('gen_solar', (p, W, H) => {
  box(p, 1, 1, 46, 46, 4, C('#6a7580'));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const px = 4 + x * 8, py = 4 + y * 7;
    p.rect(px, py, 7, 6, C('#2a4a8a')); p.hline(px, px + 6, py, C('#6a8ad0')); p.set(px + 1, py + 1, C('#a0c0ff'));
  }
});
def('gen_wind', (p, W, H) => { box(p, 12, 4, 8, 12, 3, C('#c8ccd4')); p.ellipse(16, 6, 3, 2.5, C('#e8ecf0')); }, 0);
def('gen_geo', (p, W, H, st, k, s) => { box(p, 1, 2, 30, 29, 6, C('#6a5a4a')); texture(p, 2, 3, 28, 20, 'metal', C('#6a5a4a')); p.ellipse(16, 12, 7, 5, C('#3a3e44')); p.ellipse(16, 12, 4, 3, C('#e06030')); box(p, 4, 0, 5, 10, 2, C('#8a939c')); box(p, 23, 0, 5, 10, 2, C('#8a939c')); });
def('heater', (p, W, H, st, k, s) => { box(p, 2, 3, 12, 12, 3, C('#b04838')); for (let y = 5; y < 11; y += 2) p.hline(4, 11, y, s.powered ? C('#ffb040') : C('#5a2018')); });
def('cooler', (p, W, H, st, k, s) => { box(p, 0, 0, 16, 16, 4, C('#8a939c')); p.rect(2, 2, 12, 4, C('#e05040')); p.rect(2, 8, 12, 3, C('#4090e0')); for (let x = 3; x < 13; x += 2) { p.set(x, 3, C('#a02820')); p.set(x, 9, C('#205090')); } });
def('vent', (p) => { box(p, 0, 0, 16, 16, 4, C('#8a939c')); for (let y = 3; y < 11; y += 2) p.hline(3, 12, y, C('#3a3e44')); });
def('passive_cooler', (p) => { box(p, 2, 2, 12, 13, 4, WOOD); p.rect(4, 4, 8, 5, C('#4a90c0')); p.hline(4, 11, 4, C('#8ac8f0')); });
def('torch', (p, W, H, st, k, s) => { p.vline(8, 6, 15, C('#6e4c30')); p.vline(7, 6, 15, C('#8a6038')); p.rect(6, 4, 4, 3, C('#4a3020')); }, 6);
def('lamp', (p, W, H, st, k, s) => { p.vline(8, 2, 15, C('#4a4e58')); p.ellipse(8, 15, 3, 1, C('#3a3e44')); p.poly([[4, 3], [12, 3], [10, -3], [6, -3]], C('#e8dcb0')); if (s.lit) p.hline(5, 10, 3, C('#fff8d0')); }, 6);
def('sun_lamp', (p, W, H, st, k, s) => { p.vline(8, 2, 15, C('#4a4e58')); p.ellipse(8, 15, 3, 1, C('#3a3e44')); p.ellipse(8, -1, 5, 4, C('#6a7580')); p.ellipse(8, 0, 3.5, 2.5, s.lit ? C('#ffffd0') : C('#8a8a80')); }, 6);
def('horseshoes', (p) => { p.ellipse(8, 8, 7, 6, [190, 170, 120, 160]); p.vline(8, 3, 9, C('#6e4c30')); p.ellipse(5, 11, 2, 1.2, C('#9aa4ae')); p.ellipse(11, 12, 2, 1.2, C('#9aa4ae')); });
def('chess_table', (p, W, H, st) => { box(p, 1, 3, 14, 12, 3, st); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) p.rect(3 + x * 2.5, 4 + y * 1.5, 2, 1, (x + y) % 2 ? C('#e8e0d0') : C('#2a2226')); p.set(5, 4, C('#c04040')); p.set(10, 8, C('#4060c0')); });
def('billiards', (p, W, H) => { box(p, 0, 0, W, H, 5, C('#6e4c30')); p.rect(3, 3, W - 6, H - 11, C('#2a8a4a')); for (const [x, y] of [[10, 8], [14, 10], [30, 9], [33, 13]] as [number, number][]) p.set(x, y, [C('#f0f0f0'), C('#e03030'), C('#e0c030'), C('#3050e0')][x % 4]); });
def('tv', (p, W, H, st, k, s) => { box(p, 2, 1, W - 4, 13, 3, C('#5a4a3a')); screen(p, 5, 3, W - 10, 7, s.powered ? C('#a0d0ff') : C('#303840')); p.vline(10, 14, 15, C('#3a3e44')); p.vline(W - 11, 14, 15, C('#3a3e44')); });
def('ship_beam', (p) => { box(p, 1, 1, 14, 14, 3, C('#8a939c')); p.line(2, 2, 13, 11, C('#5a6068')); p.line(13, 2, 2, 11, C('#5a6068')); });
def('ship_casket', (p, W, H, st, k, s) => { box(p, 1, 1, 14, 30, 4, C('#c8ccd4')); p.rect(4, 4, 8, 20, [120, 200, 255, 200]); p.rect(5, 8, 6, 12, [200, 240, 255, 150]); if (s.powered) p.set(8, 26, C('#50ff80')); });
def('ship_computer', (p, W, H) => { box(p, 1, 1, 30, 30, 5, C('#6a7580')); for (let q = 0; q < 3; q++) screen(p, 4 + q * 9, 5, 7, 16, [C('#7fd0ff'), C('#80ff90'), C('#ffd060')][q]); });
def('ship_reactor', (p, W, H, st, k, s) => {
  box(p, 1, 1, 46, 46, 6, C('#6a7580')); texture(p, 2, 2, 44, 36, 'metal', C('#6a7580'));
  p.ellipse(24, 20, 14, 12, C('#2a3040'));
  p.ellipse(24, 20, 10, 8, s.active ? C('#40e0ff') : C('#305060'));
  p.ellipse(24, 20, 5, 4, s.active ? C('#e0ffff') : C('#406070'));
});
def('ship_engine', (p, W, H) => { box(p, 3, 1, 42, 38, 6, C('#7a8590')); texture(p, 4, 2, 40, 30, 'metal', C('#7a8590')); p.ellipse(24, 42, 14, 5, C('#2a2e34')); p.ellipse(24, 42, 9, 3, C('#e06020')); }, 0);
def('geyser', (p) => { p.ellipse(16, 16, 10, 7, C('#5a4a3a')); p.ellipse(16, 16, 6, 4, C('#2a2020')); p.ellipse(16, 15, 3, 2, C('#6a3020')); });
def('ship_chunk', (p) => {
  p.poly([[3, 26], [2, 12], [9, 4], [22, 3], [29, 10], [30, 24], [20, 30]], C('#6a6e76'));
  p.map((c, x, y) => ramp(c, 1.3 - y / 40 + (h2(x, y, 3) > 0.85 ? -0.2 : 0)));
  p.line(6, 14, 18, 8, C('#3a3e44')); p.line(12, 24, 26, 14, C('#3a3e44')); p.rect(14, 16, 4, 3, C('#c07030'));
});

// ---------------- walls & doors (linked) ----------------
export function wallPix(st: RGBA, kind: string, mask: number, damaged = 0): Pix {
  // mask bits: 1 N, 2 E, 4 S, 8 W  (neighbors that are walls)
  const p = new Pix(16, 16);
  const top = ramp(st, 1.08), face = ramp(st, 0.6);
  const southOpen = !(mask & 4);
  const faceY = southOpen ? 10 : 16;
  p.rect(0, 0, 16, faceY, top);
  if (southOpen) p.rect(0, faceY, 16, 16 - faceY, face);
  texture(p, 0, 0, 16, faceY, kind, top);
  if (southOpen) texture(p, 0, faceY, 16, 16 - faceY, kind === 'wood' ? 'wood' : kind, face);
  // edges
  if (!(mask & 1)) { p.hline(0, 15, 0, ramp(top, 1.3)); p.hline(0, 15, 1, ramp(top, 1.12)); }
  if (!(mask & 8)) p.vline(0, 0, 15, ramp(top, 0.7));
  if (!(mask & 2)) p.vline(15, 0, 15, ramp(top, 0.62));
  if (southOpen) { p.hline(0, 15, faceY, ramp(top, 1.25)); p.hline(0, 15, 15, ramp(face, 0.6)); }
  if (damaged > 0) for (let k = 0; k < damaged * 10; k++) { const x = Math.floor(h2(k, 1, mask) * 16), y = Math.floor(h2(k, 2, mask) * 16); p.set(x, y, ramp(st, 0.45)); p.set(x + 1, y, ramp(st, 0.55)); }
  return p;
}
function doorPix(st: RGBA, kind: string, horizontal: boolean, open: boolean, auto: boolean): Pix {
  const p = new Pix(16, 16);
  const frame = ramp(st, 0.8);
  if (horizontal) {
    // door panel spans left-right; pawns pass north-south
    p.rect(0, 5, 2, 9, frame); p.rect(14, 5, 2, 9, frame);
    if (!open) {
      box(p, 2, 5, 12, 9, 4, auto ? METAL : st);
      if (!auto) texture(p, 2, 5, 12, 5, kind, st);
      p.set(11, 9, C('#e8c860'));
      if (auto) p.vline(8, 5, 13, C('#3a3e44'));
    } else {
      box(p, 2, 5, 3, 9, 4, auto ? METAL : st); box(p, 11, 5, 3, 9, 4, auto ? METAL : st);
    }
  } else {
    p.rect(5, 0, 6, 2, frame); p.rect(5, 14, 6, 2, frame);
    if (!open) { box(p, 6, 2, 4, 12, 3, auto ? METAL : st); if (!auto) texture(p, 6, 2, 4, 9, kind, st); }
    else { box(p, 6, 2, 4, 3, 1, auto ? METAL : st); box(p, 6, 11, 4, 3, 1, auto ? METAL : st); }
  }
  p.outline();
  return p;
}

const cache = new Map<string, Sprite>();
export interface BldState { lit?: boolean; powered?: boolean; charge?: number; plant?: string; seed?: number; filled?: boolean; active?: boolean }

export function buildingSprite(defId: string, stuff: string | undefined, rot: number, state: BldState = {}): Sprite {
  const key = `${defId}:${stuff || ''}:${rot}:${state.lit ? 1 : 0}${state.powered ? 1 : 0}:${state.charge !== undefined ? Math.round(state.charge * 8) : ''}:${state.plant || ''}:${state.seed ?? ''}:${state.filled ? 1 : 0}${state.active ? 1 : 0}`;
  let s = cache.get(key);
  if (s) return s;
  const d = BUILDINGS[defId];
  const drawId = d.sprite in DRAW ? d.sprite : defId in DRAW ? defId : 'table';
  const draw = DRAW[drawId];
  const extra = (draw as any).extraTop || 0;
  const [tw, th] = d.size;
  const W = tw * TILE, H = th * TILE;
  let p = new Pix(W, H + extra);
  const st = d.stuffCats ? stuffColor(stuff) : C('#8a939c');
  draw(new OffsetPix(p, extra) as any, W, H, st, stuffKind(stuff), state);
  p.outline(undefined, false, true);
  let oy = -extra;
  let ox = 0;
  if (rot && d.rotatable) {
    const k = rot === 1 ? 3 : rot === 2 ? 2 : 1;
    const r = p.rot90(k);
    p = r;
    ox = 0; oy = rot % 2 === 1 ? 0 : -extra;
  }
  s = addSprite(p, ox, oy);
  cache.set(key, s);
  return s;
}

/** Pix proxy that offsets y so drawers can paint above row 0 */
class OffsetPix {
  constructor(public t: Pix, public oy: number) {}
  get w() { return this.t.w; } get h() { return this.t.h - this.oy; }
  set(x: number, y: number, c: any) { this.t.set(x, y + this.oy, c); }
  get(x: number, y: number) { return this.t.get(x, y + this.oy); }
  opaque(x: number, y: number) { return this.t.opaque(x, y + this.oy); }
  rect(x: number, y: number, w: number, h: number, c: any) { this.t.rect(x, y + this.oy, w, h, c); }
  hline(x0: number, x1: number, y: number, c: any) { this.t.hline(x0, x1, y + this.oy, c); }
  vline(x: number, y0: number, y1: number, c: any) { this.t.vline(x, y0 + this.oy, y1 + this.oy, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: any) { this.t.line(x0, y0 + this.oy, x1, y1 + this.oy, c); }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: any) { this.t.ellipse(cx, cy + this.oy, rx, ry, typeof c === 'function' ? (x: number, y: number, a: number, b: number) => c(x, y - this.oy, a, b) : c); }
  blob(cx: number, cy: number, rx: number, ry: number, c: any, d?: boolean) { this.t.blob(cx, cy + this.oy, rx, ry, c, d); }
  poly(pts: [number, number][], c: any) { this.t.poly(pts.map(([x, y]) => [x, y + this.oy]), c); }
  map(fn: any) { this.t.map((c, x, y) => fn(c, x, y - this.oy)); }
}

/** build-menu icon: an L-shaped run of wall so it can't be mistaken for a door or crate */
export function wallIconSprite(stuff: string | undefined): Sprite {
  const key = 'icon:' + (stuff || '');
  let s = wallCache.get(key);
  if (s) return s;
  const st = stuffColor(stuff), k = stuffKind(stuff);
  const p = new Pix(32, 32);
  p.blit(wallPix(st, k, 2 | 4), 0, 0);
  p.blit(wallPix(st, k, 8), 16, 0);
  p.blit(wallPix(st, k, 1), 0, 16);
  s = addSprite(p);
  wallCache.set(key, s);
  return s;
}

const wallCache = new Map<string, Sprite>();
export function wallSprite(stuff: string | undefined, mask: number, dmg = 0): Sprite {
  const key = (stuff || '') + ':' + mask + ':' + dmg;
  let s = wallCache.get(key);
  if (s) return s;
  const p = wallPix(stuffColor(stuff), stuffKind(stuff), mask, dmg);
  s = addSprite(p);
  wallCache.set(key, s);
  return s;
}
export function doorSprite(defId: string, stuff: string | undefined, horizontal: boolean, open: boolean): Sprite {
  const key = 'door:' + defId + (stuff || '') + (horizontal ? 'h' : 'v') + (open ? 'o' : 'c');
  let s = wallCache.get(key);
  if (s) return s;
  s = addSprite(doorPix(stuffColor(stuff), stuffKind(stuff), horizontal, open, defId === 'autodoor'));
  wallCache.set(key, s);
  return s;
}

/** turret gun top, rotated */
const turretCache = new Map<number, Sprite>();
export function turretTopSprite(angle: number): Sprite {
  const k = ((Math.round((angle / (Math.PI * 2)) * 16) % 16) + 16) % 16;
  let s = turretCache.get(k);
  if (s) return s;
  const p = new Pix(16, 10);
  p.rect(2, 3, 7, 5, C('#6a7580')); p.hline(2, 8, 3, C('#9aa4ae')); p.rect(8, 4, 7, 2, C('#3a3e44')); p.set(14, 4, C('#1a1a1e'));
  p.outline();
  const r = p.rotate((k / 16) * Math.PI * 2, 20);
  s = addSprite(r, -2, -6);
  turretCache.set(k, s);
  return s;
}
/** wind turbine blades (animated) */
const bladeCache = new Map<number, Sprite>();
export function bladesSprite(frame: number): Sprite {
  const k = frame % 8;
  let s = bladeCache.get(k);
  if (s) return s;
  const p = new Pix(40, 40);
  for (let b = 0; b < 3; b++) {
    const a = (k / 8) * (Math.PI * 2 / 3) + b * (Math.PI * 2 / 3);
    for (let r = 3; r < 19; r++) { const x = 20 + Math.cos(a) * r, y = 20 + Math.sin(a) * r * 0.55; p.set(x, y, C('#e8ecf0')); p.set(x, y + 1, C('#b8bcc4')); }
  }
  p.ellipse(20, 20, 2.5, 2, C('#8a939c'));
  p.outline();
  s = addSprite(p, -4, -26);
  bladeCache.set(k, s);
  return s;
}
export { mix, bayer };
