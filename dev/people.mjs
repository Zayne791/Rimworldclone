// Gallery of generated people: every facing and walk frame, plus mood portraits, with assorted outfits.
import { chromium } from 'playwright';
const out = process.argv[2] || 'test-output/people.png';
const scale = +(process.argv[3] || 4);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
await p.evaluate(async (scale) => {
  const { createWorld } = await import('/src/sim/newgame.ts');
  const { generateHuman } = await import('/src/sim/pawngen.ts');
  const { makeItem } = await import('/src/sim/things.ts');
  const { lookOf, personPix, portraitBust } = await import('/src/render/art/people.ts');
  const { addSprite, spriteToDataURL } = await import('/src/render/pixel.ts');
  const w = createWorld({ seed: 'gallery', mapSize: 60, storyteller: 'classic', difficulty: 2, maxPlayers: 1 });
  const outfits = [null, ['tshirt', 'pants'], ['shirt', 'pants', 'jacket'], ['shirt', 'pants', 'duster', 'cowboy_hat'], ['tshirt', 'pants', 'parka', 'tuque'], ['tribalwear'], ['shirt', 'pants', 'flak_vest', 'helmet_flak'], ['shirt', 'pants', 'armor_plate', 'helmet_simple'], ['armor_marine', 'helmet_marine', 'shield_belt'], ['armor_recon', 'helmet_recon'], ['armor_cataphract', 'helmet_cataphract'], ['shirt', 'pants', 'jacket']];
  const img = (pix) => `<img src="${spriteToDataURL(addSprite(pix), scale)}" style="image-rendering:pixelated">`;
  let html = '<div style="display:flex;flex-wrap:wrap;gap:14px;padding:12px;background:#4a5a3a;font:11px sans-serif;color:#fff">';
  for (let k = 0; k < 12; k++) {
    const pw = generateHuman(w, 1, { kind: 'colonist' });
    if (outfits[k]) pw.apparel = outfits[k].map(d => makeItem(w, d, 1, { stuff: ['jacket', 'duster', 'pants', 'shirt', 'tshirt', 'parka', 'tribalwear', 'cowboy_hat', 'tuque'].includes(d) ? (k % 2 ? 'leather' : 'cloth') : ['armor_plate', 'helmet_simple'].includes(d) ? 'steel' : undefined }));
    if (k === 0) pw.apparel = [];
    const L = lookOf(pw);
    let row = '';
    for (const f of [0, 1, 2]) row += img(personPix(L, f, 0));
    for (const fr of [1, 2, 3]) row += img(personPix(L, 1, fr));
    for (const fr of [1, 3]) row += img(personPix(L, 0, fr));
    row += img(personPix(L, 0, 0, true)) + img(personPix(L, 1, 0, true));
    const bust = ['happy', 'neutral', 'sad', 'angry'].map(e => img(portraitBust(L, e))).join('');
    html += `<div style="background:#3a4a2a;padding:6px"><div>${pw.name.nick} · ${pw.gender} · body ${pw.look.body} · ${pw.look.hair} · ${(outfits[k] || ['naked']).join(', ')}</div><div style="display:flex;gap:2px;align-items:flex-end">${row}</div><div style="display:flex;gap:4px">${bust}</div></div>`;
  }
  document.body.innerHTML = html + '</div>';
  document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'auto'; document.body.style.height = 'auto';
}, scale);
await p.waitForTimeout(400);
if (process.env.CLIP) { const [x, y, w, h] = process.env.CLIP.split(',').map(Number); await p.screenshot({ path: out, clip: { x, y, width: w, height: h }, fullPage: true }); } else await p.screenshot({ path: out, fullPage: true });
console.log(errs.join('\n') || 'no errors');
await b.close();
