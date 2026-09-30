import type { RecipeDef } from './types';

export const RECIPES: Record<string, RecipeDef> = {};
function r(d: RecipeDef) { RECIPES[d.id] = d; }
const RAW_VEG = ['rice', 'potato', 'corn', 'berries', 'strawberry', 'honey'];
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
r({ id: 'make_bow_recurve', label: 'Make recurve bow', benches: ['crafting_spot', 'smithy', 'smithy_electric'], ings: [{ items: ['wood'], count: 40, label: 'wood' }], products: [{ item: 'bow_recurve', count: 1 }], work: 2400, skill: 'crafting', workType: 'craft', research: 'archery' });
r({ id: 'make_bow_great', label: 'Make great bow', benches: ['crafting_spot', 'smithy', 'smithy_electric'], ings: [{ items: ['wood'], count: 70, label: 'wood' }], products: [{ item: 'bow_great', count: 1 }], work: 3800, skill: 'crafting', workType: 'craft', research: 'great_bows', minSkill: 4 });
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
r({ id: 'make_plate_armor', label: 'Make plate armor', benches: ['smithy', 'smithy_electric'], ings: [{ cats: ['metallic'], count: 150, label: 'metal' }], special: 'stuffed', product: 'armor_plate', stuffCats: ['metallic'], stuffCount: 150, work: 9000, skill: 'crafting', workType: 'smith', research: 'plate_armor', minSkill: 4 });
r({ id: 'smelt_weapons', label: 'Smelt metal weapons & apparel', benches: ['electric_smelter'], ings: [{ smelt: true, count: 1, label: 'metal weapon/apparel' }], special: 'smelt', work: 800, skill: 'crafting', workType: 'smith' });
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
mach('heavy_smg', 'Make heavy SMG', { steel: 60, components: 4 }, 5000, 'heavy_weapons', 4);
mach('minigun', 'Make minigun', { steel: 150, components: 10 }, 9000, 'heavy_weapons', 6);
mach('rocket_launcher', 'Make rocket launcher', { steel: 80, chemfuel: 40, components: 6 }, 7000, 'heavy_weapons', 5);
mach('grenades_emp', 'Make EMP grenades', { steel: 60, components: 4 }, 3500, 'emp_tech', 4);
mach('helmet_flak', 'Make flak helmet', { steel: 40, components: 1 }, 3000, 'flak_armor', 3);
mach('molotov', 'Make molotov cocktails', { chemfuel: 30, cloth: 5 }, 1500, 'incendiaries');
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

const fab = (id: string, label: string, cost: Record<string, number>, work: number, research?: string, minSkill = 0, workType: 'smith' | 'tailor' | 'craft' = 'smith') =>
  r({ id: 'make_' + id, label, benches: ['fabrication_bench'], ings: Object.entries(cost).map(([k, v]) => ({ items: [k], count: v, label: k.replace('_', ' ') })), products: [{ item: id, count: 1 }], work, skill: 'crafting', workType, research, minSkill });
fab('charge_lance', 'Make charge lance', { plasteel: 60, components: 3, adv_components: 1 }, 9000, 'charged_shot', 7);
fab('rifle_pulse', 'Make pulse rifle', { plasteel: 70, uranium: 10, adv_components: 3 }, 12000, 'pulse_weapons', 9);
fab('monosword', 'Make monosword', { plasteel: 50, adv_components: 2 }, 10000, 'monomolecular_blades', 9);
fab('shield_belt', 'Make shield belt', { steel: 20, plasteel: 30, adv_components: 1 }, 6000, 'personal_shields', 6, 'tailor');
fab('armor_recon', 'Make recon armor', { plasteel: 80, uranium: 10, adv_components: 3 }, 10000, 'recon_armor', 7, 'tailor');
fab('helmet_recon', 'Make recon helmet', { plasteel: 30, adv_components: 1 }, 5000, 'recon_armor', 7, 'tailor');
fab('armor_cataphract', 'Make cataphract armor', { plasteel: 160, uranium: 30, adv_components: 6 }, 16000, 'cataphract_armor', 9, 'tailor');
fab('helmet_cataphract', 'Make cataphract helmet', { plasteel: 55, adv_components: 2 }, 7000, 'cataphract_armor', 9, 'tailor');
r({ id: 'make_plasteel', label: 'Synthesize plasteel', benches: ['fabrication_bench', 'nano_assembler'], ings: [{ items: ['steel'], count: 40, label: 'steel' }, { items: ['chemfuel'], count: 10, label: 'chemfuel' }], products: [{ item: 'plasteel', count: 10 }], work: 3000, skill: 'crafting', workType: 'craft', research: 'advanced_fabrication', minSkill: 6 });
r({ id: 'make_adv_components_nano', label: 'Nano-assemble advanced component', benches: ['nano_assembler'], ings: [{ items: ['components'], count: 3, label: 'components' }, { items: ['steel'], count: 20, label: 'steel' }, { items: ['gold'], count: 1, label: 'gold' }], products: [{ item: 'adv_components', count: 1 }], work: 2500, skill: 'crafting', workType: 'craft', minSkill: 6 });
r({ id: 'make_components_basic', label: 'Assemble component', benches: ['component_assembler'], ings: [{ items: ['steel'], count: 16, label: 'steel' }], products: [{ item: 'components', count: 1 }], work: 3000, skill: 'crafting', workType: 'craft', minSkill: 3 });

// Refinery & paste
r({ id: 'make_chemfuel', label: 'Refine chemfuel from wood', benches: ['refinery'], ings: [{ items: ['wood'], count: 70, label: 'wood' }], products: [{ item: 'chemfuel', count: 35 }], work: 2500, skill: 'crafting', workType: 'craft' });
r({ id: 'make_chemfuel_food', label: 'Refine chemfuel from food', benches: ['refinery'], ings: [{ items: RAW_ANY, count: 45, label: 'raw food' }], products: [{ item: 'chemfuel', count: 35 }], work: 2500, skill: 'crafting', workType: 'craft' });
r({ id: 'make_paste', label: 'Dispense nutrient paste', benches: ['paste_dispenser'], ings: [{ items: RAW_ANY, count: 6, label: 'raw food' }], products: [{ item: 'meal_paste', count: 1 }], work: 90, skill: 'cooking', workType: 'cook' });

// Drug lab
r({ id: 'make_medicine', label: 'Make medicine', benches: ['drug_lab'], ings: [{ items: ['medicine_herbal'], count: 1, label: 'herbal medicine' }, { items: ['cloth'], count: 3, label: 'cloth' }, { items: ['steel'], count: 1, label: 'steel' }], products: [{ item: 'medicine', count: 1 }], work: 1400, skill: 'intellectual', workType: 'craft', research: 'medicine_production', minSkill: 4 });
r({ id: 'make_medicine_glitter', label: 'Make glitterworld medicine', benches: ['drug_lab'], ings: [{ items: ['medicine'], count: 2, label: 'medicine' }, { items: ['plasteel'], count: 5, label: 'plasteel' }, { items: ['adv_components'], count: 1, label: 'adv. component' }], products: [{ item: 'medicine_glitter', count: 1 }], work: 4000, skill: 'intellectual', workType: 'craft', research: 'ultratech_medicine', minSkill: 8 });
r({ id: 'brew_beer', label: 'Brew beer', benches: ['drug_lab'], ings: [{ items: ['rice', 'corn', 'potato', 'hay'], count: 25, label: 'grain/hay' }], products: [{ item: 'beer', count: 5 }], work: 1500, skill: 'cooking', workType: 'cook', research: 'brewing' });

// recipes for research-locked items (jackets, flak vests...) need that research too
import { ITEMS } from './items';
for (const r of Object.values(RECIPES)) {
  const prod = r.product || r.products?.[0]?.item;
  if (!r.research && prod && ITEMS[prod]?.research) r.research = ITEMS[prod].research;
}
export { RESEARCH } from './research';
