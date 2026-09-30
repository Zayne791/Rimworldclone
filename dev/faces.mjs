// Gallery of the close-up talking faces: every emotion, the mouth shapes used for lip-sync and a blink, across outfits.
import { chromium } from 'playwright';
const out = process.argv[2] || 'test-output/faces.png';
const scale = +(process.argv[3] || 4);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +(process.env.VW || 2700), height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.evaluate(async (scale) => {
  const { createWorld } = await import('/src/sim/newgame.ts');
  const { generateHuman } = await import('/src/sim/pawngen.ts');
  const { makeItem } = await import('/src/sim/things.ts');
  const { lookOf } = await import('/src/render/art/people.ts');
  const { talkFace } = await import('/src/render/art/face.ts');
  const { addSprite, spriteToDataURL } = await import('/src/render/pixel.ts');
  const w = createWorld({ seed: 'faces', mapSize: 60, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
  const outfits = [['tshirt', 'pants'], ['shirt', 'pants', 'jacket'], ['shirt', 'pants', 'duster', 'cowboy_hat'], ['tshirt', 'pants', 'parka', 'tuque'], ['tribalwear'], ['shirt', 'pants', 'armor_plate', 'helmet_simple'], ['armor_marine', 'helmet_marine'], ['shirt', 'pants', 'jacket'], ['tshirt', 'pants'], ['shirt', 'pants']];
  const img = (pix) => `<img src="${spriteToDataURL(addSprite(pix), scale)}" style="image-rendering:pixelated">`;
  const E = ['neutral', 'happy', 'excited', 'sad', 'angry', 'annoyed', 'scared', 'thinking', 'surprised', 'embarrassed', 'hurt'];
  let html = '<div style="display:flex;flex-direction:column;gap:8px;padding:10px;background:#20243a;font:11px sans-serif;color:#fff">';
  for (let k = 0; k < +(new URLSearchParams(location.search).get('n') || 8); k++) {
    const pw = generateHuman(w, 1, { kind: 'colonist' });
    if (k === 7) pw.age = 64;
    pw.apparel = outfits[k % outfits.length].map(d => makeItem(w, d, 1, { stuff: ['jacket', 'duster', 'pants', 'shirt', 'tshirt', 'parka', 'tribalwear', 'cowboy_hat', 'tuque'].includes(d) ? (k % 2 ? 'leather' : 'cloth') : ['armor_plate', 'helmet_simple'].includes(d) ? 'steel' : undefined }));
    const L = lookOf(pw);
    const row = E.map(e => img(talkFace(L, e, 0, 0))).join('') + [1, 2, 3].map(m => img(talkFace(L, 'neutral', m, 0))).join('') + img(talkFace(L, 'happy', 3, 0)) + img(talkFace(L, 'neutral', 0, 1)) + img(talkFace(L, 'neutral', 0, 2));
    html += `<div><div>${pw.name.nick} · ${pw.gender} · ${pw.look.hair}${pw.look.beard ? ' + beard' : ''} · age ${Math.floor(pw.age)}</div><div style="display:flex;gap:3px">${row}</div></div>`;
  }
  document.body.innerHTML = html + '</div>';
  document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'auto'; document.body.style.height = 'auto';
}, scale);
await p.waitForTimeout(300);
if (process.env.CLIP) { const [x, y, cw, ch] = process.env.CLIP.split(',').map(Number); await p.screenshot({ path: out, clip: { x, y, width: cw, height: ch } }); } else await p.screenshot({ path: out, fullPage: true });
console.log(errs.join('\n') || 'no errors');
await b.close();
