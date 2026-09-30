// "Animalese"-style speech babble: every colonist has their own little synthesized voice (pitch,
// timbre, pace and wobble derived from who they are), and each letter they say is a tiny pitched
// blip shaped by its vowel. Emotions bend the voice: excited is quick and high, sad slow and low,
// angry rough and loud, scared shaky. Runs on the game's AudioEngine so volume and mute apply.
import type { AudioEngine } from './audio';
import type { Pawn } from '../sim/types';

export interface VoiceProfile { base: number; wave: OscillatorType; speed: number; wobble: number; bright: number; vol: number }
const hash = (n: number) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function voiceOf(p: Pawn): VoiceProfile {
  const seed = (p.seed ?? p.id) * 7 + 3;
  const r1 = hash(seed), r2 = hash(seed + 1), r3 = hash(seed + 2);
  const T = new Set(p.traits);
  let base = p.gender === 'f' ? 250 + r1 * 110 : 125 + r1 * 80;
  if (p.age > 55) base *= 0.88; else if (p.age < 24) base *= 1.08;
  if (p.look?.body === 2) base *= 0.9;
  const wave: OscillatorType = T.has('abrasive') || T.has('brawler') ? 'sawtooth' : T.has('kind') ? 'triangle' : r2 < 0.55 ? 'square' : r2 < 0.85 ? 'triangle' : 'sawtooth';
  const speed = (T.has('jogger') || T.has('fast_walker') ? 38 : T.has('slowpoke') || T.has('slothful') ? 24 : 28 + r3 * 8);
  return { base, wave, speed, wobble: 0.05 + hash(seed + 5) * 0.08, bright: 0.7 + hash(seed + 6) * 0.6, vol: wave === 'square' ? 0.11 : wave === 'sawtooth' ? 0.09 : 0.16 };
}

const EMO: Record<string, { pitch: number; speed: number; vol: number; wobble: number; rough?: boolean }> = {
  neutral: { pitch: 1, speed: 1, vol: 1, wobble: 1 }, happy: { pitch: 1.08, speed: 1.05, vol: 1, wobble: 1 }, excited: { pitch: 1.2, speed: 1.22, vol: 1.1, wobble: 1.3 },
  sad: { pitch: 0.85, speed: 0.78, vol: 0.75, wobble: 0.6 }, angry: { pitch: 0.9, speed: 1.12, vol: 1.3, wobble: 0.8, rough: true }, annoyed: { pitch: 0.95, speed: 1.02, vol: 1.05, wobble: 0.7 },
  scared: { pitch: 1.15, speed: 1.15, vol: 0.85, wobble: 2.4 }, thinking: { pitch: 0.97, speed: 0.85, vol: 0.9, wobble: 0.8 }, surprised: { pitch: 1.22, speed: 1.08, vol: 1.1, wobble: 1.2 },
  embarrassed: { pitch: 1.1, speed: 0.92, vol: 0.7, wobble: 1.4 }, hurt: { pitch: 0.82, speed: 0.75, vol: 0.8, wobble: 1.6 },
};
// vowel pitch contour and a formant-ish filter frequency per vowel
const VOWEL: Record<string, [number, number]> = { a: [1.0, 1150], e: [1.12, 1850], i: [1.26, 2300], o: [0.9, 850], u: [0.84, 700], y: [1.18, 2000] };

export class Babble {
  private last = 0;
  constructor(public audio: AudioEngine) {}
  /** chars per second for this voice and mood (the typewriter uses it too) */
  rate(v: VoiceProfile, emotion = 'neutral') { return v.speed * (EMO[emotion] || EMO.neutral).speed; }
  /**
   * one blip for the character at index i of text (called by the typewriter as it reveals text).
   * Blips land on letters, roughly two per syllable; spaces and punctuation are silent pauses.
   */
  blip(text: string, i: number, v: VoiceProfile, emotion = 'neutral') {
    const a = this.audio;
    if (!a.ctx || a.muted || a.sfxVol <= 0) return;
    const ch = text[i]?.toLowerCase() || '';
    if (!/[a-z0-9']/i.test(ch)) return;
    const c = a.ctx, now = c.currentTime;
    if (now - this.last < 0.045) return;
    const vowel = VOWEL[ch];
    if (!vowel && i % 2 === 1) return; // consonants: every other one
    this.last = now;
    const e = EMO[emotion] || EMO.neutral;
    // a question rises at the end, an exclamation punches
    const tail = text.slice(i, i + 12);
    const rise = /\?/.test(tail) && !/[.!]/.test(tail.slice(0, tail.indexOf('?'))) ? 1 + (1 - Math.min(1, tail.indexOf('?') / 10)) * 0.25 : 1;
    const punch = /!/.test(tail.slice(0, 6)) ? 1.2 : 1;
    const jitter = 1 + (Math.random() * 2 - 1) * v.wobble * e.wobble;
    const f = v.base * e.pitch * (vowel ? vowel[0] : 0.96 + Math.random() * 0.12) * rise * jitter;
    const dur = (vowel ? 0.075 : 0.05) / Math.sqrt(e.speed);
    const vol = v.vol * e.vol * punch * 0.9;
    const o = c.createOscillator(), g = c.createGain(), flt = c.createBiquadFilter();
    o.type = e.rough && v.wave !== 'sawtooth' ? 'sawtooth' : v.wave;
    o.frequency.setValueAtTime(f * 1.06, now);
    o.frequency.exponentialRampToValueAtTime(f, now + dur * 0.6);
    flt.type = 'bandpass';
    flt.frequency.value = (vowel ? vowel[1] : 1500 + Math.random() * 900) * v.bright;
    flt.Q.value = 1.6;
    const body = c.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 2600 * v.bright;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.006);
    g.gain.setValueAtTime(vol, now + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    // a blend of the filtered "vowel" and the plain tone keeps it voice-like but cute
    const dry = c.createGain(); dry.gain.value = 0.55;
    o.connect(flt); flt.connect(g);
    o.connect(body); body.connect(dry); dry.connect(g);
    g.connect(a.sfx);
    o.start(now); o.stop(now + dur + 0.03);
  }
  /** a short cue when someone asks to talk: their voice saying a few syllables */
  hail(v: VoiceProfile) {
    const a = this.audio;
    if (!a.ctx || a.muted) return;
    const t = 'hey boss';
    for (let k = 0; k < t.length; k++) setTimeout(() => { this.last = 0; this.blip(t, k, v, 'happy'); }, k * 70);
  }
}
