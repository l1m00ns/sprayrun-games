// Hub test: top bar, every page, advent claim, shop purchase, account creation, in a real browser against a real server.
//   node tools/hub.mjs [screenshot-dir]
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(3300 + Math.floor(Math.random() * 50), { TEST_NOW: '2026-12-10T12:00:00Z', AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.getElementById('hubBody').innerText);
const tab = async (t) => { await page.evaluate((x) => document.querySelector(`.tb-tab[data-tab="${x}"]`).click(), t); await sleep(900); };
const sub = async (name) => { await page.evaluate((n) => [...document.querySelectorAll('.subtab')].find((b) => b.textContent === n).click(), name); await sleep(900); };
const shot = (n) => page.screenshot({ path: `${OUT}/hub-${n}.png` });

try {
  await page.waitForFunction(() => window.__game.api.online.player && window.__game.api.online.inv, { timeout: 30000 });
  ok('boots into the menu with an automatic guest account', true);
  ok('top bar is visible with all tabs', await page.evaluate(() => !document.getElementById('topbar').classList.contains('hidden') && document.querySelectorAll('.tb-tab').length === 7));
  ok('wallet chip shows the server wallet', await page.evaluate(() => document.getElementById('mCoins').textContent === '0'));
  await shot('play');

  await tab('shop');
  let t = await text();
  ok('shop lists server items', /Winter Fest/.test(t) || /Hoverboard/.test(t), t.slice(0, 80).replace(/\n/g, ' '));
  await shot('shop-featured');
  await sub('Outfits');
  t = await text();
  ok('outfits tab shows the limited Santa outfit', /Santa Sprint/.test(t) && /LIMITED/.test(t));
  await shot('shop-outfits');

  await tab('events');
  t = await text();
  ok('events: Winter Fest + Gold Rush + advent calendar', /Winter Fest/.test(t) && /Gold Rush/i.test(t) && /Advent calendar/.test(t));
  const doors = await page.evaluate(() => ({ open: document.querySelectorAll('.door.open').length, locked: document.querySelectorAll('.door.locked').length }));
  ok('advent: 10 doors open, 15 locked on Dec 10', doors.open === 10 && doors.locked === 15, JSON.stringify(doors));
  await shot('events');
  const w0 = await page.evaluate(() => window.__game.api.online.wallet);
  await page.evaluate(() => document.querySelector('.door.open').click());
  await sleep(1400);
  const w1 = await page.evaluate(() => window.__game.api.online.wallet);
  ok('opening a door pays coins and updates the top bar', w1 > w0 && (await page.evaluate(() => Number(document.getElementById('mCoins').textContent.replace(/,/g, '')))) === w1, `${w0} -> ${w1}`);
  for (let i = 0; i < 9; i++) { await page.evaluate(() => { const d = document.querySelector('.door.open'); if (d) d.click(); }); await sleep(800); }

  await tab('shop');
  await sub('Hoverboards');
  const b0 = await page.evaluate(() => window.__game.api.online.inv.boards);
  await page.evaluate(() => document.querySelector('.c2 [data-act="buy"]').click());
  await sleep(1400);
  const b1 = await page.evaluate(() => window.__game.api.online.inv.boards);
  ok('buying a hoverboard goes through the server', b1 === b0 + 1, `${b0} -> ${b1}`);
  ok('local save mirrors the server inventory', await page.evaluate(() => window.__game.save.boards === window.__game.api.online.inv.boards));
  await shot('shop-boards');

  await tab('career');
  t = await text();
  ok('career page: level, stats, achievements', /Level \d/.test(t) && /Achievements/.test(t) && /Runs/.test(t));
  await shot('career');
  await tab('leaderboard'); t = await text(); ok('leaderboard page renders', /LEADERBOARD/.test(t));
  await tab('updates'); t = await text(); ok('updates page lists v2.0.0', /v2\.0\.0/.test(t) && /Premium codes/.test(t));
  await shot('updates');
  await tab('support'); t = await text(); ok('support page opens', /SUPPORT/.test(t) && /NEW REQUEST/.test(t));

  // account creation through the UI
  await page.evaluate(() => document.getElementById('tbAcct').click()); await sleep(900); t = await text();
  ok('account page offers sign-up for guests', /CREATE ACCOUNT/.test(t));
  await page.type('#auUser', 'hubtester'); await page.type('#auName', 'HubTester'); await page.type('#auPass', 'a-long-test-password');
  await page.click('#auGo');
  await sleep(2800);
  t = await text();
  ok('account created from the UI, cloud sync active', /hubtester/.test(t) && /Synced/.test(t), t.replace(/\n/g, ' ').slice(0, 140));
  await shot('account');
  ok('top bar shows the new name', await page.evaluate(() => document.getElementById('tbName').textContent === 'HubTester'));

  // support chat (rules mode in tests)
  await tab('support');
  await page.click('#newTicket'); await sleep(300);
  await page.type('#tkMsg', 'My shop balance looks wrong');
  await page.click('#tkSend');
  await sleep(2800);
  t = await text();
  ok('support chat: instant assistant reply', /SURF/.test(t) && /wallet|balance|solde/i.test(t), t.replace(/\n/g, ' ').slice(0, 160));
  await shot('support');

  // play tab: menu still works, and starting a run hides the bar
  await tab('play');
  ok('play tab restores the menu', await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden') && document.getElementById('hubpage').classList.contains('hidden')));
  await page.evaluate(() => { window.__game.save.tutorialDone = true; window.__game.start(); });
  await sleep(600);
  ok('top bar hides during a run', await page.evaluate(() => document.getElementById('topbar').classList.contains('hidden')));
  await page.evaluate(() => window.__game.die('crash'));
  await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 });
  await sleep(2500);
  const over = await page.evaluate(() => document.getElementById('oOnline').innerText);
  ok('game over shows a server verdict', /Banked|rejected|Leaderboard|Revived|not reach/.test(over), over.replace(/\n/g, ' '));
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.message); }
console.log(logs.length ? logs.slice(0, 8).join('\n') : 'no console errors');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.stop();
process.exit(fail ? 1 : 0);
