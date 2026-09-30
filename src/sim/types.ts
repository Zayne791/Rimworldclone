// Plain-data entity types. Everything here must be JSON-serializable so that
// saves and multiplayer replication are trivial. Fields starting with "_" are transient.
import type { SkillId, WorkType } from '../data/types';

export interface Item {
  id: number;
  kind: 'item';
  def: string;
  x: number;
  y: number;
  count: number;
  stuff?: string;
  quality?: number;
  hp: number;
  rot?: number;          // 0..1 rot progress (food)
  forbidden?: boolean;
  corpse?: Pawn;         // dead pawn data for corpses
  age?: number;          // ticks since spawn (corpses/items)
  desig?: string;
  tainted?: boolean;     // apparel worn by someone who died
  owner?: number;        // faction that currently "owns" it (stockpiled/dropped)
  color?: string;
}

export interface Bill {
  id: number;
  recipe: string;
  mode: 'count' | 'until' | 'forever';
  target: number;
  done: number;
  suspended: boolean;
  stuff?: string | null;   // chosen stuff for stuffed recipes (null = any)
  radius: number;
}

export interface Building {
  id: number;
  kind: 'building';
  def: string;
  x: number;
  y: number;
  rot: number;
  stuff?: string;
  hp: number;
  faction: number;
  quality?: number;
  on?: boolean;          // switched on (power consumers)
  powered?: boolean;     // currently receiving power / fueled & running
  stored?: number;       // battery energy Wd
  output?: number;       // generator current output W
  fuel?: number;
  bills?: Bill[];
  owners?: number[];     // bed owners
  medical?: boolean;
  prison?: boolean;
  open?: number;         // door open timer (ticks left)
  holdOpen?: boolean;
  aim?: number;          // turret angle
  cd?: number;           // turret cooldown
  warm?: number;
  burst?: number;
  target?: number;
  tgt?: number;          // heater/cooler target temp
  desig?: string;
  forbidden?: boolean;
  artName?: string;
  plant?: string;        // plant pot flower
  priority?: number;     // storage priority
  filter?: StorageFilter;
  graveCorpse?: Item | null;
  reactor?: { started: boolean; t: number };
  users?: number[];
  sparks?: number;
  armed?: boolean;
  prog?: number;         // producer / scanner progress 0..1
}

export interface Blueprint {
  id: number;
  kind: 'blueprint';
  def: string;           // building def id, or terrain id when floor
  floor?: boolean;
  x: number;
  y: number;
  rot: number;
  stuff?: string;
  faction: number;
  delivered: Record<string, number>;
  work: number;          // work progress done
  started?: boolean;     // became a frame
  forbidden?: boolean;
}

export interface Fire {
  id: number;
  kind: 'fire';
  x: number;
  y: number;
  size: number;          // 0.1 .. 1.75
  t: number;
}

export interface Projectile {
  id: number;
  kind: 'projectile';
  def: string;           // weapon def
  x: number; y: number;  // current position (float tiles)
  sx: number; sy: number;
  tx: number; ty: number; // destination (float tiles)
  speed: number;
  shooter: number;
  shooterFaction: number;
  target: number;        // intended target pawn/building id
  hit: boolean;          // pre-rolled: will hit target
  coverHit?: number;     // thing id of cover that will absorb
  damage: number;
  pen: number;
  dmgType: string;
  proj: string;
  explosive?: { radius: number; damage: number; fire?: boolean; emp?: boolean };
  ownerSkill?: number;
  quality?: number;
}

export type Thing = Item | Building | Blueprint | Fire | Projectile | Pawn;

export interface Hediff {
  type: 'injury' | 'missing' | 'bloodloss' | 'disease' | 'hypothermia' | 'heatstroke' | 'malnutrition' | 'food_poisoning' | 'toxic' | 'exhaustion' | 'scar';
  part?: string;
  kind?: string;          // injury damage kind / disease id
  sev: number;
  tended?: number;        // tend quality 0..1 (undefined = untended)
  tendT?: number;         // ticks until tend wears off
  imm?: number;           // immunity (disease)
  age?: number;
  perm?: boolean;
  src?: string;
}

export interface Thought { id: string; t: number; n?: number; o?: number }
export interface Skill { lvl: number; xp: number; passion: number }

export interface Job {
  type: string;
  t?: number;            // target thing A
  t2?: number;           // target thing B
  t3?: number;
  c?: number;            // target cell
  c2?: number;
  count?: number;
  s: number;             // step
  w: number;             // work progress / timer
  bill?: number;
  forced?: boolean;
  expire?: number;
  data?: any;
  label?: string;
}

export interface Relation { op: number; kind?: string }

export interface Pawn {
  id: number;
  kind: 'pawn';
  race: string;           // 'human' or animal def id
  faction: number;
  x: number; y: number;   // current cell
  nx: number; ny: number; // next cell (== x,y if not moving)
  mp: number;             // move progress 0..1
  path: number[] | null;
  pi: number;
  rot: number;            // 0 S, 1 E, 2 N, 3 W
  name: { first: string; last: string; nick: string };
  gender: 'm' | 'f';
  age: number;
  look: { skin: string; hair: string; hairColor: string; body: number; beard?: boolean; color: string };
  story?: { child: string; adult: string };
  traits: string[];
  skills: Record<SkillId, Skill>;
  work: Record<WorkType, number>;
  disabled: WorkType[];
  schedule: string;       // 24 chars: S sleep, W work, J joy, A anything
  needs: { food: number; rest: number; joy: number; mood: number; comfort: number; beauty: number };
  thoughts: Thought[];
  hediffs: Hediff[];
  downed: boolean;
  dead: boolean;
  equip: Item | null;
  apparel: Item[];
  carry: Item | null;
  inv: Item[];
  job: Job | null;
  queue: Job[];
  drafted: boolean;
  fireAtWill: boolean;
  mental: { kind: string; t: number; target?: number } | null;
  bed: number;
  rel: Record<number, Relation>;
  guest: { prisoner: boolean; resistance: number; mode: 'recruit' | 'hold' | 'release'; host: number; lastChat?: number } | null;
  animal?: { tamed: boolean; master: number; products: Record<string, number>; name?: string; manhunter?: number; bonded?: number; pen?: boolean };
  lord: number;
  cd: number;             // attack cooldown ticks
  warm: number;           // aim warmup ticks
  burst: number;
  target: number;
  aimX?: number; aimY?: number;
  lastSocial: number;
  bubble?: { icon: string; t: number };
  wet: number;
  kills: number;
  jobLabel?: string;
  breakT?: number;        // ticks under break threshold
  born: number;
  idleT?: number;
  inspired?: string;
  fleeing?: boolean;
  exitMap?: boolean;
  trader?: boolean;
  hostileTo?: number[];   // explicit hostility overrides
  lastHit?: number;
  lastSeenEnemy?: number;
  temp?: number;          // last computed ambient temp
  comfyT?: number;
  sleepT?: number;        // ticks asleep
  asleep?: boolean;
  onFire?: number;
  stun?: number;
  seed?: number;
  sit?: [string, number][];
  inspiredT?: number;
  wanderT?: number;
  desig?: string;
  carriedBy?: number;
  shield?: number;        // shield belt energy
  shieldT?: number;       // tick the shield last broke (recharge delay)
}

export interface StorageFilter {
  cats: string[];         // allowed item categories
  deny: string[];         // explicitly denied item defs
  allowRotten?: boolean;
}

export interface Zone {
  id: number;
  faction: number;
  kind: 'stockpile' | 'grow' | 'dump';
  name: string;
  cells: number[];
  priority: number;       // 1 low .. 5 critical
  filter: StorageFilter;
  plant: string;
  allowSow: boolean;
  color: string;
}

export interface Lord {
  id: number;
  faction: number;
  kind: 'assault' | 'trade' | 'visit' | 'manhunter' | 'siege' | 'flee' | 'mech';
  pawns: number[];
  target: number;         // targeted player faction
  stage: string;
  t: number;
  spot: [number, number];
  startCount: number;
  exitCell?: [number, number];
  stock?: Item[];         // trader goods
  traderName?: string;
  kidnapped?: number[];
}

export interface Letter {
  id: number;
  faction: number;        // recipient faction (0 = all players)
  title: string;
  text: string;
  kind: 'good' | 'bad' | 'threat' | 'neutral' | 'death' | 'info';
  tick: number;
  x?: number; y?: number;
  thing?: number;
  read?: boolean;
  choices?: { label: string; cmd: any }[];
  expires?: number;
}

export interface FxEvent {
  k: string;               // kind: shot, hit, text, sound, explosion, bubble, dust, spark, blood
  x: number; y: number;
  x2?: number; y2?: number;
  s?: string;              // text or sound id
  c?: string;              // color
  f?: number;              // faction (for targeted sounds/letters)
  id?: number;
}
