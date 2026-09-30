# Starfall Colony

A pixel-art colony survival sim for the web, inspired by RimWorld. Your crew crash-lands on a
frontier world: build shelter, grow food, research technology, survive raids, disease, weather and
their own mental breakdowns, and finally build a ship to escape. You can play alone or share one
map with friends, each running your own colony.

Designed first for **iPad in portrait**, and it plays well on iPhone and desktop too. All art is
procedurally generated pixel art, drawn in code at startup, so the game ships no image files.

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

## Multiplayer

Multiplayer is **separate colonies on a shared map**. One player hosts, and friends join with a
5-letter room code. Everyone lives on the same planet at the same time: you can trade, visit, fight
the same raids and even declare war on each other (Diplomacy).

- **Host**: *Host multiplayer* on the main menu, then set up your colony. The room code is shown
  when the room opens and any time in the **Menu** tab, which also has a *Copy invite link* button.
  Friends who open the link go straight to the join screen.
- **Join**: *Join multiplayer*, type the code, then pick your crew and landing spot.
- The host's device runs the simulation. If the host leaves, the game pauses for everyone else.
  Hosting on the most powerful device helps.
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
- Bottom tabs: **Build**, **Orders** (mine, chop, harvest, hunt…), **Zones**, **Work**,
  **Research**, **Colony** (overview, schedule, animals, trade, diplomacy), **Menu**.
- Build and zone tools support drag: drag out walls, rooms, stockpiles and fields.

**Keyboard / mouse**
- WASD / arrows to pan, wheel to zoom, left-drag to box-select, right-click for context menu.
- `Space` pause · `1`–`4` speed · `R` draft/undraft (or rotate while building) · `F` fire at will ·
  `B` build · `O` orders · `Z` zones · `Tab` next colonist · `Esc` cancel.

## What's in the game

- **Colonists** with skills, passions, traits, backstories, needs (food, rest, joy, comfort,
  beauty, temperature), moods, thoughts, relationships, social fights, inspirations and mental breaks.
- **Health** by body part: cuts, bruises, gunshots, burns, bleeding, infections, diseases, frostbite,
  hypothermia, heatstroke, scars, lost limbs, medicine and doctoring.
- **Work priorities and schedules**: firefighting, doctoring, cooking, hunting, construction,
  growing, mining, crafting, art, hauling, cleaning, research.
- **Building**: walls, doors, floors, furniture, beds, lighting, production benches, stoves, coolers,
  heaters, power (generators, solar, geothermal, batteries, conduits), turrets, traps, sandbags,
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
- **Research tree**, **trading** (caravans and orbital traders), **save/load** (auto-save in the browser,
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

Browser checks use Playwright against `npm run dev` (they expect the dev server on port 5173; the
multiplayer ones also need a local PeerJS server, `npx peerjs --port 9000 --path /`, or the relay):
`dev/ui.mjs` walks through every screen on an emulated iPad/iPhone, `dev/mp.mjs` plays a
two-device multiplayer session including reconnect, `dev/mp-soak.mjs` diffs host and client
worlds after a long run, `dev/perf.mjs` measures frame rate, and `dev/raid.mjs` exercises the
raid/draft flow.

## Code map

```
src/
  core/      rng, noise, heap, helpers, constants
  data/      game definitions (terrain, items, plants, buildings, recipes, research, animals, health)
  sim/       deterministic simulation: world, map, mapgen, pathfinding, AI, jobs, work, needs,
             health, combat, rooms, power, environment, storyteller, trading, commands, save
  render/    Canvas2D renderer, chunk cache, lighting, particles; art/ = procedural pixel-art sprites
  ui/        DOM UI (HUD, inspector, drawers, tools, windows, menus) + styles
  net/       multiplayer transports (WebRTC via PeerJS, WebSocket relay) and host/client sessions
  audio/     synthesized sound effects (WebAudio, no audio files)
server/relay.mjs   optional WebSocket relay + static file server
tests/             headless simulation tests (run with tsx)
dev/               screenshot / device-emulation / multiplayer harness scripts (Playwright)
```

Every player action is a serializable **command** applied by the host, and the simulation state is
plain JSON. That makes saves, multiplayer replication and headless testing straightforward.
