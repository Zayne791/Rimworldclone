// Shared definition types for all game content.

export type StuffCat = 'metallic' | 'woody' | 'stony' | 'fabric' | 'leathery';
export type ItemCat =
  | 'resource' | 'raw_food' | 'meal' | 'medicine' | 'weapon' | 'apparel' | 'chunk'
  | 'corpse' | 'textile' | 'animal_product' | 'feed' | 'misc' | 'drug';
export type DamageType = 'sharp' | 'blunt' | 'bullet' | 'burn' | 'bomb' | 'cut' | 'stab' | 'bite' | 'scratch' | 'frost';

export type SkillId =
  | 'shooting' | 'melee' | 'construction' | 'mining' | 'cooking' | 'plants'
  | 'animals' | 'crafting' | 'artistic' | 'medical' | 'social' | 'intellectual';

export type WorkType =
  | 'firefight' | 'patient' | 'doctor' | 'bedrest' | 'warden' | 'handle' | 'cook' | 'hunt'
  | 'construct' | 'grow' | 'mine' | 'plantcut' | 'smith' | 'tailor' | 'art' | 'craft'
  | 'haul' | 'clean' | 'research';

export interface StuffProps {
  color: string;       // tint color
  cats: StuffCat[];
  hpF: number;         // hit point factor
  beauty: number;      // additive beauty offset for buildings made of this
  beautyF?: number;
  workF: number;       // construction work multiplier
  flam: number;        // 0..1 flammability
  sharpF: number;      // melee sharp damage factor
  bluntF: number;
  armorF: number;      // armor factor for apparel
  insCold: number;     // insulation (C) for apparel
  valueF?: number;
}

export interface WeaponProps {
  melee: boolean;
  damage: number;
  dmgType: DamageType;
  pen: number;             // armor penetration 0..1
  cooldown: number;        // ticks between shots/swings
  range?: number;          // tiles
  warmup?: number;         // aim ticks
  burst?: number;
  burstDelay?: number;
  acc?: [number, number, number, number]; // touch(<=3), short(<=12), medium(<=25), long(<=40)
  projSpeed?: number;      // tiles per tick
  proj?: 'bullet' | 'charge' | 'arrow' | 'rocket';
  sound?: string;
  explosive?: { radius: number; damage: number; fire?: boolean };
  twoHanded?: boolean;
}

export type ApparelLayer = 'skin' | 'middle' | 'outer' | 'head' | 'belt';
export type BodyGroup = 'torso' | 'legs' | 'arms' | 'head' | 'fullhead';
export interface ApparelProps {
  layers: ApparelLayer[];
  cover: BodyGroup[];
  armorSharp: number;
  armorBlunt: number;
  armorHeat: number;
  insCold: number;
  insHeat: number;
  style: string;       // sprite style id
  color?: string;      // fixed color for non-stuff apparel
  moveF?: number;
}

export interface ItemDef {
  id: string;
  label: string;
  cat: ItemCat;
  stack: number;
  mass: number;
  value: number;
  desc?: string;
  stuff?: StuffProps;
  food?: { nutrition: number; kind: 'veg' | 'meat' | 'meal' | 'hay' | 'animal'; pref: number; thought?: string; rotDays?: number; joy?: number };
  med?: { potency: number };
  weapon?: WeaponProps;
  apparel?: ApparelProps;
  stuffCats?: StuffCat[];  // made from stuff
  stuffCount?: number;
  flam?: number;
  hp?: number;
  beauty?: number;
  sprite: string;
  tradeTags?: string[];
  noTrade?: boolean;
  quality?: boolean;
  smeltable?: boolean;
  research?: string;
}

export interface TerrainDef {
  id: string;
  label: string;
  style: string;
  colors: string[];
  fert: number;
  moveCost: number;       // extra ticks per tile
  beauty: number;
  water?: 'shallow' | 'deep';
  floor?: boolean;        // constructed floor
  cost?: Record<string, number>;
  stuffFloor?: boolean;   // floor made from stuff (stone tiles)
  work?: number;
  research?: string;
  canBuild: boolean;      // can place heavy structures
  clean?: number;         // cleanliness offset
  smooth?: boolean;
  label2?: string;
  noFilth?: boolean;
}

export interface RockDef {
  id: string;
  label: string;
  color: string;
  dark: string;
  speck?: string;
  hp: number;
  work: number;
  yieldItem?: string;
  yieldCount?: number;
  chunk?: string;  // chunk item when mined
  stone?: string;  // stone type for rough floor
  ore?: boolean;
  smoothable?: boolean;
}

export interface PlantDef {
  id: string;
  label: string;
  kind: 'tree' | 'bush' | 'grass' | 'crop' | 'flower' | 'cactus';
  growDays: number;
  harvestItem?: string;
  harvestYield?: number;
  harvestMin?: number;    // growth needed to harvest
  woodYield?: number;
  minFert: number;
  sowable: boolean;
  wild: boolean;
  sowSkill?: number;
  beauty: number;
  pathCost: number;
  cover?: number;
  flam: number;
  nutrition: number;      // for grazing animals
  hp: number;
  regrow?: number;        // growth after harvest (for bushes); undefined = die
  research?: string;
  color: string;
  color2?: string;
  fruit?: string;
  blocksSight?: boolean;
  sprite: string;
  lightMin?: number;
  minTemp?: number;
}

export type ArchCat = 'structure' | 'floors' | 'furniture' | 'production' | 'power' | 'temperature' | 'lighting' | 'security' | 'joy' | 'misc' | 'ship' | 'art';

export interface BuildingDef {
  id: string;
  label: string;
  desc: string;
  cat: ArchCat;
  size: [number, number];
  pass: 'wall' | 'impassable' | 'pass';
  pathCost?: number;
  blocksLight?: boolean;
  blocksRoom?: boolean;
  isDoor?: boolean;
  supportsRoof?: boolean;
  stuffCats?: StuffCat[];
  stuffCount?: number;
  cost?: Record<string, number>;
  work: number;
  hp: number;
  beauty?: number;
  flam?: number;
  research?: string;
  skill?: number;
  power?: { use?: number; gen?: number; kind?: 'solar' | 'wind' | 'fuel' | 'geo'; battery?: number };
  conduit?: boolean;
  fuel?: { item: string; cap: number; perDay: number };
  light?: { radius: number; color: [number, number, number]; power?: boolean; fuel?: boolean; sun?: boolean };
  heat?: { watts: number; target: number; power?: boolean; fuel?: boolean };
  cooler?: boolean;
  bed?: { sleepers: number; restEff: number; comfort: number; medical?: boolean; bedroll?: boolean };
  seat?: { comfort: number };
  table?: boolean;
  bench?: { recipes: string[]; power?: boolean; fuel?: boolean; speed?: number; research?: boolean; researchSpeed?: number };
  interact?: [number, number];
  joy?: { kind: string; rate: number; users?: number };
  turret?: { weapon: string };
  storage?: { stacks: number };
  cover?: number;
  floorLevel?: boolean;
  trap?: { damage: number };
  grave?: boolean;
  growBasin?: { fert: number };
  ship?: 'beam' | 'reactor' | 'engine' | 'casket' | 'computer';
  comms?: boolean;
  researchBoost?: number;
  art?: boolean;
  rotatable?: boolean;
  linked?: boolean;
  geyser?: boolean;   // must be placed on a steam geyser
  sprite: string;
  value?: number;
  vent?: boolean;
  noRoofNeeded?: boolean;
  wallMounted?: boolean; // e.g. cooler: replaces wall
  hidden?: boolean;      // not in architect
  natural?: boolean;
  quality?: boolean;
  plantPot?: boolean;
  joyTV?: boolean;
  noUnroofed?: boolean;
}

export interface RecipeDef {
  id: string;
  label: string;
  benches: string[];
  ings: { items?: string[]; cats?: string[]; count: number; nutrition?: number; label: string }[];
  products?: { item: string; count: number }[];
  special?: 'butcher' | 'stuffed' | 'smelt';
  stuffCats?: StuffCat[];
  stuffCount?: number;
  product?: string;
  work: number;
  skill: SkillId;
  minSkill?: number;
  research?: string;
  workType: WorkType;
}

export interface ResearchDef {
  id: string;
  label: string;
  desc: string;
  cost: number;
  prereqs: string[];
  tier: number;
  col: number;
  hiTech?: boolean;
}

export interface TraitDef {
  id: string;
  label: string;
  desc: string;
  conflicts?: string[];
  mood?: number;
  moveF?: number;
  workF?: number;
  breakF?: number;   // mental break threshold multiplier
  painF?: number;
  shootAcc?: number;
  meleeHit?: number;
  beauty?: number;
  learnF?: number;
  restF?: number;
  foodF?: number;
  disables?: WorkType[];
  tags?: string[];
  weight?: number;
}

export interface BackstoryDef {
  id: string;
  title: string;
  kind: 'child' | 'adult';
  desc: string;
  skills: Partial<Record<SkillId, number>>;
  disables?: WorkType[];
  tags?: string[];
}

export interface ThoughtDef {
  id: string;
  label: string;
  mood: number;
  days?: number;       // memory duration; situational if undefined
  stack?: number;      // stack limit
  stackF?: number;     // each extra stack multiplier
  social?: number;     // opinion offset (for social memories)
  desc?: string;
}

export interface AnimalDef {
  id: string;
  label: string;
  size: number;          // body size
  hp: number;
  speed: number;         // tiles per second at 1x
  meat: number;
  leather?: string;
  leatherCount?: number;
  wildness: number;      // 0..1 (taming difficulty)
  predator?: boolean;
  herd?: [number, number];
  diet: 'grazer' | 'omnivore' | 'carnivore';
  attacks: { label: string; damage: number; type: DamageType; cooldown: number }[];
  products?: { kind: 'milk' | 'wool' | 'eggs'; item: string; count: number; days: number }[];
  manhunterChance?: number;
  explodes?: boolean;
  commonality: number;
  minTemp?: number;
  maxTemp?: number;
  pack?: boolean;
  sprite: string;
  color: string;
  color2?: string;
  color3?: string;
  value: number;
  rare?: boolean;
  domestic?: boolean;
  flees?: boolean;
  nuzzles?: boolean;
  mech?: boolean;
  weapon?: string;
  armorSharp?: number;
  armorBlunt?: number;
  sightRange?: number;
  lifeDays?: number;
}

export interface IncidentDef {
  id: string;
  label: string;
  cat: 'threat_big' | 'threat_small' | 'good' | 'neutral' | 'weather' | 'bad';
  minDay: number;
  weight: number;
  global?: boolean;
}
