// Phone layouts: portrait and landscape screenshots of the main screens, plus overflow checks.   node tools/mobile.mjs <dir>
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(5200 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const page = await openGame(browser, srv.url, { quality: 'low' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const overflow = () => page.evaluate(() => { const bad = []; const vw = window.innerWidth, vh = window.innerHeight; for (const el of document.querySelectorAll('#ui *')) { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('.hidden')) continue; if (r.right > vw + 2 || r.left < -2) { if (!el.closest('#tbTabs, #mpBody, #frBody, .mp-grid, #warp, #confetti')) bad.push(`${el.id || String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName}<${(el.parentElement && (el.parentElement.id || el.parentElement.className)) || ''}:${Math.round(r.left)}..${Math.round(r.right)}`); } } return bad.slice(0, 6); });
for (const [w, h, tag] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 120000 }); // the emulation change reloads the page
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/${tag}-menu.png` });
  ok((await overflow()).length === 0, `${tag}: menu has no horizontal overflow`, (await overflow()).join(' '));
  await page.evaluate(() => document.getElementById('modeCard').click()); await sleep(400);
  await page.screenshot({ path: `${OUT}/${tag}-picker.png` });
  ok((await overflow()).length === 0, `${tag}: mode picker fits`, (await overflow()).join(' '));
  await page.evaluate(() => document.getElementById('mpClose').click()); await sleep(200);
  await page.evaluate(() => document.getElementById('tbFriends').click()); await sleep(1500);
  await page.screenshot({ path: `${OUT}/${tag}-friends.png` });
  ok((await overflow()).length === 0, `${tag}: friends panel fits`, (await overflow()).join(' '));
  await page.evaluate(() => document.getElementById('frClose').click()); await sleep(200);
  await page.evaluate(() => { window.__game.save.tutorialDone = true; window.__game.start(); });
  await sleep(5000);
  await page.screenshot({ path: `${OUT}/${tag}-hud.png` });
  ok((await overflow()).length === 0, `${tag}: HUD fits`, (await overflow()).join(' '));
  await page.evaluate(() => { try { window.__game.die('manual'); } catch (e) { /* over */ } }); await sleep(2500);
  await page.screenshot({ path: `${OUT}/${tag}-over.png` });
  await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); }); await sleep(900);
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(0);
