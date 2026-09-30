// Body parts and hediff (health condition) definitions.

export interface PartDef {
  id: string;
  label: string;
  hp: number;
  coverage: number;         // chance weight to be hit directly
  parent?: string;
  internal?: boolean;       // only hit via parent
  vital?: boolean;          // destruction = death
  capacity?: { cap: Capacity; weight: number }[];
  group?: 'torso' | 'legs' | 'arms' | 'head';
}
export type Capacity = 'consciousness' | 'moving' | 'manipulation' | 'sight' | 'breathing' | 'bloodPumping';

export const HUMAN_BODY: PartDef[] = [
  { id: 'torso', label: 'torso', hp: 40, coverage: 0.3, vital: true, group: 'torso' },
  { id: 'heart', label: 'heart', hp: 15, coverage: 0.12, parent: 'torso', internal: true, vital: true, capacity: [{ cap: 'bloodPumping', weight: 1 }] },
  { id: 'lungs', label: 'lungs', hp: 20, coverage: 0.2, parent: 'torso', internal: true, vital: true, capacity: [{ cap: 'breathing', weight: 1 }] },
  { id: 'liver', label: 'liver', hp: 20, coverage: 0.12, parent: 'torso', internal: true, vital: true },
  { id: 'stomach', label: 'stomach', hp: 20, coverage: 0.12, parent: 'torso', internal: true },
  { id: 'head', label: 'head', hp: 25, coverage: 0.1, group: 'head', vital: true },
  { id: 'brain', label: 'brain', hp: 10, coverage: 0.3, parent: 'head', internal: true, vital: true, capacity: [{ cap: 'consciousness', weight: 1 }] },
  { id: 'eye_l', label: 'left eye', hp: 10, coverage: 0.1, parent: 'head', internal: true, capacity: [{ cap: 'sight', weight: 0.5 }] },
  { id: 'eye_r', label: 'right eye', hp: 10, coverage: 0.1, parent: 'head', internal: true, capacity: [{ cap: 'sight', weight: 0.5 }] },
  { id: 'arm_l', label: 'left arm', hp: 30, coverage: 0.11, group: 'arms', capacity: [{ cap: 'manipulation', weight: 0.35 }] },
  { id: 'hand_l', label: 'left hand', hp: 20, coverage: 0.04, parent: 'arm_l', group: 'arms', capacity: [{ cap: 'manipulation', weight: 0.15 }] },
  { id: 'arm_r', label: 'right arm', hp: 30, coverage: 0.11, group: 'arms', capacity: [{ cap: 'manipulation', weight: 0.35 }] },
  { id: 'hand_r', label: 'right hand', hp: 20, coverage: 0.04, parent: 'arm_r', group: 'arms', capacity: [{ cap: 'manipulation', weight: 0.15 }] },
  { id: 'leg_l', label: 'left leg', hp: 30, coverage: 0.12, group: 'legs', capacity: [{ cap: 'moving', weight: 0.4 }] },
  { id: 'foot_l', label: 'left foot', hp: 20, coverage: 0.04, parent: 'leg_l', group: 'legs', capacity: [{ cap: 'moving', weight: 0.1 }] },
  { id: 'leg_r', label: 'right leg', hp: 30, coverage: 0.12, group: 'legs', capacity: [{ cap: 'moving', weight: 0.4 }] },
  { id: 'foot_r', label: 'right foot', hp: 20, coverage: 0.04, parent: 'leg_r', group: 'legs', capacity: [{ cap: 'moving', weight: 0.1 }] },
];

export const ANIMAL_BODY: PartDef[] = [
  { id: 'torso', label: 'body', hp: 40, coverage: 0.45, vital: true, group: 'torso' },
  { id: 'heart', label: 'heart', hp: 15, coverage: 0.15, parent: 'torso', internal: true, vital: true, capacity: [{ cap: 'bloodPumping', weight: 1 }] },
  { id: 'lungs', label: 'lungs', hp: 20, coverage: 0.2, parent: 'torso', internal: true, vital: true, capacity: [{ cap: 'breathing', weight: 1 }] },
  { id: 'head', label: 'head', hp: 25, coverage: 0.15, vital: true, group: 'head' },
  { id: 'brain', label: 'brain', hp: 10, coverage: 0.3, parent: 'head', internal: true, vital: true, capacity: [{ cap: 'consciousness', weight: 1 }] },
  { id: 'eye_l', label: 'eye', hp: 10, coverage: 0.15, parent: 'head', internal: true, capacity: [{ cap: 'sight', weight: 1 }] },
  { id: 'leg_fl', label: 'front left leg', hp: 25, coverage: 0.1, group: 'legs', capacity: [{ cap: 'moving', weight: 0.25 }, { cap: 'manipulation', weight: 0.5 }] },
  { id: 'leg_fr', label: 'front right leg', hp: 25, coverage: 0.1, group: 'legs', capacity: [{ cap: 'moving', weight: 0.25 }, { cap: 'manipulation', weight: 0.5 }] },
  { id: 'leg_bl', label: 'rear left leg', hp: 25, coverage: 0.1, group: 'legs', capacity: [{ cap: 'moving', weight: 0.25 }] },
  { id: 'leg_br', label: 'rear right leg', hp: 25, coverage: 0.1, group: 'legs', capacity: [{ cap: 'moving', weight: 0.25 }] },
];

export const MECH_BODY: PartDef[] = [
  { id: 'torso', label: 'body', hp: 60, coverage: 0.5, vital: true, group: 'torso' },
  { id: 'reactor', label: 'reactor', hp: 25, coverage: 0.2, parent: 'torso', internal: true, vital: true, capacity: [{ cap: 'bloodPumping', weight: 1 }] },
  { id: 'head', label: 'sensor head', hp: 30, coverage: 0.15, vital: true, group: 'head' },
  { id: 'brain', label: 'AI core', hp: 15, coverage: 0.3, parent: 'head', internal: true, vital: true, capacity: [{ cap: 'consciousness', weight: 1 }] },
  { id: 'sensor', label: 'sight sensor', hp: 10, coverage: 0.2, parent: 'head', internal: true, capacity: [{ cap: 'sight', weight: 1 }] },
  { id: 'leg_l', label: 'left leg', hp: 35, coverage: 0.15, group: 'legs', capacity: [{ cap: 'moving', weight: 0.5 }, { cap: 'manipulation', weight: 0.5 }] },
  { id: 'leg_r', label: 'right leg', hp: 35, coverage: 0.15, group: 'legs', capacity: [{ cap: 'moving', weight: 0.5 }, { cap: 'manipulation', weight: 0.5 }] },
];

export const INJURY_LABELS: Record<string, [string, string]> = {
  cut: ['cut', 'cut scar'], stab: ['stab wound', 'stab scar'], bullet: ['gunshot', 'gunshot scar'], bite: ['bite', 'bite scar'],
  scratch: ['scratch', 'scratch scar'], blunt: ['bruise', 'crack scar'], sharp: ['cut', 'cut scar'], burn: ['burn', 'burn scar'],
  frost: ['frostbite', 'frostbite scar'], bomb: ['shrapnel wound', 'shrapnel scar'], crush: ['crush wound', 'crush scar'],
};
export const BLEED_RATE: Record<string, number> = { cut: 0.06, stab: 0.06, bullet: 0.06, bite: 0.05, scratch: 0.04, blunt: 0, sharp: 0.06, burn: 0, frost: 0, bomb: 0.06, crush: 0.01 };
export const PAIN_PER_HP: Record<string, number> = { cut: 0.0125, stab: 0.0125, bullet: 0.0125, bite: 0.0125, scratch: 0.0125, blunt: 0.0125, sharp: 0.0125, burn: 0.01875, frost: 0.0125, bomb: 0.0125, crush: 0.0125 };
export const INFECTION_CHANCE: Record<string, number> = { cut: 0.15, stab: 0.15, bullet: 0.15, bite: 0.3, scratch: 0.15, blunt: 0, sharp: 0.15, burn: 0.3, frost: 0, bomb: 0.15, crush: 0.1 };

export interface DiseaseDef { id: string; label: string; sevPerDay: number; sevPerDayTended: number; immPerDay: number; lethal: boolean; pain?: number; cap?: Partial<Record<Capacity, number>> }
export const DISEASES: Record<string, DiseaseDef> = {
  infection: { id: 'infection', label: 'infection', sevPerDay: 0.84, sevPerDayTended: 0.4, immPerDay: 0.6, lethal: true, pain: 0.2, cap: { consciousness: -0.1 } },
  flu: { id: 'flu', label: 'flu', sevPerDay: 0.25, sevPerDayTended: 0.1, immPerDay: 0.24, lethal: true, pain: 0.05, cap: { consciousness: -0.1, manipulation: -0.1, breathing: -0.1 } },
  plague: { id: 'plague', label: 'plague', sevPerDay: 0.67, sevPerDayTended: 0.35, immPerDay: 0.34, lethal: true, pain: 0.2, cap: { consciousness: -0.15, manipulation: -0.1, breathing: -0.1 } },
  malaria: { id: 'malaria', label: 'malaria', sevPerDay: 0.37, sevPerDayTended: 0.15, immPerDay: 0.32, lethal: true, pain: 0.1, cap: { consciousness: -0.15, manipulation: -0.2 } },
};
