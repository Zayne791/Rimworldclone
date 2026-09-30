import type { ItemDef, StuffProps } from './types';

const stuff = (p: Partial<StuffProps> & { color: string; cats: StuffProps['cats'] }): StuffProps => ({
  hpF: 1, beauty: 0, workF: 1, flam: 0, sharpF: 1, bluntF: 1, armorF: 1, insCold: 0, ...p,
});

export const ITEMS: Record<string, ItemDef> = {};
function add(d: ItemDef) { ITEMS[d.id] = d; }

// ---------------- Raw resources / stuff ----------------
add({ id: 'wood', label: 'wood', cat: 'resource', stack: 75, mass: 0.4, value: 1.2, sprite: 'wood', flam: 1,
  stuff: stuff({ color: '#9a6a3e', cats: ['woody'], hpF: 0.65, workF: 0.7, flam: 1, sharpF: 0.5, bluntF: 0.9, armorF: 0.3 }), desc: 'Logs cut from trees. Burns well; builds quickly.' });
add({ id: 'steel', label: 'steel', cat: 'resource', stack: 75, mass: 0.5, value: 1.9, sprite: 'steel',
  stuff: stuff({ color: '#8f99a3', cats: ['metallic'], hpF: 1, workF: 1, flam: 0.4, sharpF: 0.9, bluntF: 0.9, armorF: 0.9 }), desc: 'Refined iron alloy. The backbone of industry.' });
add({ id: 'plasteel', label: 'plasteel', cat: 'resource', stack: 75, mass: 0.25, value: 9, sprite: 'plasteel',
  stuff: stuff({ color: '#8fd3cd', cats: ['metallic'], hpF: 2.8, workF: 1.6, sharpF: 1.1, bluntF: 0.9, armorF: 1.2, valueF: 3 }), desc: 'Advanced alloy, incredibly strong and light.' });
add({ id: 'silver', label: 'silver', cat: 'resource', stack: 500, mass: 0.008, value: 1, sprite: 'silver',
  stuff: stuff({ color: '#c7ced6', cats: ['metallic'], hpF: 0.7, beauty: 2, workF: 1, flam: 0.2, sharpF: 0.45, bluntF: 0.7, armorF: 0.4 }), desc: 'A precious metal. Used as currency by traders.' });
add({ id: 'gold', label: 'gold', cat: 'resource', stack: 500, mass: 0.008, value: 10, sprite: 'gold',
  stuff: stuff({ color: '#e5b73a', cats: ['metallic'], hpF: 0.6, beauty: 8, workF: 1, flam: 0.2, sharpF: 0.3, bluntF: 1.4, armorF: 0.3 }), desc: 'Gleaming precious metal. Makes stunning decor.' });
add({ id: 'jade', label: 'jade', cat: 'resource', stack: 75, mass: 0.5, value: 5, sprite: 'jade',
  stuff: stuff({ color: '#5bb07a', cats: ['stony'], hpF: 0.6, beauty: 4, workF: 1.5, sharpF: 0.4, bluntF: 1.1, armorF: 0.4 }), desc: 'A beautiful green stone.' });
add({ id: 'uranium', label: 'uranium', cat: 'resource', stack: 75, mass: 1, value: 6, sprite: 'uranium',
  stuff: stuff({ color: '#6f846d', cats: ['metallic'], hpF: 1.6, workF: 1.3, sharpF: 0.6, bluntF: 1.5, armorF: 1 }), desc: 'Dense radioactive metal.' });
add({ id: 'components', label: 'components', cat: 'resource', stack: 75, mass: 0.6, value: 32, sprite: 'components', desc: 'Mechanical and electrical parts for machines.' });
add({ id: 'adv_components', label: 'advanced components', cat: 'resource', stack: 75, mass: 0.6, value: 200, sprite: 'adv_components', desc: 'High-tech parts for starships and advanced gear.' });
add({ id: 'chemfuel', label: 'chemfuel', cat: 'resource', stack: 150, mass: 0.05, value: 2.3, sprite: 'chemfuel', flam: 1, desc: 'Volatile fuel refined from organic matter.' });

const blocks = (id: string, label: string, color: string, hpF: number, workF: number, beauty = 0) =>
  add({ id: 'blocks_' + id, label: label + ' blocks', cat: 'resource', stack: 75, mass: 1, value: 1.1, sprite: 'blocks', tradeTags: ['blocks'],
    stuff: stuff({ color, cats: ['stony'], hpF, workF, beauty, sharpF: 0.3, bluntF: 1, armorF: 0.5 }), desc: 'Cut stone blocks. Durable and fireproof, but slow to build with.' });
blocks('granite', 'granite', '#7a7370', 1.7, 2.6);
blocks('limestone', 'limestone', '#a9a28c', 1.55, 2.4);
blocks('marble', 'marble', '#d0cdc6', 1.2, 2.3, 1);
blocks('sandstone', 'sandstone', '#b38566', 1.4, 2.1);
blocks('slate', 'slate', '#5d6067', 1.3, 2.1);

const chunk = (id: string, label: string) =>
  add({ id: 'chunk_' + id, label: label + ' chunk', cat: 'chunk', stack: 1, mass: 20, value: 0, sprite: 'chunk', noTrade: true, desc: 'A heavy chunk of rock. Can be cut into blocks at a stonecutter\'s table.' });
chunk('granite', 'granite'); chunk('limestone', 'limestone'); chunk('marble', 'marble'); chunk('sandstone', 'sandstone'); chunk('slate', 'slate');
add({ id: 'chunk_slag', label: 'steel slag chunk', cat: 'chunk', stack: 1, mass: 25, value: 0, sprite: 'slag', noTrade: true, smeltable: true, desc: 'Scrap metal. Can be smelted back into steel at a smithy.' });

// textiles
add({ id: 'cloth', label: 'cloth', cat: 'textile', stack: 75, mass: 0.026, value: 1.5, sprite: 'cloth', flam: 1,
  stuff: stuff({ color: '#ddd6c2', cats: ['fabric'], hpF: 1, beauty: 0, workF: 1, flam: 1, sharpF: 0.2, bluntF: 0.2, armorF: 0.36, insCold: 18 }), desc: 'Woven cotton fibers.' });
add({ id: 'devilstrand', label: 'devilstrand', cat: 'textile', stack: 75, mass: 0.026, value: 5.5, sprite: 'cloth', flam: 0.4,
  stuff: stuff({ color: '#a33a30', cats: ['fabric'], hpF: 1.3, beauty: 1, workF: 1, flam: 0.4, sharpF: 0.2, bluntF: 0.2, armorF: 1.1, insCold: 20 }), desc: 'Tough fungal fabric with excellent protection.' });
add({ id: 'leather', label: 'leather', cat: 'textile', stack: 75, mass: 0.03, value: 2.1, sprite: 'leather', flam: 1,
  stuff: stuff({ color: '#8e5f3a', cats: ['leathery'], hpF: 1.3, beauty: 0, workF: 1, flam: 1, sharpF: 0.2, bluntF: 0.2, armorF: 0.7, insCold: 16 }), desc: 'Tanned animal hide.' });
add({ id: 'wool', label: 'muffalo wool', cat: 'textile', stack: 75, mass: 0.028, value: 2.6, sprite: 'wool', flam: 1,
  stuff: stuff({ color: '#eee7d3', cats: ['fabric'], hpF: 1, beauty: 0, workF: 1, flam: 1, sharpF: 0.2, bluntF: 0.2, armorF: 0.3, insCold: 30 }), desc: 'Thick, warm wool.' });
add({ id: 'fur', label: 'thick fur', cat: 'textile', stack: 75, mass: 0.03, value: 3, sprite: 'fur', flam: 1,
  stuff: stuff({ color: '#6b5a48', cats: ['leathery'], hpF: 1.4, beauty: 1, workF: 1, flam: 1, sharpF: 0.2, bluntF: 0.2, armorF: 0.8, insCold: 30 }), desc: 'Heavy fur pelt from a large predator.' });

// ---------------- Food ----------------
const raw = (id: string, label: string, nutrition: number, value: number, rotDays: number, kind: 'veg' | 'meat' | 'animal', sprite: string) =>
  add({ id, label, cat: 'raw_food', stack: 75, mass: 0.03, value, sprite, flam: 0.5, food: { nutrition, kind, pref: 0, rotDays, thought: kind === 'meat' ? 'ate_raw_meat' : 'ate_raw' } });
raw('rice', 'rice', 0.05, 1.1, 40, 'veg', 'rice');
raw('potato', 'potatoes', 0.05, 1.1, 30, 'veg', 'potato');
raw('corn', 'corn', 0.05, 1.1, 60, 'veg', 'corn');
raw('berries', 'berries', 0.05, 1.5, 14, 'veg', 'berries');
raw('strawberry', 'strawberries', 0.05, 1.6, 14, 'veg', 'strawberry');
raw('meat', 'raw meat', 0.05, 2, 2, 'meat', 'meat');
raw('eggs', 'eggs', 0.05, 2.5, 15, 'animal', 'eggs');
raw('milk', 'milk', 0.05, 2, 14, 'animal', 'milk');
add({ id: 'hay', label: 'hay', cat: 'feed', stack: 75, mass: 0.014, value: 0.5, sprite: 'hay', flam: 1, food: { nutrition: 0.05, kind: 'hay', pref: -1, rotDays: 60 } });

add({ id: 'meal_simple', label: 'simple meal', cat: 'meal', stack: 10, mass: 0.44, value: 15, sprite: 'meal_simple', flam: 0.5, food: { nutrition: 0.9, kind: 'meal', pref: 1, rotDays: 4 } });
add({ id: 'meal_fine', label: 'fine meal', cat: 'meal', stack: 10, mass: 0.44, value: 20, sprite: 'meal_fine', flam: 0.5, food: { nutrition: 0.9, kind: 'meal', pref: 2, rotDays: 4, thought: 'ate_fine_meal' } });
add({ id: 'meal_lavish', label: 'lavish meal', cat: 'meal', stack: 10, mass: 0.44, value: 40, sprite: 'meal_lavish', flam: 0.5, food: { nutrition: 1, kind: 'meal', pref: 3, rotDays: 4, thought: 'ate_lavish_meal' } });
add({ id: 'pemmican', label: 'pemmican', cat: 'meal', stack: 150, mass: 0.018, value: 1.4, sprite: 'pemmican', flam: 0.5, food: { nutrition: 0.05, kind: 'meal', pref: 1, rotDays: 70 } });
add({ id: 'meal_survival', label: 'packaged survival meal', cat: 'meal', stack: 10, mass: 0.3, value: 24, sprite: 'meal_survival', flam: 0.5, food: { nutrition: 0.9, kind: 'meal', pref: 1 } });
add({ id: 'meal_paste', label: 'nutrient paste meal', cat: 'meal', stack: 10, mass: 0.3, value: 10, sprite: 'meal_paste', flam: 0.5, food: { nutrition: 0.9, kind: 'meal', pref: 0, rotDays: 4, thought: 'ate_paste' } });
add({ id: 'beer', label: 'beer', cat: 'drug', stack: 25, mass: 0.3, value: 12, sprite: 'beer', flam: 0.5, food: { nutrition: 0.08, kind: 'meal', pref: 0, joy: 0.17, thought: 'drank_beer' }, desc: 'A mild alcoholic beverage. Fun in moderation.' });

// ---------------- Medicine ----------------
add({ id: 'medicine_herbal', label: 'herbal medicine', cat: 'medicine', stack: 25, mass: 0.35, value: 10, sprite: 'medicine_herbal', med: { potency: 0.6 }, flam: 0.5 });
add({ id: 'medicine', label: 'medicine', cat: 'medicine', stack: 25, mass: 0.5, value: 18, sprite: 'medicine', med: { potency: 1 }, flam: 0.5, research: 'medicine_production' });
add({ id: 'medicine_glitter', label: 'glitterworld medicine', cat: 'medicine', stack: 25, mass: 0.5, value: 250, sprite: 'medicine_glitter', med: { potency: 1.6 } });

// ---------------- Weapons ----------------
const melee = (id: string, label: string, damage: number, dmgType: 'sharp' | 'blunt' | 'stab' | 'cut', cooldown: number, cats: ItemDef['stuffCats'], count: number, value: number, sprite: string, pen = 0.15) =>
  add({ id, label, cat: 'weapon', stack: 1, mass: 1.5, value, sprite, stuffCats: cats, stuffCount: count, quality: true, hp: 100,
    weapon: { melee: true, damage, dmgType, pen, cooldown, sound: 'melee' } });
melee('knife', 'knife', 10, 'cut', 72, ['metallic', 'woody'], 25, 30, 'knife', 0.12);
melee('club', 'club', 13, 'blunt', 110, ['woody', 'metallic', 'stony'], 50, 20, 'club', 0.1);
melee('spear', 'spear', 19, 'stab', 140, ['metallic', 'woody'], 50, 45, 'spear', 0.3);
melee('longsword', 'longsword', 23, 'cut', 150, ['metallic'], 100, 90, 'longsword', 0.33);
melee('mace', 'mace', 21, 'blunt', 140, ['metallic'], 75, 70, 'mace', 0.28);

const gun = (id: string, label: string, w: Omit<import('./types').WeaponProps, 'melee'>, value: number, sprite: string, cost?: Record<string, number>, research?: string) =>
  add({ id, label, cat: 'weapon', stack: 1, mass: 3, value, sprite, quality: true, hp: 100, weapon: { melee: false, ...w }, research });
gun('bow_short', 'short bow', { damage: 11, dmgType: 'sharp', pen: 0.16, cooldown: 100, range: 24, warmup: 90, acc: [0.65, 0.8, 0.6, 0.4], projSpeed: 0.55, proj: 'arrow', sound: 'bow' }, 60, 'bow');
gun('revolver', 'revolver', { damage: 12, dmgType: 'bullet', pen: 0.18, cooldown: 96, range: 26, warmup: 18, acc: [0.8, 0.75, 0.45, 0.35], projSpeed: 1.1, proj: 'bullet', sound: 'pistol' }, 175, 'revolver');
gun('autopistol', 'autopistol', { damage: 10, dmgType: 'bullet', pen: 0.15, cooldown: 60, range: 24, warmup: 18, acc: [0.8, 0.65, 0.35, 0.2], projSpeed: 1.1, proj: 'bullet', sound: 'pistol' }, 240, 'autopistol');
gun('rifle_bolt', 'bolt-action rifle', { damage: 18, dmgType: 'bullet', pen: 0.27, cooldown: 90, range: 37, warmup: 100, acc: [0.65, 0.8, 0.9, 0.8], projSpeed: 1.3, proj: 'bullet', sound: 'rifle' }, 250, 'rifle_bolt');
gun('shotgun', 'pump shotgun', { damage: 18, dmgType: 'bullet', pen: 0.14, cooldown: 75, range: 16, warmup: 36, acc: [0.8, 0.87, 0.77, 0.64], projSpeed: 1.1, proj: 'bullet', sound: 'shotgun' }, 300, 'shotgun');
gun('rifle_assault', 'assault rifle', { damage: 11, dmgType: 'bullet', pen: 0.16, cooldown: 100, range: 31, warmup: 60, burst: 3, burstDelay: 7, acc: [0.6, 0.7, 0.65, 0.55], projSpeed: 1.3, proj: 'bullet', sound: 'rifle' }, 500, 'rifle_assault');
gun('rifle_sniper', 'sniper rifle', { damage: 25, dmgType: 'bullet', pen: 0.38, cooldown: 130, range: 45, warmup: 190, acc: [0.5, 0.7, 0.86, 0.88], projSpeed: 1.6, proj: 'bullet', sound: 'sniper' }, 540, 'rifle_sniper');
gun('lmg', 'LMG', { damage: 11, dmgType: 'bullet', pen: 0.16, cooldown: 140, range: 26, warmup: 78, burst: 6, burstDelay: 5, acc: [0.4, 0.48, 0.35, 0.26], projSpeed: 1.3, proj: 'bullet', sound: 'rifle', twoHanded: true }, 580, 'lmg');
gun('rifle_charge', 'charge rifle', { damage: 15, dmgType: 'bullet', pen: 0.35, cooldown: 90, range: 28, warmup: 60, burst: 3, burstDelay: 7, acc: [0.55, 0.64, 0.55, 0.45], projSpeed: 1.2, proj: 'charge', sound: 'charge' }, 1100, 'rifle_charge');
gun('grenades_frag', 'frag grenades', { damage: 45, dmgType: 'bomb', pen: 0.1, cooldown: 170, range: 13, warmup: 66, acc: [1, 1, 1, 1], projSpeed: 0.3, proj: 'rocket', sound: 'throw', explosive: { radius: 1.9, damage: 45 } }, 280, 'grenades');
// non-tradeable built-in weapons (turrets & mechs)
gun('turret_gun', 'mini-turret gun', { damage: 11, dmgType: 'bullet', pen: 0.16, cooldown: 150, range: 29, warmup: 30, burst: 2, burstDelay: 8, acc: [0.7, 0.64, 0.41, 0.22], projSpeed: 1.3, proj: 'bullet', sound: 'rifle' }, 0, 'rifle_assault');
ITEMS.turret_gun.noTrade = true;
gun('charge_lance', 'charge lance', { damage: 30, dmgType: 'bullet', pen: 0.45, cooldown: 170, range: 30, warmup: 84, acc: [0.6, 0.7, 0.65, 0.55], projSpeed: 1.2, proj: 'charge', sound: 'charge' }, 1300, 'rifle_charge');
gun('heavy_blaster', 'heavy charge blaster', { damage: 12, dmgType: 'bullet', pen: 0.25, cooldown: 170, range: 25, warmup: 100, burst: 6, burstDelay: 6, acc: [0.3, 0.4, 0.3, 0.2], projSpeed: 1.1, proj: 'charge', sound: 'charge' }, 0, 'lmg');
ITEMS.heavy_blaster.noTrade = true;

// ---------------- Apparel ----------------
const app = (id: string, label: string, p: import('./types').ApparelProps, value: number, extra: Partial<ItemDef> = {}) =>
  add({ id, label, cat: 'apparel', stack: 1, mass: 1, value, sprite: 'apparel_' + p.style, quality: true, hp: 150, apparel: p, flam: 0.8, ...extra });
app('tribalwear', 'tribalwear', { layers: ['skin', 'middle'], cover: ['torso', 'arms', 'legs'], armorSharp: 0.1, armorBlunt: 0.05, armorHeat: 0.1, insCold: 12, insHeat: 8, style: 'tribal' }, 60, { stuffCats: ['fabric', 'leathery'], stuffCount: 60 });
app('tshirt', 't-shirt', { layers: ['skin'], cover: ['torso'], armorSharp: 0.05, armorBlunt: 0, armorHeat: 0.05, insCold: 4, insHeat: 6, style: 'tshirt' }, 30, { stuffCats: ['fabric', 'leathery'], stuffCount: 40 });
app('shirt', 'button-down shirt', { layers: ['skin'], cover: ['torso', 'arms'], armorSharp: 0.05, armorBlunt: 0, armorHeat: 0.05, insCold: 6, insHeat: 6, style: 'shirt' }, 45, { stuffCats: ['fabric', 'leathery'], stuffCount: 45 });
app('pants', 'pants', { layers: ['skin'], cover: ['legs'], armorSharp: 0.05, armorBlunt: 0, armorHeat: 0.05, insCold: 5, insHeat: 4, style: 'pants' }, 40, { stuffCats: ['fabric', 'leathery'], stuffCount: 40 });
app('jacket', 'jacket', { layers: ['middle'], cover: ['torso', 'arms'], armorSharp: 0.12, armorBlunt: 0.05, armorHeat: 0.1, insCold: 14, insHeat: 0, style: 'jacket' }, 90, { stuffCats: ['fabric', 'leathery'], stuffCount: 70, research: 'complex_clothing' });
app('duster', 'duster', { layers: ['outer'], cover: ['torso', 'arms', 'legs'], armorSharp: 0.1, armorBlunt: 0.05, armorHeat: 0.15, insCold: 8, insHeat: 20, style: 'duster' }, 120, { stuffCats: ['fabric', 'leathery'], stuffCount: 80, research: 'complex_clothing' });
app('parka', 'parka', { layers: ['outer'], cover: ['torso', 'arms', 'legs'], armorSharp: 0.1, armorBlunt: 0.05, armorHeat: 0.1, insCold: 40, insHeat: -5, style: 'parka' }, 110, { stuffCats: ['fabric', 'leathery'], stuffCount: 80, research: 'complex_clothing' });
app('flak_vest', 'flak vest', { layers: ['middle'], cover: ['torso'], armorSharp: 0.9, armorBlunt: 0.3, armorHeat: 0.2, insCold: 2, insHeat: -2, style: 'vest', color: '#5a6a4a' }, 220, { research: 'flak_armor' });
app('helmet_simple', 'simple helmet', { layers: ['head'], cover: ['head'], armorSharp: 0.5, armorBlunt: 0.2, armorHeat: 0.2, insCold: 2, insHeat: 0, style: 'helmet' }, 80, { stuffCats: ['metallic'], stuffCount: 40, research: 'smithing' });
app('cowboy_hat', 'cowboy hat', { layers: ['head'], cover: ['head'], armorSharp: 0, armorBlunt: 0, armorHeat: 0, insCold: 0, insHeat: 10, style: 'cowboyhat' }, 40, { stuffCats: ['fabric', 'leathery'], stuffCount: 25, research: 'complex_clothing' });
app('tuque', 'tuque', { layers: ['head'], cover: ['head'], armorSharp: 0, armorBlunt: 0, armorHeat: 0, insCold: 10, insHeat: 0, style: 'tuque' }, 30, { stuffCats: ['fabric', 'leathery'], stuffCount: 25 });
app('armor_marine', 'marine armor', { layers: ['outer', 'middle'], cover: ['torso', 'arms', 'legs'], armorSharp: 1.06, armorBlunt: 0.45, armorHeat: 0.54, insCold: 32, insHeat: 9, style: 'armor', color: '#56606b', moveF: 0.95 }, 2000, { research: 'powered_armor' });
app('helmet_marine', 'marine helmet', { layers: ['head'], cover: ['fullhead'], armorSharp: 1.06, armorBlunt: 0.45, armorHeat: 0.54, insCold: 8, insHeat: 2, style: 'marinehelmet', color: '#56606b' }, 700, { research: 'powered_armor' });

// ---------------- Misc ----------------
add({ id: 'corpse', label: 'corpse', cat: 'corpse', stack: 1, mass: 60, value: 0, sprite: 'corpse', noTrade: true, flam: 1 });

export function itemDef(id: string): ItemDef {
  const d = ITEMS[id];
  if (!d) throw new Error('Unknown item ' + id);
  return d;
}
export const STUFF_IDS = Object.values(ITEMS).filter(i => i.stuff).map(i => i.id);
export function stuffOf(id: string | null | undefined) { return id ? ITEMS[id]?.stuff : undefined; }
export function stuffsFor(cats: string[] | undefined): string[] {
  if (!cats) return [];
  return STUFF_IDS.filter(s => ITEMS[s].stuff!.cats.some(c => cats.includes(c)));
}
export const QUALITY_LABELS = ['awful', 'poor', 'normal', 'good', 'excellent', 'masterwork', 'legendary'];
export const QUALITY_VALUE = [0.5, 0.75, 1, 1.25, 1.5, 2.5, 5];
export const QUALITY_STAT = [0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5];
