// Colony alerts (left side list): quick warnings about problems that need attention.
import type { Game } from '../game';
import { BUILDINGS } from '../data/buildings';
import { ITEMS } from '../data/items';
import { countResource } from '../sim/zones';
import { needsTending } from '../sim/health';
import { pawnShortName } from '../sim/things';
import { breakThresholds } from '../sim/mood';

export interface Alert { text: string; crit: boolean; x?: number; y?: number; id?: number; tab?: string; cat?: string }

export function computeAlerts(g: Game): Alert[] {
  const w = g.world, f = g.faction;
  const out: Alert[] = [];
  const cols = w.colonists(f);
  if (!cols.length) return out;
  // threats
  for (const l of w.lords.values()) {
    if ((l.kind === 'assault' || l.kind === 'mech') && l.stage !== 'flee' && (l.target === f)) {
      const p = l.pawns.map(id => w.pawns.get(id)).find(p => p && !p.dead);
      out.push({ text: `⚠ ${l.kind === 'mech' ? 'Mechanoids' : 'Raiders'}: ${l.pawns.length}`, crit: true, x: p?.x, y: p?.y });
    }
  }
  const manh = [...w.pawns.values()].filter(p => (p.animal?.manhunter || 0) > w.tick && !p.dead);
  if (manh.length) out.push({ text: `⚠ Manhunters: ${manh.length}`, crit: true, x: manh[0].x, y: manh[0].y });
  for (const p of cols) {
    if (p.downed && !p.job) out.push({ text: `${pawnShortName(p)} needs rescue`, crit: true, x: p.x, y: p.y, id: p.id });
    else if (p.hediffs.some(h => h.type === 'bloodloss' && h.sev > 0.3) && needsTending(p)) out.push({ text: `${pawnShortName(p)} bleeding out`, crit: true, x: p.x, y: p.y, id: p.id });
    if (p.hediffs.some(h => h.type === 'malnutrition')) out.push({ text: `${pawnShortName(p)} starving`, crit: true, x: p.x, y: p.y, id: p.id });
    if (p.hediffs.some(h => (h.type === 'hypothermia' || h.type === 'heatstroke') && h.sev > 0.2)) out.push({ text: `${pawnShortName(p)}: ${p.hediffs.find(h => h.type === 'hypothermia') ? 'hypothermia' : 'heatstroke'}`, crit: true, x: p.x, y: p.y, id: p.id });
    const th = breakThresholds(p);
    if (!p.mental && p.needs.mood < th.minor) out.push({ text: `${pawnShortName(p)}: break risk`, crit: p.needs.mood < th.major, x: p.x, y: p.y, id: p.id });
  }
  const idle = cols.filter(p => !p.job && !p.drafted && !p.downed);
  if (idle.length >= 2 || (idle.length && cols.length === 1)) out.push({ text: `Idle colonists: ${idle.length}`, crit: false, x: idle[0].x, y: idle[0].y, id: idle[0].id });
  // infrastructure
  const blds = [...w.buildings.values()].filter(b => b.faction === f);
  const beds = blds.filter(b => BUILDINGS[b.def].bed && !BUILDINGS[b.def].bed!.medical && !b.prison).reduce((s, b) => s + BUILDINGS[b.def].bed!.sleepers, 0);
  if (beds < cols.length && w.tick > 30000) out.push({ text: `Need beds (${beds}/${cols.length})`, crit: false, tab: 'build', cat: 'furniture' });
  const hasCook = blds.some(b => BUILDINGS[b.def].bench?.recipes.some(r => r.startsWith('cook')));
  if (!hasCook && w.day >= 1) out.push({ text: 'Need a cooking spot (campfire/stove)', crit: false, tab: 'build', cat: 'production' });
  let food = 0;
  for (const d of Object.keys(ITEMS)) { const fd = ITEMS[d].food; if (fd && ITEMS[d].cat !== 'feed' && ITEMS[d].cat !== 'drug') { const n = countResource(w, f, d); food += n * fd.nutrition; } }
  if (food / (cols.length * 1.6) < 2) out.push({ text: `Low food (${(food / (cols.length * 1.6)).toFixed(1)} days) · hunt or harvest`, crit: food < cols.length, tab: 'orders' });
  const zones = [...w.zones.values()].filter(z => z.faction === f && z.kind === 'stockpile');
  if (!zones.length) out.push({ text: 'Make a stockpile zone', crit: false, tab: 'zones' });
  if (w.tick > 12000 && ![...w.zones.values()].some(z => z.faction === f && z.kind === 'grow') && !blds.some(b => BUILDINGS[b.def].growBasin)) out.push({ text: 'Grow food: make a growing zone', crit: false, tab: 'zones' });
  const meds = countResource(w, f, 'medicine') + countResource(w, f, 'medicine_herbal') + countResource(w, f, 'medicine_glitter');
  if (meds < 3 && w.day > 3) out.push({ text: 'Low medicine', crit: false });
  const noFuel = blds.find(b => BUILDINGS[b.def].fuel && (b.fuel || 0) <= 0);
  if (noFuel) out.push({ text: `Out of fuel: ${BUILDINGS[noFuel.def].label}`, crit: false, x: noFuel.x, y: noFuel.y, id: noFuel.id });
  const unpowered = blds.find(b => BUILDINGS[b.def].power?.use && b.on !== false && !b.powered);
  if (unpowered) out.push({ text: `Unpowered: ${BUILDINGS[unpowered.def].label}`, crit: false, x: unpowered.x, y: unpowered.y, id: unpowered.id });
  if (!w.research[f]?.cur && blds.some(b => BUILDINGS[b.def].bench?.research)) out.push({ text: 'Choose a research project', crit: false, tab: 'research' });
  return out;
}
