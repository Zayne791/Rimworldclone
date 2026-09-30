import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 200 } });
await p.goto('http://127.0.0.1:5173/');
await p.waitForSelector('[data-m="new"]');
const html = await p.evaluate(async () => {
  const ic = await import('/src/render/art/icons.ts');
  const masks = [0, 2, 4, 2 | 8, 2 | 4, 1 | 4, 15];
  const bw = await import('/src/render/art/buildings.ts'); const px = await import('/src/render/pixel.ts');
  let h = ['wall:wood', 'door:wood', 'wall:steel', 'door:steel', 'column:wood'].map(n => `<img style="width:96px;image-rendering:pixelated;background:#333;margin:4px" src="${ic.iconURL('bld:' + n, 3)}">`).join('');
  h += '<br>' + masks.map(mk => `<img style="width:64px;image-rendering:pixelated;background:#333;margin:4px" src="${px.spriteToDataURL(bw.wallSprite('wood', mk), 3)}">`).join('');
  return h;
});
await p.setContent(`<body style="background:#222">${html}</body>`);
await p.screenshot({ path: '/tmp/claude-0/-home-user-Rimworldclone/c2debd96-f495-551e-ae7c-5ac614f34d0f/scratchpad/icons.png' });
await b.close();
