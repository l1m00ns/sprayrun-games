// Visual check for a runner: boot the menu with that character selected and screenshot it.
//   node tools/rook.mjs [out-dir] [character]
import { startServer, launch } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.tmp-shots';
const CHAR = process.argv[3] || 'rook';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4800 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(1280, 800);
const page = await browser.newPage();
await page.evaluateOnNewDocument((char) => {
  try {
    localStorage.setItem('sprayrun.save.v1', JSON.stringify({
      character: char, unlocked: ['rio', 'kit', 'rook'], onboarded: true,
      settings: { lang: 'en', music: 0, sfx: 0, quality: 'high', autoRes: false, telemetry: false, weather: true, map: 'city' },
    }));
  } catch { /* private mode */ }
}, CHAR);
await page.goto(srv.url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
await new Promise((r) => setTimeout(r, 600));
// The server may re-equip the account's saved runner after login: walk the picker to the requested one.
for (let i = 0; i < 16; i++) {
  const name = await page.$eval('#charName', (e) => e.textContent).catch(() => '');
  if (name === CHAR || name.toLowerCase() === CHAR) break;
  await page.click('#nextChar');
  await new Promise((r) => setTimeout(r, 180));
}
await new Promise((r) => setTimeout(r, 1600));
await page.screenshot({ path: `${OUT}/${CHAR}-menu.png` });
console.log(await page.evaluate(() => ({ name: document.querySelector('#charName')?.textContent, tag: document.querySelector('#charTag')?.textContent, unlocked: !document.querySelector('#unlockBtn') || getComputedStyle(document.querySelector('#unlockBtn')).display === 'none' })));
// In-game check: the chase camera sees the runner from behind, so the boombox and the jacket back show.
await page.evaluate(() => { const g = window.__game; g.save.tutorialDone = true; g.setBot(false); g.start(); });
await page.waitForFunction(() => window.__game.state === 'playing', { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1300));
await page.screenshot({ path: `${OUT}/${CHAR}-run.png` });
await browser.close();
srv.stop();
