// Language switching check: every language on the main screens, plus fr -> de -> en round trips. node tools/langshot.mjs <dir>
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4800 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const page = await openGame(browser, srv.url, { quality: 'low' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const texts = () => page.evaluate(() => [...document.querySelectorAll('#topbar .tb-tab, #playBtn, #modeCard, #m-missions h3, #m-stats h3, #m-maps h3')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
const tab = async (t) => { await page.evaluate((x) => document.querySelector(`.tb-tab[data-tab="${x}"]`).click(), t); await sleep(700); };
const out = {};
for (const lang of ['fr', 'de', 'es', 'ja', 'en']) {
  await page.evaluate((l) => window.__game.setLang(l), lang);
  await sleep(1500);
  out[lang] = await texts();
  console.log(lang.padEnd(3), out[lang].slice(0, 170));
}
await page.evaluate(() => window.__game.setLang('de')); await sleep(1200);
await tab('shop'); await page.screenshot({ path: `${OUT}/de-shop.png` });
await page.evaluate(() => window.__game.setLang('fr')); await sleep(1200); await page.screenshot({ path: `${OUT}/fr-shop-after-de.png` });
console.log('de-after-fr-leftovers:', await page.evaluate(() => [...document.querySelectorAll('#hubBody h1, #hubBody h2, #hubBody .set-row span, #hubBody button')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 14).join(' | ')));
await browser.close(); srv.stop(); process.exit(0);
