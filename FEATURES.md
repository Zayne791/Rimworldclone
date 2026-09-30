# Starfall Colony: feature guide

Everything currently in the game, and what to look for while playing. The catalog tables (buildings, items,
research, animals, plants, traits…) are generated from the game's own definition files by
`npx tsx dev/gen-features.ts`, so the numbers match the code. Where a feature is described in game but not
fully simulated yet, this guide says so.

| Content | Count |
| --- | --- |
| Buildings & furniture (buildable) | 106 |
| Items (resources, food, weapons, apparel, medicine) | 96 |
| Research projects | 128 |
| Crafting / cooking recipes | 68 |
| Animals & mechanoids | 18 |
| Plants, crops & trees | 20 |
| Colonist traits | 36 |
| Backstories | 30 |
| Mood thoughts | 90 |
| Weather types | 7 |

## Contents

1. [First hour: what to try](#first-hour-what-to-try)
2. [Screen & controls](#screen--controls)
3. [Starting a game](#starting-a-game)
4. [Time, seasons & weather](#time-seasons--weather)
5. [Colonists](#colonists)
6. [Mood, thoughts & mental breaks](#mood-thoughts--mental-breaks)
7. [Health & medicine](#health--medicine)
8. [Building](#building)
9. [Floors, terrain & mining](#floors-terrain--mining)
10. [Rooms, beauty & temperature](#rooms-beauty--temperature)
11. [Power](#power)
12. [Farming & plants](#farming--plants)
13. [Food & cooking](#food--cooking)
14. [Crafting & production](#crafting--production)
15. [Items](#items)
16. [Research tree](#research-tree)
17. [AI minds (DeepSeek)](#ai-minds-deepseek)
18. [Combat & defense](#combat--defense)
19. [Animals](#animals)
20. [Events & storytellers](#events--storytellers)
21. [Trading, visitors & factions](#trading-visitors--factions)
22. [Endgame: build a ship](#endgame-build-a-ship)
23. [Multiplayer](#multiplayer)
24. [Saving](#saving)
25. [Art, sound & presentation](#art-sound--presentation)
26. [Known gaps](#known-gaps)

## First hour: what to try

A tour that touches most systems. Each step names what you should see happen.

1. **Title screen.** A small colony is already living behind the menu: that is the real game running.
2. **New colony → pick a crew.** Reroll colonists you don't like; look at traits, passions (flame icons) and "won't do" work.
   Pick a husky or cat. On the landing map, tap a spot or use *Pick for me*.
3. **Crash site.** Three colonists land with a bolt-action rifle, a revolver and a knife, plus steel (450), wood (300),
   40 survival meals, 20 medicine, 30 components, 800 silver and 60 cloth. A letter explains the situation.
4. **Follow the hints on the left** (tap ones marked ›): make a stockpile zone, a growing zone, a cooking spot…
5. **Build a room.** Build → Structure → Wall, then drag diagonally to outline a whole room. Add a door, then beds.
   Watch the roof appear automatically once the room is enclosed (Zones → Roofs view shows it).
6. **Kitchen.** A campfire and a butcher spot start with a bill already (cook until 10 meals / butcher forever).
7. **Hunt.** Orders → Hunt, tap a deer or boar. The hunter shoots it, carries it to the butcher spot, the cook butchers
   it and turns the meat into simple meals. Some animals fight back.
8. **Research.** Build a research bench (Build → Production), open Research, pick Electricity. Its prerequisite links light up.
9. **Night.** Around 7pm the light fades; campfires and torches cast warm light. Colonists go to bed on schedule.
10. **First raid (around day 4–5).** A red letter and alarm. Tap ⚔ *Draft all*, then tap raiders to attack.
    Raiders flee after losing half their group. Downed colonists need rescuing (long-press them).
11. **Multiplayer.** Menu → room code / *Copy invite link* when hosting; a friend on another device lands their own colony on your map.
12. **AI minds.** Menu → AI minds → turn it on. Every colonist is now played by DeepSeek: watch the thought bubbles, speech
    bubbles and the Colony → Voices log. (No key? Pick *Offline mind* to try it for free.)

## Screen & controls

The game is built for touch, portrait first.

| Area | What it shows |
| --- | --- |
| Top bar | Time, date, weather and temperature; pause and 3 speed buttons; multiplayer status (who is holding the speed down, "waiting for host") |
| Colonist bar | Portrait, name and mood bar per colonist; ⚔ drafted, ✚ downed, ! mental break, ★ inspired. A red ⚔ Draft all button appears during threats |
| Hints (left) | Problems and next steps: raiders, starving, bleeding, break risk, idle colonists, low food/wood/medicine, missing beds or kitchen… Tap to jump or open the fixing menu |
| Letters (right) | Event messages (red = threat, orange = bad, green = good, blue = info). Tap to read; Jump to shows the spot |
| Inspector sheet (bottom) | Whatever is selected: colonist tabs (Overview, Health, Gear, Skills, Mood, Social), building controls, zone settings. Collapse with ▼ |
| Bottom tabs | Build, Orders, Zones, Work (priorities and schedules), Research, Colony (colonists, animals, factions/diplomacy, stats, log), Menu |

| Gesture / key | Action |
| --- | --- |
| Drag | Pan (with a build/zone tool active, drag paints the area instead) |
| Pinch / mouse wheel | Zoom |
| Tap | Select; tap again to cycle through stacked things |
| Double-tap a colonist | Select all your colonists on screen |
| Long-press / right-click | Context menu: equip, wear, eat, haul, rescue, capture, tend, attack, prioritize building, sleep in bed, mine, cut, go here, hunt, tame, slaughter, inspect tile |
| Orders → Select box | Drag a selection box on touch (left-drag does this with a mouse) |
| Space | Pause |
| 1–4 | Game speeds |
| R | Draft/undraft selected (rotate while placing a building) |
| F | Toggle fire at will |
| B / O / Z | Build / Orders / Zones |
| Tab | Next colonist |
| Esc | Cancel tool or close window |
| WASD / arrows | Pan |

**Orders tab:** mine, chop wood, harvest, cut plants, hunt, tame, slaughter, deconstruct, cancel, forbid, unforbid, select box,
home area add/clear, build roof, remove roof, no-roof area, remove floor.

**Zones tab:** stockpile, growing zone (pick the crop), dumping zone (chunks and corpses), remove zone; overlay toggles for zones,
home area, roofs, temperature and names. Selected zones can be expanded, shrunk or deleted; stockpiles and shelves have
priorities and category filters.

**Menu:** save, export save file, how to play, sound volumes and mute, display toggles, graphics (Auto / Sharp / Fast;
Auto lowers the render resolution on slower devices), multiplayer room code and invite link, exit.

## Starting a game

| Setting | Options |
| --- | --- |
| Storyteller | Steady Sol (balanced), Gentle Gaia (relaxed: fewer, further-apart threats), Wildcard Wren (chaos: random gaps and threat sizes) |
| Difficulty | Peaceful (no raids or manhunters), Easy, Normal, Hard, Brutal (threat size ×0.35, ×0.6, ×1, ×1.35, ×1.75) |
| Map size | Solo: Small 100, Medium 140, Large 180 tiles. Multiplayer: Medium 160, Large 200, Huge 240 |
| World seed | Any text; same seed = same map |
| Crew | 3 colonists, each rerollable; choose a pet (husky or cat) |
| Landing site | Tap anywhere on the minimap; it reports how much open ground is there. Mountains give ore and overhead-rock bases |
| Multiplayer only | Max players (2–4), player-vs-player (wars allowed / peaceful only) |

## Time, seasons & weather

A day is about 17 real minutes at 1× speed. Speeds are 1×, 3×, 6× and 15× (60 / 180 / 360 / 900 ticks per second).
A season lasts 15 days (Spring, Summer, Fall, Winter), so a year is 60 days. Temperatures follow the season
(about 13 °C average, ±14 °C over the year) and the time of day (±5 °C). Winter below −8 °C kills outdoor crops; snow builds up
and slows movement. Lightning in thunderstorms can start fires.

| Weather | Light | Shooting accuracy | Move speed | Temp | Notes |
| --- | --- | --- | --- | --- | --- |
| Clear | 100% | 100% | 100% | +0 °C | — |
| Overcast | 85% | 100% | 100% | -1 °C | — |
| Rain | 75% | 80% | 95% | -2 °C | rain (puts out fires, soaks colonists) |
| Thunderstorm | 65% | 75% | 95% | -3 °C | rain (puts out fires, soaks colonists), lightning strikes |
| Fog | 80% | 60% | 100% | -1 °C | fog |
| Snow | 80% | 85% | 90% | -2 °C | snowfall |
| Blizzard | 60% | 60% | 75% | -8 °C | snowfall |

| World condition | Effect |
| --- | --- |
| Eclipse | Dark skies for up to a day; solar panels produce nothing; small mood penalty |
| Aurora | Beautiful night sky; mood bonus |
| Solar flare | All electrical devices stop for part of a day |
| Cold snap (winter) | Temperatures drop sharply for 1.5–3 days |
| Heat wave (summer) | Temperatures spike for 1.5–3 days |
| Toxic fallout (after day 20) | Colonists outdoors build up toxicity (mood penalty, can kill); keep them under roofs |
| Psychic drone | Colony-wide mood penalty (−15) for a day |
| Psychic soothe | Colony-wide mood bonus (+12) for a day |

## Colonists

Each colonist has a name and nickname, age, childhood and adulthood backstory, up to 3 traits, 12 skills with passions,
needs, health, gear, relationships and a work schedule. Skills rise with use: no passion learns at 35% speed,
a minor passion (♨) at 100%, a major passion (🔥) at 150%. Skills do not decay.

**Needs:** food, rest, recreation (joy), comfort, beauty (of surroundings) and mood. Colonists eat when hungry (preferring meals,
at a table if there is one), sleep in their own bed on schedule, and seek recreation (games, watching the sky, walks, beer).

### Skills

Shooting, Melee, Construction, Mining, Cooking, Plants, Animals, Crafting, Artistic, Medical, Social, Intellectual.

### Work types

Set priorities in the Work tab: tap a cell to cycle 1 (highest) → 4 → off. Gold borders mark each colonist's best skills.
Colonists always take the highest-priority work available. The Schedule tab paints hours as sleep, recreation, work or anything.

| Work | Skill | What it covers |
| --- | --- | --- |
| Firefight | — | Put out fires in the home area. |
| Doctor | Medical | Tend wounds, rescue the downed, feed patients. |
| Warden | Social | Feed and recruit prisoners. |
| Handle | Animals | Tame, milk, shear and slaughter animals. |
| Cook | Cooking | Cook meals and butcher corpses. |
| Hunt | Shooting | Hunt designated animals. |
| Construct | Construction | Build, repair, deconstruct and roof. |
| Grow | Plants | Sow and harvest crops in growing zones. |
| Mine | Mining | Dig out designated rock. |
| Plant cut | Plants | Chop trees and cut designated plants. |
| Smith | Crafting | Make weapons at smithies and machining tables. |
| Tailor | Crafting | Make clothing and armor. |
| Art | Artistic | Create sculptures. |
| Craft | Crafting | Stonecutting, components, medicine and more. |
| Haul | — | Carry items to stockpiles and refuel things. |
| Clean | — | Clean filth in the home area. |
| Research | Intellectual | Research new technology. |

### Traits

| Trait | Effect | Excludes |
| --- | --- | --- |
| Industrious | Works 35% faster. | Hard worker, Lazy, Slothful |
| Hard worker | Works 20% faster. | Industrious, Lazy, Slothful |
| Lazy | Works 20% slower. | Industrious, Hard worker, Slothful |
| Slothful | Works 35% slower. | Industrious, Hard worker, Lazy |
| Sanguine | Always cheerful. +12 mood. | Optimist, Pessimist, Depressive |
| Optimist | +6 mood. | Sanguine, Pessimist, Depressive |
| Pessimist | -6 mood. | Sanguine, Optimist, Depressive |
| Depressive | -12 mood. | Sanguine, Optimist, Pessimist |
| Iron-willed | Much less likely to have mental breaks. | Steadfast, Nervous, Volatile |
| Steadfast | Less likely to have mental breaks. | Iron-willed, Nervous, Volatile |
| Nervous | More likely to have mental breaks. | Iron-willed, Steadfast, Volatile |
| Volatile | Much more likely to have mental breaks. | Iron-willed, Steadfast, Nervous |
| Jogger | Moves 20% faster. | Fast walker, Slowpoke |
| Fast walker | Moves 10% faster. | Jogger, Slowpoke |
| Slowpoke | Moves 20% slower. | Jogger, Fast walker |
| Tough | Takes half damage. | Wimp |
| Wimp | Goes down from minor pain. | Tough |
| Careful shooter | Aims longer, hits more often. | Trigger-happy |
| Trigger-happy | Shoots quickly but inaccurately. | Careful shooter |
| Brawler | Loves melee. Hates wielding guns. *Better melee hit chance works; the dislike of guns is not simulated yet.* | — |
| Kind | Never insults others; often compliments. | Abrasive, Psychopath |
| Abrasive | Often insults people. | Kind |
| Psychopath | Feels no empathy. Unbothered by death. | Kind |
| Bloodlust | Enjoys violence and gore. | — |
| Night owl | Prefers to work at night. *Not simulated yet: no night-work preference or mood effect.* | — |
| Greedy | Wants an impressive bedroom. | Ascetic |
| Ascetic | Happy in spartan conditions. | Greedy |
| Gourmand | Loves food. Gets hungry faster. | — |
| Pyromaniac | Loves fire. Occasionally starts some. Refuses to firefight. *Refusing firefighting works; fire-starting and the fire mood bonus are not simulated yet.* | — |
| Beautiful | Others like them more. | Pretty, Ugly |
| Pretty | Others like them a bit more. | Beautiful, Ugly |
| Ugly | Others like them less. | Beautiful, Pretty |
| Too smart | Learns 75% faster but is less stable. | — |
| Great memory | Skills decay slower. *Acts as +10% learning; skills never decay in this game, so there is nothing to slow.* | — |
| Nimble | Dodges melee attacks well. | — |
| Undergrounder | Doesn't mind being indoors or underground. *Not simulated yet: there are no indoor/outdoor mood effects for it to cancel.* | — |

### Backstories

Backstories add starting skill bonuses and can rule out work types ("won't do").

**Childhood**

| Backstory | Skills | Won't do | Story |
| --- | --- | --- | --- |
| Farm kid | Plants +3, Animals +2, Construction +1 | — | Raised on a family homestead, planting and harvesting from sunup to sundown. |
| Vat-grown soldier | Shooting +4, Melee +3 | Art | Engineered and trained for combat from birth. |
| Street urchin | Melee +2, Social +2, Crafting +1 | — | Survived the alleys of a sprawling hive city by wits and quick hands. |
| Bookworm | Intellectual +4, Medical +1 | Mine | Spent every waking hour in the archives, devouring texts. |
| Junkyard tinker | Crafting +3, Construction +2 | — | Took apart every machine they found and usually got it back together. |
| Pampered noble | Social +4, Artistic +2 | Haul, Clean | Grew up with servants and never lifted a finger. |
| Tribal hunter | Shooting +3, Animals +2, Plants +1 | — | Learned to track and hunt with the elders of the tribe. |
| Ship-born | Construction +2, Intellectual +2, Crafting +1 | — | Raised in the corridors of a generation ship, far from any planet. |
| Cook's helper | Cooking +4, Social +1 | — | Scrubbed pots and learned recipes in a busy tavern kitchen. |
| Mining colony kid | Mining +4, Construction +1 | — | Grew up in the tunnels of an asteroid mining outpost. |
| Child prodigy | Artistic +5 | — | Painted masterpieces before they could properly read. |
| Medic's apprentice | Medical +4, Social +1 | — | Followed a field surgeon from battle to battle. |

**Adulthood**

| Backstory | Skills | Won't do | Story |
| --- | --- | --- | --- |
| Mercenary | Shooting +5, Melee +4 | Art | Sold their gun to whoever paid most across a dozen worlds. |
| Starship engineer | Construction +5, Crafting +4, Intellectual +2 | — | Kept the reactors of an interstellar freighter humming. |
| Agri-world farmer | Plants +6, Animals +3, Cooking +1 | — | Managed thousands of acres of automated crops, and plenty by hand. |
| Emergency physician | Medical +7, Intellectual +3 | Hunt | Saved lives in the understaffed hospitals of a frontier world. |
| Starliner chef | Cooking +7, Social +2, Plants +1 | — | Cooked for the elite on luxury cruise vessels. |
| Research scientist | Intellectual +7, Medical +2 | Mine, Hunt | Pushed the frontiers of xenobiology in orbital labs. |
| Asteroid miner | Mining +7, Construction +2, Shooting +1 | — | Cracked rocks in zero-g for a mining conglomerate. |
| Merchant | Social +7, Intellectual +1 | Clean | Haggled across the spaceways for profit and adventure. |
| Colony builder | Construction +7, Mining +2 | — | Raised prefab settlements on newly terraformed worlds. |
| Big game hunter | Shooting +6, Animals +4 | — | Stalked exotic beasts for wealthy clients. |
| Artisan | Crafting +6, Artistic +4 | — | Handcrafted fine goods sold in upscale boutiques. |
| Rancher | Animals +7, Plants +2, Shooting +1 | — | Drove herds of muffalo across open plains. |
| Reformed pirate | Shooting +4, Melee +4, Social +1 | Doctor | Raided shipping lanes before a change of heart. Mostly. |
| Imperial bureaucrat | Social +4, Intellectual +4 | Mine, Construct | Shuffled forms in an endless administrative tower. |
| Sculptor | Artistic +7, Construction +2, Crafting +1 | — | Created monumental statues for planetary governors. |
| Drifter | Construction +2, Plants +2, Cooking +2, Crafting +2, Mining +2 | — | Wandered from job to job, picking up a bit of everything. |
| Pit fighter | Melee +7, Social +1 | Doctor, Research | Fought for crowds in underground arenas. |
| Mech technician | Crafting +5, Intellectual +3, Construction +2 | — | Repaired and reprogrammed war machines. |

### Social life

Colonists chat, have deep talks, insult each other (Abrasive colonists especially), and form opinions of each other.
With AI minds on, conversations are chosen and worded by the colonists themselves (see AI minds).
Romance can start between colonists who like each other (lovers want to share a bed; rejection hurts). Insults can escalate
into social fights. Losing a friend or lover is a heavy mood blow. Pets follow their master around.

## Mood, thoughts & mental breaks

Mood (0–100%) is the sum of active thoughts, traits and expectations. Expectations rise with colony wealth, so a rich colony
needs nicer rooms and food to stay happy. If mood falls below a colonist's break threshold they may snap:

| Break level | Default threshold | Possible breaks |
| --- | --- | --- |
| Minor | below 35% | Sad wandering: wanders aimlessly; Food binge: eats everything it can reach; Hiding in room: stays by their bed |
| Major | below 20% | Tantrum: attacks colony buildings nearby; Sad wandering: wanders aimlessly; Insulting spree: insults everyone they talk to |
| Extreme | below 5% | Berserk: attacks anyone nearby; Giving up: walks off the map and leaves the colony for good; Catatonic: collapses, helpless, for about a day |

Iron-willed/Steadfast lower these thresholds; Nervous/Volatile/Too smart raise them. Breaks end after a while and can leave a
*Catharsis* mood boost. A very happy colonist (mood above 80%) can be struck by an **inspiration: work frenzy**, working twice as
fast for a day (this is the only inspiration type so far).

### All thoughts

*Memories* last for the listed time; *situational* thoughts apply while the condition holds. Thoughts marked † are defined but
nothing triggers them yet.

| Thought | Mood | Lasts | Social opinion |
| --- | --- | --- | --- |
| Ate raw food | -7 | 0.5 days | — |
| Ate raw meat | -10 | 0.5 days | — |
| Ate a fine meal | +5 | 0.5 days | — |
| Ate a lavish meal | +12 | 0.5 days | — |
| Ate nutrient paste | -4 | 0.5 days | — |
| Had a beer | +4 | 0.3 days | — |
| Ate without a table | -3 | 0.5 days | — |
| Slept on the ground | -4 | 0.5 days | — |
| Slept outside | -4 | 0.5 days | — |
| Slept in the cold | -3 | 0.5 days | — |
| Slept in the heat | -3 | 0.5 days | — |
| Slept in barracks | -3 | 0.5 days | — |
| Slept in an impressive bedroom | +4 | 0.5 days | — |
| Slept in an awful bedroom | -4 | 0.5 days | — |
| Ate in an impressive dining room | +4 | 0.5 days | — |
| Colonist died | -5 | 6 days (stacks ×5) | — |
| My friend died | -15 | 20 days (stacks ×5) | — |
| My lover died | -25 | 30 days (stacks ×1) | — |
| My bonded animal died | -10 | 10 days (stacks ×3) | — |
| Observed a corpse | -4 | 0.5 days (stacks ×3) | — |
| Observed a rotting corpse | -6 | 0.5 days (stacks ×3) | — |
| Killed an enemy | +3 | 1 day (stacks ×3) | — |
| Killed someone (bloodlust) | +8 | 1 day (stacks ×3) | — |
| Soaking wet | -3 | 0.1 days | — |
| Had a nice chat | +2 | 0.5 days (stacks ×5) | +5 |
| Had a deep talk | +4 | 1 day (stacks ×3) | +12 |
| Was insulted | -5 | 1 day (stacks ×5) | -15 |
| Romance rebuffed | -8 | 3 days | -10 |
| Got together with a lover | +15 | 5 days | — |
| Broke up † | -12 | 10 days | -30 |
| Catharsis | +30 | 2.5 days | — |
| Lost a social fight | -5 | 2 days | -20 |
| Was comforted | +6 | 1 day (stacks ×2) | +12 |
| Was praised | +4 | 1 day (stacks ×3) | +8 |
| Shared a joke | +3 | 0.5 days (stacks ×4) | +6 |
| Got an apology | +2 | 1 day | +10 |
| Had an argument | -4 | 1 day (stacks ×3) | -10 |
| Welcomed a new colonist | +3 | 1 day (stacks ×3) | — |
| Was rescued | +5 | 3 days | +10 |
| Wounds tended | +2 | 1 day | — |
| Colony sold a prisoner † | -3 | 5 days | — |
| Colony was merciful † | +2 | 2 days | — |
| Colony executed a prisoner † | -5 | 6 days | — |
| Made a breakthrough | +3 | 1 day | — |
| Created a masterpiece | +8 | 3 days | — |
| Hope of escape | +10 | 3 days | — |
| Psychic soothe | +12 | 1 day | — |
| Psychic drone | -15 | 1 day | — |
| Had a meltdown † | 0 | 1 day | — |
| Hungry | -6 | situational | — |
| Ravenous | -12 | situational | — |
| Malnourished | -20 | situational | — |
| Tired | -4 | situational | — |
| Exhausted | -10 | situational | — |
| Recreation-starved | -10 | situational | — |
| Needs recreation | -4 | situational | — |
| Recreation satisfied | +5 | situational | — |
| Minor pain | -5 | situational | — |
| Serious pain | -10 | situational | — |
| Extreme pain | -20 | situational | — |
| Ugly environment | -6 | situational | — |
| Pretty environment | +4 | situational | — |
| Beautiful environment | +8 | situational | — |
| In darkness | -5 | situational | — |
| Cold | -5 | situational | — |
| Hot | -5 | situational | — |
| Naked | -6 | situational | — |
| No bed of my own | -3 | situational | — |
| Extremely low expectations | +25 | situational | — |
| Very low expectations | +18 | situational | — |
| Low expectations | +12 | situational | — |
| Moderate expectations | +6 | situational | — |
| High expectations | 0 | situational | — |
| Comfortable | +3 | situational | — |
| Uncomfortable † | -3 | situational | — |
| Cramped interior † | -4 | situational | — |
| Imprisoned | -5 | situational | — |
| Greedy: wants a better room | -6 | situational | — |
| Ascetic contentment | +3 | situational | — |
| Sleeping with my lover | +5 | situational | — |
| Want to sleep with my lover | -6 | situational | — |
| Pyromaniac: enjoyed a fire † | +5 | 1 day | — |
| Toxic buildup | -8 | situational | — |
| Cabin fever † | -6 | situational | — |
| Waiting for launch | +5 | situational | — |
| Tattered apparel | -3 | situational | — |
| Eclipse gloom | -3 | situational | — |
| Saw an aurora | +6 | situational | — |
| Awed by the archotech monument | +10 | situational | — |

## Health & medicine

Damage lands on individual body parts. Injuries bleed, hurt and can get infected; destroyed parts are lost for good
(a lost leg means slower walking, a lost hand weaker manipulation, a lost eye worse sight). Healed injuries can leave scars.
Enough pain, blood loss or a damaged brain puts a pawn **down**; destroying a vital part kills them.

| Body part | HP | Affects | Vital |
| --- | --- | --- | --- |
| Torso | 40 | — | yes |
| Heart | 15 | blood pumping | yes |
| Lungs | 20 | breathing | yes |
| Liver | 20 | — | yes |
| Stomach | 20 | — |  |
| Head | 25 | — | yes |
| Brain | 10 | consciousness | yes |
| Left eye | 10 | sight |  |
| Right eye | 10 | sight |  |
| Left arm | 30 | manipulation |  |
| Left hand | 20 | manipulation |  |
| Right arm | 30 | manipulation |  |
| Right hand | 20 | manipulation |  |
| Left leg | 30 | moving |  |
| Left foot | 20 | moving |  |
| Right leg | 30 | moving |  |
| Right foot | 20 | moving |  |

**Capacities:** consciousness, moving, manipulation, sight, breathing and blood pumping. They drive work speed, walking speed,
shooting and more, and are listed on each colonist's Health tab together with pain and bleeding rate.

| Injury type | Name when fresh / healed | Bleeds | Infection chance |
| --- | --- | --- | --- |
| cut | cut / cut scar | yes | 15% |
| stab | stab wound / stab scar | yes | 15% |
| bullet | gunshot / gunshot scar | yes | 15% |
| bite | bite / bite scar | yes | 30% |
| scratch | scratch / scratch scar | yes | 15% |
| blunt | bruise / crack scar | no | 0% |
| burn | burn / burn scar | no | 30% |
| frost | frostbite / frostbite scar | no | 0% |
| bomb | shrapnel wound / shrapnel scar | yes | 15% |
| crush | crush wound / crush scar | yes | 10% |

| Disease | Progress per day (untended / tended) | Immunity gain per day | Lethal |
| --- | --- | --- | --- |
| infection | 84% / 40% | 60% | yes |
| flu | 25% / 10% | 24% | yes |
| plague | 67% / 35% | 34% | yes |
| malaria | 37% / 15% | 32% | yes |

Immunity racing severity decides the outcome: keep the patient in bed and tended by a doctor. Other conditions:
**hypothermia** and **frostbite** (cold), **heatstroke** (heat), **malnutrition** (starving: fatal after about 3 days at
zero food), **toxic buildup** (fallout), **food poisoning** (bad cooking) and **blood loss**.

**Doctoring:** doctors rescue downed colonists to a bed and tend wounds; tend quality comes from Medical skill and the medicine
used (tending without medicine is weaker, and self-tending is 30% worse). Medicine: herbal (60% potency; grow healroot),
medicine (100%; drug lab), glitterworld (160%; traders only). Mark a bed *Medical* in its inspector to reserve it for
patients; hospital beds are a comfier medical bed.

## Building

Pick a structure in the Build tab, choose its material where it has one, then tap or drag. Colonists deliver materials to the
blueprint and construct it (Construction skill, some things need a minimum skill). Material matters: wood builds fast but burns;
stone blocks are slow, strong and fireproof; metals sit between. Buildings with quality (furniture, beds, art) roll a quality
from awful, poor, normal, good, excellent, masterwork, legendary; quality scales their stats from 80% to 150%.
Plants under a blueprint are cut first. Deconstruct returns materials. Doors only open for your colonists and allies; a door can
be held open. The *Copy* button repeats a selected building.

### Structure

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Wall | 1×1 | 5 wood/stone/metal | — | cover 75% |
| Door | 1×1 | 25 wood/stone/metal | — | A door. Only your colonists (and allies) can open it. |
| Autodoor | 1×1 | 25 wood/stone/metal + 40 steel + 2 components | Autodoors | uses 50 W |
| Column | 1×1 | 20 wood/stone/metal | — | cover 50%; beauty +1 |
| Blast door | 1×1 | 80 steel + 2 components | Reinforced construction | A massively armored door. Slow to open, very hard to break. |

### Furniture

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Bedroll | 1×2 | 30 fabric/leather | — | comfort 70%; has quality |
| Bed | 1×2 | 45 wood/stone/metal | — | comfort 75%; beauty +1; has quality |
| Double bed | 2×2 | 85 wood/stone/metal | — | 2 sleepers, comfort 75%; beauty +2; has quality |
| Hospital bed | 1×2 | 60 steel + 40 cloth + 2 components | Medicine production | comfort 80%, medical; has quality |
| Table (1x2) | 1×2 | 26 wood/stone/metal | — | dining table; cover 40%; has quality |
| Table (2x2) | 2×2 | 50 wood/stone/metal | — | dining table; cover 40%; beauty +1; has quality |
| Table (2x4) | 2×4 | 90 wood/stone/metal | — | dining table; cover 40%; beauty +2; has quality |
| Stool | 1×1 | 25 wood/stone/metal | — | seat, comfort 50%; has quality |
| Dining chair | 1×1 | 45 wood/stone/metal | — | seat, comfort 70%; beauty +1; has quality |
| Armchair | 1×1 | 110 fabric/leather | Complex furniture | seat, comfort 85%; beauty +3; has quality |
| End table | 1×1 | 30 wood/stone/metal | Complex furniture | beauty +3; has quality |
| Dresser | 2×1 | 50 wood/stone/metal | Complex furniture | beauty +4; has quality |
| Shelf | 2×1 | 20 wood/stone/metal | — | 2 stacks per cell |
| Plant pot | 1×1 | 20 wood/stone/metal | — | beauty +6 |
| Grain silo | 2×2 | 60 steel + 60 wood | Granaries | 6 stacks per cell (raw food, feed) |
| Bunk bed | 1×2 | 70 wood/stone/metal | Barracks planning | 2 sleepers, comfort 70%; has quality |
| Couch | 2×1 | 140 fabric/leather | Interior design | seat, comfort 90%; beauty +4; has quality |
| Royal bed | 2×2 | 120 wood/stone/metal + 30 gold + 60 cloth | Luxury living | 2 sleepers, comfort 95%; beauty +14; has quality |
| Sleep accelerator | 1×1 | 40 steel + 2 components | Sleep science | uses 100 W; Beds touching it restore 20% more rest while powered. |
| Vitals monitor | 1×1 | 50 steel + 2 components | Hospital equipment | uses 80 W; Patients in a bed touching it get +12% tend quality and heal 20% faster. |

### Production

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Campfire | 1×1 | 20 wood | — | burns 10 wood/day (holds 20); light radius 6; heats toward 28 °C; makes: simple meal, pemmican |
| Butcher spot | 1×1 | free | — | makes: butcher creature |
| Butcher table | 3×1 | 50 steel | — | makes: butcher creature; beauty -6 |
| Fueled stove | 3×1 | 80 steel | — | burns 10 wood/day (holds 50); heats toward 40 °C; makes: simple meal, fine meal, lavish meal, pemmican |
| Electric stove | 3×1 | 80 steel + 2 components | Electricity | uses 350 W; makes: simple meal, fine meal, lavish meal, pemmican |
| Crafting spot | 1×1 | free | — | makes: short bow, recurve bow, great bow, club, spear, tribalwear, tuque |
| Tailoring bench | 3×1 | 75 wood/stone/metal | — | makes: t-shirt, button-down shirt, pants, jacket, duster, parka, tribalwear, cowboy hat, tuque |
| Smithy | 3×1 | 100 wood/stone/metal | Smithing | burns 15 wood/day (holds 75); heats toward 40 °C; makes: knife, club, spear, longsword, mace, simple helmet, plate armor, recurve bow, great bow, smelt slag |
| Machining table | 3×1 | 150 steel + 4 components | Machining | uses 350 W; makes: revolver, autopistol, bolt-action rifle, pump shotgun, assault rifle, sniper rifle, lMG, heavy SMG, minigun, rocket launcher, flak vest, flak helmet, frag grenades, eMP grenades, molotov cocktails |
| Stonecutter's table | 3×1 | 75 wood/stone/metal | Stonecutting | makes: granite blocks, limestone blocks, marble blocks, sandstone blocks, slate blocks |
| Fabrication bench | 3×1 | 200 steel + 12 components | Fabrication | uses 250 W; makes: components, advanced component, synthesize plasteel, charge rifle, charge lance, pulse rifle, monosword, shield belt, recon armor, recon helmet, marine armor, marine helmet, cataphract armor, cataphract helmet |
| Drug lab | 3×1 | 75 steel + 2 components | Medicine production | makes: medicine, glitterworld medicine, brew beer |
| Research bench | 3×1 | 75 wood/stone/metal | — | research speed 100% |
| Hi-tech research bench | 3×2 | 150 steel + 10 components | Microelectronics | uses 250 W; research speed 130% |
| Hydroponics basin | 1×4 | 100 steel + 1 component | Hydroponics | uses 70 W; fertility 230% |
| Beehive | 1×1 | 40 wood | Beekeeping | produces 10 honey every 3 days, needs open sky, above 8 °C |
| Nutrient paste dispenser | 3×1 | 100 steel + 3 components | Nutrient paste | uses 200 W; makes: dispense nutrient paste |
| Meat vat | 2×2 | 150 steel + 4 components | Vat-grown meat | uses 500 W; produces 20 raw meat a day |
| Tool cabinet | 1×2 | 60 metal/wood | Tool making | Workbenches within 6 tiles work 6% faster (two cabinets at most). |
| Biofuel refinery | 2×2 | 150 steel + 3 components | Chemistry | uses 170 W; makes: refine chemfuel from wood, refine chemfuel from food |
| Electric smithy | 3×1 | 150 steel + 3 components | Electric workshops | uses 210 W; makes: knife, club, spear, longsword, mace, simple helmet, plate armor, smelt slag |
| Electric tailoring bench | 3×1 | 120 steel + 2 components | Electric workshops | uses 120 W; makes: t-shirt, button-down shirt, pants, jacket, duster, parka, tribalwear, cowboy hat, tuque |
| Electric smelter | 3×1 | 170 steel + 3 components | Electric workshops | uses 700 W; heats toward 40 °C; makes: smelt slag, smelt metal weapons & apparel |
| Component assembler | 3×1 | 220 steel | Component assembly | uses 300 W; makes: assemble component |
| Deep drill | 2×2 | 200 steel + 4 components | Deep drilling | uses 1000 W; produces 25 steel or 70 silver or 6 uranium or 8 gold or 10 plasteel or 10 jade or 2 components a day |
| Nano-assembler | 2×2 | 150 steel + 120 plasteel + 3 advanced components | Nanofabrication | uses 600 W; makes: nano-assemble advanced component, components, synthesize plasteel |
| Multi-analyzer | 2×2 | 150 steel + 6 components | Computing | uses 200 W |

### Power

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Power conduit | 1×1 | 1 steel | Electricity | Connects power producers, batteries, and consumers. |
| Battery | 1×2 | 70 steel + 2 components | Batteries | stores 600 Wd |
| Wood-fired generator | 2×2 | 100 steel + 2 components | Electricity | makes 1000 W; burns 22 wood/day (holds 75) |
| Solar generator | 3×3 | 100 steel + 3 components | Solar panels | makes up to 1700 W |
| Wind turbine | 2×1 | 100 steel + 2 components | Wind power | makes up to 2200 W |
| Geothermal generator | 2×2 | 340 steel + 8 components | Geothermal power | makes 3600 W; must sit on a steam geyser |
| Large battery | 2×2 | 200 steel + 6 components | Smart grid | stores 2400 Wd |
| Chemfuel generator | 2×2 | 120 steel + 3 components | Chemfuel power | makes 1500 W; burns 4.5 chemfuel/day (holds 50) |
| Fission reactor | 3×3 | 400 steel + 60 plasteel + 12 components | Nuclear fission | makes 6000 W; burns 1 uranium/day (holds 30) |
| Fusion reactor | 3×3 | 300 steel + 250 plasteel + 8 advanced components | Fusion power | makes 12000 W |
| Zero-point tap | 1×1 | 80 plasteel + 4 advanced components | Zero-point energy | makes 3000 W |

### Temperature

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Heater | 1×1 | 50 steel + 1 component | Electricity | uses 175 W; heats toward 21 °C |
| Cooler | 1×1 | 90 steel + 3 components | Air conditioning | uses 200 W; cools one side, heats the other; built into a wall |
| Vent | 1×1 | 30 steel | Air conditioning | shares temperature between rooms; built into a wall |
| Passive cooler | 1×1 | 50 wood | Passive cooler | burns 7 wood/day (holds 50); cools toward 15 °C |
| Climate unit | 1×1 | 90 steel + 4 components | Climate control | uses 300 W; heats or cools toward 21 °C |

### Lighting

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Torch lamp | 1×1 | 20 wood | — | burns 4 wood/day (holds 20); light radius 6; heats toward 23 °C |
| Standing lamp | 1×1 | 20 steel | Electricity | uses 30 W; light radius 7 |
| Sun lamp | 1×1 | 40 steel | Hydroponics | uses 2900 W; light radius 6, grows plants |
| Floodlight | 1×1 | 30 steel + 1 component | Efficient lighting | uses 80 W; light radius 12 |

### Security

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Sandbags | 1×1 | 5 wood | — | cover 55% |
| Barricade | 1×1 | 5 stone/wood/metal | — | cover 55% |
| Spike trap | 1×1 | 45 wood/stone/metal | — | 40 damage, single use |
| Mini-turret | 1×1 | 70 steel + 3 components | Gun turrets | auto-fires mini-turret gun; cover 50% |
| Embrasure | 1×1 | 10 stone/metal | Fortification | cover 80% |
| IED trap | 1×1 | 10 steel + 15 chemfuel | Explosives | explodes (radius 2.9, 55 damage) |
| Firefoam popper | 1×1 | 50 steel + 20 chemfuel | Firefoam | Pops when fire starts within 3 tiles, smothering every fire within 6. Recharges in a day. |
| Autocannon turret | 2×2 | 250 steel + 40 plasteel + 6 components | Autocannon turrets | uses 150 W; auto-fires autocannon (needs power); cover 60% |
| Uranium slug turret | 2×2 | 200 steel + 40 plasteel + 30 uranium + 6 components | Uranium slug turrets | uses 200 W; auto-fires uranium slug cannon (needs power); cover 60% |

### Recreation

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Horseshoes pin | 1×1 | 50 wood/stone/metal | — | recreation (dexterity, 2 users) |
| Chess table | 1×1 | 40 wood/stone/metal | — | recreation (cerebral, 2 users); beauty +2; has quality |
| Billiards table | 3×2 | 60 steel + 70 wood | Complex furniture | recreation (dexterity, 4 users); beauty +4; has quality |
| Tube television | 2×1 | 50 steel + 1 component | Microelectronics | uses 200 W; recreation (passive, 6 users) |
| Bookshelf | 2×1 | 60 wood/stone/metal | Writing | recreation (cerebral, 1 users); beauty +3 |
| Harp | 1×1 | 50 wood/metal | Music | recreation (music, 1 users); beauty +4; has quality |
| Piano | 2×1 | 150 wood + 30 steel + 1 component | Orchestration | recreation (music, 1 users); beauty +10; has quality |
| Megascreen television | 3×1 | 200 steel + 20 plasteel + 6 components | Mass media | uses 400 W; recreation (passive, 8 users) |

### Art

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Small sculpture | 1×1 | 50 stone/metal/wood | — | beauty +25; has quality |
| Large sculpture | 2×2 | 150 stone/metal/wood | — | beauty +60; has quality |
| Grand sculpture | 3×3 | 400 stone/metal/wood | Fine arts | beauty +110; has quality |
| Fountain | 2×2 | 120 stone/metal | Fine arts | recreation (passive, 4 users); beauty +30 |
| Archotech monument | 3×3 | 200 plasteel + 100 gold + 50 jade + 6 advanced components | Archotech monument | A monument of impossible geometry. Colonists within 14 tiles feel awe (+10 mood).; beauty +200 |

### Misc

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Grave | 1×2 | free | — | A place to bury the dead. |
| Comms console | 2×2 | 120 steel + 4 components | Microelectronics | uses 200 W; contacts orbital traders |
| Moisture pump | 1×1 | 60 steel + 1 component | Irrigation | uses 150 W; Slowly drains marsh, mud and shallow water within 6 tiles into farmable soil. |
| Fertilizer pump | 1×1 | 80 steel + 2 components | Fertilizers | uses 200 W; Crops within 7 tiles grow 50% faster while powered. |
| Terraformer | 2×2 | 250 steel + 60 plasteel + 3 advanced components | Terraforming | uses 1200 W; Rebuilds the ground within 9 tiles into rich soil a few cells at a time: sand, gravel, marsh, mud, shallows and bare stone all become farmland. |
| Orbital scanner | 2×2 | 200 steel + 8 components | Orbital scanning | uses 500 W; Spots valuable cargo in orbit and guides it down to you every few days while powered. |
| Weather controller | 3×3 | 300 steel + 100 plasteel + 4 advanced components | Weather control | uses 1500 W; While powered, holds the sky clear: no rain, fog, snow or storms. |

### Ship

| Building | Size | Cost | Research | Notes |
| --- | --- | --- | --- | --- |
| Ship structural beam | 1×1 | 70 steel + 30 plasteel | Starflight basics | Framework that ship parts attach to. |
| Cryptosleep casket | 1×2 | 180 steel + 5 uranium + 4 components | Cryptosleep | Keeps colonists alive for the long journey. |
| Ship computer core | 2×2 | 150 steel + 100 plasteel + 4 advanced components | Starflight basics |  |
| Ship reactor | 3×3 | 350 steel + 280 plasteel + 200 uranium + 10 advanced components | Starship drive | Powers the starship. Starting it will draw every raider on the planet. |
| Ship engine | 3×3 | 280 steel + 200 plasteel + 70 uranium + 6 advanced components | Starship drive |  |

Map features you can use: **steam geysers** (build a geothermal generator on them) and **ship chunks** (deconstruct for steel
and components).

## Floors, terrain & mining

| Floor | Cost | Beauty | Cleanliness | Research |
| --- | --- | --- | --- | --- |
| Wood floor | 3 wood | 1 | 0 | — |
| Straw matting | 4 hay | 0 | 0 | — |
| Concrete | 1 steel | 0 | 0 | Masonry |
| Granite tile | 4 granite blocks | 1 | 0 | Stonecutting |
| Marble tile | 4 marble blocks | 2 | 0 | Stonecutting |
| Sandstone tile | 4 sandstone blocks | 1 | 0 | Stonecutting |
| Steel tile | 7 steel | 1 | 0.2 | Masonry |
| Sterile tile | 3 steel + 12 silver | 1 | 0.6 | Sterile materials |
| Red carpet | 7 cloth | 2 | 0 | Complex furniture |
| Blue carpet | 7 cloth | 2 | 0 | Complex furniture |
| Green carpet | 7 cloth | 2 | 0 | Complex furniture |
| Gold tile | 40 gold | 12 | 0 | Stonecutting |
| Purple carpet | 7 cloth | 3 | 0 | Interior design |
| Gold carpet | 7 cloth | 3 | 0 | Interior design |
| Fine rug | 12 cloth + 1 gold | 6 | 0 | Luxury living |
| Silver tile | 70 silver | 6 | 0 | Luxury living |
| Plasteel tile | 3 plasteel | 2 | 0.4 | Prefab construction |

| Natural terrain | Fertility | Extra move cost | Can build heavy structures |
| --- | --- | --- | --- |
| Soil | 100% | 2 | yes |
| Rich soil | 140% | 2 | yes |
| Gravel | 70% | 2 | yes |
| Sand | 10% | 5 | yes |
| Marsh | 80% | 14 | no |
| Mud | 40% | 12 | no |
| Shallow water | 0% | 18 | no |
| Deep water | 0% | impassable | no |
| Ice | 0% | 6 | yes |
| Rough granite | 0% | 1 | yes |
| Rough limestone | 0% | 1 | yes |
| Rough marble | 0% | 1 | yes |
| Rough sandstone | 0% | 1 | yes |
| Rough slate | 0% | 1 | yes |
| Smooth granite | 0% | 0 | yes |

Mountains are solid rock: mine them (Orders → Mine) for stone chunks (cut into blocks at a stonecutter's table) and ore.
Mined-out areas under a mountain keep an **overhead rock roof**, making natural fortress bases. Deep water blocks movement.

| Rock / ore | Mining yields |
| --- | --- |
| Granite | granite chunk (sometimes) |
| Limestone | limestone chunk (sometimes) |
| Marble | marble chunk (sometimes) |
| Sandstone | sandstone chunk (sometimes) |
| Slate | slate chunk (sometimes) |
| Compacted steel | 40 steel |
| Silver vein | 40 silver |
| Gold vein | 35 gold |
| Plasteel vein | 35 plasteel |
| Uranium vein | 30 uranium |
| Jade vein | 30 jade |
| Compacted machinery | 3 components |

## Rooms, beauty & temperature

Walls, doors and wall-mounted coolers/vents enclose **rooms**, which are roofed automatically (roofs need support within a few
tiles; unsupported roofs collapse). Each room gets a role from its contents: bedroom, barracks, prison cell, hospital, kitchen,
laboratory, dining room, rec room, dining & rec room, workshop, power room, storeroom.

**Impressiveness** combines beauty (35%), wealth (25%), space (25%) and cleanliness (15%); tiny rooms are capped. Impressive
bedrooms and dining rooms give mood bonuses, awful ones penalties; barracks give a small penalty. **Beauty** comes from
furniture, art, flowers, floors and materials, and is lowered by filth, blood, corpses and ugly things. Colonists clean filth in
the home area. Darkness gives a mood penalty.

**Temperature** is tracked per room and blends with the outdoors through doors and vents. Heaters and campfires warm, coolers
and passive coolers cool; set a heater's or cooler's target in its inspector. Colonists get cold/hot thoughts, then
hypothermia/heatstroke. Food rots more slowly in the cold and stops rotting below freezing, so a cooled room is a freezer.

## Power

Research Electricity, then connect generators, batteries and consumers with power conduits. Each connected network balances
production against use; batteries fill from surplus and cover shortfalls. Solar needs daylight (nothing at night or during an
eclipse), wind varies with the wind, wood-fired generators need refuelling, geothermal is constant. A short circuit can blow up
a battery and start a fire; a solar flare stops all electrical devices. Unpowered devices show a hint.

## Farming & plants

Make a growing zone and pick a crop; growers sow and harvest it. Plants grow only in enough light and at 0–42 °C (best 10–35 °C),
faster on richer soil. Hydroponics basins with sun lamps grow crops indoors. Wild plants spread slowly; animals graze them;
crop blight can wipe out fields.

| Crop | Grow days | Harvest | Min. fertility | Research |
| --- | --- | --- | --- | --- |
| Rice plant | 3 | 6 rice | 50% | — |
| Potato plant | 5.8 | 11 potatoes | 30% | — |
| Corn plant | 11.3 | 22 corn | 50% | — |
| Strawberry plant | 4.6 | 7 strawberries | 50% | — |
| Healroot | 11 | 1 herbal medicine | 50% | Herbalism |
| Cotton plant | 8 | 10 cloth | 50% | — |
| Devilstrand mushroom | 22 | 12 devilstrand | 50% | Devilstrand |
| Haygrass | 6.4 | 18 hay | 50% | — |
| Rose | 4 | beauty +8 | 50% | — |
| Daylily | 4 | beauty +8 | 50% | — |

"Grow days" count only growing time; with nights and weather it takes noticeably longer on the calendar.

| Wild plant / tree | Kind | Gives | Notes |
| --- | --- | --- | --- |
| Grass | grass | — | — |
| Tall grass | grass | — | — |
| Dandelions | flower | — | beauty +1 |
| Bush | bush | — | cover 20%, beauty +1 |
| Wild berry bush | bush | 12 berries | cover 20%, beauty +1 |
| Wild healroot | bush | 1 herbal medicine | — |
| Oak tree | tree | 25 wood | cover 25%, beauty +2 |
| Poplar tree | tree | 20 wood | cover 25%, beauty +2 |
| Pine tree | tree | 22 wood | cover 25%, beauty +2, grows above -20 °C |
| Birch tree | tree | 20 wood | cover 25%, beauty +2 |

## Food & cooking

Colonists prefer meals over raw food (raw food gives a mood penalty). Cooks make meals at a campfire or stove from raw food;
butchers turn corpses into meat (and leather or fur). Meals rot in a few days unless kept cold. A packaged survival meal never
rots. Low food shows a hint with the days of food left.

| Food | Nutrition | Rots in | Mood |
| --- | --- | --- | --- |
| Rice | 0.05 | 40 days | Ate raw food (-7) |
| Potatoes | 0.05 | 30 days | Ate raw food (-7) |
| Corn | 0.05 | 60 days | Ate raw food (-7) |
| Berries | 0.05 | 14 days | Ate raw food (-7) |
| Strawberries | 0.05 | 14 days | Ate raw food (-7) |
| Raw meat | 0.05 | 2 days | Ate raw meat (-10) |
| Eggs | 0.05 | 15 days | Ate raw food (-7) |
| Milk | 0.05 | 14 days | Ate raw food (-7) |
| Honey | 0.05 | never | — |
| Hay (animal feed) | 0.05 | 60 days | — |
| Simple meal | 0.9 | 4 days | — |
| Fine meal | 0.9 | 4 days | Ate a fine meal (+5) |
| Lavish meal | 1 | 4 days | Ate a lavish meal (+12) |
| Pemmican | 0.05 | 70 days | — |
| Packaged survival meal | 0.9 | never | — |
| Nutrient paste meal | 0.9 | 4 days | Ate nutrient paste (-4) |
| Beer | 0.08 | never | Had a beer (+4) |

## Crafting & production

Production buildings hold **bills**: tap a bench → Bills. A bill can run a set number of times, *until you have N*, or forever;
it gathers ingredients within a radius and, for stuff-based items, lets you choose the material. Crafted weapons, apparel and
art roll quality from the crafter's skill. New campfires/stoves start with a "cook simple meal until 10" bill and new butcher
spots/tables with "butcher forever".

| Recipe | Made at | Ingredients | Makes | Skill (min) | Research |
| --- | --- | --- | --- | --- | --- |
| Cook simple meal | campfire, fueled stove, electric stove | 10 raw food | 1 simple meal | Cooking | — |
| Cook fine meal | fueled stove, electric stove | 5 meat/eggs + 5 vegetables | 1 fine meal | Cooking (6) | — |
| Cook lavish meal | fueled stove, electric stove | 10 meat/eggs + 10 vegetables | 1 lavish meal | Cooking (8) | — |
| Make pemmican | campfire, fueled stove, electric stove | 5 meat + 5 vegetables | 16 pemmican | Cooking | — |
| Butcher creature | butcher spot, butcher table | 1 corpse | meat, leather/fur | Cooking | — |
| Make t-shirt | tailoring bench, electric tailoring bench | 40 fabric/leather | t-shirt | Crafting | — |
| Make button-down shirt | tailoring bench, electric tailoring bench | 45 fabric/leather | button-down shirt | Crafting | — |
| Make pants | tailoring bench, electric tailoring bench | 40 fabric/leather | pants | Crafting | — |
| Make jacket | tailoring bench, electric tailoring bench | 70 fabric/leather | jacket | Crafting | Complex clothing |
| Make duster | tailoring bench, electric tailoring bench | 80 fabric/leather | duster | Crafting | Complex clothing |
| Make parka | tailoring bench, electric tailoring bench | 80 fabric/leather | parka | Crafting | Complex clothing |
| Make tribalwear | crafting spot, tailoring bench, electric tailoring bench | 60 fabric/leather | tribalwear | Crafting | — |
| Make cowboy hat | tailoring bench, electric tailoring bench | 25 fabric/leather | cowboy hat | Crafting | Complex clothing |
| Make tuque | crafting spot, tailoring bench, electric tailoring bench | 25 fabric/leather | tuque | Crafting | — |
| Make recurve bow | crafting spot, smithy | 40 wood | 1 recurve bow | Crafting | Archery |
| Make great bow | crafting spot, smithy | 70 wood | 1 great bow | Crafting (4) | Great bows |
| Make short bow | crafting spot | 30 wood | 1 short bow | Crafting | — |
| Make knife | smithy, electric smithy | 25 metal/wood | knife | Crafting | — |
| Make club | crafting spot, smithy, electric smithy | 50 wood/metal/stone | club | Crafting | — |
| Make spear | crafting spot, smithy, electric smithy | 50 metal/wood | spear | Crafting | — |
| Make longsword | smithy, electric smithy | 100 metal | longsword | Crafting | — |
| Make mace | smithy, electric smithy | 75 metal | mace | Crafting | — |
| Make simple helmet | smithy, electric smithy | 40 metal | simple helmet | Crafting | Smithing |
| Make plate armor | smithy, electric smithy | 150 metal | plate armor | Crafting (4) | Plate armor |
| Smelt metal weapons & apparel | electric smelter | 1 metal weapon/apparel |  | Crafting | — |
| Smelt slag | smithy, electric smithy, electric smelter | 1 slag chunk | 15 steel | Crafting | — |
| Make revolver | machining table | 30 steel + 2 components | 1 revolver | Crafting | Gunsmithing |
| Make autopistol | machining table | 30 steel + 3 components | 1 autopistol | Crafting | Gunsmithing |
| Make bolt-action rifle | machining table | 60 steel + 10 wood + 3 components | 1 bolt-action rifle | Crafting | Gunsmithing |
| Make pump shotgun | machining table | 70 steel + 3 components | 1 pump shotgun | Crafting | Gunsmithing |
| Make assault rifle | machining table | 60 steel + 7 components | 1 assault rifle | Crafting (4) | Gas operation |
| Make sniper rifle | machining table | 75 steel + 4 components | 1 sniper rifle | Crafting (5) | Precision rifling |
| Make LMG | machining table | 90 steel + 6 components | 1 LMG | Crafting (4) | Gas operation |
| Make flak vest | machining table | 60 steel + 30 cloth + 1 components | 1 flak vest | Crafting (3) | Flak armor |
| Make heavy SMG | machining table | 60 steel + 4 components | 1 heavy SMG | Crafting (4) | Heavy weapons |
| Make minigun | machining table | 150 steel + 10 components | 1 minigun | Crafting (6) | Heavy weapons |
| Make rocket launcher | machining table | 80 steel + 40 chemfuel + 6 components | 1 rocket launcher | Crafting (5) | Heavy weapons |
| Make EMP grenades | machining table | 60 steel + 4 components | 1 EMP grenades | Crafting (4) | EMP technology |
| Make flak helmet | machining table | 40 steel + 1 components | 1 flak helmet | Crafting (3) | Flak armor |
| Make molotov cocktails | machining table | 30 chemfuel + 5 cloth | 1 molotov cocktails | Crafting | Incendiaries |
| Make frag grenades | machining table | 60 steel + 3 components | 1 frag grenades | Crafting | Gunsmithing |
| Cut granite blocks | stonecutter's table | 1 granite chunk | 20 granite blocks | Crafting | — |
| Cut limestone blocks | stonecutter's table | 1 limestone chunk | 20 limestone blocks | Crafting | — |
| Cut marble blocks | stonecutter's table | 1 marble chunk | 20 marble blocks | Crafting | — |
| Cut sandstone blocks | stonecutter's table | 1 sandstone chunk | 20 sandstone blocks | Crafting | — |
| Cut slate blocks | stonecutter's table | 1 slate chunk | 20 slate blocks | Crafting | — |
| Make components | fabrication bench, nano-assembler | 12 steel | 1 component | Crafting (4) | — |
| Make advanced component | fabrication bench | 2 components + 10 plasteel + 3 gold | 1 advanced component | Crafting (8) | — |
| Make charge rifle | fabrication bench | 50 plasteel + 2 components + 1 adv. component | 1 charge rifle | Crafting (7) | Charged shot |
| Make marine armor | fabrication bench | 100 plasteel + 20 uranium + 4 adv. components | 1 marine armor | Crafting (8) | Powered armor |
| Make marine helmet | fabrication bench | 40 plasteel + 1 adv. component | 1 marine helmet | Crafting (8) | Powered armor |
| Make charge lance | fabrication bench | 60 plasteel + 3 components + 1 adv components | 1 charge lance | Crafting (7) | Charged shot |
| Make pulse rifle | fabrication bench | 70 plasteel + 10 uranium + 3 adv components | 1 pulse rifle | Crafting (9) | Pulse weapons |
| Make monosword | fabrication bench | 50 plasteel + 2 adv components | 1 monosword | Crafting (9) | Monomolecular blades |
| Make shield belt | fabrication bench | 20 steel + 30 plasteel + 1 adv components | 1 shield belt | Crafting (6) | Personal shields |
| Make recon armor | fabrication bench | 80 plasteel + 10 uranium + 3 adv components | 1 recon armor | Crafting (7) | Recon armor |
| Make recon helmet | fabrication bench | 30 plasteel + 1 adv components | 1 recon helmet | Crafting (7) | Recon armor |
| Make cataphract armor | fabrication bench | 160 plasteel + 30 uranium + 6 adv components | 1 cataphract armor | Crafting (9) | Cataphract armor |
| Make cataphract helmet | fabrication bench | 55 plasteel + 2 adv components | 1 cataphract helmet | Crafting (9) | Cataphract armor |
| Synthesize plasteel | fabrication bench, nano-assembler | 40 steel + 10 chemfuel | 10 plasteel | Crafting (6) | Advanced fabrication |
| Nano-assemble advanced component | nano-assembler | 3 components + 20 steel + 1 gold | 1 advanced component | Crafting (6) | — |
| Assemble component | component assembler | 16 steel | 1 component | Crafting (3) | — |
| Refine chemfuel from wood | biofuel refinery | 70 wood | 35 chemfuel | Crafting | — |
| Refine chemfuel from food | biofuel refinery | 45 raw food | 35 chemfuel | Crafting | — |
| Dispense nutrient paste | nutrient paste dispenser | 6 raw food | 1 nutrient paste meal | Cooking | — |
| Make medicine | drug lab | 1 herbal medicine + 3 cloth + 1 steel | 1 medicine | Intellectual (4) | Medicine production |
| Make glitterworld medicine | drug lab | 2 medicine + 5 plasteel + 1 adv. component | 1 glitterworld medicine | Intellectual (8) | Glitterworld medicine |
| Brew beer | drug lab | 25 grain/hay | 5 beer | Cooking | Brewing |

## Items

### Resources & materials

| Item | Stack | Value | Used as | Notes |
| --- | --- | --- | --- | --- |
| Wood | 75 | 1.2 | wood material | HP ×0.65, build speed ×1.43, flammability 100% |
| Steel | 75 | 1.9 | metal material | HP ×1, build speed ×1.00, flammability 40% |
| Plasteel | 75 | 9 | metal material | HP ×2.8, build speed ×0.63, flammability 0% |
| Silver | 500 | 1 | metal material | HP ×0.7, build speed ×1.00, beauty +2, flammability 20% |
| Gold | 500 | 10 | metal material | HP ×0.6, build speed ×1.00, beauty +8, flammability 20% |
| Jade | 75 | 5 | stone material | HP ×0.6, build speed ×0.67, beauty +4, flammability 0% |
| Uranium | 75 | 6 | metal material | HP ×1.6, build speed ×0.77, flammability 0% |
| Components | 75 | 32 | ingredient | Mechanical and electrical parts for machines. |
| Advanced components | 75 | 200 | ingredient | High-tech parts for starships and advanced gear. |
| Chemfuel | 150 | 2.3 | ingredient | Volatile fuel refined from organic matter. |
| Granite blocks | 75 | 1.1 | stone material | HP ×1.7, build speed ×0.38, flammability 0% |
| Limestone blocks | 75 | 1.1 | stone material | HP ×1.55, build speed ×0.42, flammability 0% |
| Marble blocks | 75 | 1.1 | stone material | HP ×1.2, build speed ×0.43, beauty +1, flammability 0% |
| Sandstone blocks | 75 | 1.1 | stone material | HP ×1.4, build speed ×0.48, flammability 0% |
| Slate blocks | 75 | 1.1 | stone material | HP ×1.3, build speed ×0.48, flammability 0% |
| Cloth | 75 | 1.5 | fabric material | HP ×1, build speed ×1.00, flammability 100%, insulation 18 °C |
| Devilstrand | 75 | 5.5 | fabric material | HP ×1.3, build speed ×1.00, beauty +1, flammability 40%, insulation 20 °C |
| Leather | 75 | 2.1 | leather material | HP ×1.3, build speed ×1.00, flammability 100%, insulation 16 °C |
| Wool | 75 | 2.6 | fabric material | HP ×1, build speed ×1.00, flammability 100%, insulation 30 °C |
| Thick fur | 75 | 3 | leather material | HP ×1.4, build speed ×1.00, beauty +1, flammability 100%, insulation 30 °C |

### Weapons

Accuracy is listed at touch / short / medium / long range (≤3, ≤12, ≤25, ≤40 tiles) and is further modified by Shooting skill,
weather, cover and quality.

| Weapon | Damage | Armor pen. | Range | Burst | Aim / cooldown | Accuracy | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Knife | 10 cut | 12% | melee | 1 | — / 1.2s | — | smithy, electric smithy |
| Club | 13 blunt | 10% | melee | 1 | — / 1.8s | — | crafting spot, smithy, electric smithy |
| Spear | 19 stab | 30% | melee | 1 | — / 2s | — | crafting spot, smithy, electric smithy |
| Longsword | 23 cut | 33% | melee | 1 | — / 3s | — | smithy, electric smithy |
| Mace | 21 blunt | 28% | melee | 1 | — / 2s | — | smithy, electric smithy |
| Monosword | 30 cut | 85% | melee | 1 | — / 1.8s | — | fabrication bench; Monomolecular blades |
| Short bow | 11 sharp | 16% | 24 | 1 | 1.5s / 1.7s | 65% / 80% / 60% / 40% | crafting spot |
| Revolver | 12 bullet | 18% | 26 | 1 | 0.3s / 1.6s | 80% / 75% / 45% / 35% | machining table |
| Autopistol | 10 bullet | 15% | 24 | 1 | 0.3s / 1.0s | 80% / 65% / 35% / 20% | machining table |
| Bolt-action rifle | 18 bullet | 27% | 37 | 1 | 1.7s / 1.5s | 65% / 80% / 90% / 80% | machining table |
| Pump shotgun | 18 bullet | 14% | 16 | 1 | 0.6s / 1.3s | 80% / 87% / 77% / 64% | machining table |
| Assault rifle | 11 bullet | 16% | 31 | 3 shots | 1.0s / 1.7s | 60% / 70% / 65% / 55% | machining table |
| Sniper rifle | 25 bullet | 38% | 45 | 1 | 3s / 2s | 50% / 70% / 86% / 88% | machining table |
| LMG | 11 bullet | 16% | 26 | 6 shots | 1.3s / 2s | 40% / 48% / 35% / 26% | machining table |
| Charge rifle | 15 bullet | 35% | 28 | 3 shots | 1.0s / 1.5s | 55% / 64% / 55% / 45% | fabrication bench |
| Frag grenades | 45 bomb (explodes r1.9) | 10% | 13 | 1 | 1.1s / 3s | 100% / 100% / 100% / 100% | machining table |
| Recurve bow | 14 sharp | 20% | 26 | 1 | 1.3s / 1.5s | 70% / 82% / 65% / 45% | crafting spot, smithy; Archery |
| Great bow | 17 sharp | 25% | 30 | 1 | 1.7s / 1.8s | 60% / 78% / 72% / 55% | crafting spot, smithy; Great bows |
| Heavy SMG | 12 bullet | 18% | 20 | 3 shots | 0.7s / 1.2s | 75% / 60% / 38% / 25% | machining table; Heavy weapons |
| Minigun | 10 bullet | 15% | 30 | 20 shots | 2s / 4s | 25% / 35% / 30% / 20% | machining table; Heavy weapons |
| Rocket launcher | 60 bomb (explodes r3.2) | 20% | 30 | 1 | 3s / 7s | 60% / 70% / 60% / 45% | machining table; Heavy weapons |
| Molotov cocktails | 10 burn (explodes r1.6) | 0% | 12 | 1 | 1.1s / 3s | 100% / 100% / 100% / 100% | machining table; Incendiaries |
| EMP grenades | 50 bomb (explodes r3) | 0% | 13 | 1 | 1.1s / 3s | 100% / 100% / 100% / 100% | machining table; EMP technology |
| Pulse rifle | 20 bullet | 55% | 32 | 3 shots | 0.9s / 1.4s | 65% / 78% / 72% / 60% | fabrication bench; Pulse weapons |

### Apparel

Layers (skin, middle, outer, head) stack; each piece covers body groups with sharp/blunt/heat armor and cold/heat insulation.
Colonists put on clothes when cold or missing coverage. Attacks and fire damage apparel; tattered pieces (under half HP) give a
mood penalty and colonists swap them for better ones.

| Apparel | Layers | Covers | Armor sharp / blunt / heat | Insulation cold / heat | Source |
| --- | --- | --- | --- | --- | --- |
| Tribalwear | skin, middle | torso, arms, legs | 10% / 5% / 10% | 12 / 8 °C | crafting spot, tailoring bench, electric tailoring bench |
| T-shirt | skin | torso | 5% / 0% / 5% | 4 / 6 °C | tailoring bench, electric tailoring bench |
| Button-down shirt | skin | torso, arms | 5% / 0% / 5% | 6 / 6 °C | tailoring bench, electric tailoring bench |
| Pants | skin | legs | 5% / 0% / 5% | 5 / 4 °C | tailoring bench, electric tailoring bench |
| Jacket | middle | torso, arms | 12% / 5% / 10% | 14 / 0 °C | tailoring bench, electric tailoring bench; Complex clothing |
| Duster | outer | torso, arms, legs | 10% / 5% / 15% | 8 / 20 °C | tailoring bench, electric tailoring bench; Complex clothing |
| Parka | outer | torso, arms, legs | 10% / 5% / 10% | 40 / -5 °C | tailoring bench, electric tailoring bench; Complex clothing |
| Flak vest | middle | torso | 90% / 30% / 20% | 2 / -2 °C | machining table; Flak armor |
| Simple helmet | head | head | 50% / 20% / 20% | 2 / 0 °C | smithy, electric smithy; Smithing |
| Cowboy hat | head | head | 0% / 0% / 0% | 0 / 10 °C | tailoring bench, electric tailoring bench; Complex clothing |
| Tuque | head | head | 0% / 0% / 0% | 10 / 0 °C | crafting spot, tailoring bench, electric tailoring bench |
| Marine armor | outer, middle | torso, arms, legs | 106% / 45% / 54% | 32 / 9 °C | fabrication bench; Powered armor |
| Marine helmet | head | fullhead | 106% / 45% / 54% | 8 / 2 °C | fabrication bench; Powered armor |
| Plate armor | outer | torso, arms, legs | 90% / 35% / 20% | 4 / -2 °C | smithy, electric smithy; Plate armor |
| Flak helmet | head | head | 60% / 25% / 20% | 2 / 0 °C | machining table; Flak armor |
| Shield belt | belt |  | 0% / 0% / 0% | 0 / 0 °C | fabrication bench; Personal shields |
| Recon armor | outer, middle | torso, arms, legs | 92% / 40% / 46% | 26 / 7 °C | fabrication bench; Recon armor |
| Recon helmet | head | fullhead | 92% / 40% / 46% | 6 / 2 °C | fabrication bench; Recon armor |
| Cataphract armor | outer, middle | torso, arms, legs | 140% / 60% / 70% | 36 / 11 °C | fabrication bench; Cataphract armor |
| Cataphract helmet | head | fullhead | 140% / 60% / 70% | 10 / 3 °C | fabrication bench; Cataphract armor |

### Medicine & misc

| Item | Potency | Source |
| --- | --- | --- |
| Herbal medicine | 60% | healroot plants |
| Medicine | 100% | drug lab |
| Glitterworld medicine | 160% | drug lab |

## Research tree

128 projects in 8 branches across 6 eras. Build a research bench, open the Research tab and pick a
project; colonists with Research work study it (Intellectual skill, research-speed bonuses and multi-analyzers help).
Projects marked hi-tech need a hi-tech research bench.

**The tree screen.** Columns are tiers grouped into era bands, rows are branch lanes. Drag to pan, pinch (or +/−, or
the mouse wheel with Ctrl) to zoom, *Fit* to see everything. Each card shows the first thing the project unlocks, its cost,
progress and queue position. Tap a card: its whole prerequisite chain lights up gold and everything it leads to lights up
blue, and the panel below lists unlocks (with icons), colony bonuses, requirements and follow-ups. Branch chips filter the
view; the search box finds projects by name or by what they unlock.

**Queue.** *Research now* starts a project whose prerequisites are done. *Queue path* on a locked project queues every missing
prerequisite in a valid order, so you can aim for Fusion power on day one and let the colony work through the chain.
The current project and queue sit above the tree; tap × to drop one.

**Colony bonuses** (★) are permanent passive effects from finished projects. They stack. Everything a project gives is also
listed in the letter you get when it completes.

| Bonus | From | All projects together |
| --- | --- | --- |
| Crop growth speed | Crop rotation, Irrigation, Agronomy, Genetic crops | +50% crop growth speed |
| Harvest yield | Soil tilling, Fertilizers, Genetic crops | +40% harvest yield |
| Crops survive colder nights | Agronomy, Genetic crops | crops survive colder nights (−14°C) |
| Taming success | Animal husbandry | +25% taming success |
| Milk, wool & eggs | Animal husbandry, Selective breeding | +40% milk, wool & eggs |
| Meat & leather from butchering | Selective breeding | +30% meat & leather from butchering |
| Food spoilage | Food preservation | −30% food spoilage |
| Cooking & butchering speed | Haute cuisine | +25% cooking & butchering speed |
| Crafting speed | Tool making, Mass production, Advanced fabrication, Nanofabrication | +75% crafting speed |
| Construction speed | Masonry, Prefab construction, Arcology design | +60% construction speed |
| Mining speed | Geology | +20% mining speed |
| Mining yield | Geology | +15% mining yield |
| Sowing, harvesting & chopping speed | Agronomy | +25% sowing, harvesting & chopping speed |
| Research speed | Writing, Scientific method, Computing, AI persona cores, Neural uplinks, Archotech studies | +100% research speed |
| All work speed | Automation, AI persona cores, Archotech studies | +35% all work speed |
| Crafted & built quality | Metallurgy, Advanced fabrication, Nanofabrication | +3 crafted & built quality levels |
| Building durability | Metallurgy, Masonry, Reinforced construction | +45% building durability |
| Beauty from furniture & art | Fine arts, Interior design, Arcology design | +50% beauty from furniture & art |
| Tend quality | Herbalism, Anatomy | +15% tend quality |
| Infection chance | Antiseptics, Sterile materials, Archotech longevity | −90% infection chance |
| Immunity gain | Vaccination, Genetics, Archotech longevity | +85% immunity gain |
| Bleeding | Blood transfusion | −30% bleeding |
| Wound healing speed | Hospital equipment, Regenerative medicine, Archotech longevity | +165% wound healing speed |
| Pain | Anesthesia, Neural regeneration | −50% pain |
| Medicine potency | Pharmacology, Glitterworld medicine | +30% medicine potency |
| Rest recovery | Sleep science, Bioengineering | +25% rest recovery |
| Mood | Luxury living, Arcology design, Philosophy, Festivals, Psychology, Archotech studies | +16 mood |
| Mental break threshold | Neural regeneration, Philosophy, Psychology | −40% mental break threshold |
| Recreation gain | Music, Festivals, Orchestration, Mass media | +50% recreation gain |
| Skill learning | Pedagogy, Neural uplinks | +60% skill learning |
| Shooting accuracy | Archery, Tactical doctrine, Ballistics | +15% shooting accuracy |
| Melee damage | Martial training | +15% melee damage |
| Melee hit chance | Martial training | +5% melee hit chance |
| Turret damage | Ballistics | +20% turret damage |
| Cover effectiveness | Fortification, Trench warfare, Tactical doctrine | +35% cover effectiveness |
| Walking speed | Bioengineering, Logistics | +10% walking speed |
| Power generation | Smart grid, Photovoltaic arrays, Zero-point energy | +35% power generation |
| Battery capacity | Smart grid | +30% battery capacity |
| Lighting power use | Efficient lighting | −50% lighting power use |
| Trade prices in your favour | Commerce, Diplomacy | +15% trade prices in your favour |
| Prisoner recruitment | Prison reform, Diplomacy | +55% prisoner recruitment |
| Raid size | Diplomacy | −10% raid size |
| Frequency of good events | Commerce, Logistics, Orbital mechanics | +30% frequency of good events |
| Food poisoning chance | Haute cuisine | −60% food poisoning chance |

### Agriculture

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Crop rotation | Frontier | 300 | — | — | +10% crop growth speed | Rotate fields to keep soil healthy. Crops grow faster. |
| Animal husbandry | Frontier | 350 | — | — | +25% taming success, +20% milk, wool & eggs | Understand animal behaviour: easier taming and more milk, wool and eggs. |
| Soil tilling | Frontier | 500 | Crop rotation | — | +10% harvest yield | Turn and aerate the soil for bigger harvests. |
| Food preservation | Frontier | 500 | — | — | −30% food spoilage | Salting, smoking and pickling. Food spoils more slowly. |
| Beekeeping | Frontier | 600 | Animal husbandry | beehive | — | Build beehives that fill with honey: food that never spoils and cooks like vegetables. |
| Irrigation | Settlement | 900 | Soil tilling | moisture pump | +5% crop growth speed | Moisture pumps slowly drain marsh, mud and shallows into farmable soil. |
| Granaries | Settlement | 800 | Food preservation | grain silo | — | Grain silos hold six stacks of raw food per cell. |
| Devilstrand | Settlement | 800 | Complex clothing | devilstrand mushroom | — | Grow tough devilstrand fabric in the dark. |
| Haute cuisine | Settlement | 1300 | Food preservation | — | +25% cooking & butchering speed, −60% food poisoning chance | Professional kitchen technique: faster cooking and far fewer bad meals. |
| Selective breeding | Settlement | 1500 | Animal husbandry, Soil tilling | — | +30% meat & leather from butchering, +20% milk, wool & eggs | Breed for size and yield: more meat, leather and animal products. |
| Hydroponics | Settlement | 700 | Electricity | hydroponics basin, sun lamp | — | Hydroponic basins and sun lamps for indoor farming. |
| Fertilizers | Industrial | 1800 | Irrigation, Chemistry | fertilizer pump | +10% harvest yield | Fertilizer pumps enrich the soil around them: +50% growth in a wide radius. |
| Nutrient paste | Industrial | 1600 | Electricity, Food preservation | nutrient paste dispenser | — | A dispenser that turns raw food into nutrient paste instantly. Efficient, if joyless. |
| Agronomy | Industrial | 2800 | Fertilizers, Hydroponics | — | +25% sowing, harvesting & chopping speed, crops survive colder nights (−6°C), +10% crop growth speed | Scientific farming: faster sowing and harvesting, hardier crops. |
| Genetic crops | Spacer | 3800 | Agronomy, Genetics | — | +25% crop growth speed, +20% harvest yield, crops survive colder nights (−8°C) | Engineered strains grow faster, yield more and shrug off frost. |
| Vat-grown meat | Spacer | 4800 | Genetic crops, Bioengineering | meat vat | — | Meat vats grow cultured meat from nutrient broth using power alone. |
| Terraforming | Ultratech | 7200 | Genetic crops, Fusion power | terraformer | — | Terraformers rebuild the ground around them into rich soil. |

### Industry

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Stonecutting | Frontier | 300 | — | stonecutter's table, granite tile, marble tile, sandstone tile, gold tile | — | Cut rock chunks into blocks at a stonecutter's table. Unlocks stone floors. |
| Smithing | Frontier | 700 | — | smithy, simple helmet | — | Build a smithy to forge melee weapons and helmets. |
| Complex clothing | Frontier | 600 | — | jacket, duster, parka, cowboy hat | — | Jackets, dusters, parkas and hats. |
| Tool making | Frontier | 500 | Smithing | tool cabinet | +5% crafting speed | Tool cabinets speed up every workbench near them. |
| Metallurgy | Frontier | 700 | Smithing | — | +1 crafted & built quality level, +10% building durability | Better alloys and heat treatment: better quality work and tougher buildings. |
| Chemistry | Settlement | 1000 | Metallurgy | biofuel refinery | — | Refine wood into chemfuel at a biofuel refinery. |
| Machining | Settlement | 1000 | Electricity | machining table | — | A machining table to produce firearms and armor. |
| Electric workshops | Settlement | 1400 | Machining | electric smithy, electric tailoring bench, electric smelter | — | Powered smithy, tailoring bench and smelter that work 50% faster. |
| Component assembly | Settlement | 1600 | Machining | component assembler | — | A component assembler makes components from steel, long before fabrication. |
| Mass production | Industrial | 2400 | Electric workshops | — | +25% crafting speed | Jigs, templates and assembly lines. |
| Deep drilling | Industrial | 2200 | Machining, Geology | deep drill | — | Deep drills pull steel, silver and uranium from far below while powered. |
| Fabrication | Industrial | 3000 | Microelectronics, Machining | fabrication bench | — | Fabrication bench: make components and advanced components. |
| Advanced fabrication | Spacer | 3600 | Fabrication | plasteel | +1 crafted & built quality level, +15% crafting speed | Precision fabrication: better quality, faster, and plasteel synthesis from steel. |
| Automation | Ultratech | 5000 | Mass production, AI persona cores | — | +10% all work speed | Robotic assistance on every task. |
| Nanofabrication (hi-tech) | Ultratech | 7000 | Advanced fabrication, AI persona cores | nano-assembler | +30% crafting speed, +1 crafted & built quality level | A nano-assembler builds advanced components atom by atom. |

### Construction

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Masonry | Frontier | 300 | — | concrete, steel tile | +10% construction speed, +10% building durability | Proper mortar and foundations: faster building, sturdier walls. |
| Complex furniture | Frontier | 600 | — | armchair, end table, dresser, billiards table, red carpet, blue carpet, green carpet | — | Armchairs, dressers, end tables, billiards and carpets. |
| Barracks planning | Frontier | 500 | Masonry | bunk bed | — | Bunk beds: two sleepers in one bed-sized footprint. |
| Fine arts | Settlement | 1000 | Complex furniture | grand sculpture, fountain | +10% beauty from furniture & art | Grand sculptures and fountains. Artists produce better work. |
| Fortification | Settlement | 900 | Masonry | embrasure | +10% cover effectiveness | Embrasures (walls you can shoot through) and barricade-grade engineering. |
| Passive cooler | Settlement | 300 | — | passive cooler | — | A wood-burning evaporative cooler. |
| Interior design | Settlement | 1200 | Complex furniture | couch, purple carpet, gold carpet | +15% beauty from furniture & art | Couches, bookshelves and new carpets. Everything looks better. |
| Reinforced construction | Settlement | 1500 | Masonry, Metallurgy | blast door | +25% building durability | Steel-reinforced structures and blast doors. |
| Luxury living | Industrial | 2400 | Interior design | royal bed, fine rug, silver tile | +2 mood | Royal beds, fine rugs and the comforts of the rich. |
| Air conditioning | Industrial | 600 | Electricity | cooler, vent | — | Coolers and vents. Build freezers to preserve food. |
| Prefab construction | Industrial | 2200 | Reinforced construction, Mass production | plasteel tile | +30% construction speed | Factory-made panels snap together. |
| Climate control | Industrial | 3000 | Air conditioning, Microelectronics | climate unit | — | Climate units heat or cool a room to its target on their own. |
| Autodoors | Industrial | 600 | Microelectronics | autodoor | — | Powered doors that open instantly. |
| Arcology design | Ultratech | 7500 | Luxury living, Prefab construction, AI persona cores | — | +4 mood, +25% beauty from furniture & art, +20% construction speed | Self-contained living spaces designed by machine minds. |

### Power

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Electricity | Frontier | 1600 | — | electric stove, power conduit, wood-fired generator, heater, standing lamp | — | Power conduits, generators, lamps, heaters and electric stoves. |
| Batteries | Settlement | 400 | Electricity | battery | — | Store power for the night. |
| Wind power | Settlement | 700 | Electricity | wind turbine | — | Wind turbines: free power whenever the wind blows. |
| Efficient lighting | Settlement | 700 | Electricity | floodlight | −50% lighting power use | Floodlights, and every lamp uses half the power. |
| Solar panels | Settlement | 600 | Electricity | solar generator | — | Generate power from sunlight. |
| Smart grid | Settlement | 1500 | Batteries | large battery | +30% battery capacity, +5% power generation | Large batteries and grid balancing. |
| Chemfuel power | Settlement | 1300 | Chemistry, Electricity | chemfuel generator | — | Chemfuel generators: steady 1500 W from refined fuel. |
| Geothermal power | Industrial | 2400 | Electricity, Geology | geothermal generator | — | Tap steam geysers for huge, constant power. |
| Photovoltaic arrays | Industrial | 2800 | Solar panels, Microelectronics | — | +10% power generation | Advanced solar arrays and better power electronics. |
| Nuclear fission | Spacer | 4500 | Smart grid, Geothermal power | fission reactor | — | Fission reactors: 6000 W from a trickle of uranium. |
| Fusion power (hi-tech) | Ultratech | 8500 | Nuclear fission, Advanced fabrication | fusion reactor | — | Fusion reactors: 12000 W with no fuel at all. |
| Zero-point energy (hi-tech) | Archotech | 11000 | Fusion power, Archotech studies | zero-point tap | +20% power generation | Pull energy from the vacuum itself. |

### Medicine

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Herbalism | Frontier | 300 | — | healroot | +5% tend quality | Grow healroot for herbal medicine. Tending improves. |
| Anatomy | Frontier | 600 | Herbalism | — | +10% tend quality | Know the body: better tending. |
| Medicine production | Settlement | 800 | Herbalism | hospital bed, drug lab, medicine | — | Drug lab, industrial medicine and hospital beds. |
| Antiseptics | Settlement | 900 | Anatomy | — | −40% infection chance | Clean wounds far less often turn septic. |
| Blood transfusion | Settlement | 1400 | Anatomy | — | −30% bleeding | Replace lost blood: slower bleeding out. |
| Vaccination | Settlement | 1500 | Antiseptics | — | +25% immunity gain | Primed immune systems beat diseases faster. |
| Sleep science | Settlement | 1300 | Anatomy | sleep accelerator | +10% rest recovery | Understand sleep cycles; unlocks the sleep accelerator. |
| Pharmacology | Industrial | 2400 | Vaccination, Medicine production | — | +20% medicine potency | Refined dosing makes every medicine stronger. |
| Hospital equipment | Industrial | 2200 | Medicine production, Microelectronics | vitals monitor | +15% wound healing speed | Vitals monitors improve tending at nearby beds. Wounds heal faster. |
| Sterile materials | Industrial | 700 | Microelectronics, Antiseptics | sterile tile | −10% infection chance | Sterile tile floors. Patients in clean rooms rarely get infected. |
| Genetics | Industrial | 3200 | Pharmacology | — | +10% immunity gain | Read and edit the genome. |
| Anesthesia | Industrial | 2600 | Pharmacology | — | −30% pain | Painkillers keep the wounded on their feet. |
| Regenerative medicine | Spacer | 4000 | Genetics, Hospital equipment | — | +50% wound healing speed | Tissue regrowth: wounds close twice as fast. |
| Bioengineering | Spacer | 4200 | Genetics | — | +15% rest recovery, +5% walking speed | Engineered metabolism: better sleep and stamina. |
| Glitterworld medicine | Spacer | 5500 | Regenerative medicine, Advanced fabrication | glitterworld medicine | +10% medicine potency | Synthesize glitterworld medicine at a drug lab. |
| Neural regeneration | Ultratech | 7000 | Glitterworld medicine | — | −20% mental break threshold, −20% pain | Stabilized minds: far fewer breakdowns, much less pain. |
| Archotech longevity (hi-tech) | Archotech | 10000 | Neural regeneration, Archotech studies | — | +100% wound healing speed, +50% immunity gain, −40% infection chance | Machine-god biology: near-instant healing and total immunity. |

### Military

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Archery | Frontier | 300 | — | recurve bow | +3% shooting accuracy | Recurve bows, and every shooter aims a little better. |
| Great bows | Frontier | 700 | Archery | great bow | — | Long-range great bows. |
| Martial training | Frontier | 600 | Smithing | — | +15% melee damage, +5% melee hit chance | Drills and sparring: harder, surer melee strikes. |
| Plate armor | Settlement | 900 | Metallurgy | plate armor | — | Forge full plate armor at a smithy. |
| Trench warfare | Settlement | 800 | Fortification | — | +15% cover effectiveness | Dig in: cover protects much better. |
| Gunsmithing | Settlement | 500 | Machining | revolver, autopistol, bolt-action rifle, pump shotgun, frag grenades | — | Revolvers, autopistols, rifles, shotguns and grenades. |
| Explosives | Settlement | 1400 | Chemistry | IED trap | — | IED traps: buried explosives for your perimeter. |
| Incendiaries | Industrial | 1300 | Chemistry, Gunsmithing | molotov cocktails | — | Molotov cocktails set raiders and their cover alight. |
| Flak armor | Industrial | 1200 | Machining, Plate armor | flak vest, flak helmet | — | Protective flak vests. |
| Gas operation | Industrial | 800 | Gunsmithing | assault rifle, LMG | — | Assault rifles and LMGs. |
| Precision rifling | Industrial | 900 | Gunsmithing | sniper rifle | — | Sniper rifles. |
| Gun turrets | Industrial | 1200 | Gunsmithing | mini-turret | — | Automated mini-turrets. |
| Tactical doctrine | Industrial | 2000 | Gunsmithing, Trench warfare | — | +8% shooting accuracy, +10% cover effectiveness | Fire and manoeuvre: better accuracy from cover. |
| Firefoam | Industrial | 1800 | Chemistry, Electricity | firefoam popper | — | Firefoam poppers smother any fire that starts near them. |
| Heavy weapons | Industrial | 2800 | Gas operation | heavy SMG, minigun, rocket launcher | — | Heavy SMGs, miniguns and rocket launchers. |
| Ballistics | Industrial | 2600 | Precision rifling, Gun turrets | — | +20% turret damage, +4% shooting accuracy | Better rounds and fire control: turrets hit much harder. |
| Autocannon turrets | Spacer | 3600 | Ballistics, Heavy weapons | autocannon turret | — | Heavy 2×2 autocannon turrets. |
| Uranium slug turrets | Spacer | 3800 | Ballistics, Precision rifling | uranium slug turret | — | Long-range uranium slug turrets. |
| EMP technology | Spacer | 3800 | Microelectronics, Explosives | EMP grenades | — | EMP grenades wreck and stun mechanoids. |
| Personal shields | Spacer | 4200 | Microelectronics, Flak armor | shield belt | — | Shield belts absorb incoming bullets until drained. |
| Recon armor | Spacer | 4000 | Flak armor, Fabrication | recon armor, recon helmet | — | Light powered armor that does not slow you down. |
| Powered armor | Spacer | 4500 | Recon armor | marine armor, marine helmet | — | Marine armor and helmets. |
| Charged shot | Spacer | 3500 | Fabrication, Gas operation | charge rifle, charge lance | — | Charge rifles. |
| Cataphract armor (hi-tech) | Ultratech | 6500 | Powered armor, Advanced fabrication | cataphract armor, cataphract helmet | — | The heaviest armor ever made for a human. |
| Monomolecular blades (hi-tech) | Ultratech | 6500 | Martial training, Advanced fabrication | monosword | — | Monoswords that cut through almost anything. |
| Pulse weapons (hi-tech) | Ultratech | 7000 | Charged shot, Fusion power | pulse rifle | — | Pulse rifles: ultratech firepower. |

### Society & science

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Writing | Frontier | 300 | — | bookshelf | +10% research speed | Record knowledge. Research is faster; unlocks bookshelves. |
| Music | Frontier | 400 | — | harp | +5% recreation gain | Harps to play and gather around. |
| Philosophy | Frontier | 600 | Writing | — | +2 mood, −5% mental break threshold | A sense of meaning: better mood and resilience. |
| Brewing | Frontier | 500 | — | beer | — | Brew beer — a cheap source of recreation. |
| Commerce | Frontier | 700 | Writing | — | +8% trade prices in your favour, +10% frequency of good events | Haggling and bookkeeping: better trade prices, more traders. |
| Scientific method | Settlement | 1000 | Writing | — | +15% research speed | Hypothesis, experiment, repeat. |
| Pedagogy | Settlement | 900 | Writing | — | +20% skill learning | Structured teaching: everyone learns skills faster. |
| Prison reform | Settlement | 800 | Philosophy | — | +40% prisoner recruitment | Humane prisons recruit far more prisoners. |
| Festivals | Settlement | 700 | Music, Brewing | — | +20% recreation gain, +1 mood | Celebrations lift everyone. |
| Geology | Settlement | 900 | Stonecutting | — | +20% mining speed, +15% mining yield | Read the rock: faster, richer mining. |
| Psychology | Settlement | 1500 | Philosophy, Anatomy | — | −15% mental break threshold, +2 mood | Counselling and stress management. |
| Diplomacy | Settlement | 1400 | Commerce, Philosophy | — | −10% raid size, +7% trade prices in your favour, +15% prisoner recruitment | Envoys and treaties: fewer raiders come for you and prices improve. |
| Orchestration | Settlement | 1200 | Music, Fine arts | piano | +10% recreation gain | Pianos: beautiful, and wonderful to play. |
| Microelectronics | Industrial | 2500 | Electricity, Scientific method | hi-tech research bench, comms console, tube television | — | Comms console, hi-tech research bench, televisions. |
| Logistics | Industrial | 2000 | Commerce | — | +5% walking speed, +10% frequency of good events | Better routes and packing: everyone moves faster. |
| Computing | Industrial | 3000 | Microelectronics | multi-analyzer | +10% research speed | Multi-analyzers speed up research benches around them. |
| Mass media | Industrial | 2500 | Microelectronics | megascreen television | +15% recreation gain | Megascreen televisions and broadcast entertainment. |
| AI persona cores (hi-tech) | Spacer | 5500 | Computing, Advanced fabrication | — | +20% research speed, +5% all work speed | Machine minds assist your researchers and workers. |
| Neural uplinks (hi-tech) | Ultratech | 7500 | AI persona cores, Neural regeneration | — | +40% skill learning, +25% research speed | Direct brain-computer links: learning and research soar. |

### Space & ultratech

| Project | Era | Cost | Requires | Unlocks | Colony bonus | Description |
| --- | --- | --- | --- | --- | --- | --- |
| Orbital mechanics | Industrial | 3000 | Microelectronics | — | +10% frequency of good events | The maths of orbits. Orbital traders call more often. |
| Starflight basics (hi-tech) | Spacer | 4000 | Fabrication, Orbital mechanics | ship structural beam, ship computer core | — | Ship structural beams and computer core. |
| Orbital scanning | Spacer | 4000 | Orbital mechanics, Computing | orbital scanner | — | Orbital scanners spot falling cargo and guide it down to you. |
| Cryptosleep (hi-tech) | Spacer | 2500 | Starflight basics | cryptosleep casket | — | Cryptosleep caskets to carry your colonists. |
| Starship drive (hi-tech) | Spacer | 6000 | Starflight basics | ship reactor, ship engine | — | Ship reactor and engines. Build a ship and escape this rimworld! |
| Weather control (hi-tech) | Ultratech | 8000 | Orbital scanning, Fusion power | weather controller | — | Weather controllers hold the sky clear over your colony. |
| Archotech studies (hi-tech) | Archotech | 12000 | Neural uplinks, Weather control | — | +20% all work speed, +5 mood, +20% research speed | Glimpse the minds of the archotechs. Everything your colony does gets better. |
| Archotech monument (hi-tech) | Archotech | 9000 | Archotech studies, Fine arts | archotech monument | — | A monument of impossible geometry that fills every nearby colonist with awe. |

**New mechanics from the tree**, all simulated: beehives (honey never spoils), meat vats and deep drills that produce on
their own while powered, moisture pumps that dry marsh into soil, fertilizer pumps (+50% growth nearby), terraformers
(sand, gravel, marsh and bare stone into rich soil), grain silos (food spoils at half speed), tool cabinets (+6% bench
speed each, two at most), sleep accelerators and vitals monitors beside beds, sterile floors (clean rooms cut infections;
filthy rooms raise them), embrasures you can shoot through, blast doors, climate units that heat or cool, IED traps,
firefoam poppers that smother fires and recharge, powered autocannon and uranium slug turrets, EMP grenades that wreck and
stun machines but not people, shield belts that soak up bullets until drained, an orbital scanner that guides cargo down
every few days, a weather controller that holds the sky clear, and the archotech monument (+10 mood nearby).

## AI minds (DeepSeek)

Turn on **Menu → AI minds** and every colonist is played by a language model, DeepSeek (`deepseek-flash`, thinking
mode off, JSON output). The Work tab stops being orders and becomes advice the colonists may follow.

**What the model sees.** A compact briefing written from the colonist's point of view: who they are (backstory, traits
with their meaning, skills and passions, work they refuse), the time, weather and where they are, needs and the feelings
behind their mood, injuries, colony stores and research, danger on the map, everyone they know with what they are doing
and mutual opinions, animals nearby, which kinds of work are actually waiting, their own memories, recent conversation,
and what just happened to them (someone spoke to them, they got hurt, a letter arrived).

**What it decides.** One JSON object per decision: an inner thought, an action, how long to keep at it, optional words to
say out loud and an optional note to remember. The game turns that into ordinary jobs.

| Action | What happens |
| --- | --- |
| work | does one kind of work (firefight, doctor, warden, handle, cook, hunt, construct, grow, mine, plantcut, smith, tailor, art, craft, haul, clean, research) |
| eat / sleep / relax | finds food, a bed, or recreation |
| talk | walks over to someone and says the chosen line with a tone: friendly, joke, deep, comfort, praise, flirt, apologize, argue, insult. Tones have real effects: jokes can land or fall flat, comfort helps a sad friend, flirting can start a romance or get rebuffed, apologies erase grudges, insults can end in a fistfight |
| tend / fight / flee | doctors someone, attacks a hostile, or runs |
| go / idle | walks to a place (kitchen, fields, a person…) or stands and thinks |

**When it decides.** When the current plan runs out, when someone speaks to them, when they are hurt, when danger appears,
when important news arrives, and at least every few hours. Routine decisions are at least 22 game-minutes apart. While the
model is thinking (a little thought cloud over their head) the colonist keeps doing their previous plan.

**What it can't override.** The body: colonists still collapse from exhaustion, eat when starving, flee a raider who gets
too close, have mental breaks, and obey your draft orders. Drafted colonists are yours.

**Watching it.** Speech bubbles over heads; the inspector's Mind tab (current thought, plan, memories, recent lines,
events they haven't reacted to yet); Colony → Voices, a log of everything said and thought.

**Where the model runs.**

| Option | How |
| --- | --- |
| This server's key | The deployment calls DeepSeek with its own key through `/api/llm` (a Vercel Edge Function, the Vite dev server, or `server/relay.mjs`). Set `DEEPSEEK_API_KEY`; optionally `LLM_PASSWORD` so only your friends can use it |
| My own DeepSeek key | Paste a key from platform.deepseek.com in the AI minds window. It stays in that browser and goes only to the proxy (or straight to DeepSeek) |
| Offline mind | A small rule-based personality, no network, free. Also takes over automatically if the key is missing or rejected |

**Cost.** Prompts are ordered so DeepSeek's prefix cache can reuse them (shared rules, then the colonist's persona, then
the changing part), replies are capped short, and thinking mode is off. At list prices ($0.3/M new input tokens, $0.006/M cached,
$1.2/M output; half price off-peak) a decision costs roughly $0.0002–0.0004 and a colonist makes about 40 decisions per game day:
under a cent per colonist per game day. The AI minds window shows tokens and money spent live, lets you cap decisions per
minute, and stops at a per-session budget (default $1). In multiplayer every player's own device runs (and pays for) their colony's minds.

## Combat & defense

**Drafting:** drafted colonists stop working and take orders: tap the ground to move (a group spreads out), tap an enemy to
attack. With *fire at will* on (default) they shoot any enemy in range. Undrafted colonists flee from nearby enemies and fight
back in melee when cornered.

**Shooting:** hit chance depends on distance band, Shooting skill, the weapon's accuracy, weather and the target's
cover (walls, sandbags, barricades, trees, furniture). Shots can miss into other things. Aim time (warmup), bursts and
cooldowns follow the weapon. Careful shooters aim longer and hit more; trigger-happy ones fire faster and miss more.

**Damage & armor:** armor can deflect or reduce damage based on the weapon's armor penetration. Melee attacks can be dodged
(Nimble helps). Explosions from grenades, destroyed turrets, boomalopes and short circuits damage everything nearby and can
start fires.

**Raids:** raiders gather at the edge of your colony, then assault. They bash through walls and doors when they have to,
and may carry off downed colonists as they leave. They **flee after losing half their group** (or after about a day).
Raid size grows with colony wealth, colonist count, time played and difficulty. Later raids can arrive by **drop pod** right
inside your base (after day 18), and after day 12 some raids are **mechanoids**: scythers (melee blades), lancers (charge
lances) and centipedes (heavy blasters). Mechanoids never flee early and leave after about three days.

**Defenses:** mini-turrets (auto-fire; explode when destroyed), spike traps (hidden, single use), sandbags and barricades
(cover), walls and doors. Manhunting animals cannot open doors, so staying indoors works against them.

**After a fight:** rescue downed colonists (long-press → Rescue), tend wounds, and **capture** downed enemies as prisoners.
Prisoners live in a room with a prison bed and eat food left there; wardens visit to recruit them (Social skill vs. the
prisoner's resistance). Each prisoner can be set to recruit, hold or release.
Corpses cause mood penalties: bury them in graves or dump them.

## Animals

Wild animals graze, sleep, wander in herds, flee from danger and repopulate over time. Predators hunt other animals when hungry
(and rarely, desperately, people) and eat their kills. Hurting an animal may make it **fight back or go manhunter** (see
chance below); fights between wild animals stay between them. Colonists can **hunt** (meat, leather/fur), **tame** (Animals
skill vs. wildness; tamed animals join the colony), **milk**, **shear** and **slaughter** them. Some animals self-tame and
join on their own. Mechanoids appear only in raids.

| Animal | Size | HP | Speed | Diet | Attacks | Wildness | Revenge chance | Products | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hare | 0.2 | 30 | 5.5 | grazer | bite 3 | 50% | 10% | 12 meat, 6 leather | flees |
| Squirrel | 0.15 | 20 | 5 | grazer | bite 2 | 60% | 10% | 8 meat, 4 leather | flees |
| Deer | 1 | 90 | 5.5 | grazer | headbutt 8, kick 7 | 60% | 5% | 70 meat, 30 leather | herds of 1–4, flees |
| Wild boar | 0.9 | 90 | 4.2 | omnivore | headbutt 10, bite 9 | 50% | 20% | 60 meat, 25 leather | herds of 1–3 |
| Muffalo | 2.4 | 200 | 4 | grazer | headbutt 14, kick 10 | 30% | 5% | 140 meat, 60 leather, 30 wool every 15d, 12 milk every 2d | herds of 3–7, pack animal |
| Alpaca | 1 | 80 | 4.3 | grazer | kick 6 | 35% | 10% | 60 meat, 25 leather, 20 wool every 12d | herds of 2–5, pack animal |
| Timber wolf | 0.85 | 85 | 5.8 | carnivore | bite 13, claw 7 | 85% | 50% | 50 meat, 20 thick fur | predator, herds of 2–5 |
| Cougar | 0.9 | 100 | 6 | carnivore | claw 12, bite 14 | 90% | 60% | 55 meat, 20 thick fur | predator |
| Grizzly bear | 2.2 | 280 | 4.5 | omnivore | claw 20, bite 22 | 85% | 70% | 140 meat, 45 thick fur | predator |
| Boomalope | 1.3 | 110 | 3.6 | grazer | headbutt 8 | 50% | 10% | 60 meat, 20 leather | herds of 1–2, explodes when killed |
| Thrumbo | 4 | 600 | 5.5 | grazer | headbutt 35, kick 28 | 98% | 95% | 250 meat, 80 thick fur | rare, armor 50% |
| Chicken | 0.3 | 30 | 3.5 | grazer | bite 2 | 10% | — | 10 meat, 1 eggs every 1d | domestic, flees |
| Cow | 2 | 160 | 3.8 | grazer | headbutt 10 | 10% | — | 130 meat, 50 leather, 14 milk every 1d | domestic |
| Husky | 0.9 | 90 | 5.5 | carnivore | bite 11 | 0% | — | 40 meat, 15 leather | domestic, pet |
| Cat | 0.3 | 35 | 5 | carnivore | claw 4 | 0% | — | 12 meat, 5 leather | domestic, pet |
| Scyther | 1 | 150 | 5.2 | — | blade 20, blade 20 | — | — | — | mechanoid, armor 40% |
| Lancer | 1 | 150 | 4.2 | — | headbutt 9, charge lance | — | — | — | mechanoid, armor 40% |
| Centipede | 3 | 450 | 2 | — | headbutt 15, heavy charge blaster | — | — | — | mechanoid, armor 70% |

## Events & storytellers

The storyteller schedules **big threats** every few days (raid or manhunter pack), **smaller trouble** in between, and
**good events** every 1.5–3 days. Threat size ("points") grows with your wealth, colonist count, days survived and difficulty.
Peaceful difficulty turns raids and manhunters off.

| Event | Kind | What happens | What to do |
| --- | --- | --- | --- |
| Raid | threat | Pirates arrive at the edge (or by drop pod later) and assault | Draft all, fight from cover; they flee at half losses |
| Mechanoid raid (day 12+) | threat | Armored machines attack; they don't flee early | Focus fire, use cover and turrets |
| Manhunter pack | threat | Maddened animals (priced by how dangerous they are) attack anyone they see for 1–2 days | Stay indoors; they can't open doors |
| Mad animal | bad | One nearby animal goes manhunter for a day | Shoot it or avoid it |
| Small raid (day 6+) | bad | A smaller band of raiders | As for raids |
| Disease | bad | Flu, plague or malaria strikes one or two colonists | Bed rest and a doctor |
| Crop blight | bad | Destroys part of your fields | Replant |
| Short circuit | bad | A battery discharges in an explosion and starts a fire | Firefight; keep batteries under roof |
| Psychic drone / soothe | bad / good | Colony-wide mood −15 / +12 for a day | — |
| Solar flare, eclipse, cold snap, heat wave, toxic fallout, aurora | world | See [Time, seasons & weather](#time-seasons--weather) | — |
| Trade caravan | good | Traders walk in and stay about a day | Tap the trader to trade |
| Orbital trader | good | A trade ship in range for about a day | Trade from a powered comms console; goods arrive by drop pod |
| Visitors | neutral | A friendly group passes through | Attacking them turns them hostile |
| Wanderer joins | good | A new colonist joins | — |
| Transport pod crash | neutral | An injured person crashes nearby | Rescue (they may join) or capture |
| Cargo pods | good | Supplies land nearby (steel, wood, silver, components, meals, medicine…) | Haul them in |
| Herd migration | neutral | A herd passes through | Hunting opportunity |
| Animal self-tamed | good | An animal joins your colony | — |
| Meteorite | good | An ore-filled rock crashes nearby | Mine it |
| Ship chunk | good | Spaceship wreckage lands | Deconstruct for steel and components |
| Thrumbo passes | neutral | A rare, powerful, peaceful beast | Leave it alone, or hunt it with everything you have |

## Trading, visitors & factions

Silver is the currency. Traders (bulk goods, combat supplier, exotic goods…) carry silver, materials, food, medicine, weapons
and apparel with random quality; orbital traders also stock plasteel, uranium, advanced components, glitterworld medicine,
charge rifles and marine armor. In the trade window you balance what you give and take.

Non-player factions: **pirates** (raiders), **mechanoids**, and friendly **outlanders** and **tribes** (visitors and traders).
Goodwill drops if you attack them. See the Colony tab → Factions.

## Endgame: build a ship

The win condition. Research Starflight basics, Cryptosleep and Starship drive (on a hi-tech research bench), then build:

| Ship part | Cost | Research |
| --- | --- | --- |
| Ship structural beam | 70 steel + 30 plasteel | Starflight basics |
| Cryptosleep casket | 180 steel + 5 uranium + 4 components | Cryptosleep |
| Ship computer core | 150 steel + 100 plasteel + 4 advanced components | Starflight basics |
| Ship reactor | 350 steel + 280 plasteel + 200 uranium + 10 advanced components | Starship drive |
| Ship engine | 280 steel + 200 plasteel + 70 uranium + 6 advanced components | Starship drive |

You need at least an engine, a computer core and one cryptosleep casket, plus the reactor. Starting the reactor begins a
**3-day countdown** during which raids hit every 8 hours or so. When it finishes, the ship launches with your colonists and you
win. In multiplayer, other players are told a rival ship is launching.

## Multiplayer

Up to 4 players each run their own colony on one shared map, playing at the same time.

| Feature | How it works |
| --- | --- |
| Hosting | Host multiplayer → set up your colony. A 5-letter room code appears; Menu shows it with a Copy invite link button |
| Joining | Join multiplayer, or open an invite link; pick your crew and a landing spot away from other colonies |
| Simulation | The host's device runs the world; everyone else sees it live. If the host leaves or switches apps, the world pauses and others see "waiting for host" |
| Speed | The world runs at the slowest speed any player picked, so anyone can pause. The top bar shows who is holding it down |
| Territory | Each colony has its own home area, zones and stockpiles. You can't take another colony's stored items unless you are at war |
| Shared world | Weather, seasons, wildlife and world conditions (eclipses, fallout, cold snaps…) are shared; raids, traders, visitors and other storyteller events are rolled per colony |
| Diplomacy | Colony tab → Diplomacy: offer peace or an alliance (the other player accepts), end an alliance, or declare war (if PvP is allowed). At war, colonists can attack each other and raid stockpiles |
| Player trading | Send another colony a trade offer (what you give / what you want, with a note); if accepted, goods arrive by drop pod |
| Chat | In-game chat between players |
| Reconnecting | A dropped player gets a Reconnect button; rejoining from the same browser reclaims their colony. Re-hosting a save reuses its room code |
| Connection | Direct peer-to-peer (WebRTC); optional TURN server or WebSocket relay for strict networks (see README) |

## Saving

The host autosaves every in-game day and whenever the app is hidden. Menu → Save game makes a manual save; the title screen
offers *Continue* and *Load game*. *Export save file* downloads a `.sfsave` file you can import on another device.
Multiplayer saves include every colony; loading one lets you host it again for your friends.

## Art, sound & presentation

- All in-game art is pixel art generated in code at startup: terrain with blended edges, cliffs and shadows, plants that grow
  through visible stages, buildings that link together (walls, sandbags), items, animals, mechanoids and interface icons.
- Colonists are layered 20×28 paper dolls: face with eyes, brows and mouth, 10 hairstyles, beards, freckles and age lines,
  each clothing layer drawn separately (shirts, trousers, jackets, vests, dusters, parkas, plate, powered armor, shield belts)
  and a four-frame walk in front, side and back views. Portraits are a separate 32×32 bust whose expression follows mood
  (happy, neutral, sad with a tear, angry, hurt).
- Day/night lighting with warm fire and lamp glows, per-room darkness, rain, snow, fog and lightning overlays, particles
  (muzzle flashes, blood, sparks, smoke, dust), floating text and screen shake for explosions.
- Sound effects and music are synthesized live. The music drifts through calm frontier progressions and switches to a tense
  pulse while raiders or manhunters threaten your colony.
- Home-screen install (PWA) for full-screen play on iPad and iPhone; adapts to notches and safe areas; works in landscape too.

## Known gaps

Things that exist in the game's text or data but are not (fully) simulated yet:

- **Night owl** trait: Not simulated yet: no night-work preference or mood effect.
- **Undergrounder** trait: Not simulated yet: there are no indoor/outdoor mood effects for it to cancel.
- **Pyromaniac** trait: Refusing firefighting works; fire-starting and the fire mood bonus are not simulated yet.
- **Brawler** trait: Better melee hit chance works; the dislike of guns is not simulated yet.
- **Great memory** trait: Acts as +10% learning; skills never decay in this game, so there is nothing to slow.
- Thoughts defined but never triggered: Broke up, Colony sold a prisoner, Colony was merciful, Colony executed a prisoner, Had a meltdown, Uncomfortable, Cramped interior, Pyromaniac: enjoyed a fire, Cabin fever.
- Only one inspiration type (work frenzy). A "creativity" inspiration is checked for quality rolls but never granted.
- Hospital beds on their own don't speed healing (a vitals monitor beside a bed does, and resting in any bed does).
- AI minds choose kinds of work, not specific targets: the job system still picks which plant to sow or which item to haul.
- No world map, caravans travelling off-map, prosthetics or surgery.
