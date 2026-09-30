// Trading with NPC caravans, orbital traders and other players.
import type { World } from './world';
import type { Item, Pawn } from './types';
import { ITEMS } from '../data/items';
import { itemValue, placeItem, makeItem, spawnItem, pawnShortName, itemLabel } from './things';
import { storageOwnerAt } from './zones';
import { skillLevel } from './stats';
import { clamp } from '../core/util';

export function negotiator(w: World, faction: number): Pawn | null {
  let best: Pawn | null = null;
  for (const p of w.colonists(faction)) if (!p.downed && (!best || skillLevel(p, 'social') > skillLevel(best, 'social'))) best = p;
  return best;
}
export function priceFactor(w: World, faction: number) {
  const n = negotiator(w, faction);
  const s = n ? skillLevel(n, 'social') : 0;
  return { buy: clamp(1.5 - s * 0.018, 1.1, 1.5), sell: clamp(0.55 + s * 0.012, 0.55, 0.85) };
}
export function unitValue(it: Item) { return itemValue({ ...it, count: 1 }); }

/** Items the colony can sell: in its storage or home area */
export function colonyTradeables(w: World, faction: number): Item[] {
  const m = w.map;
  const slot = w.slotOf(faction);
  const out: Item[] = [];
  for (const it of w.items.values()) {
    if (it.corpse || ITEMS[it.def].noTrade) continue;
    const i = m.idx(it.x, it.y);
    const own = storageOwnerAt(w, i);
    if (own === faction || (own < 0 && m.inHome(i, slot))) out.push(it);
  }
  return out;
}

export function colonySilver(w: World, faction: number) { return colonyTradeables(w, faction).filter(i => i.def === 'silver').reduce((s, i) => s + i.count, 0); }

function removeFromColony(w: World, faction: number, def: string, stuff: string | undefined, quality: number | undefined, count: number): Item[] {
  const taken: Item[] = [];
  for (const it of colonyTradeables(w, faction)) {
    if (count <= 0) break;
    if (it.def !== def || it.stuff !== stuff || it.quality !== quality) continue;
    const n = Math.min(count, it.count);
    it.count -= n; count -= n;
    taken.push({ ...it, id: w.newId(), count: n });
    if (it.count <= 0) w.despawn(it);
  }
  return taken;
}

export interface TradeLine { key: string; def: string; stuff?: string; quality?: number; buy: number; sell: number }

export function tradeKey(it: { def: string; stuff?: string; quality?: number }) { return `${it.def}|${it.stuff || ''}|${it.quality ?? ''}`; }

/** Execute a trade: lines positive = buy from trader, negative = sell. Returns error string or null. */
export function executeTrade(w: World, faction: number, stock: Item[], lines: { key: string; n: number }[], dropX: number, dropY: number, drop = false): string | null {
  const pf = priceFactor(w, faction);
  let silverDelta = 0; // positive = colony receives
  const colony = colonyTradeables(w, faction);
  for (const l of lines) {
    if (!l.n || l.key.startsWith('silver|')) continue;
    if (l.n > 0) {
      const it = stock.find(s => tradeKey(s) === l.key);
      if (!it || it.count < l.n) return 'Trader does not have that many.';
      silverDelta -= Math.ceil(unitValue(it) * pf.buy) * l.n;
    } else {
      const have = colony.filter(s => tradeKey(s) === l.key).reduce((s, i) => s + i.count, 0);
      if (have < -l.n) return 'Colony does not have that many.';
      const sample = colony.find(s => tradeKey(s) === l.key)!;
      silverDelta += Math.floor(unitValue(sample) * pf.sell) * -l.n;
    }
  }
  const traderSilver = stock.filter(s => s.def === 'silver').reduce((s, i) => s + i.count, 0);
  if (silverDelta < 0 && colonySilver(w, faction) < -silverDelta) return 'Not enough silver.';
  if (silverDelta > 0 && traderSilver < silverDelta) return 'Trader cannot afford that.';
  // apply
  const received: Item[] = [];
  for (const l of lines) {
    if (!l.n || l.key.startsWith('silver|')) continue;
    const [def, stuff, q] = l.key.split('|');
    const quality = q === '' ? undefined : +q;
    if (l.n > 0) {
      const it = stock.find(s => tradeKey(s) === l.key)!;
      it.count -= l.n;
      received.push({ ...it, id: w.newId(), count: l.n });
      if (it.count <= 0) stock.splice(stock.indexOf(it), 1);
    } else {
      const taken = removeFromColony(w, faction, def, stuff || undefined, quality, -l.n);
      for (const t of taken) {
        const ex = stock.find(s => tradeKey(s) === tradeKey(t) && ITEMS[t.def].stack > 1);
        if (ex) ex.count += t.count; else stock.push({ ...t, x: 0, y: 0 });
      }
    }
  }
  if (silverDelta < 0) {
    removeFromColony(w, faction, 'silver', undefined, undefined, -silverDelta);
    const ts = stock.find(s => s.def === 'silver'); if (ts) ts.count += -silverDelta; else stock.push(makeItem(w, 'silver', -silverDelta));
  } else if (silverDelta > 0) {
    const ts = stock.find(s => s.def === 'silver')!;
    ts.count -= silverDelta;
    received.push(makeItem(w, 'silver', silverDelta));
  }
  for (const it of received) {
    it.owner = faction; it.forbidden = false;
    const lim = ITEMS[it.def].stack;
    let n = it.count;
    while (n > 0) { const k = Math.min(n, lim); placeItem(w, { ...it, id: w.newId(), count: k }, dropX, dropY, 15); n -= k; }
  }
  if (drop) w.emit({ k: 'droppod', x: dropX, y: dropY });
  return null;
}

// ---------------- player to player ----------------
export interface P2POffer { id: number; from: number; to: number; give: { key: string; n: number }[]; want: { key: string; n: number }[]; tick: number; note?: string }

export function executeP2P(w: World, o: P2POffer): string | null {
  const fromItems = colonyTradeables(w, o.from), toItems = colonyTradeables(w, o.to);
  for (const g of o.give) if (fromItems.filter(i => tradeKey(i) === g.key).reduce((s, i) => s + i.count, 0) < g.n) return 'Sender no longer has the offered items.';
  for (const g of o.want) if (toItems.filter(i => tradeKey(i) === g.key).reduce((s, i) => s + i.count, 0) < g.n) return 'You no longer have the requested items.';
  const drop = (faction: number, items: Item[]) => {
    const pl = w.playerByFaction(faction);
    const cols = w.colonists(faction);
    const x = cols.length ? Math.round(cols.reduce((s, p) => s + p.x, 0) / cols.length) : pl?.startX ?? 50;
    const y = cols.length ? Math.round(cols.reduce((s, p) => s + p.y, 0) / cols.length) : pl?.startY ?? 50;
    for (const it of items) { it.owner = faction; placeItem(w, it, x, y, 15); }
    w.emit({ k: 'droppod', x, y });
  };
  const moveAll = (from: number, to: number, list: { key: string; n: number }[]) => {
    const out: Item[] = [];
    for (const g of list) { const [def, stuff, q] = g.key.split('|'); out.push(...removeFromColony(w, from, def, stuff || undefined, q === '' ? undefined : +q, g.n)); }
    drop(to, out);
  };
  moveAll(o.from, o.to, o.give);
  moveAll(o.to, o.from, o.want);
  return null;
}
export { pawnShortName, itemLabel, spawnItem };
