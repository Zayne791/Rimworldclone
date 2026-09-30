import { itemSprite } from '../src/render/art/items';
import { buildingSprite, wallSprite, doorSprite } from '../src/render/art/buildings';
import { pawnSprite, lyingSprite } from '../src/render/art/pawns';
import { ITEMS } from '../src/data/items';
import { BUILDINGS } from '../src/data/buildings';
import { ANIMALS } from '../src/data/animals';
import { World } from '../src/sim/world';
import { generateHuman, generateAnimal } from '../src/sim/pawngen';
import type { Sprite } from '../src/render/pixel';
const which = new URLSearchParams(location.search).get('g') || 'items';
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = innerWidth; c.height = innerHeight;
const ctx = c.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#6a8a4a'; ctx.fillRect(0, 0, c.width, c.height);
const S = +(new URLSearchParams(location.search).get('s') || 3);
let x = 10, y = 10, rowH = 0;
function put(s: Sprite, label: string, flip = false, extraW = 0) {
  const w = Math.max(s.w, 16) * S + 8 + extraW, h = (Math.max(s.h, 16) + 4) * S + 14;
  if (x + w > c.width) { x = 10; y += rowH + 4; rowH = 0; }
  ctx.save();
  ctx.translate(x + (flip ? s.w * S : 0), y + 4 * S);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, 0, 0, s.w * S, s.h * S);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(label.slice(0, 14), x, y + h - 2);
  x += w; rowH = Math.max(rowH, h);
}
if (which === 'items') {
  for (const d of Object.values(ITEMS)) put(itemSprite(d.id, d.stuffCats ? (d.stuffCats.includes('metallic') ? 'steel' : d.stuffCats.includes('fabric') ? 'cloth' : 'wood') : undefined), d.id);
} else if (which === 'buildings') {
  for (const d of Object.values(BUILDINGS)) { if (d.id === 'wall' || d.isDoor) continue; put(buildingSprite(d.id, d.stuffCats ? 'wood' : undefined, 0, { lit: true, powered: true, charge: 0.6 }), d.id); }
  for (const st of ['wood', 'steel', 'blocks_granite', 'blocks_marble', 'plasteel', 'gold']) for (const m of [0, 2 | 8, 4, 15, 5, 6]) put(wallSprite(st, m), st.slice(0, 6) + m);
  for (const st of ['wood', 'steel', 'blocks_granite']) { put(doorSprite('door', st, true, false), 'door h'); put(doorSprite('door', st, false, false), 'door v'); put(doorSprite('door', st, true, true), 'open'); }
  put(doorSprite('autodoor', 'steel', true, false), 'autodoor');
  for (const r of [1, 2, 3]) put(buildingSprite('stove_electric', undefined, r, { lit: true }), 'stove r' + r);
  for (const r of [1, 2, 3]) put(buildingSprite('bed', 'wood', r, {}), 'bed r' + r);
} else if (which === 'pawns') {
  const w = new World('g', 20, 20);
  for (let k = 0; k < 10; k++) {
    const p = generateHuman(w, 10, { kind: k > 6 ? 'raider' : 'colonist', tier: 2 });
    for (const f of [0, 1, 2, 3]) for (const fr of [0, 1]) { const { s, flip } = pawnSprite(p, f, fr); put(s, `${p.look.hair.slice(0, 5)} ${f}${fr}`, flip); }
    put(lyingSprite(p, false), 'down');
  }
  for (const a of Object.keys(ANIMALS)) { const p = generateAnimal(w, a); for (const fr of [0, 1]) put(pawnSprite(p, 1, fr).s, a + fr); }
}
(window as any).done = true;
