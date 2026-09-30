// Optional self-hosted server: serves the built game (dist/) and a WebSocket relay for multiplayer.
// Use this if WebRTC peer-to-peer can't connect on your network. Deploy to Render/Fly/Railway:
//   npm run build && node server/relay.mjs   (PORT env var respected)
// Then open  https://your-host/?relay=wss://your-host/relay
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = +(process.env.PORT || 8787);
const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(f, (err, data) => {
    if (err) { fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => { res.writeHead(e2 ? 404 : 200, { 'content-type': 'text/html' }); res.end(e2 ? 'Not found (did you run npm run build?)' : d2); }); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

const rooms = new Map(); // code -> { host, clients: Map<cid, ws> }
let nextCid = 1;
const wss = new WebSocketServer({ server, path: '/relay', maxPayload: 8 * 1024 * 1024 });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const code = (url.searchParams.get('room') || '').toUpperCase();
  const role = url.searchParams.get('role');
  if (!code) { ws.close(4400, 'no room'); return; }
  if (role === 'host') {
    const old = rooms.get(code);
    if (old && old.host.readyState === 1) { ws.close(4409, 'room exists'); return; }
    const room = { host: ws, clients: new Map() };
    rooms.set(code, room);
    ws.send(JSON.stringify({ sys: 'ok' }));
    ws.on('message', (buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch { return; }
      if (m.sys === 'kick') { room.clients.get(m.to)?.close(); return; }
      const c = room.clients.get(m.to);
      if (c && c.readyState === 1) c.send(m.d);
    });
    ws.on('close', () => { for (const c of room.clients.values()) c.close(4410, 'host left'); if (rooms.get(code) === room) rooms.delete(code); });
  } else {
    const room = rooms.get(code);
    if (!room) { ws.close(4404, 'no such room'); return; }
    const cid = 'c' + nextCid++;
    room.clients.set(cid, ws);
    ws.send(JSON.stringify({ sys: 'ok' }));
    room.host.send(JSON.stringify({ sys: 'join', cid }));
    ws.on('message', (buf) => { if (room.host.readyState === 1) room.host.send(JSON.stringify({ from: cid, d: buf.toString() })); });
    ws.on('close', () => { room.clients.delete(cid); if (room.host.readyState === 1) room.host.send(JSON.stringify({ sys: 'leave', cid })); });
  }
});
server.listen(PORT, () => console.log(`Starfall Colony server on http://localhost:${PORT}  (relay at ws://localhost:${PORT}/relay)`));
