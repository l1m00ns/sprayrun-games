// Trains & difficulty: solid sides, landable roofs, side bumps, hoverboard clears the train, longer oncoming trains,
// corridors, and the pro bot's survival on the harder generator.   node tools/trains.mjs
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(4200 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };

// ---- 1. world statistics at three difficulty levels: carriage counts, ramps, corridors
const stats = await page.evaluate(() => {
  const g = window.__game, out = {};
  g.save.tutorialDone = true; g.setMap('city'); g.setBot(false); g.start();
  for (const [label, metres] of [['early', 0], ['mid', 3000], ['late', 9000]]) {
    g.fastForward(metres ? metres : 1);
    let maxCars = 0, trains = 0, moving = 0, ramps = 0, movingCars = 0, lens = [];
    for (let k = 0; k < 40; k++) {
      g.fastForward(70);
      for (const seg of g.world.segs) for (const s of seg.solids) {
        if (s.kind === 'ramp') ramps++;
        if (s.kind === 'train') { trains++; const cars = Math.round((s.lz1 - s.lz0 + 0.35) / 11.35); maxCars = Math.max(maxCars, cars); if (s.vz) { moving++; movingCars += cars; } lens.push(cars); }
      }
    }
    out[label] = { trains, moving, maxCars, ramps, avgMovingCars: moving ? +(movingCars / moving).toFixed(2) : 0 };
  }
  return out;
});
console.log(JSON.stringify(stats));
ok(stats.early.ramps === 0 && stats.mid.ramps === 0 && stats.late.ramps === 0, 'no ramps are generated (trains are walls)');
ok(stats.late.maxCars >= 4, 'late game has trains of 4+ carriages', `max=${stats.late.maxCars}`);
ok(stats.late.avgMovingCars > stats.early.avgMovingCars, 'oncoming trains get longer over the run', `${stats.early.avgMovingCars} -> ${stats.late.avgMovingCars}`);
ok(stats.mid.trains > stats.early.trains, 'more trains as the run goes on', `${stats.early.trains} -> ${stats.mid.trains}`);

// ---- 2. no coin ends up inside a train, a container or a low barrier
const coinCheck = await page.evaluate(() => {
  const g = window.__game; g.setMap('city'); g.start(); g.fastForward(1);
  let bad = 0, coins = 0;
  for (let k = 0; k < 25; k++) {
    g.fastForward(55);
    for (const c of g.world.coins.list) {
      coins++;
      for (const seg of g.world.segs) for (const s of seg.solids) {
        if (s.vz || s.kind === 'over' || s.kind === 'ramp') continue;
        if (Math.abs(c.x - s.x) > s.hw + 0.2) continue;
        const z0 = seg.z + s.lz0 + (s.off || 0), z1 = seg.z + s.lz1 + (s.off || 0);
        if (c.z < z0 || c.z > z1) continue;
        if (c.y > s.yMin - 0.2 && c.y < s.yMax - 0.4) bad++;
      }
    }
  }
  return { bad, coins };
});
ok(coinCheck.bad === 0, 'no coin is generated inside a wall', JSON.stringify(coinCheck));

// ---- 3. a train front is still a solid wall: running into it ends the run (the roof is landable, the front is not)
const t1 = await page.evaluate(() => {
  const put = (g, lane, wz, cars, vz = 0) => { const segs = g.world.segs; const seg = segs.find((s) => s.z - 64.8 <= wz && wz <= s.z) || segs[0]; return g.world.placeTrain(seg, lane, wz - seg.z, cars, false, 'city', vz); };
  const g = window.__game;
  g.setMap('city'); g.start(); g.fastForward(1);
  g.P.inv = 0; g.cheats.godMode = false;
  const world = g.world, seg = world.segs[0];
  put(g, 1, -30, 2); // a train straight ahead in the middle lane
  g.P.target = 1; g.P.x = 0;
  const r = g.sim(12);
  return { state: r.state, reason: r.reason, roof: r.roof, info: r.info };
});
ok(t1.state !== 'playing' || t1.reason, 'running into a train front ends the run (or stumbles into the guard)', JSON.stringify(t1));

// ---- 3. Super Sneakers: landing on a roof is a walk, not a crash
const t2 = await page.evaluate(() => {
  const put = (g, lane, wz, cars, vz = 0) => { const segs = g.world.segs; const seg = segs.find((s) => s.z - 64.8 <= wz && wz <= s.z) || segs[0]; return g.world.placeTrain(seg, lane, wz - seg.z, cars, false, 'city', vz); };
  const g = window.__game;
  g.setMap('city'); g.start(); g.fastForward(1);
  g.P.inv = 0;
  g.power('sneakers');
  const world = g.world, seg = world.segs[0];
  put(g, 1, -60, 3);
  let onRoof = 0, maxY = 0;
  for (let i = 0; i < 400 && g.state === 'playing'; i++) {
    if (i === 30) g.setBot(false);
    const near = g.findAhead('train', 12);
    if (near && g.P.grounded) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    const r = g.sim(1 / 30, 1 / 30);
    if (g.P.grounded && g.P.y > 2.5) onRoof++;
    maxY = Math.max(maxY, g.P.y);
  }
  return { onRoof, maxY: +maxY.toFixed(2), state: g.state };
});
ok(t2.state === 'playing' || t2.onRoof > 0, 'a sneaker jump onto a roof no longer ends the run', JSON.stringify(t2));

// ---- 4. hoverboard: the board takes the hit AND the train is removed (no riding inside it)
const t3 = await page.evaluate(() => {
  const put = (g, lane, wz, cars, vz = 0) => { const segs = g.world.segs; const seg = segs.find((s) => s.z - 64.8 <= wz && wz <= s.z) || segs[0]; return g.world.placeTrain(seg, lane, wz - seg.z, cars, false, 'city', vz); };
  const g = window.__game;
  g.setMap('city'); g.start(); g.fastForward(1); g.P.inv = 0; g.board();
  const world = g.world, seg = world.segs[0];
  put(g, 1, -20, 2);
  g.P.target = 1;
  const before = world.segs.flatMap((s) => s.solids).filter((s) => s.kind === 'train' && Math.abs(s.x) < 0.5).length;
  for (let i = 0; i < 150 && g.P.onBoard && g.state === 'playing'; i++) g.sim(1 / 30, 1 / 30);
  const inside = world.segs.flatMap((s) => s.solids.map((o) => ({ s, o }))).filter(({ s, o }) => o.kind === 'train' && Math.abs(o.x) < 0.5 && -(s.z + o.lz1) < 0.5 && -(s.z + o.lz0) > -0.5).length;
  return { before, boardLeft: g.P.onBoard, inside, state: g.state };
});
ok(!t3.boardLeft && t3.inside === 0 && t3.state === 'playing', 'hoverboard breaks AND clears the train in front', JSON.stringify(t3));

// ---- 5. side swipe: bounced back to the previous lane (not inside the train)
const t4 = await page.evaluate(() => {
  const put = (g, lane, wz, cars, vz = 0) => { const segs = g.world.segs; const seg = segs.find((s) => s.z - 64.8 <= wz && wz <= s.z) || segs[0]; return g.world.placeTrain(seg, lane, wz - seg.z, cars, false, 'city', vz); };
  const g = window.__game;
  g.setMap('city'); g.start(); g.fastForward(1); g.P.inv = 0;
  const world = g.world, seg = world.segs[0];
  g.setSpeed(20); g.P.target = 1; g.P.prev = 1; g.P.x = 0;
  for (let i = 0; i < 8; i++) g.sim(1 / 30, 1 / 30);
  put(g, 2, -6, 3); // right lane: the nose passes the runner, then the side is alongside
  for (let i = 0; i < 16; i++) g.sim(1 / 30, 1 / 30);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  let minX = 99, maxX = -99, after = null;
  for (let i = 0; i < 40 && g.state === 'playing'; i++) { g.sim(1 / 30, 1 / 30); minX = Math.min(minX, g.P.x); maxX = Math.max(maxX, g.P.x); }
  return { target: g.P.target, x: +g.P.x.toFixed(2), maxX: +maxX.toFixed(2), kind: g.P.hitKind, state: g.state };
});
ok(t4.x < 1.0 && (t4.kind === 'side' || t4.state !== 'playing'), 'a side swipe bounces the runner back (hit kind: side)', JSON.stringify(t4));

// ---- 6. pro bot on the harder generator (not invincible), several maps, late-game difficulty
for (const [map, skip] of [['city', 3000], ['tropic', 3000], ['neon', 6000], ['desert', 9000]]) {
  const res = await page.evaluate(({ m, k }) => { const g = window.__game; g.cheats.bot = true; g.cheats.botGod = false; g.cheats.startPct = 80; g.setMap(m); g.start(); g.fastForward(k); return g.sim(70); }, { m: map, k: skip });
  ok(res.state === 'playing', `pro bot survives 70 s on ${map} after ${skip} m of difficulty`, `dist=${res.dist} coins=${res.coins} roof=${res.roof} reason=${res.reason} events=${(res.events||[]).join(',')} info=${res.info}`);
  await page.evaluate(() => { window.__game.cheats.bot = false; try { window.__game.die('manual'); } catch (e) { /* over */ } });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 400));
}
const errs = logs.filter((l) => /pageerror|Uncaught|TypeError|ReferenceError/.test(l));
ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(fail ? 1 : 0);
