// Render every building (or the ones given) as icons in a grid, for eyeballing pixel art.
import { chromium } from 'playwright';
const out = process.argv[2] || 'test-output/sprites.png';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.evaluate(async (only) => {
  const { iconURL } = await import('/src/render/art/icons.ts');
  const { BUILDINGS } = await import('/src/data/buildings.ts');
  const ids = only || Object.keys(BUILDINGS);
  const stuff = d => !d.stuffCats ? '' : d.stuffCats.includes('woody') ? 'wood' : d.stuffCats.includes('metallic') ? 'steel' : d.stuffCats.includes('stony') ? 'blocks_marble' : 'cloth';
  document.body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px;background:#3a4a2a;font:11px sans-serif;color:#fff">${ids.map(id => `<div style="text-align:center;width:150px"><img src="${iconURL('bld:' + id + ':' + stuff(BUILDINGS[id]), 3)}" style="image-rendering:pixelated;max-width:150px"><div>${id}</div></div>`).join('')}</div>`;
}, only);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
