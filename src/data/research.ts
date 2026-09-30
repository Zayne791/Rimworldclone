// The research tree: 128 projects in 8 branches across 6 eras.
// Unlocks (buildings, items, recipes, floors, plants) point back here through their `research` field;
// `effects` are passive colony-wide bonuses applied by sim/research.ts (see EFFECT_INFO for what each key does).
import type { ResearchDef } from './types';

export type Branch = 'agri' | 'ind' | 'build' | 'power' | 'med' | 'mil' | 'soc' | 'space';
export const BRANCHES: { id: Branch; label: string; color: string; icon: string }[] = [
  { id: 'agri', label: 'Agriculture', color: '#7fd67a', icon: 'grow' },
  { id: 'ind', label: 'Industry', color: '#e0a060', icon: 'work' },
  { id: 'build', label: 'Construction', color: '#c8b090', icon: 'build' },
  { id: 'power', label: 'Power', color: '#f0d050', icon: 'power' },
  { id: 'med', label: 'Medicine', color: '#ff8a8a', icon: 'medical' },
  { id: 'mil', label: 'Military', color: '#e06a5a', icon: 'hunt' },
  { id: 'soc', label: 'Society & science', color: '#8ab8ff', icon: 'research' },
  { id: 'space', label: 'Space & ultratech', color: '#c890ff', icon: 'ship' },
];
export const ERAS = [
  { label: 'Frontier', tiers: [0, 1], color: '#8a7a5a' },
  { label: 'Settlement', tiers: [2, 3], color: '#7a8a5a' },
  { label: 'Industrial', tiers: [4, 5], color: '#5a7a8a' },
  { label: 'Spacer', tiers: [6, 7], color: '#6a5a8a' },
  { label: 'Ultratech', tiers: [8, 9], color: '#8a5a7a' },
  { label: 'Archotech', tiers: [10, 11], color: '#9a7a3a' },
];
export const eraOf = (tier: number) => ERAS.findIndex(e => e.tiers.includes(tier));

/** effect keys: value is a fraction (+0.1 = +10%) unless noted */
export const EFFECT_INFO: Record<string, { label: string; fmt?: 'pct' | 'neg' | 'pts' | 'lvl' | 'deg' }> = {
  growthRate: { label: 'crop growth speed' }, harvestYield: { label: 'harvest yield' }, cropHardy: { label: 'crops survive colder nights', fmt: 'deg' },
  tameChance: { label: 'taming success' }, productYield: { label: 'milk, wool & eggs' }, animalYield: { label: 'meat & leather from butchering' },
  foodRot: { label: 'food spoilage', fmt: 'neg' }, cookSpeed: { label: 'cooking & butchering speed' }, craftSpeed: { label: 'crafting speed' },
  constructSpeed: { label: 'construction speed' }, mineSpeed: { label: 'mining speed' }, mineYield: { label: 'mining yield' },
  plantSpeed: { label: 'sowing, harvesting & chopping speed' }, researchSpeed: { label: 'research speed' }, cleanSpeed: { label: 'cleaning speed' },
  globalWork: { label: 'all work speed' }, craftQuality: { label: 'crafted & built quality', fmt: 'lvl' }, buildingHp: { label: 'building durability' },
  beautyBonus: { label: 'beauty from furniture & art' }, tendQuality: { label: 'tend quality' }, infectionReduce: { label: 'infection chance', fmt: 'neg' },
  immunity: { label: 'immunity gain' }, bleedReduce: { label: 'bleeding', fmt: 'neg' }, healRate: { label: 'wound healing speed' },
  painReduce: { label: 'pain', fmt: 'neg' }, medPotency: { label: 'medicine potency' }, restEff: { label: 'rest recovery' },
  mood: { label: 'mood', fmt: 'pts' }, breakResist: { label: 'mental break threshold', fmt: 'neg' }, joyGain: { label: 'recreation gain' },
  learnRate: { label: 'skill learning' }, shootAcc: { label: 'shooting accuracy' }, meleeDamage: { label: 'melee damage' }, meleeHit: { label: 'melee hit chance' },
  turretDamage: { label: 'turret damage' }, coverBonus: { label: 'cover effectiveness' }, moveSpeed: { label: 'walking speed' },
  powerGen: { label: 'power generation' }, batteryCap: { label: 'battery capacity' }, lightPower: { label: 'lighting power use', fmt: 'neg' },
  tradePrice: { label: 'trade prices in your favour' }, recruitChance: { label: 'prisoner recruitment' }, threatReduce: { label: 'raid size', fmt: 'neg' },
  goodEvents: { label: 'frequency of good events' }, poisonReduce: { label: 'food poisoning chance', fmt: 'neg' },
};

export const RESEARCH: Record<string, ResearchDef> = {};
let order = 0;
function rs(branch: Branch, tier: number, id: string, label: string, cost: number, prereqs: string[], desc: string, effects?: ResearchDef['effects'], hiTech = false) {
  RESEARCH[id] = { id, label, desc, cost, prereqs, tier, col: order++, branch, effects, hiTech };
}

// =============================== AGRICULTURE ===============================
rs('agri', 0, 'crop_rotation', 'Crop rotation', 300, [], 'Rotate fields to keep soil healthy. Crops grow faster.', { growthRate: 0.1 });
rs('agri', 0, 'animal_husbandry', 'Animal husbandry', 350, [], 'Understand animal behaviour: easier taming and more milk, wool and eggs.', { tameChance: 0.25, productYield: 0.2 });
rs('agri', 1, 'tilling', 'Soil tilling', 500, ['crop_rotation'], 'Turn and aerate the soil for bigger harvests.', { harvestYield: 0.1 });
rs('agri', 1, 'preservation', 'Food preservation', 500, [], 'Salting, smoking and pickling. Food spoils more slowly.', { foodRot: 0.3 });
rs('agri', 1, 'beekeeping', 'Beekeeping', 600, ['animal_husbandry'], 'Build beehives that fill with honey: food that never spoils and cooks like vegetables.');
rs('agri', 2, 'irrigation', 'Irrigation', 900, ['tilling'], 'Moisture pumps slowly drain marsh, mud and shallows into farmable soil.', { growthRate: 0.05 });
rs('agri', 2, 'granary', 'Granaries', 800, ['preservation'], 'Grain silos hold six stacks of raw food per cell.');
rs('agri', 2, 'devilstrand', 'Devilstrand', 800, ['complex_clothing'], 'Grow tough devilstrand fabric in the dark.');
rs('agri', 3, 'cuisine', 'Haute cuisine', 1300, ['preservation'], 'Professional kitchen technique: faster cooking and far fewer bad meals.', { cookSpeed: 0.25, poisonReduce: 0.6 });
rs('agri', 3, 'selective_breeding', 'Selective breeding', 1500, ['animal_husbandry', 'tilling'], 'Breed for size and yield: more meat, leather and animal products.', { animalYield: 0.3, productYield: 0.2 });
rs('agri', 3, 'hydroponics', 'Hydroponics', 700, ['electricity'], 'Hydroponic basins and sun lamps for indoor farming.');
rs('agri', 4, 'fertilizer', 'Fertilizers', 1800, ['irrigation', 'chemistry'], 'Fertilizer pumps enrich the soil around them: +50% growth in a wide radius.', { harvestYield: 0.1 });
rs('agri', 4, 'nutrient_paste', 'Nutrient paste', 1600, ['electricity', 'preservation'], 'A dispenser that turns raw food into nutrient paste instantly. Efficient, if joyless.');
rs('agri', 5, 'agronomy', 'Agronomy', 2800, ['fertilizer', 'hydroponics'], 'Scientific farming: faster sowing and harvesting, hardier crops.', { plantSpeed: 0.25, cropHardy: 6, growthRate: 0.1 });
rs('agri', 6, 'genetic_crops', 'Genetic crops', 3800, ['agronomy', 'genetics'], 'Engineered strains grow faster, yield more and shrug off frost.', { growthRate: 0.25, harvestYield: 0.2, cropHardy: 8 });
rs('agri', 7, 'vat_meat', 'Vat-grown meat', 4800, ['genetic_crops', 'bioengineering'], 'Meat vats grow cultured meat from nutrient broth using power alone.');
rs('agri', 8, 'terraforming', 'Terraforming', 7200, ['genetic_crops', 'fusion'], 'Terraformers rebuild the ground around them into rich soil.');

// =============================== INDUSTRY ===============================
rs('ind', 0, 'stonecutting', 'Stonecutting', 300, [], "Cut rock chunks into blocks at a stonecutter's table. Unlocks stone floors.");
rs('ind', 0, 'smithing', 'Smithing', 700, [], 'Build a smithy to forge melee weapons and helmets.');
rs('ind', 0, 'complex_clothing', 'Complex clothing', 600, [], 'Jackets, dusters, parkas and hats.');
rs('ind', 1, 'tool_making', 'Tool making', 500, ['smithing'], 'Tool cabinets speed up every workbench near them.', { craftSpeed: 0.05 });
rs('ind', 1, 'metallurgy', 'Metallurgy', 700, ['smithing'], 'Better alloys and heat treatment: better quality work and tougher buildings.', { craftQuality: 1, buildingHp: 0.1 });
rs('ind', 2, 'chemistry', 'Chemistry', 1000, ['metallurgy'], 'Refine wood into chemfuel at a biofuel refinery.');
rs('ind', 2, 'machining', 'Machining', 1000, ['electricity'], 'A machining table to produce firearms and armor.');
rs('ind', 3, 'electric_workshops', 'Electric workshops', 1400, ['machining'], 'Powered smithy, tailoring bench and smelter that work 50% faster.');
rs('ind', 3, 'component_assembly', 'Component assembly', 1600, ['machining'], 'A component assembler makes components from steel, long before fabrication.');
rs('ind', 4, 'mass_production', 'Mass production', 2400, ['electric_workshops'], 'Jigs, templates and assembly lines.', { craftSpeed: 0.25 });
rs('ind', 4, 'deep_drilling', 'Deep drilling', 2200, ['machining', 'geology'], 'Deep drills pull steel, silver and uranium from far below while powered.');
rs('ind', 5, 'fabrication', 'Fabrication', 3000, ['microelectronics', 'machining'], 'Fabrication bench: make components and advanced components.');
rs('ind', 6, 'advanced_fabrication', 'Advanced fabrication', 3600, ['fabrication'], 'Precision fabrication: better quality, faster, and plasteel synthesis from steel.', { craftQuality: 1, craftSpeed: 0.15 });
rs('ind', 7, 'automation', 'Automation', 5000, ['mass_production', 'ai_cores'], 'Robotic assistance on every task.', { globalWork: 0.1 });
rs('ind', 8, 'nanofabrication', 'Nanofabrication', 7000, ['advanced_fabrication', 'ai_cores'], 'A nano-assembler builds advanced components atom by atom.', { craftSpeed: 0.3, craftQuality: 1 }, true);

// =============================== CONSTRUCTION ===============================
rs('build', 0, 'masonry', 'Masonry', 300, [], 'Proper mortar and foundations: faster building, sturdier walls.', { constructSpeed: 0.1, buildingHp: 0.1 });
rs('build', 1, 'complex_furniture', 'Complex furniture', 600, [], 'Armchairs, dressers, end tables, billiards and carpets.');
rs('build', 1, 'barracks', 'Barracks planning', 500, ['masonry'], 'Bunk beds: two sleepers in one bed-sized footprint.');
rs('build', 2, 'fine_arts', 'Fine arts', 1000, ['complex_furniture'], 'Grand sculptures and fountains. Artists produce better work.', { beautyBonus: 0.1 });
rs('build', 2, 'fortification', 'Fortification', 900, ['masonry'], 'Embrasures (walls you can shoot through) and barricade-grade engineering.', { coverBonus: 0.1 });
rs('build', 2, 'passive_cooler', 'Passive cooler', 300, [], 'A wood-burning evaporative cooler.');
rs('build', 3, 'interior_design', 'Interior design', 1200, ['complex_furniture'], 'Couches, bookshelves and new carpets. Everything looks better.', { beautyBonus: 0.15 });
rs('build', 3, 'reinforced_construction', 'Reinforced construction', 1500, ['masonry', 'metallurgy'], 'Steel-reinforced structures and blast doors.', { buildingHp: 0.25 });
rs('build', 4, 'luxury_living', 'Luxury living', 2400, ['interior_design'], 'Royal beds, fine rugs and the comforts of the rich.', { mood: 2 });
rs('build', 4, 'prefab', 'Prefab construction', 2200, ['reinforced_construction', 'mass_production'], 'Factory-made panels snap together.', { constructSpeed: 0.3 });
rs('build', 4, 'air_conditioning', 'Air conditioning', 600, ['electricity'], 'Coolers and vents. Build freezers to preserve food.');
rs('build', 5, 'climate_control', 'Climate control', 3000, ['air_conditioning', 'microelectronics'], 'Climate units heat or cool a room to its target on their own.');
rs('build', 5, 'autodoors', 'Autodoors', 600, ['microelectronics'], 'Powered doors that open instantly.');
rs('build', 8, 'arcology', 'Arcology design', 7500, ['luxury_living', 'prefab', 'ai_cores'], 'Self-contained living spaces designed by machine minds.', { mood: 4, beautyBonus: 0.25, constructSpeed: 0.2 });

// =============================== POWER ===============================
rs('power', 0, 'electricity', 'Electricity', 1600, [], 'Power conduits, generators, lamps, heaters and electric stoves.');
rs('power', 2, 'batteries', 'Batteries', 400, ['electricity'], 'Store power for the night.');
rs('power', 2, 'wind_power', 'Wind power', 700, ['electricity'], 'Wind turbines: free power whenever the wind blows.');
rs('power', 2, 'efficient_lighting', 'Efficient lighting', 700, ['electricity'], 'Floodlights, and every lamp uses half the power.', { lightPower: 0.5 });
rs('power', 3, 'solar_panels', 'Solar panels', 600, ['electricity'], 'Generate power from sunlight.');
rs('power', 3, 'smart_grid', 'Smart grid', 1500, ['batteries'], 'Large batteries and grid balancing.', { batteryCap: 0.3, powerGen: 0.05 });
rs('power', 3, 'chemfuel_power', 'Chemfuel power', 1300, ['chemistry', 'electricity'], 'Chemfuel generators: steady 1500 W from refined fuel.');
rs('power', 4, 'geothermal', 'Geothermal power', 2400, ['electricity', 'geology'], 'Tap steam geysers for huge, constant power.');
rs('power', 5, 'photovoltaics', 'Photovoltaic arrays', 2800, ['solar_panels', 'microelectronics'], 'Advanced solar arrays and better power electronics.', { powerGen: 0.1 });
rs('power', 6, 'fission', 'Nuclear fission', 4500, ['smart_grid', 'geothermal'], 'Fission reactors: 6000 W from a trickle of uranium.');
rs('power', 8, 'fusion', 'Fusion power', 8500, ['fission', 'advanced_fabrication'], 'Fusion reactors: 12000 W with no fuel at all.', {}, true);
rs('power', 9, 'zero_point', 'Zero-point energy', 11000, ['fusion', 'archotech_studies'], 'Pull energy from the vacuum itself.', { powerGen: 0.2 }, true);

// =============================== MEDICINE ===============================
rs('med', 0, 'herbalism', 'Herbalism', 300, [], 'Grow healroot for herbal medicine. Tending improves.', { tendQuality: 0.05 });
rs('med', 1, 'anatomy', 'Anatomy', 600, ['herbalism'], 'Know the body: better tending.', { tendQuality: 0.1 });
rs('med', 2, 'medicine_production', 'Medicine production', 800, ['herbalism'], 'Drug lab, industrial medicine and hospital beds.');
rs('med', 2, 'antiseptics', 'Antiseptics', 900, ['anatomy'], 'Clean wounds far less often turn septic.', { infectionReduce: 0.4 });
rs('med', 3, 'blood_transfusion', 'Blood transfusion', 1400, ['anatomy'], 'Replace lost blood: slower bleeding out.', { bleedReduce: 0.3 });
rs('med', 3, 'vaccines', 'Vaccination', 1500, ['antiseptics'], 'Primed immune systems beat diseases faster.', { immunity: 0.25 });
rs('med', 3, 'sleep_science', 'Sleep science', 1300, ['anatomy'], 'Understand sleep cycles; unlocks the sleep accelerator.', { restEff: 0.1 });
rs('med', 4, 'hospital_equipment', 'Hospital equipment', 2200, ['medicine_production', 'microelectronics'], 'Vitals monitors improve tending at nearby beds. Wounds heal faster.', { healRate: 0.15 });
rs('med', 4, 'pharmacology', 'Pharmacology', 2400, ['vaccines', 'medicine_production'], 'Refined dosing makes every medicine stronger.', { medPotency: 0.2 });
rs('med', 5, 'sterile_materials', 'Sterile materials', 700, ['microelectronics', 'antiseptics'], 'Sterile tile floors. Patients in clean rooms rarely get infected.', { infectionReduce: 0.1 });
rs('med', 5, 'genetics', 'Genetics', 3200, ['pharmacology'], 'Read and edit the genome.', { immunity: 0.1 });
rs('med', 5, 'anesthesia', 'Anesthesia', 2600, ['pharmacology'], 'Painkillers keep the wounded on their feet.', { painReduce: 0.3 });
rs('med', 6, 'regenerative_medicine', 'Regenerative medicine', 4000, ['genetics', 'hospital_equipment'], 'Tissue regrowth: wounds close twice as fast.', { healRate: 0.5 });
rs('med', 6, 'bioengineering', 'Bioengineering', 4200, ['genetics'], 'Engineered metabolism: better sleep and stamina.', { restEff: 0.15, moveSpeed: 0.05 });
rs('med', 7, 'ultratech_medicine', 'Glitterworld medicine', 5500, ['regenerative_medicine', 'advanced_fabrication'], 'Synthesize glitterworld medicine at a drug lab.', { medPotency: 0.1 });
rs('med', 8, 'neural_regeneration', 'Neural regeneration', 7000, ['ultratech_medicine'], 'Stabilized minds: far fewer breakdowns, much less pain.', { breakResist: 0.2, painReduce: 0.2 });
rs('med', 9, 'archotech_longevity', 'Archotech longevity', 10000, ['neural_regeneration', 'archotech_studies'], 'Machine-god biology: near-instant healing and total immunity.', { healRate: 1, immunity: 0.5, infectionReduce: 0.4 }, true);

// =============================== MILITARY ===============================
rs('mil', 0, 'archery', 'Archery', 300, [], 'Recurve bows, and every shooter aims a little better.', { shootAcc: 0.03 });
rs('mil', 1, 'great_bows', 'Great bows', 700, ['archery'], 'Long-range great bows.');
rs('mil', 1, 'martial_training', 'Martial training', 600, ['smithing'], 'Drills and sparring: harder, surer melee strikes.', { meleeDamage: 0.15, meleeHit: 0.05 });
rs('mil', 2, 'plate_armor', 'Plate armor', 900, ['metallurgy'], 'Forge full plate armor at a smithy.');
rs('mil', 2, 'fortified_positions', 'Trench warfare', 800, ['fortification'], 'Dig in: cover protects much better.', { coverBonus: 0.15 });
rs('mil', 3, 'gunsmithing', 'Gunsmithing', 500, ['machining'], 'Revolvers, autopistols, rifles, shotguns and grenades.');
rs('mil', 3, 'explosives', 'Explosives', 1400, ['chemistry'], 'IED traps: buried explosives for your perimeter.');
rs('mil', 3, 'incendiaries', 'Incendiaries', 1300, ['chemistry', 'gunsmithing'], 'Molotov cocktails set raiders and their cover alight.');
rs('mil', 4, 'flak_armor', 'Flak armor', 1200, ['machining', 'plate_armor'], 'Protective flak vests.');
rs('mil', 4, 'gas_operation', 'Gas operation', 800, ['gunsmithing'], 'Assault rifles and LMGs.');
rs('mil', 4, 'precision_rifling', 'Precision rifling', 900, ['gunsmithing'], 'Sniper rifles.');
rs('mil', 4, 'gun_turrets', 'Gun turrets', 1200, ['gunsmithing'], 'Automated mini-turrets.');
rs('mil', 4, 'tactics', 'Tactical doctrine', 2000, ['gunsmithing', 'fortified_positions'], 'Fire and manoeuvre: better accuracy from cover.', { shootAcc: 0.08, coverBonus: 0.1 });
rs('mil', 4, 'firefoam', 'Firefoam', 1800, ['chemistry', 'electricity'], 'Firefoam poppers smother any fire that starts near them.');
rs('mil', 5, 'heavy_weapons', 'Heavy weapons', 2800, ['gas_operation'], 'Heavy SMGs, miniguns and rocket launchers.');
rs('mil', 5, 'ballistics', 'Ballistics', 2600, ['precision_rifling', 'gun_turrets'], 'Better rounds and fire control: turrets hit much harder.', { turretDamage: 0.2, shootAcc: 0.04 });
rs('mil', 6, 'autocannon_turrets', 'Autocannon turrets', 3600, ['ballistics', 'heavy_weapons'], 'Heavy 2×2 autocannon turrets.');
rs('mil', 6, 'sniper_turrets', 'Uranium slug turrets', 3800, ['ballistics', 'precision_rifling'], 'Long-range uranium slug turrets.');
rs('mil', 6, 'emp_tech', 'EMP technology', 3800, ['microelectronics', 'explosives'], 'EMP grenades wreck and stun mechanoids.');
rs('mil', 6, 'personal_shields', 'Personal shields', 4200, ['microelectronics', 'flak_armor'], 'Shield belts absorb incoming bullets until drained.');
rs('mil', 6, 'recon_armor', 'Recon armor', 4000, ['flak_armor', 'fabrication'], 'Light powered armor that does not slow you down.');
rs('mil', 7, 'powered_armor', 'Powered armor', 4500, ['recon_armor'], 'Marine armor and helmets.');
rs('mil', 7, 'charged_shot', 'Charged shot', 3500, ['fabrication', 'gas_operation'], 'Charge rifles.');
rs('mil', 8, 'cataphract_armor', 'Cataphract armor', 6500, ['powered_armor', 'advanced_fabrication'], 'The heaviest armor ever made for a human.', {}, true);
rs('mil', 8, 'monomolecular_blades', 'Monomolecular blades', 6500, ['martial_training', 'advanced_fabrication'], 'Monoswords that cut through almost anything.', {}, true);
rs('mil', 8, 'pulse_weapons', 'Pulse weapons', 7000, ['charged_shot', 'fusion'], 'Pulse rifles: ultratech firepower.', {}, true);

// =============================== SOCIETY & SCIENCE ===============================
rs('soc', 0, 'writing', 'Writing', 300, [], 'Record knowledge. Research is faster; unlocks bookshelves.', { researchSpeed: 0.1 });
rs('soc', 0, 'music', 'Music', 400, [], 'Harps to play and gather around.', { joyGain: 0.05 });
rs('soc', 1, 'philosophy', 'Philosophy', 600, ['writing'], 'A sense of meaning: better mood and resilience.', { mood: 2, breakResist: 0.05 });
rs('soc', 1, 'brewing', 'Brewing', 500, [], 'Brew beer — a cheap source of recreation.');
rs('soc', 1, 'commerce', 'Commerce', 700, ['writing'], 'Haggling and bookkeeping: better trade prices, more traders.', { tradePrice: 0.08, goodEvents: 0.1 });
rs('soc', 2, 'scientific_method', 'Scientific method', 1000, ['writing'], 'Hypothesis, experiment, repeat.', { researchSpeed: 0.15 });
rs('soc', 2, 'pedagogy', 'Pedagogy', 900, ['writing'], 'Structured teaching: everyone learns skills faster.', { learnRate: 0.2 });
rs('soc', 2, 'prison_reform', 'Prison reform', 800, ['philosophy'], 'Humane prisons recruit far more prisoners.', { recruitChance: 0.4 });
rs('soc', 2, 'festivals', 'Festivals', 700, ['music', 'brewing'], 'Celebrations lift everyone.', { joyGain: 0.2, mood: 1 });
rs('soc', 2, 'geology', 'Geology', 900, ['stonecutting'], 'Read the rock: faster, richer mining.', { mineSpeed: 0.2, mineYield: 0.15 });
rs('soc', 3, 'psychology', 'Psychology', 1500, ['philosophy', 'anatomy'], 'Counselling and stress management.', { breakResist: 0.15, mood: 2 });
rs('soc', 3, 'diplomacy', 'Diplomacy', 1400, ['commerce', 'philosophy'], 'Envoys and treaties: fewer raiders come for you and prices improve.', { threatReduce: 0.1, tradePrice: 0.07, recruitChance: 0.15 });
rs('soc', 3, 'fine_music', 'Orchestration', 1200, ['music', 'fine_arts'], 'Pianos: beautiful, and wonderful to play.', { joyGain: 0.1 });
rs('soc', 4, 'microelectronics', 'Microelectronics', 2500, ['electricity', 'scientific_method'], 'Comms console, hi-tech research bench, televisions.');
rs('soc', 4, 'logistics', 'Logistics', 2000, ['commerce'], 'Better routes and packing: everyone moves faster.', { moveSpeed: 0.05, goodEvents: 0.1 });
rs('soc', 5, 'computing', 'Computing', 3000, ['microelectronics'], 'Multi-analyzers speed up research benches around them.', { researchSpeed: 0.1 });
rs('soc', 5, 'mass_media', 'Mass media', 2500, ['microelectronics'], 'Megascreen televisions and broadcast entertainment.', { joyGain: 0.15 });
rs('soc', 7, 'ai_cores', 'AI persona cores', 5500, ['computing', 'advanced_fabrication'], 'Machine minds assist your researchers and workers.', { researchSpeed: 0.2, globalWork: 0.05 }, true);
rs('soc', 8, 'neural_uplinks', 'Neural uplinks', 7500, ['ai_cores', 'neural_regeneration'], 'Direct brain-computer links: learning and research soar.', { learnRate: 0.4, researchSpeed: 0.25 }, true);

// =============================== SPACE & ULTRATECH ===============================
rs('space', 5, 'orbital_mechanics', 'Orbital mechanics', 3000, ['microelectronics'], 'The maths of orbits. Orbital traders call more often.', { goodEvents: 0.1 });
rs('space', 6, 'ship_basics', 'Starflight basics', 4000, ['fabrication', 'orbital_mechanics'], 'Ship structural beams and computer core.', {}, true);
rs('space', 6, 'orbital_scanning', 'Orbital scanning', 4000, ['orbital_mechanics', 'computing'], 'Orbital scanners spot falling cargo and guide it down to you.');
rs('space', 7, 'cryptosleep', 'Cryptosleep', 2500, ['ship_basics'], 'Cryptosleep caskets to carry your colonists.', {}, true);
rs('space', 7, 'ship_reactor', 'Starship drive', 6000, ['ship_basics'], 'Ship reactor and engines. Build a ship and escape this rimworld!', {}, true);
rs('space', 8, 'weather_control', 'Weather control', 8000, ['orbital_scanning', 'fusion'], 'Weather controllers hold the sky clear over your colony.', {}, true);
rs('space', 9, 'archotech_studies', 'Archotech studies', 12000, ['neural_uplinks', 'weather_control'], 'Glimpse the minds of the archotechs. Everything your colony does gets better.', { globalWork: 0.2, mood: 5, researchSpeed: 0.2 }, true);
rs('space', 9, 'archotech_monument', 'Archotech monument', 9000, ['archotech_studies', 'fine_arts'], 'A monument of impossible geometry that fills every nearby colonist with awe.', {}, true);

// every project sits at least one tier right of all its prerequisites (the tree UI lays out by tier)
{
  const fixed = new Set<string>();
  const fix = (id: string): number => {
    const r = RESEARCH[id];
    if (!fixed.has(id)) { fixed.add(id); r.tier = Math.max(r.tier, ...r.prereqs.map(p => fix(p) + 1)); }
    return r.tier;
  };
  for (const id in RESEARCH) fix(id);
}
