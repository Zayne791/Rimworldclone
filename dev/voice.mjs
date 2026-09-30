// Voice input end to end with a stand-in SpeechRecognition (headless browsers have no microphone):
// tap the mic, "hear" interim words then a final sentence, and check it is sent to the colonist.
import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPad Pro 11'] });
await ctx.addInitScript(() => {
  class FakeRec {
    constructor() { this.lang = ''; this.interimResults = false; this.continuous = false; }
    start() {
      const words = 'could you please cook for us every day';
      const res = (text, fin) => { const r = [{ transcript: text }]; r.isFinal = fin; return r; };
      setTimeout(() => this.onresult?.({ results: [res('could you please', false)] }), 300);
      setTimeout(() => this.onresult?.({ results: [res(words, false)] }), 700);
      setTimeout(() => this.onresult?.({ results: [res(words + ' we need meals', true)] }), 1100);
      setTimeout(() => this.onend?.(), 1300);
    }
    stop() { setTimeout(() => this.onend?.(), 50); }
    abort() {}
  }
  window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;
});
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
await p.evaluate(() => { localStorage.removeItem('starfall.talk'); const g = window.__game; g.minds.settings.provider = 'offline'; g.minds.save(); g.cmd({ c: 'minds', on: true }); });
await p.waitForTimeout(300);
const id = await p.evaluate(async () => { const g = window.__game; const { openTalk } = await import('/src/ui/talkui.ts'); const c = g.world.colonists(g.faction)[0]; openTalk(g.ui, [c.id]); return c.id; });
await p.waitForTimeout(2200);
await p.tap('[data-t="mic"]');
await p.waitForTimeout(900);
await p.screenshot({ path: 'test-output/voice-listening.png' });
await p.waitForTimeout(3000);
await p.screenshot({ path: 'test-output/voice-reply.png' });
const r = await p.evaluate((id) => { const g = window.__game; const L = g.world.pawns.get(id).mind.lead; return { you: g.ui.talk?.you, chat: L.chat.map(l => (l.who ? 'C: ' : 'L: ') + l.text) }; }, id);
console.log(JSON.stringify(r));
const good = /cook for us every day we need meals/.test(r.you || '') && r.chat.some(l => l.startsWith('L: could you please cook'));
console.log(good ? 'voice ok' : 'VOICE FAIL');
console.log(errs.join('\n') || 'no errors');
await b.close();
process.exit(good ? 0 : 1);
