// Screenshot the title screen (with its live diorama) on a device.
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const out = process.argv[3] || 'test-output/menu.png';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.waitForTimeout(4000);
await p.screenshot({ path: out });
// start a game from here: the diorama must stop and the game must render
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForTimeout(1500);
await p.screenshot({ path: out.replace('.png', '-game.png') });
console.log(errs.join('\n') || 'no errors');
await b.close();
