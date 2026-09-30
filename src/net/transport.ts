// Network transports: WebRTC via PeerJS (works on static hosting like Vercel) and an optional WebSocket relay.
import Peer, { type DataConnection } from 'peerjs';

export interface Conn {
  id: string;
  send(s: string): void;
  close(): void;
  onMessage: (s: string) => void;
  onClose: () => void;
}

const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newRoomCode(): string { let s = ''; for (let i = 0; i < 5; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
const PREFIX = 'starfall-v1-';

function iceServers(): RTCIceServer[] {
  const env = (import.meta as any).env || {};
  const list: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  if (env.VITE_TURN_URL) list.push({ urls: env.VITE_TURN_URL, username: env.VITE_TURN_USER, credential: env.VITE_TURN_PASS });
  return list;
}
function peerOptions(): any {
  const env = (import.meta as any).env || {};
  const params = new URLSearchParams(location.search);
  const o: any = { config: { iceServers: iceServers() }, debug: 1 };
  const host = params.get('peerhost') || env.VITE_PEER_HOST;
  if (host) { o.host = host; o.port = +(params.get('peerport') || env.VITE_PEER_PORT || 443); o.path = params.get('peerpath') || env.VITE_PEER_PATH || '/'; o.secure = (params.get('peersecure') || env.VITE_PEER_SECURE || 'true') !== 'false'; }
  return o;
}
export function relayUrl(): string | null {
  const env = (import.meta as any).env || {};
  const params = new URLSearchParams(location.search);
  return params.get('relay') || env.VITE_RELAY_URL || null;
}

// ---- chunking for large messages (WebRTC data channels dislike >64KB) ----
const CHUNK = 16000;
let mid = 1;
function sendChunked(raw: (s: string) => void, s: string) {
  if (s.length <= CHUNK) { raw(s); return; }
  const id = mid++;
  const n = Math.ceil(s.length / CHUNK);
  for (let i = 0; i < n; i++) raw(JSON.stringify({ t: '#part', id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) }));
}
function reassembler(deliver: (s: string) => void) {
  const parts = new Map<number, { arr: string[]; got: number }>();
  return (s: string) => {
    if (s.startsWith('{"t":"#part"')) {
      const m = JSON.parse(s);
      let e = parts.get(m.id);
      if (!e) { e = { arr: new Array(m.n), got: 0 }; parts.set(m.id, e); }
      if (e.arr[m.i] === undefined) { e.arr[m.i] = m.d; e.got++; }
      if (e.got === m.n) { parts.delete(m.id); deliver(e.arr.join('')); }
      return;
    }
    deliver(s);
  };
}

function wrapPeerConn(dc: DataConnection): Conn {
  const c: Conn = { id: dc.peer, send: () => {}, close: () => dc.close(), onMessage: () => {}, onClose: () => {} };
  c.send = (s: string) => { try { sendChunked(x => dc.send(x), s); } catch (e) { console.warn('send failed', e); } };
  const rx = reassembler(s => c.onMessage(s));
  dc.on('data', (d: any) => rx(typeof d === 'string' ? d : JSON.stringify(d)));
  dc.on('close', () => c.onClose());
  dc.on('error', () => c.onClose());
  return c;
}

export interface HostTransport { code: string; onConnection: (c: Conn) => void; close(): void }

export async function openHost(onConnection: (c: Conn) => void): Promise<HostTransport> {
  const relay = relayUrl();
  if (relay) return openRelayHost(relay, onConnection);
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newRoomCode();
    try {
      const peer = await new Promise<Peer>((res, rej) => {
        const p = new Peer(PREFIX + code, peerOptions());
        const to = setTimeout(() => { rej(new Error('Timed out reaching the matchmaking server')); p.destroy(); }, 15000);
        p.on('open', () => { clearTimeout(to); res(p); });
        p.on('error', (e: any) => { clearTimeout(to); rej(e); });
      });
      const ht: HostTransport = { code, onConnection, close: () => peer.destroy() };
      peer.on('connection', (dc) => { dc.on('open', () => ht.onConnection(wrapPeerConn(dc))); });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* */ } });
      peer.on('error', (e: any) => console.warn('peer error', e?.type, e));
      return ht;
    } catch (e: any) {
      if (e?.type === 'unavailable-id') continue;
      throw e;
    }
  }
  throw new Error('Could not allocate a room code');
}

export async function connectClient(code: string, status: (s: string) => void): Promise<Conn> {
  const relay = relayUrl();
  if (relay) return connectRelayClient(relay, code);
  status('Reaching matchmaking server…');
  const peer = await new Promise<Peer>((res, rej) => {
    const p = new Peer(peerOptions());
    const to = setTimeout(() => { rej(new Error('Timed out reaching the matchmaking server')); p.destroy(); }, 15000);
    p.on('open', () => { clearTimeout(to); res(p); });
    p.on('error', (e: any) => { clearTimeout(to); rej(e); });
  });
  status('Connecting to host…');
  return new Promise<Conn>((res, rej) => {
    const dc = peer.connect(PREFIX + code, { reliable: true, serialization: 'raw' });
    const to = setTimeout(() => rej(new Error('Could not reach the host. Check the room code — and that the host is still in the game.')), 20000);
    peer.on('error', (e: any) => { clearTimeout(to); rej(new Error(e?.type === 'peer-unavailable' ? 'No game with that room code.' : String(e?.message || e))); });
    dc.on('open', () => { clearTimeout(to); const c = wrapPeerConn(dc); const oc = c.close; c.close = () => { oc(); peer.destroy(); }; res(c); });
  });
}

// ---------------- WebSocket relay ----------------
function openRelayHost(url: string, onConnection: (c: Conn) => void): Promise<HostTransport> {
  const code = newRoomCode();
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${url}${url.includes('?') ? '&' : '?'}room=${code}&role=host`);
    const conns = new Map<string, Conn>();
    const ht: HostTransport = { code, onConnection, close: () => ws.close() };
    const rx = new Map<string, (s: string) => void>();
    ws.onopen = () => res(ht);
    ws.onerror = () => rej(new Error('Relay server unreachable'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.sys === 'join') {
        const c: Conn = { id: m.cid, send: (s) => sendChunked(x => ws.send(JSON.stringify({ to: m.cid, d: x })), s), close: () => ws.send(JSON.stringify({ sys: 'kick', to: m.cid })), onMessage: () => {}, onClose: () => {} };
        conns.set(m.cid, c);
        rx.set(m.cid, reassembler(s => c.onMessage(s)));
        ht.onConnection(c);
      } else if (m.sys === 'leave') { conns.get(m.cid)?.onClose(); conns.delete(m.cid); }
      else if (m.from) rx.get(m.from)?.(m.d);
    };
  });
}
function connectRelayClient(url: string, code: string): Promise<Conn> {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${url}${url.includes('?') ? '&' : '?'}room=${code}&role=client`);
    const c: Conn = { id: 'host', send: (s) => sendChunked(x => ws.send(x), s), close: () => ws.close(), onMessage: () => {}, onClose: () => {} };
    const rx = reassembler(s => c.onMessage(s));
    ws.onopen = () => res(c);
    ws.onerror = () => rej(new Error('Relay server unreachable'));
    ws.onclose = (e) => { if (e.code === 4404) rej(new Error('No game with that room code.')); c.onClose(); };
    ws.onmessage = (ev) => rx(ev.data);
  });
}
