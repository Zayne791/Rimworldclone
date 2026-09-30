// Talking to colonists out loud: the browser's speech recognition (Safari on iPad/iPhone, Chrome,
// Edge) turns the leader's voice into text. Tap the mic, speak, and it sends when you stop talking.
// Where recognition isn't available the talk screen falls back to typing.
type Rec = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null; onstart: (() => void) | null;
};

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export interface ListenHandlers {
  interim(text: string): void;
  final(text: string): void;
  end(reason: '' | 'nothing' | 'error', msg?: string): void;
}

export class VoiceInput {
  listening = false;
  private rec: Rec | null = null;
  private text = '';
  private done = false;

  start(h: ListenHandlers) {
    if (this.listening) return;
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!R) { h.end('error', "Voice input isn't supported in this browser. Type instead."); return; }
    const rec: Rec = new R();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    this.rec = rec; this.text = ''; this.done = false; this.listening = true;
    let finalText = '';
    rec.onresult = (e: any) => {
      let interim = '';
      finalText = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      this.text = (finalText + ' ' + interim).trim();
      h.interim(this.text);
    };
    rec.onerror = (e: any) => {
      const code = e?.error || '';
      this.done = true; this.listening = false;
      if (code === 'no-speech' || code === 'aborted') { h.end('nothing'); return; }
      const msg = code === 'not-allowed' || code === 'service-not-allowed' ? 'Microphone access is blocked. Allow it in your browser settings, or type instead.'
        : code === 'network' ? 'Speech recognition needs a network connection.' : `Voice input error (${code || 'unknown'}).`;
      h.end('error', msg);
    };
    rec.onend = () => {
      this.listening = false;
      if (this.done) return;
      this.done = true;
      const t = this.text.trim();
      if (t) h.final(t); else h.end('nothing');
    };
    try { rec.start(); } catch (e) { this.listening = false; h.end('error', 'Could not start the microphone: ' + (e as Error).message); }
  }
  /** stop listening; whatever was heard so far is sent */
  stop() { if (this.rec && this.listening) { try { this.rec.stop(); } catch { /* already stopped */ } } }
  cancel() { this.done = true; this.listening = false; if (this.rec) { try { this.rec.abort(); } catch { /* ignore */ } } }
}
