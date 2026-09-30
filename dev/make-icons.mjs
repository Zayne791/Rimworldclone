// Generates the pixel-art app icons (public/icon-*.png) without any image libraries.
// Run: node dev/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const N = 32;
const px = new Uint32Array(N * N);
const hex = (h) => { const v = parseInt(h.slice(1), 16); return (0xff << 24 | (v & 0xff) << 16 | (v >> 8 & 0xff) << 8 | v >> 16) >>> 0; };
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = hex(c); };
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };

// sky gradient
const sky = ['#15121b', '#1a1526', '#201a33', '#281f3f', '#33264a', '#3f2c52', '#4d3257', '#5e3a58'];
for (let y = 0; y < N; y++) rect(0, y, N, 1, sky[Math.min(sky.length - 1, Math.floor(y / 3))]);
// stars
for (const [x, y] of [[3, 3], [9, 6], [26, 4], [21, 9], [5, 12], [28, 13], [14, 2], [17, 11]]) set(x, y, '#cfc6e8');
set(26, 3, '#8a80a8'); set(26, 5, '#8a80a8'); set(25, 4, '#8a80a8'); set(27, 4, '#8a80a8');
// falling star with trail
const trail = ['#fff6d0', '#ffd46a', '#ff9d4a', '#e0623a', '#9c3a44', '#5c2a4a'];
for (let i = 0; i < 13; i++) { const x = 7 + i, y = 11 - Math.floor(i * 0.6); set(x, y, trail[Math.min(trail.length - 1, Math.floor(i / 2))]); if (i < 7) set(x, y - 1, trail[Math.min(trail.length - 1, Math.floor(i / 2) + 1)]); }
rect(6, 11, 2, 2, '#ffffff'); set(5, 12, '#fff6d0'); set(6, 13, '#fff6d0');
// distant mesa
for (let x = 0; x < N; x++) { const h = 2 + Math.round(1.5 + Math.sin(x * 0.45) * 1.2 + Math.sin(x * 1.3) * 0.6); rect(x, 22 - h, 1, h, '#3a2640'); }
// ground
rect(0, 22, N, 10, '#6b4a3a');
for (let x = 0; x < N; x++) { set(x, 22, '#8a6246'); if (x % 3 === 0) set(x, 23, '#7a5640'); }
for (const [x, y] of [[4, 26], [11, 28], [19, 27], [27, 25], [8, 30], [24, 30], [15, 25]]) set(x, y, '#553a2e');
// habitat dome
const dome = [[11, 21, 10], [10, 20, 12], [9, 19, 14], [9, 18, 14], [10, 17, 12], [11, 16, 10], [13, 15, 6]];
for (const [x, y, w] of dome) rect(x, y, w, 1, '#8fa8b8');
for (const [x, y, w] of dome) { set(x, y, '#2a2a3a'); set(x + w - 1, y, '#2a2a3a'); }
rect(13, 14, 6, 1, '#2a2a3a'); set(12, 15, '#2a2a3a'); set(19, 15, '#2a2a3a');
rect(12, 16, 3, 1, '#d8eef6'); set(11, 17, '#d8eef6'); rect(14, 15, 2, 1, '#eef8fc');
rect(8, 21, 16, 1, '#2a2a3a'); rect(9, 20, 14, 1, '#6d8494');
// lit window + door
rect(14, 18, 4, 3, '#ffd46a'); rect(15, 19, 2, 2, '#fff0b0'); rect(20, 18, 2, 3, '#4a5a66');
// antenna with beacon
rect(22, 11, 1, 5, '#2a2a3a'); set(22, 10, '#ff5050'); set(21, 10, '#7a2a3a'); set(23, 10, '#7a2a3a');
// colonist
rect(6, 19, 2, 2, '#e8b890'); rect(6, 21, 2, 2, '#4a7ac0'); set(5, 21, '#e8b890'); rect(6, 23, 1, 1, '#2a2a3a'); set(7, 23, '#2a2a3a'); set(6, 18, '#5a3a2a'); set(7, 18, '#5a3a2a');
// glow on ground from window
for (const [x, y] of [[14, 23], [15, 23], [16, 23], [17, 23], [15, 24], [16, 24]]) set(x, y, '#9a7050');

function png(size, pad) {
  const scale = Math.floor((size - pad * 2) / N), off = Math.floor((size - N * scale) / 2);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const sx = Math.floor((x - off) / scale), sy = Math.floor((y - off) / scale);
      const c = sx >= 0 && sy >= 0 && sx < N && sy < N ? px[sy * N + sx] : px[Math.min(N - 1, Math.max(0, sy)) * N + Math.min(N - 1, Math.max(0, sx))];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c & 0xff; raw[o + 1] = c >> 8 & 0xff; raw[o + 2] = c >> 16 & 0xff; raw[o + 3] = 0xff;
    }
  }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cb = Buffer.alloc(4); cb.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cb]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192, 0));
writeFileSync('public/icon-512.png', png(512, 0));
writeFileSync('public/icon-maskable-512.png', png(512, 52));
writeFileSync('public/apple-touch-icon.png', png(180, 0));
console.log('icons written');
