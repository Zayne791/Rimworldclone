// AI minds in the browser with the offline mind: turn it on from the menu, let colonists talk,
// then capture speech bubbles, the Mind tab, the Voices log and the settings window.
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const pre = process.argv[3] || 'test-output/minds';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto(process.env.BASE || 'http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForTimeout(1200);
await p.tap('#tab-more'); await p.waitForTimeout(200);
await p.tap('[data-a="w:mindswin"]'); await p.waitForTimeout(200);
await p.tap(`[data-a="w:mprov"][data-v="${process.env.PROVIDER || 'offline'}"]`); await p.waitForTimeout(150);
await p.tap('[data-a="w:mindson"]'); await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-settings.png` });
await p.tap('[data-a="closemodal"]');
await p.tap('[data-a="speed"][data-v="2"]');
// wait until someone is speaking, then zoom on them
let spoke = false;
for (let k = 0; k < 40 && !spoke; k++) {
  await p.waitForTimeout(500);
  spoke = await p.evaluate(() => { const g = window.__game, w = g.world; const s = w.colonists(g.faction).find(c => c.speech && c.speech.t > w.tick + 60); if (!s) return false; const r = g.renderer; r.cam.zoom = 4 * r.dpr; r.centerOn(s.x, s.y); g.select([s.id]); return true; });
}
await p.tap('[data-a="speed"][data-v="0"]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-speech.png` });
await p.evaluate(() => { const b = document.querySelector('[data-a="sheettab"][data-v="mind"]'); b && b.click(); });
await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-mindtab.png` });
await p.tap('#tab-colony'); await p.waitForTimeout(200);
await p.tap('[data-a="w:tab"][data-v="voices"]'); await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-voices.png` });
const stats = await p.evaluate(() => { const g = window.__game; return { calls: g.minds.stats.calls, talk: g.world.talk.length, minds: g.world.colonists(g.faction).map(c => c.mind?.goal?.label) }; });
console.log('spoke', spoke, JSON.stringify(stats));
console.log(errs.join('\n') || 'no errors');
await b.close();
