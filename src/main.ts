// Entry point: loads fonts & styles, shows menus, starts single-player or multiplayer games.
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/styles.css';
import type { World } from './sim/world';
import { Game } from './game';
import { UI } from './ui/ui';
import { AudioEngine } from './audio/audio';
import { showMainMenu, clearScreens, statusScreen, colonistScreen, siteScreen } from './ui/menu';

const audio = new AudioEngine();
let current: Game | null = null;

function startGame(w: World, faction: number, net: any = null) {
  clearScreens();
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const g = new Game(canvas, w, faction, net, audio);
  const ui = new UI(g);
  g.ui = ui;
  g.onExit = () => {
    g.stop();
    current = null;
    document.getElementById('hud')!.innerHTML = '';
    const c = canvas.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#15121b'; c.fillRect(0, 0, canvas.width, canvas.height);
    history.replaceState(null, '', location.pathname);
    menu();
  };
  current = g;
  if (net) net.game = g;
  g.start();
  (window as any).__game = g;
  return g;
}

function menu() {
  showMainMenu({
    audio,
    startSingle: (w, f) => startGame(w, f),
    hostGame: async (w, f, opts) => {
      statusScreen('Opening room…', 'Setting up a multiplayer room. This takes a few seconds.');
      try {
        const { HostSession } = await import('./net/session');
        const s = new HostSession(w, f, opts.maxPlayers);
        await s.open();
        startGame(w, f, s);
        current?.ui.toast(`Room ${s.roomCode} is open — share the code!`, 'good');
      } catch (e) {
        statusScreen('Could not open room', `Multiplayer server unreachable: ${String((e as any)?.message || e)}<br><br>You can still play solo.`, () => menu());
      }
    },
    joinGame: async (code, name, colony) => {
      const { ClientSession } = await import('./net/session');
      const s = new ClientSession();
      const w = await s.connect(code, name, colony, (msg) => { const el = document.getElementById('j-status'); if (el) el.textContent = msg; });
      s.onLost = () => showLost(code, name, colony);
      if (s.myFaction && s.started) { startGame(w, s.myFaction, s); return; }
      // choose colonists + landing site, then ask host to spawn
      colonistScreen(w, s.slot, async (pawns, pet, site) => {
        statusScreen('Landing…', 'Your pods are on their way down.');
        try {
          const f = await s.startColony(pawns, pet, site);
          startGame(s.world!, f, s);
        } catch (e) { statusScreen('Could not land', String((e as any)?.message || e), () => menu()); }
      }, `Joining ${w.players.find(p => p.isHost)?.colonyName || 'the game'}`);
      void siteScreen;
    },
  });
}

// client lost the host: offer to reconnect (the saved token reclaims the same colony)
function showLost(code: string, name: string, colony: string) {
  const g = current;
  if (!g || document.getElementById('lostbox')) return;
  const el = document.createElement('div');
  el.id = 'lostbox'; el.className = 'modal-bg'; el.style.bottom = '0'; el.style.zIndex = '60';
  el.innerHTML = `<div class="win px" style="max-width:420px;padding:14px"><h2>Connection lost</h2>
    <div>The host closed the game or the connection dropped. Your colony is safe on the host's world.</div>
    <div id="lost-st" class="small dim" style="margin:8px 0"></div>
    <div class="row wrap" style="gap:8px"><button class="btn good" data-x="re">Reconnect</button><button class="btn" data-x="menu">Main menu</button></div></div>`;
  document.getElementById('screens')!.appendChild(el);
  const st = el.querySelector('#lost-st') as HTMLElement;
  let busy = false;
  el.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('[data-x]') as HTMLElement | null;
    if (!b || busy) return;
    if (b.dataset.x === 'menu') { el.remove(); g.onExit?.(); return; }
    busy = true; st.textContent = 'Reconnecting…';
    try {
      const { ClientSession } = await import('./net/session');
      const s = new ClientSession();
      const w = await s.connect(code, name, colony, (msg) => { st.textContent = msg; });
      s.onLost = () => showLost(code, name, colony);
      el.remove();
      const cam = { ...g.renderer.cam };
      g.stop(); document.getElementById('hud')!.innerHTML = '';
      if (s.myFaction && s.started) { const ng = startGame(w, s.myFaction, s); Object.assign(ng.renderer.cam, cam); ng.centered = true; }
      else { g.onExit?.(); }
    } catch (err) { st.innerHTML = `<span class="bad">${String((err as any)?.message || err)}</span>`; busy = false; }
  });
}

async function boot() {
  try { await (document as any).fonts?.load?.('16px "Pixelify Sans"'); await (document as any).fonts?.ready; } catch { /* ignore */ }
  document.getElementById('boot')?.remove();
  // prevent iOS rubber-banding / double-tap zoom
  document.addEventListener('touchmove', e => { if ((e.target as HTMLElement).closest?.('.scroll, .scroll-x, .wb, .items, .cats, #colbar, .tabs, .gizmos, .stuffs, .screen, .ctx, #resbox, .chatlog')) return; e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault());
  window.addEventListener('beforeunload', () => { if (current?.isHost) current.autosave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && current?.isHost) current.autosave(); });
  menu();
}
boot();
