// Pixel-art item sprites (16x16), built from char grids and small procedural painters.
import { Pix, C, ramp, mix, addSprite, h2, type Sprite, type RGBA, type Col } from '../pixel';
import { ITEMS } from '../../data/items';

type Pal = Record<string, Col>;
function g(rows: string[], pal: Pal, ox = 0, oy = 0): Pix { const p = new Pix(16, 16); p.grid(rows, pal, ox, oy); return p; }
function tone(base: Col): Pal { const b = C(base); return { a: ramp(b, 1.25), b: b, c: ramp(b, 0.78), d: ramp(b, 0.58) }; }

const GRIDS: Record<string, (stuff?: RGBA) => Pix> = {
  wood: () => {
    const p = new Pix(16, 16);
    const bark = C('#7a5232'), end = C('#d9b07a'), ring = C('#a8804e');
    const log = (y: number, x0: number, len: number) => {
      p.rect(x0, y, len, 4, bark); p.hline(x0, x0 + len - 1, y, ramp(bark, 1.2)); p.hline(x0, x0 + len - 1, y + 3, ramp(bark, 0.7));
      p.rect(x0 + len - 3, y, 3, 4, end); p.set(x0 + len - 2, y + 1, ring); p.set(x0 + len - 2, y + 2, ring);
      for (let x = x0 + 2; x < x0 + len - 3; x += 4) p.set(x, y + 1, ramp(bark, 0.8));
    };
    log(10, 1, 13); log(6, 3, 12); log(2, 2, 11);
    return p;
  },
  steel: () => bars(C('#9aa4ae')),
  plasteel: () => bars(C('#8fd3cd')),
  gold: () => bars(C('#e8bd3a')),
  uranium: () => rocks(C('#6f846d'), C('#9fe09a')),
  jade: () => rocks(C('#5bb07a'), C('#a8f0c0')),
  silver: () => {
    const p = new Pix(16, 16);
    const s = C('#c9d0d8');
    for (const [x, y] of [[3, 10], [7, 11], [11, 10], [5, 7], [9, 7], [7, 4]] as [number, number][]) {
      p.ellipse(x + 2, y + 1.5, 2.6, 1.6, s); p.hline(x, x + 4, y + 2, ramp(s, 0.75)); p.set(x + 1, y + 1, ramp(s, 1.3));
    }
    return p;
  },
  components: () => g([
    '................',
    '......kkkk......',
    '.....kyyyyk.....',
    '..kk.kyooyk.kk..',
    '..kyykyyyykyyk..',
    '...kyyyyyyyyk...',
    '..kyyykkkkyyyk..',
    'kkyyyk....kyyykk',
    'kyyyyk....kyyyyk',
    'kkyyyk....kyyykk',
    '..kyyykkkkyyyk..',
    '...kyyyyyyyyk...',
    '..kyykyyyykyyk..',
    '..kk.kyyyyk.kk..',
    '.....kyooyk.....',
    '......kkkk......',
  ], { k: '#3a2e1a', y: '#d9a441', o: '#f4d58a' }),
  adv_components: () => g([
    '................',
    '..k.k.k.k.k.k...',
    '.kkkkkkkkkkkkk..',
    '.kbbbbbbbbbbbk..',
    'kkbccccccccbbkk.',
    '.kbcllcccllcbk..',
    'kkbcllcccllcbkk.',
    '.kbccccccccbbk..',
    'kkbcccyyycccbkk.',
    '.kbcccyyycccbk..',
    'kkbccccccccbbkk.',
    '.kbbbbbbbbbbbk..',
    '.kkkkkkkkkkkkk..',
    '..k.k.k.k.k.k...',
    '................',
    '................',
  ], { k: '#1e2438', b: '#3a5a9a', c: '#2a3a6a', l: '#7fd0ff', y: '#f4d58a' }, 1, 1),
  chemfuel: () => g([
    '................',
    '......kkkk......',
    '.....kssssk.....',
    '....kkkkkkkk....',
    '...krrrrrrrrk...',
    '...krRRrrrrrk...',
    '...krRrrrrrrk...',
    '...krrrwwwrrk...',
    '...krrrwrwrrk...',
    '...krrrwwwrrk...',
    '...krrrrrrrrk...',
    '...krrrrrrrrk...',
    '...kddddddddk...',
    '...kkkkkkkkkk...',
  ], { k: '#2a1414', s: '#888', r: '#c0392b', R: '#e67060', w: '#f0e0c0', d: '#7a2018' }, 0, 1),
  blocks: (st) => {
    const p = new Pix(16, 16);
    const b = st || C('#888');
    const brick = (x: number, y: number) => { p.rect(x, y, 6, 3, b); p.hline(x, x + 5, y, ramp(b, 1.2)); p.hline(x, x + 5, y + 2, ramp(b, 0.75)); p.set(x + 5, y + 1, ramp(b, 0.8)); };
    brick(1, 11); brick(8, 11); brick(4, 8); brick(10, 8); brick(2, 5); brick(8, 5); brick(5, 2);
    return p;
  },
  chunk: (st) => {
    const p = new Pix(16, 16);
    const b = st || C('#888');
    p.poly([[2, 13], [1, 8], [4, 3], [10, 2], [14, 5], [15, 11], [12, 14]], b);
    p.map((c, x, y) => ramp(c, 1.25 - (y / 16) * 0.5 - (x / 16) * 0.15 + (h2(x, y, 3) - 0.5) * 0.12));
    p.line(5, 6, 8, 9, ramp(b, 0.6)); p.line(9, 4, 11, 7, ramp(b, 0.65));
    return p;
  },
  slag: () => {
    const p = GRIDS.chunk(C('#6a5a4e'));
    p.map((c, x, y) => (h2(x, y, 8) > 0.8 ? C('#a0602a') : h2(x, y, 9) > 0.9 ? C('#c07030') : c));
    return p;
  },
  cloth: (st) => {
    const p = new Pix(16, 16);
    const b = st || C('#ddd6c2');
    p.rect(2, 5, 12, 8, b);
    p.hline(2, 13, 5, ramp(b, 1.15)); p.hline(2, 13, 12, ramp(b, 0.7));
    p.rect(12, 5, 2, 8, ramp(b, 0.85));
    p.ellipse(13, 9, 1.6, 4, ramp(b, 0.9)); p.set(13, 9, ramp(b, 0.6));
    for (let x = 4; x < 12; x += 3) p.vline(x, 6, 11, ramp(b, 0.92));
    return p;
  },
  leather: (st) => {
    const p = new Pix(16, 16);
    const b = st || C('#8e5f3a');
    p.poly([[3, 3], [7, 4], [9, 2], [13, 4], [12, 8], [14, 12], [10, 13], [8, 11], [5, 14], [2, 11], [4, 8]], b);
    p.map((c, x, y) => ramp(c, 1.15 - y / 30 + (h2(x, y, 4) > 0.85 ? -0.1 : 0)));
    return p;
  },
  wool: (st) => { const p = new Pix(16, 16); const b = st || C('#eee7d3'); p.blob(6, 9, 4.5, 4, b); p.blob(10, 8, 4, 3.8, b); p.blob(8, 6, 3.5, 3, b); return p; },
  fur: (st) => GRIDS.leather(st || C('#6b5a48')),
  rice: () => sack(C('#d8c890'), C('#f2ead0')),
  corn: () => { const p = new Pix(16, 16); for (let k = 0; k < 3; k++) { const x = 3 + k * 4, y = 4 + (k % 2) * 2; p.rect(x, y, 3, 8, C('#f0cc40')); p.vline(x, y, y + 7, C('#d8a830')); p.set(x + 1, y + 1, C('#fff2a0')); p.line(x - 1, y + 7, x + 1, y + 10, C('#7aa040')); p.line(x + 3, y + 7, x + 1, y + 10, C('#5c8a30')); } return p; },
  potato: () => pile(C('#b08850'), 6, 2.4),
  berries: () => pile(C('#b0304a'), 11, 1.4),
  strawberry: () => pile(C('#e03848'), 9, 1.7),
  meat: () => {
    const p = new Pix(16, 16);
    const m = C('#b83a3a');
    p.blob(6, 10, 4.5, 3.2, m); p.blob(10, 8, 4, 3, ramp(m, 1.05));
    p.line(4, 9, 7, 11, C('#f0d0c0')); p.line(9, 7, 12, 9, C('#f0d0c0'));
    return p;
  },
  eggs: () => { const p = new Pix(16, 16); for (const [x, y] of [[5, 10], [10, 10], [7.5, 7]] as [number, number][]) p.blob(x, y, 2.6, 3.2, C('#f0e6d0')); return p; },
  milk: () => g([
    '.....kkkk.......',
    '.....kwwk.......',
    '....kkkkkk......',
    '...kwwwwwwk.....',
    '..kwwwwwwwwk....',
    '..kwbbbbbbwk....',
    '..kwbwwwwbwk....',
    '..kwbwwwwbwk....',
    '..kwbbbbbbwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '..kwwwwwwwwk....',
    '...kkkkkkkk.....',
  ], { k: '#4a4a58', w: '#f4f4f0', b: '#6aa0e0' }, 2, 2),
  hay: () => { const p = new Pix(16, 16); const b = C('#c8b060'); p.rect(2, 6, 12, 7, b); p.map((c, x, y) => ((x + y * 3) % 4 === 0 ? ramp(b, 0.8) : (x * 3 + y) % 5 === 0 ? ramp(b, 1.2) : c)); p.vline(5, 6, 12, C('#7a5a2a')); p.vline(10, 6, 12, C('#7a5a2a')); return p; },
  meal_simple: () => meal(C('#9a6a3a'), C('#c8a060'), false),
  meal_fine: () => meal(C('#c87a40'), C('#e8c060'), true),
  meal_lavish: () => meal(C('#d0503a'), C('#f0d070'), true, true),
  pemmican: () => { const p = new Pix(16, 16); const b = C('#8a5a3a'); for (let k = 0; k < 3; k++) { p.rect(3 + k * 1, 11 - k * 3, 10, 3, ramp(b, 1 + k * 0.05)); p.hline(3 + k, 12 + k, 11 - k * 3, ramp(b, 1.25)); p.set(5 + k * 3, 12 - k * 3, C('#c8a070')); } return p; },
  meal_survival: () => g([
    '................',
    '..kkkkkkkkkkk...',
    '..kgggggggggk...',
    '..kgGGGGGGGgk...',
    '..kgGwwwwwGgk...',
    '..kgGwrrrwGgk...',
    '..kgGwwwwwGgk...',
    '..kgGGGGGGGgk...',
    '..kgggggggggk...',
    '..kgkgkgkgkgk...',
    '..kkkkkkkkkkk...',
  ], { k: '#2a2e22', g: '#6a7a4a', G: '#8a9a5a', w: '#e8e0c8', r: '#c0392b' }, 1, 3),
  meal_paste: () => meal(C('#7ab040'), C('#a8d060'), false),
  beer: () => g([
    '......kk........',
    '......kk........',
    '.....kggk.......',
    '.....kggk.......',
    '....kggggk......',
    '....kgGggk......',
    '....kgGggk......',
    '....kyyyyk......',
    '....kyooyk......',
    '....kyyyyk......',
    '....kgGggk......',
    '....kggggk......',
    '....kkkkkk......',
  ], { k: '#1e2a14', g: '#4a7a2a', G: '#7ab050', y: '#e8d890', o: '#b04030' }, 2, 2),
  medicine_herbal: () => { const p = new Pix(16, 16); const l = C('#5a9a3a'); for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.6; p.line(8, 13, 8 + Math.cos(a - 1.57) * 6, 13 + Math.sin(a - 1.57) * 8, l); p.blob(8 + Math.cos(a - 1.57) * 5, 12 + Math.sin(a - 1.57) * 7, 2, 1.5, ramp(l, 1.1)); } p.rect(6, 11, 4, 2, C('#c8a060')); return p; },
  medicine: () => medkit(C('#f0f0ec'), C('#d02828')),
  medicine_glitter: () => medkit(C('#5ab0f0'), C('#f8f8ff')),
  corpse: () => new Pix(16, 16),
};

function bars(b: RGBA): Pix {
  const p = new Pix(16, 16);
  const bar = (x: number, y: number) => {
    p.poly([[x + 1, y], [x + 7, y], [x + 8, y + 3], [x, y + 3]], b);
    p.hline(x + 1, x + 6, y, ramp(b, 1.35)); p.hline(x, x + 7, y + 3, ramp(b, 0.62));
    p.set(x + 2, y + 1, ramp(b, 1.2));
  };
  bar(1, 11); bar(8, 11); bar(4, 7); bar(10, 7); bar(6, 3);
  return p;
}
function rocks(b: RGBA, glint: RGBA): Pix {
  const p = new Pix(16, 16);
  p.blob(6, 10, 4, 3.2, b); p.blob(11, 11, 3.5, 2.6, ramp(b, 0.95)); p.blob(9, 6, 3.4, 3, ramp(b, 1.05));
  p.set(5, 8, glint); p.set(9, 4, glint); p.set(11, 10, glint);
  return p;
}
function sack(b: RGBA, grain: RGBA): Pix {
  const p = new Pix(16, 16);
  p.blob(8, 10, 5.5, 4.5, b);
  p.rect(6, 4, 4, 3, ramp(b, 0.9)); p.hline(6, 9, 6, C('#7a5a2a'));
  p.ellipse(8, 5, 2.5, 1.2, grain);
  return p;
}
function pile(b: RGBA, n: number, r: number): Pix {
  const p = new Pix(16, 16);
  for (let k = 0; k < n; k++) {
    const x = 4 + h2(k, 1, n) * 8, y = 8 + h2(k, 2, n) * 5 - (k / n) * 3;
    p.blob(x, y, r, r * 0.9, ramp(b, 0.9 + h2(k, 3, n) * 0.2));
  }
  return p;
}
function meal(food: RGBA, top: RGBA, garnish: boolean, big = false): Pix {
  const p = new Pix(16, 16);
  const plate = C('#e8e8e0');
  p.ellipse(8, 10, 6.5, 3.6, plate);
  p.ellipse(8, 10.6, 6.5, 3, ramp(plate, 0.85));
  p.ellipse(8, 9.6, 5, 2.6, plate);
  p.blob(8, 8.5, big ? 4.5 : 3.8, big ? 2.8 : 2.3, food);
  p.set(7, 7, top); p.set(9, 8, top); p.set(6, 9, top);
  if (garnish) { p.set(10, 7, C('#5a9a3a')); p.set(11, 7, C('#7ab050')); }
  return p;
}
function medkit(b: RGBA, cross: RGBA): Pix {
  const p = new Pix(16, 16);
  p.rect(2, 5, 12, 9, b); p.hline(2, 13, 5, ramp(b, 1.1)); p.hline(2, 13, 13, ramp(b, 0.7)); p.vline(13, 5, 13, ramp(b, 0.8));
  p.rect(6, 3, 4, 2, ramp(b, 0.7));
  p.rect(7, 7, 2, 5, cross); p.rect(5, 8, 6, 2, cross);
  return p;
}

// ---------------- weapons (drawn pointing right, 16x8-ish on 16x16) ----------------
const WEAPON_GRIDS: Record<string, [string[], Pal]> = {
  knife: [['..........', '.......ab.', 'kkkkkkaab.', 'kkk.......'], { k: '#4a3020', a: '#c8ccd4', b: '#f0f0f8' }],
  club: [['.........bb.', '...kkkkkkbbb', 'kkkkkkkkkbbb', '.........bb.'], { k: '#6a4a2a', b: '#8a6038' }],
  spear: [['............a.', 'kkkkkkkkkkkaab', '............a.'], { k: '#7a5a3a', a: '#c8ccd4', b: '#f0f0f8' }],
  longsword: [['..g...........', 'kkgaaaaaaaaaab', '..g...........'], { k: '#4a3020', g: '#c8a040', a: '#c8ccd4', b: '#f0f0f8' }],
  mace: [['..........bb.', 'kkkkkkkkkbbbb', '..........bb.'], { k: '#4a3020', b: '#9aa4ae' }],
  bow: [['..kkk.', '.k..s.', 'k...s.', 'k...s.', '.k..s.', '..kkk.'], { k: '#8a6038', s: '#e8e0d0' }],
  revolver: [['.gggggggg', 'kgggggggg', 'kkk......', 'kk.......'], { k: '#6a4a2a', g: '#5a5e68' }],
  autopistol: [['kgggggggg', 'kggggggg.', 'kk.g.....', 'kk.......'], { k: '#2a2a2e', g: '#4a4e58' }],
  rifle_bolt: [['.....ggg.......', 'kkkkkkggggggggg', 'kkkk..k........'], { k: '#7a5232', g: '#4a4e58' }],
  shotgun: [['kkkkkggggggggg', 'kkkk.ggggggggg', 'kk....kk......'], { k: '#6a4a2a', g: '#3e4248' }],
  rifle_assault: [['.......gg.......', 'kkkkggggggggggggg', 'kkk..gg.gg.......', '......gg.........'], { k: '#2a2a2e', g: '#4a4e58' }],
  rifle_sniper: [['......sssss......', 'kkkkkkgggggggggggg', 'kkkk....g.........'], { k: '#5a4a3a', g: '#3a3e44', s: '#2a2e34' }],
  lmg: [['.....gggg........', 'kkkkggggggggggggg', 'kkk.gyyyg.g......', '....g...g........'], { k: '#2a2a2e', g: '#4a4e58', y: '#8a7a3a' }],
  rifle_charge: [['......bbb........', 'kkkkggggggggggggc', 'kkk..gg.g........'], { k: '#2a2e3a', g: '#5a6a80', b: '#7fd0ff', c: '#b0f0ff' }],
  grenades: [['.kk.', 'kggk', 'kggk', '.kk.'], { k: '#2a3a22', g: '#5a7a42' }],
};

export function weaponPix(def: string, stuff?: RGBA): Pix {
  const d = ITEMS[def];
  const key = d.sprite in WEAPON_GRIDS ? d.sprite : 'rifle_bolt';
  const [rows, pal0] = WEAPON_GRIDS[key];
  const pal: Pal = { ...pal0 };
  if (stuff && (key === 'knife' || key === 'longsword' || key === 'mace' || key === 'spear')) { pal.a = stuff; pal.b = ramp(stuff, 1.3); if (key === 'mace') pal.b = stuff; }
  if (stuff && key === 'club') { pal.b = stuff; pal.k = ramp(stuff, 0.7); }
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const p = new Pix(w + 2, h + 2);
  p.grid(rows, pal, 1, 1);
  p.outline(undefined, false, true);
  return p;
}

// ---------------- apparel icons ----------------
function apparelPix(style: string, col: RGBA): Pix {
  const p = new Pix(16, 16);
  const d = ramp(col, 0.75), l = ramp(col, 1.2);
  switch (style) {
    case 'tshirt': p.poly([[3, 4], [6, 3], [10, 3], [13, 4], [15, 7], [12, 8], [12, 13], [4, 13], [4, 8], [1, 7]], col); p.hline(6, 9, 3, d); break;
    case 'shirt': p.poly([[3, 4], [6, 3], [10, 3], [13, 4], [15, 12], [12, 12], [12, 14], [4, 14], [4, 12], [1, 12]], col); p.vline(8, 4, 13, d); for (let y = 5; y < 13; y += 3) p.set(8, y, C('#e8e0d0')); break;
    case 'pants': p.poly([[4, 2], [12, 2], [13, 14], [9, 14], [8, 6], [7, 14], [3, 14]], col); p.hline(4, 11, 2, d); break;
    case 'tribal': p.poly([[3, 3], [13, 3], [14, 12], [11, 14], [8, 12], [5, 14], [2, 12]], col); for (let x = 3; x < 14; x += 2) p.set(x, 12, d); break;
    case 'jacket': p.poly([[3, 3], [6, 2], [10, 2], [13, 3], [15, 12], [12, 12], [12, 14], [4, 14], [4, 12], [1, 12]], col); p.vline(8, 3, 13, d); p.line(6, 2, 8, 6, l); p.line(10, 2, 8, 6, l); break;
    case 'duster': p.poly([[4, 1], [12, 1], [14, 15], [9, 15], [8, 8], [7, 15], [2, 15]], col); p.line(6, 1, 8, 5, l); p.line(10, 1, 8, 5, l); break;
    case 'parka': p.poly([[3, 2], [13, 2], [15, 14], [1, 14]], col); p.ellipse(8, 3, 4, 2, C('#e8e0d0')); p.vline(8, 4, 13, d); break;
    case 'vest': p.poly([[4, 3], [12, 3], [13, 13], [3, 13]], col); p.rect(5, 5, 6, 6, d); p.hline(4, 12, 8, l); break;
    case 'armor': p.poly([[3, 2], [13, 2], [15, 9], [13, 14], [3, 14], [1, 9]], col); p.rect(6, 4, 4, 5, l); p.hline(3, 13, 10, d); break;
    case 'helmet': p.ellipse(8, 10, 6, 6, col); p.hline(2, 13, 10, d); p.set(5, 7, l); p.set(6, 6, l); break;
    case 'marinehelmet': p.ellipse(8, 8, 6, 6, col); p.rect(4, 7, 8, 3, C('#2a3040')); p.hline(4, 11, 7, C('#6fb0f0')); break;
    case 'cowboyhat': p.ellipse(8, 11, 7, 2, col); p.rect(5, 5, 6, 6, col); p.hline(5, 10, 9, d); p.hline(5, 10, 5, l); break;
    case 'tuque': p.ellipse(8, 10, 5, 5, col); p.rect(3, 10, 10, 3, d); p.blob(8, 4, 1.8, 1.8, C('#f0f0f0')); break;
    default: p.rect(4, 4, 8, 8, col);
  }
  if (style === 'helmet') { p.map((c, x, y) => (y > 10 ? null : c)); }
  return p;
}

// ---------------- sprite cache ----------------
const cache = new Map<string, Sprite>();
export function itemSprite(def: string, stuff?: string, color?: string): Sprite {
  const key = def + ':' + (stuff || '') + ':' + (color || '');
  let s = cache.get(key);
  if (s) return s;
  const d = ITEMS[def];
  const st = stuff ? ITEMS[stuff]?.stuff?.color : undefined;
  const stc = st ? C(st) : undefined;
  let p: Pix;
  if (d.weapon) {
    const wp = weaponPix(def, stc);
    p = new Pix(16, 16);
    p.blit(wp, Math.floor((16 - wp.w) / 2), Math.floor((16 - wp.h) / 2) + 2);
  } else if (d.apparel) {
    const col = C(color || (stc ? mix(stc, stc, 0) : d.apparel.color || '#7a8a9a'));
    p = apparelPix(d.apparel.style, col);
    p.outline();
  } else {
    const fn = GRIDS[d.sprite] || GRIDS[def] || GRIDS.chunk;
    p = fn(d.stuff ? C(d.stuff.color) : stc);
    if (def.startsWith('chunk_') && def !== 'chunk_slag') p = GRIDS.chunk(C(ITEMS['blocks_' + def.slice(6)]?.stuff?.color || '#888'));
    if (def.startsWith('blocks_')) p = GRIDS.blocks(C(d.stuff!.color));
    p.outline();
  }
  s = addSprite(p);
  cache.set(key, s);
  return s;
}

/** rotated weapon sprite for held weapons, 16 angles */
const wcache = new Map<string, Sprite>();
export function heldWeaponSprite(def: string, stuff: string | undefined, angle: number): { s: Sprite; flip: boolean } {
  const steps = 16;
  let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const flip = a > Math.PI / 2 && a < Math.PI * 1.5;
  if (flip) a = Math.PI - a;
  const k = Math.round((a / (Math.PI * 2)) * steps) % steps;
  const key = def + ':' + (stuff || '') + ':' + k;
  let s = wcache.get(key);
  if (!s) {
    const st = stuff ? ITEMS[stuff]?.stuff?.color : undefined;
    const base = weaponPix(def, st ? C(st) : undefined);
    const r = base.rotate((k / steps) * Math.PI * 2, 24);
    s = addSprite(r, -12, -12);
    wcache.set(key, s);
  }
  return { s, flip };
}
