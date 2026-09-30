// Live background for the main menu: a tiny peaceful colony running the real simulation.
import { createWorld, addColony, generateStartingColonists } from '../sim/newgame';
import { simTick } from '../sim/sim';
import { applyCommand } from '../sim/commands';
import { completeBlueprint } from '../sim/construction';
import { Renderer } from '../render/renderer';
import { TILE, TICKS_PER_HOUR } from '../core/constants';
import type { World } from '../sim/world';

let running: { stop(): void } | null = null;

export function stopDiorama() { running?.stop(); running = null; }

export function startDiorama(canvas: HTMLCanvasElement) {
  if (running) return;
  let alive = true, raf = 0;
  running = { stop: () => { alive = false; cancelAnimationFrame(raf); } };
  // build after the menu has painted so it never delays the first screen
  setTimeout(() => {
    if (!alive) return;
    let w: World, cx: number, cy: number;
    try { [w, cx, cy] = buildScene(); } catch (e) { console.warn('diorama failed', e); return; }
    const r = new Renderer(canvas, w, { faction: 10, selection: new Set(), zones: false, roofs: false, home: false, temps: false, labels: false });
    r.centerOn(cx, cy);
    const baseZoom = Math.max(2, r.vw / (19 * TILE));
    r.cam.zoom = baseZoom;
    let last = performance.now(), acc = 0, t = 0;
    const onResize = () => { r.resize(); r.cam.zoom = Math.max(2, r.vw / (19 * TILE)); };
    window.addEventListener('resize', onResize);
    const prevStop = running!.stop;
    running!.stop = () => { prevStop(); window.removeEventListener('resize', onResize); };
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
      acc += dt * 60;
      let n = Math.floor(acc); acc -= n;
      const t0 = performance.now();
      while (n-- > 0 && performance.now() - t0 < 8) simTick(w);
      w.fx = [];
      // slow drift around the colony
      r.cam.x = (cx + 0.5 + Math.sin(t * 0.045) * 9) * TILE;
      r.cam.y = (cy + 0.5 + Math.sin(t * 0.031 + 1) * 5) * TILE;
      r.draw(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }, 60);
}

function buildScene(): [World, number, number] {
  const seed = 'menu' + Math.floor(Math.random() * 1e6);
  const w = createWorld({ seed, mapSize: 80, storyteller: 'chill', difficulty: 0, maxPlayers: 1 });
  const F = 10;
  const [cx, cy] = addColony(w, { slot: 0, playerName: 'Menu', colonyName: 'Menu', colonists: generateStartingColonists(w, 4, seed), isHost: true });
  // late afternoon light so lamps and the campfire glow as it gets dark
  w.tick += TICKS_PER_HOUR * 9;
  const m = w.map;
  const free = (x0: number, y0: number, ww: number, hh: number) => {
    for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + ww; x++) { if (!m.inb(x, y)) return false; const i = m.idx(x, y); if (m.rock[i] || m.isWater(i) || m.bld[i]) return false; }
    return true;
  };
  const cells = (x0: number, y0: number, x1: number, y1: number) => { const o: number[] = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.inb(x, y)) o.push(m.idx(x, y)); return o; };
  // a small finished house
  let hx = cx - 9, hy = cy - 7;
  for (let k = 0; k < 30 && !free(hx, hy, 7, 6); k++) { hx = cx - 14 + (k % 6) * 4; hy = cy - 12 + Math.floor(k / 6) * 4; }
  if (free(hx, hy, 7, 6)) {
    const walls: [number, number][] = [];
    for (let x = hx; x < hx + 7; x++) { walls.push([x, hy]); walls.push([x, hy + 5]); }
    for (let y = hy + 1; y < hy + 5; y++) { walls.push([hx, y]); walls.push([hx + 6, y]); }
    const door: [number, number] = [hx + 3, hy + 5];
    applyCommand(w, F, { c: 'build', def: 'wall', stuff: 'wood', rot: 0, cells: walls.filter(c => c[0] !== door[0] || c[1] !== door[1]) });
    applyCommand(w, F, { c: 'build', def: 'door', stuff: 'wood', rot: 0, cells: [door] });
    applyCommand(w, F, { c: 'build', def: 'bed', stuff: 'wood', rot: 0, cells: [[hx + 1, hy + 1], [hx + 2, hy + 1], [hx + 4, hy + 1], [hx + 5, hy + 1]] });
    applyCommand(w, F, { c: 'build', def: 'torch', rot: 0, cells: [[hx + 3, hy + 2]] });
  }
  applyCommand(w, F, { c: 'build', def: 'campfire', rot: 0, cells: [[cx + 1, cy - 2]] });
  applyCommand(w, F, { c: 'build', def: 'torch', rot: 0, cells: [[cx - 2, cy + 3], [cx + 4, cy + 3]] });
  for (const bp of [...w.blueprints.values()]) { try { completeBlueprint(w, bp, null); } catch { /* skip */ } }
  // things to do: fields, stockpile, a few trees to chop, a half-built shed
  let gx = cx + 4, gy = cy - 8;
  for (let k = 0; k < 20 && !free(gx, gy, 6, 5); k++) { gx = cx + 2 + (k % 5) * 3; gy = cy - 12 + Math.floor(k / 5) * 4; }
  applyCommand(w, F, { c: 'zone', op: 'new', kind: 'grow', plant: 'potato', cells: cells(gx, gy, gx + 5, gy + 4) });
  for (const i of cells(gx, gy, gx + 5, gy + 4)) if (!m.rock[i] && !m.isWater(i) && !m.bld[i]) { m.setPlant(i, 0); }
  applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: cells(cx - 2, cy + 4, cx + 3, cy + 7) });
  const trees: number[] = [];
  for (const i of cells(cx - 16, cy - 16, cx + 16, cy + 16)) { const pd = m.plantDef(i); if (pd?.kind === 'tree' && trees.length < 8) trees.push(i); }
  applyCommand(w, F, { c: 'designate', kind: 'chop', cells: trees });
  // settle in for a few seconds of game time so everyone is busy when the menu appears
  for (let k = 0; k < 900; k++) simTick(w);
  return [w, cx, cy];
}
