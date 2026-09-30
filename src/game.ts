// Game: owns the world (or its client mirror), the render loop, selection, tools and command routing.
import type { World } from './sim/world';
import type { Pawn, Thing, FxEvent } from './sim/types';
import { Renderer } from './render/renderer';
import { Input } from './input';
import { AudioEngine } from './audio/audio';
import { simTick } from './sim/sim';
import { applyCommand, type Command, type CmdResult } from './sim/commands';
import { SPEED_TPS, TILE, TICKS_PER_DAY } from './core/constants';
import type { Tool } from './ui/tools';
import { BUILDINGS } from './data/buildings';
import { ITEMS } from './data/items';
import { isAnimal, isHuman } from './sim/stats';
import { pawnHostileTo } from './sim/combat';
import { saveToDb } from './sim/save';
import { needsTending } from './sim/health';
import { itemLabel, pawnShortName, buildingLabel } from './sim/things';
import { PLANTS } from './data/plants';
import type { UI } from './ui/ui';

export interface Session {
  isHost: boolean;
  sendCmd(c: Command): Promise<CmdResult>;
  setSpeed(s: number): void;
  hostFrame(fx: FxEvent[]): void;
  clientFrame(): FxEvent[];
  close(): void;
  roomCode?: string;
  status?: string;
  onChat?: (from: string, text: string, color: string) => void;
}

export interface CtxOption { label: string; icon?: string; action: () => void; disabled?: string }

export class Game {
  world: World;
  renderer: Renderer;
  input: Input;
  audio: AudioEngine;
  ui!: UI;
  faction: number;
  selection = new Set<number>();
  selectedZone = 0;
  selectedCell = -1;
  tool: Tool | null = null;
  net: Session | null;
  acc = 0;
  last = 0;
  running = false;
  mySpeed = 1;
  prevSpeed = 1;
  boxSelectMode = false;
  view = { zones: false, roofs: false, home: false, temps: false, labels: true };
  dragInfo = '';
  lastDay = -1;
  centered = false;
  saveSlot: string;
  onExit?: () => void;
  frameTimes: number[] = [];
  private raf = 0;

  constructor(canvas: HTMLCanvasElement, world: World, faction: number, net: Session | null, audio: AudioEngine) {
    this.world = world;
    this.faction = faction;
    this.net = net;
    this.audio = audio;
    const self = this;
    this.renderer = new Renderer(canvas, world, {
      faction, selection: this.selection, zones: false, roofs: false, home: false, temps: false, labels: true,
      get overlay() { return self.tool ? { drawWorld: (ctx: CanvasRenderingContext2D, r: Renderer) => self.tool?.drawWorld?.(ctx, r) } : null; },
    } as any);
    if (this.gfx === 'fast') this.renderer.setScaleCap(1);
    this.input = new Input(this, canvas);
    this.saveSlot = 'auto:' + world.seed;
    const pl = world.playerByFaction(faction);
    const cols = world.colonists(faction);
    if (cols.length) this.renderer.centerOn(cols[0].x, cols[0].y);
    else if (pl?.startX !== undefined) this.renderer.centerOn(pl.startX, pl.startY!);
    else this.renderer.centerOn(world.map.w >> 1, world.map.h >> 1);
    this.renderer.cam.zoom = 3 * this.renderer.dpr;
    this.renderer.clampCam();
    window.addEventListener('resize', this.onResize);
    this.lastDay = world.day;
  }

  get isHost() { return !this.net || this.net.isHost; }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  private onResize = () => this.renderer.resize();
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.net?.close(); this.input?.destroy(); window.removeEventListener('resize', this.onResize); }

  effectiveSpeed(): number {
    const w = this.world;
    if (w.gameOver) return 0;
    if (!this.net) return this.mySpeed;
    let s = 4;
    for (const p of w.players) if (p.connected && p.started) s = Math.min(s, p.speed);
    return s;
  }

  /** graphics: 'auto' starts sharp and drops resolution if frames are slow; 'sharp' = native; 'fast' = 1x */
  gfx: 'auto' | 'sharp' | 'fast' = (() => { try { return (localStorage.getItem('sf_gfx') as any) || 'auto'; } catch { return 'auto'; } })();
  private slow = { n: 0, bad: 0, simMs: 0, t: 0 };
  setGfx(mode: 'auto' | 'sharp' | 'fast') {
    this.gfx = mode;
    try { localStorage.setItem('sf_gfx', mode); } catch { /* */ }
    this.renderer.setScaleCap(mode === 'fast' ? 1 : 3);
    this.slow = { n: 0, bad: 0, simMs: 0, t: 0 };
  }
  private watchFrameRate(delta: number) {
    if (this.gfx !== 'auto' || document.hidden) return;
    const s = this.slow;
    if (delta > 250) return; // tab switch / hitch
    if (delta - s.simMs > 27) s.bad++;
    s.n++; s.t += delta;
    if (s.t < 2000) return;
    const r = this.renderer;
    if (s.bad > s.n * 0.6 && r.dpr > 1) r.setScaleCap(r.dpr > 1.5 ? 1.5 : 1);
    s.n = 0; s.bad = 0; s.t = 0;
  }

  frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.watchFrameRate(now - this.last);
    this.last = now;
    const w = this.world;
    const t0 = performance.now();
    let fx: FxEvent[] = [];
    if (this.isHost) {
      const me = w.playerByFaction(this.faction);
      if (me) me.speed = this.mySpeed;
      const speed = this.effectiveSpeed();
      w.speed = speed; w.paused = speed === 0;
      if (speed > 0) {
        this.acc += dt * SPEED_TPS[speed];
        let n = Math.floor(this.acc);
        this.acc -= n;
        const budget = 16;
        while (n-- > 0) {
          simTick(w);
          if (performance.now() - t0 > budget) { this.acc = 0; break; }
        }
      }
      this.slow.simMs = performance.now() - t0;
      fx = w.fx; w.fx = [];
      this.net?.hostFrame(fx);
      if (w.day !== this.lastDay) { this.lastDay = w.day; this.autosave(); }
    } else if (this.net) {
      fx = this.net.clientFrame();
    }
    for (const e of fx) this.handleFx(e);
    if (!this.centered) {
      const c0 = w.colonists(this.faction)[0];
      if (c0) { this.renderer.centerOn(c0.x, c0.y); this.centered = true; }
    }
    // prune selection of vanished things
    for (const id of [...this.selection]) if (!w.things.has(id)) this.selection.delete(id);
    this.input.update(dt);
    const r = this.renderer;
    r.opts.zones = this.view.zones || !!(this.tool && this.tool.id.startsWith('zone')) || this.selectedZone > 0;
    r.opts.roofs = this.view.roofs || !!(this.tool && (this.tool.id.includes('roof')));
    r.opts.home = this.view.home || !!(this.tool && this.tool.id.includes('home'));
    r.opts.temps = this.view.temps;
    r.opts.labels = this.view.labels;
    r.draw(dt);
    this.audio.setListener(r.cam.x / TILE, r.cam.y / TILE, Math.max(30, (r.vw / r.cam.zoom) / TILE));
    this.ui?.frame(dt);
    this.frameTimes.push(performance.now() - t0);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
  }

  handleFx(e: FxEvent) {
    this.renderer.addFx(e);
    if (e.k === 'sound' && e.s) this.audio.play(e.s, e.x, e.y);
    if (e.k === 'letter' && (e.f === this.faction || e.f === 0)) this.ui?.onLetter(e.id!);
    if (e.k === 'launch' && e.f === this.faction) this.ui?.showVictory();
  }

  async autosave() {
    if (!this.isHost) return;
    try { await saveToDb(this.saveSlot, this.world, { colony: this.world.playerByFaction(this.faction)?.colonyName }); } catch (err) { console.warn('autosave failed', err); }
  }

  // ---------------- commands ----------------
  cmd(c: Command) { this.cmdAsync(c); }
  async cmdAsync(c: Command): Promise<CmdResult> {
    let r: CmdResult;
    if (this.isHost) r = applyCommand(this.world, this.faction, c);
    else r = await this.net!.sendCmd(c);
    if (!r.ok && r.msg) { this.ui?.toast(r.msg, 'bad'); this.audio.play('error'); }
    else if (r.ok && r.msg && c.c === 'trade') this.ui?.toast(r.msg, 'good');
    return r;
  }
  setSpeed(s: number) {
    if (s > 0) this.prevSpeed = s;
    this.mySpeed = s;
    this.net?.setSpeed(s);
    this.audio.play('click');
  }
  togglePause() { this.setSpeed(this.mySpeed === 0 ? this.prevSpeed || 1 : 0); }

  // ---------------- selection ----------------
  thingsAt(tx: number, ty: number): Thing[] {
    const w = this.world, m = w.map;
    if (!m.inb(tx, ty)) return [];
    const out: Thing[] = [];
    // pawns near the tile (render positions)
    const r = this.renderer;
    const pawns: [Pawn, number][] = [];
    for (const p of w.pawns.values()) {
      const [px, py] = r.pawnPos(p);
      const d = Math.hypot(px / TILE - tx, py / TILE - ty);
      if (d < 0.85) pawns.push([p, d]);
    }
    pawns.sort((a, b) => a[1] - b[1] || (a[0].faction === this.faction ? -1 : 1));
    for (const [p] of pawns) out.push(p);
    const i = m.idx(tx, ty);
    if (m.bld[i]) { const b = w.buildings.get(m.bld[i]); if (b && b.def !== 'geyser') out.push(b); }
    if (m.bp[i]) { const b = w.blueprints.get(m.bp[i]); if (b) out.push(b); }
    if (m.bpFloor[i]) { const b = w.blueprints.get(m.bpFloor[i]); if (b) out.push(b); }
    for (const it of w.itemsAt(tx, ty)) out.push(it);
    if (m.fire[i]) { const f = w.fires.get(m.fire[i]); if (f) out.push(f); }
    if (m.bld[i]) { const b = w.buildings.get(m.bld[i]); if (b && b.def === 'geyser') out.push(b); }
    return out;
  }

  selectAt(tx: number, ty: number, add: boolean, dbl: boolean) {
    const w = this.world;
    const cands = this.thingsAt(tx, ty);
    if (dbl && cands.length && cands[0].kind === 'pawn') {
      const p0 = cands[0] as Pawn;
      this.selection.clear();
      const r = this.renderer;
      for (const p of w.pawns.values()) {
        if (p.faction !== p0.faction || p.race !== p0.race || p.dead) continue;
        const [sx, sy] = r.worldToScreen(p.x * TILE, p.y * TILE);
        if (sx < 0 || sy < 0 || sx * r.dpr > r.vw || sy * r.dpr > r.vh) continue;
        this.selection.add(p.id);
      }
      this.selectedZone = 0; this.selectedCell = -1;
      this.ui?.onSelection();
      return;
    }
    const m = w.map;
    const i = m.inb(tx, ty) ? m.idx(tx, ty) : -1;
    const zone = i >= 0 ? m.zone[i] : 0;
    const plant = i >= 0 && m.plant[i] ? i : -1;
    // cycle
    const cur = this.selection.size === 1 ? [...this.selection][0] : null;
    let next: Thing | null = null;
    if (cur !== null) {
      const k = cands.findIndex(t => t.id === cur);
      if (k >= 0) next = cands[k + 1] || null;
      else next = cands[0] || null;
      if (k >= 0 && !next) {
        // after things: zone, then plant, then wrap
        if (zone && this.selectedZone !== zone) { this.selection.clear(); this.selectedZone = zone; this.selectedCell = -1; this.ui?.onSelection(); return; }
        next = cands[0] || null;
      }
    } else if (this.selectedZone && this.selectedZone === zone) {
      this.selectedZone = 0;
      if (plant >= 0) { this.selection.clear(); this.selectedCell = plant; this.ui?.onSelection(); return; }
      next = cands[0] || null;
    } else next = cands[0] || null;
    if (!add) this.selection.clear();
    this.selectedZone = 0; this.selectedCell = -1;
    if (next) {
      if (add && this.selection.has(next.id)) this.selection.delete(next.id); else this.selection.add(next.id);
    } else if (zone) this.selectedZone = zone;
    else if (plant >= 0) this.selectedCell = plant;
    else if (i >= 0 && (m.rock[i] || true)) this.selectedCell = i;
    this.audio.play('click');
    this.ui?.onSelection();
  }

  select(ids: number[]) { this.selection.clear(); for (const id of ids) this.selection.add(id); this.selectedZone = 0; this.selectedCell = -1; this.ui?.onSelection(); }
  clearSelection() { this.selection.clear(); this.selectedZone = 0; this.selectedCell = -1; this.ui?.onSelection(); }

  boxSelect(x0: number, y0: number, x1: number, y1: number, add: boolean) {
    if (!add) this.selection.clear();
    let any = false;
    for (const p of this.world.pawns.values()) {
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.faction === this.faction && isHuman(p) && !p.guest) { this.selection.add(p.id); any = true; }
    }
    if (!any) for (const p of this.world.pawns.values()) if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.faction === this.faction) this.selection.add(p.id);
    this.selectedZone = 0; this.selectedCell = -1;
    this.ui?.onSelection();
  }

  selectedPawns(): Pawn[] { return [...this.selection].map(id => this.world.pawns.get(id)).filter((p): p is Pawn => !!p); }
  ownColonistsSelected(): Pawn[] { return this.selectedPawns().filter(p => p.faction === this.faction && isHuman(p) && !p.guest && !p.dead); }

  // ---------------- input handlers ----------------
  onTap(tx: number, ty: number, sx: number, sy: number, dbl: boolean, shift: boolean) {
    this.ui?.closeFloating();
    if (this.tool) { this.tool.tap(tx, ty); return; }
    const own = this.ownColonistsSelected();
    const drafted = own.filter(p => p.drafted);
    if (drafted.length && drafted.length === this.selection.size) {
      const cands = this.thingsAt(tx, ty);
      const ownPawn = cands.find(t => t.kind === 'pawn' && t.faction === this.faction && isHuman(t as Pawn)) as Pawn | undefined;
      if (ownPawn && !dbl) { this.selectAt(tx, ty, shift, false); return; }
      const enemy = cands.find(t => t.kind === 'pawn' && !(t as Pawn).dead && (pawnHostileTo(this.world, drafted[0], t as Pawn) || (t as Pawn).faction !== this.faction && this.world.hostile(this.faction, (t as Pawn).faction))) as Pawn | undefined;
      if (enemy) { this.cmd({ c: 'attack', pawns: drafted.map(p => p.id), target: enemy.id }); this.renderer.addFx({ k: 'text', x: tx, y: ty, s: 'attack!', c: '#ff7060' }); return; }
      if (this.world.map.inb(tx, ty)) { this.cmd({ c: 'move', pawns: drafted.map(p => p.id), x: tx, y: ty, queue: shift }); this.renderer.addFx({ k: 'dust', x: tx, y: ty }); this.audio.play('click'); }
      return;
    }
    this.selectAt(tx, ty, shift, dbl);
  }

  onSecondary(tx: number, ty: number, sx: number, sy: number) {
    const own = this.ownColonistsSelected();
    const drafted = own.filter(p => p.drafted);
    if (drafted.length) { this.onTapDraftedOrder(tx, ty, drafted); return; }
    this.onLongPress(tx, ty, sx, sy);
  }
  onTapDraftedOrder(tx: number, ty: number, drafted: Pawn[]) {
    const cands = this.thingsAt(tx, ty);
    const enemy = cands.find(t => t.kind === 'pawn' && !(t as Pawn).dead && (t as Pawn).faction !== this.faction) as Pawn | undefined;
    if (enemy) this.cmd({ c: 'attack', pawns: drafted.map(p => p.id), target: enemy.id });
    else this.cmd({ c: 'move', pawns: drafted.map(p => p.id), x: tx, y: ty });
  }

  onLongPress(tx: number, ty: number, sx: number, sy: number) {
    if (this.tool) { this.setTool(null); return; }
    const opts = this.contextOptions(tx, ty);
    this.ui?.contextMenu(opts, sx, sy, `${tx}, ${ty}`);
  }

  contextOptions(tx: number, ty: number): CtxOption[] {
    const w = this.world, m = w.map;
    const out: CtxOption[] = [];
    if (!m.inb(tx, ty)) return out;
    const i = m.idx(tx, ty);
    const own = this.ownColonistsSelected();
    const cands = this.thingsAt(tx, ty);
    if (own.length === 1) {
      const p = own[0];
      const name = pawnShortName(p);
      for (const t of cands) {
        if (t.kind === 'item') {
          const d = ITEMS[t.def];
          if (d.weapon && !p.disabled.includes('hunt')) out.push({ label: `Equip ${itemLabel(t)}`, icon: 'target', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'equip', target: t.id }) });
          if (d.apparel) out.push({ label: `Wear ${itemLabel(t)}`, icon: 'colony', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'wear', target: t.id }) });
          if (d.food && d.cat !== 'feed') out.push({ label: `Eat ${itemLabel(t)}`, icon: 'item:meal_simple', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'eat', target: t.id }) });
          out.push({ label: `Haul ${itemLabel(t)}`, icon: 'stockpile', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'haul', target: t.id }) });
          out.push({ label: t.forbidden ? `Unforbid ${itemLabel(t)}` : `Forbid ${itemLabel(t)}`, icon: t.forbidden ? 'unforbid' : 'forbid', action: () => this.cmd({ c: 'designate', kind: t.forbidden ? 'unforbid' : 'forbid', things: [t.id] }) });
        } else if (t.kind === 'pawn' && t.id !== p.id) {
          if (t.downed && !t.dead) {
            if (t.faction === this.faction || w.allied(t.faction, this.faction)) out.push({ label: `Rescue ${pawnShortName(t)}`, icon: 'tame', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'rescue', target: t.id }) });
            if (t.faction !== this.faction && isHuman(t) && !t.guest) out.push({ label: `Capture ${pawnShortName(t)}`, icon: 'target', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'capture', target: t.id }) });
          }
          if (needsTending(t) && (t.faction === this.faction || t.guest?.host === this.faction) && !p.disabled.includes('doctor')) out.push({ label: `Tend ${pawnShortName(t)}`, icon: 'item:medicine', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'tend', target: t.id }) });
          if (!t.dead && t.faction !== this.faction) out.push({ label: `Attack ${pawnShortName(t)}`, icon: 'hunt', action: () => this.cmd({ c: 'attack', pawns: [p.id], target: t.id }) });
        } else if (t.kind === 'blueprint' && t.faction === this.faction) {
          out.push({ label: `Prioritize building`, icon: 'build', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'construct', target: t.id }) });
        } else if (t.kind === 'building' && BUILDINGS[t.def].bed && t.faction === this.faction) {
          out.push({ label: `Sleep in ${buildingLabel(t)}`, icon: 'item:meal_simple', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'bed', target: t.id }) });
        }
      }
      if (m.rock[i]) out.push({ label: 'Mine this', icon: 'mine', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'mine', cell: i }) });
      if (m.plant[i] && PLANTS[m.plant[i]].kind !== 'grass') out.push({ label: `Cut ${PLANTS[m.plant[i]].label}`, icon: 'chop', action: () => this.cmd({ c: 'prioritize', pawn: p.id, job: 'cut', cell: i }) });
      if (m.passable(i)) out.push({ label: `Go here (drafts ${name})`, icon: 'draft', action: () => this.cmd({ c: 'move', pawns: [p.id], x: tx, y: ty }) });
    } else if (own.length > 1) {
      const enemy = cands.find(t => t.kind === 'pawn' && t.faction !== this.faction && !(t as Pawn).dead) as Pawn | undefined;
      if (enemy) out.push({ label: `Attack ${pawnShortName(enemy)}`, icon: 'hunt', action: () => this.cmd({ c: 'attack', pawns: own.map(p => p.id), target: enemy.id }) });
      if (m.passable(i)) out.push({ label: `Move group here`, icon: 'draft', action: () => this.cmd({ c: 'move', pawns: own.map(p => p.id), x: tx, y: ty }) });
    }
    for (const t of cands) if (t.kind === 'item' && own.length !== 1) out.push({ label: t.forbidden ? `Unforbid ${itemLabel(t)}` : `Forbid ${itemLabel(t)}`, icon: t.forbidden ? 'unforbid' : 'forbid', action: () => this.cmd({ c: 'designate', kind: t.forbidden ? 'unforbid' : 'forbid', things: [t.id] }) });
    const animal = cands.find(t => t.kind === 'pawn' && isAnimal(t as Pawn) && !(t as Pawn).dead) as Pawn | undefined;
    if (animal && animal.faction === 0) {
      out.push({ label: `Hunt ${pawnShortName(animal)}`, icon: 'hunt', action: () => this.cmd({ c: 'designate', kind: 'hunt', things: [animal.id] }) });
      out.push({ label: `Tame ${pawnShortName(animal)}`, icon: 'tame', action: () => this.cmd({ c: 'designate', kind: 'tame', things: [animal.id] }) });
    }
    if (animal && animal.faction === this.faction) out.push({ label: `Slaughter ${pawnShortName(animal)}`, icon: 'slaughter', action: () => this.cmd({ c: 'designate', kind: 'slaughter', things: [animal.id] }) });
    out.push({ label: 'Inspect tile', icon: 'info', action: () => { this.selectedCell = i; this.selection.clear(); this.selectedZone = 0; this.ui?.onSelection(); } });
    return out;
  }

  hover(sx: number, sy: number) {
    if (this.tool && 'hover' in this.tool) { const [tx, ty] = this.renderer.screenToTile(sx, sy); (this.tool as any).hover = [tx, ty]; }
  }

  onKey(k: string, e: KeyboardEvent) {
    if (k === ' ') { e.preventDefault(); this.togglePause(); }
    else if (k === '1' || k === '2' || k === '3' || k === '4') this.setSpeed(+k);
    else if (k === 'escape') { if (this.tool) this.setTool(null); else if (this.ui?.closeTop()) { /* closed */ } else this.clearSelection(); }
    else if (k === 'r' && this.tool && (this.tool as any).rotate) (this.tool as any).rotate();
    else if (k === 'r') { const own = this.ownColonistsSelected(); if (own.length) this.cmd({ c: 'draft', pawns: own.map(p => p.id), on: !own.every(p => p.drafted) }); }
    else if (k === 'f') { const own = this.ownColonistsSelected(); if (own.length) this.cmd({ c: 'firewill', pawns: own.map(p => p.id), on: !own.every(p => p.fireAtWill) }); }
    else if (k === 'b') this.ui?.openTab('build');
    else if (k === 'o') this.ui?.openTab('orders');
    else if (k === 'z') this.ui?.openTab('zones');
    else if (k === 'tab') { e.preventDefault(); this.ui?.cycleColonist(1); }
  }

  setTool(t: Tool | null) {
    this.tool = t;
    this.dragInfo = '';
    if (t) { this.selection.clear(); this.selectedZone = 0; this.selectedCell = -1; this.ui?.onSelection(); }
    this.ui?.onTool();
  }
  setDragInfo(s: string) { this.dragInfo = s; }

  jumpTo(x: number, y: number) { this.renderer.centerOn(x, y); }
}

export { TICKS_PER_DAY };
