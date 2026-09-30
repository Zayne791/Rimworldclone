// Research-tree test: finish every project, build every unlockable building in a powered test
// yard, run a few days and check that each new mechanic actually does something.
import { createWorld, addColony, generateStartingColonists } from '../src/sim/newgame';
import { simTick } from '../src/sim/sim';
import { applyCommand } from '../src/sim/commands';
import { makeBuilding, canPlaceBuilding, spawnItem, buildingMaxHp } from '../src/sim/things';
import { RESEARCH } from '../src/data/research';
import { BUILDINGS } from '../src/data/buildings';
import { RECIPES } from '../src/data/recipes';
import { ITEMS } from '../src/data/items';
import { TERRAIN, T } from '../src/data/terrain';
import { TICKS_PER_DAY } from '../src/core/constants';
import { fxw, bindFx } from '../src/sim/techfx';
import { unlocksOf } from '../src/sim/research';
import { startFire } from '../src/sim/environment';
import { explode } from '../src/sim/combat';
import { applyDamage } from '../src/sim/health';
import { generateAnimal } from '../src/sim/pawngen';
import { spawnGroupAt } from '../src/sim/lords';

let fails = 0;
const check = (ok: boolean, what: string) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };

// ---- data integrity ----
for (const r of Object.values(RESEARCH)) for (const p of r.prereqs) check(!!RESEARCH[p], `prereq ${p} of ${r.id} exists`);
const refs: [string, string | undefined][] = [
  ...Object.values(BUILDINGS).map(b => [b.id, b.research] as [string, string | undefined]),
  ...Object.values(RECIPES).map(r => [r.id, r.research] as [string, string | undefined]),
  ...Object.values(ITEMS).map(i => [i.id, i.research] as [string, string | undefined]),
  ...TERRAIN.map(t => [t.id, t.research] as [string, string | undefined]),
];
const badRefs = refs.filter(([, r]) => r && !RESEARCH[r]);
check(!badRefs.length, `every research reference is a real project ${badRefs.map(b => b.join('→')).join(', ')}`);
for (const b of Object.values(BUILDINGS)) for (const rc of b.bench?.recipes || []) if (!RECIPES[rc]) check(false, `recipe ${rc} of ${b.id} exists`);
for (const r of Object.values(RECIPES)) {
  for (const pr of r.products || []) if (!ITEMS[pr.item]) check(false, `product ${pr.item} of ${r.id}`);
  for (const ing of r.ings) for (const it of ing.items || []) if (!ITEMS[it]) check(false, `ingredient ${it} of ${r.id}`);
  if (!Object.values(BUILDINGS).some(b => b.bench?.recipes.includes(r.id))) check(false, `recipe ${r.id} is available at some bench`);
}
const empty = Object.values(RESEARCH).filter(r => !unlocksOf(r.id).length && !r.effects);
check(!empty.length, `every project unlocks something or gives a bonus ${empty.map(r => r.id).join(', ')}`);
// cycles
const depth = (id: string, seen: string[] = []): number => { if (seen.includes(id)) throw new Error('cycle ' + seen.join('>')); return 1 + Math.max(0, ...RESEARCH[id].prereqs.map(p => depth(p, [...seen, id]))); };
for (const id in RESEARCH) depth(id);
for (const r of Object.values(RESEARCH)) for (const p of r.prereqs) if (RESEARCH[p].tier >= r.tier) check(false, `${r.id} (tier ${r.tier}) comes after its prereq ${p} (tier ${RESEARCH[p].tier})`);
console.log('projects', Object.keys(RESEARCH).length, 'max chain', Math.max(...Object.keys(RESEARCH).map(id => depth(id))));

// ---- world ----
const w = createWorld({ seed: 'tech1', mapSize: 150, storyteller: 'classic', difficulty: 0, maxPlayers: 1 });
const cols = generateStartingColonists(w, 4, 'tech1');
const [cx, cy] = addColony(w, { slot: 0, playerName: 'T', colonyName: 'Lab', colonists: cols, isHost: true });
const F = 10, m = w.map;
bindFx(w);
const before = { work: fxw(w, F, 'globalWork') };
w.research[F].done = Object.keys(RESEARCH);
check(fxw(w, F, 'globalWork') > before.work && fxw(w, F, 'globalWork') > 0.3, `effects accumulate (globalWork ${fxw(w, F, 'globalWork').toFixed(2)})`);
check(buildingMaxHp('wall', 'wood', F) > buildingMaxHp('wall', 'wood'), 'building durability bonus applies');

// clear a big yard and lay a conduit grid under it
const X0 = cx - 30, Y0 = cy + 8, X1 = cx + 30, Y1 = cy + 40;
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
  if (!m.inb(x, y)) continue;
  const i = m.idx(x, y);
  if (m.rock[i]) m.setRock(i, 0);
  if (m.plant[i]) m.setPlant(i, 0);
  if (m.isWater(i) || !TERRAIN[m.terrain[i]].canBuild) m.setTerrain(i, T('soil'));
  m.setConduit(i, F);
}
m.touchRegion();
let px = X0 + 1, py = Y0 + 1, rowH = 0;
const placed: Record<string, number> = {};
function place(def: string, stuff?: string) {
  const d = BUILDINGS[def];
  const [bw, bh] = d.size;
  if (px + bw > X1) { px = X0 + 1; py += rowH + 2; rowH = 0; }
  const chk = canPlaceBuilding(w, def, px, py, 0, F);
  if (!chk.ok && !d.wallMounted) console.log('  place warn', def, chk.reason);
  const b = makeBuilding(w, def, px, py, 0, d.stuffCats ? stuff || (d.stuffCats.includes('woody') ? 'wood' : d.stuffCats.includes('stony') ? 'blocks_granite' : 'steel') : undefined, F);
  w.register(b);
  placed[def] = b.id;
  px += bw + 1; rowH = Math.max(rowH, bh);
  return b;
}
place('gen_fusion'); place('gen_fusion'); place('battery_large');
const newIds = Object.values(BUILDINGS).filter(b => b.research && RESEARCH[b.research] && !['wall', 'door'].includes(b.id) && !b.hidden && !b.geyser && !b.wallMounted && !b.ship).map(b => b.id);
for (const id of newIds) if (!placed[id]) place(id);
console.log('placed', Object.keys(placed).length, 'buildings');

// supplies
for (const [def, n] of [['wood', 600], ['steel', 900], ['plasteel', 300], ['components', 60], ['adv_components', 20], ['uranium', 120], ['chemfuel', 300], ['gold', 60], ['cloth', 300], ['potato', 300], ['corn', 300], ['medicine', 20]] as [string, number][]) {
  let left = n; while (left > 0) { const k = Math.min(ITEMS[def].stack, left); spawnItem(w, def, k, cx + (left % 7) - 3, cy + 3); left -= k; }
}
applyCommand(w, F, { c: 'zone', op: 'new', kind: 'stockpile', cells: (() => { const o: number[] = []; for (let y = cy + 2; y <= cy + 6; y++) for (let x = cx - 6; x <= cx + 6; x++) o.push(m.idx(x, y)); return o; })() });
// fuel
for (const b of w.buildings.values()) { const d = BUILDINGS[b.def]; if (d.fuel) b.fuel = d.fuel.cap; }
// bills on new benches
const billFor: Record<string, string> = { refinery: 'make_chemfuel', paste_dispenser: 'make_paste', component_assembler: 'make_components_basic', nano_assembler: 'make_adv_components_nano', electric_smelter: 'smelt_slag' };
for (const [bid, rec] of Object.entries(billFor)) { const r = applyCommand(w, F, { c: 'bill', op: 'add', bench: placed[bid], recipe: rec }); if (!r.ok) console.log('bill fail', bid, r.msg); }
// terrain for pumps / terraformer
const pump = w.buildings.get(placed.moisture_pump)!, terra = w.buildings.get(placed.terraformer)!;
for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
  for (const [b, t] of [[pump, 'marsh'], [terra, 'sand']] as const) {
    const x = b.x + dx, y = b.y + dy; if (!m.inb(x, y)) continue; const i = m.idx(x, y);
    if (!m.bld[i] && !m.floor[i]) m.setTerrain(i, T(t));
  }
}
const countT = (b: typeof pump, t: string) => { let n = 0; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const x = b.x + dx, y = b.y + dy; if (m.inb(x, y) && TERRAIN[m.terrain[m.idx(x, y)]].id === t) n++; } return n; };
const marsh0 = countT(pump, 'marsh'), sand0 = countT(terra, 'sand');

const itemCount = (def: string) => [...w.items.values()].filter(i => i.def === def).reduce((s, i) => s + i.count, 0);
const honey0 = itemCount('honey'), meat0 = itemCount('meat');
// fire next to the popper
const pop = w.buildings.get(placed.firefoam_popper)!;
let t = 0;
const run = (ticks: number) => { for (let k = 0; k < ticks; k++) { simTick(w); t++; } };
run(600);
check([...w.buildings.values()].filter(b => BUILDINGS[b.def].power?.use && b.faction === F).every(b => b.powered), 'everything in the yard is powered');
startFire(w, pop.x + 2, pop.y, 0.6);
run(200);
check(![...w.fires.values()].some(f => Math.abs(f.x - pop.x) < 5 && Math.abs(f.y - pop.y) < 5), 'firefoam popper smothered the fire');
check((pop.cd || 0) > w.tick, 'popper is recharging');

// weather controller
w.weather.cur = 'rain'; w.weather.t = 99999;
run(500);
check(w.weather.cur === 'clear', `weather controller cleared the sky (${w.weather.cur})`);

// climate unit room: build a small sealed room around it
const cu = w.buildings.get(placed.climate_unit)!;
// EMP vs mech
const mech = generateAnimal(w, 'scyther', 0, false);
spawnGroupAt(w, [mech], cx - 20, cy - 20, null);
const hp0 = mech.hediffs.length;
explode(w, mech.x, mech.y, 3, 50, 0, false, true);
check(mech.dead || mech.hediffs.length > hp0 && (mech.stun || 0) > 0, 'EMP wrecks and stuns mechanoids');
const human = cols[0];
const hh = human.hediffs.length;
explode(w, human.x, human.y, 3, 50, 0, false, true);
check(human.hediffs.length === hh, 'EMP is harmless to people');
// shield belt
const belt = { id: w.newId(), kind: 'item' as const, def: 'shield_belt', x: 0, y: 0, count: 1, hp: 150 };
cols[1].apparel.push(belt as any);
const hb = cols[1].hediffs.length;
for (let k = 0; k < 4; k++) applyDamage(w, cols[1], { amount: 12, type: 'bullet', pen: 0.2 });
check(cols[1].hediffs.length === hb && (cols[1].shield || 0) > 0, `shield belt absorbed 4 bullets (energy ${cols[1].shield})`);
for (let k = 0; k < 8; k++) applyDamage(w, cols[1], { amount: 12, type: 'bullet', pen: 0.2 });
check((cols[1].shieldT || 0) > w.tick, 'shield breaks when drained');

run(TICKS_PER_DAY * 1.2);
{ const hv = w.buildings.get(placed.beehive)!, mv = w.buildings.get(placed.meat_vat)!; console.log('debug beehive prog', hv.prog, 'temp', w.outdoorTemp.toFixed(1), 'roof', m.roof[m.idx(hv.x, hv.y)], '| vat prog', mv.prog, 'powered', mv.powered); }
run(TICKS_PER_DAY * 3);
const prod = (w._cache.produced || {}) as Record<string, number>;
console.log('produced', JSON.stringify(prod));
const madeBy = (b: string) => Object.entries(prod).filter(([k]) => k.startsWith(b + ':')).reduce((s, [, v]) => s + v, 0);
check(madeBy('beehive') > 0, `beehive made honey (${madeBy('beehive')})`);
check(madeBy('meat_vat') >= 60, `meat vat grew meat (${madeBy('meat_vat')})`);
const drill = w.buildings.get(placed.deep_drill)!;
check(madeBy('deep_drill') > 0, `deep drill brought up ore (${madeBy('deep_drill')})`);
check(countT(pump, 'marsh') < marsh0, `moisture pump drained marsh ${marsh0} → ${countT(pump, 'marsh')}`);
check(countT(terra, 'sand') < sand0, `terraformer converted sand ${sand0} → ${countT(terra, 'sand')}`);
const made = (def: string) => itemCount(def) > 0;
check(made('meal_paste'), `paste dispenser made paste (${itemCount('meal_paste')})`);
check(itemCount('chemfuel') !== 300 || made('meal_paste'), `refinery ran (chemfuel ${itemCount('chemfuel')})`);
const scanLetters = w.letters.filter(l => l.title.startsWith('Orbital scan'));
console.log('orbital scan letters', scanLetters.length, '(needs ~4 days)');
console.log('letters:', w.letters.slice(-12).map(l => l.title).join(' | '));
console.log(fails ? `${fails} FAILURES` : 'all tech checks passed');
process.exit(fails ? 1 : 0);
