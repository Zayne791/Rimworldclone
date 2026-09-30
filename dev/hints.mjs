// Tap the "Make a stockpile zone" hint and check it opens the Zones drawer.
import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPad Pro 11'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForSelector('.alert');
await p.tap('.alert >> text=stockpile');
await p.waitForTimeout(400);
console.log('drawer:', await p.evaluate(() => window.__game.ui.drawerTab));
await p.screenshot({ path: 'test-output/hint-zones.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
