// UI audit: screenshots of every main screen at several window sizes, to spot layout bugs.
//   node tools/audit.mjs <out-dir> [quick]
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
const QUICK = process.argv[3] === 'quick';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4100 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const page = await openGame(browser, srv.url, { quality: 'low' });
await page.waitForFunction(() => window.__game.api.online.player, { timeout: 30000 }).catch(() => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sizes = QUICK ? [[1280, 720], [390, 844]] : [[1920, 1080], [1280, 720], [1024, 640], [800, 600], [390, 844]];
const tab = async (t) => { await page.evaluate((x) => document.querySelector(`.tb-tab[data-tab="${x}"]`).click(), t); await sleep(900); };
for (const [w, h] of sizes) {
  await page.setViewport({ width: w, height: h, hasTouch: w < 500, isMobile: w < 500 });
  await sleep(500);
  const tag = `${w}x${h}`;
  await tab('play'); await page.screenshot({ path: `${OUT}/${tag}-menu.png` });
  await tab('shop'); await page.screenshot({ path: `${OUT}/${tag}-shop.png` });
  await tab('career'); await page.screenshot({ path: `${OUT}/${tag}-career.png` });
  await tab('events'); await page.screenshot({ path: `${OUT}/${tag}-events.png` });
  await tab('support'); await page.screenshot({ path: `${OUT}/${tag}-support.png` });
  await tab('play');
  await page.evaluate(() => document.getElementById('btnSettings').click()); await sleep(500); await page.screenshot({ path: `${OUT}/${tag}-settings.png` });
  await page.evaluate(() => document.getElementById('btnSetClose').click()); await sleep(300);
  await page.evaluate(() => document.getElementById('btnOnline').click()); await sleep(500); await page.screenshot({ path: `${OUT}/${tag}-lobby.png` });
  await page.evaluate(() => document.getElementById('btnLobClose').click()); await sleep(300);
  await page.evaluate(() => { window.__game.save.tutorialDone = true; window.__game.start(); });
  await sleep(4200); await page.screenshot({ path: `${OUT}/${tag}-hud.png` });
  await page.evaluate(() => window.__game.die('crash'));
  await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 }).catch(() => {});
  await sleep(2500); await page.screenshot({ path: `${OUT}/${tag}-over.png` });
  await page.evaluate(() => document.getElementById('btnHome').click()); await sleep(900);
}
console.log('done', sizes.map((s) => s.join('x')).join(' '));
await browser.close(); srv.stop(); process.exit(0);
