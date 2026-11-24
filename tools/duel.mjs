// Gold Rush duel, client side, in a real browser: arena, Gold Eagle, bot, win / draw flow, solo LTM warp from a run.
//   node tools/duel.mjs [screenshot-dir]
import { startServer, launch, openGame } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(3600 + Math.floor(Math.random() * 50), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
page.on('response', (r) => { if (r.status() === 401) logs.push('[401] ' + r.request().method() + ' ' + r.url() + ' ' + JSON.stringify(r.request().initiator()).slice(0, 700)); });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (fn) => page.evaluate(fn);
const shot = (n) => page.screenshot({ path: `${OUT}/duel-${n}.png` });
const wf = async (fn, ms, label) => { try { await page.waitForFunction(fn, { timeout: ms }); } catch (e) { console.log('WAIT FAILED:', label, JSON.stringify(await D(() => ({ state: window.__game.state, phase: window.__game.duelCtl.state.phase, t: window.__game.duelCtl.state.t, active: window.__game.duelCtl.active })))); throw e; } };
const aimAtFoe = () => D(() => { const d = window.__game.duelCtl.state, m = d.me.body, f = d.foe.body; const dx = f.x - m.x, dz = f.z - m.z; d.yaw = Math.atan2(-dx, -dz); d.pitch = Math.atan2(1.15 - 1.62, Math.hypot(dx, dz)); });

try {
  await page.evaluate(() => { window.__game.cheats.duelBot = 'dummy'; });
  await page.evaluate(() => window.__game.enterArena({ online: false }));
  await sleep(1500);
  ok('arena opens: state duel, HUD visible, countdown', await D(() => window.__game.state === 'duel' && !document.getElementById('duelhud').classList.contains('hidden') && document.getElementById('dMsg').textContent.length > 0));
  await shot('countdown');
  await D(() => { const d = window.__game.duelCtl.state; d.t = d.liveT; }); // software GL is slow: jump to the end of the countdown
  await wf(() => window.__game.duelCtl.state.phase === 'live', 60000, 'wait1');
  ok('countdown ends, FIGHT', true);
  await D(() => { const d = window.__game.duelCtl.state; d.me.body.x = 3.8; d.yaw = 0; });
  await sleep(300);
  await shot('live-view');
  // hip-fire and aim-down-sights views of the Gold Eagle
  await aimAtFoe(); await sleep(400);
  await D(() => { window.__game.duelCtl.state.aim = true; }); await sleep(700);
  await shot('ads');
  await D(() => { window.__game.duelCtl.state.aim = false; }); await sleep(400);
  const a0 = await D(() => window.__game.duelCtl.state.me.ammo);
  await D(() => { window.__game.duelCtl.state.firing = true; });
  await sleep(150); await shot('muzzle');
  await sleep(1300);
  await D(() => { window.__game.duelCtl.state.firing = false; });
  const s = await D(() => ({ ammo: window.__game.duelCtl.state.me.ammo, foeHp: window.__game.duelCtl.state.foe.hp, shots: window.__game.duelCtl.state.stats.shots, hits: window.__game.duelCtl.state.stats.hits }));
  ok('firing spends ammo and hits the bot (2 headshots kill)', s.shots >= 2 && s.hits >= 2 && s.ammo < a0, JSON.stringify(s));
  await wf(() => !document.getElementById('duelres').classList.contains('hidden'), 60000, 'wait2');
  ok('bot eliminated: VICTORY screen', await D(() => /VICTORY/.test(document.getElementById('drTitle').textContent)), await D(() => document.getElementById('drStats').innerText.replace(/\n/g, ' ')));
  await shot('victory');

  // reload animation
  await D(() => document.getElementById('drAgain').click());
  await sleep(600); await D(() => { const d = window.__game.duelCtl.state; d.t = d.liveT; });
  await wf(() => window.__game.duelCtl.state.phase === 'live', 60000, 'wait3');
  await D(() => { const d = window.__game.duelCtl.state; d.me.ammo = 2; });
  await page.keyboard.press('r'); await sleep(900);
  ok('R reloads (animation running, ammo refilled after)', await D(() => window.__game.duelCtl.state.reload > 0));
  await shot('reload');
  await D(() => { for (let i = 0; i < 120; i++) window.__game.duelCtl.update(1 / 30); }); // advance the simulation without rendering (software GL is slow)
  ok('reload completes: magazine full', await D(() => window.__game.duelCtl.state.me.ammo === 7 && window.__game.duelCtl.state.reload === 0));

  // time runs out -> draw
  await D(() => { const d = window.__game.duelCtl.state; d.endsAt = d.t + 0.4; });
  await wf(() => !document.getElementById('duelres').classList.contains('hidden'), 60000, 'wait4');
  ok('2:00 elapsed with both alive: DRAW', await D(() => /DRAW/.test(document.getElementById('drTitle').textContent)));
  await D(() => document.getElementById('drHome').click());
  await sleep(800);

  // the pro bot fights back (player stands still): it must find a line of sight and hurt us
  await D(() => { window.__game.cheats.duelBot = 'pro'; window.__game.enterArena({ online: false }); });
  await sleep(600); await D(() => { const d = window.__game.duelCtl.state; d.t = d.liveT; });
  await wf(() => window.__game.duelCtl.state.phase === 'live', 60000, 'wait5');
  await D(() => { const c = window.__game.duelCtl; for (let i = 0; i < 2700 && c.state.phase === 'live' && c.state.me.hp >= 100; i++) c.update(1 / 30); }); // up to 90 s of match time, simulated without rendering
  const hp = await D(() => window.__game.duelCtl.state.me.hp);
  ok('pro bot flanks the wagon and damages a stationary player', hp < 100, `my hp=${hp}`);
  await shot('pro-bot');
  await D(() => { window.__game.cheats.duelGod = true; });
  await D(() => window.__game.duelCtl.stop()); await D(() => window.__game.startDuel && 0);
  await D(() => { window.__game.cheats.duelGod = false; window.__game.cheats.duelBot = 'normal'; const g = window.__game; g.showDuelResult && 0; });
  await D(() => { const el = document.getElementById('duelres'); if (el) el.classList.add('hidden'); });
  await D(() => window.__game.hub && window.__game.hub.setBarVisible(true));

  // solo Gold Rush: a normal run that warps into the arena at a random moment
  await D(() => { const g = window.__game; g.save.tutorialDone = true; g.enterMenu && 0; });
  await D(() => window.__game.startSoloDuelRun());
  await sleep(600);
  ok('solo Gold Rush starts as a normal run (practice)', await D(() => window.__game.state === 'playing' && window.__game.run.ltm === 'goldrush' && window.__game.run.cheated === true));
  await D(() => { window.__game.run.warpAt = window.__game.run.t + 0.2; });
  await wf(() => window.__game.state === 'duel' || document.getElementById('warp').className.includes('on'), 60000, 'wait6');
  ok('the track warps (overlay) and then the arena opens', true);
  await shot('warp');
  await wf(() => window.__game.state === 'duel', 60000, 'wait7');
  ok('arena open after the warp', true);
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.message); }
console.log(logs.length ? logs.slice(0, 10).join('\n') : 'no console errors');
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
srv.stop();
process.exit(fail ? 1 : 0);
