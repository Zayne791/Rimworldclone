import type { World } from './world';
import { RESEARCH, EFFECT_INFO } from '../data/research';
import { BUILDINGS } from '../data/buildings';
import { RECIPES } from '../data/recipes';
import { ITEMS } from '../data/items';
import { TERRAIN } from '../data/terrain';
import { PLANTS } from '../data/plants';
import { addThoughtToAll } from './mood';

export function isResearched(w: World, faction: number, id?: string): boolean {
  if (!id) return true;
  return !!w.research[faction]?.done.includes(id);
}

export function canStartResearch(w: World, faction: number, id: string): boolean {
  const r = RESEARCH[id];
  if (!r) return false;
  if (isResearched(w, faction, id)) return false;
  return r.prereqs.every(p => isResearched(w, faction, p));
}

export function hasHiTechBench(w: World, faction: number) {
  for (const b of w.buildings.values()) if (b.faction === faction && b.def === 'research_bench_hitech') return true;
  return false;
}

export interface Unlock { kind: 'building' | 'recipe' | 'item' | 'floor' | 'plant'; id: string; label: string }
const unlockCache = new Map<string, Unlock[]>();
/** everything a project makes available: buildings, recipes, craftable items, floors and crops */
export function unlocksOf(id: string): Unlock[] {
  let u = unlockCache.get(id);
  if (u) return u;
  u = [];
  for (const b of Object.values(BUILDINGS)) if (b.research === id && !b.hidden) u.push({ kind: 'building', id: b.id, label: b.label });
  for (const t of TERRAIN) if (t.research === id) u.push({ kind: 'floor', id: t.id, label: t.label });
  for (const p of PLANTS) if (p.research === id) u.push({ kind: 'plant', id: p.id, label: p.label });
  const seen = new Set<string>();
  for (const r of Object.values(RECIPES)) {
    if (r.research !== id) continue;
    const prod = r.product || r.products?.[0]?.item;
    if (prod && ITEMS[prod] && !seen.has(prod)) { seen.add(prod); u.push({ kind: 'item', id: prod, label: ITEMS[prod].label }); }
    else if (!prod) u.push({ kind: 'recipe', id: r.id, label: r.label });
  }
  unlockCache.set(id, u);
  return u;
}

/** "+10% crop growth speed" style text for one effect */
export function effectText(key: string, v: number): string {
  const info = EFFECT_INFO[key];
  const label = info?.label || key;
  switch (info?.fmt) {
    case 'pts': return `+${v} ${label}`;
    case 'lvl': return `+${v} ${label} level${v === 1 ? '' : 's'}`;
    case 'deg': return `${label} (−${v}°C)`;
    case 'neg': return `−${Math.round(v * 100)}% ${label}`;
    default: return `+${Math.round(v * 100)}% ${label}`;
  }
}
export function effectsOf(id: string): string[] {
  const e = RESEARCH[id]?.effects;
  return e ? Object.entries(e).map(([k, v]) => effectText(k, v as number)) : [];
}

export function onResearchComplete(w: World, faction: number, id: string) {
  const rs = w.research[faction];
  if (!rs || rs.done.includes(id)) return;
  rs.done.push(id);
  rs.cur = null;
  const r = RESEARCH[id];
  // continue with the next queued project whose prerequisites are now met
  if (rs.queue?.length) {
    rs.queue = rs.queue.filter(q => !rs.done.includes(q));
    const next = rs.queue.find(q => canStartResearch(w, faction, q));
    if (next) { rs.cur = next; rs.queue = rs.queue.filter(q => q !== next); }
  }
  const unlocks = unlocksOf(id).map(u => u.label);
  const fx = effectsOf(id);
  let text = `${r.label} is complete!`;
  if (unlocks.length) text += `\n\nUnlocked: ${unlocks.join(', ')}`;
  if (fx.length) text += `\n\nColony bonus: ${fx.join(', ')}`;
  text += rs.cur ? `\n\nNow researching ${RESEARCH[rs.cur].label} (from your queue).` : '\n\nChoose your next project in the Research tab.';
  w.letter(faction, 'Research complete', text, 'good');
  addThoughtToAll(w, faction, 'new_research');
}
