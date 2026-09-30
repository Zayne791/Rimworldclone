// Bottom drawers: Architect (build), Orders (designations) and Zones.
import type { UI } from './ui';
import { itemIconURL } from './ui';
import { BUILDINGS } from '../data/buildings';
import { TERRAIN } from '../data/terrain';
import { ITEMS } from '../data/items';
import { RESEARCH } from '../data/recipes';
import type { ArchCat } from '../data/types';
import { iconImg, iconURL } from '../render/art/icons';
import { isResearched } from '../sim/research';
import { BuildTool, FloorTool, DesignateTool, ZoneTool, AreaSimpleTool, SelectBoxTool } from './tools';
import { escapeHtml } from '../core/util';
import { spriteToDataURL } from '../render/pixel';
import { terrainTexture } from '../render/art/terrain';
import { addSprite, Pix } from '../render/pixel';

const CATS: [ArchCat, string][] = [['structure', 'Structure'], ['furniture', 'Furniture'], ['production', 'Production'], ['floors', 'Floors'], ['power', 'Power'], ['temperature', 'Temp'], ['lighting', 'Lights'], ['security', 'Security'], ['joy', 'Joy'], ['art', 'Art'], ['misc', 'Misc'], ['ship', 'Ship']];

const floorIcon = new Map<string, string>();
export function floorURL(id: string): string {
  let u = floorIcon.get(id);
  if (u) return u;
  const ti = TERRAIN.findIndex(t => t.id === id);
  const tex = terrainTexture(ti);
  const p = new Pix(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = tex.get(x, y); if (c) p.set(x, y, c); }
  u = spriteToDataURL(addSprite(p), 3);
  floorIcon.set(id, u);
  return u;
}

function costText(cost: Record<string, number> | undefined, stuffCount?: number): string {
  const parts: string[] = [];
  if (stuffCount) parts.push(`${stuffCount} stuff`);
  for (const [k, v] of Object.entries(cost || {})) parts.push(`${v} ${ITEMS[k]?.label || k}`);
  return parts.join(', ') || 'free';
}

export function renderDrawer(ui: UI): string {
  const g = ui.g;
  if (ui.drawerTab === 'build') {
    if (!ui.drawerCat) ui.drawerCat = 'structure';
    const cat = ui.drawerCat as ArchCat;
    let items = '';
    if (cat === 'floors') {
      for (const t of TERRAIN.filter(t => t.floor)) {
        const locked = t.research && !isResearched(g.world, g.faction, t.research);
        items += `<div class="bitem ${locked ? 'locked' : ''}" data-a="dr:floor" data-v="${t.id}"><img src="${floorURL(t.id)}"><div>${escapeHtml(t.label)}</div><div class="cost">${locked ? '🔒 ' + escapeHtml(RESEARCH[t.research!].label) : escapeHtml(costText(t.cost))}</div></div>`;
      }
    } else {
      for (const d of Object.values(BUILDINGS)) {
        if (d.cat !== cat || d.hidden) continue;
        const locked = d.research && !isResearched(g.world, g.faction, d.research);
        items += `<div class="bitem ${locked ? 'locked' : ''}" data-a="dr:build" data-v="${d.id}"><img src="${iconURL('bld:' + d.id + ':' + (d.stuffCats ? (d.stuffCats.includes('woody') ? 'wood' : 'steel') : ''), 3)}"><div>${escapeHtml(d.label)}</div><div class="cost">${locked ? '🔒 ' + escapeHtml(RESEARCH[d.research!].label) : escapeHtml(costText(d.cost, d.stuffCount))}</div></div>`;
      }
    }
    return `<div class="cats">${CATS.map(([id, l]) => `<button class="btn sm ${cat === id ? 'on' : ''}" data-a="dr:cat" data-v="${id}">${l}</button>`).join('')}</div><div class="items">${items}</div>`;
  }
  if (ui.drawerTab === 'orders') {
    const O: [string, string, string][] = [
      ['mine', 'mine', 'Mine'], ['chop', 'chop', 'Chop wood'], ['harvest', 'harvest', 'Harvest'], ['cut', 'cut', 'Cut plants'],
      ['hunt', 'hunt', 'Hunt'], ['tame', 'tame', 'Tame'], ['slaughter', 'slaughter', 'Slaughter'], ['deconstruct', 'deconstruct', 'Deconstruct'],
      ['cancel', 'cancel', 'Cancel'], ['forbid', 'forbid', 'Forbid'], ['unforbid', 'unforbid', 'Unforbid'], ['selectbox', 'select', 'Select box'],
      ['home_add', 'home', 'Home area'], ['home_remove', 'cancel', 'Clear home'], ['roof_build', 'roof', 'Build roof'], ['roof_remove', 'cancel', 'Remove roof'],
      ['noroof_add', 'roof', 'No-roof area'], ['remove_floor', 'cancel', 'Remove floor'],
    ];
    return `<div class="items">${O.map(([k, ic, l]) => `<div class="bitem" data-a="dr:order" data-v="${k}">${iconImg(ic, 'ico xl')}<div>${l}</div></div>`).join('')}</div>`;
  }
  if (ui.drawerTab === 'zones') {
    const Z: [string, string, string, string][] = [
      ['stockpile', 'stockpile', 'Stockpile', 'Store items here'], ['grow', 'grow', 'Growing zone', 'Grow crops'], ['dump', 'dump', 'Dumping zone', 'Chunks & corpses'], ['remove', 'cancel', 'Remove zone', 'Erase zone cells'],
    ];
    const v = g.view;
    return `<div class="items">${Z.map(([k, ic, l, d]) => `<div class="bitem" data-a="dr:zone" data-v="${k}">${iconImg(ic, 'ico xl')}<div>${l}</div><div class="cost">${d}</div></div>`).join('')}</div>
      <div class="sep"></div><div class="row wrap">
      <button class="btn sm ${v.zones ? 'on' : ''}" data-a="dr:view" data-v="zones">Show zones</button>
      <button class="btn sm ${v.home ? 'on' : ''}" data-a="dr:view" data-v="home">Home area</button>
      <button class="btn sm ${v.roofs ? 'on' : ''}" data-a="dr:view" data-v="roofs">Roofs</button>
      <button class="btn sm ${v.temps ? 'on' : ''}" data-a="dr:view" data-v="temps">Temperature</button>
      <button class="btn sm ${v.labels ? 'on' : ''}" data-a="dr:view" data-v="labels">Names</button></div>`;
  }
  return '';
}

export function drawerAction(ui: UI, a: string, el: HTMLElement) {
  const g = ui.g;
  const v = el.dataset.v!;
  g.audio.play('click');
  if (a === 'cat') { ui.drawerCat = v; ui.renderDrawer(); return; }
  if (a === 'build') {
    const d = BUILDINGS[v];
    if (d.research && !isResearched(g.world, g.faction, d.research)) { ui.toast(`Requires research: ${RESEARCH[d.research].label}`, 'bad'); return; }
    const prev = g.tool as any;
    g.setTool(new BuildTool(g, v, prev?.stuff));
    return;
  }
  if (a === 'floor') {
    const t = TERRAIN.find(t => t.id === v)!;
    if (t.research && !isResearched(g.world, g.faction, t.research)) { ui.toast(`Requires research: ${RESEARCH[t.research].label}`, 'bad'); return; }
    g.setTool(new FloorTool(g, v));
    return;
  }
  if (a === 'order') {
    const L: Record<string, [string, string, string]> = {
      mine: ['Mine', 'Drag over rock to mine it', 'mine'], chop: ['Chop wood', 'Drag over trees to chop them', 'chop'], harvest: ['Harvest', 'Drag over ripe plants', 'harvest'],
      cut: ['Cut plants', 'Drag to clear plants', 'cut'], hunt: ['Hunt', 'Drag over wild animals to hunt them', 'hunt'], tame: ['Tame', 'Drag over wild animals to tame them', 'tame'],
      slaughter: ['Slaughter', 'Drag over your animals', 'slaughter'], deconstruct: ['Deconstruct', 'Drag over structures to take them apart', 'deconstruct'],
      cancel: ['Cancel', 'Drag to cancel designations and blueprints', 'cancel'], forbid: ['Forbid', 'Forbidden items are ignored by colonists', 'forbid'], unforbid: ['Unforbid', 'Allow colonists to use items', 'unforbid'],
      home_add: ['Home area', 'Colonists clean and firefight in the home area', 'home'], home_remove: ['Clear home area', 'Drag to remove home area', 'cancel'],
      roof_build: ['Build roof', 'Drag to have roofs built', 'roof'], roof_remove: ['Remove roof', 'Drag to have roofs removed', 'cancel'],
      noroof_add: ['No-roof area', 'Prevents automatic roofing here', 'roof'], remove_floor: ['Remove floor', 'Drag to remove constructed floors', 'cancel'],
    };
    if (v === 'selectbox') { g.setTool(new SelectBoxTool(g)); return; }
    const [label, hint, icon] = L[v];
    const col = v === 'cancel' || v.includes('remove') ? 'rgba(255,90,90,0.28)' : v.startsWith('home') ? 'rgba(90,160,255,0.3)' : 'rgba(255,220,120,0.28)';
    if (v.startsWith('home') || v.startsWith('roof') || v.startsWith('noroof') || v === 'remove_floor') g.setTool(new AreaSimpleTool(g, v, label, hint, icon, col));
    else g.setTool(new DesignateTool(g, v, label, hint, icon, col));
    return;
  }
  if (a === 'zone') {
    const L: Record<string, [string, string, string]> = {
      stockpile: ['Stockpile zone', 'Drag to create a stockpile', 'stockpile'], grow: ['Growing zone', 'Drag over fertile soil (choose crop after)', 'grow'],
      dump: ['Dumping zone', 'Drag to create a dump for chunks & corpses', 'dump'], remove: ['Remove zone', 'Drag to remove zone cells', 'cancel'],
    };
    const [label, hint, icon] = L[v];
    g.setTool(new ZoneTool(g, v as any, label, hint, icon, 'potato'));
    return;
  }
  if (a === 'view') { (g.view as any)[v] = !(g.view as any)[v]; ui.renderDrawer(); return; }
}
export { itemIconURL };
