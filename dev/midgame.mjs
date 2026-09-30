// Build a small base in the browser, fast-forward a few days, and screenshot it (visual QA).
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const days = +(process.argv[3] || 3);
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForFunction(() => window.__game?.world);
await p.evaluate(async (days) => {
  const g = window.__game, w = g.world, m = w.map, F = g.faction;
  const { simTick } = await import('/src/sim/sim.ts');
  const p0 = w.colonists(F)[0];
  const cx = p0.x, cy = p0.y;
  const free = (x0, y0, ww, hh) => { for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) { if (!m.inb(x, y)) return false; const i = m.idx(x, y); if (m.rock[i] || m.isWater(i) || m.bld[i]) return false; } return true; };
  const cells = (x0, y0, x1, y1) => { const o = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) o.push(m.idx(x, y)); return o; };
  let hx = cx - 10, hy = cy - 9;
  for (let k = 0; k < 40 && !free(hx, hy, 9, 7); k++) { hx = cx - 16 + (k % 8) * 4; hy = cy - 16 + Math.floor(k / 8) * 4; }
  const walls = []; for (let x = hx; x < hx + 9; x++) { walls.push([x, hy]); walls.push([x, hy + 6]); } for (let y = hy + 1; y < hy + 6; y++) { walls.push([hx, y]); walls.push([hx + 8, y]); }
  const door = [hx + 4, hy + 6];
  g.cmd({ c: 'build', def: 'wall', stuff: 'wood', rot: 0, cells: walls.filter(c => c[0] !== door[0] || c[1] !== door[1]) });
  g.cmd({ c: 'build', def: 'door', stuff: 'wood', rot: 0, cells: [door] });
  g.cmd({ c: 'build', def: 'bed', stuff: 'wood', rot: 0, cells: [[hx + 1, hy + 1], [hx + 3, hy + 1], [hx + 5, hy + 1]] });
  g.cmd({ c: 'build', def: 'torch', rot: 0, cells: [[hx + 7, hy + 3], [cx, cy + 2]] });
  g.cmd({ c: 'build', def: 'campfire', rot: 0, cells: [[cx - 3, cy + 2]] });
  g.cmd({ c: 'build', def: 'butcher_spot', rot: 0, cells: [[cx + 3, cy + 2]] });
  g.cmd({ c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 3, cy + 4, cx + 3, cy + 7) });
  let gx = cx + 6, gy = cy - 8; for (let k = 0; k < 30 && !free(gx, gy, 7, 6); k++) { gx = cx + 2 + (k % 6) * 3; gy = cy - 14 + Math.floor(k / 6) * 4; }
  g.cmd({ c: 'zone', op: 'new', kind: 'grow', plant: 'potato', cells: cells(gx, gy, gx + 6, gy + 5) });
  const trees = []; for (const i of cells(cx - 20, cy - 20, cx + 20, cy + 20)) if (m.plantDef(i)?.kind === 'tree' && trees.length < 20) trees.push(i);
  g.cmd({ c: 'designate', kind: 'chop', cells: trees });
  g.setSpeed(0);
  for (let t = 0; t < days * 60000 - 18000; t++) simTick(w);
  w.fx = [];
  g.renderer.centerOn(hx + 6, hy + 5);
  g.setSpeed(1);
}, days);
await p.waitForTimeout(1500);
await p.screenshot({ path: `test-output/mid-${dev.replace(/ /g, '')}-a.png` });
await p.evaluate(() => { const r = window.__game.renderer; r.cam.zoom *= 0.55; });
await p.waitForTimeout(800);
await p.screenshot({ path: `test-output/mid-${dev.replace(/ /g, '')}-b.png` });
console.log(errs.join('\n') || 'no errors');
await b.close();
