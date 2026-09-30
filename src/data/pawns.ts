import type { BackstoryDef, SkillId, TraitDef, WorkType, ThoughtDef } from './types';

export const SKILLS: { id: SkillId; label: string }[] = [
  { id: 'shooting', label: 'Shooting' }, { id: 'melee', label: 'Melee' }, { id: 'construction', label: 'Construction' },
  { id: 'mining', label: 'Mining' }, { id: 'cooking', label: 'Cooking' }, { id: 'plants', label: 'Plants' },
  { id: 'animals', label: 'Animals' }, { id: 'crafting', label: 'Crafting' }, { id: 'artistic', label: 'Artistic' },
  { id: 'medical', label: 'Medical' }, { id: 'social', label: 'Social' }, { id: 'intellectual', label: 'Intellectual' },
];

export const WORK_TYPES: { id: WorkType; label: string; short: string; skills: SkillId[]; hidden?: boolean; violent?: boolean; desc: string }[] = [
  { id: 'firefight', label: 'Firefight', short: 'Fire', skills: [], desc: 'Put out fires in the home area.' },
  { id: 'patient', label: 'Patient', short: 'Pat', skills: [], hidden: true, desc: 'Seek medical treatment.' },
  { id: 'doctor', label: 'Doctor', short: 'Doc', skills: ['medical'], desc: 'Tend wounds, rescue the downed, feed patients.' },
  { id: 'bedrest', label: 'Bed rest', short: 'Rest', skills: [], hidden: true, desc: 'Rest in bed while injured.' },
  { id: 'warden', label: 'Warden', short: 'Ward', skills: ['social'], desc: 'Feed and recruit prisoners.' },
  { id: 'handle', label: 'Handle', short: 'Hndl', skills: ['animals'], desc: 'Tame, milk, shear and slaughter animals.' },
  { id: 'cook', label: 'Cook', short: 'Cook', skills: ['cooking'], desc: 'Cook meals and butcher corpses.' },
  { id: 'hunt', label: 'Hunt', short: 'Hunt', skills: ['shooting'], violent: true, desc: 'Hunt designated animals.' },
  { id: 'construct', label: 'Construct', short: 'Cons', skills: ['construction'], desc: 'Build, repair, deconstruct and roof.' },
  { id: 'grow', label: 'Grow', short: 'Grow', skills: ['plants'], desc: 'Sow and harvest crops in growing zones.' },
  { id: 'mine', label: 'Mine', short: 'Mine', skills: ['mining'], desc: 'Dig out designated rock.' },
  { id: 'plantcut', label: 'Plant cut', short: 'Cut', skills: ['plants'], desc: 'Chop trees and cut designated plants.' },
  { id: 'smith', label: 'Smith', short: 'Smth', skills: ['crafting'], desc: 'Make weapons at smithies and machining tables.' },
  { id: 'tailor', label: 'Tailor', short: 'Tail', skills: ['crafting'], desc: 'Make clothing and armor.' },
  { id: 'art', label: 'Art', short: 'Art', skills: ['artistic'], desc: 'Create sculptures.' },
  { id: 'craft', label: 'Craft', short: 'Crft', skills: ['crafting'], desc: 'Stonecutting, components, medicine and more.' },
  { id: 'haul', label: 'Haul', short: 'Haul', skills: [], desc: 'Carry items to stockpiles and refuel things.' },
  { id: 'clean', label: 'Clean', short: 'Cln', skills: [], desc: 'Clean filth in the home area.' },
  { id: 'research', label: 'Research', short: 'Rsch', skills: ['intellectual'], desc: 'Research new technology.' },
];
export const VISIBLE_WORK = WORK_TYPES.filter(w => !w.hidden);

export const TRAITS: Record<string, TraitDef> = {};
function t(d: TraitDef) { TRAITS[d.id] = d; }
t({ id: 'industrious', label: 'Industrious', desc: 'Works 35% faster.', workF: 1.35, conflicts: ['hard_worker', 'lazy', 'slothful'], weight: 0.6 });
t({ id: 'hard_worker', label: 'Hard worker', desc: 'Works 20% faster.', workF: 1.2, conflicts: ['industrious', 'lazy', 'slothful'] });
t({ id: 'lazy', label: 'Lazy', desc: 'Works 20% slower.', workF: 0.8, conflicts: ['industrious', 'hard_worker', 'slothful'] });
t({ id: 'slothful', label: 'Slothful', desc: 'Works 35% slower.', workF: 0.65, conflicts: ['industrious', 'hard_worker', 'lazy'], weight: 0.5 });
t({ id: 'sanguine', label: 'Sanguine', desc: 'Always cheerful. +12 mood.', mood: 12, conflicts: ['optimist', 'pessimist', 'depressive'], weight: 0.5 });
t({ id: 'optimist', label: 'Optimist', desc: '+6 mood.', mood: 6, conflicts: ['sanguine', 'pessimist', 'depressive'] });
t({ id: 'pessimist', label: 'Pessimist', desc: '-6 mood.', mood: -6, conflicts: ['sanguine', 'optimist', 'depressive'] });
t({ id: 'depressive', label: 'Depressive', desc: '-12 mood.', mood: -12, conflicts: ['sanguine', 'optimist', 'pessimist'], weight: 0.5 });
t({ id: 'iron_willed', label: 'Iron-willed', desc: 'Much less likely to have mental breaks.', breakF: 0.6, conflicts: ['steadfast', 'nervous', 'volatile'], weight: 0.6 });
t({ id: 'steadfast', label: 'Steadfast', desc: 'Less likely to have mental breaks.', breakF: 0.8, conflicts: ['iron_willed', 'nervous', 'volatile'] });
t({ id: 'nervous', label: 'Nervous', desc: 'More likely to have mental breaks.', breakF: 1.2, conflicts: ['iron_willed', 'steadfast', 'volatile'] });
t({ id: 'volatile', label: 'Volatile', desc: 'Much more likely to have mental breaks.', breakF: 1.4, conflicts: ['iron_willed', 'steadfast', 'nervous'], weight: 0.6 });
t({ id: 'jogger', label: 'Jogger', desc: 'Moves 20% faster.', moveF: 1.2, conflicts: ['fast_walker', 'slowpoke'] });
t({ id: 'fast_walker', label: 'Fast walker', desc: 'Moves 10% faster.', moveF: 1.1, conflicts: ['jogger', 'slowpoke'] });
t({ id: 'slowpoke', label: 'Slowpoke', desc: 'Moves 20% slower.', moveF: 0.8, conflicts: ['jogger', 'fast_walker'] });
t({ id: 'tough', label: 'Tough', desc: 'Takes half damage.', tags: ['tough'], conflicts: ['wimp'], weight: 0.6 });
t({ id: 'wimp', label: 'Wimp', desc: 'Goes down from minor pain.', painF: 0.5, conflicts: ['tough'], weight: 0.5 });
t({ id: 'careful_shooter', label: 'Careful shooter', desc: 'Aims longer, hits more often.', shootAcc: 1.25, tags: ['careful'], conflicts: ['trigger_happy'] });
t({ id: 'trigger_happy', label: 'Trigger-happy', desc: 'Shoots quickly but inaccurately.', shootAcc: 0.8, tags: ['trigger'], conflicts: ['careful_shooter'] });
t({ id: 'brawler', label: 'Brawler', desc: 'Loves melee. Hates wielding guns.', meleeHit: 1.25, tags: ['brawler'] });
t({ id: 'kind', label: 'Kind', desc: 'Never insults others; often compliments.', tags: ['kind'], conflicts: ['abrasive', 'psychopath'] });
t({ id: 'abrasive', label: 'Abrasive', desc: 'Often insults people.', tags: ['abrasive'], conflicts: ['kind'] });
t({ id: 'psychopath', label: 'Psychopath', desc: 'Feels no empathy. Unbothered by death.', tags: ['psychopath'], conflicts: ['kind'], weight: 0.5 });
t({ id: 'bloodlust', label: 'Bloodlust', desc: 'Enjoys violence and gore.', tags: ['bloodlust'], weight: 0.5 });
t({ id: 'night_owl', label: 'Night owl', desc: 'Prefers to work at night.', tags: ['nightowl'] });
t({ id: 'greedy', label: 'Greedy', desc: 'Wants an impressive bedroom.', tags: ['greedy'], conflicts: ['ascetic'] });
t({ id: 'ascetic', label: 'Ascetic', desc: 'Happy in spartan conditions.', tags: ['ascetic'], conflicts: ['greedy'] });
t({ id: 'gourmand', label: 'Gourmand', desc: 'Loves food. Gets hungry faster.', foodF: 1.5, tags: ['gourmand'] });
t({ id: 'pyromaniac', label: 'Pyromaniac', desc: 'Loves fire. Occasionally starts some. Refuses to firefight.', disables: ['firefight'], tags: ['pyro'], weight: 0.4 });
t({ id: 'beautiful', label: 'Beautiful', desc: 'Others like them more.', beauty: 2, conflicts: ['pretty', 'ugly'], weight: 0.4 });
t({ id: 'pretty', label: 'Pretty', desc: 'Others like them a bit more.', beauty: 1, conflicts: ['beautiful', 'ugly'] });
t({ id: 'ugly', label: 'Ugly', desc: 'Others like them less.', beauty: -1, conflicts: ['beautiful', 'pretty'] });
t({ id: 'too_smart', label: 'Too smart', desc: 'Learns 75% faster but is less stable.', learnF: 1.75, breakF: 1.1, weight: 0.5 });
t({ id: 'great_memory', label: 'Great memory', desc: 'Skills decay slower.', learnF: 1.1 });
t({ id: 'nimble', label: 'Nimble', desc: 'Dodges melee attacks well.', tags: ['nimble'] });
t({ id: 'undergrounder', label: 'Undergrounder', desc: "Doesn't mind being indoors or underground.", tags: ['undergrounder'] });

export const BACKSTORIES: BackstoryDef[] = [
  // childhoods
  { id: 'c_farmkid', kind: 'child', title: 'Farm kid', desc: 'Raised on a family homestead, planting and harvesting from sunup to sundown.', skills: { plants: 3, animals: 2, construction: 1 } },
  { id: 'c_vatgrown', kind: 'child', title: 'Vat-grown soldier', desc: 'Engineered and trained for combat from birth.', skills: { shooting: 4, melee: 3 }, disables: ['art'] },
  { id: 'c_streetrat', kind: 'child', title: 'Street urchin', desc: 'Survived the alleys of a sprawling hive city by wits and quick hands.', skills: { melee: 2, social: 2, crafting: 1 } },
  { id: 'c_bookworm', kind: 'child', title: 'Bookworm', desc: 'Spent every waking hour in the archives, devouring texts.', skills: { intellectual: 4, medical: 1 }, disables: ['mine'] },
  { id: 'c_tinker', kind: 'child', title: 'Junkyard tinker', desc: 'Took apart every machine they found and usually got it back together.', skills: { crafting: 3, construction: 2 } },
  { id: 'c_noble', kind: 'child', title: 'Pampered noble', desc: 'Grew up with servants and never lifted a finger.', skills: { social: 4, artistic: 2 }, disables: ['haul', 'clean'] },
  { id: 'c_huntkid', kind: 'child', title: 'Tribal hunter', desc: 'Learned to track and hunt with the elders of the tribe.', skills: { shooting: 3, animals: 2, plants: 1 } },
  { id: 'c_shipborn', kind: 'child', title: 'Ship-born', desc: 'Raised in the corridors of a generation ship, far from any planet.', skills: { construction: 2, intellectual: 2, crafting: 1 } },
  { id: 'c_cookhelper', kind: 'child', title: "Cook's helper", desc: 'Scrubbed pots and learned recipes in a busy tavern kitchen.', skills: { cooking: 4, social: 1 } },
  { id: 'c_minerkid', kind: 'child', title: 'Mining colony kid', desc: 'Grew up in the tunnels of an asteroid mining outpost.', skills: { mining: 4, construction: 1 } },
  { id: 'c_artist', kind: 'child', title: 'Child prodigy', desc: 'Painted masterpieces before they could properly read.', skills: { artistic: 5 } },
  { id: 'c_medic', kind: 'child', title: "Medic's apprentice", desc: 'Followed a field surgeon from battle to battle.', skills: { medical: 4, social: 1 } },
  // adulthoods
  { id: 'a_soldier', kind: 'adult', title: 'Mercenary', desc: 'Sold their gun to whoever paid most across a dozen worlds.', skills: { shooting: 5, melee: 4 }, disables: ['art'] },
  { id: 'a_engineer', kind: 'adult', title: 'Starship engineer', desc: 'Kept the reactors of an interstellar freighter humming.', skills: { construction: 5, crafting: 4, intellectual: 2 } },
  { id: 'a_farmer', kind: 'adult', title: 'Agri-world farmer', desc: 'Managed thousands of acres of automated crops, and plenty by hand.', skills: { plants: 6, animals: 3, cooking: 1 } },
  { id: 'a_doctor', kind: 'adult', title: 'Emergency physician', desc: 'Saved lives in the understaffed hospitals of a frontier world.', skills: { medical: 7, intellectual: 3 }, disables: ['hunt'] },
  { id: 'a_chef', kind: 'adult', title: 'Starliner chef', desc: 'Cooked for the elite on luxury cruise vessels.', skills: { cooking: 7, social: 2, plants: 1 } },
  { id: 'a_scientist', kind: 'adult', title: 'Research scientist', desc: 'Pushed the frontiers of xenobiology in orbital labs.', skills: { intellectual: 7, medical: 2 }, disables: ['mine', 'hunt'] },
  { id: 'a_miner', kind: 'adult', title: 'Asteroid miner', desc: 'Cracked rocks in zero-g for a mining conglomerate.', skills: { mining: 7, construction: 2, shooting: 1 } },
  { id: 'a_trader', kind: 'adult', title: 'Merchant', desc: 'Haggled across the spaceways for profit and adventure.', skills: { social: 7, intellectual: 1 }, disables: ['clean'] },
  { id: 'a_builder', kind: 'adult', title: 'Colony builder', desc: 'Raised prefab settlements on newly terraformed worlds.', skills: { construction: 7, mining: 2 } },
  { id: 'a_hunter', kind: 'adult', title: 'Big game hunter', desc: 'Stalked exotic beasts for wealthy clients.', skills: { shooting: 6, animals: 4 } },
  { id: 'a_artisan', kind: 'adult', title: 'Artisan', desc: 'Handcrafted fine goods sold in upscale boutiques.', skills: { crafting: 6, artistic: 4 } },
  { id: 'a_rancher', kind: 'adult', title: 'Rancher', desc: 'Drove herds of muffalo across open plains.', skills: { animals: 7, plants: 2, shooting: 1 } },
  { id: 'a_pirate', kind: 'adult', title: 'Reformed pirate', desc: 'Raided shipping lanes before a change of heart. Mostly.', skills: { shooting: 4, melee: 4, social: 1 }, disables: ['doctor'] },
  { id: 'a_bureaucrat', kind: 'adult', title: 'Imperial bureaucrat', desc: 'Shuffled forms in an endless administrative tower.', skills: { social: 4, intellectual: 4 }, disables: ['mine', 'construct'] },
  { id: 'a_sculptor', kind: 'adult', title: 'Sculptor', desc: 'Created monumental statues for planetary governors.', skills: { artistic: 7, construction: 2, crafting: 1 } },
  { id: 'a_drifter', kind: 'adult', title: 'Drifter', desc: 'Wandered from job to job, picking up a bit of everything.', skills: { construction: 2, plants: 2, cooking: 2, crafting: 2, mining: 2 } },
  { id: 'a_gladiator', kind: 'adult', title: 'Pit fighter', desc: 'Fought for crowds in underground arenas.', skills: { melee: 7, social: 1 }, disables: ['doctor', 'research'] },
  { id: 'a_mechanic', kind: 'adult', title: 'Mech technician', desc: 'Repaired and reprogrammed war machines.', skills: { crafting: 5, intellectual: 3, construction: 2 } },
];

export const FIRST_NAMES_M = ['Arlo', 'Bram', 'Cassius', 'Dmitri', 'Eli', 'Finn', 'Gideon', 'Hugo', 'Ivan', 'Jasper', 'Kofi', 'Leon', 'Marek', 'Nico', 'Otto', 'Pax', 'Quill', 'Rafe', 'Silas', 'Theo', 'Ulric', 'Viktor', 'Wes', 'Xander', 'Yusuf', 'Zeke', 'Anders', 'Bastian', 'Cyrus', 'Dario', 'Emil', 'Felix', 'Hiro', 'Idris', 'Juno', 'Kai', 'Lars', 'Mateo', 'Nash', 'Orin', 'Rowan', 'Soren', 'Tobin', 'Vance'];
export const FIRST_NAMES_F = ['Ada', 'Bea', 'Cora', 'Dahlia', 'Eira', 'Freya', 'Gwen', 'Hana', 'Iris', 'Jade', 'Kira', 'Lena', 'Mira', 'Nadia', 'Opal', 'Petra', 'Quinn', 'Rhea', 'Sable', 'Tessa', 'Uma', 'Vera', 'Wren', 'Xyla', 'Yara', 'Zora', 'Astrid', 'Briar', 'Celeste', 'Delphine', 'Elsa', 'Fern', 'Greta', 'Ingrid', 'Juniper', 'Kaya', 'Lyra', 'Maeve', 'Nova', 'Olive', 'Ruby', 'Saoirse', 'Talia', 'Vesper'];
export const LAST_NAMES = ['Ashford', 'Blackwood', 'Castellan', 'Drake', 'Everhart', 'Frost', 'Grimaldi', 'Hawthorne', 'Ironside', 'Jansen', 'Kestrel', 'Lindqvist', 'Morrow', 'Novak', 'Okafor', 'Petrov', 'Quintero', 'Ravenscroft', 'Stroud', 'Tanaka', 'Umber', 'Vasquez', 'Whitlock', 'Xu', 'Yilmaz', 'Zeller', 'Abara', 'Brightwater', 'Cole', 'Dunmore', 'Echols', 'Fairweather', 'Goss', 'Holloway', 'Iyer', 'Kovacs', 'Larkspur', 'Mendez', 'Nakamura', 'Orlov', 'Pike', 'Reyes', 'Sato', 'Thorne', 'Varga', 'Wilder'];
export const NICKNAMES = ['Ace', 'Bolt', 'Buzz', 'Chip', 'Doc', 'Dusty', 'Fang', 'Ghost', 'Gizmo', 'Hawk', 'Jinx', 'Lucky', 'Moose', 'Nails', 'Pip', 'Rook', 'Rusty', 'Scout', 'Sparks', 'Spike', 'Tank', 'Trip', 'Viper', 'Whisper', 'Zip'];
export const RAIDER_TITLES = ['Raider', 'Marauder', 'Gunner', 'Thug', 'Brute', 'Scavenger', 'Cutthroat', 'Sniper', 'Grenadier'];

export const SKIN_TONES = ['#f3d7c4', '#e8c0a0', '#d9a57e', '#c58a60', '#a86c48', '#8a5438', '#6a3e2a', '#4c2c1e'];
export const HAIR_COLORS = ['#2a1e16', '#4a3020', '#6a4428', '#8e5a30', '#b07840', '#d4a860', '#e8d090', '#9c3e20', '#c0c0c0', '#f0f0e8', '#3a3a44', '#6a2a1a'];
export const HAIR_STYLES = ['short', 'buzz', 'long', 'bob', 'mohawk', 'bun', 'spiky', 'bald', 'ponytail', 'curly'];
export const APPAREL_COLORS = ['#5a6a8c', '#8c5a5a', '#5a8c6a', '#8c7a5a', '#6a5a8c', '#4a4a52', '#a0907a', '#7a8c96', '#96805a', '#6c4a3a'];

// Thoughts
export const THOUGHTS: Record<string, ThoughtDef> = {};
function th(d: ThoughtDef) { THOUGHTS[d.id] = d; }
// memories
th({ id: 'ate_raw', label: 'Ate raw food', mood: -7, days: 0.5 });
th({ id: 'ate_raw_meat', label: 'Ate raw meat', mood: -10, days: 0.5 });
th({ id: 'ate_fine_meal', label: 'Ate a fine meal', mood: 5, days: 0.5 });
th({ id: 'ate_lavish_meal', label: 'Ate a lavish meal', mood: 12, days: 0.5 });
th({ id: 'ate_paste', label: 'Ate nutrient paste', mood: -4, days: 0.5 });
th({ id: 'drank_beer', label: 'Had a beer', mood: 4, days: 0.3 });
th({ id: 'ate_without_table', label: 'Ate without a table', mood: -3, days: 0.5 });
th({ id: 'slept_on_ground', label: 'Slept on the ground', mood: -4, days: 0.5 });
th({ id: 'slept_outside', label: 'Slept outside', mood: -4, days: 0.5 });
th({ id: 'slept_in_cold', label: 'Slept in the cold', mood: -3, days: 0.5 });
th({ id: 'slept_in_heat', label: 'Slept in the heat', mood: -3, days: 0.5 });
th({ id: 'slept_in_barracks', label: 'Slept in barracks', mood: -3, days: 0.5 });
th({ id: 'impressive_bedroom', label: 'Slept in an impressive bedroom', mood: 4, days: 0.5 });
th({ id: 'awful_bedroom', label: 'Slept in an awful bedroom', mood: -4, days: 0.5 });
th({ id: 'ate_impressive_dining', label: 'Ate in an impressive dining room', mood: 4, days: 0.5 });
th({ id: 'colonist_died', label: 'Colonist died', mood: -5, days: 6, stack: 5, stackF: 0.75 });
th({ id: 'friend_died', label: 'My friend died', mood: -15, days: 20, stack: 5 });
th({ id: 'lover_died', label: 'My lover died', mood: -25, days: 30, stack: 1 });
th({ id: 'bonded_animal_died', label: 'My bonded animal died', mood: -10, days: 10, stack: 3 });
th({ id: 'observed_corpse', label: 'Observed a corpse', mood: -4, days: 0.5, stack: 3, stackF: 0.5 });
th({ id: 'observed_rotting_corpse', label: 'Observed a rotting corpse', mood: -6, days: 0.5, stack: 3, stackF: 0.5 });
th({ id: 'killed_enemy', label: 'Killed an enemy', mood: 3, days: 1, stack: 3 });
th({ id: 'bloodlust_killed', label: 'Killed someone (bloodlust)', mood: 8, days: 1, stack: 3 });
th({ id: 'soaked', label: 'Soaking wet', mood: -3, days: 0.1 });
th({ id: 'nice_chat', label: 'Had a nice chat', mood: 2, days: 0.5, stack: 5, social: 5 });
th({ id: 'deep_talk', label: 'Had a deep talk', mood: 4, days: 1, stack: 3, social: 12 });
th({ id: 'insulted', label: 'Was insulted', mood: -5, days: 1, stack: 5, social: -15 });
th({ id: 'rebuffed', label: 'Romance rebuffed', mood: -8, days: 3, social: -10 });
th({ id: 'got_together', label: 'Got together with a lover', mood: 15, days: 5 });
th({ id: 'broke_up', label: 'Broke up', mood: -12, days: 10, social: -30 });
th({ id: 'catharsis', label: 'Catharsis', mood: 30, days: 2.5 });
th({ id: 'harmed_in_fight', label: 'Lost a social fight', mood: -5, days: 2, social: -20 });
th({ id: 'new_colonist', label: 'Welcomed a new colonist', mood: 3, days: 1, stack: 3 });
th({ id: 'rescued', label: 'Was rescued', mood: 5, days: 3, social: 10 });
th({ id: 'tended', label: 'Wounds tended', mood: 2, days: 1 });
th({ id: 'sold_prisoner', label: 'Colony sold a prisoner', mood: -3, days: 5 });
th({ id: 'released_prisoner', label: 'Colony was merciful', mood: 2, days: 2 });
th({ id: 'executed_prisoner', label: 'Colony executed a prisoner', mood: -5, days: 6 });
th({ id: 'new_research', label: 'Made a breakthrough', mood: 3, days: 1 });
th({ id: 'beautiful_sculpture', label: 'Created a masterpiece', mood: 8, days: 3 });
th({ id: 'hopeful_launch', label: 'Hope of escape', mood: 10, days: 3 });
th({ id: 'psychic_soothe', label: 'Psychic soothe', mood: 12, days: 1 });
th({ id: 'psychic_drone', label: 'Psychic drone', mood: -15, days: 1 });
th({ id: 'minor_break', label: 'Had a meltdown', mood: 0, days: 1 });
// situational (computed each update)
th({ id: 'hungry', label: 'Hungry', mood: -6 });
th({ id: 'ravenous', label: 'Ravenous', mood: -12 });
th({ id: 'malnourished', label: 'Malnourished', mood: -20 });
th({ id: 'tired', label: 'Tired', mood: -4 });
th({ id: 'exhausted', label: 'Exhausted', mood: -10 });
th({ id: 'joy_low', label: 'Recreation-starved', mood: -10 });
th({ id: 'joy_some', label: 'Needs recreation', mood: -4 });
th({ id: 'joy_high', label: 'Recreation satisfied', mood: 5 });
th({ id: 'pain_minor', label: 'Minor pain', mood: -5 });
th({ id: 'pain_serious', label: 'Serious pain', mood: -10 });
th({ id: 'pain_extreme', label: 'Extreme pain', mood: -20 });
th({ id: 'ugly_env', label: 'Ugly environment', mood: -6 });
th({ id: 'pretty_env', label: 'Pretty environment', mood: 4 });
th({ id: 'beautiful_env', label: 'Beautiful environment', mood: 8 });
th({ id: 'in_darkness', label: 'In darkness', mood: -5 });
th({ id: 'cold', label: 'Cold', mood: -5 });
th({ id: 'hot', label: 'Hot', mood: -5 });
th({ id: 'naked', label: 'Naked', mood: -6 });
th({ id: 'no_bed', label: 'No bed of my own', mood: -3 });
th({ id: 'expect_extreme_low', label: 'Extremely low expectations', mood: 25 });
th({ id: 'expect_very_low', label: 'Very low expectations', mood: 18 });
th({ id: 'expect_low', label: 'Low expectations', mood: 12 });
th({ id: 'expect_moderate', label: 'Moderate expectations', mood: 6 });
th({ id: 'expect_high', label: 'High expectations', mood: 0 });
th({ id: 'trait_mood', label: 'Disposition', mood: 0 });
th({ id: 'comfy', label: 'Comfortable', mood: 3 });
th({ id: 'uncomfortable', label: 'Uncomfortable', mood: -3 });
th({ id: 'cramped', label: 'Cramped interior', mood: -4 });
th({ id: 'prisoner', label: 'Imprisoned', mood: -5 });
th({ id: 'greedy_no_room', label: 'Greedy: wants a better room', mood: -6 });
th({ id: 'ascetic_ok', label: 'Ascetic contentment', mood: 3 });
th({ id: 'shared_bed_lover', label: 'Sleeping with my lover', mood: 5 });
th({ id: 'want_lover_bed', label: 'Want to sleep with my lover', mood: -6 });
th({ id: 'pyro_fire', label: 'Pyromaniac: enjoyed a fire', mood: 5, days: 1 });
th({ id: 'toxic', label: 'Toxic buildup', mood: -8 });
th({ id: 'cabin_fever', label: 'Cabin fever', mood: -6 });
th({ id: 'ship_countdown', label: 'Waiting for launch', mood: 5 });
th({ id: 'wearing_tattered', label: 'Tattered apparel', mood: -3 });
th({ id: 'eclipse_gloom', label: 'Eclipse gloom', mood: -3 });
th({ id: 'aurora', label: 'Saw an aurora', mood: 6 });

export const MENTAL_BREAKS = {
  minor: [
    { id: 'sad_wander', label: 'Sad wandering', desc: 'is wandering around sadly.' },
    { id: 'food_binge', label: 'Food binge', desc: 'is binge eating.' },
    { id: 'hide_room', label: 'Hiding in room', desc: 'is hiding in their room.' },
  ],
  major: [
    { id: 'tantrum', label: 'Tantrum', desc: 'is throwing a tantrum, smashing things!' },
    { id: 'sad_wander', label: 'Sad wandering', desc: 'is wandering around in a daze.' },
    { id: 'insulting_spree', label: 'Insulting spree', desc: 'is insulting everyone.' },
  ],
  extreme: [
    { id: 'berserk', label: 'Berserk', desc: 'has gone berserk!' },
    { id: 'give_up', label: 'Giving up', desc: 'has given up and is leaving the colony!' },
    { id: 'catatonic', label: 'Catatonic', desc: 'has collapsed into catatonia.' },
  ],
};
