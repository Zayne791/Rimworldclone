// Generates FEATURES.md: a player-facing guide to everything in the game.
// The catalog tables are built straight from the game definitions in src/data, so they stay accurate;
// the prose sections describe how the systems behave. Run: npx tsx dev/gen-features.ts
import { writeFileSync } from 'node:fs';
import { BUILDINGS } from '../src/data/buildings';
import { ITEMS, QUALITY_LABELS, QUALITY_STAT } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { RESEARCH, BRANCHES, ERAS, eraOf, EFFECT_INFO } from '../src/data/research';
import { effectsOf, effectText } from '../src/sim/research';
import { ACTIONS, TONES, MIN_GAP } from '../src/sim/minds';
import { PRICE } from '../src/mind/llm';
import { ANIMALS } from '../src/data/animals';
import { PLANTS } from '../src/data/plants';
import { TERRAIN, ROCKS } from '../src/data/terrain';
import { TRAITS, BACKSTORIES, THOUGHTS, MENTAL_BREAKS, WORK_TYPES, SKILLS } from '../src/data/pawns';
import { DISEASES, HUMAN_BODY, BLEED_RATE, INFECTION_CHANCE, INJURY_LABELS } from '../src/data/health';
import { WEATHERS } from '../src/sim/environment';
import { TICKS_PER_DAY, TICKS_PER_SECOND, DAYS_PER_SEASON, SEASONS, SPEED_TPS, MAX_PLAYERS } from '../src/core/constants';
import type { BuildingDef, ItemDef } from '../src/data/types';

const out: string[] = [];
const P = (...lines: string[]) => out.push(...lines);
const esc = (s: string) => String(s).replace(/\|/g, '\\|');
const table = (head: string[], rows: (string | number)[][]) => {
  P(`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`);
  for (const r of rows) P(`| ${r.map(c => esc(String(c))).join(' | ')} |`);
  P('');
};
const label = (id: string) => ITEMS[id]?.label ?? BUILDINGS[id]?.label ?? id;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const secs = (ticks: number) => `${(ticks / TICKS_PER_SECOND).toFixed(ticks < 120 ? 1 : 0)}s`;
const resLabel = (id?: string) => (id ? RESEARCH[id]?.label ?? id : '—');
const STUFF_WORD: Record<string, string> = { woody: 'wood', stony: 'stone', metallic: 'metal', fabric: 'fabric', leathery: 'leather' };
const costText = (cost?: Record<string, number>, stuffCats?: string[], stuffCount?: number) => {
  const parts: string[] = [];
  if (stuffCats && stuffCount) parts.push(`${stuffCount} ${stuffCats.map(c => STUFF_WORD[c] || c).join('/')}`);
  for (const [k, v] of Object.entries(cost || {})) parts.push(`${v} ${v === 1 && label(k).endsWith('components') ? label(k).slice(0, -1) : label(k)}`);
  return parts.join(' + ') || 'free';
};

// ---------- facts we verified by reading the simulation (keep in sync when behaviour changes) ----------
// traits whose description is shown in game but whose effect is not simulated yet
const TRAIT_GAPS: Record<string, string> = {
  night_owl: 'Not simulated yet: no night-work preference or mood effect.',
  undergrounder: 'Not simulated yet: there are no indoor/outdoor mood effects for it to cancel.',
  pyromaniac: 'Refusing firefighting works; fire-starting and the fire mood bonus are not simulated yet.',
  brawler: 'Better melee hit chance works; the dislike of guns is not simulated yet.',
  great_memory: 'Acts as +10% learning; skills never decay in this game, so there is nothing to slow.',
  too_smart: '',
};
// thoughts defined but never triggered by the simulation
const UNUSED_THOUGHTS = new Set(['broke_up', 'sold_prisoner', 'released_prisoner', 'executed_prisoner', 'minor_break', 'uncomfortable', 'cramped', 'pyro_fire', 'cabin_fever']);
// what each mental break actually does in the simulation
const BREAK_DOES: Record<string, string> = {
  sad_wander: 'wanders aimlessly', food_binge: 'eats everything it can reach', hide_room: 'stays by their bed',
  tantrum: 'attacks colony buildings nearby', insulting_spree: 'insults everyone they talk to', berserk: 'attacks anyone nearby',
  give_up: 'walks off the map and leaves the colony for good', catatonic: 'collapses, helpless, for about a day',
};
const CAP_LABEL: Record<string, string> = { bloodPumping: 'blood pumping' };

// ======================================================================================
P('# Starfall Colony: feature guide', '');
P('Everything currently in the game, and what to look for while playing. The catalog tables (buildings, items,',
  'research, animals, plants, traits…) are generated from the game\'s own definition files by',
  '`npx tsx dev/gen-features.ts`, so the numbers match the code. Where a feature is described in game but not',
  'fully simulated yet, this guide says so.', '');

const counts = {
  buildings: Object.values(BUILDINGS).filter(b => !b.hidden).length,
  items: Object.keys(ITEMS).length,
  research: Object.keys(RESEARCH).length,
  recipes: Object.keys(RECIPES).length,
  animals: Object.keys(ANIMALS).length,
  plants: PLANTS.length - 1,
  traits: Object.keys(TRAITS).length,
  backstories: BACKSTORIES.length,
  thoughts: Object.keys(THOUGHTS).length,
};
table(['Content', 'Count'], [
  ['Buildings & furniture (buildable)', counts.buildings], ['Items (resources, food, weapons, apparel, medicine)', counts.items],
  ['Research projects', counts.research], ['Crafting / cooking recipes', counts.recipes], ['Animals & mechanoids', counts.animals],
  ['Plants, crops & trees', counts.plants], ['Colonist traits', counts.traits], ['Backstories', counts.backstories],
  ['Mood thoughts', counts.thoughts], ['Weather types', Object.keys(WEATHERS).length],
]);

P('## Contents', '');
const SECTIONS = ['First hour: what to try', 'Screen & controls', 'Starting a game', 'Time, seasons & weather', 'Colonists', 'Mood, thoughts & mental breaks',
  'Health & medicine', 'Building', 'Floors, terrain & mining', 'Rooms, beauty & temperature', 'Power', 'Farming & plants', 'Food & cooking',
  'Crafting & production', 'Items', 'Research tree', 'AI minds (DeepSeek)', 'Combat & defense', 'Animals', 'Events & storytellers', 'Trading, visitors & factions',
  'Endgame: build a ship', 'Multiplayer', 'Saving', 'Art, sound & presentation', 'Known gaps'];
SECTIONS.forEach((s, k) => P(`${k + 1}. [${s}](#${s.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-')})`));
P('');

// ======================================================================================
P('## First hour: what to try', '');
P('A tour that touches most systems. Each step names what you should see happen.', '');
P(
  '1. **Title screen.** A small colony is already living behind the menu: that is the real game running.',
  '2. **New colony → pick a crew.** Reroll colonists you don\'t like; look at traits, passions (flame icons) and "won\'t do" work.',
  '   Pick a husky or cat. On the landing map, tap a spot or use *Pick for me*.',
  '3. **Crash site.** Three colonists land with a bolt-action rifle, a revolver and a knife, plus steel (450), wood (300),',
  '   40 survival meals, 20 medicine, 30 components, 800 silver and 60 cloth. A letter explains the situation.',
  '4. **Follow the hints on the left** (tap ones marked ›): make a stockpile zone, a growing zone, a cooking spot…',
  '5. **Build a room.** Build → Structure → Wall, then drag diagonally to outline a whole room. Add a door, then beds.',
  '   Watch the roof appear automatically once the room is enclosed (Zones → Roofs view shows it).',
  '6. **Kitchen.** A campfire and a butcher spot start with a bill already (cook until 10 meals / butcher forever).',
  '7. **Hunt.** Orders → Hunt, tap a deer or boar. The hunter shoots it, carries it to the butcher spot, the cook butchers',
  '   it and turns the meat into simple meals. Some animals fight back.',
  '8. **Research.** Build a research bench (Build → Production), open Research, pick Electricity. Its prerequisite links light up.',
  '9. **Night.** Around 7pm the light fades; campfires and torches cast warm light. Colonists go to bed on schedule.',
  '10. **First raid (around day 4–5).** A red letter and alarm. Tap ⚔ *Draft all*, then tap raiders to attack.',
  '    Raiders flee after losing half their group. Downed colonists need rescuing (long-press them).',
  '11. **Multiplayer.** Menu → room code / *Copy invite link* when hosting; a friend on another device lands their own colony on your map.',
  '12. **AI minds.** Menu → AI minds → turn it on. Every colonist is now played by DeepSeek: watch the thought bubbles, speech',
  '    bubbles and the Colony → Voices log. (No key? Pick *Offline mind* to try it for free.)',
  '');

// ======================================================================================
P('## Screen & controls', '');
P('The game is built for touch, portrait first.', '');
table(['Area', 'What it shows'], [
  ['Top bar', 'Time, date, weather and temperature; pause and 3 speed buttons; multiplayer status (who is holding the speed down, "waiting for host")'],
  ['Colonist bar', 'Portrait, name and mood bar per colonist; ⚔ drafted, ✚ downed, ! mental break, ★ inspired. A red ⚔ Draft all button appears during threats'],
  ['Hints (left)', 'Problems and next steps: raiders, starving, bleeding, break risk, idle colonists, low food/wood/medicine, missing beds or kitchen… Tap to jump or open the fixing menu'],
  ['Letters (right)', 'Event messages (red = threat, orange = bad, green = good, blue = info). Tap to read; Jump to shows the spot'],
  ['Inspector sheet (bottom)', 'Whatever is selected: colonist tabs (Overview, Health, Gear, Skills, Mood, Social), building controls, zone settings. Collapse with ▼'],
  ['Bottom tabs', 'Build, Orders, Zones, Work (priorities and schedules), Research, Colony (colonists, animals, factions/diplomacy, stats, log), Menu'],
]);
table(['Gesture / key', 'Action'], [
  ['Drag', 'Pan (with a build/zone tool active, drag paints the area instead)'], ['Pinch / mouse wheel', 'Zoom'],
  ['Tap', 'Select; tap again to cycle through stacked things'], ['Double-tap a colonist', 'Select all your colonists on screen'],
  ['Long-press / right-click', 'Context menu: equip, wear, eat, haul, rescue, capture, tend, attack, prioritize building, sleep in bed, mine, cut, go here, hunt, tame, slaughter, inspect tile'],
  ['Orders → Select box', 'Drag a selection box on touch (left-drag does this with a mouse)'],
  ['Space', 'Pause'], ['1–4', 'Game speeds'], ['R', 'Draft/undraft selected (rotate while placing a building)'], ['F', 'Toggle fire at will'],
  ['B / O / Z', 'Build / Orders / Zones'], ['Tab', 'Next colonist'], ['Esc', 'Cancel tool or close window'], ['WASD / arrows', 'Pan'],
]);
P('**Orders tab:** mine, chop wood, harvest, cut plants, hunt, tame, slaughter, deconstruct, cancel, forbid, unforbid, select box,',
  'home area add/clear, build roof, remove roof, no-roof area, remove floor.', '',
  '**Zones tab:** stockpile, growing zone (pick the crop), dumping zone (chunks and corpses), remove zone; overlay toggles for zones,',
  'home area, roofs, temperature and names. Selected zones can be expanded, shrunk or deleted; stockpiles and shelves have',
  'priorities and category filters.', '',
  '**Menu:** save, export save file, how to play, sound volumes and mute, display toggles, graphics (Auto / Sharp / Fast;',
  'Auto lowers the render resolution on slower devices), multiplayer room code and invite link, exit.', '');

// ======================================================================================
P('## Starting a game', '');
table(['Setting', 'Options'], [
  ['Storyteller', 'Steady Sol (balanced), Gentle Gaia (relaxed: fewer, further-apart threats), Wildcard Wren (chaos: random gaps and threat sizes)'],
  ['Difficulty', 'Peaceful (no raids or manhunters), Easy, Normal, Hard, Brutal (threat size ×0.35, ×0.6, ×1, ×1.35, ×1.75)'],
  ['Map size', 'Solo: Small 100, Medium 140, Large 180 tiles. Multiplayer: Medium 160, Large 200, Huge 240'],
  ['World seed', 'Any text; same seed = same map'],
  ['Crew', '3 colonists, each rerollable; choose a pet (husky or cat)'],
  ['Landing site', 'Tap anywhere on the minimap; it reports how much open ground is there. Mountains give ore and overhead-rock bases'],
  ['Multiplayer only', `Max players (2–${MAX_PLAYERS}), player-vs-player (wars allowed / peaceful only)`],
]);

// ======================================================================================
P('## Time, seasons & weather', '');
P(`A day is about ${Math.round(TICKS_PER_DAY / TICKS_PER_SECOND / 60)} real minutes at 1× speed. Speeds are 1×, 3×, 6× and 15× (${SPEED_TPS.slice(1).join(' / ')} ticks per second).`,
  `A season lasts ${DAYS_PER_SEASON} days (${SEASONS.join(', ')}), so a year is ${DAYS_PER_SEASON * 4} days. Temperatures follow the season`,
  '(about 13 °C average, ±14 °C over the year) and the time of day (±5 °C). Winter below −8 °C kills outdoor crops; snow builds up',
  'and slows movement. Lightning in thunderstorms can start fires.', '');
table(['Weather', 'Light', 'Shooting accuracy', 'Move speed', 'Temp', 'Notes'], Object.values(WEATHERS).map(wd => [
  wd.label, pct(wd.light), pct(wd.accuracy), pct(wd.move), `${wd.tempOffset >= 0 ? '+' : ''}${wd.tempOffset} °C`,
  [wd.rain ? 'rain (puts out fires, soaks colonists)' : '', wd.snow ? 'snowfall' : '', (wd as any).lightning ? 'lightning strikes' : '', (wd as any).fog ? 'fog' : ''].filter(Boolean).join(', ') || '—',
]));
table(['World condition', 'Effect'], [
  ['Eclipse', 'Dark skies for up to a day; solar panels produce nothing; small mood penalty'],
  ['Aurora', 'Beautiful night sky; mood bonus'],
  ['Solar flare', 'All electrical devices stop for part of a day'],
  ['Cold snap (winter)', 'Temperatures drop sharply for 1.5–3 days'],
  ['Heat wave (summer)', 'Temperatures spike for 1.5–3 days'],
  ['Toxic fallout (after day 20)', 'Colonists outdoors build up toxicity (mood penalty, can kill); keep them under roofs'],
  ['Psychic drone', 'Colony-wide mood penalty (−15) for a day'],
  ['Psychic soothe', 'Colony-wide mood bonus (+12) for a day'],
]);

// ======================================================================================
P('## Colonists', '');
P('Each colonist has a name and nickname, age, childhood and adulthood backstory, up to 3 traits, 12 skills with passions,',
  'needs, health, gear, relationships and a work schedule. Skills rise with use: no passion learns at 35% speed,',
  'a minor passion (♨) at 100%, a major passion (🔥) at 150%. Skills do not decay.', '');
P('**Needs:** food, rest, recreation (joy), comfort, beauty (of surroundings) and mood. Colonists eat when hungry (preferring meals,',
  'at a table if there is one), sleep in their own bed on schedule, and seek recreation (games, watching the sky, walks, beer).', '');
P('### Skills', '');
P(SKILLS.map(s => s.label).join(', ') + '.', '');
P('### Work types', '');
P('Set priorities in the Work tab: tap a cell to cycle 1 (highest) → 4 → off. Gold borders mark each colonist\'s best skills.',
  'Colonists always take the highest-priority work available. The Schedule tab paints hours as sleep, recreation, work or anything.', '');
table(['Work', 'Skill', 'What it covers'], WORK_TYPES.filter(w => !w.hidden).map(w => [w.label, w.skills.map(s => SKILLS.find(k => k.id === s)?.label).join(', ') || '—', w.desc]));
P('### Traits', '');
table(['Trait', 'Effect', 'Excludes'], Object.values(TRAITS).map(t => [
  t.label, t.desc + (TRAIT_GAPS[t.id] ? ` *${TRAIT_GAPS[t.id]}*` : ''),
  (t.conflicts || []).map(c => TRAITS[c]?.label || c).join(', ') || '—',
]));
P('### Backstories', '');
P('Backstories add starting skill bonuses and can rule out work types ("won\'t do").', '');
const bsRow = (b: typeof BACKSTORIES[number]) => [b.title, Object.entries(b.skills).map(([k, v]) => `${SKILLS.find(s => s.id === k)?.label} +${v}`).join(', '), (b.disables || []).map(d => WORK_TYPES.find(w => w.id === d)?.label || d).join(', ') || '—', b.desc];
P('**Childhood**', '');
table(['Backstory', 'Skills', "Won't do", 'Story'], BACKSTORIES.filter(b => b.kind === 'child').map(bsRow));
P('**Adulthood**', '');
table(['Backstory', 'Skills', "Won't do", 'Story'], BACKSTORIES.filter(b => b.kind === 'adult').map(bsRow));
P('### Social life', '');
P('Colonists chat, have deep talks, insult each other (Abrasive colonists especially), and form opinions of each other.',
  'With AI minds on, conversations are chosen and worded by the colonists themselves (see AI minds).',
  'Romance can start between colonists who like each other (lovers want to share a bed; rejection hurts). Insults can escalate',
  'into social fights. Losing a friend or lover is a heavy mood blow. Pets follow their master around.', '');

// ======================================================================================
P('## Mood, thoughts & mental breaks', '');
P('Mood (0–100%) is the sum of active thoughts, traits and expectations. Expectations rise with colony wealth, so a rich colony',
  'needs nicer rooms and food to stay happy. If mood falls below a colonist\'s break threshold they may snap:', '');
table(['Break level', 'Default threshold', 'Possible breaks'], (['minor', 'major', 'extreme'] as const).map((lvl, k) => [
  cap(lvl), ['below 35%', 'below 20%', 'below 5%'][k], MENTAL_BREAKS[lvl].map(b => `${b.label}: ${BREAK_DOES[b.id] || b.desc}`).join('; '),
]));
P('Iron-willed/Steadfast lower these thresholds; Nervous/Volatile/Too smart raise them. Breaks end after a while and can leave a',
  '*Catharsis* mood boost. A very happy colonist (mood above 80%) can be struck by an **inspiration: work frenzy**, working twice as',
  'fast for a day (this is the only inspiration type so far).', '');
P('### All thoughts', '');
P('*Memories* last for the listed time; *situational* thoughts apply while the condition holds. Thoughts marked † are defined but',
  'nothing triggers them yet.', '');
table(['Thought', 'Mood', 'Lasts', 'Social opinion'], Object.values(THOUGHTS).filter(t => t.id !== 'trait_mood').map(t => [
  t.label + (UNUSED_THOUGHTS.has(t.id) ? ' †' : ''), `${t.mood > 0 ? '+' : ''}${t.mood}`, t.days !== undefined ? `${t.days} day${t.days === 1 ? '' : 's'}${t.stack ? ` (stacks ×${t.stack})` : ''}` : 'situational',
  t.social ? `${t.social > 0 ? '+' : ''}${t.social}` : '—',
]));

// ======================================================================================
P('## Health & medicine', '');
P('Damage lands on individual body parts. Injuries bleed, hurt and can get infected; destroyed parts are lost for good',
  '(a lost leg means slower walking, a lost hand weaker manipulation, a lost eye worse sight). Healed injuries can leave scars.',
  'Enough pain, blood loss or a damaged brain puts a pawn **down**; destroying a vital part kills them.', '');
table(['Body part', 'HP', 'Affects', 'Vital'], HUMAN_BODY.map(pt => [cap(pt.label), pt.hp, (pt.capacity || []).map(c => CAP_LABEL[c.cap] || c.cap).join(', ') || '—', pt.vital ? 'yes' : '']));
P('**Capacities:** consciousness, moving, manipulation, sight, breathing and blood pumping. They drive work speed, walking speed,',
  'shooting and more, and are listed on each colonist\'s Health tab together with pain and bleeding rate.', '');
table(['Injury type', 'Name when fresh / healed', 'Bleeds', 'Infection chance'], Object.entries(INJURY_LABELS).filter(([k]) => k !== 'sharp').map(([k, [a, b]]) => [
  k, `${a} / ${b}`, BLEED_RATE[k] ? 'yes' : 'no', pct(INFECTION_CHANCE[k] ?? 0),
]));
table(['Disease', 'Progress per day (untended / tended)', 'Immunity gain per day', 'Lethal'], Object.values(DISEASES).map(d => [d.label, `${pct(d.sevPerDay)} / ${pct(d.sevPerDayTended)}`, pct(d.immPerDay), d.lethal ? 'yes' : 'no']));
P('Immunity racing severity decides the outcome: keep the patient in bed and tended by a doctor. Other conditions:',
  '**hypothermia** and **frostbite** (cold), **heatstroke** (heat), **malnutrition** (starving: fatal after about 3 days at',
  'zero food), **toxic buildup** (fallout), **food poisoning** (bad cooking) and **blood loss**.', '');
P('**Doctoring:** doctors rescue downed colonists to a bed and tend wounds; tend quality comes from Medical skill and the medicine',
  'used (tending without medicine is weaker, and self-tending is 30% worse). Medicine: herbal (60% potency; grow healroot),',
  'medicine (100%; drug lab), glitterworld (160%; traders only). Mark a bed *Medical* in its inspector to reserve it for',
  'patients; hospital beds are a comfier medical bed.', '');

// ======================================================================================
P('## Building', '');
P('Pick a structure in the Build tab, choose its material where it has one, then tap or drag. Colonists deliver materials to the',
  'blueprint and construct it (Construction skill, some things need a minimum skill). Material matters: wood builds fast but burns;',
  'stone blocks are slow, strong and fireproof; metals sit between. Buildings with quality (furniture, beds, art) roll a quality',
  `from ${QUALITY_LABELS.join(', ')}; quality scales their stats from ${pct(QUALITY_STAT[0])} to ${pct(QUALITY_STAT[QUALITY_STAT.length - 1])}.`,
  'Plants under a blueprint are cut first. Deconstruct returns materials. Doors only open for your colonists and allies; a door can',
  'be held open. The *Copy* button repeats a selected building.', '');
const CAT_LABEL: Record<string, string> = { structure: 'Structure', furniture: 'Furniture', production: 'Production', power: 'Power', temperature: 'Temperature', lighting: 'Lighting', security: 'Security', joy: 'Recreation', misc: 'Misc', ship: 'Ship', art: 'Art', floors: 'Floors' };
const bNotes = (d: BuildingDef) => {
  const n: string[] = [];
  if (d.bed) n.push(`${d.bed.sleepers > 1 ? `${d.bed.sleepers} sleepers, ` : ''}comfort ${pct(d.bed.comfort)}${d.bed.medical ? ', medical' : ''}`);
  if (d.seat) n.push(`seat, comfort ${pct(d.seat.comfort)}`);
  if (d.table) n.push('dining table');
  if (d.power?.use) n.push(`uses ${d.power.use} W`);
  if (d.power?.gen) n.push(`makes ${d.power.kind === 'wind' ? 'up to ' : d.power.kind === 'solar' ? 'up to ' : ''}${d.power.gen} W`);
  if (d.power?.battery) n.push(`stores ${d.power.battery} Wd`);
  if (d.fuel) n.push(`burns ${d.fuel.perDay} ${label(d.fuel.item)}/day (holds ${d.fuel.cap})`);
  if (d.light) n.push(`light radius ${d.light.radius}${d.light.sun ? ', grows plants' : ''}`);
  if (d.heat) n.push(d.heat.both ? `heats or cools toward ${d.heat.target} °C` : d.heat.watts > 0 ? `heats toward ${d.heat.target} °C` : `cools toward ${d.heat.target} °C`);
  if (d.cooler) n.push('cools one side, heats the other');
  if (d.vent) n.push('shares temperature between rooms');
  if (d.bench?.recipes.length) n.push(`makes: ${d.bench.recipes.map(r => { const l = RECIPES[r]?.label.replace(/^(Make|Cook|Cut) /, '') || r; return l.charAt(0).toLowerCase() + l.slice(1); }).join(', ')}`);
  if (d.bench?.research) n.push(`research speed ${pct(d.bench.researchSpeed || 1)}`);
  if (d.joy) n.push(`recreation (${d.joy.kind}, ${d.joy.users || 1} users)`);
  if (d.storage) n.push(`${d.storage.stacks} stacks per cell${d.storage.cats ? ` (${d.storage.cats.join(', ').replace(/_/g, ' ')})` : ''}`);
  if (d.turret) n.push(`auto-fires ${label(d.turret.weapon)}${d.turret.power ? ' (needs power)' : ''}`);
  if (d.trap) n.push(d.trap.explosive ? `explodes (radius ${d.trap.explosive.radius}, ${d.trap.explosive.damage} damage)` : `${d.trap.damage} damage, single use`);
  if (d.producer) n.push(`produces ${d.producer.items.map(([i, c]) => `${c} ${label(i)}`).join(' or ')} ${d.producer.days === 1 ? 'a day' : `every ${d.producer.days} days`}${d.producer.outdoors ? ', needs open sky' : ''}${d.producer.minTemp !== undefined ? `, above ${d.producer.minTemp} °C` : ''}`);
  if (d.aura && d.desc) n.push(d.desc);
  if (d.cover) n.push(`cover ${pct(d.cover)}`);
  if (d.growBasin) n.push(`fertility ${pct(d.growBasin.fert)}`);
  if (d.beauty) n.push(`beauty ${d.beauty > 0 ? '+' : ''}${d.beauty}`);
  if (d.quality) n.push('has quality');
  if (d.geyser) n.push('must sit on a steam geyser');
  if (d.wallMounted) n.push('built into a wall');
  if (d.comms) n.push('contacts orbital traders');
  if (d.desc && !n.length) n.push(d.desc);
  return n.join('; ');
};
for (const cat of ['structure', 'furniture', 'production', 'power', 'temperature', 'lighting', 'security', 'joy', 'art', 'misc', 'ship']) {
  const list = Object.values(BUILDINGS).filter(d => d.cat === cat && !d.hidden);
  if (!list.length) continue;
  P(`### ${CAT_LABEL[cat]}`, '');
  table(['Building', 'Size', 'Cost', 'Research', 'Notes'], list.map(d => [cap(d.label), `${d.size[0]}×${d.size[1]}`, costText(d.cost, d.stuffCats, d.stuffCount), resLabel(d.research), bNotes(d)]));
}
P('Map features you can use: **steam geysers** (build a geothermal generator on them) and **ship chunks** (deconstruct for steel',
  'and components).', '');

// ======================================================================================
P('## Floors, terrain & mining', '');
const floors = TERRAIN.filter(t => t.floor);
table(['Floor', 'Cost', 'Beauty', 'Cleanliness', 'Research'], floors.map(t => [cap(t.label), t.stuffFloor ? 'stone blocks' : costText(t.cost), t.beauty, t.clean ?? 0, resLabel(t.research)]));
table(['Natural terrain', 'Fertility', 'Extra move cost', 'Can build heavy structures'], TERRAIN.filter(t => !t.floor && t.id !== 'none').map(t => [cap(t.label), pct(t.fert), t.water === 'deep' ? 'impassable' : t.moveCost, t.canBuild ? 'yes' : 'no']));
P('Mountains are solid rock: mine them (Orders → Mine) for stone chunks (cut into blocks at a stonecutter\'s table) and ore.',
  'Mined-out areas under a mountain keep an **overhead rock roof**, making natural fortress bases. Deep water blocks movement.', '');
table(['Rock / ore', 'Mining yields'], ROCKS.filter(r => r.id !== 'none').map(r => [cap(r.label), r.yieldItem ? `${r.yieldCount} ${label(r.yieldItem)}` : r.chunk ? `${label(r.chunk)} (sometimes)` : '—']));

// ======================================================================================
P('## Rooms, beauty & temperature', '');
P('Walls, doors and wall-mounted coolers/vents enclose **rooms**, which are roofed automatically (roofs need support within a few',
  'tiles; unsupported roofs collapse). Each room gets a role from its contents: bedroom, barracks, prison cell, hospital, kitchen,',
  'laboratory, dining room, rec room, dining & rec room, workshop, power room, storeroom.', '');
P('**Impressiveness** combines beauty (35%), wealth (25%), space (25%) and cleanliness (15%); tiny rooms are capped. Impressive',
  'bedrooms and dining rooms give mood bonuses, awful ones penalties; barracks give a small penalty. **Beauty** comes from',
  'furniture, art, flowers, floors and materials, and is lowered by filth, blood, corpses and ugly things. Colonists clean filth in',
  'the home area. Darkness gives a mood penalty.', '');
P('**Temperature** is tracked per room and blends with the outdoors through doors and vents. Heaters and campfires warm, coolers',
  'and passive coolers cool; set a heater\'s or cooler\'s target in its inspector. Colonists get cold/hot thoughts, then',
  'hypothermia/heatstroke. Food rots more slowly in the cold and stops rotting below freezing, so a cooled room is a freezer.', '');

// ======================================================================================
P('## Power', '');
P('Research Electricity, then connect generators, batteries and consumers with power conduits. Each connected network balances',
  'production against use; batteries fill from surplus and cover shortfalls. Solar needs daylight (nothing at night or during an',
  'eclipse), wind varies with the wind, wood-fired generators need refuelling, geothermal is constant. A short circuit can blow up',
  'a battery and start a fire; a solar flare stops all electrical devices. Unpowered devices show a hint.', '');

// ======================================================================================
P('## Farming & plants', '');
P('Make a growing zone and pick a crop; growers sow and harvest it. Plants grow only in enough light and at 0–42 °C (best 10–35 °C),',
  'faster on richer soil. Hydroponics basins with sun lamps grow crops indoors. Wild plants spread slowly; animals graze them;',
  'crop blight can wipe out fields.', '');
const crops = PLANTS.filter(p => p.sowable && p.kind !== 'tree');
table(['Crop', 'Grow days', 'Harvest', 'Min. fertility', 'Research'], crops.map(p => [cap(p.label), p.growDays, p.harvestItem ? `${p.harvestYield} ${label(p.harvestItem)}` : `beauty +${p.beauty}`, pct(p.minFert), resLabel(p.research)]));
P('"Grow days" count only growing time; with nights and weather it takes noticeably longer on the calendar.', '');
table(['Wild plant / tree', 'Kind', 'Gives', 'Notes'], PLANTS.slice(1).filter(p => !crops.includes(p)).map(p => [cap(p.label), p.kind,
  p.woodYield ? `${p.woodYield} wood` : p.harvestItem ? `${p.harvestYield} ${label(p.harvestItem)}` : '—',
  [p.blocksSight ? 'blocks sight' : '', p.cover ? `cover ${pct(p.cover)}` : '', p.beauty ? `beauty +${p.beauty}` : '', p.minTemp !== undefined ? `grows above ${p.minTemp} °C` : ''].filter(Boolean).join(', ') || '—']));

// ======================================================================================
P('## Food & cooking', '');
P('Colonists prefer meals over raw food (raw food gives a mood penalty). Cooks make meals at a campfire or stove from raw food;',
  'butchers turn corpses into meat (and leather or fur). Meals rot in a few days unless kept cold. A packaged survival meal never',
  'rots. Low food shows a hint with the days of food left.', '');
const foods = Object.values(ITEMS).filter(i => i.food);
table(['Food', 'Nutrition', 'Rots in', 'Mood'], foods.map(i => [cap(i.label) + (i.food!.kind === 'hay' ? ' (animal feed)' : ''), i.food!.nutrition, i.food!.rotDays ? `${i.food!.rotDays} days` : 'never',
  i.food!.thought ? `${THOUGHTS[i.food!.thought]?.label} (${THOUGHTS[i.food!.thought]!.mood > 0 ? '+' : ''}${THOUGHTS[i.food!.thought]?.mood})` : '—']));

// ======================================================================================
P('## Crafting & production', '');
P('Production buildings hold **bills**: tap a bench → Bills. A bill can run a set number of times, *until you have N*, or forever;',
  'it gathers ingredients within a radius and, for stuff-based items, lets you choose the material. Crafted weapons, apparel and',
  'art roll quality from the crafter\'s skill. New campfires/stoves start with a "cook simple meal until 10" bill and new butcher',
  'spots/tables with "butcher forever".', '');
const benchOf = (rid: string) => Object.values(BUILDINGS).filter(b => b.bench?.recipes.includes(rid)).map(b => b.label).join(', ');
table(['Recipe', 'Made at', 'Ingredients', 'Makes', 'Skill (min)', 'Research'], Object.values(RECIPES).map(r => [
  r.label, benchOf(r.id) || r.benches.map(label).join(', '), r.ings.map(g => `${g.count} ${g.label.split('/').map(x => ({ metallic: 'metal', woody: 'wood', stony: 'stone' } as Record<string, string>)[x] || x).join('/')}`).join(' + '),
  r.special === 'butcher' ? 'meat, leather/fur' : r.product ? label(r.product) : (r.products || []).map(p => `${p.count} ${p.count === 1 && label(p.item).endsWith('components') ? label(p.item).slice(0, -1) : label(p.item)}`).join(', '),
  `${SKILLS.find(s => s.id === r.skill)?.label}${r.minSkill ? ` (${r.minSkill})` : ''}`, resLabel(r.research),
]));

// ======================================================================================
P('## Items', '');
const madeAt = (id: string) => { const r = Object.values(RECIPES).find(r => r.product === id || r.products?.some(p => p.item === id)); return r ? benchOf(r.id) : ''; };
P('### Resources & materials', '');
table(['Item', 'Stack', 'Value', 'Used as', 'Notes'], Object.values(ITEMS).filter(i => i.cat === 'resource' || i.cat === 'textile').map(i => [
  cap(i.label), i.stack, i.value, i.stuff ? `${i.stuff.cats.map(c => STUFF_WORD[c]).join('/')} material` : 'ingredient',
  i.stuff ? `HP ×${i.stuff.hpF}, build speed ×${(1 / i.stuff.workF).toFixed(2)}${i.stuff.beauty ? `, beauty +${i.stuff.beauty}` : ''}, flammability ${pct(i.stuff.flam)}${i.stuff.insCold ? `, insulation ${i.stuff.insCold} °C` : ''}` : (i.desc || ''),
]));
P('### Weapons', '');
P('Accuracy is listed at touch / short / medium / long range (≤3, ≤12, ≤25, ≤40 tiles) and is further modified by Shooting skill,',
  'weather, cover and quality.', '');
// mechanoid built-in weapons can't be obtained, so they're not listed
const mechWeapons = new Set(Object.values(ANIMALS).map(a => a.weapon).filter(Boolean));
const weapons = Object.values(ITEMS).filter(i => i.weapon && !i.noTrade && !mechWeapons.has(i.id));
table(['Weapon', 'Damage', 'Armor pen.', 'Range', 'Burst', 'Aim / cooldown', 'Accuracy', 'Source'], weapons.map(i => {
  const wp = i.weapon!;
  return [cap(i.label), `${wp.damage} ${wp.dmgType}${wp.explosive ? ` (explodes r${wp.explosive.radius})` : ''}`, pct(wp.pen), wp.melee ? 'melee' : wp.range!, wp.burst ? `${wp.burst} shots` : '1',
    wp.melee ? `— / ${secs(wp.cooldown)}` : `${secs(wp.warmup || 0)} / ${secs(wp.cooldown)}`, wp.acc ? wp.acc.map(a => pct(a)).join(' / ') : '—',
    [madeAt(i.id), i.research ? resLabel(i.research) : ''].filter(Boolean).join('; ') || 'traders, raiders'];
}));
P('### Apparel', '');
P('Layers (skin, middle, outer, head) stack; each piece covers body groups with sharp/blunt/heat armor and cold/heat insulation.',
  'Colonists put on clothes when cold or missing coverage. Attacks and fire damage apparel; tattered pieces (under half HP) give a',
  'mood penalty and colonists swap them for better ones.', '');
table(['Apparel', 'Layers', 'Covers', 'Armor sharp / blunt / heat', 'Insulation cold / heat', 'Source'], Object.values(ITEMS).filter(i => i.apparel).map(i => {
  const a = i.apparel!;
  return [cap(i.label), a.layers.join(', '), a.cover.join(', '), `${pct(a.armorSharp)} / ${pct(a.armorBlunt)} / ${pct(a.armorHeat)}`, `${a.insCold} / ${a.insHeat} °C`,
    [madeAt(i.id), i.research ? resLabel(i.research) : ''].filter(Boolean).join('; ') || 'traders'];
}));
P('### Medicine & misc', '');
table(['Item', 'Potency', 'Source'], Object.values(ITEMS).filter(i => i.med).map(i => [cap(i.label), pct(i.med!.potency), madeAt(i.id) || (i.id === 'medicine_herbal' ? 'healroot plants' : 'traders')]));

// ======================================================================================
P('## Research tree', '');
P(`${Object.keys(RESEARCH).length} projects in ${BRANCHES.length} branches across ${ERAS.length} eras. Build a research bench, open the Research tab and pick a`,
  'project; colonists with Research work study it (Intellectual skill, research-speed bonuses and multi-analyzers help).',
  'Projects marked hi-tech need a hi-tech research bench.', '');
P('**The tree screen.** Columns are tiers grouped into era bands, rows are branch lanes. Drag to pan, pinch (or +/−, or',
  'the mouse wheel with Ctrl) to zoom, *Fit* to see everything. Each card shows the first thing the project unlocks, its cost,',
  'progress and queue position. Tap a card: its whole prerequisite chain lights up gold and everything it leads to lights up',
  'blue, and the panel below lists unlocks (with icons), colony bonuses, requirements and follow-ups. Branch chips filter the',
  'view; the search box finds projects by name or by what they unlock.', '');
P('**Queue.** *Research now* starts a project whose prerequisites are done. *Queue path* on a locked project queues every missing',
  'prerequisite in a valid order, so you can aim for Fusion power on day one and let the colony work through the chain.',
  'The current project and queue sit above the tree; tap × to drop one.', '');
P('**Colony bonuses** (★) are permanent passive effects from finished projects. They stack. Everything a project gives is also',
  'listed in the letter you get when it completes.', '');
{
  const tot: Record<string, number> = {};
  for (const r of Object.values(RESEARCH)) for (const [k, v] of Object.entries(r.effects || {})) tot[k] = (tot[k] || 0) + (v as number);
  table(['Bonus', 'From', 'All projects together'], Object.keys(EFFECT_INFO).filter(k => tot[k]).map(k => [
    cap(EFFECT_INFO[k].label), Object.values(RESEARCH).filter(r => r.effects?.[k]).map(r => r.label).join(', '), effectText(k, Math.round(tot[k] * 100) / 100),
  ]));
}
const unlocks = (rid: string) => [
  ...Object.values(BUILDINGS).filter(b => b.research === rid && !b.hidden).map(b => b.label),
  ...Object.values(RECIPES).filter(r => r.research === rid && !r.product && !r.products?.length).map(r => r.label.charAt(0).toLowerCase() + r.label.slice(1)),
  ...Object.values(ITEMS).filter(i => i.research === rid).map(i => i.label),
  ...Object.values(RECIPES).filter(r => r.research === rid).map(r => r.product || r.products?.[0]?.item).filter((x): x is string => !!x && ITEMS[x]?.research !== rid).map(label),
  ...TERRAIN.filter(t => t.research === rid).map(t => t.label),
  ...PLANTS.filter(p => p.research === rid).map(p => p.label),
];
for (const br of BRANCHES) {
  P(`### ${br.label}`, '');
  const list = Object.values(RESEARCH).filter(r => r.branch === br.id).sort((a, b) => a.tier - b.tier || a.col - b.col);
  table(['Project', 'Era', 'Cost', 'Requires', 'Unlocks', 'Colony bonus', 'Description'], list.map(r => [
    r.label + (r.hiTech ? ' (hi-tech)' : ''), ERAS[eraOf(r.tier)]?.label || '', r.cost, r.prereqs.map(resLabel).join(', ') || '—',
    [...new Set(unlocks(r.id))].join(', ') || '—', effectsOf(r.id).join(', ') || '—', r.desc,
  ]));
}
P('**New mechanics from the tree**, all simulated: beehives (honey never spoils), meat vats and deep drills that produce on',
  'their own while powered, moisture pumps that dry marsh into soil, fertilizer pumps (+50% growth nearby), terraformers',
  '(sand, gravel, marsh and bare stone into rich soil), grain silos (food spoils at half speed), tool cabinets (+6% bench',
  'speed each, two at most), sleep accelerators and vitals monitors beside beds, sterile floors (clean rooms cut infections;',
  'filthy rooms raise them), embrasures you can shoot through, blast doors, climate units that heat or cool, IED traps,',
  'firefoam poppers that smother fires and recharge, powered autocannon and uranium slug turrets, EMP grenades that wreck and',
  'stun machines but not people, shield belts that soak up bullets until drained, an orbital scanner that guides cargo down',
  'every few days, a weather controller that holds the sky clear, and the archotech monument (+10 mood nearby).', '');

// ======================================================================================
P('## AI minds (DeepSeek)', '');
P('Turn on **Menu → AI minds** and every colonist is played by a language model, DeepSeek (`deepseek-flash`, thinking',
  'mode off, JSON output). The Work tab stops being orders and becomes advice the colonists may follow.', '');
P('**What the model sees.** A compact briefing written from the colonist\'s point of view: who they are (backstory, traits',
  'with their meaning, skills and passions, work they refuse), the time, weather and where they are, needs and the feelings',
  'behind their mood, injuries, colony stores and research, danger on the map, everyone they know with what they are doing',
  'and mutual opinions, animals nearby, which kinds of work are actually waiting, their own memories, recent conversation,',
  'and what just happened to them (someone spoke to them, they got hurt, a letter arrived).', '');
P('**What it decides.** One JSON object per decision: an inner thought, an action, how long to keep at it, optional words to',
  'say out loud and an optional note to remember. The game turns that into ordinary jobs.', '');
table(['Action', 'What happens'], [
  ['work', 'does one kind of work (' + WORK_TYPES.filter(w => !w.hidden).map(w => w.id).join(', ') + ')'],
  ['eat / sleep / relax', 'finds food, a bed, or recreation'],
  ['talk', `walks over to someone and says the chosen line with a tone: ${TONES.join(', ')}. Tones have real effects: jokes can land or fall flat, comfort helps a sad friend, flirting can start a romance or get rebuffed, apologies erase grudges, insults can end in a fistfight`],
  ['tend / fight / flee', 'doctors someone, attacks a hostile, or runs'],
  ['go / idle', 'walks to a place (kitchen, fields, a person…) or stands and thinks'],
]);
P('**When it decides.** When the current plan runs out, when someone speaks to them, when they are hurt, when danger appears,',
  `when important news arrives, and at least every few hours. Routine decisions are at least ${Math.round(MIN_GAP / 2500 * 60)} game-minutes apart. While the`,
  'model is thinking (a little thought cloud over their head) the colonist keeps doing their previous plan.', '');
P('**What it can\'t override.** The body: colonists still collapse from exhaustion, eat when starving, flee a raider who gets',
  'too close, have mental breaks, and obey your draft orders. Drafted colonists are yours.', '');
P('**Watching it.** Speech bubbles over heads; the inspector\'s Mind tab (current thought, plan, memories, recent lines,',
  'events they haven\'t reacted to yet); Colony → Voices, a log of everything said and thought.', '');
P('**Where the model runs.**', '');
table(['Option', 'How'], [
  ['This server\'s key', 'The deployment calls DeepSeek with its own key through `/api/llm` (a Vercel Edge Function, the Vite dev server, or `server/relay.mjs`). Set `DEEPSEEK_API_KEY`; optionally `LLM_PASSWORD` so only your friends can use it'],
  ['My own DeepSeek key', 'Paste a key from platform.deepseek.com in the AI minds window. It stays in that browser and goes only to the proxy (or straight to DeepSeek)'],
  ['Offline mind', 'A small rule-based personality, no network, free. Also takes over automatically if the key is missing or rejected'],
]);
P('**Cost.** Prompts are ordered so DeepSeek\'s prefix cache can reuse them (shared rules, then the colonist\'s persona, then',
  `the changing part), replies are capped short, and thinking mode is off. At list prices ($${PRICE.miss}/M new input tokens, $${PRICE.hit}/M cached,`,
  `$${PRICE.out}/M output; half price off-peak) a decision costs roughly $0.0002–0.0004 and a colonist makes about 40 decisions per game day:`,
  'under a cent per colonist per game day. The AI minds window shows tokens and money spent live, lets you cap decisions per',
  'minute, and stops at a per-session budget (default $1). In multiplayer every player\'s own device runs (and pays for) their colony\'s minds.', '');

// ======================================================================================
P('## Combat & defense', '');
P('**Drafting:** drafted colonists stop working and take orders: tap the ground to move (a group spreads out), tap an enemy to',
  'attack. With *fire at will* on (default) they shoot any enemy in range. Undrafted colonists flee from nearby enemies and fight',
  'back in melee when cornered.', '');
P('**Shooting:** hit chance depends on distance band, Shooting skill, the weapon\'s accuracy, weather and the target\'s',
  'cover (walls, sandbags, barricades, trees, furniture). Shots can miss into other things. Aim time (warmup), bursts and',
  'cooldowns follow the weapon. Careful shooters aim longer and hit more; trigger-happy ones fire faster and miss more.', '');
P('**Damage & armor:** armor can deflect or reduce damage based on the weapon\'s armor penetration. Melee attacks can be dodged',
  '(Nimble helps). Explosions from grenades, destroyed turrets, boomalopes and short circuits damage everything nearby and can',
  'start fires.', '');
P('**Raids:** raiders gather at the edge of your colony, then assault. They bash through walls and doors when they have to,',
  'and may carry off downed colonists as they leave. They **flee after losing half their group** (or after about a day).',
  'Raid size grows with colony wealth, colonist count, time played and difficulty. Later raids can arrive by **drop pod** right',
  'inside your base (after day 18), and after day 12 some raids are **mechanoids**: scythers (melee blades), lancers (charge',
  'lances) and centipedes (heavy blasters). Mechanoids never flee early and leave after about three days.', '');
P('**Defenses:** mini-turrets (auto-fire; explode when destroyed), spike traps (hidden, single use), sandbags and barricades',
  '(cover), walls and doors. Manhunting animals cannot open doors, so staying indoors works against them.', '');
P('**After a fight:** rescue downed colonists (long-press → Rescue), tend wounds, and **capture** downed enemies as prisoners.',
  'Prisoners live in a room with a prison bed and eat food left there; wardens visit to recruit them (Social skill vs. the',
  'prisoner\'s resistance). Each prisoner can be set to recruit, hold or release.',
  'Corpses cause mood penalties: bury them in graves or dump them.', '');

// ======================================================================================
P('## Animals', '');
P('Wild animals graze, sleep, wander in herds, flee from danger and repopulate over time. Predators hunt other animals when hungry',
  '(and rarely, desperately, people) and eat their kills. Hurting an animal may make it **fight back or go manhunter** (see',
  'chance below); fights between wild animals stay between them. Colonists can **hunt** (meat, leather/fur), **tame** (Animals',
  'skill vs. wildness; tamed animals join the colony), **milk**, **shear** and **slaughter** them. Some animals self-tame and',
  'join on their own. Mechanoids appear only in raids.', '');
table(['Animal', 'Size', 'HP', 'Speed', 'Diet', 'Attacks', 'Wildness', 'Revenge chance', 'Products', 'Notes'], Object.values(ANIMALS).map(a => [
  cap(a.label), a.size, a.hp, a.speed, a.mech ? '—' : a.diet, a.attacks.map(x => `${x.label} ${x.damage}`).join(', ') + (a.weapon ? `, ${label(a.weapon)}` : ''),
  a.mech ? '—' : pct(a.wildness), a.mech || a.domestic ? '—' : pct(a.manhunterChance ?? 0.1),
  [a.meat ? `${a.meat} meat` : '', a.leather && a.leatherCount ? `${a.leatherCount} ${label(a.leather)}` : '', ...(a.products || []).map(p => `${p.count} ${label(p.item)} every ${p.days}d`)].filter(Boolean).join(', ') || '—',
  [a.mech ? 'mechanoid' : '', a.predator ? 'predator' : '', a.herd ? `herds of ${a.herd[0]}–${a.herd[1]}` : '', a.domestic ? 'domestic' : '', a.pack ? 'pack animal' : '', a.explodes ? 'explodes when killed' : '',
    a.flees ? 'flees' : '', a.rare ? 'rare' : '', a.nuzzles ? 'pet' : '', a.armorSharp ? `armor ${pct(a.armorSharp)}` : ''].filter(Boolean).join(', ') || '—',
]));

// ======================================================================================
P('## Events & storytellers', '');
P('The storyteller schedules **big threats** every few days (raid or manhunter pack), **smaller trouble** in between, and',
  '**good events** every 1.5–3 days. Threat size ("points") grows with your wealth, colonist count, days survived and difficulty.',
  'Peaceful difficulty turns raids and manhunters off.', '');
table(['Event', 'Kind', 'What happens', 'What to do'], [
  ['Raid', 'threat', 'Pirates arrive at the edge (or by drop pod later) and assault', 'Draft all, fight from cover; they flee at half losses'],
  ['Mechanoid raid (day 12+)', 'threat', 'Armored machines attack; they don\'t flee early', 'Focus fire, use cover and turrets'],
  ['Manhunter pack', 'threat', 'Maddened animals (priced by how dangerous they are) attack anyone they see for 1–2 days', 'Stay indoors; they can\'t open doors'],
  ['Mad animal', 'bad', 'One nearby animal goes manhunter for a day', 'Shoot it or avoid it'],
  ['Small raid (day 6+)', 'bad', 'A smaller band of raiders', 'As for raids'],
  ['Disease', 'bad', 'Flu, plague or malaria strikes one or two colonists', 'Bed rest and a doctor'],
  ['Crop blight', 'bad', 'Destroys part of your fields', 'Replant'],
  ['Short circuit', 'bad', 'A battery discharges in an explosion and starts a fire', 'Firefight; keep batteries under roof'],
  ['Psychic drone / soothe', 'bad / good', 'Colony-wide mood −15 / +12 for a day', '—'],
  ['Solar flare, eclipse, cold snap, heat wave, toxic fallout, aurora', 'world', 'See [Time, seasons & weather](#time-seasons--weather)', '—'],
  ['Trade caravan', 'good', 'Traders walk in and stay about a day', 'Tap the trader to trade'],
  ['Orbital trader', 'good', 'A trade ship in range for about a day', 'Trade from a powered comms console; goods arrive by drop pod'],
  ['Visitors', 'neutral', 'A friendly group passes through', 'Attacking them turns them hostile'],
  ['Wanderer joins', 'good', 'A new colonist joins', '—'],
  ['Transport pod crash', 'neutral', 'An injured person crashes nearby', 'Rescue (they may join) or capture'],
  ['Cargo pods', 'good', 'Supplies land nearby (steel, wood, silver, components, meals, medicine…)', 'Haul them in'],
  ['Herd migration', 'neutral', 'A herd passes through', 'Hunting opportunity'],
  ['Animal self-tamed', 'good', 'An animal joins your colony', '—'],
  ['Meteorite', 'good', 'An ore-filled rock crashes nearby', 'Mine it'],
  ['Ship chunk', 'good', 'Spaceship wreckage lands', 'Deconstruct for steel and components'],
  ['Thrumbo passes', 'neutral', 'A rare, powerful, peaceful beast', 'Leave it alone, or hunt it with everything you have'],
]);

// ======================================================================================
P('## Trading, visitors & factions', '');
P('Silver is the currency. Traders (bulk goods, combat supplier, exotic goods…) carry silver, materials, food, medicine, weapons',
  'and apparel with random quality; orbital traders also stock plasteel, uranium, advanced components, glitterworld medicine,',
  'charge rifles and marine armor. In the trade window you balance what you give and take.', '');
P('Non-player factions: **pirates** (raiders), **mechanoids**, and friendly **outlanders** and **tribes** (visitors and traders).',
  'Goodwill drops if you attack them. See the Colony tab → Factions.', '');

// ======================================================================================
P('## Endgame: build a ship', '');
P('The win condition. Research Starflight basics, Cryptosleep and Starship drive (on a hi-tech research bench), then build:', '');
table(['Ship part', 'Cost', 'Research'], Object.values(BUILDINGS).filter(b => b.ship).map(b => [cap(b.label), costText(b.cost, b.stuffCats, b.stuffCount), resLabel(b.research)]));
P('You need at least an engine, a computer core and one cryptosleep casket, plus the reactor. Starting the reactor begins a',
  '**3-day countdown** during which raids hit every 8 hours or so. When it finishes, the ship launches with your colonists and you',
  'win. In multiplayer, other players are told a rival ship is launching.', '');

// ======================================================================================
P('## Multiplayer', '');
P(`Up to ${MAX_PLAYERS} players each run their own colony on one shared map, playing at the same time.`, '');
table(['Feature', 'How it works'], [
  ['Hosting', 'Host multiplayer → set up your colony. A 5-letter room code appears; Menu shows it with a Copy invite link button'],
  ['Joining', 'Join multiplayer, or open an invite link; pick your crew and a landing spot away from other colonies'],
  ['Simulation', 'The host\'s device runs the world; everyone else sees it live. If the host leaves or switches apps, the world pauses and others see "waiting for host"'],
  ['Speed', 'The world runs at the slowest speed any player picked, so anyone can pause. The top bar shows who is holding it down'],
  ['Territory', 'Each colony has its own home area, zones and stockpiles. You can\'t take another colony\'s stored items unless you are at war'],
  ['Shared world', 'Weather, seasons, wildlife and world conditions (eclipses, fallout, cold snaps…) are shared; raids, traders, visitors and other storyteller events are rolled per colony'],
  ['Diplomacy', 'Colony tab → Diplomacy: offer peace or an alliance (the other player accepts), end an alliance, or declare war (if PvP is allowed). At war, colonists can attack each other and raid stockpiles'],
  ['Player trading', 'Send another colony a trade offer (what you give / what you want, with a note); if accepted, goods arrive by drop pod'],
  ['Chat', 'In-game chat between players'],
  ['Reconnecting', 'A dropped player gets a Reconnect button; rejoining from the same browser reclaims their colony. Re-hosting a save reuses its room code'],
  ['Connection', 'Direct peer-to-peer (WebRTC); optional TURN server or WebSocket relay for strict networks (see README)'],
]);

// ======================================================================================
P('## Saving', '');
P('The host autosaves every in-game day and whenever the app is hidden. Menu → Save game makes a manual save; the title screen',
  'offers *Continue* and *Load game*. *Export save file* downloads a `.sfsave` file you can import on another device.',
  'Multiplayer saves include every colony; loading one lets you host it again for your friends.', '');

// ======================================================================================
P('## Art, sound & presentation', '');
P('- All in-game art is pixel art generated in code at startup: terrain with blended edges, cliffs and shadows, plants that grow',
  '  through visible stages, buildings that link together (walls, sandbags), items, animals, mechanoids and interface icons.',
  '- Colonists are layered 20×28 paper dolls: face with eyes, brows and mouth, 10 hairstyles, beards, freckles and age lines,',
  '  each clothing layer drawn separately (shirts, trousers, jackets, vests, dusters, parkas, plate, powered armor, shield belts)',
  '  and a four-frame walk in front, side and back views. Portraits are a separate 32×32 bust whose expression follows mood',
  '  (happy, neutral, sad with a tear, angry, hurt).',
  '- Day/night lighting with warm fire and lamp glows, per-room darkness, rain, snow, fog and lightning overlays, particles',
  '  (muzzle flashes, blood, sparks, smoke, dust), floating text and screen shake for explosions.',
  '- Sound effects and music are synthesized live. The music drifts through calm frontier progressions and switches to a tense',
  '  pulse while raiders or manhunters threaten your colony.',
  '- Home-screen install (PWA) for full-screen play on iPad and iPhone; adapts to notches and safe areas; works in landscape too.', '');

// ======================================================================================
P('## Known gaps', '');
P('Things that exist in the game\'s text or data but are not (fully) simulated yet:', '');
for (const [id, gap] of Object.entries(TRAIT_GAPS)) if (gap) P(`- **${TRAITS[id].label}** trait: ${gap}`);
P(`- Thoughts defined but never triggered: ${[...UNUSED_THOUGHTS].map(id => THOUGHTS[id].label).join(', ')}.`,
  '- Only one inspiration type (work frenzy). A "creativity" inspiration is checked for quality rolls but never granted.',
  '- Hospital beds on their own don\'t speed healing (a vitals monitor beside a bed does, and resting in any bed does).',
  '- AI minds choose kinds of work, not specific targets: the job system still picks which plant to sow or which item to haul.',
  '- No world map, caravans travelling off-map, prosthetics or surgery.', '');

writeFileSync('FEATURES.md', out.join('\n'));
console.log(`FEATURES.md written: ${out.length} lines`);
