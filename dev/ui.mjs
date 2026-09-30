import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const pre = process.argv[3] || 'test-output/ui';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForTimeout(1500);
const vp = p.viewportSize();
const shot = async (n) => { await p.waitForTimeout(400); await p.screenshot({ path: `${pre}-${n}.png` }); };
// build drawer
await p.tap('#tab-build'); await shot('build');
await p.tap('[data-a="dr:build"][data-v="wall"]'); await shot('walltool');
// drag a room with the mouse
const cx = vp.width / 2, cy = vp.height / 2;
await p.mouse.move(cx - 100, cy - 120); await p.mouse.down(); await p.mouse.move(cx, cy - 60, { steps: 5 }); await p.mouse.move(cx + 60, cy - 20, { steps: 5 }); await shot('walldrag'); await p.mouse.up();
await p.tap('[data-a="tooldone"]');
// zones
await p.tap('#tab-zones'); await p.tap('[data-a="dr:zone"][data-v="stockpile"]');
await p.mouse.move(cx - 80, cy + 60); await p.mouse.down(); await p.mouse.move(cx + 20, cy + 130, { steps: 6 }); await p.mouse.up();
await p.tap('[data-a="tooldone"]');
await shot('zone');
// select colonist via bar
await p.tap('.cb'); await shot('pawn');
await p.tap('[data-a="sheettab"][data-v="bio"]'); await shot('pawnbio');
await p.tap('[data-a="sheettab"][data-v="health"]'); await shot('pawnhealth');
await p.tap('#tab-work'); await shot('work');
await p.tap('#tab-research'); await shot('research');
await p.tap('#tab-colony'); await shot('colony');
await p.tap('#tab-more'); await shot('more');
await p.tap('[data-a="closemodal"]');
await p.tap('#tab-orders'); await shot('orders');
await p.tap('#tab-orders');
// run faster and see progress
await p.tap('[data-a="speed"][data-v="3"]');
await p.waitForTimeout(8000);
await shot('later');
await p.evaluate(() => { const g = window.__game; const r = g.renderer; r.cam.zoom = 6 * r.dpr; const b = [...g.world.blueprints.values(), ...g.world.buildings.values()].find(b => b.def === 'wall'); if (b) r.centerOn(b.x + 2, b.y + 2); g.clearSelection(); });
await shot('zoom');
console.log(errs.slice(0, 20).join('\n'));
await b.close();
