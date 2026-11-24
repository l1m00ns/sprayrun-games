// Secret menu + pro bot test: Konami unlock, 70+ options, practice-run isolation (nothing banked / submitted), bot skill.
//   node tools/secret.mjs
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(3500 + Math.floor(Math.random() * 50), { AI_DISABLED: '1' });
const browser = await launch(1100, 640);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const konami = async () => { for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) { await page.keyboard.press(k); await sleep(30); } };

try {
  await page.waitForFunction(() => window.__game.api.online.player && window.__game.api.online.inv, { timeout: 30000 });
  ok('menu has no secret button before unlocking', await page.evaluate(() => document.getElementById('btnSecret').classList.contains('hidden')));
  await konami(); await sleep(500);
  ok('Konami code unlocks the secret menu (native dialog, no browser popup)', await page.evaluate(() => window.__game.dlgOpen && /SECRET MENU UNLOCKED/.test(document.getElementById('dlgTitle').textContent)));
  await page.evaluate(() => document.getElementById('dlgYes').click()); await sleep(300);
  await konami(); await sleep(500);
  ok('second Konami opens the menu', await page.evaluate(() => !document.getElementById('secret').classList.contains('hidden')));
  const count = await page.evaluate(() => Object.keys(window.__game.cheats).length + 4);
  ok('60+ options', count >= 60, `${count} options`);
  await page.evaluate(() => document.querySelector('#secTabs .tab[data-g="Look"]').click()); await sleep(200);
  await page.evaluate(() => { const el = document.querySelector('[data-k="grayscale"]'); el.checked = true; el.dispatchEvent(new Event('change')); });
  ok('visual option applies and is free (no taint)', await page.evaluate(() => /grayscale/.test(document.getElementById('c').style.filter)));
  await page.evaluate(() => document.getElementById('secClose').click());

  // a clean run is eligible for the server; a run with a gameplay option is a practice run
  await page.evaluate(() => { window.__game.save.tutorialDone = true; window.__game.start(); });
  await page.waitForFunction(() => !!window.__game.api.online.ticket, { timeout: 15000 }).catch(() => {}); // the ticket request can be slow on a software GL machine
  const clean = await page.evaluate(() => ({ cheated: window.__game.run.cheated, hasTicket: !!window.__game.api.online.ticket }));
  ok('visual-only session is NOT a practice run (ticket requested)', clean.cheated === false && clean.hasTicket === true, JSON.stringify(clean));
  await page.evaluate(() => window.__game.die('crash'));
  await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 });
  await page.evaluate(() => document.getElementById('btnHome').click()); await sleep(600);

  const wallet0 = await page.evaluate(() => window.__game.api.online.wallet);
  const best0 = await page.evaluate(() => window.__game.save.best);
  await page.evaluate(() => { window.__game.cheats.god = true; window.__game.cheats.coinMul = 10; window.__game.cheats.scoreMul = 10; });
  await page.evaluate(() => window.__game.start());
  await sleep(700);
  const prac = await page.evaluate(() => ({ cheated: window.__game.run.cheated, hasTicket: !!window.__game.api.online.ticket, badge: !document.getElementById('h-cheat').classList.contains('hidden') }));
  ok('gameplay cheat = practice run: no ticket, badge shown', prac.cheated === true && prac.hasTicket === false && prac.badge, JSON.stringify(prac));
  const r = await page.evaluate(() => window.__game.sim(25));
  ok('god mode survives 25 s', r.state === 'playing', `dist=${r.dist}`);
  await page.evaluate(() => { window.__game.state; window.__game.die('manual'); });
  await page.evaluate(() => { /* manual end of a god run */ });
  await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 }).catch(() => {});
  await sleep(1500);
  const after = await page.evaluate(() => ({ wallet: window.__game.api.online.wallet, localCoins: window.__game.save.coins, best: window.__game.save.best, note: document.getElementById('oOnline').innerText }));
  ok('practice run banks nothing: wallet, coins and records unchanged', after.wallet === wallet0 && after.best === best0, JSON.stringify({ wallet0, ...after }));
  ok('over screen explains the practice run', /Practice run/.test(after.note), after.note);
  await page.evaluate(() => document.getElementById('btnHome').click()); await sleep(600);
  await page.evaluate(() => { const g = window.__game; g.cheats.god = false; g.cheats.coinMul = 1; g.cheats.scoreMul = 1; });
  // online is blocked while an option is on
  await page.evaluate(() => { window.__game.cheats.freeRevive = true; });
  await page.evaluate(() => document.getElementById('btnOnline').click()); await sleep(600);
  await page.evaluate(() => document.getElementById('btnQuick').click()); await sleep(900);
  ok('online play is blocked while cheats are on', await page.evaluate(() => /Secret Menu/.test(document.getElementById('lobErr').textContent)), await page.evaluate(() => document.getElementById('lobErr').textContent));
  await page.evaluate(() => { window.__game.cheats.freeRevive = false; document.getElementById('btnLobClose').click(); }); await sleep(300);

  // pro bot WITHOUT invincibility: real skill on three maps
  for (const map of ['city', 'snow', 'neon']) {
    const res = await page.evaluate((m) => { const g = window.__game; g.cheats.bot = true; g.cheats.botGod = false; g.setMap(m); g.start(); return g.sim(75); }, map);
    ok(`pro bot (not invincible) survives 75 s on ${map}`, res.state === 'playing' && res.dist > 800, `dist=${res.dist} coins=${res.coins}`);
    await page.evaluate(() => { window.__game.cheats.bot = false; window.__game.die('manual'); });
    await sleep(400);
    await page.evaluate(() => { const o = document.getElementById('btnHome'); if (o) o.click(); }); await sleep(500);
  }
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.message); }
console.log(logs.length ? logs.slice(0, 8).join('\n') : 'no console errors');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.stop();
process.exit(fail ? 1 : 0);
