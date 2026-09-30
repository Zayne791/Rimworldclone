// 16x16 pixel-art UI icons, exported as data URLs for DOM usage.
import { Pix, C, ramp, addSprite, spriteToDataURL, type Col } from '../pixel';
import { itemSprite } from './items';
import { buildingSprite, wallIconSprite } from './buildings';

type Pal = Record<string, Col>;
const K = '#1c1622';
const P: Pal = { k: K, w: '#f4f0e8', g: '#9aa4ae', d: '#4a5058', r: '#e05040', R: '#a02820', y: '#f0c840', Y: '#b08820', b: '#5aa0f0', B: '#2a5aa0', n: '#8a6038', N: '#5a3e24', l: '#6fbf4a', L: '#3a7a2a', o: '#f08a30', p: '#c070e0', s: '#c8a080' };

const ICONS: Record<string, string[]> = {
  pause: ['................', '................', '...kkkk..kkkk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kwwk..kwwk...', '...kkkk..kkkk...'],
  play1: ['................', '................', '.....kk.........', '.....kwk........', '.....kwwk.......', '.....kwwwk......', '.....kwwwwk.....', '.....kwwwwwk....', '.....kwwwwk.....', '.....kwwwk......', '.....kwwk.......', '.....kwk........', '.....kk.........'],
  play2: ['................', '................', '..kk....kk......', '..kwk...kwk.....', '..kwwk..kwwk....', '..kwwwk.kwwwk...', '..kwwwwkkwwwwk..', '..kwwwwwkwwwwwk.', '..kwwwwkkwwwwk..', '..kwwwk.kwwwk...', '..kwwk..kwwk....', '..kwk...kwk.....', '..kk....kk......'],
  play3: ['................', '................', 'kk...kk...kk....', 'kwk..kwk..kwk...', 'kwwk.kwwk.kwwk..', 'kwwwkkwwwkkwwwk.', 'kwwwwkwwwwkwwwwk', 'kwwwkkwwwkkwwwk.', 'kwwk.kwwk.kwwk..', 'kwk..kwk..kwk...', 'kk...kk...kk....'],
  menu: ['................', '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '................', '..kkkkkkkkkkkk..', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..'],
  build: ['................', '.....kkkkkk.....', '....kggggggk....', '...kgwwggggdk...', '...kggggggddk...', '....kkkknkkk....', '.......knk......', '.......knk......', '.......knk......', '.......knk......', '.......knk......', '.......knk......', '.......kNk......', '........k.......'],
  orders: ['................', '..kkkkkkkkkk....', '..kwwwwwwwwk....', '..kwkkkkkwwk....', '..kwwwwwwwwk....', '..kwkkkkwwwk....', '..kwwwwwwwwk.kk.', '..kwkkkkkwwkkyk.', '..kwwwwwwwwkyyk.', '..kwkkkwwwkyyk..', '..kwwwwwwkyyk...', '..kkkkkkkknk....', '..........k.....'],
  zones: ['................', '.kkkkkkkkkkkkkk.', '.kyykyykyykyyk..', '.kyk........kk..', '.kk..........k..', '.k..........kk..', '.kk..........k..', '.k..........kk..', '.kk..........k..', '.k..........kk..', '.kk..........k..', '.kkkkkkkkkkkkkk.'],
  work: ['................', '.....kkkkkk.....', '....kgggggggk...', '...kgk....kgk...', '..kkkkkkkkkkkk..', '..knnnnnnnnnnk..', '..knnnnnnnnnnk..', '..knnnkyykknnk..', '..knnnkyykknnk..', '..knnnnnnnnnnk..', '..knnnnnnnnnnk..', '..kkkkkkkkkkkk..'],
  research: ['................', '......kkkk......', '......kwwk......', '......kwwk......', '.....kwwwwk.....', '.....kwwwwk.....', '....kwwbbwwk....', '....kwbbbbwk....', '...kwbbbbbbwk...', '...kbbbbbbbbk...', '..kbbbwbbbbbbk..', '..kbbbbbbbwbbk..', '..kkkkkkkkkkkk..'],
  colony: ['................', '....kkk..kkk....', '...kssk.kssk....', '...kssk.kssk....', '....kk...kk.....', '...kbbk.krrk....', '..kbbbbkrrrrk...', '..kbbbbkrrrrk...', '..kbbbbkrrrrk...', '...kkkk.kkkk....'],
  more: ['................', '................', '................', '................', '................', '..kkk..kkk..kkk.', '..kwk..kwk..kwk.', '..kkk..kkk..kkk.'],
  mine: ['................', '..kkkkkkkk......', '.kggggggggkk....', 'kgwggggggggk....', '.kk....knkkgk...', '.......knk.kgk..', '......knk...kk..', '.....knk........', '....knk.........', '...knk..........', '..knk...........', '..kk............'],
  chop: ['................', '........kkk.....', '.......kgggk....', '......kgwggk....', '......kgggkk....', '.....kknkkk.....', '....knk.........', '...knk..........', '..knk...........', '.knk............', '.kk.............'],
  harvest: ['................', '..kkkkkkkk......', '.kgwwggggk......', 'kgk.....kgk.....', 'kk.......kk.....', '.........knk....', '..........knk...', '...........knk..', '............knk.', '.............kk.'],
  cut: ['................', '...kk.....kk....', '..kgwk...kgwk...', '..kggk...kggk...', '...kggk.kggk....', '....kggkggk.....', '.....kgggk......', '....knkknk......', '...knk..knk.....', '..knk....knk....', '..kk......kk....'],
  hunt: ['................', '......kkkk......', '....kkrrrrkk....', '...krrkkkkrrk...', '...krk....krk...', '..krk..kk..krk..', '..krk.krrk.krk..', '..krk.krrk.krk..', '..krk..kk..krk..', '...krk....krk...', '...krrkkkkrrk...', '....kkrrrrkk....', '......kkkk......'],
  tame: ['................', '................', '...kkk...kkk....', '..krrrk.krrrk...', '.krRrrrkrrrrrk..', '.krrrrrrrrrrrk..', '.krrrrrrrrrrrk..', '..krrrrrrrrrk...', '...krrrrrrrk....', '....krrrrrk.....', '.....krrrk......', '......krk.......', '.......k........'],
  slaughter: ['................', '..........kk....', '.........kggk...', '........kggk....', '.......kggk.....', '......kggk......', '.....kggk.......', '....kkgk........', '...knkk.........', '..knk...........', '..kk............', '...........kk...', '..........krrk..', '...........kk...'],
  deconstruct: ['................', '..kkkkk.........', '.kgggggk........', '.kgwggdk........', '..kkknkk........', '....knk...k..k..', '....knk....kk...', '....knk....kk...', '....knk...k..k..', '....knk.........', '....kNk.........', '.....k..........'],
  cancel: ['................', '..kk........kk..', '.krrk......krrk.', '.krrrk....krrrk.', '..krrrk..krrrk..', '...krrrkkrrrk...', '....krrrrrrk....', '.....krrrrk.....', '....krrrrrrk....', '...krrrkkrrrk...', '..krrrk..krrrk..', '.krrrk....krrrk.', '.krrk......krrk.', '..kk........kk..'],
  forbid: ['................', '.....kkkkkk.....', '...kkrrrrrrkk...', '..krrkkkkkkrrk..', '..krk.....krrk..', '.krk.....krrrk..', '.krk....krrkrk..', '.krk...krrk.rk..', '.krk..krrk..rk..', '.krkkkrrk..krk..', '..krrrrk..krk...', '..krrkkkkkrrk...', '...kkrrrrrrkk...', '.....kkkkkk.....'],
  unforbid: ['................', '.....kkkkkk.....', '...kklllllkk....', '..kllkkkkkllk...', '..klk.....klk...', '.klk.......klk..', '.klk......klk...', '.klk.kk..klk....', '.klkkllkklk.....', '.klk.kllllk.....', '..klk.kllk......', '..kllkkkkllk....', '...kklllllkk....', '.....kkkkkk.....'],
  home: ['................', '.......kk.......', '......kyyk......', '.....kyyyyk.....', '....kyyyyyyk....', '...kyyyyyyyyk...', '..kkkkkkkkkkkk..', '...knnnnnnnnk...', '...knnkkknnnk...', '...knnkyknnnk...', '...knnkyknnnk...', '...kkkkkkkkkk...'],
  roof: ['................', '.......kk.......', '.....kknnkk.....', '...kknnnnnnkk...', '.kknnnnnnnnnnkk.', 'knnnnnnnnnnnnnnk', 'kkkkkkkkkkkkkkkk', '..kg........gk..', '..kg........gk..', '..kg........gk..'],
  stockpile: ['................', '..kkkkkkkkkkkk..', '..knnnnnnnnnnk..', '..knkkkkkkkknk..', '..knnnnnnnnnnk..', '..kkkkkkkkkkkk..', '..kgggk..kyyyk..', '..kgwgk..kyyyk..', '..kgggk..kyyyk..', '..kkkkk..kkkkk..'],
  grow: ['................', '.......kk.......', '......klLk......', '..kk..klLk..kk..', '.kllk.klLk.kllk.', '.kLllkklLkkllLk.', '..kLllklLkllLk..', '...kLlllllllk...', '....kkkLlkkk....', '......klLk......', '..kkkkkkkkkkkk..', '..knnnnnnnnnnk..', '..kkkkkkkkkkkk..'],
  dump: ['................', '................', '...kkkkkkkkkk...', '..kggggggggggk..', '...kgkgkgkgkk...', '...kgkgkgkgkk...', '...kgkgkgkgkk...', '...kgkgkgkgkk...', '...kkkkkkkkkk...'],
  draft: ['................', '.....kkkkkk.....', '....kggggggk....', '...kgwggggggk...', '...kggggggggk...', '...kkkkkkkkkk...', '....kr....rk....', '....krk..krk....', '.....krkkrk.....', '......krrk......', '......krrk......', '.....krkkrk.....', '....krk..krk....', '....kk....kk....'],
  target: ['................', '.......kk.......', '......krrk......', '......kkkk......', '...kkk....kkk...', '..krrk....krrk..', '..kkkk.kk.kkkk..', '......krrk......', '......kkkk......'],
  info: ['................', '......kkkk......', '......kwwk......', '......kkkk......', '................', '.....kkkkk......', '.....kwwwk......', '......kwwk......', '......kwwk......', '......kwwk......', '.....kkwwkk.....', '.....kwwwwk.....', '.....kkkkkk.....'],
  close: ['................', '................', '...kk......kk...', '..kwwk....kwwk..', '...kwwk..kwwk...', '....kwwkkwwk....', '.....kwwwwk.....', '.....kwwwwk.....', '....kwwkkwwk....', '...kwwk..kwwk...', '..kwwk....kwwk..', '...kk......kk...'],
  chat: ['................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwkkkkkkkkkkwk.', '.kwwwwwwwwwwwwk.', '.kwkkkkkkkwwwwk.', '.kwwwwwwwwwwwwk.', '..kkkkwwkkkkkk..', '.....kwk........', '.....kk.........'],
  save: ['................', '..kkkkkkkkkkkk..', '..kbbkwwwwkbbk..', '..kbbkwwwwkbbk..', '..kbbkkkkkkbbk..', '..kbbbbbbbbbbk..', '..kbkkkkkkkkbk..', '..kbkwwwwwwkbk..', '..kbkwwwwwwkbk..', '..kbkwwwwwwkbk..', '..kkkkkkkkkkkk..'],
  help: ['................', '.....kkkkkk.....', '....kwwwwwwk....', '...kwwkkkkwwk...', '...kkk...kwwk...', '........kwwk....', '.......kwwk.....', '......kwwk......', '......kwwk......', '......kkkk......', '................', '......kwwk......', '......kkkk......'],
  people: ['................', '...kkk....kkk...', '..ksssk..ksssk..', '..ksssk..ksssk..', '...kkk....kkk...', '..kbbbk..kpppk..', '.kbbbbbkkpppppk.', '.kbbbbbkkpppppk.', '.kkkkkkkkkkkkkk.'],
  trade: ['................', '......kkk.......', '.....kyyyk......', '....kyYyyyk.....', '....kyyYyyk.....', '....kyyyyyk.....', '.....kyyyk......', '..kkk.kkk.kkk...', '.kyyyk...kyyyk..', '.kyYyk...kyYyk..', '.kyyyk...kyyyk..', '..kkk.....kkk...'],
  flag: ['................', '..kk............', '..knkkkkkkkk....', '..knrrrrrrrrk...', '..knrrrrrrrrrk..', '..knrrrrrrrrk...', '..knkkkkkkkk....', '..knk...........', '..knk...........', '..knk...........', '..knk...........', '..kkk...........'],
  fire: ['................', '.......k........', '......kok.......', '.....kook.k.....', '....koookkok....', '....koyookook...', '...kooyyooook...', '...kooyyyoook...', '...koyyyyyook...', '...kooyyyyook...', '....kooyyook....', '.....kkkkkk.....'],
  skull: ['................', '.....kkkkkk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwkkwwkkwk...', '...kwkkwwkkwk...', '...kwwwkkwwwk...', '....kwwwwwwk....', '.....kwkwkk.....', '.....kkkkkk.....'],
  alert: ['................', '.......kk.......', '......kyyk......', '......kyyk......', '.....kyyyyk.....', '.....kykkyk.....', '....kyykkyyk....', '....kyykkyyk....', '...kyyyyyyyyk...', '...kyyykkyyyk...', '..kyyyyyyyyyyk..', '..kkkkkkkkkkkk..'],
  rotate: ['................', '.....kkkkk......', '....kwwwwwk.....', '...kwkkkkkwk....', '...kwk...kwk....', '...kk....kwk....', '........kwwwk...', '.......kwwwwwk..', '........kwwwk...', '.........kwk....', '..........k.....'],
  check: ['................', '................', '.............kk.', '............klk.', '...........kllk.', '..kk......kllk..', '.kllk....kllk...', '..kllk..kllk....', '...kllkkllk.....', '....kllllk......', '.....kllk.......', '......kk........'],
  select: ['................', '.kk.kk.kk.kk....', '.k..........k...', '................', '.k....kk....k...', '......kwk.......', '.k....kwwk..k...', '......kwwwk.....', '.k....kwwwwk....', '......kwwkkk....', '.kk.kk.kkwk.k...', '........kk......'],
  priority: ['................', '.......kk.......', '......kyyk......', '.....kyyyyk.....', '....kyyyyyyk....', '...kkkkyykkkk...', '......kyyk......', '......kyyk......', '......kyyk......', '......kkkk......'],
  wall: ['................', 'kkkkkkkkkkkkkkkk', 'kggggkggggkggggk', 'kkkkkkkkkkkkkkkk', 'kggkggggkggggkgk', 'kkkkkkkkkkkkkkkk', 'kggggkggggkggggk', 'kkkkkkkkkkkkkkkk', 'kddkddddkddddkdk', 'kkkkkkkkkkkkkkkk'],
};

const urlCache = new Map<string, string>();
export function iconURL(name: string, scale = 3): string {
  const key = name + '@' + scale;
  let u = urlCache.get(key);
  if (u) return u;
  const rows = ICONS[name];
  let s;
  if (rows) {
    const p = new Pix(16, 16);
    const oy = Math.floor((16 - rows.length) / 2);
    p.grid(rows, P, 0, oy);
    s = addSprite(p);
  } else if (name.startsWith('item:')) s = itemSprite(name.slice(5));
  else if (name.startsWith('bld:')) {
    const [, id, stuff] = name.split(':');
    // walls are autotiled: show a short L-shaped run so the icon reads as "wall"
    s = id === 'wall' ? wallIconSprite(stuff || undefined) : buildingSprite(id, stuff || undefined, 0, { lit: true, powered: true, charge: 0.7 });
  }
  else { const p = new Pix(16, 16); p.rect(4, 4, 8, 8, C('#888')); s = addSprite(p); }
  u = spriteToDataURL(s, scale);
  urlCache.set(key, u);
  return u;
}
export function iconImg(name: string, cls = 'ico', scale = 3): string { return `<img class="${cls}" src="${iconURL(name, scale)}" alt="" draggable="false">`; }
export { ramp };
