// Inspector sheet: detailed info + action buttons ("gizmos") for the current selection.
import { mindTab } from './mindsui';
import type { UI } from './ui';
import { itemIconURL, portraitURL } from './ui';
import type { Pawn, Building, Item, Blueprint, Zone } from '../sim/types';
import { iconImg } from '../render/art/icons';
import { escapeHtml, pct, cap } from '../core/util';
import { BUILDINGS } from '../data/buildings';
import { ITEMS, QUALITY_LABELS } from '../data/items';
import { ANIMALS } from '../data/animals';
import { PLANTS, CROPS } from '../data/plants';
import { TERRAIN, ROCKS } from '../data/terrain';
import { SKILLS, TRAITS, BACKSTORIES, THOUGHTS, WORK_TYPES } from '../data/pawns';
import { thoughtMood, breakThresholds, cellBeauty } from '../sim/mood';
import { capacity, pain, comfyTemp, armorFor, isAnimal, isMech, weaponOf, insulation } from '../sim/stats';
import { bleedRate, injuryLabel, totalHealthPct, needsTending } from '../sim/health';
import { itemLabel, buildingLabel, buildingMaxHp, blueprintCost, blueprintNeeds, pawnShortName, itemValue, buildingBeauty, blueprintWork } from '../sim/things';
import { fullName } from '../sim/pawngen';
import { jobLabel } from '../sim/jobs';
import { roomAt, impressLabel, ambientTemp } from '../sim/rooms';
import { PRIORITY_LABELS } from '../sim/zones';
import { bodyOf } from '../sim/stats';
import { isResearched } from '../sim/research';
import { lightAt, batteryCap } from '../sim/environment';
import { RECIPES } from '../data/recipes';
import { shipStatus } from '../sim/commands';
import { SelectBoxTool, ZoneTool } from './tools';
import * as W from './windows';

export interface InspResult { sig: string; title: string; sub?: string; icon?: string; tabs?: [string, string][]; body: string; gizmos?: string }

const giz = (a: string, icon: string, label: string, cls = '', extra = '') => `<button class="btn ${cls}" data-a="insp:${a}" ${extra}>${iconImg(icon, 'ico')}<span>${label}</span></button>`;
const bar = (v: number, col?: string, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;${col ? 'background:' + col : ''}"></i></div>`;
const needCol = (v: number) => (v < 0.15 ? '#ff5a4a' : v < 0.3 ? '#ffb44a' : '#7fd67a');

export function renderInspector(ui: UI): InspResult | null {
  const g = ui.g, w = g.world;
  if (g.selectedZone) { const z = w.zones.get(g.selectedZone); if (z) return zoneInsp(ui, z); g.selectedZone = 0; }
  if (g.selectedCell >= 0 && !g.selection.size) return cellInsp(ui, g.selectedCell);
  const things = [...g.selection].map(id => w.things.get(id)).filter(Boolean);
  if (!things.length) return null;
  if (things.length > 1) return multiInsp(ui, things as any[]);
  const t = things[0]!;
  if (t.kind === 'pawn') return pawnInsp(ui, t);
  if (t.kind === 'building') return buildingInsp(ui, t);
  if (t.kind === 'blueprint') return blueprintInsp(ui, t);
  if (t.kind === 'item') return itemInsp(ui, t);
  if (t.kind === 'fire') return { sig: 'fire' + t.id + t.size.toFixed(1), title: 'Fire', sub: `size ${Math.round(t.size * 100)}%`, body: '<div class="dim">Fires spread to flammable things. Colonists with Firefight enabled will put out fires in your home area.</div>' };
  return null;
}

// ---------------- pawns ----------------
function pawnInsp(ui: UI, p: Pawn): InspResult {
  const g = ui.g, w = g.world;
  const own = p.faction === g.faction;
  const human = p.race === 'human';
  const animal = isAnimal(p);
  const fac = w.faction(p.faction);
  const pl = w.playerByFaction(p.faction);
  const tabs: [string, string][] = human ? [['overview', 'Overview'], ['health', 'Health'], ['gear', 'Gear'], ['bio', 'Skills'], ['mood', 'Mood'], ['social', 'Social']] : [['overview', 'Overview'], ['health', 'Health']];
  if (human && p.mind) tabs.splice(1, 0, ['mind', 'Mind']);
  let tab = ui.sheetTab;
  if (!tabs.find(t => t[0] === tab)) tab = 'overview';
  let sub = '';
  if (human) sub = `${p.gender === 'm' ? '♂' : '♀'} ${p.age} · ${p.guest?.prisoner ? '<span class="warn">prisoner</span>' : own ? (p.story ? escapeHtml(BACKSTORIES.find(b => b.id === p.story!.adult)?.title || '') : 'colonist') : `<span style="color:${pl?.color || fac?.color}">${escapeHtml(pl ? pl.colonyName : fac?.name || '')}</span>`}`;
  else sub = `${escapeHtml(ANIMALS[p.race]?.label || p.race)}${p.animal?.tamed ? ' · tame' : isMech(p) ? ' · mechanoid' : ' · wild'}${(p.animal?.manhunter || 0) > w.tick ? ' · <span class="bad">manhunter</span>' : ''}`;
  const title = escapeHtml(human ? fullName(p) : p.animal?.name ? `${p.animal.name}` : cap(ANIMALS[p.race]?.label || p.race));
  let body = '';
  const hp = totalHealthPct(p);
  if (tab === 'overview') {
    body += `<div class="row"><span class="chip">${escapeHtml(jobLabel(w, p))}</span>${p.drafted ? '<span class="chip bad">drafted</span>' : ''}${p.inspired ? '<span class="chip accent">★ inspired</span>' : ''}${p.mind?.on ? `<span class="chip" data-a="sheettab" data-v="mind">💭 ${g.minds.isThinking(p.id) ? 'thinking…' : 'own mind'}</span>` : ''}</div>`;
    if (p.mind?.on && p.mind.thought) body += `<div class="mind-thought small">“${escapeHtml(p.mind.thought)}”</div>`;
    body += `<div class="need"><span>Health</span>${bar(hp, needCol(hp))}<span class="small">${pct(hp)}</span></div>`;
    if (human && !p.guest?.prisoner || own) {
      const n = p.needs;
      if (human) {
        const th = breakThresholds(p);
        body += `<div class="need"><span>Mood</span>${bar(n.mood, n.mood < th.major ? '#ff5a4a' : n.mood < th.minor ? '#ffb44a' : '#7fb0e0', 'mood')}<span class="small">${pct(n.mood)}</span></div>`;
      }
      body += `<div class="need"><span>Food</span>${bar(n.food, needCol(n.food))}<span class="small">${pct(n.food)}</span></div>`;
      body += `<div class="need"><span>Rest</span>${bar(n.rest, needCol(n.rest))}<span class="small">${pct(n.rest)}</span></div>`;
      if (human) {
        body += `<div class="need"><span>Recreation</span>${bar(n.joy, needCol(n.joy))}<span class="small">${pct(n.joy)}</span></div>`;
        body += `<div class="need"><span>Beauty</span>${bar(n.beauty, '#c090e0')}<span class="small">${pct(n.beauty)}</span></div>`;
        body += `<div class="need"><span>Comfort</span>${bar(n.comfort, '#e0c070')}<span class="small">${pct(n.comfort)}</span></div>`;
      }
    }
    if (human) {
      const tm = thoughtMood(p).slice(0, 5);
      if (tm.length) body += `<h3>Thoughts</h3>` + tm.map(t => `<div class="thought"><span>${escapeHtml(t.label)}${t.n > 1 ? ` x${t.n}` : ''}</span><span class="${t.mood >= 0 ? 'good' : 'bad'}">${t.mood > 0 ? '+' : ''}${t.mood}</span></div>`).join('');
      if (p.equip) body += `<div class="row small" style="margin-top:6px"><img class="ico" src="${itemIconURL(p.equip.def, p.equip.stuff)}">${escapeHtml(itemLabel(p.equip))}</div>`;
      if (p.guest?.prisoner) body += `<h3>Prisoner</h3><div>Resistance: <b>${p.guest.resistance.toFixed(1)}</b> — wardens reduce this by chatting. At 0 they may join.</div>`;
    }
    if (animal && p.animal) {
      const ad = ANIMALS[p.race];
      body += `<div class="kv small" style="margin-top:6px"><span>Wildness</span><span>${pct(ad.wildness)}</span><span>Body size</span><span>${ad.size}</span>${ad.predator ? '<span>Predator</span><span class="bad">yes</span>' : ''}${p.animal.master ? `<span>Master</span><span>${escapeHtml(pawnShortName(w.pawns.get(p.animal.master) || p))}</span>` : ''}</div>`;
      if (p.animal.tamed && ad.products) for (const pr of ad.products) body += `<div class="need"><span>${cap(pr.kind)}</span>${bar(p.animal.products[pr.kind] || 0, '#e8e0c0')}<span class="small">${pct(p.animal.products[pr.kind] || 0)}</span></div>`;
      if (p.desig) body += `<div class="chip warn">Designated: ${p.desig}</div>`;
    }
    const lord = p.lord ? w.lords.get(p.lord) : null;
    if (lord?.kind === 'trade' && p.trader) body += `<div class="good" style="margin-top:6px">${escapeHtml(lord.traderName || 'Trader')} — tap Trade below.</div>`;
  } else if (tab === 'health') {
    const caps: [string, number][] = [['Consciousness', capacity(p, 'consciousness')], ['Moving', capacity(p, 'moving')], ['Manipulation', capacity(p, 'manipulation')], ['Sight', capacity(p, 'sight')], ['Breathing', capacity(p, 'breathing')], ['Blood pumping', capacity(p, 'bloodPumping')]];
    body += `<div class="kv small">${caps.map(([k, v]) => `<span>${k}</span><span class="${v < 0.5 ? 'bad' : v < 0.9 ? 'warn' : ''}">${pct(v)}</span>`).join('')}<span>Pain</span><span class="${pain(p) > 0.4 ? 'bad' : ''}">${pct(pain(p))}</span><span>Bleeding</span><span class="${bleedRate(p) > 0.1 ? 'bad' : ''}">${pct(bleedRate(p))}/day</span></div>`;
    const hs = p.hediffs.filter(h => h.sev > 0.001 || h.type === 'missing');
    if (!hs.length) body += `<div class="good" style="margin-top:6px">Healthy.</div>`;
    else {
      body += '<h3>Conditions</h3>';
      const body0 = bodyOf(p);
      for (const hd of hs) {
        const part = hd.part ? body0.find(b => b.id === hd.part)?.label || hd.part : 'whole body';
        const sev = hd.type === 'injury' ? `${hd.sev.toFixed(0)}` : hd.type === 'missing' ? '' : pct(hd.sev);
        const tended = hd.type === 'injury' ? (hd.tended !== undefined ? ` <span class="good">tended ${pct(hd.tended)}</span>` : ' <span class="warn">untended</span>') : hd.type === 'disease' ? ` <span class="dim">immunity ${pct(hd.imm || 0)}</span>${(hd.tendT || 0) > 0 ? ' <span class="good">tended</span>' : ' <span class="warn">needs tending</span>'}` : '';
        body += `<div class="hed"><span>${escapeHtml(cap(injuryLabel(hd)))} <span class="dim">(${escapeHtml(part)})</span>${tended}</span><span>${sev}</span></div>`;
      }
    }
    if (needsTending(p)) body += `<div class="warn small" style="margin-top:6px">Needs a doctor. Colonists with Doctor work will tend them, ideally in a bed.</div>`;
  } else if (tab === 'gear') {
    body += `<h3>Equipment</h3>`;
    body += p.equip ? `<div class="row"><img class="ico" src="${itemIconURL(p.equip.def, p.equip.stuff)}"><span class="grow">${escapeHtml(itemLabel(p.equip))}</span>${own ? `<button class="btn sm" data-a="insp:dropw">Drop</button>` : ''}</div>` : '<div class="dim">Unarmed</div>';
    const wp = weaponOf(p);
    if (wp) body += `<div class="small dim">${wp.melee ? 'Melee' : `Range ${wp.range}`} · dmg ${wp.damage}${wp.burst ? ' ×' + wp.burst : ''} · AP ${pct(wp.pen)}</div>`;
    body += `<h3>Apparel</h3>` + (p.apparel.length ? p.apparel.map(a => `<div class="row"><img class="ico" src="${itemIconURL(a.def, a.stuff)}"><span class="grow">${escapeHtml(itemLabel(a))} <span class="dim small">${Math.round(a.hp)} hp</span></span>${own ? `<button class="btn sm" data-a="insp:dropa" data-id="${a.id}">Drop</button>` : ''}</div>`).join('') : '<div class="bad">Naked!</div>');
    const [lo, hi] = comfyTemp(p);
    body += `<div class="kv small" style="margin-top:6px"><span>Comfortable</span><span>${Math.round(lo)}°C to ${Math.round(hi)}°C</span><span>Armor (sharp)</span><span>${pct(armorFor(p, 'torso', 'sharp'))}</span><span>Armor (blunt)</span><span>${pct(armorFor(p, 'torso', 'blunt'))}</span>${(() => { const belt = p.apparel.find(a => ITEMS[a.def].apparel?.shield); if (!belt) return ''; const max = ITEMS[belt.def].apparel!.shield!; const e = p.shield ?? max; return `<span>Shield</span><span class="${(p.shieldT || 0) > w.tick ? 'bad' : 'good'}">${(p.shieldT || 0) > w.tick ? 'recharging' : `${Math.round(e)} / ${max}`}</span>`; })()}</div>`;
    if (p.carry) body += `<h3>Carrying</h3><div class="row"><img class="ico" src="${itemIconURL(p.carry.def, p.carry.stuff)}">${escapeHtml(itemLabel(p.carry))}</div>`;
  } else if (tab === 'bio') {
    if (p.story) {
      const c = BACKSTORIES.find(b => b.id === p.story!.child), a = BACKSTORIES.find(b => b.id === p.story!.adult);
      body += `<div class="small"><b>${escapeHtml(c?.title || '')}</b> — <span class="dim">${escapeHtml(c?.desc || '')}</span></div><div class="small"><b>${escapeHtml(a?.title || '')}</b> — <span class="dim">${escapeHtml(a?.desc || '')}</span></div>`;
    }
    body += `<div class="row wrap" style="margin:6px 0">${p.traits.map(t => `<span class="chip" title="${escapeHtml(TRAITS[t]?.desc || '')}">${escapeHtml(TRAITS[t]?.label || t)}</span>`).join('')}</div>`;
    body += p.traits.map(t => `<div class="tiny dim">${escapeHtml(TRAITS[t]?.label)}: ${escapeHtml(TRAITS[t]?.desc || '')}</div>`).join('');
    body += '<h3>Skills</h3>';
    for (const s of SKILLS) {
      const sk = p.skills[s.id];
      const disabled = WORK_TYPES.filter(wt => wt.skills.includes(s.id)).length > 0 && WORK_TYPES.filter(wt => wt.skills.includes(s.id)).every(wt => p.disabled.includes(wt.id));
      body += `<div class="skill ${disabled ? 'faint' : ''}"><span>${s.label}</span><b>${disabled ? '–' : sk.lvl}</b>${bar(sk.lvl / 20, disabled ? '#444' : undefined)}<span>${sk.passion === 2 ? '🔥' : sk.passion === 1 ? '♨' : ''}</span></div>`;
    }
    if (p.disabled.length) body += `<div class="small bad" style="margin-top:4px">Incapable of: ${p.disabled.map(d => WORK_TYPES.find(w => w.id === d)?.label).join(', ')}</div>`;
  } else if (tab === 'mood') {
    const th = breakThresholds(p);
    body += `<div class="small dim">Mental break thresholds: minor ${pct(th.minor)}, major ${pct(th.major)}, extreme ${pct(th.extreme)}</div>`;
    body += thoughtMood(p).map(t => `<div class="thought"><span>${escapeHtml(t.label)}${t.n > 1 ? ` x${t.n}` : ''}</span><span class="${t.mood >= 0 ? 'good' : 'bad'}">${t.mood > 0 ? '+' : ''}${t.mood}</span></div>`).join('') || '<div class="dim">No thoughts.</div>';
  } else if (tab === 'mind') {
    body += mindTab(ui, p);
  } else if (tab === 'social') {
    const rels = Object.entries(p.rel).map(([id, r]) => [w.pawns.get(+id), r] as const).filter(([o]) => o && !o.dead).sort((a, b) => b[1].op - a[1].op);
    body += rels.length ? rels.map(([o, r]) => `<div class="thought"><span>${escapeHtml(pawnShortName(o!))}${r.kind ? ` <span class="accent">(${r.kind})</span>` : ''}</span><span class="${r.op >= 0 ? 'good' : 'bad'}">${r.op > 0 ? '+' : ''}${Math.round(r.op)}</span></div>`).join('') : '<div class="dim">No relationships yet.</div>';
  }
  // gizmos
  let gz = '';
  if (own && human && !p.guest) {
    gz += giz('draft', 'draft', p.drafted ? 'Undraft' : 'Draft', p.drafted ? 'bad' : '');
    if (p.drafted) gz += giz('firewill', 'target', p.fireAtWill ? 'Fire at will' : 'Hold fire', p.fireAtWill ? 'on' : '');
    gz += giz('boxsel', 'select', 'Select group');
    gz += giz('rename', 'info', 'Rename');
    gz += giz('workp', 'work', 'Work');
  }
  if (own && animal) { gz += giz('rename', 'info', 'Rename'); gz += giz('slaughter', 'slaughter', p.desig === 'slaughter' ? 'Cancel' : 'Slaughter', p.desig === 'slaughter' ? 'on' : ''); }
  if (animal && p.faction === 0) { gz += giz('hunt', 'hunt', p.desig === 'hunt' ? 'Cancel hunt' : 'Hunt', p.desig === 'hunt' ? 'on' : ''); gz += giz('tame', 'tame', p.desig === 'tame' ? 'Cancel tame' : 'Tame', p.desig === 'tame' ? 'on' : ''); }
  if (p.guest?.prisoner && p.guest.host === g.faction) {
    for (const [m, l] of [['recruit', 'Recruit'], ['hold', 'Hold'], ['release', 'Release']] as const) gz += giz('pmode', m === 'release' ? 'unforbid' : m === 'hold' ? 'forbid' : 'tame', l, p.guest.mode === m ? 'on' : '', `data-v="${m}"`);
  }
  const lord = p.lord ? w.lords.get(p.lord) : null;
  if (lord?.kind === 'trade' && lord.stock) gz += giz('trade', 'trade', 'Trade', 'good', `data-v="${lord.id}"`);
  const colonistsSel = !own && g.ownColonistsSelected().length;
  return { sig: title + sub + body + gz, title, sub, icon: `<img class="ico l" src="${portraitURL(p)}">`, tabs, body, gizmos: gz };
}

function multiInsp(ui: UI, things: any[]): InspResult {
  const g = ui.g;
  const pawns = things.filter(t => t.kind === 'pawn') as Pawn[];
  const own = pawns.filter(p => p.faction === g.faction && p.race === 'human');
  let body = pawns.map(p => `<div class="row" data-a="insp:selone" data-id="${p.id}"><img class="ico" src="${portraitURL(p)}"><span class="grow">${escapeHtml(pawnShortName(p))}</span><span class="small dim">${escapeHtml(jobLabel(g.world, p))}</span></div>`).join('');
  const others = things.filter(t => t.kind !== 'pawn');
  if (others.length) body += `<div class="dim small">+ ${others.length} other things</div>`;
  let gz = '';
  if (own.length) {
    const allDrafted = own.every(p => p.drafted);
    gz += giz('draftall', 'draft', allDrafted ? 'Undraft all' : 'Draft all', allDrafted ? 'bad' : '');
    if (own.some(p => p.drafted)) gz += giz('firewillall', 'target', 'Fire at will');
  }
  const items = things.filter(t => t.kind === 'item');
  if (items.length) gz += giz('forbidall', 'forbid', 'Forbid') + giz('unforbidall', 'unforbid', 'Unforbid');
  return { sig: body + gz, title: `${things.length} selected`, sub: own.length ? `${own.length} colonists` : '', body, gizmos: gz };
}

// ---------------- buildings ----------------
function buildingInsp(ui: UI, b: Building): InspResult {
  const g = ui.g, w = g.world;
  const d = BUILDINGS[b.def];
  const own = b.faction === g.faction;
  const max = buildingMaxHp(b.def, b.stuff, b.faction);
  let body = '';
  if (d.desc) body += `<div class="small dim">${escapeHtml(d.desc)}</div>`;
  body += `<div class="kv small" style="margin-top:6px"><span>Hit points</span><span>${Math.round(b.hp)} / ${max}</span>`;
  if (b.quality !== undefined && d.quality) body += `<span>Quality</span><span>${QUALITY_LABELS[b.quality]}</span>`;
  if (d.beauty || b.stuff) body += `<span>Beauty</span><span>${buildingBeauty(b).toFixed(1)}</span>`;
  if (d.power?.use) body += `<span>Power</span><span class="${b.powered ? 'good' : 'bad'}">${b.on === false ? 'switched off' : b.powered ? `on (${d.power.use} W)` : 'NO POWER'}</span>`;
  if (d.power?.gen) body += `<span>Output</span><span class="good">${b.output || 0} W</span>`;
  if (d.power?.battery) body += `<span>Stored</span><span>${Math.round(b.stored || 0)} / ${Math.round(batteryCap(w, b))} Wd</span>`;
  if (d.fuel) body += `<span>Fuel</span><span class="${(b.fuel || 0) <= 0 ? 'bad' : ''}">${(b.fuel || 0).toFixed(0)} / ${d.fuel.cap} ${ITEMS[d.fuel.item].label}</span>`;
  if (d.heat || d.cooler) body += `<span>Target temp</span><span>${b.tgt}°C</span>`;
  if (d.bed) body += `<span>Owner${d.bed.sleepers > 1 ? 's' : ''}</span><span>${(b.owners || []).map(id => w.pawns.get(id)).filter(Boolean).map(p => escapeHtml(pawnShortName(p!))).join(', ') || 'none'}</span>${b.medical || d.bed.medical ? '<span>Medical</span><span class="good">yes</span>' : ''}${b.prison ? '<span>For prisoners</span><span class="warn">yes</span>' : ''}`;
  if (d.art && b.artName) body += `<span>Title</span><span class="accent">${escapeHtml(b.artName)}</span>`;
  if (d.storage) body += `<span>Priority</span><span>${PRIORITY_LABELS[b.priority || 3]}</span>`;
  if (d.producer) {
    const pd = d.producer;
    const why = pd.power && !b.powered ? 'needs power' : pd.outdoors && w.map.roof[w.map.idx(b.x, b.y)] ? 'needs open sky' : pd.minTemp !== undefined && (roomAt(w, b.x, b.y)?.outdoors === false ? roomAt(w, b.x, b.y)!.temp : w.outdoorTemp) < pd.minTemp ? `too cold (needs ${pd.minTemp}°C)` : '';
    body += `<span>Next batch</span><span class="${why ? 'warn' : ''}">${Math.round((b.prog || 0) * 100)}%${why ? ' · ' + why : ''}</span>`;
  }
  if (d.aura?.kind === 'firefoam') body += `<span>Status</span><span class="${(b.cd || 0) > w.tick ? 'warn' : 'good'}">${(b.cd || 0) > w.tick ? `recharging (${(((b.cd || 0) - w.tick) / 2500).toFixed(1)} h)` : 'armed'}</span>`;
  if (d.aura?.kind === 'scan') body += `<span>Next cargo</span><span>${Math.round((b.prog || 0) * 100)}%</span>`;
  if (d.trap) body += `<span>Armed</span><span>${b.armed ? 'yes' : 'no'}</span>`;
  const room = roomAt(w, b.x + (d.interact ? 0 : 0), b.y);
  const pl = w.playerByFaction(b.faction);
  if (!own) body += `<span>Owner</span><span>${pl ? escapeHtml(pl.colonyName) : b.faction === 0 ? 'nobody' : escapeHtml(w.faction(b.faction)?.name || '')}</span>`;
  body += `</div>`;
  if (d.ship) { const s = shipStatus(w, b.faction); body += `<h3>Ship</h3><div class="small">Reactor ${s.reactor ? '✔' : '✘'} · Engine ${s.engine ? '✔' : '✘'} · Computer ${s.computer ? '✔' : '✘'} · Caskets ${s.casket}</div>`; if (b.reactor?.started) body += `<div class="warn">Launch in ${((b.reactor.t - w.tick) / 60000).toFixed(1)} days — defend it!</div>`; }
  if (b.bills) {
    body += `<h3>Bills</h3>` + (b.bills.length ? b.bills.map(bl => `<div class="row small"><span class="grow">${escapeHtml(RECIPES[bl.recipe]?.label || bl.recipe)}</span><span class="dim">${bl.mode === 'forever' ? '∞' : bl.mode === 'count' ? `${bl.done}/${bl.target}` : `until ${bl.target}`}${bl.suspended ? ' (paused)' : ''}</span></div>`).join('') : '<div class="dim small">No bills. Tap Bills to add work orders.</div>');
  }
  if (d.bench?.research) { const rs = w.research[g.faction]; body += `<div class="small" style="margin-top:4px">Project: ${rs?.cur ? `<b>${escapeHtml(rs.cur)}</b>` : '<span class="warn">none selected</span>'}</div>`; }
  if (room && !room.outdoors && room.role !== 'room') body += `<div class="small dim" style="margin-top:4px">In ${room.role}: ${impressLabel(room.impressiveness)} (${room.impressiveness})</div>`;
  let gz = '';
  if (own) {
    if (b.bills) gz += giz('bills', 'work', 'Bills', 'good');
    if (d.bench?.research) gz += giz('research', 'research', 'Research', 'good');
    if (d.power?.use || (d.power?.gen && d.power.kind === 'fuel')) gz += giz('power', 'fire', b.on === false ? 'Turn on' : 'Turn off', b.on === false ? 'bad' : '');
    if (d.isDoor) gz += giz('holdopen', 'unforbid', b.holdOpen ? 'Close' : 'Hold open', b.holdOpen ? 'on' : '');
    if (d.bed && !d.bed.medical) { gz += giz('medical', 'item:medicine', 'Medical', b.medical ? 'on' : ''); gz += giz('prison', 'forbid', 'Prisoners', b.prison ? 'on' : ''); }
    if (d.bed) gz += giz('assign', 'colony', 'Assign');
    if (d.heat || d.cooler) { gz += giz('tempdn', 'pause', '−1°C'); gz += giz('tempup', 'play1', '+1°C'); }
    if (d.storage) gz += giz('storage', 'stockpile', 'Storage');
    if (d.bench || d.table) gz += giz('forbid', 'forbid', b.forbidden ? 'Allow' : 'Forbid', b.forbidden ? 'on' : '');
    if (d.comms) gz += giz('orbital', 'trade', 'Orbital trade', 'good');
    if (d.ship === 'reactor' && !b.reactor?.started) gz += giz('reactor', 'fire', 'Start reactor', 'bad');
  }
  if (own || d.natural || b.faction === 0) {
    if (b.def !== 'geyser') gz += giz('decon', b.desig === 'deconstruct' ? 'cancel' : 'deconstruct', b.desig === 'deconstruct' ? 'Cancel' : 'Deconstruct', b.desig === 'deconstruct' ? 'on' : '');
  }
  if (own && d.cat) gz += giz('copy', 'build', 'Copy');
  const title = escapeHtml(cap(buildingLabel(b)));
  return { sig: title + body + gz, title, sub: escapeHtml(d.cat), icon: iconImg('bld:' + b.def + ':' + (b.stuff || ''), 'ico l'), body, gizmos: gz };
}

function blueprintInsp(ui: UI, bp: Blueprint): InspResult {
  const g = ui.g;
  const label = bp.floor ? TERRAIN.find(t => t.id === bp.def)?.label || bp.def : BUILDINGS[bp.def]?.label || bp.def;
  const cost = blueprintCost(bp), need = blueprintNeeds(bp);
  let body = `<div class="small dim">${bp.started ? 'Under construction' : 'Waiting for construction'} — colonists with Construct work will haul materials and build it.</div><h3>Materials</h3>`;
  body += Object.entries(cost).map(([k, v]) => `<div class="row small"><img class="ico s" src="${itemIconURL(k)}"><span class="grow">${escapeHtml(ITEMS[k].label)}</span><span class="${need[k] ? 'warn' : 'good'}">${v - (need[k] || 0)} / ${v}</span></div>`).join('') || '<div class="dim small">None</div>';
  body += `<div class="small">Work: ${Math.round((bp.work / blueprintWork(bp)) * 100)}%</div>`;
  const gz = bp.faction === g.faction ? giz('cancelbp', 'cancel', 'Cancel', 'bad') : '';
  return { sig: body + bp.work.toFixed(0), title: 'Blueprint: ' + escapeHtml(label), body, gizmos: gz };
}

// ---------------- items ----------------
function itemInsp(ui: UI, it: Item): InspResult {
  const g = ui.g;
  const d = ITEMS[it.def];
  let body = d.desc ? `<div class="small dim">${escapeHtml(d.desc)}</div>` : '';
  body += `<div class="kv small" style="margin-top:4px"><span>Count</span><span>${it.count}</span><span>Value</span><span>${Math.round(itemValue(it))} silver</span>`;
  if (d.hp) body += `<span>Hit points</span><span>${Math.round(it.hp)}</span>`;
  if (d.food) body += `<span>Nutrition</span><span>${d.food.nutrition}</span>`;
  if (it.rot !== undefined && d.food?.rotDays) body += `<span>Freshness</span><span class="${(it.rot || 0) > 0.7 ? 'bad' : ''}">${it.rot >= 1 ? 'rotten' : pct(1 - it.rot)}</span>`;
  if (d.weapon) body += `<span>Damage</span><span>${d.weapon.damage}${d.weapon.burst ? ' ×' + d.weapon.burst : ''}</span>${d.weapon.range ? `<span>Range</span><span>${d.weapon.range}</span>` : ''}`;
  if (d.apparel) body += `<span>Armor</span><span>${pct(d.apparel.armorSharp)} sharp</span><span>Insulation</span><span>${d.apparel.insCold}°C cold</span>`;
  if (it.corpse) body += `<span>Of</span><span>${escapeHtml(it.corpse.race === 'human' ? fullName(it.corpse) : ANIMALS[it.corpse.race]?.label || '')}</span>`;
  body += `</div>`;
  if (d.weapon || d.apparel || d.food) body += `<div class="small dim" style="margin-top:6px">Tip: select a colonist, then long-press this item to equip/wear/eat it.</div>`;
  let gz = giz('forbiditem', it.forbidden ? 'unforbid' : 'forbid', it.forbidden ? 'Unforbid' : 'Forbid', it.forbidden ? 'on' : '');
  const title = escapeHtml(cap(itemLabel(it)));
  return { sig: title + body + gz, title, icon: it.corpse ? '' : `<img class="ico l" src="${itemIconURL(it.def, it.stuff)}">`, body, gizmos: gz };
}

// ---------------- zones ----------------
const CAT_LABELS: Record<string, string> = { resource: 'Resources', raw_food: 'Raw food', meal: 'Meals', medicine: 'Medicine', weapon: 'Weapons', apparel: 'Apparel', textile: 'Textiles', animal_product: 'Animal products', feed: 'Animal feed', drug: 'Drugs', chunk: 'Chunks', corpse: 'Corpses', misc: 'Misc' };
function zoneInsp(ui: UI, z: Zone): InspResult {
  const g = ui.g;
  const own = z.faction === g.faction;
  let body = '';
  let gz = '';
  if (z.kind === 'grow') {
    const pd = PLANTS.find(p => p.id === z.plant)!;
    body += `<div class="small">Growing: <b>${escapeHtml(pd.label)}</b> — ${pd.growDays} days, yields ${pd.harvestYield || 0} ${pd.harvestItem ? escapeHtml(ITEMS[pd.harvestItem].label) : ''}</div>`;
    if (own) {
      body += `<div class="row wrap" style="margin-top:6px">` + CROPS.map(c => {
        const p = PLANTS.find(x => x.id === c)!;
        const locked = !isResearched(g.world, g.faction, p.research);
        return `<button class="btn sm ${z.plant === c ? 'on' : ''} ${locked ? 'dis' : ''}" data-a="insp:zplant" data-v="${c}">${escapeHtml(p.label.replace(' plant', ''))}</button>`;
      }).join('') + `</div>`;
      body += `<div class="small dim" style="margin-top:4px">${z.cells.length} cells. Colonists with Grow work will sow and harvest.</div>`;
      gz += giz('zsow', z.allowSow ? 'grow' : 'forbid', z.allowSow ? 'Sowing on' : 'Sowing off', z.allowSow ? 'on' : '');
    }
  } else {
    body += `<div class="small">${z.cells.length} cells · Priority <b>${PRIORITY_LABELS[z.priority]}</b></div>`;
    if (own) {
      body += `<div class="row wrap" style="margin:6px 0">${[1, 2, 3, 4, 5].map(p => `<button class="btn sm ${z.priority === p ? 'on' : ''}" data-a="insp:zprio" data-v="${p}">${PRIORITY_LABELS[p]}</button>`).join('')}</div>`;
      body += `<h3>Allowed</h3><div class="row wrap">${Object.keys(CAT_LABELS).map(c => `<button class="btn sm ${z.filter.cats.includes(c) ? 'on' : ''}" data-a="insp:zcat" data-v="${c}">${CAT_LABELS[c]}</button>`).join('')}</div>`;
      body += `<div class="row wrap" style="margin-top:6px"><button class="btn sm" data-a="insp:zall">Allow all</button><button class="btn sm" data-a="insp:znone">Clear</button><button class="btn sm" data-a="insp:zfood">Food only</button><button class="btn sm ${z.filter.allowRotten ? 'on' : ''}" data-a="insp:zrot">Rotten</button></div>`;
    }
  }
  if (own) { gz += giz('zexpand', 'zones', 'Expand'); gz += giz('zshrink', 'cancel', 'Shrink'); gz += giz('zdelete', 'close', 'Delete', 'bad'); }
  return { sig: body + gz + z.name, title: escapeHtml(z.name), sub: z.kind, icon: iconImg(z.kind === 'grow' ? 'grow' : z.kind === 'dump' ? 'dump' : 'stockpile', 'ico l'), body, gizmos: gz };
}

// ---------------- cells ----------------
function cellInsp(ui: UI, i: number): InspResult {
  const g = ui.g, w = g.world, m = w.map;
  const x = i % m.w, y = (i / m.w) | 0;
  let title = '', body = '', gz = '';
  const t = TERRAIN[m.floor[i] || m.terrain[i]];
  if (m.rock[i]) {
    const rd = ROCKS[m.rock[i]];
    title = cap(rd.label);
    body += `<div class="small dim">${rd.ore ? `Mine it for ${rd.yieldItem ? ITEMS[rd.yieldItem].label : 'resources'}.` : 'Natural rock. Mining it may yield stone chunks.'}</div>`;
    gz += giz('cmine', 'mine', m.desig[i] === 1 ? 'Cancel mine' : 'Mine', m.desig[i] === 1 ? 'on' : '');
  } else if (m.plant[i]) {
    const pd = PLANTS[m.plant[i]];
    title = cap(pd.label);
    body += `<div class="need"><span>Growth</span>${bar(m.growth[i], '#7fd67a')}<span class="small">${pct(m.growth[i])}</span></div>`;
    if (pd.harvestItem) body += `<div class="small">${m.growth[i] >= (pd.harvestMin ?? 1) ? '<span class="good">Ready to harvest</span>' : 'Not yet harvestable'} (${escapeHtml(ITEMS[pd.harvestItem].label)})</div>`;
    if (pd.woodYield) body += `<div class="small">Wood: ~${Math.round(pd.woodYield * m.growth[i])}</div>`;
    const light = lightAt(w, i);
    if (light < (pd.lightMin ?? 0.35) && pd.kind === 'crop') body += `<div class="small warn">Too dark to grow</div>`;
    if (pd.kind === 'tree') gz += giz('cchop', 'chop', m.desig[i] === 5 ? 'Cancel' : 'Chop', m.desig[i] === 5 ? 'on' : '');
    else if (pd.harvestItem) gz += giz('charvest', 'harvest', 'Harvest');
    gz += giz('ccut', 'cut', m.desig[i] === 2 ? 'Cancel cut' : 'Cut', m.desig[i] === 2 ? 'on' : '');
  } else { title = cap(t.label); }
  const temp = ambientTemp(w, x, y);
  const room = roomAt(w, x, y);
  body += `<div class="kv small" style="margin-top:6px"><span>Terrain</span><span>${escapeHtml(t.label)}</span><span>Fertility</span><span>${pct(m.fertility(i))}</span><span>Temperature</span><span>${temp.toFixed(1)}°C</span><span>Light</span><span>${pct(lightAt(w, i))}</span><span>Beauty</span><span>${cellBeauty(w, i).toFixed(1)}</span><span>Roof</span><span>${['none', 'constructed', 'thin rock', 'overhead mountain'][m.roof[i]]}</span>`;
  if (room && !room.outdoors) body += `<span>Room</span><span>${room.role} · ${impressLabel(room.impressiveness)}</span>`;
  body += `</div>`;
  return { sig: title + body + gz + Math.round(temp), title, sub: `${x}, ${y}`, body, gizmos: gz };
}

// ---------------- actions ----------------
export function inspectorAction(ui: UI, a: string, el: HTMLElement) {
  const g = ui.g, w = g.world;
  const sel = [...g.selection].map(id => w.things.get(id)).filter(Boolean) as any[];
  const t = sel[0];
  const pawns = sel.filter(s => s.kind === 'pawn') as Pawn[];
  const own = pawns.filter(p => p.faction === g.faction);
  switch (a) {
    case 'draft': g.cmd({ c: 'draft', pawns: [t.id], on: !t.drafted }); break;
    case 'firewill': g.cmd({ c: 'firewill', pawns: [t.id], on: !t.fireAtWill }); break;
    case 'draftall': g.cmd({ c: 'draft', pawns: own.map(p => p.id), on: !own.every(p => p.drafted) }); break;
    case 'firewillall': g.cmd({ c: 'firewill', pawns: own.map(p => p.id), on: true }); break;
    case 'boxsel': g.setTool(new SelectBoxTool(g)); break;
    case 'selone': g.select([+el.dataset.id!]); break;
    case 'rename': { const nm = prompt('New name:', t.race === 'human' ? t.name.nick : t.animal?.name || ''); if (nm) g.cmd({ c: 'rename', pawn: t.id, name: nm }); break; }
    case 'workp': W.openWindow(ui, 'work'); break;
    case 'dropw': g.cmd({ c: 'drop', pawn: t.id, what: 'weapon' }); break;
    case 'dropa': g.cmd({ c: 'drop', pawn: t.id, what: 'apparel', id: +el.dataset.id! }); break;
    case 'slaughter': g.cmd({ c: 'designate', kind: t.desig === 'slaughter' ? 'cancel' : 'slaughter', things: [t.id] }); break;
    case 'hunt': g.cmd({ c: 'designate', kind: t.desig === 'hunt' ? 'cancel' : 'hunt', things: [t.id] }); break;
    case 'tame': g.cmd({ c: 'designate', kind: t.desig === 'tame' ? 'cancel' : 'tame', things: [t.id] }); break;
    case 'pmode': g.cmd({ c: 'prisoner', pawn: t.id, mode: el.dataset.v }); break;
    case 'trade': W.openTrade(ui, +el.dataset.v!); break;
    case 'orbital': W.openTrade(ui, 'orbital'); break;
    case 'bills': W.openBills(ui, t.id); break;
    case 'research': W.openWindow(ui, 'research'); break;
    case 'power': g.cmd({ c: 'bld', id: t.id, op: 'power', value: t.on === false }); break;
    case 'holdopen': g.cmd({ c: 'bld', id: t.id, op: 'hold_open', value: !t.holdOpen }); break;
    case 'medical': g.cmd({ c: 'bld', id: t.id, op: 'medical', value: !t.medical }); break;
    case 'prison': g.cmd({ c: 'bld', id: t.id, op: 'prison', value: !t.prison }); break;
    case 'assign': W.openAssignBed(ui, t.id); break;
    case 'tempdn': g.cmd({ c: 'bld', id: t.id, op: 'temp', value: (t.tgt ?? 21) - 1 }); break;
    case 'tempup': g.cmd({ c: 'bld', id: t.id, op: 'temp', value: (t.tgt ?? 21) + 1 }); break;
    case 'storage': W.openStorage(ui, t.id); break;
    case 'forbid': g.cmd({ c: 'bld', id: t.id, op: 'forbid', value: !t.forbidden }); break;
    case 'reactor': if (confirm('Start the ship reactor? Raids will come relentlessly for 3 days until launch.')) g.cmd({ c: 'bld', id: t.id, op: 'start_reactor' }); break;
    case 'decon': g.cmd({ c: 'designate', kind: t.desig === 'deconstruct' ? 'cancel' : 'deconstruct', things: [t.id] }); break;
    case 'copy': ui.g.setTool(new (require_tools().BuildTool)(g, t.def, t.stuff)); break;
    case 'cancelbp': g.cmd({ c: 'designate', kind: 'cancel', things: [t.id] }); break;
    case 'forbiditem': g.cmd({ c: 'designate', kind: t.forbidden ? 'unforbid' : 'forbid', things: [t.id] }); break;
    case 'forbidall': g.cmd({ c: 'designate', kind: 'forbid', things: sel.filter(s => s.kind === 'item').map(s => s.id) }); break;
    case 'unforbidall': g.cmd({ c: 'designate', kind: 'unforbid', things: sel.filter(s => s.kind === 'item').map(s => s.id) }); break;
    // zones
    case 'zplant': g.cmd({ c: 'zone', op: 'set', zone: g.selectedZone, settings: { plant: el.dataset.v } }); break;
    case 'zsow': { const z = w.zones.get(g.selectedZone); if (z) g.cmd({ c: 'zone', op: 'set', zone: z.id, settings: { allowSow: !z.allowSow } }); break; }
    case 'zprio': g.cmd({ c: 'zone', op: 'set', zone: g.selectedZone, settings: { priority: +el.dataset.v! } }); break;
    case 'zcat': { const z = w.zones.get(g.selectedZone); if (!z) break; const c = el.dataset.v!; const cats = z.filter.cats.includes(c) ? z.filter.cats.filter(x => x !== c) : [...z.filter.cats, c]; g.cmd({ c: 'zone', op: 'set', zone: z.id, settings: { cats } }); break; }
    case 'zall': g.cmd({ c: 'zone', op: 'set', zone: g.selectedZone, settings: { cats: Object.keys(CAT_LABELS).filter(c => c !== 'corpse') } }); break;
    case 'znone': g.cmd({ c: 'zone', op: 'set', zone: g.selectedZone, settings: { cats: [] } }); break;
    case 'zfood': g.cmd({ c: 'zone', op: 'set', zone: g.selectedZone, settings: { cats: ['raw_food', 'meal', 'animal_product', 'feed'] } }); break;
    case 'zrot': { const z = w.zones.get(g.selectedZone); if (z) g.cmd({ c: 'zone', op: 'set', zone: z.id, settings: { allowRotten: !z.filter.allowRotten } }); break; }
    case 'zexpand': { const z = w.zones.get(g.selectedZone); if (z) g.setTool(new ZoneTool(g, z.kind as any, 'Expand ' + z.name, 'Drag to add cells', 'zones', z.plant, z.id)); break; }
    case 'zshrink': g.setTool(new ZoneTool(g, 'remove', 'Shrink zones', 'Drag to remove zone cells', 'cancel')); break;
    case 'zdelete': g.cmd({ c: 'zone', op: 'delete', zone: g.selectedZone }); g.clearSelection(); break;
    // cells
    case 'cmine': { const i = g.selectedCell; g.cmd({ c: 'designate', kind: w.map.desig[i] === 1 ? 'cancel' : 'mine', cells: [i] }); break; }
    case 'cchop': { const i = g.selectedCell; g.cmd({ c: 'designate', kind: w.map.desig[i] === 5 ? 'cancel' : 'chop', cells: [i] }); break; }
    case 'ccut': { const i = g.selectedCell; g.cmd({ c: 'designate', kind: w.map.desig[i] === 2 ? 'cancel' : 'cut', cells: [i] }); break; }
    case 'charvest': g.cmd({ c: 'designate', kind: 'harvest', cells: [g.selectedCell] }); break;
  }
  ui.sig.sheet = '';
  g.audio.play('click');
  setTimeout(() => { ui.sig.sheet = ''; ui.renderSheet(); }, 60);
}

import * as Tools from './tools';
function require_tools() { return Tools; }
export { needsTending, insulation };
