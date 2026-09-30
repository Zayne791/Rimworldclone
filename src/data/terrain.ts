import type { TerrainDef, RockDef } from './types';

// Index 0 is reserved/unused so that 0 can mean "none" in floor layers.
export const TERRAIN: TerrainDef[] = [
  { id: 'none', label: 'nothing', style: 'soil', colors: ['#000'], fert: 0, moveCost: 0, beauty: 0, canBuild: false },
  { id: 'soil', label: 'soil', style: 'soil', colors: ['#6b5436', '#5b4630', '#7d6440', '#8a7048'], fert: 1, moveCost: 2, beauty: 0, canBuild: true },
  { id: 'rich_soil', label: 'rich soil', style: 'soil', colors: ['#4f3b26', '#42301f', '#5c4630', '#6a5238'], fert: 1.4, moveCost: 2, beauty: 0, canBuild: true },
  { id: 'gravel', label: 'gravel', style: 'gravel', colors: ['#7c776f', '#66625b', '#938d84', '#a8a197'], fert: 0.7, moveCost: 2, beauty: 0, canBuild: true },
  { id: 'sand', label: 'sand', style: 'sand', colors: ['#cdb57f', '#b89f6c', '#dcc794', '#e8d7a8'], fert: 0.1, moveCost: 5, beauty: 0, canBuild: true },
  { id: 'marsh', label: 'marsh', style: 'marsh', colors: ['#4a5a3a', '#3c4a30', '#56693f', '#3f5a52'], fert: 0.8, moveCost: 14, beauty: -1, canBuild: false },
  { id: 'mud', label: 'mud', style: 'mud', colors: ['#4c3c2a', '#3e3022', '#5a4834', '#352a1e'], fert: 0.4, moveCost: 12, beauty: -1, canBuild: false },
  { id: 'shallow_water', label: 'shallow water', style: 'water', colors: ['#3f7fa8', '#356e94', '#5596be', '#7db4d6'], fert: 0, moveCost: 18, beauty: 0, water: 'shallow', canBuild: false, noFilth: true },
  { id: 'deep_water', label: 'deep water', style: 'deepwater', colors: ['#2a5680', '#224a70', '#34638f', '#4a7aa5'], fert: 0, moveCost: 0, beauty: 0, water: 'deep', canBuild: false, noFilth: true },
  { id: 'ice', label: 'ice', style: 'ice', colors: ['#b8d4e3', '#a3c3d6', '#cfe3ee', '#e6f2f8'], fert: 0, moveCost: 6, beauty: 0, canBuild: true },
  // rough stone floors under mined rock
  { id: 'rough_granite', label: 'rough granite', style: 'rough', colors: ['#6e6a68', '#5e5a58', '#7c7876', '#8a8684'], fert: 0, moveCost: 1, beauty: -1, canBuild: true },
  { id: 'rough_limestone', label: 'rough limestone', style: 'rough', colors: ['#a09a86', '#8e8876', '#b0aa96', '#bdb8a4'], fert: 0, moveCost: 1, beauty: -1, canBuild: true },
  { id: 'rough_marble', label: 'rough marble', style: 'rough', colors: ['#b8b6b0', '#a6a49e', '#c8c6c0', '#d6d4ce'], fert: 0, moveCost: 1, beauty: -1, canBuild: true },
  { id: 'rough_sandstone', label: 'rough sandstone', style: 'rough', colors: ['#a0765a', '#8e664c', '#b08468', '#be9276'], fert: 0, moveCost: 1, beauty: -1, canBuild: true },
  { id: 'rough_slate', label: 'rough slate', style: 'rough', colors: ['#4c4e54', '#404248', '#585a60', '#64666c'], fert: 0, moveCost: 1, beauty: -1, canBuild: true },
  // constructed floors
  { id: 'wood_floor', label: 'wood floor', style: 'wood', colors: ['#8a6038', '#74502e', '#9c7044', '#5f4126'], fert: 0, moveCost: 0, beauty: 1, floor: true, cost: { wood: 3 }, work: 85, canBuild: true, clean: 0 },
  { id: 'straw_matting', label: 'straw matting', style: 'straw', colors: ['#c2a45a', '#a88c48', '#d4b86c', '#8e7438'], fert: 0, moveCost: 0, beauty: 0, floor: true, cost: { hay: 4 }, work: 40, canBuild: true },
  { id: 'concrete', label: 'concrete', style: 'concrete', colors: ['#8c8c88', '#7c7c78', '#9c9c98', '#6c6c68'], fert: 0, moveCost: 0, beauty: 0, floor: true, cost: { steel: 1 }, work: 50, canBuild: true, research: 'masonry' },
  { id: 'granite_tile', label: 'granite tile', style: 'tile', colors: ['#77706c', '#625c58', '#8a8480', '#4e4846'], fert: 0, moveCost: 0, beauty: 1, floor: true, cost: { blocks_granite: 4 }, work: 400, canBuild: true, research: 'stonecutting' },
  { id: 'marble_tile', label: 'marble tile', style: 'tile', colors: ['#c4c2bc', '#aeaca6', '#d6d4ce', '#94928c'], fert: 0, moveCost: 0, beauty: 2, floor: true, cost: { blocks_marble: 4 }, work: 400, canBuild: true, research: 'stonecutting' },
  { id: 'sandstone_tile', label: 'sandstone tile', style: 'tile', colors: ['#aa8064', '#946e54', '#bc9276', '#7c5a44'], fert: 0, moveCost: 0, beauty: 1, floor: true, cost: { blocks_sandstone: 4 }, work: 400, canBuild: true, research: 'stonecutting' },
  { id: 'steel_tile', label: 'steel tile', style: 'metal', colors: ['#8f98a0', '#7a838b', '#a4adb5', '#646c74'], fert: 0, moveCost: 0, beauty: 1, floor: true, cost: { steel: 7 }, work: 500, canBuild: true, research: 'masonry', clean: 0.2 },
  { id: 'sterile_tile', label: 'sterile tile', style: 'sterile', colors: ['#dfe6ea', '#c8d0d6', '#eef3f6', '#a8b4bc'], fert: 0, moveCost: 0, beauty: 1, floor: true, cost: { steel: 3, silver: 12 }, work: 600, canBuild: true, research: 'sterile_materials', clean: 0.6 },
  { id: 'carpet_red', label: 'red carpet', style: 'carpet', colors: ['#8c2f36', '#74262c', '#a3404a', '#c25a62'], fert: 0, moveCost: 0, beauty: 2, floor: true, cost: { cloth: 7 }, work: 200, canBuild: true, research: 'complex_furniture' },
  { id: 'carpet_blue', label: 'blue carpet', style: 'carpet', colors: ['#2f4a8c', '#263d74', '#405ca3', '#5a78c2'], fert: 0, moveCost: 0, beauty: 2, floor: true, cost: { cloth: 7 }, work: 200, canBuild: true, research: 'complex_furniture' },
  { id: 'carpet_green', label: 'green carpet', style: 'carpet', colors: ['#2f6c42', '#265a36', '#408254', '#5a9c6c'], fert: 0, moveCost: 0, beauty: 2, floor: true, cost: { cloth: 7 }, work: 200, canBuild: true, research: 'complex_furniture' },
  { id: 'gold_tile', label: 'gold tile', style: 'gold', colors: ['#d8b040', '#b89030', '#ecc858', '#8c6c20'], fert: 0, moveCost: 0, beauty: 12, floor: true, cost: { gold: 40 }, work: 800, canBuild: true, research: 'stonecutting' },
  { id: 'smooth_granite', label: 'smooth granite', style: 'smooth', colors: ['#7a7572', '#686462', '#8a8684', '#56524f'], fert: 0, moveCost: 0, beauty: 2, canBuild: true, smooth: true },
  // research-tree floors (appended: terrain indices are saved in maps)
  { id: 'carpet_purple', label: 'purple carpet', style: 'carpet', colors: ['#5e3a82', '#4c2e6c', '#724a98', '#8e66b4'], fert: 0, moveCost: 0, beauty: 3, floor: true, cost: { cloth: 7 }, work: 200, canBuild: true, research: 'interior_design' },
  { id: 'carpet_gold', label: 'gold carpet', style: 'carpet', colors: ['#a07a2a', '#8a6822', '#b88e38', '#d4ac50'], fert: 0, moveCost: 0, beauty: 3, floor: true, cost: { cloth: 7 }, work: 200, canBuild: true, research: 'interior_design' },
  { id: 'fine_rug', label: 'fine rug', style: 'rug', colors: ['#7a1e2e', '#5e1622', '#9a3040', '#d8b060'], fert: 0, moveCost: 0, beauty: 6, floor: true, cost: { cloth: 12, gold: 1 }, work: 450, canBuild: true, research: 'luxury_living' },
  { id: 'silver_tile', label: 'silver tile', style: 'gold', colors: ['#c4ccd4', '#a8b0b8', '#dce2e8', '#8a929a'], fert: 0, moveCost: 0, beauty: 6, floor: true, cost: { silver: 70 }, work: 700, canBuild: true, research: 'luxury_living' },
  { id: 'plasteel_tile', label: 'plasteel tile', style: 'metal', colors: ['#7ec2bc', '#6aaaa4', '#98d8d2', '#56908a'], fert: 0, moveCost: 0, beauty: 2, floor: true, cost: { plasteel: 3 }, work: 250, canBuild: true, research: 'prefab', clean: 0.4 },
];

export const TERRAIN_INDEX: Record<string, number> = {};
TERRAIN.forEach((t, i) => (TERRAIN_INDEX[t.id] = i));
export const T = (id: string) => TERRAIN_INDEX[id];

// Natural mineable rock (tile layer, index 0 = none)
export const ROCKS: RockDef[] = [
  { id: 'none', label: 'none', color: '#000', dark: '#000', hp: 0, work: 0 },
  { id: 'granite', label: 'granite', color: '#6f6966', dark: '#4a4543', hp: 1800, work: 1200, chunk: 'chunk_granite', stone: 'rough_granite', smoothable: true },
  { id: 'limestone', label: 'limestone', color: '#a39c86', dark: '#766f5d', hp: 1550, work: 1100, chunk: 'chunk_limestone', stone: 'rough_limestone', smoothable: true },
  { id: 'marble', label: 'marble', color: '#bcb9b2', dark: '#8a8781', hp: 1200, work: 1000, chunk: 'chunk_marble', stone: 'rough_marble', smoothable: true },
  { id: 'sandstone', label: 'sandstone', color: '#a57a5c', dark: '#76553f', hp: 1400, work: 1000, chunk: 'chunk_sandstone', stone: 'rough_sandstone', smoothable: true },
  { id: 'slate', label: 'slate', color: '#4f5157', dark: '#34363b', hp: 1300, work: 1000, chunk: 'chunk_slate', stone: 'rough_slate', smoothable: true },
  { id: 'steel_ore', label: 'compacted steel', color: '#6f6966', dark: '#4a4543', speck: '#b0603a', hp: 1500, work: 1600, yieldItem: 'steel', yieldCount: 40, ore: true },
  { id: 'silver_ore', label: 'silver vein', color: '#6f6966', dark: '#4a4543', speck: '#dfe4ea', hp: 1500, work: 1600, yieldItem: 'silver', yieldCount: 40, ore: true },
  { id: 'gold_ore', label: 'gold vein', color: '#6f6966', dark: '#4a4543', speck: '#f2c83c', hp: 1500, work: 1600, yieldItem: 'gold', yieldCount: 35, ore: true },
  { id: 'plasteel_ore', label: 'plasteel vein', color: '#6f6966', dark: '#4a4543', speck: '#7fd6cf', hp: 2000, work: 2200, yieldItem: 'plasteel', yieldCount: 35, ore: true },
  { id: 'uranium_ore', label: 'uranium vein', color: '#6f6966', dark: '#4a4543', speck: '#6fe06a', hp: 2000, work: 2200, yieldItem: 'uranium', yieldCount: 30, ore: true },
  { id: 'jade_ore', label: 'jade vein', color: '#6f6966', dark: '#4a4543', speck: '#3fa86a', hp: 1500, work: 1800, yieldItem: 'jade', yieldCount: 30, ore: true },
  { id: 'machinery', label: 'compacted machinery', color: '#5b5d63', dark: '#3a3c40', speck: '#d9a441', hp: 1500, work: 1500, yieldItem: 'components', yieldCount: 3, ore: true },
];
export const ROCK_INDEX: Record<string, number> = {};
ROCKS.forEach((r, i) => (ROCK_INDEX[r.id] = i));
