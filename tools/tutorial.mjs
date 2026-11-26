// First-run tutorial: the six-step panel appears, a real key advances it, skip ends it and is persisted.
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(5600 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const txt = (s) => page.evaluate((q) => (document.querySelector(q) || {}).textContent || '', s);

await page.evaluate(() => { window.__game.save.tutorialDone = false; window.__game.save.tutStep = 0; document.getElementById('playBtn').click(); });
await page.evaluate(() => window.__game.fastForward(300));
await new Promise((r) => setTimeout(r, 700));
ok(await page.evaluate(() => document.getElementById('h-tut').classList.contains('tut')), 'the tutorial panel is visible on the first run');
ok(/STEP 1\/6/.test(await txt('#h-tut')) && /Change lane/.test(await txt('#h-tut')), 'step 1 is the lane change', (await txt('#h-tut')).replace(/\s+/g, ' ').slice(0, 60));

await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })));
await page.evaluate(() => window.__game.sim(0.2));
await new Promise((r) => setTimeout(r, 300));
ok(/STEP 2\/6/.test(await txt('#h-tut')), 'a lane change advances to step 2', (await txt('#h-tut')).replace(/\s+/g, ' ').slice(0, 60));

await page.evaluate(() => document.getElementById('tutSkip').click());
await new Promise((r) => setTimeout(r, 250));
ok(!(await page.evaluate(() => document.getElementById('h-tut').classList.contains('tut'))), 'skip hides the panel');
ok(await page.evaluate(() => window.__game.save.tutorialDone === true), 'skip marks the tutorial as done');
const errs = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
ok(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(fail ? 1 : 0);
