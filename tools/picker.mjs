// Screenshot the mode picker at desktop and phone sizes (visual check of spacing/overflow).
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.tmp-shots';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4700 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
for (const [name, w, h] of [['desktop', 1280, 800], ['phone', 390, 844]]) {
  const browser = await launch(w, h);
  const page = await openGame(browser, srv.url, { quality: 'low', settings: { telemetry: false } });
  await page.click('#modeCard');
  await page.waitForSelector('#modePick:not(.hidden)');
  await new Promise((r) => setTimeout(r, 650));
  await page.screenshot({ path: `${OUT}/picker-${name}.png` });
  const box = await page.evaluate(() => {
    const g = document.querySelector('.mp-grid'), b = document.querySelector('#mpBody');
    const cards = [...document.querySelectorAll('.mp-card')].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });
    const get = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom), flex: c.flex, height: c.height, maxH: c.maxHeight, overflow: c.overflow, pos: c.position, mt: c.marginTop }; };
    return { gridGap: getComputedStyle(g).gap, body: b ? [b.clientWidth, b.scrollWidth, b.clientHeight, b.scrollHeight] : null, cards, panel: get('#modePick .panel'), mpBody: get('#mpBody'), row: get('.mp-close-row'), close: get('#mpClose') };
  });
  console.log(name, JSON.stringify(box));
  await browser.close();
}
srv.stop();
