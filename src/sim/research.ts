import type { World } from './world';
import { RESEARCH } from '../data/recipes';
import { BUILDINGS } from '../data/buildings';
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

export function onResearchComplete(w: World, faction: number, id: string) {
  const rs = w.research[faction];
  if (!rs || rs.done.includes(id)) return;
  rs.done.push(id);
  rs.cur = null;
  const r = RESEARCH[id];
  const unlocks = Object.values(BUILDINGS).filter(b => b.research === id).map(b => b.label);
  w.letter(faction, 'Research complete', `${r.label} is complete!${unlocks.length ? '\n\nUnlocked: ' + unlocks.join(', ') : ''}\n\nChoose your next project in the Research tab.`, 'good');
  addThoughtToAll(w, faction, 'new_research');
}
