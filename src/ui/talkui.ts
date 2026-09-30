// The face-to-face talk screen. Opens a close-up of the colonist's face (animated: blinking, lip-sync,
// emotions), a dialog box that types their words out with their own babbling voice, and a big mic
// button: the leader talks out loud (or types) and the colonist answers in character. Agreements
// made here are the only way work gets done in leader mode. Also hosts mediations between colonists
// in a dispute, and speeches to the whole colony.
import type { UI } from './ui';
import type { Pawn } from '../sim/types';
import { Conversation, type Turn, type TalkMode } from '../mind/talk';
import { lead, dutyText, workLabel, leaderMode, EMERGENCY_WORK } from '../sim/leader';
import { lookOf, lookKey, type Look } from '../render/art/people';
import { talkFace, FACE_W, FACE_H, type FaceExpr } from '../render/art/face';
import { pixToCanvas } from '../render/pixel';
import { Babble, voiceOf, type VoiceProfile } from '../audio/babble';
import { VoiceInput, speechSupported } from './voice';
import { escapeHtml } from '../core/util';
import { pawnShortName } from '../sim/things';
import { fullName } from '../sim/pawngen';
import { BACKSTORIES, WORK_TYPES } from '../data/pawns';
import { openWork } from '../mind/perceive';
import { skillLevel, isIncapable } from '../sim/stats';
import { portraitURL } from './ui';
import { TICKS_PER_DAY } from '../core/constants';

const faceCache = new Map<string, HTMLCanvasElement>();
function faceFrame(L: Look, key: string, e: FaceExpr, mouth: number, blink: number): HTMLCanvasElement {
  const k = `${key}|${e}|${mouth}|${blink}`;
  let c = faceCache.get(k);
  if (!c) {
    c = pixToCanvas(talkFace(L, e, mouth, blink));
    faceCache.set(k, c);
    if (faceCache.size > 900) faceCache.delete(faceCache.keys().next().value!);
  }
  return c;
}

interface Face { id: number; el: HTMLElement; cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; L: Look; key: string; emotion: FaceExpr; mouth: number; mouthT: number; blink: number; blinkT: number; nextBlink: number; voice: VoiceProfile; drawn: string; hop: number }
interface Showing { turn: Turn; shown: number; acc: number; doneT: number }

const PREF = 'starfall.talk';
function prefs(): { typing: boolean } { try { return { typing: false, ...JSON.parse(localStorage.getItem(PREF) || '{}') }; } catch { return { typing: false }; } }
function savePrefs(p: { typing: boolean }) { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* private mode */ } }

const idleExpr = (p: Pawn): FaceExpr => {
  if (p.downed) return 'hurt';
  if (p.mental) return p.mental.kind === 'berserk' || p.mental.kind === 'tantrum' ? 'angry' : 'sad';
  const m = p.needs.mood, t = p.mind?.lead?.trust ?? 0;
  return m < 0.25 ? 'sad' : t < -30 ? 'annoyed' : m > 0.7 ? 'happy' : 'neutral';
};
const mouthFor = (ch: string, e: FaceExpr): number => {
  const c = ch.toLowerCase();
  if (/[ao]/.test(c)) return e === 'sad' || e === 'annoyed' ? 2 : 3;
  if (/[ei]/.test(c)) return 2;
  if (/[uyw]/.test(c)) return 1;
  if (/[mbp\s.,!?;:'"-]/.test(c)) return 0;
  return 1;
};

export class TalkUI {
  el: HTMLElement;
  conv: Conversation;
  faces = new Map<number, Face>();
  queue: Turn[] = [];
  cur: Showing | null = null;
  babble: Babble;
  voice = new VoiceInput();
  typing: boolean;
  interim = '';
  panel = '';
  status = '';
  you = '';
  deals: string[] = [];
  private raf = 0;
  private lastT = 0;
  private t = 0;
  private prevSpeed = -1;
  private sig: Record<string, string> = {};
  private endTimer = 0;

  constructor(public ui: UI, ids: number[], mode: TalkMode) {
    const g = ui.g;
    g.audio.unlock();
    this.babble = new Babble(g.audio);
    this.typing = prefs().typing || !speechSupported();
    this.conv = new Conversation(g, ids, mode);
    this.conv.onReply = t => { this.queue.push(t); };
    this.conv.onUpdate = () => { this.renderInput(); this.renderFaces(true); };
    this.el = document.createElement('div');
    this.el.id = 'talk';
    this.el.className = `tk px mode-${mode}`;
    this.el.innerHTML = `
      <div class="tk-top">
        <button class="btn sm flat" data-t="close" aria-label="close">✕</button>
        <div class="tk-ttl grow"><b></b><div class="tk-sub"></div></div>
        <button class="btn sm" data-t="panel" data-v="duties">Duties</button>
        <button class="btn sm" data-t="panel" data-v="log">Log</button>
        <button class="btn sm tk-inv" data-t="panel" data-v="invite">＋ Bring in</button>
      </div>
      <div class="tk-stage"><div class="tk-faces"></div><div class="tk-meters"></div></div>
      <div class="tk-box" data-t="skip"><div class="tk-tag"></div><div class="tk-text"></div><div class="tk-next">▼</div></div>
      <div class="tk-deals"></div>
      <div class="tk-you"></div>
      <div class="tk-chips"></div>
      <div class="tk-in"></div>
      <div class="tk-panel" hidden></div>`;
    document.getElementById('screens')!.appendChild(this.el);
    this.el.addEventListener('click', e => this.onClick(e));
    this.el.addEventListener('keydown', e => { if ((e.target as HTMLElement).classList.contains('tk-field') && e.key === 'Enter') { e.preventDefault(); this.sendTyped(); } e.stopPropagation(); });
    for (const ev of ['pointerdown', 'wheel', 'touchstart']) this.el.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    // single player: the world waits while you talk
    if (!g.net) { this.prevSpeed = g.mySpeed; if (g.mySpeed) g.setSpeed(0); }
    this.renderTop(); this.renderMeters(); this.renderInput(); this.renderChips(); this.renderBox();
    this.drawBackdrop();
    this.buildFaces();
    this.conv.open().catch(e => console.error('talk open failed', e));
    this.lastT = performance.now();
    const loop = (now: number) => { this.step(Math.min(0.1, (now - this.lastT) / 1000)); this.lastT = now; this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener('resize', this.onResize);
  }

  get g() { return this.ui.g; }
  get w() { return this.g.world; }
  private onResize = () => { this.drawBackdrop(); this.buildFaces(); this.renderFaces(true); };

  /** the planet behind them: sky by time of day, distant ridges, the colony's ground */
  drawBackdrop() {
    const st = this.el.querySelector('.tk-stage') as HTMLElement;
    let cv = st.querySelector('canvas.tk-bg') as HTMLCanvasElement | null;
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'tk-bg'; st.prepend(cv); }
    const W = 160, H = Math.max(60, Math.round(160 * (st.clientHeight || 400) / (st.clientWidth || 600)));
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d')!;
    const hr = this.w.hour;
    const night = hr < 5 || hr >= 21, dawn = hr >= 5 && hr < 8, dusk = hr >= 17 && hr < 21;
    const [top, bot] = night ? ['#0a0e24', '#1e2650'] : dawn ? ['#2a3668', '#f0a070'] : dusk ? ['#28265a', '#e87850'] : ['#3a6ab8', '#a8d4ec'];
    const g = c.createLinearGradient(0, 0, 0, H * 0.75);
    g.addColorStop(0, top); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const seed = (this.g.faction * 977 + 13) | 0;
    const rnd = (k: number) => { let h = Math.imul(seed ^ (k * 2654435761), 0x85ebca6b); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000; };
    if (night || dusk) for (let k = 0; k < 60; k++) { c.fillStyle = `rgba(255,255,255,${(night ? 0.5 : 0.25) + rnd(k + 500) * 0.5})`; c.fillRect(Math.floor(rnd(k) * W), Math.floor(rnd(k + 99) * H * 0.55), 1, 1); }
    // a sun or moon, and the ringed gas giant this frontier world orbits
    const sx = Math.round(W * (night ? 0.78 : 0.2 + ((hr - 6) / 14) * 0.6)), sy = Math.round(H * (night ? 0.16 : 0.12 + Math.abs(hr - 12.5) / 7 * 0.35));
    c.fillStyle = night ? '#e8e8f0' : '#fff2c0'; c.beginPath(); c.arc(sx, sy, night ? 4 : 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = night ? 'rgba(170,140,200,0.55)' : 'rgba(255,255,255,0.28)'; c.beginPath(); c.arc(Math.round(W * 0.14), Math.round(H * 0.2), 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = night ? 'rgba(200,170,230,0.5)' : 'rgba(255,255,255,0.3)'; c.fillRect(Math.round(W * 0.14) - 17, Math.round(H * 0.2), 34, 1);
    // ridges: far, near
    const ground = Math.round(H * 0.8);
    const ridge = (base: number, amp: number, freq: number, col: string, k0: number) => {
      c.fillStyle = col;
      for (let x = 0; x < W; x++) {
        const y = base - amp * (0.55 * Math.sin(x * freq + rnd(k0) * 6) + 0.3 * Math.sin(x * freq * 2.7 + rnd(k0 + 1) * 6) + 0.15 * Math.sin(x * freq * 6.1));
        c.fillRect(x, Math.round(y), 1, H - Math.round(y));
      }
    };
    ridge(ground - H * 0.16, H * 0.07, 0.05, night ? '#232848' : dusk || dawn ? '#5a3a5a' : '#6a86a8', 1);
    ridge(ground - H * 0.06, H * 0.05, 0.09, night ? '#1a1c34' : dusk || dawn ? '#3a2840' : '#4a6078', 7);
    // the colony's ground, with a comms mast blinking on the horizon
    c.fillStyle = night ? '#1c1a24' : '#3a3a2c'; c.fillRect(0, ground, W, H - ground);
    c.fillStyle = night ? '#24222e' : '#4a4a36';
    for (let k = 0; k < 40; k++) c.fillRect(Math.floor(rnd(k + 900) * W), ground + 1 + Math.floor(rnd(k + 950) * (H - ground - 1)), 2, 1);
    const mx = Math.round(W * 0.84);
    c.fillStyle = night ? '#101018' : '#2a2a30'; c.fillRect(mx, ground - 14, 1, 14); c.fillRect(mx - 3, ground - 9, 7, 1); c.fillRect(mx - 2, ground - 4, 5, 1);
    c.fillStyle = '#ff5040'; c.fillRect(mx, ground - 15, 1, 1);
  }

  // ---------------- faces ----------------
  /** biggest whole-pixel scale at which everyone fits on the stage */
  private scale(n: number): number {
    const st = this.el.querySelector('.tk-stage') as HTMLElement;
    const W = (st?.clientWidth || window.innerWidth) - 24, H = (st?.clientHeight || window.innerHeight * 0.45) - 16;
    const rows = n > 4 ? 2 : 1, cols = Math.ceil(n / rows);
    const s = Math.floor(Math.min((W - (cols - 1) * 12) / cols / FACE_W, H / rows / (FACE_H + 1)));
    return Math.max(2, Math.min(n === 1 ? 11 : 8, s));
  }
  buildFaces() {
    const wrap = this.el.querySelector('.tk-faces') as HTMLElement;
    const ids = this.conv.ids;
    const S = this.scale(ids.length);
    const keep = new Map(this.faces);
    wrap.innerHTML = '';
    this.faces.clear();
    for (const id of ids) {
      const p = this.w.pawns.get(id);
      if (!p) continue;
      const old = keep.get(id);
      const el = document.createElement('div');
      el.className = 'tk-face';
      el.dataset.id = String(id);
      const cv = document.createElement('canvas');
      cv.width = FACE_W * S; cv.height = (FACE_H + 1) * S;
      el.innerHTML = `<div class="tk-dots"><i></i><i></i><i></i></div><div class="tk-fname">${escapeHtml(pawnShortName(p))}</div>`;
      el.prepend(cv);
      wrap.appendChild(el);
      const cx = cv.getContext('2d')!;
      cx.imageSmoothingEnabled = false;
      const L = lookOf(p);
      this.faces.set(id, old ? { ...old, el, cv, cx, drawn: '' } : { id, el, cv, cx, L, key: lookKey(L), emotion: idleExpr(p), mouth: 0, mouthT: 0, blink: 0, blinkT: 0, nextBlink: 1 + Math.random() * 3, voice: voiceOf(p), drawn: '', hop: 0 });
    }
    wrap.classList.toggle('many', ids.length > 2);
  }
  renderFaces(force = false) {
    const speaking = this.cur && this.cur.shown < this.cur.turn.text.length ? this.cur.turn.who : this.cur?.turn.who;
    for (const f of this.faces.values()) {
      const p = this.w.pawns.get(f.id);
      const thinking = this.conv.thinking.has(f.id);
      const gone = this.conv.left.has(f.id) || !p || p.dead;
      f.el.classList.toggle('think', thinking);
      f.el.classList.toggle('speak', speaking === f.id);
      f.el.classList.toggle('gone', gone);
      const e: FaceExpr = thinking ? 'thinking' : f.emotion;
      const S = f.cv.width / FACE_W;
      const bob = Math.round(Math.sin(this.t * 1.7 + f.id) * 0.6) + (f.hop > 0 ? -1 : 0);
      const sig = `${e}${f.mouth}${f.blink}${bob}`;
      if (!force && f.drawn === sig) continue;
      f.drawn = sig;
      f.cx.clearRect(0, 0, f.cv.width, f.cv.height);
      f.cx.drawImage(faceFrame(f.L, f.key, e, f.mouth, f.blink), 0, (1 + bob) * S, FACE_W * S, FACE_H * S);
    }
  }

  // ---------------- per frame ----------------
  private step(dt: number) {
    this.t += dt;
    if (!this.cur && this.queue.length) this.startTurn(this.queue.shift()!);
    const c = this.cur;
    if (c && c.shown < c.turn.text.length) {
      const f = this.faces.get(c.turn.who);
      const v = f?.voice || voiceOf(this.w.pawns.get(c.turn.who)!);
      const cps = this.babble.rate(v, c.turn.emotion || 'neutral');
      c.acc += dt;
      const stepT = 1 / cps;
      let changed = false;
      while (c.acc >= stepT && c.shown < c.turn.text.length) {
        c.acc -= stepT;
        const ch = c.turn.text[c.shown];
        this.babble.blip(c.turn.text, c.shown, v, c.turn.emotion || 'neutral');
        c.shown++;
        changed = true;
        if (f) { f.mouth = mouthFor(ch, f.emotion); f.mouthT = stepT * 1.6; if (ch === ' ' && Math.random() < 0.25) f.hop = 0.08; }
        if ('.!?'.includes(ch)) c.acc -= 0.3; else if (',;:'.includes(ch)) c.acc -= 0.14;
      }
      if (changed) this.renderBox();
      if (c.shown >= c.turn.text.length) this.turnShown();
    } else if (c && this.queue.length) {
      // the next speaker waiting: move on after a moment to read
      c.doneT += dt;
      if (c.doneT > 1.2 + c.turn.text.length / 60) this.cur = null;
    }
    for (const f of this.faces.values()) {
      if (f.mouthT > 0) { f.mouthT -= dt; if (f.mouthT <= 0) f.mouth = 0; }
      if (f.hop > 0) f.hop -= dt;
      f.nextBlink -= dt;
      if (f.nextBlink <= 0) { f.blinkT += dt; f.blink = f.blinkT < 0.05 ? 1 : f.blinkT < 0.13 ? 2 : f.blinkT < 0.18 ? 1 : 0; if (f.blinkT >= 0.18) { f.blinkT = 0; f.blink = 0; f.nextBlink = 1.8 + Math.random() * 3.5; } }
    }
    this.renderFaces();
    // the "…" in the box while someone is thinking
    if (!this.cur && this.conv.busy) this.renderBox();
  }
  private startTurn(t: Turn) {
    this.cur = { turn: t, shown: 0, acc: 0, doneT: 0 };
    const f = this.faces.get(t.who);
    if (f) f.emotion = (t.emotion as FaceExpr) || 'neutral';
    this.deals = [];
    this.renderBox(); this.renderDeals();
    const nm = this.el.querySelector('.tk-tag') as HTMLElement;
    const p = this.w.pawns.get(t.who);
    nm.textContent = p ? pawnShortName(p) : '';
  }
  private turnShown() {
    const t = this.cur!.turn;
    const d: string[] = [];
    for (const a of t.agreed || []) {
      const du = this.w.pawns.get(t.who)?.mind?.lead?.duties.find(x => x.work === a);
      d.push(`<span class="deal good">✔ ${escapeHtml(du ? dutyText(du) : workLabel(a))}</span>`);
    }
    for (const x of t.dropped || []) d.push(`<span class="deal bad">✖ No more ${escapeHtml(workLabel(x).toLowerCase())}</span>`);
    if (t.promise) d.push(`<span class="deal accent">🤝 You promised: ${escapeHtml(t.promise)}</span>`);
    const tr = Math.round(t.trust || 0);
    if (tr) d.push(`<span class="deal ${tr > 0 ? 'good' : 'bad'}">Trust ${tr > 0 ? '+' : ''}${tr}</span>`);
    this.deals = d;
    if (t.agreed?.length) this.g.audio.play('letter_good');
    if (t.end) this.status = `${pawnShortName(this.w.pawns.get(t.who)!)} walks off.`;
    this.renderDeals(); this.renderMeters(); this.renderChips(); this.renderInput(); this.renderTop();
    if (t.end && !this.conv.present.length && !this.endTimer) this.endTimer = window.setTimeout(() => this.close(), 2600);
  }

  // ---------------- rendering ----------------
  renderTop() {
    const ps = this.conv.ids.map(id => this.w.pawns.get(id)).filter(Boolean) as Pawn[];
    const b = this.el.querySelector('.tk-ttl b') as HTMLElement, s = this.el.querySelector('.tk-sub') as HTMLElement;
    if (this.conv.mode === 'address') { b.textContent = 'Addressing the colony'; s.textContent = `${ps.length} listening`; }
    else if (ps.length === 1) {
      const p = ps[0];
      b.textContent = fullName(p);
      const bs = p.story ? BACKSTORIES.find(x => x.id === p.story!.adult)?.title : '';
      const L = lead(p);
      s.textContent = [bs, L.duties.length ? `does: ${L.duties.map(d => workLabel(d.work)).join(', ')}` : 'no duties yet'].filter(Boolean).join(' · ');
    } else { b.textContent = ps.map(pawnShortName).join(' & '); s.textContent = 'Settling things between them'; }
    (this.el.querySelector('.tk-inv') as HTMLElement).style.display = this.conv.mode === 'address' ? 'none' : '';
  }
  renderMeters() {
    const el = this.el.querySelector('.tk-meters') as HTMLElement;
    const ps = this.conv.present;
    if (this.conv.mode === 'address' || !ps.length) { el.innerHTML = ''; return; }
    el.innerHTML = ps.slice(0, 2).map(p => {
      const tr = Math.round(lead(p).trust), mood = p.needs.mood;
      const tw = Math.abs(tr) / 2;
      return `<div class="tk-meter">${ps.length > 1 ? `<b>${escapeHtml(pawnShortName(p))}</b>` : ''}
        <span>Trust</span><div class="tkbar trust"><i style="${tr >= 0 ? `left:50%;width:${tw}%` : `left:${50 - tw}%;width:${tw}%`};background:${tr >= 0 ? '#7fd67a' : '#ff6a5a'}"></i><em></em></div><b class="${tr >= 0 ? 'good' : 'bad'}">${tr > 0 ? '+' : ''}${tr}</b>
        <span>Mood</span><div class="tkbar"><i style="left:0;width:${Math.round(mood * 100)}%;background:${mood < 0.3 ? '#ff6a5a' : mood < 0.55 ? '#e8c860' : '#7fb0e0'}"></i></div><b>${Math.round(mood * 100)}%</b></div>`;
    }).join('');
  }
  renderBox() {
    const el = this.el.querySelector('.tk-text') as HTMLElement;
    const box = this.el.querySelector('.tk-box') as HTMLElement;
    const c = this.cur;
    if (c) {
      const txt = c.turn.text;
      el.innerHTML = `${escapeHtml(txt.slice(0, c.shown))}<span class="ghost">${escapeHtml(txt.slice(c.shown))}</span>`;
      box.classList.toggle('done', c.shown >= txt.length);
      box.classList.toggle('more', c.shown >= txt.length && this.queue.length > 0);
      box.classList.remove('wait');
      return;
    }
    const thinker = [...this.conv.thinking][0];
    const tag = this.el.querySelector('.tk-tag') as HTMLElement;
    if (thinker) {
      const p = this.w.pawns.get(thinker);
      tag.textContent = p ? pawnShortName(p) : '';
      const dots = '.'.repeat(1 + (Math.floor(this.t * 3) % 3));
      if (el.dataset.dots !== dots) { el.dataset.dots = dots; el.innerHTML = `<span class="dim">${dots}</span>`; }
      box.classList.add('wait');
    } else if (!this.conv.turns.length && this.conv.mode === 'address') {
      tag.textContent = '';
      el.innerHTML = '<span class="dim">Everyone has gathered round. Say something to the whole colony.</span>';
    }
  }
  renderDeals() {
    const el = this.el.querySelector('.tk-deals') as HTMLElement;
    const h = this.deals.join('') + (this.status ? `<span class="deal dim">${escapeHtml(this.status)}</span>` : '');
    if (this.sig.deals !== h) { this.sig.deals = h; el.innerHTML = h; }
  }
  renderInput() {
    const el = this.el.querySelector('.tk-in') as HTMLElement;
    const busy = this.conv.busy;
    const none = !this.conv.present.length;
    const listening = this.voice.listening;
    const you = this.el.querySelector('.tk-you') as HTMLElement;
    const yh = listening ? `<span class="accent">🎙 ${this.interim ? escapeHtml(this.interim) : 'Listening…'}</span>` : this.you ? `<span class="dim">You:</span> “${escapeHtml(this.you)}”` : '';
    if (this.sig.you !== yh) { this.sig.you = yh; you.innerHTML = yh; }
    const sig = `${this.typing}${busy}${none}${listening}`;
    if (this.sig.input === sig) return;
    this.sig.input = sig;
    const dis = busy || none ? 'disabled' : '';
    if (this.typing) {
      const had = el.querySelector('.tk-field') as HTMLInputElement | null;
      const val = had?.value || '';
      el.innerHTML = `<input class="tk-field" type="text" placeholder="${none ? 'Nobody is listening' : busy ? 'They are thinking…' : 'Say something…'}" autocomplete="off" enterkeyhint="send" ${dis}>
        <button class="btn good" data-t="send" ${dis}>Say</button>
        ${speechSupported() ? '<button class="btn sm flat" data-t="mode" title="Talk with your voice">🎙</button>' : ''}`;
      const f = el.querySelector('.tk-field') as HTMLInputElement;
      f.value = val;
      if (!busy && !none && window.innerWidth > 700) f.focus();
    } else {
      el.innerHTML = `<button class="tk-mic ${listening ? 'on' : ''}" data-t="mic" ${dis}><span class="tk-mic-ic">🎙</span><span class="tk-mic-l">${listening ? 'Tap when done' : busy ? 'Thinking…' : none ? 'Nobody listening' : 'Tap to talk'}</span></button>
        <button class="btn sm flat tk-kb" data-t="mode" title="Type instead">⌨ Type</button>`;
    }
  }
  renderChips() {
    const el = this.el.querySelector('.tk-chips') as HTMLElement;
    const s = this.suggestions();
    el.innerHTML = s.map(x => `<button class="chip tk-chip" data-t="say" data-v="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');
  }
  suggestions(): string[] {
    const w = this.w, ps = this.conv.present;
    if (!ps.length) return [];
    if (this.conv.mode === 'address') return ['We need someone on cooking. Who can do it?', 'You have all done great work. Thank you.', 'Winter is coming, so we have to prepare.', 'Is anyone unhappy? Speak up.', 'Who wants to help with the building?'];
    const p = ps[0], L = lead(p);
    const out: string[] = [];
    const last = [...this.conv.turns].reverse().find(t => t.who !== 0);
    if (last && !last.agreed?.length && /\bif I\b|what's in it|I want|in return|maybe/i.test(last.text)) out.push('Deal. You have my word.');
    if (this.conv.mode === 'mediate' && ps.length > 1) {
      out.push(`${pawnShortName(ps[0])}, ${pawnShortName(ps[1])}, can you two work this out?`, `${pawnShortName(ps[1])}, what's your side of this?`);
    }
    try {
      const taken = new Set<string>();
      for (const o of w.colonists(p.faction)) for (const d of o.mind?.lead?.duties || []) taken.add(d.work);
      const open = openWork(w, p).filter(x => x.open && !isIncapable(p, x.id) && !L.duties.some(d => d.work === x.id) && !EMERGENCY_WORK.includes(x.id))
        .sort((a, b) => (taken.has(a.id) ? 1 : 0) - (taken.has(b.id) ? 1 : 0) || b.skill - a.skill);
      const say = (id: string) => ({ cook: 'the cooking', grow: 'the crops', construct: 'the building work', haul: 'the hauling', clean: 'the cleaning', research: 'some research', mine: 'the mining', hunt: 'some hunting', plantcut: 'cutting trees', handle: 'the animals', warden: 'the prisoners', art: 'some art', smith: 'making weapons', tailor: 'making clothes', craft: 'the crafting', doctor: 'looking after the sick' } as Record<string, string>)[id] || workLabel(id).toLowerCase();
      if (open[0]) out.push(`Could you take care of ${say(open[0].id)} for us?`);
      if (open[1]) out.push(`Would you make ${say(open[1].id)} your regular job?`);
      if (!open.length) {
        // nothing waiting yet: offer them the work they're best at, ready for when it comes
        const best = WORK_TYPES.filter(t => !t.hidden && t.skills[0] && !isIncapable(p, t.id) && !L.duties.some(d => d.work === t.id))
          .map(t => ({ t, v: skillLevel(p, t.skills[0]) + (p.skills[t.skills[0]]?.passion || 0) * 4 })).sort((a, b) => b.v - a.v)[0];
        const GOOD: Record<string, string> = { cook: 'cooking', grow: 'growing things', construct: 'building', mine: 'mining', plantcut: 'working with wood', handle: 'animals', warden: 'people', art: 'art', smith: 'smithing', tailor: 'sewing', craft: 'crafting', research: 'research', doctor: 'medicine', hunt: 'hunting' };
        if (best) out.push(`You're good at ${GOOD[best.t.id] || best.t.label.toLowerCase()}. Would you take charge of ${say(best.t.id)}?`);
      }
      if (L.duties.length) out.push(`Thanks for all the work on ${say(L.duties[0].work)}.`);
    } catch { /* probing work can fail mid-change; suggestions are optional */ }
    out.push('How are you doing?');
    if (!last) out.push("What's on your mind?");
    out.push("That's all for now. Thanks.");
    return out.slice(0, 6);
  }
  renderPanel() {
    const el = this.el.querySelector('.tk-panel') as HTMLElement;
    if (!this.panel) { el.hidden = true; return; }
    el.hidden = false;
    const w = this.w;
    let h = `<div class="row"><b class="grow">${this.panel === 'duties' ? 'Agreements' : this.panel === 'log' ? 'Conversation' : 'Bring someone in'}</b><button class="btn sm flat" data-t="panel" data-v="">✕</button></div><div class="tk-pbody scroll">`;
    const ps = this.conv.ids.map(id => w.pawns.get(id)).filter(Boolean) as Pawn[];
    if (this.panel === 'duties') {
      for (const p of ps) {
        const L = lead(p);
        h += `<h3>${escapeHtml(pawnShortName(p))} <span class="small ${L.trust >= 0 ? 'good' : 'bad'}">trust ${Math.round(L.trust)}</span></h3>`;
        h += L.duties.length ? L.duties.map((d, k) => `<div class="tk-duty"><span class="grow">${escapeHtml(dutyText(d))} <span class="dim tiny">· done ${d.done}×</span></span>${k ? `<button class="btn sm flat" data-t="dutyup" data-p="${p.id}" data-id="${d.id}" title="Do this first">↑</button>` : ''}<button class="btn sm" data-t="release" data-p="${p.id}" data-id="${d.id}">Release</button></div>`).join('')
          : '<div class="dim small">No duties. They only do what they agree to (plus firefighting and tending the wounded).</div>';
        if (L.promises.length) h += `<div class="small" style="margin-top:4px"><b>Your promises:</b> ${L.promises.map(x => `“${escapeHtml(x.text)}” <span class="dim tiny">day ${Math.floor(x.t / TICKS_PER_DAY) + 1}</span>`).join(' · ')}</div>`;
      }
      h += `<div class="tiny dim" style="margin-top:6px">You can always release someone from a duty. Asking for more takes a conversation.</div>`;
    } else if (this.panel === 'log') {
      const name = (id: number) => (id === 0 ? 'You' : pawnShortName(w.pawns.get(id) || ps[0]));
      if (ps.length === 1) {
        const earlier = lead(ps[0]).chat.filter(l => l.t < this.conv.started);
        if (earlier.length) h += `<div class="tiny dim">Earlier</div>` + earlier.map(l => `<div class="tk-log ${l.who === 0 ? 'me' : ''}"><b>${escapeHtml(name(l.who))}</b> ${escapeHtml(l.text)}</div>`).join('') + '<div class="sep"></div>';
      }
      h += this.conv.turns.map(t => `<div class="tk-log ${t.who === 0 ? 'me' : ''}"><b>${escapeHtml(name(t.who))}</b> ${escapeHtml(t.text)}</div>`).join('') || '<div class="dim small">Nothing said yet.</div>';
    } else if (this.panel === 'invite') {
      const others = w.colonists(this.g.faction).filter(o => !this.conv.ids.includes(o.id) && o.mind);
      h += others.length ? others.map(o => `<button class="btn tk-pick" data-t="invite" data-id="${o.id}"><img class="ico l" src="${portraitURL(o)}"><span>${escapeHtml(pawnShortName(o))}<br><span class="tiny dim">opinion ${Math.round(this.conv.present[0]?.rel[o.id]?.op || 0)}</span></span></button>`).join('')
        : '<div class="dim small">Nobody else to bring in.</div>';
      h += `<div class="tiny dim" style="margin-top:6px">Bring in the other side of a quarrel to mediate, or anyone whose opinion matters.</div>`;
    }
    el.innerHTML = h + '</div>';
  }

  // ---------------- actions ----------------
  private onClick(e: Event) {
    const t = (e.target as HTMLElement).closest('[data-t]') as HTMLElement | null;
    e.stopPropagation();
    if (!t) return;
    this.g.audio.unlock();
    const d = t.dataset;
    switch (d.t) {
      case 'close': this.close(); break;
      case 'skip': this.skip(); break;
      case 'send': this.sendTyped(); break;
      case 'say': this.send(d.v || ''); break;
      case 'mic': this.toggleMic(); break;
      case 'mode': this.typing = !this.typing; savePrefs({ typing: this.typing }); this.voice.cancel(); this.sig.input = ''; this.renderInput(); break;
      case 'panel': this.panel = this.panel === d.v ? '' : d.v || ''; this.renderPanel(); break;
      case 'release': this.g.cmd({ c: 'duty', pawn: +d.p!, id: +d.id!, op: 'drop' }); setTimeout(() => { this.renderPanel(); this.renderTop(); }, 80); break;
      case 'dutyup': this.g.cmd({ c: 'duty', pawn: +d.p!, id: +d.id!, op: 'up' }); setTimeout(() => this.renderPanel(), 80); break;
      case 'invite': {
        const p = this.w.pawns.get(+d.id!);
        if (p) { this.conv.invite(p); this.buildFaces(); this.renderFaces(true); this.renderTop(); this.renderMeters(); this.renderChips(); this.el.className = `tk px mode-${this.conv.mode}`; }
        this.panel = ''; this.renderPanel();
        break;
      }
    }
  }
  /** tap the dialog box: finish the line, or move on to the next speaker */
  skip() {
    const c = this.cur;
    if (!c) return;
    if (c.shown < c.turn.text.length) { c.shown = c.turn.text.length; this.renderBox(); this.turnShown(); return; }
    if (this.queue.length) { this.cur = null; }
  }
  private sendTyped() {
    const f = this.el.querySelector('.tk-field') as HTMLInputElement | null;
    if (!f) return;
    const v = f.value.trim();
    if (!v) return;
    f.value = '';
    this.send(v);
  }
  send(text: string) {
    text = text.trim();
    if (!text || this.conv.busy || !this.conv.present.length) return;
    if (this.cur && this.cur.shown < this.cur.turn.text.length) { this.cur.shown = this.cur.turn.text.length; this.turnShown(); }
    this.cur = null; this.queue.length = 0;
    this.you = text; this.deals = []; this.status = '';
    this.renderDeals();
    this.g.audio.play('click');
    this.conv.say(text).then(() => { this.renderChips(); this.renderInput(); }).catch(e => console.error('talk failed', e));
    this.renderInput();
  }
  private toggleMic() {
    if (this.voice.listening) { this.voice.stop(); return; }
    if (this.conv.busy) return;
    this.interim = '';
    this.voice.start({
      interim: t => { this.interim = t; this.renderInput(); },
      final: t => { this.interim = ''; this.sig.input = ''; this.send(t); this.renderInput(); },
      end: (r, msg) => {
        this.interim = ''; this.sig.input = '';
        if (r === 'error') { this.ui.toast(msg || 'Voice input failed', 'bad'); if (!speechSupported() || /blocked|supported/.test(msg || '')) { this.typing = true; } }
        else if (r === 'nothing') this.ui.toast("Didn't catch that. Tap the mic and speak.");
        this.renderInput();
      },
    });
    this.sig.input = '';
    this.renderInput();
  }

  close() {
    if (!this.el.isConnected) return;
    clearTimeout(this.endTimer);
    this.conv.close();
    this.voice.cancel();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.el.remove();
    const g = this.g;
    if (this.prevSpeed > 0 && g.mySpeed === 0) g.setSpeed(this.prevSpeed);
    if (this.ui.talk === this) this.ui.talk = null;
    this.ui.sig.col = '';
  }
}

/** open a face-to-face talk (one person, a mediation, or the whole colony) */
export function openTalk(ui: UI, ids: number[], mode: TalkMode = ids.length > 1 ? 'mediate' : 'one'): TalkUI | null {
  const g = ui.g, w = g.world;
  if (!g.minds.enabled) { ui.toast('Turn on AI minds first (Menu → AI minds)', 'bad'); return null; }
  const ps = ids.map(id => w.pawns.get(id)).filter(p => p && !p.dead && p.faction === g.faction && p.mind) as Pawn[];
  if (!ps.length) { ui.toast('Nobody here to talk to', 'bad'); return null; }
  const broken = ps.find(p => p.mental && ['berserk', 'catatonic', 'give_up'].includes(p.mental.kind));
  if (broken && mode !== 'address') { ui.toast(`${pawnShortName(broken)} is in no state to talk right now`, 'bad'); return null; }
  ui.talk?.close();
  ui.closeModal();
  ui.talk = new TalkUI(ui, ps.map(p => p.id), mode);
  return ui.talk;
}
export function addressColony(ui: UI) {
  const g = ui.g;
  const ids = g.world.colonists(g.faction).filter(p => p.mind && !p.dead && !(p.mental && ['berserk', 'catatonic'].includes(p.mental.kind))).slice(0, 10).map(p => p.id);
  return openTalk(ui, ids, 'address');
}

/** the leader-mode people view that replaces the work priority grid */
export function peopleHtml(ui: UI): string {
  const g = ui.g, w = g.world;
  const cols = w.colonists(g.faction);
  const lm = leaderMode(w, g.faction);
  let h = `<div class="small">${lm ? 'Nobody takes orders here. Each colonist only does what they have <b>agreed to with you</b> in conversation (firefighting and tending the wounded they do anyway). Talk to them: ask, explain, persuade, bargain.' : 'Leader mode is off: colonists pick work themselves from the colony\'s needs.'}</div>
    <div class="row wrap" style="margin:8px 0"><button class="btn good" data-a="talkall">📣 Address everyone</button></div>`;
  for (const p of cols) {
    const L = p.mind ? lead(p) : null;
    const tr = Math.round(L?.trust || 0);
    const asks = L?.audience;
    h += `<div class="ppl ${asks ? 'asks' : ''}">
      <img class="ico l" src="${portraitURL(p)}">
      <div class="grow"><b>${escapeHtml(pawnShortName(p))}</b> <span class="tiny ${tr >= 0 ? 'good' : 'bad'}">trust ${tr > 0 ? '+' : ''}${tr}</span> <span class="tiny dim">mood ${Math.round(p.needs.mood * 100)}%</span>
        <div class="tiny">${L?.duties.length ? L.duties.map(d => `<span class="chip sm">${escapeHtml(workLabel(d.work))}${d.regular ? '' : ' ·1×'}</span>`).join('') : '<span class="dim">no duties</span>'}</div>
        ${asks ? `<div class="tiny accent">💬 “${escapeHtml(asks.text)}”</div>` : ''}
        ${bestAt(p)}</div>
      <button class="btn ${asks ? 'good' : ''}" data-a="talkopen" data-id="${p.id}">Talk</button></div>`;
  }
  return h;
}
function bestAt(p: Pawn): string {
  const best = WORK_TYPES.filter(t => !t.hidden && t.skills[0] && !isIncapable(p, t.id)).map(t => ({ t, l: skillLevel(p, t.skills[0]), pa: p.skills[t.skills[0]]?.passion || 0 }))
    .sort((a, b) => b.l + b.pa * 3 - (a.l + a.pa * 3)).slice(0, 3);
  return `<div class="tiny dim">Good at: ${best.map(b => `${b.t.label.toLowerCase()} ${b.l}${b.pa ? (b.pa === 2 ? '🔥' : '♨') : ''}`).join(', ')}</div>`;
}
