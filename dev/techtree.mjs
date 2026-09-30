// Screenshot the research tree on a device: some projects done, one in progress, a queued path, a selection.
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const pre = process.argv[3] || 'test-output/tt';
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
await p.evaluate(() => {
  const g = window.__game, rs = g.world.research[g.faction];
  rs.done.push('crop_rotation', 'stonecutting', 'smithing', 'electricity', 'herbalism', 'writing', 'masonry', 'tilling', 'metallurgy', 'batteries', 'anatomy');
  rs.cur = 'machining'; rs.prog.machining = 620;
  g.cmd({ c: 'research', id: 'gun_turrets', queue: true });
});
await p.waitForTimeout(300);
await p.tap('#tab-research'); await p.waitForTimeout(700);
await p.screenshot({ path: `${pre}-open.png` });
await p.fill('.tt-search', 'hydro'); await p.press('.tt-search', 'Enter'); await p.waitForTimeout(400);
await p.fill('.tt-search', ''); await p.dispatchEvent('.tt-search', 'input'); await p.waitForTimeout(200);
await p.screenshot({ path: `${pre}-sel.png` });
await p.tap('[data-a="w:ttfit"]'); await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-fit.png` });
// drag to pan
const v = await p.$('.tt-view'); const bb = await v.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 - 200, bb.y + bb.height / 2 - 80, { steps: 5 }); await p.mouse.up();
await p.tap('[data-a="w:ttbr"][data-v="med"]'); await p.waitForTimeout(300);
await p.evaluate(() => { const b = document.querySelector('[data-a="w:ttzoom"][data-v="1"]'); b.click(); b.click(); }); await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-med.png` });
console.log(errs.join('\n') || 'no errors');
await b.close();
