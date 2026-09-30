// The storyteller: colony wealth tracking, threat points, and incidents (raids, traders, events).
import type { World } from './world';
import type { Pawn, Item } from './types';
import { TICKS_PER_DAY, FACTION_PIRATES, FACTION_MECHS, FACTION_OUTLANDERS, FACTION_TRIBE } from '../core/constants';
import { generateHuman, generateAnimal, generateMech, raiderWeapon, fullName } from './pawngen';
import { newLord, arrivalEdge, spawnGroupAt } from './lords';
import { makeItem, spawnItem, itemValue, buildingValue, makeBuilding, canPlaceBuilding, placeItem, pawnShortName } from './things';
import { WILD_ANIMALS, ANIMALS } from '../data/animals';
import { ITEMS } from '../data/items';
import { BUILDINGS } from '../data/buildings';
import { PLANTS } from '../data/plants';
import { marketValuePawn } from './stats';
import { storageOwnerAt } from './zones';
import { giveDisease, applyDamage, setDowned } from './health';
import { explode } from './combat';
import { startFire } from './environment';
import { ROCK_INDEX } from '../data/terrain';
import { clamp, dist } from '../core/util';
import { mkJob } from './jobs';
import { addThought } from './mood';

export function colonyWealth(w: World, faction: number): number {
  const m = w.map;
  const slot = w.slotOf(faction);
  let v = 0;
  for (const it of w.items.values()) {
    const i = m.idx(it.x, it.y);
    const own = storageOwnerAt(w, i);
    if (own === faction || (own < 0 && m.inHome(i, slot))) v += itemValue(it);
  }
  for (const b of w.buildings.values()) if (b.faction === faction) v += buildingValue(b);
  for (const p of w.pawns.values()) if (p.faction === faction && !p.dead) { v += marketValuePawn(p) * 0.5; if (p.equip) v += itemValue(p.equip); for (const a of p.apparel) v += itemValue(a); }
  return v;
}

export function threatPoints(w: World, faction: number): number {
  const st = w.story[faction];
  const cols = w.colonists(faction).length;
  const diff = [0.35, 0.6, 1, 1.35, 1.75][w.settings.difficulty] ?? 1;
  const teller = w.settings.storyteller === 'chill' ? 0.8 : w.settings.storyteller === 'chaos' ? w.rng.range(0.6, 1.6) : 1;
  const dayF = clamp(0.5 + w.day / 30, 0.5, 1.6);
  const base = Math.max(35, ((st?.wealth || 0) - 7000) / 110 + cols * 16);
  return Math.round(base * diff * teller * dayF);
}

function colonyCenter(w: World, faction: number): [number, number] {
  const pl = w.playerByFaction(faction);
  const cols = w.colonists(faction);
  if (cols.length) {
    const sx = cols.reduce((s, p) => s + p.x, 0) / cols.length, sy = cols.reduce((s, p) => s + p.y, 0) / cols.length;
    return [Math.round(sx), Math.round(sy)];
  }
  return [pl?.startX ?? w.map.w >> 1, pl?.startY ?? w.map.h >> 1];
}

// ---------------- incidents ----------------
export function incidentRaid(w: World, faction: number, points?: number, forceMech = false, drop = false) {
  const pts = points ?? threatPoints(w, faction);
  const [cx, cy] = colonyCenter(w, faction);
  const mech = forceMech || (w.day >= 12 && pts > 250 && w.rng.chance(0.22));
  const pawns: Pawn[] = [];
  let left = pts;
  if (mech) {
    const opts: [string, number][] = [['scyther', 120], ['lancer', 140], ['centipede', 260]];
    while (left > 100 && pawns.length < 14) {
      const [race, cost] = w.rng.pick(opts.filter(o => o[1] <= left) as [string, number][]) || opts[0];
      pawns.push(generateMech(w, race, FACTION_MECHS));
      left -= cost;
    }
    if (!pawns.length) pawns.push(generateMech(w, 'scyther', FACTION_MECHS));
  } else {
    const tierMax = pts < 150 ? 0 : pts < 400 ? 1 : pts < 900 ? 2 : 3;
    const costs = [35, 60, 90, 130];
    while (left >= 30 && pawns.length < 30) {
      const tier = w.rng.int(Math.max(0, tierMax - 1), tierMax);
      const p = generateHuman(w, FACTION_PIRATES, { kind: 'raider', tier });
      const wd = raiderWeapon(w, tier);
      p.equip = makeItem(w, wd, 1, { quality: w.rng.int(0, 3), stuff: ITEMS[wd].stuffCats ? 'steel' : undefined });
      p.drafted = false;
      pawns.push(p);
      left -= costs[tier];
    }
    if (!pawns.length) { const p = generateHuman(w, FACTION_PIRATES, { kind: 'raider', tier: 0 }); p.equip = makeItem(w, 'club', 1, { stuff: 'wood' }); pawns.push(p); }
  }
  let sx: number, sy: number;
  const useDrop = drop || (!mech && w.day > 18 && w.rng.chance(0.25));
  if (useDrop) {
    sx = cx + w.rng.int(-6, 6); sy = cy + w.rng.int(-6, 6);
    if (!w.map.inb(sx, sy)) [sx, sy] = [cx, cy];
  } else {
    const e = arrivalEdge(w, cx, cy);
    if (!e) return;
    [sx, sy] = e;
  }
  const spot: [number, number] = useDrop ? [sx, sy] : [Math.round(sx + (cx - sx) * 0.55), Math.round(sy + (cy - sy) * 0.55)];
  const lord = newLord(w, mech ? FACTION_MECHS : FACTION_PIRATES, mech ? 'mech' : 'assault', faction, spot);
  if (useDrop) lord.stage = 'assault';
  spawnGroupAt(w, pawns, sx, sy, lord);
  if (useDrop) for (const p of pawns) w.emit({ k: 'droppod', x: p.x, y: p.y });
  const f = w.faction(mech ? FACTION_MECHS : FACTION_PIRATES)!;
  const title = mech ? 'Mechanoid cluster' : useDrop ? 'Raid: drop pods!' : 'Raid';
  const txt = mech
    ? `A group of ${pawns.length} mechanoids has arrived. They will not flee and will not stop until destroyed.\n\nDraft your colonists and fight from cover!`
    : `${pawns.length} raiders from ${f.name} ${useDrop ? 'are dropping right into your colony' : 'have arrived'}. ${pawns.length > 5 ? 'This is a big one.' : ''}\n\nDraft your colonists (tap a colonist, then Draft) and fight from behind cover like walls or sandbags.`;
  w.letter(faction, title, txt, 'threat', sx, sy);
  w.story[faction].lastRaid = w.tick;
  w.sound('raid', sx, sy);
}

export function incidentManhunters(w: World, faction: number, points: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const race = w.rng.pick(['wolf', 'boar', 'muffalo', 'bear', 'cougar', 'deer'].filter(r => ANIMALS[r]));
  const ad = ANIMALS[race];
  const n = clamp(Math.round(points / (ad.size * 45)), 2, 18);
  const e = arrivalEdge(w, cx, cy);
  if (!e) return;
  const pawns: Pawn[] = [];
  for (let k = 0; k < n; k++) {
    const a = generateAnimal(w, race);
    a.animal!.manhunter = w.tick + TICKS_PER_DAY * w.rng.range(1, 1.8);
    pawns.push(a);
  }
  spawnGroupAt(w, pawns, e[0], e[1], null);
  w.letter(faction, `Manhunter pack`, `A pack of ${n} maddened ${ad.label}s is coming! They will attack anyone they see. Stay indoors or fight them together.`, 'threat', e[0], e[1]);
}

function incidentMadAnimal(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const animals = [...w.pawns.values()].filter(p => p.faction === 0 && p.animal && !p.dead && dist(p.x, p.y, cx, cy) < 70);
  if (!animals.length) return;
  const a = w.rng.pick(animals);
  a.animal!.manhunter = w.tick + TICKS_PER_DAY;
  w.letter(faction, `Mad ${ANIMALS[a.race].label}`, `A ${ANIMALS[a.race].label} has gone mad and is attacking people!`, 'bad', a.x, a.y, a.id);
}

export function incidentWanderer(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const e = arrivalEdge(w, cx, cy);
  if (!e) return;
  const p = generateHuman(w, faction, { kind: 'colonist' });
  if (w.rng.chance(0.5)) p.equip = makeItem(w, w.rng.pick(['knife', 'revolver', 'bow_short', 'rifle_bolt']), 1, { stuff: 'steel' });
  spawnGroupAt(w, [p], e[0], e[1], null);
  w.letter(faction, 'Wanderer joins', `${fullName(p)}, a ${p.age}-year-old wanderer, has decided to join your colony.`, 'good', p.x, p.y, p.id);
}

function incidentPodCrash(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const x = clamp(cx + w.rng.int(-15, 15), 2, w.map.w - 3), y = clamp(cy + w.rng.int(-15, 15), 2, w.map.h - 3);
  if (!w.map.passable(w.map.idx(x, y))) return;
  const p = generateHuman(w, FACTION_OUTLANDERS, { kind: 'visitor' });
  spawnGroupAt(w, [p], x, y, null);
  applyDamage(w, p, { amount: 12, type: 'blunt', noArmor: true });
  applyDamage(w, p, { amount: 8, type: 'cut', noArmor: true });
  if (!p.dead && !p.downed) setDowned(w, p, true);
  p.guest = null;
  (p as any).podCrash = true;
  w.emit({ k: 'droppod', x, y });
  w.letter(faction, 'Transport pod crash', `A transport pod crashed nearby. ${fullName(p)} is injured inside. Rescue them (they may join your colony) or capture them as a prisoner.`, 'neutral', x, y, p.id);
}

function cargoItems(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const opts: [string, number][] = [['steel', w.rng.int(80, 200)], ['wood', w.rng.int(100, 250)], ['silver', w.rng.int(150, 500)], ['components', w.rng.int(4, 12)], ['meal_survival', w.rng.int(10, 25)], ['medicine', w.rng.int(5, 12)], ['plasteel', w.rng.int(20, 60)], ['cloth', w.rng.int(60, 150)], ['gold', w.rng.int(20, 60)]];
  const [def, n] = w.rng.pick(opts);
  const x = clamp(cx + w.rng.int(-10, 10), 2, w.map.w - 3), y = clamp(cy + w.rng.int(-10, 10), 2, w.map.h - 3);
  spawnItem(w, def, n, x, y);
  w.emit({ k: 'droppod', x, y });
  w.letter(faction, 'Cargo pods', `Cargo pods crashed nearby, containing ${n} ${ITEMS[def].label}.`, 'good', x, y);
}

export function traderStock(w: World, orbital: boolean): Item[] {
  const out: Item[] = [];
  const add = (def: string, n: number, opts: Partial<Item> = {}) => { if (n > 0) out.push(makeItem(w, def, n, opts)); };
  add('silver', w.rng.int(600, 1600));
  add('steel', w.rng.int(80, 300)); add('wood', w.rng.int(100, 400)); add('components', w.rng.int(4, 16));
  add('cloth', w.rng.int(60, 200)); add('leather', w.rng.int(30, 120));
  add('meal_simple', w.rng.int(5, 20)); add('meal_survival', w.rng.int(0, 15)); add('pemmican', w.rng.int(0, 100));
  add('medicine_herbal', w.rng.int(3, 12)); add('medicine', w.rng.int(2, 10));
  add('rice', w.rng.int(0, 200)); add('corn', w.rng.int(0, 200)); add('beer', w.rng.int(0, 25));
  add('plasteel', w.rng.int(0, orbital ? 150 : 40)); add('gold', w.rng.int(0, 40)); add('uranium', w.rng.int(0, orbital ? 60 : 15));
  if (orbital) { add('adv_components', w.rng.int(1, 5)); add('medicine_glitter', w.rng.int(0, 3)); }
  const weapons = ['revolver', 'autopistol', 'rifle_bolt', 'shotgun', 'rifle_assault', 'rifle_sniper', 'lmg', 'longsword', 'mace', 'knife', 'bow_short', 'grenades_frag'];
  if (orbital) weapons.push('rifle_charge', 'rifle_charge');
  for (let k = w.rng.int(2, 5); k > 0; k--) { const d = w.rng.pick(weapons); add(d, 1, { quality: w.rng.int(1, 4), stuff: ITEMS[d].stuffCats ? w.rng.pick(['steel', 'steel', 'plasteel']) : undefined }); }
  const apparel = ['shirt', 'pants', 'jacket', 'duster', 'parka', 'flak_vest', 'helmet_simple', 'cowboy_hat', 'tuque'];
  if (orbital) apparel.push('armor_marine', 'helmet_marine');
  for (let k = w.rng.int(3, 6); k > 0; k--) { const d = w.rng.pick(apparel); add(d, 1, { quality: w.rng.int(1, 4), stuff: ITEMS[d].stuffCats ? w.rng.pick(ITEMS[d].stuffCats!.includes('metallic') ? ['steel', 'plasteel'] : ['cloth', 'leather', 'devilstrand', 'wool']) : undefined }); }
  // merge stacks
  const merged: Item[] = [];
  for (const it of out) {
    const ex = merged.find(m => m.def === it.def && m.stuff === it.stuff && m.quality === it.quality && ITEMS[it.def].stack > 1);
    if (ex) ex.count += it.count; else merged.push(it);
  }
  return merged;
}

const TRADER_NAMES = ['Bulk goods trader', 'Combat supplier', 'Exotic goods trader', 'Pirate merchant', 'Slaver-free traveling market'];

export function incidentTrader(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const e = arrivalEdge(w, cx, cy);
  if (!e) return;
  const fac = w.rng.chance(0.7) ? FACTION_OUTLANDERS : FACTION_TRIBE;
  const pawns: Pawn[] = [];
  const trader = generateHuman(w, fac, { kind: 'trader' });
  trader.trader = true;
  trader.equip = makeItem(w, 'revolver');
  pawns.push(trader);
  for (let k = w.rng.int(1, 3); k > 0; k--) { const g = generateHuman(w, fac, { kind: 'raider', tier: 1 }); g.equip = makeItem(w, w.rng.pick(['rifle_bolt', 'shotgun', 'rifle_assault'])); pawns.push(g); }
  for (let k = w.rng.int(1, 2); k > 0; k--) { const a = generateAnimal(w, 'muffalo', fac); a.animal!.tamed = true; pawns.push(a); }
  const lord = newLord(w, fac, 'trade', faction, [clamp(cx + w.rng.int(-5, 5), 1, w.map.w - 2), clamp(cy + w.rng.int(-5, 5), 1, w.map.h - 2)]);
  lord.stock = traderStock(w, false);
  lord.traderName = `${w.rng.pick(TRADER_NAMES)} from ${w.faction(fac)!.name}`;
  spawnGroupAt(w, pawns, e[0], e[1], lord);
  w.letter(faction, 'Trade caravan', `A ${lord.traderName} has arrived. Tap the trader (or open Trade in the Colony menu) to trade.`, 'good', e[0], e[1], trader.id);
}

export function incidentVisitors(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  const e = arrivalEdge(w, cx, cy);
  if (!e) return;
  const fac = w.rng.chance(0.6) ? FACTION_OUTLANDERS : FACTION_TRIBE;
  const pawns: Pawn[] = [];
  for (let k = w.rng.int(2, 4); k > 0; k--) pawns.push(generateHuman(w, fac, { kind: 'visitor' }));
  const lord = newLord(w, fac, 'visit', faction, [cx, cy]);
  spawnGroupAt(w, pawns, e[0], e[1], lord);
  w.letter(faction, 'Visitors', `A group from ${w.faction(fac)!.name} is passing through to visit.`, 'neutral', e[0], e[1]);
  const f = w.faction(faction); if (f) f.goodwill[fac] = Math.min(100, (f.goodwill[fac] || 0) + 5);
}

export function incidentOrbitalTrader(w: World, faction: number) {
  if (![...w.buildings.values()].some(b => b.faction === faction && b.def === 'comms_console' && b.powered)) return false;
  const stock = traderStock(w, true);
  (w as any).orbital ||= {};
  (w as any).orbital[faction] = { stock, until: w.tick + TICKS_PER_DAY * 1.2, name: w.rng.pick(['Stellar goods trader', 'Combat supplier ship', 'Exotic goods trader']) };
  w.letter(faction, 'Orbital trader', `An orbital trade ship is in range for about a day. Use your comms console (select it) to trade. Purchases arrive by drop pod.`, 'good');
  return true;
}

function incidentHerd(w: World, faction: number) {
  const race = w.rng.pick(['muffalo', 'deer', 'alpaca', 'boar']);
  const e = arrivalEdge(w, w.map.w >> 1, w.map.h >> 1);
  if (!e) return;
  const n = w.rng.int(4, 9);
  const pawns = Array.from({ length: n }, () => generateAnimal(w, race));
  spawnGroupAt(w, pawns, e[0], e[1], null);
  w.letter(faction, 'Herd migration', `A herd of ${n} ${ANIMALS[race].label} is passing through. Good hunting opportunity!`, 'neutral', e[0], e[1]);
}

function incidentAnimalJoins(w: World, faction: number) {
  const race = w.rng.pick(['dog', 'cat', 'chicken', 'cow', 'muffalo', 'alpaca']);
  const [cx, cy] = colonyCenter(w, faction);
  const e = arrivalEdge(w, cx, cy);
  if (!e) return;
  const a = generateAnimal(w, race, faction, true);
  spawnGroupAt(w, [a], e[0], e[1], null);
  w.letter(faction, 'Animal self-tamed', `A ${ANIMALS[race].label} has wandered in and decided to join your colony. Its name is ${a.animal!.name}.`, 'good', e[0], e[1], a.id);
}

function incidentBlight(w: World, faction: number) {
  const m = w.map;
  const zones = [...w.zones.values()].filter(z => z.kind === 'grow' && z.faction === faction);
  let killed = 0;
  for (const z of zones) for (const i of z.cells) if (m.plant[i] && PLANTS[m.plant[i]].kind === 'crop' && w.rng.chance(0.45)) { m.setPlant(i, 0); killed++; }
  if (killed > 3) w.letter(faction, 'Crop blight', `A blight has destroyed ${killed} of your crops.`, 'bad');
}

function incidentDisease(w: World, faction: number) {
  const cols = w.colonists(faction);
  if (!cols.length) return;
  const kind = w.rng.pick(['flu', 'flu', 'plague', 'malaria']);
  const n = Math.min(cols.length, w.rng.int(1, 2));
  const victims = w.rng.shuffle([...cols]).slice(0, n);
  for (const v of victims) giveDisease(w, v, kind);
  w.letter(faction, `Disease: ${kind}`, `${victims.map(pawnShortName).join(' and ')} ${n > 1 ? 'have' : 'has'} caught ${kind}. Keep them in bed and tended by a doctor until their immunity wins.`, 'bad', victims[0].x, victims[0].y, victims[0].id);
}

function incidentShortCircuit(w: World, faction: number) {
  const bats = [...w.buildings.values()].filter(b => b.faction === faction && b.def === 'battery' && (b.stored || 0) > 150);
  if (!bats.length) return false;
  const b = w.rng.pick(bats);
  const e = b.stored || 0;
  b.stored = 0;
  explode(w, b.x, b.y, clamp(e / 250, 1.5, 4), 15, 0, true);
  w.letter(faction, 'Short circuit', `A power conduit shorted, discharging ${Math.round(e)} Wd from a battery in an explosion! Fire has started.`, 'bad', b.x, b.y);
  return true;
}

function incidentMeteorite(w: World, faction: number) {
  const m = w.map;
  const [cx, cy] = colonyCenter(w, faction);
  const x = clamp(cx + w.rng.int(-20, 20), 3, m.w - 4), y = clamp(cy + w.rng.int(-20, 20), 3, m.h - 4);
  const ore = w.rng.pick(['steel_ore', 'silver_ore', 'gold_ore', 'plasteel_ore', 'uranium_ore', 'machinery']);
  let placed = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.abs(dx) + Math.abs(dy) === 2 && w.rng.chance(0.5)) continue;
    const i = m.idx(x + dx, y + dy);
    if (m.bld[i] || m.isWater(i) || m.pawns[i]?.length) continue;
    m.setPlant(i, 0);
    m.setRock(i, ROCK_INDEX[ore]);
    placed++;
  }
  if (!placed) return;
  w.emit({ k: 'explosion', x, y, x2: 2 });
  w.sound('explosion', x, y);
  w.letter(faction, 'Meteorite', `A meteorite containing ${ore.replace('_ore', '').replace('machinery', 'compacted machinery')} has crashed nearby. Mine it!`, 'good', x, y);
}

function incidentShipChunk(w: World, faction: number) {
  const [cx, cy] = colonyCenter(w, faction);
  for (let k = 0; k < 20; k++) {
    const x = clamp(cx + w.rng.int(-18, 18), 2, w.map.w - 4), y = clamp(cy + w.rng.int(-18, 18), 2, w.map.h - 4);
    if (!canPlaceBuilding(w, 'ship_chunk', x, y, 0, 0).ok) continue;
    const b = makeBuilding(w, 'ship_chunk', x, y, 0, undefined, 0);
    w.register(b);
    w.emit({ k: 'droppod', x, y });
    w.letter(faction, 'Ship chunk', 'A chunk of a destroyed spaceship has crashed nearby. Deconstruct it for steel and components.', 'good', x, y, b.id);
    return;
  }
}

function incidentThrumbo(w: World, faction: number) {
  const e = arrivalEdge(w, w.map.w >> 1, w.map.h >> 1);
  if (!e) return;
  const a = generateAnimal(w, 'thrumbo');
  spawnGroupAt(w, [a], e[0], e[1], null);
  w.letter(faction, 'Thrumbo passes', 'A rare and powerful thrumbo is passing through. It is peaceful unless attacked — and extremely dangerous if you do. Its horn is worth a fortune.', 'neutral', e[0], e[1], a.id);
}

function setCondition(w: World, id: string, days: number, faction?: number) {
  w.conditions = w.conditions.filter(c => !(c.id === id && c.faction === faction));
  w.conditions.push({ id, until: w.tick + Math.round(days * TICKS_PER_DAY), faction });
}

// ---------------- tick ----------------
export function storytellerTick(w: World) {
  // every 1000 ticks
  w.conditions = w.conditions.filter(c => c.until > w.tick);
  if (w.tick % 2500 === 0) for (const f of w.playerFactions()) w.story[f].wealth = colonyWealth(w, f);
  for (const f of w.playerFactions()) {
    const pl = w.playerByFaction(f);
    if (!pl || pl.defeated || pl.won) continue;
    if (!w.colonists(f).length) continue;
    const st = w.story[f];
    const tel = w.settings.storyteller;
    const peaceful = w.settings.difficulty === 0;
    const t = w.tick;
    // big threats
    if (t >= st.nextBig) {
      const pts = threatPoints(w, f);
      if (!peaceful) {
        if (w.rng.chance(0.78)) incidentRaid(w, f, pts);
        else incidentManhunters(w, f, pts);
      }
      st.cycle++;
      const gap = tel === 'chill' ? w.rng.range(8, 13) : tel === 'chaos' ? w.rng.range(1.5, 9) : w.rng.range(4.5, 7);
      st.nextBig = t + Math.round(gap * TICKS_PER_DAY);
    }
    if (t >= st.nextSmall) {
      const r = w.rng.f();
      if (!peaceful && r < 0.2) incidentMadAnimal(w, f);
      else if (r < 0.32) incidentDisease(w, f);
      else if (r < 0.42) { if (!incidentShortCircuit(w, f)) incidentBlight(w, f); }
      else if (r < 0.55) incidentBlight(w, f);
      else if (r < 0.7 && !peaceful && w.day > 6) incidentRaid(w, f, Math.round(threatPoints(w, f) * 0.4));
      else if (r < 0.85) { setCondition(w, 'psychic_drone', 1, f); w.letter(f, 'Psychic drone', 'A distant psychic machine is broadcasting a wave of dread. Your colonists feel terrible.', 'bad'); }
      else { setCondition(w, 'solar_flare', w.rng.range(0.3, 0.8)); w.letter(f, 'Solar flare', 'A solar flare is disrupting all electrical devices!', 'bad'); }
      st.nextSmall = t + Math.round((tel === 'chill' ? w.rng.range(4, 7) : w.rng.range(2.5, 5)) * TICKS_PER_DAY);
    }
    if (t >= st.nextGood) {
      const r = w.rng.f();
      if (r < 0.2) incidentTrader(w, f);
      else if (r < 0.32) incidentWanderer(w, f);
      else if (r < 0.44) cargoItems(w, f);
      else if (r < 0.52) incidentVisitors(w, f);
      else if (r < 0.6) { if (!incidentOrbitalTrader(w, f)) incidentTrader(w, f); }
      else if (r < 0.68) incidentHerd(w, f);
      else if (r < 0.74) incidentAnimalJoins(w, f);
      else if (r < 0.8) incidentPodCrash(w, f);
      else if (r < 0.86) incidentMeteorite(w, f);
      else if (r < 0.92) incidentShipChunk(w, f);
      else if (r < 0.95) incidentThrumbo(w, f);
      else { setCondition(w, 'psychic_soothe', 1, f); w.letter(f, 'Psychic soothe', 'A soothing psychic wave washes over your colonists.', 'good'); }
      st.nextGood = t + Math.round(w.rng.range(1.5, 3) * TICKS_PER_DAY);
    }
    // ship reactor countdown raids
    for (const b of w.buildings.values()) {
      if (b.faction !== f || !b.reactor?.started) continue;
      if (t % 20000 === 0) incidentRaid(w, f, Math.round(threatPoints(w, f) * 1.2), w.rng.chance(0.5));
    }
  }
  // global weather-ish events
  if (w.tick % 30000 === 0 && w.rng.chance(0.12)) {
    const season = w.season;
    const pf = w.playerFactions();
    const r = w.rng.f();
    let id = '', title = '', text = '', days = 1;
    if (season === 3 && r < 0.5) { id = 'cold_snap'; title = 'Cold snap'; text = 'A cold snap has begun. Temperatures will drop sharply.'; days = w.rng.range(1.5, 3); }
    else if (season === 1 && r < 0.5) { id = 'heat_wave'; title = 'Heat wave'; text = 'A heat wave has begun. Stay cool!'; days = w.rng.range(1.5, 3); }
    else if (r < 0.65) { id = 'eclipse'; title = 'Eclipse'; text = 'An eclipse has darkened the skies. Solar panels will not work.'; days = w.rng.range(0.5, 1.2); }
    else if (r < 0.85) { id = 'aurora'; title = 'Aurora'; text = 'A beautiful aurora dances across the sky.'; days = 0.5; }
    else if (w.day > 20) { id = 'toxic'; title = 'Toxic fallout'; text = 'Toxic fallout is drifting down from the sky. Keep your colonists indoors under a roof!'; days = w.rng.range(1.5, 3); }
    if (id) { setCondition(w, id, days); for (const f of pf) w.letter(f, title, text, id === 'aurora' ? 'good' : 'bad'); }
  }
  // wildlife repopulation
  if (w.tick % 6000 === 0) {
    const wild = [...w.pawns.values()].filter(p => p.faction === 0 && p.animal && !p.animal.tamed).length;
    const target = Math.round(w.map.n / 900);
    if (wild < target) {
      const ad = w.rng.weighted(WILD_ANIMALS, a => a.commonality);
      const e = arrivalEdge(w, w.map.w >> 1, w.map.h >> 1);
      if (e) {
        const n = ad.herd ? w.rng.int(ad.herd[0], ad.herd[1]) : 1;
        spawnGroupAt(w, Array.from({ length: n }, () => generateAnimal(w, ad.id)), e[0], e[1], null);
      }
    }
  }
}

export { incidentMeteorite, incidentShipChunk, incidentPodCrash, cargoItems, incidentHerd, incidentThrumbo, incidentDisease, setCondition, addThought, mkJob, placeItem };
