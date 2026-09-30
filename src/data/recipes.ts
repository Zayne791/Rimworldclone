import type { RecipeDef, ResearchDef } from './types';

export const RECIPES: Record<string, RecipeDef> = {};
function r(d: RecipeDef) { RECIPES[d.id] = d; }
const RAW_VEG = ['rice', 'potato', 'corn', 'berries', 'strawberry'];
const RAW_MEAT = ['meat', 'eggs', 'milk'];
const RAW_ANY = [...RAW_VEG, ...RAW_MEAT];

// Cooking
r({ id: 'cook_simple', label: 'Cook simple meal', benches: ['campfire', 'stove_fueled', 'stove_electric'], ings: [{ items: RAW_ANY, count: 10, label: 'raw food' }], products: [{ item: 'meal_simple', count: 1 }], work: 300, skill: 'cooking', workType: 'cook' });
r({ id: 'cook_fine', label: 'Cook fine meal', benches: ['stove_fueled', 'stove_electric'], ings: [{ items: RAW_MEAT, count: 5, label: 'meat/eggs' }, { items: RAW_VEG, count: 5, label: 'vegetables' }], products: [{ item: 'meal_fine', count: 1 }], work: 450, skill: 'cooking', minSkill: 6, workType: 'cook' });
r({ id: 'cook_lavish', label: 'Cook lavish meal', benches: ['stove_fueled', 'stove_electric'], ings: [{ items: RAW_MEAT, count: 10, label: 'meat/eggs' }, { items: RAW_VEG, count: 10, label: 'vegetables' }], products: [{ item: 'meal_lavish', count: 1 }], work: 600, skill: 'cooking', minSkill: 8, workType: 'cook' });
r({ id: 'make_pemmican', label: 'Make pemmican', benches: ['campfire', 'stove_fueled', 'stove_electric'], ings: [{ items: RAW_MEAT, count: 5, label: 'meat' }, { items: RAW_VEG, count: 5, label: 'vegetables' }], products: [{ item: 'pemmican', count: 16 }], work: 700, skill: 'cooking', workType: 'cook' });
r({ id: 'butcher', label: 'Butcher creature', benches: ['butcher_spot', 'butcher_table'], ings: [{ items: ['corpse'], count: 1, label: 'corpse' }], special: 'butcher', work: 450, skill: 'cooking', workType: 'cook' });

// Crafting spot / tailoring
const tailored: [string, string, number, number][] = [
  ['tshirt', 'Make t-shirt', 40, 1600], ['shirt', 'Make button-down shirt', 45, 1800], ['pants', 'Make pants', 40, 1600],
  ['jacket', 'Make jacket', 70, 2600], ['duster', 'Make duster', 80, 3000], ['parka', 'Make parka', 80, 3000],
  ['tribalwear', 'Make tribalwear', 60, 1800], ['cowboy_hat', 'Make cowboy hat', 25, 1000], ['tuque', 'Make tuque', 25, 800],
];
for (const [id, label, count, work] of tailored) {
  r({ id: 'make_' + id, label, benches: ['tailor_bench', 'crafting_spot'], ings: [{ cats: ['fabric', 'leathery'], count, label: 'fabric/leather' }], special: 'stuffed', product: id, stuffCats: ['fabric', 'leathery'], stuffCount: count, work, skill: 'crafting', workType: 'tailor' });
}
r({ id: 'make_bow', label: 'Make short bow', benches: ['crafting_spot'], ings: [{ items: ['wood'], count: 30, label: 'wood' }], products: [{ item: 'bow_short', count: 1 }], work: 1600, skill: 'crafting', workType: 'craft' });
const smithed: [string, string, number, number, string[]][] = [
  ['knife', 'Make knife', 25, 900, ['metallic', 'woody']], ['club', 'Make club', 50, 700, ['woody', 'metallic', 'stony']],
  ['spear', 'Make spear', 50, 1500, ['metallic', 'woody']], ['longsword', 'Make longsword', 100, 3000, ['metallic']],
  ['mace', 'Make mace', 75, 2400, ['metallic']],
];
for (const [id, label, count, work, cats] of smithed) {
  r({ id: 'make_' + id, label, benches: ['smithy', 'crafting_spot'], ings: [{ cats, count, label: cats.join('/') }], special: 'stuffed', product: id, stuffCats: cats as any, stuffCount: count, work, skill: 'crafting', workType: 'smith' });
}
r({ id: 'make_helmet', label: 'Make simple helmet', benches: ['smithy'], ings: [{ cats: ['metallic'], count: 40, label: 'metal' }], special: 'stuffed', product: 'helmet_simple', stuffCats: ['metallic'], stuffCount: 40, work: 2000, skill: 'crafting', workType: 'smith', research: 'smithing' });
r({ id: 'smelt_slag', label: 'Smelt slag', benches: ['smithy'], ings: [{ items: ['chunk_slag'], count: 1, label: 'slag chunk' }], products: [{ item: 'steel', count: 15 }], work: 400, skill: 'crafting', workType: 'smith' });

// Machining
const mach = (id: string, label: string, cost: Record<string, number>, work: number, research?: string, minSkill = 0) =>
  r({ id: 'make_' + id, label, benches: ['machining_table'], ings: Object.entries(cost).map(([k, v]) => ({ items: [k], count: v, label: k })), products: [{ item: id, count: 1 }], work, skill: 'crafting', workType: 'smith', research, minSkill });
mach('revolver', 'Make revolver', { steel: 30, components: 2 }, 3000, 'gunsmithing');
mach('autopistol', 'Make autopistol', { steel: 30, components: 3 }, 3500, 'gunsmithing');
mach('rifle_bolt', 'Make bolt-action rifle', { steel: 60, wood: 10, components: 3 }, 4200, 'gunsmithing');
mach('shotgun', 'Make pump shotgun', { steel: 70, components: 3 }, 4500, 'gunsmithing');
mach('rifle_assault', 'Make assault rifle', { steel: 60, components: 7 }, 6000, 'gas_operation', 4);
mach('rifle_sniper', 'Make sniper rifle', { steel: 75, components: 4 }, 6500, 'precision_rifling', 5);
mach('lmg', 'Make LMG', { steel: 90, components: 6 }, 6500, 'gas_operation', 4);
mach('flak_vest', 'Make flak vest', { steel: 60, cloth: 30, components: 1 }, 5000, 'flak_armor', 3);
mach('grenades_frag', 'Make frag grenades', { steel: 60, components: 3 }, 3500, 'gunsmithing');
RECIPES.make_grenades = { ...RECIPES.make_grenades_frag, id: 'make_grenades' };
delete RECIPES.make_grenades_frag;

// Stonecutting
for (const s of ['granite', 'limestone', 'marble', 'sandstone', 'slate']) {
  r({ id: 'blocks_' + s, label: `Cut ${s} blocks`, benches: ['stonecutter'], ings: [{ items: ['chunk_' + s], count: 1, label: s + ' chunk' }], products: [{ item: 'blocks_' + s, count: 20 }], work: 1000, skill: 'crafting', workType: 'craft' });
}

// Fabrication
r({ id: 'make_components', label: 'Make components', benches: ['fabrication_bench'], ings: [{ items: ['steel'], count: 12, label: 'steel' }], products: [{ item: 'components', count: 1 }], work: 2000, skill: 'crafting', workType: 'craft', minSkill: 4 });
r({ id: 'make_adv_components', label: 'Make advanced component', benches: ['fabrication_bench'], ings: [{ items: ['components'], count: 2, label: 'components' }, { items: ['plasteel'], count: 10, label: 'plasteel' }, { items: ['gold'], count: 3, label: 'gold' }], products: [{ item: 'adv_components', count: 1 }], work: 4000, skill: 'crafting', workType: 'craft', minSkill: 8 });
r({ id: 'make_rifle_charge', label: 'Make charge rifle', benches: ['fabrication_bench'], ings: [{ items: ['plasteel'], count: 50, label: 'plasteel' }, { items: ['components'], count: 2, label: 'components' }, { items: ['adv_components'], count: 1, label: 'adv. component' }], products: [{ item: 'rifle_charge', count: 1 }], work: 8000, skill: 'crafting', workType: 'smith', research: 'charged_shot', minSkill: 7 });
r({ id: 'make_armor_marine', label: 'Make marine armor', benches: ['fabrication_bench'], ings: [{ items: ['plasteel'], count: 100, label: 'plasteel' }, { items: ['uranium'], count: 20, label: 'uranium' }, { items: ['adv_components'], count: 4, label: 'adv. components' }], products: [{ item: 'armor_marine', count: 1 }], work: 12000, skill: 'crafting', workType: 'tailor', research: 'powered_armor', minSkill: 8 });
r({ id: 'make_helmet_marine', label: 'Make marine helmet', benches: ['fabrication_bench'], ings: [{ items: ['plasteel'], count: 40, label: 'plasteel' }, { items: ['adv_components'], count: 1, label: 'adv. component' }], products: [{ item: 'helmet_marine', count: 1 }], work: 6000, skill: 'crafting', workType: 'tailor', research: 'powered_armor', minSkill: 8 });

// Drug lab
r({ id: 'make_medicine', label: 'Make medicine', benches: ['drug_lab'], ings: [{ items: ['medicine_herbal'], count: 1, label: 'herbal medicine' }, { items: ['cloth'], count: 3, label: 'cloth' }, { items: ['steel'], count: 1, label: 'steel' }], products: [{ item: 'medicine', count: 1 }], work: 1400, skill: 'intellectual', workType: 'craft', research: 'medicine_production', minSkill: 4 });
r({ id: 'brew_beer', label: 'Brew beer', benches: ['drug_lab'], ings: [{ items: ['rice', 'corn', 'potato', 'hay'], count: 25, label: 'grain/hay' }], products: [{ item: 'beer', count: 5 }], work: 1500, skill: 'cooking', workType: 'cook', research: 'brewing' });

export const RESEARCH: Record<string, ResearchDef> = {};
function rs(d: ResearchDef) { RESEARCH[d.id] = d; }
rs({ id: 'stonecutting', label: 'Stonecutting', desc: "Cut rock chunks into blocks at a stonecutter's table. Unlocks stone floors.", cost: 300, prereqs: [], tier: 0, col: 0 });
rs({ id: 'complex_furniture', label: 'Complex furniture', desc: 'Armchairs, dressers, end tables, billiards and carpets.', cost: 600, prereqs: [], tier: 0, col: 4 });
rs({ id: 'passive_cooler', label: 'Passive cooler', desc: 'A wood-burning evaporative cooler.', cost: 300, prereqs: [], tier: 1, col: 0 });
rs({ id: 'complex_clothing', label: 'Complex clothing', desc: 'Jackets, dusters, parkas and hats.', cost: 600, prereqs: [], tier: 0, col: 3 });
rs({ id: 'electricity', label: 'Electricity', desc: 'Power conduits, generators, lamps, heaters and electric stoves.', cost: 1600, prereqs: [], tier: 0, col: 2 });
rs({ id: 'smithing', label: 'Smithing', desc: 'Build a smithy to forge melee weapons and helmets.', cost: 700, prereqs: [], tier: 0, col: 1 });
rs({ id: 'brewing', label: 'Brewing', desc: 'Brew beer — a cheap source of recreation.', cost: 500, prereqs: [], tier: 0, col: 5 });
rs({ id: 'medicine_production', label: 'Medicine production', desc: 'Drug lab, industrial medicine, hospital beds and healroot farming.', cost: 800, prereqs: [], tier: 1, col: 5 });
rs({ id: 'batteries', label: 'Batteries', desc: 'Store power for the night.', cost: 400, prereqs: ['electricity'], tier: 1, col: 2 });
rs({ id: 'solar_panels', label: 'Solar panels', desc: 'Generate power from sunlight.', cost: 600, prereqs: ['electricity'], tier: 1, col: 3 });
rs({ id: 'air_conditioning', label: 'Air conditioning', desc: 'Coolers and vents. Build freezers to preserve food.', cost: 600, prereqs: ['electricity'], tier: 2, col: 4 });
rs({ id: 'hydroponics', label: 'Hydroponics', desc: 'Hydroponic basins and sun lamps for indoor farming.', cost: 700, prereqs: ['electricity'], tier: 2, col: 2 });
rs({ id: 'devilstrand', label: 'Devilstrand', desc: 'Grow tough devilstrand fabric in the dark.', cost: 800, prereqs: ['complex_clothing'], tier: 1, col: 4 });
rs({ id: 'machining', label: 'Machining', desc: 'A machining table to produce firearms and armor.', cost: 1000, prereqs: ['electricity'], tier: 1, col: 1 });
rs({ id: 'geothermal', label: 'Geothermal power', desc: 'Tap steam geysers for huge, constant power.', cost: 2400, prereqs: ['electricity'], tier: 2, col: 5 });
rs({ id: 'gunsmithing', label: 'Gunsmithing', desc: 'Revolvers, autopistols, rifles, shotguns and grenades.', cost: 500, prereqs: ['machining'], tier: 2, col: 1 });
rs({ id: 'flak_armor', label: 'Flak armor', desc: 'Protective flak vests.', cost: 1200, prereqs: ['machining', 'smithing'], tier: 2, col: 0 });
rs({ id: 'microelectronics', label: 'Microelectronics', desc: 'Comms console, hi-tech research bench, televisions.', cost: 2500, prereqs: ['electricity'], tier: 2, col: 3 });
rs({ id: 'gun_turrets', label: 'Gun turrets', desc: 'Automated mini-turrets.', cost: 1200, prereqs: ['gunsmithing'], tier: 3, col: 0 });
rs({ id: 'gas_operation', label: 'Gas operation', desc: 'Assault rifles and LMGs.', cost: 800, prereqs: ['gunsmithing'], tier: 3, col: 1 });
rs({ id: 'precision_rifling', label: 'Precision rifling', desc: 'Sniper rifles.', cost: 900, prereqs: ['gunsmithing'], tier: 3, col: 2 });
rs({ id: 'autodoors', label: 'Autodoors', desc: 'Powered doors that open instantly.', cost: 600, prereqs: ['microelectronics'], tier: 3, col: 4 });
rs({ id: 'sterile_materials', label: 'Sterile materials', desc: 'Sterile tile floors that reduce infections.', cost: 700, prereqs: ['microelectronics'], tier: 3, col: 5 });
rs({ id: 'fabrication', label: 'Fabrication', desc: 'Fabrication bench: make components and advanced components.', cost: 3000, prereqs: ['microelectronics', 'machining'], tier: 3, col: 3 });
rs({ id: 'charged_shot', label: 'Charged shot', desc: 'Charge rifles.', cost: 3500, prereqs: ['fabrication', 'gas_operation'], tier: 4, col: 1 });
rs({ id: 'powered_armor', label: 'Powered armor', desc: 'Marine armor and helmets.', cost: 4500, prereqs: ['fabrication', 'flak_armor'], tier: 4, col: 0 });
rs({ id: 'ship_basics', label: 'Starflight basics', desc: 'Ship structural beams and computer core.', cost: 4000, prereqs: ['fabrication'], tier: 4, col: 3, hiTech: true });
rs({ id: 'cryptosleep', label: 'Cryptosleep', desc: 'Cryptosleep caskets to carry your colonists.', cost: 2500, prereqs: ['ship_basics'], tier: 5, col: 4, hiTech: true });
rs({ id: 'ship_reactor', label: 'Starship drive', desc: 'Ship reactor and engines. Build a ship and escape this rimworld!', cost: 6000, prereqs: ['ship_basics'], tier: 5, col: 3, hiTech: true });
