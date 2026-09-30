// Procedural WebAudio sound effects and generative ambient music (no audio files needed).
type Voice = (a: AudioEngine, t: number, v: number) => void;

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; music!: GainNode;
  noise!: AudioBuffer;
  sfxVol = 0.6; musicVol = 0.35; muted = false;
  last = new Map<string, number>();
  listener = { x: 0, y: 0, range: 40 };
  musicOn = true;
  private musicTimer: number | null = null;
  private chordIdx = 0;

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem('sf_audio') || '{}');
      if (typeof s.sfx === 'number') this.sfxVol = s.sfx;
      if (typeof s.music === 'number') this.musicVol = s.music;
      if (typeof s.muted === 'boolean') this.muted = s.muted;
    } catch { /* ignore */ }
  }
  saveSettings() { try { localStorage.setItem('sf_audio', JSON.stringify({ sfx: this.sfxVol, music: this.musicVol, muted: this.muted })); } catch { /* ignore */ } }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx!;
    this.master = c.createGain(); this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.connect(this.master);
    this.applyVolumes();
    const len = c.sampleRate * 1.5;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicOn) this.startMusic();
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sfxVol;
    this.music.gain.value = this.musicVol * 0.5;
  }

  setListener(x: number, y: number, range: number) { this.listener = { x, y, range }; }

  play(name: string, x?: number, y?: number) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const l = this.last.get(name) || 0;
    if (now - l < (name === 'rifle' || name === 'pistol' ? 0.03 : 0.07)) return;
    this.last.set(name, now);
    let v = 1;
    if (x !== undefined && y !== undefined) {
      const d = Math.hypot(x - this.listener.x, y - this.listener.y);
      v = Math.max(0, 1 - d / this.listener.range);
      if (v < 0.05) return;
    }
    const fn = VOICES[name];
    if (fn) fn(this, now, v);
  }

  // ---------- primitives ----------
  tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, attack = 0.004) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(t: number, dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', dest?: AudioNode) {
    const c = this.ctx!;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- music ----------
  /** 'calm' drifts through frontier chord progressions; 'danger' (raids, manhunters) switches to a tense pulse */
  musicMood: 'calm' | 'danger' = 'calm';
  private section = 0;
  setMusicMood(m: 'calm' | 'danger') { this.musicMood = m; }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    // chord roots + intervals (A minor-ish frontier palette, a hopeful major section, a wistful one)
    const PROGS: number[][][] = [
      [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]],
      [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      [[50, 53, 57], [55, 58, 62], [48, 52, 55], [53, 57, 60]],
      [[57, 60, 64], [55, 60, 64], [53, 57, 62], [52, 56, 59]],
    ];
    const PENTA = [0, 2, 4, 7, 9, 12, 14];
    const loop = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05;
      if (this.musicMood === 'danger') {
        // low pulsing ostinato over a dark drone
        const root = [45, 45, 46, 43][this.chordIdx++ % 4];
        this.pad(t, midi(root - 12), 4.2, 0.05);
        this.pad(t, midi(root - 5), 4.2, 0.03);
        for (let k = 0; k < 8; k++) this.pluck(t + k * 0.5, midi(root + (k % 4 === 3 ? 3 : 0)), 0.045, 0.5);
        if (Math.random() < 0.5) this.pluck(t + 3.5, midi(root + 15), 0.03, 1.2);
        this.musicTimer = window.setTimeout(loop, 4000);
        return;
      }
      if (this.chordIdx % 8 === 0) this.section = Math.floor(Math.random() * PROGS.length);
      const ch = PROGS[this.section][this.chordIdx++ % 4];
      for (const n of ch) this.pad(t, midi(n - 12), 7.5, 0.045);
      this.pluck(t, midi(ch[0] - 24), 0.07, 3.5); // soft bass
      if (Math.random() < 0.55) {
        // a short melodic phrase on the pentatonic scale above the chord
        let step = Math.floor(Math.random() * 3);
        for (let k = 0; k < 5; k++) {
          if (Math.random() < 0.25) continue;
          step = Math.max(0, Math.min(PENTA.length - 1, step + (Math.random() < 0.5 ? -1 : 1)));
          this.pluck(t + 0.9 + k * 1.1 + Math.random() * 0.15, midi(ch[0] + 12 + PENTA[step]), 0.05);
        }
      } else {
        for (let k = 0; k < 4; k++) if (Math.random() < 0.6) this.pluck(t + k * 1.8 + Math.random() * 0.4, midi(ch[Math.floor(Math.random() * 3)] + 12), 0.05);
      }
      this.musicTimer = window.setTimeout(loop, 7200);
    };
    loop();
  }
  stopMusic() { if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; } }
  pad(t: number, f: number, dur: number, vol: number) {
    const c = this.ctx!;
    for (const det of [-4, 4]) {
      const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      lp.type = 'lowpass'; lp.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 2.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  pluck(t: number, f: number, vol: number, len = 1.6) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const dl = c.createDelay(); dl.delayTime.value = 0.38; const fb = c.createGain(); fb.gain.value = 0.35;
    o.connect(g); g.connect(this.music); g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.music);
    o.start(t); o.stop(t + len + 0.1);
  }
}

const VOICES: Record<string, Voice> = {
  click: (a, t, v) => a.tone(t, 900, 0.05, 'square', 0.05 * v, 0.6),
  place: (a, t, v) => { a.tone(t, 520, 0.06, 'square', 0.05 * v, 1.4); a.tone(t + 0.05, 780, 0.06, 'square', 0.04 * v); },
  pickup: (a, t, v) => a.tone(t, 400, 0.06, 'triangle', 0.05 * v, 1.6),
  drop: (a, t, v) => a.tone(t, 300, 0.06, 'triangle', 0.05 * v, 0.6),
  hammer: (a, t, v) => { a.burst(t, 0.05, 0.25 * v, 1800, 3); a.tone(t, 180, 0.07, 'square', 0.06 * v, 0.5); },
  pick: (a, t, v) => { a.burst(t, 0.06, 0.3 * v, 3200, 4); a.tone(t, 1400, 0.04, 'square', 0.04 * v, 0.7); },
  chop: (a, t, v) => { a.burst(t, 0.08, 0.3 * v, 900, 2); a.tone(t, 140, 0.08, 'triangle', 0.08 * v, 0.6); },
  tree_fall: (a, t, v) => { a.burst(t, 0.6, 0.25 * v, 400, 0.7, 'lowpass'); a.tone(t + 0.3, 70, 0.4, 'triangle', 0.12 * v, 0.5); },
  build_done: (a, t, v) => { a.tone(t, 660, 0.08, 'square', 0.04 * v); a.tone(t + 0.08, 880, 0.12, 'square', 0.04 * v); },
  mine_done: (a, t, v) => a.burst(t, 0.35, 0.3 * v, 600, 0.8, 'lowpass'),
  craft_done: (a, t, v) => { a.tone(t, 700, 0.07, 'triangle', 0.05 * v); a.tone(t + 0.07, 1050, 0.1, 'triangle', 0.05 * v); },
  rifle: (a, t, v) => { a.burst(t, 0.14, 0.5 * v, 1200, 0.6); a.tone(t, 160, 0.1, 'square', 0.08 * v, 0.3); },
  pistol: (a, t, v) => { a.burst(t, 0.09, 0.4 * v, 1800, 0.8); a.tone(t, 220, 0.07, 'square', 0.06 * v, 0.3); },
  shotgun: (a, t, v) => { a.burst(t, 0.25, 0.6 * v, 700, 0.5); a.tone(t, 110, 0.18, 'square', 0.1 * v, 0.3); },
  sniper: (a, t, v) => { a.burst(t, 0.3, 0.55 * v, 900, 0.5); a.tone(t, 90, 0.25, 'sawtooth', 0.1 * v, 0.3); },
  charge: (a, t, v) => { a.tone(t, 1600, 0.15, 'sawtooth', 0.06 * v, 0.2); a.burst(t, 0.1, 0.2 * v, 4000, 2); },
  bow: (a, t, v) => a.tone(t, 300, 0.12, 'triangle', 0.08 * v, 0.5),
  throw: (a, t, v) => a.burst(t, 0.15, 0.15 * v, 2000, 1),
  explosion: (a, t, v) => { a.burst(t, 1.1, 0.9 * v, 300, 0.5, 'lowpass'); a.tone(t, 60, 0.8, 'sine', 0.3 * v, 0.4); },
  ricochet: (a, t, v) => a.tone(t, 2400, 0.12, 'sine', 0.04 * v, 0.4),
  melee: (a, t, v) => a.burst(t, 0.08, 0.3 * v, 1500, 1),
  punch: (a, t, v) => { a.burst(t, 0.07, 0.3 * v, 500, 1); a.tone(t, 90, 0.08, 'sine', 0.12 * v, 0.6); },
  slash: (a, t, v) => a.burst(t, 0.12, 0.3 * v, 3500, 1.5, 'highpass'),
  swing: (a, t, v) => a.burst(t, 0.1, 0.12 * v, 1000, 0.7),
  bash: (a, t, v) => { a.burst(t, 0.12, 0.35 * v, 400, 1); a.tone(t, 120, 0.1, 'square', 0.06 * v, 0.6); },
  die: (a, t, v) => a.tone(t, 300, 0.5, 'sawtooth', 0.06 * v, 0.3),
  mechdie: (a, t, v) => { a.tone(t, 800, 0.6, 'sawtooth', 0.06 * v, 0.1); a.burst(t, 0.5, 0.3 * v, 2000, 1); },
  raid: (a, t) => { for (let k = 0; k < 3; k++) { a.tone(t + k * 0.35, 520, 0.28, 'square', 0.07, 0.8); a.tone(t + k * 0.35 + 0.14, 390, 0.2, 'square', 0.06); } },
  letter_good: (a, t) => { a.tone(t, 660, 0.12, 'triangle', 0.08); a.tone(t + 0.1, 990, 0.2, 'triangle', 0.07); },
  letter_bad: (a, t) => { a.tone(t, 440, 0.15, 'triangle', 0.08); a.tone(t + 0.12, 330, 0.25, 'triangle', 0.07); },
  letter_threat: (a, t) => { a.tone(t, 300, 0.2, 'square', 0.07); a.tone(t + 0.18, 225, 0.35, 'square', 0.07); },
  letter_info: (a, t) => a.tone(t, 800, 0.12, 'triangle', 0.06),
  thunder: (a, t, v) => { a.burst(t, 2.2, 0.6 * Math.max(0.4, v), 180, 0.6, 'lowpass'); },
  trade: (a, t) => { for (let k = 0; k < 4; k++) a.tone(t + k * 0.06, 1200 + k * 200, 0.08, 'square', 0.03); },
  collapse: (a, t, v) => a.burst(t, 1, 0.6 * v, 250, 0.5, 'lowpass'),
  trap: (a, t, v) => { a.burst(t, 0.1, 0.4 * v, 2500, 2); a.tone(t, 200, 0.1, 'square', 0.08 * v, 0.4); },
  error: (a, t) => { a.tone(t, 200, 0.12, 'square', 0.05); a.tone(t + 0.1, 150, 0.15, 'square', 0.05); },
  chat: (a, t) => a.tone(t, 1000, 0.06, 'triangle', 0.05, 1.3),
  draft: (a, t) => { a.burst(t, 0.12, 0.2, 2600, 1.5, 'highpass'); a.tone(t + 0.04, 330, 0.1, 'square', 0.05); a.tone(t + 0.12, 495, 0.14, 'square', 0.05); },
};
