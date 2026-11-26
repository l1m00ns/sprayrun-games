// Fun modes: Zigzag Rails (the track snakes, the runner follows) and Explore (no obstacles, free movement, no death).
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(5400 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const z = await page.evaluate(() => {
  const g = window.__game; g.save.tutorialDone = true;
  window.__startFun = (o) => { document.getElementById('btnHome') && 0; };
  return null;
});
// modes exist in the picker
await page.evaluate(() => document.getElementById('modeCard').click());
const ids = await page.evaluate(() => [...document.querySelectorAll('.mp-card')].map((c) => c.dataset.id));
ok(ids.includes('fun-zigzag') && ids.includes('explore'), 'the picker lists Zigzag Rails and Explore', ids.join(','));
await page.evaluate(() => document.getElementById('mpClose').click());
// --- zigzag
const zz = await page.evaluate(() => {
  const g = window.__game;
  g.save.playMode = 'fun-zigzag'; g.cheats.bot = true; g.cheats.botGod = false; g.setMap('city');
  document.getElementById('playBtn').click();
  g.fastForward(300); // gets past the intro and the fade-in distance
  g.run.dist = 400;
  const r = g.sim(25);
  return { amp: +g.bend.uSway.value.x.toFixed(2), freq: g.bend.uSway.value.y, state: g.state, dist: r.dist, fun: g.run.fun, cheated: g.run.cheated };
});
ok(zz.fun === 'zigzag' && zz.amp > 3, 'the track sways once the run is under way', JSON.stringify(zz));
ok(zz.state === 'playing' && zz.dist > 100, 'the pro bot still plays it normally (collisions are unchanged)', `dist=${zz.dist}`);
await page.evaluate(() => { window.__game.cheats.bot = false; try { window.__game.die('manual'); } catch (e) { /* over */ } });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); });
await new Promise((r) => setTimeout(r, 900));
const calm = await page.evaluate(() => { const g = window.__game; g.save.settings.mode = 'classic'; g.save.playMode = 'solo-classic'; document.getElementById('playBtn').click(); g.sim(2); return g.bend.uSway.value.x; });
ok(calm < 1, 'a normal run has no sway', String(calm));
await page.evaluate(() => { try { window.__game.die('manual'); } catch (e) { /* over */ } });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); });
await new Promise((r) => setTimeout(r, 900));
// --- explore
const ex = await page.evaluate(() => {
  const g = window.__game;
  g.save.playMode = 'explore'; g.setMap('tropic');
  document.getElementById('playBtn').click();
  g.fastForward(1);
  const w = g.world; let solids = 0; for (const s of w.segs) solids += s.solids.length;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  const x0 = g.P.x; g.sim(2); const x1 = g.P.x;
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
  let hurt = false; try { g.die('crash'); } catch (e) { /* none */ } hurt = g.state !== 'playing';
  const r = g.sim(30);
  return { solids, x0, x1: +x1.toFixed(2), hurt, state: g.state, dist: r.dist, cheated: g.run.cheated, explore: g.run.explore };
});
ok(ex.solids === 0, 'Explore has no obstacles in the world', `solids=${ex.solids}`);
ok(ex.x1 > ex.x0 + 3, 'the runner moves freely sideways (more than one lane)', `${ex.x0} -> ${ex.x1}`);
ok(!ex.hurt && ex.state === 'playing' && ex.dist > 100, 'nothing can end the run, the walk continues', `dist=${ex.dist}`);
ok(ex.cheated && ex.explore, 'nothing is saved or submitted from Explore');
const errs = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
ok(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(fail ? 1 : 0);
