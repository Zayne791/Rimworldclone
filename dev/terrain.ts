import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { ChunkRenderer, drawSprite } from '../src/render/chunks';
import { plantSprite, isFlatPlant } from '../src/render/art/plants';
const params = new URLSearchParams(location.search);
const seed = params.get('seed') || 'soak1';
const w = createWorld({ seed, mapSize: 120, maxPlayers: 1 });
const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'T', colonists: generateStartingColonists(w, 3, seed) });
const zoom = +(params.get('zoom') || 3);
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = innerWidth; c.height = innerHeight;
const ctx = c.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const cr = new ChunkRenderer(w);
const fx = +(params.get('x') || cx), fy = +(params.get('y') || cy);
const vx = fx * 16 - c.width / zoom / 2, vy = fy * 16 - c.height / zoom / 2;
ctx.setTransform(zoom, 0, 0, zoom, -vx * zoom, -vy * zoom);
cr.draw(ctx, vx, vy, vx + c.width / zoom, vy + c.height / zoom, 999);
const m = w.map;
for (let y = Math.floor(vy / 16); y < (vy + c.height / zoom) / 16 + 2; y++) for (let x = Math.floor(vx / 16); x < (vx + c.width / zoom) / 16 + 1; x++) {
  if (!m.inb(x, y)) continue;
  const i = m.idx(x, y);
  const p = m.plant[i];
  if (p && !isFlatPlant(p)) { const s = plantSprite(p, m.growth[i], (i * 2654435761) >>> 29); if (s) drawSprite(ctx, s, x * 16, y * 16, ((i * 7) & 1) === 1); }
}
(window as any).done = true;
