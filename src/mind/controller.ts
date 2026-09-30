// Runs the minds of this player's colonists: when the simulation asks a colonist for a decision
// (mind.want), build their perception, ask the model, and send the answer back as a 'mind'
// command. Each device only runs its own colonists, so in multiplayer every player pays for (and
// controls the settings of) their own colony's minds.
import type { Game } from '../game';
import type { Pawn } from '../sim/types';
import { perceive } from './perceive';
import { buildMessages, parseDecision } from './prompt';
import { chat, loadSettings, saveSettings, costOf, LLMError, type LLMSettings, type Usage } from './llm';
import { mockDecide } from './mock';

export interface MindStats { calls: number; fails: number; usage: Usage; cost: number; lastError: string; thinking: number; lastMs: number }

export class MindController {
  settings: LLMSettings = loadSettings();
  stats: MindStats = { calls: 0, fails: 0, usage: { hit: 0, miss: 0, out: 0 }, cost: 0, lastError: '', thinking: 0, lastMs: 0 };
  private inflight = new Map<number, AbortController>();
  private stamps: number[] = [];
  private backoff = new Map<number, number>();
  private handled = new Map<number, number>();   // pawn -> the request (want tick) already answered
  private offlineFallback = false;
  private warned = false;
  constructor(public g: Game) {}

  save() { saveSettings(this.settings); this.offlineFallback = false; this.stats.lastError = ''; }
  /** count a model call's tokens and cost (decisions and conversations share the session budget) */
  account(u: Usage, call = true) {
    const s = this.stats;
    s.usage.hit += u.hit; s.usage.miss += u.miss; s.usage.out += u.out;
    s.cost += costOf(u);
    if (call) s.calls++;
  }
  /** no key / no proxy: keep everything running on the offline mind and say why once */
  goOffline(msg: string) {
    if (this.offlineFallback) return;
    this.offlineFallback = true;
    this.g.ui?.toast(`AI minds: ${msg}. Using the offline mind until this is fixed (Menu → AI minds).`, 'bad');
  }
  get enabled(): boolean { return !!this.g.world.playerByFaction(this.g.faction)?.minds; }
  get provider() { return this.offlineFallback ? 'offline' : this.settings.provider; }
  isThinking(id: number) { return this.inflight.has(id); }
  overBudget() { return this.provider !== 'offline' && this.stats.cost >= this.settings.budget; }

  update() {
    const g = this.g, w = g.world;
    if (!this.enabled || w.paused) return;
    const now = performance.now();
    this.stamps = this.stamps.filter(t => now - t < 60000);
    const maxInflight = this.provider === 'offline' ? 4 : 3;
    if (this.inflight.size >= maxInflight || this.stamps.length >= this.settings.perMin) return;
    if (this.overBudget()) {
      if (!this.warned) { this.warned = true; g.ui?.toast(`AI minds paused: session budget $${this.settings.budget.toFixed(2)} reached (Menu → AI minds)`, 'bad'); }
      return;
    }
    // oldest request first; urgent ones (being spoken to, danger) jump the queue
    const want: Pawn[] = [];
    for (const p of w.colonists(g.faction)) {
      const m = p.mind;
      if (!m?.on || !m.want || m.want > w.tick || p.dead || this.inflight.has(p.id) || this.handled.get(p.id) === m.want) continue;
      if ((this.backoff.get(p.id) || 0) > now) continue;
      want.push(p);
    }
    if (!want.length) return;
    const urgency = (p: Pawn) => (/came up to you|hurt|hostile|DANGER|raid|down|died/i.test(p.mind!.why || '') ? -1e9 : 0) + p.mind!.want;
    want.sort((a, b) => urgency(a) - urgency(b));
    this.start(want[0]);
  }

  private start(p: Pawn) {
    const g = this.g, w = g.world;
    const t0 = performance.now();
    this.stamps.push(t0);
    let pc;
    try { pc = perceive(w, p); } catch (e) { console.error('perceive failed', e); this.backoff.set(p.id, t0 + 30000); return; }
    const ac = new AbortController();
    this.inflight.set(p.id, ac);
    this.handled.set(p.id, p.mind!.want);
    this.stats.thinking = this.inflight.size;
    const finish = (d: any) => {
      this.inflight.delete(p.id);
      this.stats.thinking = this.inflight.size;
      this.stats.lastMs = Math.round(performance.now() - t0);
      if (d) { g.cmd({ c: 'mind', pawn: p.id, d, seen: pc!.seen }); this.stats.calls++; }
    };
    if (this.provider === 'offline') {
      setTimeout(() => finish(mockDecide(pc!)), 250 + Math.random() * 600);
      return;
    }
    const timer = setTimeout(() => ac.abort(), 25000);
    chat(this.settings, buildMessages(pc), ac.signal).then(r => {
      clearTimeout(timer);
      this.account(r.usage, false); // the call is counted in finish()
      const d = parseDecision(r.text);
      if (!d) { this.stats.fails++; this.stats.lastError = 'Unreadable answer: ' + r.text.slice(0, 80); finish(mockDecide(pc!)); return; }
      this.stats.lastError = '';
      finish(d);
    }).catch((e: unknown) => {
      clearTimeout(timer);
      this.stats.fails++;
      const err = e instanceof LLMError ? e : new LLMError((e as Error)?.message || String(e));
      this.stats.lastError = err.message;
      this.inflight.delete(p.id);
      this.stats.thinking = this.inflight.size;
      if (err.fatal) {
        // no key / not deployed with one: keep the mode running with the offline mind and say why
        this.handled.delete(p.id);
        this.goOffline(err.message);
        return;
      }
      this.backoff.set(p.id, performance.now() + 15000);
      g.cmd({ c: 'mind', pawn: p.id, fail: true });
    });
  }

  stop() { for (const ac of this.inflight.values()) ac.abort(); this.inflight.clear(); }
}
