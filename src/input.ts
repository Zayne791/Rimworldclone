// Unified touch + mouse + keyboard input for the map view.
import type { Game } from './game';

interface Ptr { id: number; x: number; y: number; sx: number; sy: number; t: number; type: string; button: number }

export class Input {
  g: Game;
  el: HTMLCanvasElement;
  ptrs = new Map<number, Ptr>();
  mode: 'none' | 'press' | 'pan' | 'pinch' | 'tool' | 'box' = 'none';
  pinch = { d: 0, cx: 0, cy: 0, zoom: 1, wx: 0, wy: 0 };
  lp: number | null = null;
  lpFired = false;
  lastTap = { t: 0, x: 0, y: 0 };
  keys = new Set<string>();
  boxEnd: [number, number] | null = null;
  boxStart: [number, number] | null = null;
  vel = { x: 0, y: 0 };
  lastMove = { x: 0, y: 0, t: 0 };

  constructor(g: Game, el: HTMLCanvasElement) {
    this.g = g; this.el = el;
    el.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e, true));
    el.addEventListener('wheel', e => this.wheel(e), { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    document.addEventListener('gesturestart', e => e.preventDefault());
  }

  get r() { return this.g.renderer; }

  down(e: PointerEvent) {
    this.el.setPointerCapture?.(e.pointerId);
    const p: Ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType, button: e.button };
    this.ptrs.set(e.pointerId, p);
    this.vel.x = 0; this.vel.y = 0;
    this.g.audio.unlock();
    if (this.ptrs.size === 1) {
      this.mode = 'press';
      this.lpFired = false;
      if (e.pointerType !== 'mouse' || e.button === 0) {
        this.lp = window.setTimeout(() => {
          if (this.mode === 'press' && this.ptrs.size === 1) {
            this.lpFired = true;
            const [tx, ty] = this.r.screenToTile(p.x, p.y);
            if (navigator.vibrate) navigator.vibrate(12);
            this.g.onLongPress(tx, ty, p.x, p.y);
          }
        }, 480);
      }
      if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) this.mode = e.button === 1 ? 'pan' : 'press';
    } else if (this.ptrs.size === 2) {
      this.clearLp();
      if (this.mode === 'tool') this.g.tool?.cancelDrag?.();
      this.mode = 'pinch';
      const [a, b] = [...this.ptrs.values()];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const [wx, wy] = this.r.screenToWorld(cx, cy);
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx, cy, zoom: this.r.cam.zoom, wx, wy };
    }
  }

  clearLp() { if (this.lp) { clearTimeout(this.lp); this.lp = null; } }

  move(e: PointerEvent) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.g.hover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.mode === 'pinch' && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const cam = this.r.cam;
      cam.zoom = this.pinch.zoom * (d / Math.max(10, this.pinch.d));
      this.r.clampCam();
      // keep pinch world point under the (moving) center
      const z = cam.zoom, dpr = this.r.dpr;
      cam.x = this.pinch.wx - (cx * dpr - this.r.vw / 2) / z;
      cam.y = this.pinch.wy - (cy * dpr - this.r.vh / 2) / z;
      this.r.clampCam();
      return;
    }
    if (this.mode === 'press') {
      const dist = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (dist > (p.type === 'mouse' ? 4 : 10)) {
        this.clearLp();
        if (this.lpFired) { this.mode = 'none'; return; }
        const tool = this.g.tool;
        if (tool && tool.drag && (p.type !== 'mouse' || p.button === 0)) {
          this.mode = 'tool';
          const [tx, ty] = this.r.screenToTile(p.sx, p.sy);
          tool.dragStart?.(tx, ty);
          const [cx, cy] = this.r.screenToTile(p.x, p.y);
          tool.dragMove?.(cx, cy);
        } else if (p.type === 'mouse' && p.button === 0 && !tool) {
          this.mode = 'box';
          this.boxStart = [p.sx, p.sy]; this.boxEnd = [p.x, p.y];
        } else if (p.type !== 'mouse' && this.g.boxSelectMode && !tool) {
          this.mode = 'box';
          this.boxStart = [p.sx, p.sy]; this.boxEnd = [p.x, p.y];
        } else this.mode = 'pan';
      }
    }
    if (this.mode === 'pan') {
      const z = this.r.cam.zoom / this.r.dpr;
      this.r.cam.x -= dx / z; this.r.cam.y -= dy / z;
      this.r.clampCam();
      const now = performance.now();
      const dtm = Math.max(1, now - this.lastMove.t);
      this.vel.x = (-dx / z) / dtm * 16; this.vel.y = (-dy / z) / dtm * 16;
      this.lastMove = { x: p.x, y: p.y, t: now };
    } else if (this.mode === 'tool') {
      const [tx, ty] = this.r.screenToTile(p.x, p.y);
      this.g.tool?.dragMove?.(tx, ty);
    } else if (this.mode === 'box') {
      this.boxEnd = [p.x, p.y];
    }
  }

  up(e: PointerEvent, cancel = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    this.clearLp();
    if (cancel) { if (this.mode === 'tool') this.g.tool?.cancelDrag?.(); this.mode = this.ptrs.size ? 'pan' : 'none'; return; }
    if (this.mode === 'pinch') {
      if (this.ptrs.size === 1) {
        const rem = [...this.ptrs.values()][0];
        rem.sx = rem.x; rem.sy = rem.y;
        this.mode = 'pan';
      } else this.mode = 'none';
      return;
    }
    if (this.mode === 'press' && !this.lpFired) {
      const [tx, ty] = this.r.screenToTile(p.x, p.y);
      if (p.type === 'mouse' && p.button === 2) this.g.onSecondary(tx, ty, p.x, p.y);
      else {
        const now = performance.now();
        const dbl = now - this.lastTap.t < 320 && Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < 24;
        this.lastTap = { t: dbl ? 0 : now, x: p.x, y: p.y };
        this.g.onTap(tx, ty, p.x, p.y, dbl, e.shiftKey);
      }
    } else if (this.mode === 'tool') {
      const [tx, ty] = this.r.screenToTile(p.x, p.y);
      this.g.tool?.dragEnd?.(tx, ty);
    } else if (this.mode === 'box' && this.boxStart && this.boxEnd) {
      const a = this.r.screenToTile(this.boxStart[0], this.boxStart[1]), b = this.r.screenToTile(this.boxEnd[0], this.boxEnd[1]);
      this.g.boxSelect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), e.shiftKey);
      this.boxStart = this.boxEnd = null;
    }
    if (!this.ptrs.size) this.mode = 'none';
  }

  wheel(e: WheelEvent) {
    e.preventDefault();
    const cam = this.r.cam;
    const [wx, wy] = this.r.screenToWorld(e.clientX, e.clientY);
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    cam.zoom *= f;
    this.r.clampCam();
    const z = cam.zoom, dpr = this.r.dpr;
    cam.x = wx - (e.clientX * dpr - this.r.vw / 2) / z;
    cam.y = wy - (e.clientY * dpr - this.r.vh / 2) / z;
    this.r.clampCam();
  }

  key(e: KeyboardEvent, down: boolean) {
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (!down) return;
    this.g.onKey(k, e);
  }

  /** per-frame: keyboard panning + pan inertia */
  update(dt: number) {
    const s = (600 / (this.r.cam.zoom / this.r.dpr)) * dt;
    const cam = this.r.cam;
    if (this.keys.has('w') || this.keys.has('arrowup')) cam.y -= s;
    if (this.keys.has('s') || this.keys.has('arrowdown')) cam.y += s;
    if (this.keys.has('a') || this.keys.has('arrowleft')) cam.x -= s;
    if (this.keys.has('d') || this.keys.has('arrowright')) cam.x += s;
    if (this.mode === 'none' && (Math.abs(this.vel.x) > 0.05 || Math.abs(this.vel.y) > 0.05)) {
      cam.x += this.vel.x * dt * 60; cam.y += this.vel.y * dt * 60;
      this.vel.x *= Math.pow(0.02, dt); this.vel.y *= Math.pow(0.02, dt);
    }
    this.r.clampCam();
  }
}
