// Close-up of colonists in the world (walking, working, drafted with weapons).
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const out = process.argv[3] || 'test-output/colonists.png';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(process.env.BASE || 'http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForTimeout(1500);
await p.tap('[data-a="speed"][data-v="2"]');
await p.waitForTimeout(5000);
await p.evaluate(() => {
  const g = window.__game, r = g.renderer, w = g.world;
  const cols = w.colonists(g.faction);
  const c = cols[0];
  r.cam.zoom = (+(new URLSearchParams(location.search).get('z')) || 4) * r.dpr; r.centerOn(c.x, c.y);
  if (cols[1]) g.cmd({ c: 'draft', pawns: [cols[1].id], on: true });
});
await p.waitForTimeout(1500);
await p.screenshot({ path: out });
console.log(errs.join('\n') || 'no errors');
await b.close();
