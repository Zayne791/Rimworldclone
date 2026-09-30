// Main simulation tick orchestration.
import type { World } from './world';
import { pawnTick } from './ai';
import { projectileTick, turretTick } from './combat';
import { doorTick } from './move';
import { fireTick, plantGrowthTick, powerTick, fuelTick, weatherTick, rotTick, snowTick, recomputeLight, updateCombinedLight } from './environment';
import { temperatureTick, ensureRooms } from './rooms';
import { lordTick } from './lords';
import { storytellerTick, colonyWealth } from './storyteller';
import { BUILDINGS } from '../data/buildings';
import { TICKS_PER_DAY } from '../core/constants';
import { pawnShortName } from './things';
import { setStatTick } from './stats';
import { bindFx } from './techfx';
import { auraTick } from './auras';

let turretCache: { v: number; ids: number[] } = { v: -1, ids: [] };
let tickErrors = 0;

export function simTick(w: World) {
  w.tick++;
  const t = w.tick;
  setStatTick(t);
  bindFx(w);
  for (const p of [...w.pawns.values()]) {
    // one pawn's bad state must not stall the world: drop its job and move on (reported, not hidden)
    try { pawnTick(w, p); } catch (e) { if (tickErrors++ < 10) console.error('pawn tick error', p.id, p.race, p.job?.type, e); p.job = null; p.queue = []; p.path = null; }
  }
  for (const pr of [...w.projectiles.values()]) projectileTick(w, pr);
  const bv = w._cache.buildingsVersion || 0;
  if (turretCache.v !== bv) { turretCache = { v: bv, ids: [...w.buildings.values()].filter(b => BUILDINGS[b.def].turret).map(b => b.id) }; }
  for (const id of turretCache.ids) { const b = w.buildings.get(id); if (b) turretTick(w, b); }
  if (t % 5 === 0) doorTick(w, 5);
  if (t % 30 === 0) fireTick(w);
  if (t % 50 === 0) plantGrowthTick(w);
  if (t % 60 === 0) { powerTick(w); fuelTick(w); for (const l of [...w.lords.values()]) lordTick(w, l); shipTick(w); }
  if (t % 120 === 0) temperatureTick(w);
  if (t % 250 === 0) { weatherTick(w); rotTick(w); updateCombinedLight(w); auraTick(w); }
  if (t % 500 === 0) snowTick(w);
  if (t % 1000 === 0) storytellerTick(w);
  if (t % 10 === 0 && w.map.lightDirty) { recomputeLight(w); updateCombinedLight(w); }
  if (t % 30 === 0) ensureRooms(w);
  if (t % 600 === 0) defeatCheck(w);
  if (t % 2500 === 0) sampleHistory(w);
}

function shipTick(w: World) {
  for (const b of w.buildings.values()) {
    if (!b.reactor?.started || w.tick < b.reactor.t) continue;
    const pl = w.playerByFaction(b.faction);
    if (!pl || pl.won) continue;
    pl.won = true;
    const survivors = w.colonists(b.faction).filter(p => !p.downed || true);
    w.letter(b.faction, 'Victory! The ship has launched!', `Your ship has launched with ${survivors.length} colonists aboard: ${survivors.map(pawnShortName).join(', ')}.\n\nAfter all they've been through, they're finally leaving this rimworld behind. Congratulations!`, 'good');
    for (const other of w.players) if (other.faction !== b.faction) w.letter(other.faction, 'A ship has launched', `${w.faction(b.faction)?.colonyName} has escaped the planet!`, 'info');
    for (const p of survivors) w.despawn(p);
    b.reactor.started = false;
    w.emit({ k: 'launch', x: b.x, y: b.y, f: b.faction });
  }
}

function defeatCheck(w: World) {
  for (const pl of w.players) {
    if (!pl.started || pl.defeated || pl.won) continue;
    const alive = w.colonists(pl.faction).filter(p => !p.dead);
    if (!alive.length) {
      pl.defeated = true;
      w.letter(pl.faction, 'Colony lost', 'Every colonist is gone. Your story on this rimworld has ended... You can start a new colony from the menu.', 'death');
    }
  }
}

function sampleHistory(w: World) {
  const wealth: Record<number, number> = {}, pop: Record<number, number> = {};
  for (const f of w.playerFactions()) { wealth[f] = Math.round(w.story[f]?.wealth || colonyWealth(w, f)); pop[f] = w.colonists(f).length; }
  w.history.push({ tick: w.tick, wealth, pop });
  if (w.history.length > 400) w.history.splice(0, w.history.length - 400);
}

export { TICKS_PER_DAY };
