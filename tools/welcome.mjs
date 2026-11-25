// First-visit welcome flow, language switching, ranked gate UI, appeals UI and statistics page, in a real browser.
//   node tools/welcome.mjs [screenshot-dir]
import { startServer, launch } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(3800 + Math.floor(Math.random() * 50), { AI_DISABLED: '1', ADMIN_KEY: 'k', IPINTEL_OFFLINE: '1' });
const browser = await launch(1280, 720);
const logs = [];
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (m) => { if (['error'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
// a brand-new visitor: NO onboarded flag (only light graphics so the software renderer copes)
await page.evaluateOnNewDocument(() => { try { if (!localStorage.getItem('sprayrun.save.v1')) localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'low', weather: false, music: 0, sfx: 0 } })); } catch (e) { /* noop */ } });
await page.goto(srv.url, { waitUntil: 'load' });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (sel) => page.evaluate((s) => (document.querySelector(s) || {}).innerText || '', sel);
const hub = () => page.evaluate(() => document.getElementById('hubBody').innerText);
const shot = (n) => page.screenshot({ path: `${OUT}/welcome-${n}.png` });
const tab = async (t) => { await page.evaluate((x) => document.querySelector(`.tb-tab[data-tab="${x}"]`).click(), t); await sleep(900); };

try {
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
  await sleep(1200);
  ok('first visit shows the welcome flow', await page.evaluate(() => !document.getElementById('onboard').classList.contains('hidden')));
  await shot('1-language');
  ok('step 1 offers the languages', await page.evaluate(() => document.querySelectorAll('#obBody .obcard').length >= 2));
  await page.evaluate(() => document.querySelector('#obBody .obcard[data-v="fr"]').click());
  await sleep(700);
  ok('choosing French translates the flow immediately', /BIENVENUE/.test(await txt('#obBody')), (await txt('#obBody')).replace(/\n/g, ' ').slice(0, 60));
  ok('the top bar follows (JOUER / BOUTIQUE)', /JOUER/.test(await page.evaluate(() => document.getElementById('tbTabs').textContent)) && /BOUTIQUE/.test(await page.evaluate(() => document.getElementById('tbTabs').textContent)));
  await page.evaluate(() => document.getElementById('obNext').click()); await sleep(500);
  await shot('2-look');
  await page.evaluate(() => document.querySelector('#obBody .obcard[data-v="low"]').click()); await sleep(300);
  await page.evaluate(() => document.getElementById('obNext').click()); await sleep(500);
  await page.evaluate(() => document.querySelector('#obBody [data-key="controls"] .obcard[data-v="classic"]').click()); await sleep(300);
  await page.evaluate(() => document.querySelector('#obBody [data-key="camera"] .obcard[data-v="far"]').click()); await sleep(300);
  await shot('3-controls');
  await page.evaluate(() => document.getElementById('obNext').click()); await sleep(500);
  ok('fair-play & privacy step explains VPN + device checks', /VPN/.test(await txt('#obBody')) && /ban/i.test(await txt('#obBody')));
  await shot('4-privacy');
  await page.evaluate(() => document.getElementById('obNext').click()); await sleep(500);
  await page.evaluate(() => document.querySelector('#obBody [data-act="guest"]').click()); await sleep(600);
  const s = await page.evaluate(() => ({ onb: window.__game.save.onboarded, lang: window.__game.save.settings.lang, ctl: window.__game.save.settings.controls, cam: window.__game.save.settings.camera, q: window.__game.save.settings.quality, hidden: document.getElementById('onboard').classList.contains('hidden'), htmlLang: document.documentElement.lang }));
  ok('choices are saved and the flow closes', s.onb === true && s.lang === 'fr' && s.ctl === 'classic' && s.cam === 'far' && s.q === 'low' && s.hidden && s.htmlLang === 'fr', JSON.stringify(s));
  ok('the menu is in French', /MISSIONS/.test(await txt('#m-missions')) && /Meilleur score/.test(await txt('#m-stats')) && /CARTE/.test(await txt('#m-maps')));
  await shot('5-menu-fr');
  // language button
  await page.evaluate(() => document.getElementById('tbLang').click()); await sleep(400);
  ok('language button opens the picker', await page.evaluate(() => !document.getElementById('langModal').classList.contains('hidden')));
  await page.evaluate(() => document.querySelector('#langList .obcard[data-v="en"]').click()); await sleep(700);
  ok('switching back to English restores the text', /PLAY/.test(await txt('#tbTabs')) && /Best score/.test(await txt('#m-stats')) && (await page.evaluate(() => document.getElementById('tbLangCode').textContent)) === 'EN');
  await page.evaluate(() => document.getElementById('tbLang').click()); await sleep(300);
  await page.evaluate(() => document.querySelector('#langList .obcard[data-v="fr"]').click()); await sleep(600);
  await tab('shop');
  ok('hub pages are translated too (shop)', /Prix|BOUTIQUE|À la une/.test(await hub()), (await hub()).replace(/\n/g, ' ').slice(0, 80));
  await shot('6-shop-fr');
  await page.evaluate(() => window.__game.setLang('en')); await sleep(400);

  // ---- ranked gate in the lobby
  await page.waitForFunction(() => window.__game.api.online.player && window.__game.api.online.inv, { timeout: 30000 });
  await tab('play');
  await page.evaluate(() => document.getElementById('btnOnline').click()); await sleep(900);
  ok('lobby shows the ranked play-time gate and disables Ranked', /Ranked unlocks after 15 min/.test(await txt('#rankedNote')) && await page.evaluate(() => document.getElementById('btnRanked').disabled), await txt('#rankedNote'));
  await shot('7-ranked-gate');
  await page.evaluate(() => document.getElementById('btnLobClose').click()); await sleep(300);

  // ---- device report
  const dev = await page.evaluate(() => window.__game.api.reportDevice(true));
  ok('device signals are collected and reported', dev && dev.ok === true && dev.network, JSON.stringify(dev));

  // ---- appeals, end to end in the UI (a moderator kicks the player, the player contests with a human review)
  const pid = await page.evaluate(() => window.__game.api.online.player.id);
  await fetch(`${srv.url}/api/admin/kick`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'k' }, body: JSON.stringify({ pid, reason: 'test', seconds: 600 }) });
  await page.evaluate(() => window.__game.api.refreshMe());
  await page.evaluate(() => window.__game.hub.openAppeals()); await sleep(1200);
  ok('Support > Appeals shows the sanction and a contest button', /CONTEST THIS SANCTION/.test(await hub()) && /0\/3 used/.test(await hub()), (await hub()).replace(/\n/g, ' ').slice(0, 100));
  await page.evaluate(() => document.getElementById('appealNew').click()); await sleep(600);
  ok('the form offers AI Review (under 15 min) and Human Review (1-7 days)', /AI Review/.test(await hub()) && /under 15 minutes/.test(await hub()) && /Human Review/.test(await hub()) && /1 to 7 days/.test(await hub()));
  await shot('8-appeal-form');
  await page.evaluate(() => document.querySelector('[data-type="human"]').click());
  await page.type('#apMsg', 'The kick was a mistake, I was only playing normally.');
  await page.evaluate(() => document.getElementById('apGo').click()); await sleep(1500);
  ok('the appeal is tracked with a timeline', /APPEAL #1/.test(await hub()) && /Waiting for a moderator/.test(await hub()) && /Timeline/.test(await hub()), (await hub()).replace(/\n/g, ' ').slice(0, 120));
  await shot('9-appeal-tracking');
  await page.evaluate(() => document.getElementById('back').click()); await sleep(900);
  ok('the list shows 1/3 used', /1\/3 used/.test(await hub()));

  // ---- statistics
  await tab('career');
  await page.evaluate(() => document.querySelector('[data-ct="stats"]').click()); await sleep(1200);
  ok('Career > Stats renders charts', (await page.evaluate(() => document.querySelectorAll('svg.chart').length)) >= 3 && /Minutes played per day/.test(await hub()));
  await shot('10-stats');
  await page.evaluate(() => document.querySelector('[data-ct="overview"]').click()); await sleep(800);
  ok('Career shows the ranked progress bar', /Ranked unlocks after 15 min/.test(await hub()));
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.message); }
console.log(logs.length ? logs.slice(0, 8).join('\n') : 'no console errors');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.stop();
process.exit(fail ? 1 : 0);
