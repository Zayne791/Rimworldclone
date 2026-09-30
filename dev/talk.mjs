// Leader mode in the browser: turn minds on (offline by default, or PROVIDER=server with the fake
// DeepSeek), open a face-to-face talk, ask for work by typing, then capture the talk screen,
// the agreement, the People view, a mediation and a speech to the whole colony.
import { chromium, devices } from 'playwright';
const dev = process.argv[2] || 'iPad Pro 11';
const pre = process.argv[3] || 'test-output/talk';
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
await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-letter.png` });
// pick the first colonist and talk
const id = await p.evaluate(() => { const g = window.__game; const c = g.world.colonists(g.faction)[0]; g.select([c.id]); return c.id; });
await p.waitForTimeout(400);
await p.screenshot({ path: `${pre}-inspector.png` });
await p.evaluate(() => document.querySelector('[data-a="insp:talk"]')?.click());
await p.waitForTimeout(2500);
await p.screenshot({ path: `${pre}-open.png` });
// type mode
await p.evaluate(() => { const b = document.querySelector('[data-t="mode"]'); b && b.click(); });
await p.waitForTimeout(200);
const say = async (text, wait = 3500) => {
  await p.fill('.tk-field', text);
  await p.press('.tk-field', 'Enter');
  await p.waitForTimeout(wait);
};
await say('Could you please cook for us every day? We really need meals because winter is coming.');
await p.screenshot({ path: `${pre}-reply.png` });
await say('Deal. You have my word, I promise.');
await p.screenshot({ path: `${pre}-deal.png` });
await p.evaluate(() => document.querySelector('[data-t="panel"][data-v="duties"]')?.click());
await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-duties.png` });
await p.evaluate(() => document.querySelector('[data-t="panel"][data-v="invite"]')?.click());
await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('[data-t="invite"]')?.click());
await p.waitForTimeout(400);
await say('Can you two work this out and make peace?', 5000);
await p.screenshot({ path: `${pre}-mediate.png` });
await p.evaluate(() => document.querySelector('[data-t="close"]')?.click());
await p.waitForTimeout(300);
const state = await p.evaluate((id) => { const g = window.__game; const c = g.world.pawns.get(id); return { duties: c.mind.lead.duties, trust: c.mind.lead.trust, chat: c.mind.lead.chat.length, paused: g.mySpeed }; }, id);
console.log(JSON.stringify(state));
await p.tap('#tab-work'); await p.waitForTimeout(400);
await p.screenshot({ path: `${pre}-people.png` });
await p.evaluate(() => document.querySelector('[data-a="talkall"]')?.click());
await p.waitForTimeout(600);
await say('Everyone, we need someone to build walls. Who can help?', 5000);
await p.screenshot({ path: `${pre}-address.png` });
await p.evaluate(() => document.querySelector('[data-t="close"]')?.click());
// an audience request
await p.evaluate(() => { const g = window.__game; const c = g.world.colonists(g.faction)[1]; g.cmd({ c: 'mind', pawn: c.id, d: { action: 'leader', topic: 'complaint', say: 'Boss, I have been sleeping on the dirt for three nights. I need a bed.' }, seen: 0 }); });
await p.waitForTimeout(800);
await p.screenshot({ path: `${pre}-audience.png` });
console.log(errs.join('\n') || 'no errors');
await b.close();
