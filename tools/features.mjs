// Feature checks: start animation, oncoming trains, parked wagons, dynamic scenery, game over animation.
import { startServer, launch, openGame } from './lib.mjs';

const srv = await startServer(3200 + Math.floor(Math.random() * 50));
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);

// --- start animation: tagging scene, then the guard whistles, then the sprint
const a = await page.evaluate(() => {
  const g = window.__game; g.save.tutorialDone = true; g.start();
  const out = { x0: g.P.x, speed0: g.run.speed, guardHidden: !g.guardVisible };
  g.sim(0.6);
  out.speedSpray = g.run.speed; out.xSpray = g.P.x;
  g.sim(0.9);
  out.say = document.getElementById('h-say').classList.contains('on');
  out.sayText = document.getElementById('h-say').textContent;
  g.sim(1.6);
  out.speedAfter = g.run.speed; out.xAfter = g.P.x;
  return out;
});
ok('runner starts at the wall, not moving (tagging)', a.x0 < -3 && a.speed0 === 0 && a.speedSpray === 0, `x=${a.x0.toFixed(1)} speed=${a.speedSpray}`);
ok('guard whistles with a speech bubble', a.say && /HEY/.test(a.sayText), a.sayText);
ok('sprint begins after the intro', a.speedAfter > 10 && Math.abs(a.xAfter) < 0.2, `speed=${a.speedAfter.toFixed(1)} x=${a.xAfter.toFixed(2)}`);

// --- scenery: parked wagons, rolling trains, bridges, animations
const sc = await page.evaluate(() => {
  const g = window.__game, w = g.world;
  let anims = 0, smokers = 0, meshes = 0;
  for (const s of w.segs) { anims += s.anims.length; smokers += s.smokers.length; meshes += s.group.children.length; }
  return { segs: w.segs.length, anims, smokers, meshes };
});
ok('animated scenery registered (bridges, yards, props)', sc.anims > 0, JSON.stringify(sc));

// --- oncoming trains exist and warn
const on = await page.evaluate(() => { const g = window.__game; g.P.inv = 9999; return g.stepTo('train', 70, 1 / 30, true); });
ok('oncoming train found ahead', !!on && on.vz > 0, JSON.stringify(on));

// --- game over screen: counts up, then shows
await page.evaluate(() => { const g = window.__game; g.run.score = 4321; g.run.coins = 120; g.die('crash'); });
await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const over = await page.evaluate(() => ({ score: document.getElementById('oScore').textContent, coins: document.getElementById('oCoins').textContent }));
ok('game over numbers rolled up to their value', /4\s?3\d\d|4\s?321/.test(over.score) && over.coins.trim() === '120', JSON.stringify(over));

// --- every map generates and plays
for (const m of ['snow', 'tropic', 'desert', 'neon']) {
  const r = await page.evaluate((mm) => { const g = window.__game; g.setMap(mm); g.start(); g.setBot(true); return g.sim(12); }, m);
  ok(`map ${m} plays`, r.dist > 40 && r.state === 'playing', `dist=${r.dist}`);
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close();
srv.stop();
