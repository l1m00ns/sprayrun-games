// Screenshots of the loading screen (while the engine boots) and of the menu top bar at several widths.
//   node tools/loadshot.mjs <out-dir>
import { startServer, launch } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(3400 + Math.floor(Math.random() * 50), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'low', weather: false, music: 0, sfx: 0 } })); } catch (e) { /* noop */ } });
await page.goto(srv.url, { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 1800));
await page.screenshot({ path: `${OUT}/loading.png` });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
await new Promise((r) => setTimeout(r, 800));
for (const w of [1280, 1024, 800]) {
  await page.setViewport({ width: w, height: 640 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/menu-${w}.png` });
}
await browser.close();
srv.stop();
console.log('done');
process.exit(0);
