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
  await page.click('#modeCard'); await sleep(400);
  await page.screenshot({ path: `${OUT}/${tag}-picker.png` });
  ok((await overflow()).length === 0, `${tag}: mode picker fits`, (await overflow()).join(' '));
  await page.click('#mpClose'); await sleep(200);
  const menuShown = await page.evaluate(() => { const b = document.getElementById('tbMenu'); return !!b && getComputedStyle(b).display !== 'none'; });
  ok(menuShown, `${tag}: the three-bar menu button is visible`);
  await page.click('#tbMenu'); await sleep(300);
  const drawer = await page.evaluate(() => ({ open: !document.getElementById('tbDrawer').classList.contains('hidden'), tabs: document.querySelectorAll('#tbDrawer [data-nav]').length, actions: document.querySelectorAll('#tbDrawer [data-act]').length, text: document.getElementById('tbDrawer').textContent }));
  ok(drawer.open && drawer.tabs >= 7 && drawer.actions === 4, `${tag}: the menu sheet lists every tab and account action`, JSON.stringify(drawer));
  ok(/v3\.1\.2/.test(drawer.text), `${tag}: the full version code is visible in the menu`, drawer.text.slice(-32));
  await page.screenshot({ path: `${OUT}/${tag}-drawer.png` });
  ok((await overflow()).length === 0, `${tag}: the menu sheet fits`, (await overflow()).join(' '));
  await page.click('#tbDrawer [data-nav="shop"]'); await sleep(900); // a real pointer click: this failed while the sheet was pointer-events:none
  ok(await page.evaluate(() => !document.getElementById('hubpage').classList.contains('hidden') && /SHOP/.test(document.getElementById('hubBody').textContent)), `${tag}: tapping SHOP in the menu opens the shop`);
  await page.click('#tbMenu'); await sleep(250);
  await page.click('#tbDrawer [data-nav="play"]'); await sleep(300);
  ok(await page.evaluate(() => document.getElementById('hubpage').classList.contains('hidden')), `${tag}: tapping PLAY returns to the runner`);
  await page.click('#tbMenu'); await sleep(200);
  await page.click('#tbDrawer [data-act="friends"]'); await sleep(1500);
  await page.screenshot({ path: `${OUT}/${tag}-friends.png` });
  ok((await overflow()).length === 0, `${tag}: friends panel fits`, (await overflow()).join(' '));
  await page.click('#frClose'); await sleep(200);
  await page.evaluate(() => { window.__game.save.tutorialDone = true; window.__game.start(); });
  await page.evaluate(() => { window.__game.run.introOn = false; window.__game.run.t = 4; }); // skip the intro in this slow software renderer
  await sleep(4000);
  await page.screenshot({ path: `${OUT}/${tag}-hud.png` });
  ok((await overflow()).length === 0, `${tag}: HUD fits`, (await overflow()).join(' '));
  const cam = await page.evaluate(() => ({ y: window.__game.cam.position.y, z: window.__game.cam.position.z, state: window.__game.state }));
  ok(cam.state === 'playing' && cam.y > 4.3 && cam.z > 6.3, `${tag}: the high chase camera sees down the track`, JSON.stringify(cam));
  await page.evaluate(() => { try { window.__game.die('manual'); } catch (e) { /* over */ } }); await sleep(2500);
  await page.screenshot({ path: `${OUT}/${tag}-over.png` });
  await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); }); await sleep(900);
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(0);
