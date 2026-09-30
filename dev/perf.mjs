// Measure frame times + sim throughput of a running game (production build by default).
// usage: node dev/perf.mjs [url] [cpuThrottle] [device]
import { chromium, devices } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8787/';
const thr = +(process.argv[3] || 1);
const dev = process.argv[4] || 'iPad Pro 11';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices[dev], ...(process.env.DPR ? { deviceScaleFactor: +process.env.DPR } : {}) });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
await p.goto(url);
await p.waitForSelector('[data-m="new"]');
await p.tap('[data-m="new"]'); await p.tap('[data-m="next"]');
await p.waitForSelector('[data-m="site"]', { timeout: 20000 }); await p.tap('[data-m="site"]');
await p.waitForSelector('[data-m="go"]'); await p.tap('[data-m="go"]');
await p.waitForFunction(() => window.__game?.world, null, { timeout: 20000 });
if (thr > 1) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr }); }
for (const sp of [1, 3]) {
  await p.evaluate((s) => window.__game.setSpeed(s), sp);
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => new Promise(res => {
    const ts = []; const t0 = performance.now(); const tick0 = window.__game.world.tick;
    const f = (t) => { ts.push(t); if (t - t0 < 6000) requestAnimationFrame(f); else {
      const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
      res({ fps: +(ts.length / ((t - t0) / 1000)).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1), tps: Math.round((window.__game.world.tick - tick0) / ((t - t0) / 1000)) });
    } };
    requestAnimationFrame(f);
  }));
  console.log(`speed ${sp} throttle ${thr}x:`, JSON.stringify(r));
}
console.log(errs.join('\n') || 'no errors');
await b.close();
