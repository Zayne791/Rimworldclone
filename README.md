# Starfall Colony

A pixel-art colony survival sim for the web, inspired by RimWorld. Your crew crash-lands on a
frontier world: build shelter, grow food, research technology, survive raids, disease, weather and
their own mental breakdowns, and finally build a ship to escape. You can play alone or share one
map with friends, each running your own colony. Optionally, every colonist can be played by a
language model (DeepSeek) that decides what they do, what they say and to whom.

Designed first for **iPad in portrait**, and it plays well on iPhone and desktop too. All in-game
art is procedurally generated pixel art, drawn in code at startup (only the home-screen icons are
PNG files, and a script draws those too). Sound effects and music are synthesized live.

## Play locally

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from your iPad on the same Wi-Fi)
```

Other scripts:

| command | what it does |
| --- | --- |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | TypeScript type check |
| `npm run simtest -- 6 120 seed` | headless simulation soak test (days, map size, seed) |
| `npm run relay` | optional WebSocket relay + static server (see Multiplayer) |

## Deploy to Vercel

The game is a static site, so Vercel only needs the build output:

1. Push this repository to GitHub (already done if you're reading this there).
2. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub and **Import** the repository.
3. Vercel detects Vite automatically (`vercel.json` pins it anyway): build command `npm run build`,
   output directory `dist`. Press **Deploy**.
4. Open the URL it gives you on your iPad. In Safari tap **Share → Add to Home Screen** to get
   full-screen play without browser bars.

Every push to `main` redeploys automatically.

## AI minds (DeepSeek)

With **Menu → AI minds** turned on, each colonist is played by DeepSeek (`deepseek-flash`, thinking
mode off, JSON output). The model gets a first-person briefing (who they are, needs, feelings,
health, colony state, danger, the people around them, work that's waiting, their memories and what
was just said to them) and answers with a thought, an action, how long to keep at it, and anything
they say out loud. The game turns that into ordinary jobs and conversations with real social effects.
Draft orders, starvation, exhaustion, fleeing and mental breaks still override it.

**Set it up on Vercel** (the key never reaches the browser):

1. Get an API key at [platform.deepseek.com](https://platform.deepseek.com) and add a little credit.
   DeepSeek is prepaid, so your balance is the most anyone can ever spend.
2. Vercel → your project → **Settings → Environment Variables**: add `DEEPSEEK_API_KEY`.
   Optional: `LLM_PASSWORD` (players must type it in the AI minds window before the key is used),
   `DEEPSEEK_MODEL` (default `deepseek-flash`), `LLM_RATE_PER_MIN` (per-IP limit, default 90).
3. Redeploy. `api/llm.js` (an Edge Function) proxies requests to DeepSeek with that key.
4. In the game: Menu → AI minds → *This server's key* → *Turn AI minds on*. *Test connection* checks it.

Other ways to run it:

- **Your own key**: choose *My own DeepSeek key* and paste it; it is stored only in that browser.
- **Local dev**: copy `.env.example` to `.env.local`, put the key in, `npm run dev`. The dev server
  serves the same `/api/llm`.
- **Relay server**: `server/relay.mjs` also serves `/api/llm` when `DEEPSEEK_API_KEY` is set.
- **Offline mind**: a small rule-based personality with no network. It's free, and it takes over
  automatically if the key is missing or rejected.

**Cost.** Prompts are ordered for DeepSeek's prefix cache (shared rules → the colonist's persona →
the changing situation), replies are short and thinking is off. A decision is about 1,300 prompt
tokens (mostly cached) and 60–80 output tokens, roughly $0.0002–0.0004. A colonist makes about 40
decisions per game day, so it costs under a cent per colonist per game day, and half that off-peak.
The AI minds window shows tokens and spend live, caps decisions per minute and stops at a
per-session budget (default $1). In multiplayer, each player's device runs its own colony's minds.

## Leader mode: talk to your people

With AI minds on, **leader mode** is on by default (Menu → AI minds to switch it off). There are no
work orders. You can still place blueprints, zones, bills and research, but nothing gets done until
a colonist **agrees to it in conversation with you**:

- **Talk face to face.** Tap a colonist → **Talk** (or the Work tab's People view, or the banner
  when someone asks for you). A close-up of their face opens: pixel-art portrait that blinks,
  lip-syncs and changes expression, and a dialog box that types their words out in their own
  babbling voice, Animal Crossing style. **Tap the mic and speak** (Safari on iPad/iPhone, Chrome,
  Edge); it sends when you stop talking. Or tap ⌨ to type. Suggestion chips help you start.
- **Persuade, don't order.** Ask for a one-off job ("could you build the barracks walls?") or a
  regular duty ("would you make cooking your job, mornings?"). Personality, skills, passions,
  mood, needs, workload and **trust in you** decide the answer. Explaining why, praise, fairness
  and kept promises work; demands, threats and insults backfire and cost trust. They haggle: "I'll
  do it if I get a proper bed". Say yes and it's recorded as your promise.
- **They come to you.** Colonists ask for a word with requests, complaints, offers to take on work
  nobody is doing, warnings, feelings, and **disputes** with each other. A banner shows who wants
  to talk (💬 on their portrait and over their head). **Hear both** brings the two sides together
  to mediate; **＋ Bring in** adds anyone to a talk. Ignore someone for half a day and it stings.
- **Speak to everyone.** 📣 *Address everyone* (Work tab) gathers the colony; each person answers
  for themselves.
- **Trust** (−100…100) rises when you listen, praise honest work and keep your word, and falls
  with neglect, overwork, broken promises and harsh words. People who've lost faith refuse to be
  drafted, and eventually walk away.
- Duties live in the Talk screen's *Duties* panel and the inspector's Mind tab: you can always
  release someone or change the order; asking for more takes another conversation. Firefighting
  and tending the wounded happen without asking.

Offline (no key) the same screen runs on a rule-based talker that reads your requests, tone and
reasons, so you can try it for free. A talk turn with DeepSeek costs about as much as a decision.

## Multiplayer

Multiplayer is **separate colonies on a shared map**. One player hosts, and friends join with a
5-letter room code. Everyone lives on the same planet at the same time: you can trade, visit, fight
the same raids and even declare war on each other (Diplomacy).

- **Host**: *Host multiplayer* on the main menu, then set up your colony. The room code is shown
  when the room opens and any time in the **Menu** tab, which also has a *Copy invite link* button.
  Friends who open the link go straight to the join screen.
- **Join**: *Join multiplayer*, type the code, then pick your crew and landing spot.
- The host's device runs the simulation, so the world pauses for everyone if the host leaves or
  switches away from the app (clients see "waiting for host"). Hosting on the most powerful device helps.
- Game speed is the slowest speed anyone has chosen, so any player can pause for everyone.
- If a connection drops, tap *Reconnect*. Rejoining from the same browser reclaims your colony.
- Saves made by the host include every colony. Load one and choose "host" to continue together.

### How players connect

Players connect **peer-to-peer over WebRTC**, so no game server is needed and it works on Vercel as-is.
The free public PeerJS broker (`0.peerjs.com`) is used only to exchange connection info.

Some strict networks (certain cellular carriers, corporate Wi-Fi) block peer-to-peer connections.
There are two fixes:

1. **Add a TURN server**. In Vercel → Project → Settings → Environment Variables, set:
   - `VITE_TURN_URL` (e.g. `turn:your-turn-host:3478`)
   - `VITE_TURN_USER`, `VITE_TURN_PASS`

   Then redeploy. Services like Metered or Twilio provide TURN servers.
2. **Use the WebSocket relay**. Run `server/relay.mjs` on any Node host (Render, Fly.io, Railway):
   `npm install && npm run build && npm run relay` (respects `PORT`). Everyone then opens the game with
   `?relay=wss://your-relay-host/relay` added to the URL, or you set `VITE_RELAY_URL` in Vercel.
   The relay also serves the game itself, so it can replace Vercel.

You can also point at your own PeerJS server with `VITE_PEER_HOST`, `VITE_PEER_PORT`,
`VITE_PEER_PATH` and `VITE_PEER_SECURE` (or `?peerhost=&peerport=&peerpath=&peersecure=` in the URL).

## Controls

**Touch (iPad / iPhone)**
- **Drag** to pan, **pinch** to zoom.
- **Tap** to select. **Double-tap** a colonist to select every colonist on screen, or use
  **Orders → Select box** to drag a selection box.
- **Long-press** anything for its context menu (haul, prioritize, rescue, equip, hunt…).
- With colonists selected and **drafted**, tap the ground to move and tap an enemy to attack.
- During a raid, a red **⚔ Draft all** button appears on the colonist bar.
- Bottom tabs: **Build**, **Orders** (mine, chop, harvest, hunt…), **Zones**, **Work** (priorities
  and schedules), **Research**, **Colony** (colonists, voices, animals, factions/diplomacy, stats, log), **Menu**.
- The hints on the left flag problems; tap one marked **›** to jump to the menu that fixes it.
- Build and zone tools support drag: drag out walls, rooms, stockpiles and fields.

**Keyboard / mouse**
- WASD / arrows to pan, wheel to zoom, left-drag to box-select, right-click for context menu.
- `Space` pause · `1`–`4` speed · `R` draft/undraft (or rotate while building) · `F` fire at will ·
  `B` build · `O` orders · `Z` zones · `Tab` next colonist · `Esc` cancel.

## What's in the game

This is the short version. **[FEATURES.md](FEATURES.md)** is the full guide: every building, item, weapon, research
project, animal, crop, trait, backstory, thought and event with its stats, plus how each system works and what to try first.
It is generated from the game data (`npx tsx dev/gen-features.ts`), so rerun that after changing content.

- **Colonists** with skills, passions, traits, backstories, needs (food, rest, joy, comfort,
  beauty, temperature), moods, thoughts, relationships, social fights, inspirations and mental breaks.
  Drawn as layered pixel-art paper dolls with a four-frame walk; portraits change expression with mood.
- **Health** by body part: cuts, bruises, gunshots, burns, bleeding, infections, diseases, frostbite,
  hypothermia, heatstroke, scars, lost limbs, medicine and doctoring.
- **Work priorities and schedules**: firefighting, doctoring, cooking, hunting, construction,
  growing, mining, crafting, art, hauling, cleaning, research.
- **Building**: walls, doors, floors, furniture, beds, lighting, production benches, stoves, coolers,
  heaters, power (wood-fired generators, solar, wind, geothermal, batteries, conduits), turrets, traps, sandbags,
  art and a ship reactor for the victory ending.
- **Rooms**: automatic roofing, temperature per room, room stats (impressiveness, beauty,
  cleanliness), mountain bases with overhead rock.
- **World**: seasons, day/night lighting, weather (rain, fog, snow, thunderstorms), fires, plants that
  grow and spread, wild animals (taming, hunting, herds, predators, manhunters).
- **Storyteller** events: raids (pirates, drop pods, mechanoids), traders, wanderers joining,
  cargo pods, crashed escape pods, disease, blight, solar flares, cold snaps, heat waves, eclipses, meteorites
  and more. Three storytellers and five difficulties.
- **Combat**: cover, line of sight, accuracy by skill and distance, armor, melee, explosions,
  prisoners, recruiting, rescue.
- **Research tree**: 128 projects in 8 branches (agriculture, industry, construction, power,
  medicine, military, society, space) across 6 eras, from crop rotation to archotech studies.
  Projects unlock around 45 buildings (beehives, meat vats, deep drills, terraformers, fission and
  fusion reactors, autocannon turrets, shield belts, weather controllers…), dozens of items and
  recipes, and stacking colony bonuses. The tree is a pannable, zoomable map with a research queue.
- **AI minds**: DeepSeek plays each colonist (see above), with speech bubbles and a Voices log.
- **Leader mode**: no work orders; persuade each colonist face to face, by voice or text (see above).
- **Trading** (caravans and orbital traders), **save/load** (auto-save in the browser,
  export/import to file).

## Testing

Headless simulation tests run in Node with `npx tsx`:

| script | checks |
| --- | --- |
| `tests/simtest.ts [days] [size] [seed]` | long soak with a scripted "player" (builds, hunts, drafts during raids); prints colony state every half day |
| `tests/combat.ts [points] [trials]` | raid balance: win rate of three starting colonists vs raids of N points |
| `tests/hunt.ts` | hunt → haul → butcher → cook pipeline |
| `tests/saveload.ts` | save/load round trip mid-game, then keeps simulating |
| `tests/pathstat.ts`, `tests/pathfail.ts` | pathfinding load and failure sources |
| `tests/tech.ts` | research data integrity, then builds every unlockable building and checks each mechanic works |
| `tests/minds.ts [days]` | AI minds soak with the offline mind; checks the colony functions and estimates DeepSeek cost |
| `tests/leader.ts` | leader mode: no work without agreement, conversations create duties that get done, audiences, trust, mediation, speeches, draft refusal, save/load |
| `node tests/llmproxy.mjs` | `/api/llm` proxy against a fake DeepSeek: request shape, keys, password, limits |

Browser checks use Playwright against `npm run dev` (they expect the dev server on port 5173; the
multiplayer ones also need a local PeerJS server, `npx peerjs --port 9000 --path /`, or the relay):
`dev/ui.mjs` walks through every screen on an emulated iPad/iPhone, `dev/mp.mjs` plays a
two-device multiplayer session including reconnect, `dev/mp-soak.mjs` diffs host and client
worlds after a long run, `dev/perf.mjs` measures frame rate, and `dev/raid.mjs` exercises the
raid/draft flow. `dev/techtree.mjs`, `dev/people.mjs` and `dev/sprites.mjs` screenshot the research
tree, colonist art and building sprites; `dev/minds.mjs` and `dev/mp-minds.mjs` run AI minds in the
browser (single player and multiplayer, including a leader-mode talk over the network).
`dev/talk.mjs` walks the talk screen (one-on-one, deal, duties, mediation, speech, audience banner),
`dev/voice.mjs` drives voice input with a stand-in speech recognizer, and `dev/faces.mjs` renders
every talking-face expression and mouth shape. `dev/fake-deepseek.mjs` stands in for the DeepSeek API
(`DEEPSEEK_BASE_URL=http://127.0.0.1:9911`) so the whole chain can be tested without a key.

## Code map

```
src/
  core/      rng, noise, heap, helpers, constants
  data/      game definitions (terrain, items, plants, buildings, recipes, research, animals, health)
  sim/       simulation: world, map, mapgen, pathfinding, AI, jobs, work, needs,
             health, combat, rooms, power, environment, storyteller, trading, commands, save,
             techfx (research bonuses), auras (research-tree buildings), minds (AI minds),
             leader (duties, trust, audiences, promises)
  render/    Canvas2D renderer, chunk cache, lighting, particles; art/ = procedural pixel-art sprites
             (art/face.ts = the animated close-up faces of the talk screen)
  ui/        DOM UI (HUD, inspector, drawers, tools, windows, menus) + styles;
             talkui.ts = the face-to-face talk screen, voice.ts = speech recognition
  mind/      AI minds client side: perception, prompt, DeepSeek client, offline mind, scheduler;
             talk.ts = conversations with the leader, talkmock.ts = the offline talker
  net/       multiplayer transports (WebRTC via PeerJS, WebSocket relay) and host/client sessions
  audio/     synthesized sound effects, generative music and babble voices (WebAudio, no audio files)
api/llm.js         Vercel Edge Function: the /api/llm DeepSeek proxy
server/llmproxy.mjs  the proxy logic, shared by Vercel, the dev server and the relay
server/relay.mjs   optional WebSocket relay + static file server (+ /api/llm)
tests/             headless simulation tests (run with tsx)
dev/               screenshot / device-emulation / multiplayer harness scripts (Playwright)
```

Every player action is a serializable **command** applied by the host, and the simulation state is
plain JSON. That makes saves, multiplayer replication and headless testing straightforward.
