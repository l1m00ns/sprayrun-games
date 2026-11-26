// The play flow in two real browsers: mode card + picker, friends panel, party invite, matchmaking from PLAY (no Online button), team HUD.
//   node tools/modes.mjs <screenshot-dir>
import { startServer, launch } from './lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4600 + Math.floor(Math.random() * 40), { AI_DISABLED: '1', RANKED_MIN_MINUTES: '0', RANKED_MIN_WAIT_MS: '500' });
const browser = await launch(1280, 720);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const logsA = [], logsB = [];
async function open(logs, name) {
  const ctx = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext()); // separate storage: two different players
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error'].includes(m.type())) logs.push(m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
  await page.evaluateOnNewDocument((n) => { try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'low', weather: false, music: 0, sfx: 0, lang: 'en', autoRes: false }, onboarded: true, tutorialDone: true, mpName: n })); } catch (e) { /* noop */ } }, name);
  await page.goto(srv.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
  return page;
}
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
const text = (p, sel) => p.evaluate((s) => (document.querySelector(s) || {}).textContent || '', sel);
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.classList.contains('hidden'); }, sel);

const A = await open(logsA, 'Ana'), B = await open(logsB, 'Ben');
const pickMode = async (p, id) => {
  await click(p, '#modeCard'); await sleep(220);
  const cat = id.startsWith('normal') ? 'normal' : id.startsWith('ranked') ? 'ranked' : 'other';
  await p.evaluate((c) => { const b = document.querySelector(`.mp-cat[data-cat="${c}"]`); if (b) b.click(); }, cat);
  await sleep(120);
  await p.evaluate((i) => document.querySelector(`.mp-card[data-id="${i}"]`).click(), id);
  await sleep(250);
};
// ---- mode card + picker
ok(/Classic Run/.test(await text(A, '#modeCard')), 'the mode card above PLAY shows the default mode', (await text(A, '#modeCard')).replace(/\s+/g, ' ').slice(0, 60));
await click(A, '#modeCard'); await sleep(400);
const cats = await A.evaluate(() => [...document.querySelectorAll('.mp-cat')].map((b) => b.dataset.cat));
ok(['ltm', 'ranked', 'normal', 'other'].every((c) => cats.includes(c)), 'the picker is grouped by category', cats.join(','));
const cards = [];
for (const c of ['ltm', 'ranked', 'normal', 'other']) {
  await A.evaluate((cat) => document.querySelector(`.mp-cat[data-cat="${cat}"]`).click(), c);
  await sleep(120);
  cards.push(...await A.evaluate(() => [...document.querySelectorAll('.mp-card')].map((x) => x.dataset.id)));
}
ok(['ranked-1', 'ranked-2', 'ranked-3', 'normal-1', 'normal-2', 'normal-3', 'neonrush', 'solo-classic', 'solo-nocoin', 'daily', 'room'].every((id) => cards.includes(id)), 'picker lists LTM, Ranked, Normal (Solo/Duos/Trios) and the other modes', cards.join(','));
await A.screenshot({ path: `${OUT}/picker.png` });
await A.evaluate(() => document.querySelector('.mp-cat[data-cat="normal"]').click()); await sleep(120);
await A.evaluate(() => document.querySelector('.mp-card[data-id="normal-2"]').click()); await sleep(300);
ok(/Normal Duos/.test(await text(A, '#modeCard')) && !(await visible(A, '#modePick')), 'picking a mode updates the card and closes the picker');
await pickMode(A, 'normal-1');
await pickMode(B, 'normal-1');
await A.screenshot({ path: `${OUT}/menu-modes.png` });

// ---- friends: B adds A by friend code (no Online button anywhere)
await click(A, '#tbFriends'); await sleep(1500);
const code = await text(A, '#frCode');
ok(/^[A-Z2-9]{6}$/.test(code), 'the friends panel shows my friend code (a guest account is created on the fly)', code);
await click(B, '#tbFriends'); await sleep(1500);
await B.evaluate((c) => { document.getElementById('frAdd').value = c; document.getElementById('frForm').requestSubmit(); }, code);
await sleep(1200);
ok(/Request sent/.test(await text(B, '#frMsg')), 'sending a request by code works');
await A.evaluate(() => document.getElementById('frClose').click()); await sleep(200);
await click(A, '#tbFriends'); await sleep(1500);
ok((await A.evaluate(() => document.querySelectorAll('[data-acc]').length)) === 1, 'the request appears as incoming on the other side');
await A.screenshot({ path: `${OUT}/friends.png` });
await A.evaluate(() => document.querySelector('[data-acc]').click()); await sleep(1500);
const dbgN = async (p) => p.evaluate(() => ({ c: window.__game.net.connected, id: window.__game.net.id, n: window.__game.api.online.player && window.__game.api.online.player.name })); console.log('DBG', JSON.stringify(await dbgN(A)), JSON.stringify(await dbgN(B)), JSON.stringify(await (await fetch(srv.url + '/api/health')).json()));
ok((await A.evaluate(() => document.querySelectorAll('.fr-row.lobby').length)) >= 1, 'accepted: the friend is listed as online', (await text(A, '#frBody')).replace(/\s+/g, ' ').slice(0, 160));
// invite -> the other player gets a native dialog -> party strip shows 2
await A.evaluate(() => document.querySelector('[data-inv]').click()); await sleep(1500);
ok(await visible(B, '#dlg'), 'the invited friend gets an invite dialog', (await text(B, '#dlg')).replace(/\s+/g, ' ').slice(0, 60));
await B.evaluate(() => document.getElementById('dlgYes').click()); await sleep(1500);
await A.evaluate(() => document.getElementById('frClose').click());
await B.evaluate(() => document.getElementById('frClose').click());
await sleep(300);
const slotsA = await A.evaluate(() => document.querySelectorAll('#partyStrip .pslot:not(.add)').length);
const slotsB = await B.evaluate(() => document.querySelectorAll('#partyStrip .pslot:not(.add)').length);
ok(slotsA === 2 && slotsB === 2, 'both players see a party of 2', `${slotsA}/${slotsB}`);
await A.screenshot({ path: `${OUT}/party.png` });
ok(/WAITING FOR LEADER/.test(await text(B, '#playBtn')), 'the non-leader cannot start the search', (await text(B, '#playBtn')));
ok(/Normal Solo/.test(await text(B, '#modeCard')) || /Normal/.test(await text(B, '#modeCard')), 'the member sees the leader\'s mode');
// leader picks Duos while in a 2-party: Solo is refused, Duos is fine
await click(A, '#modeCard'); await sleep(200);
ok(await A.evaluate(() => document.querySelector('.mp-card[data-id="normal-1"]').classList.contains('off')), 'Solo is unavailable for a party of 2');
await A.evaluate(() => document.querySelector('.mp-card[data-id="normal-2"]').click()); await sleep(600);
ok(/Normal Duos/.test(await text(B, '#modeCard')), 'the party mode follows the leader on the other screen');
// leave the party and race solo (free for all) from PLAY alone
await click(B, '#pLeave'); await sleep(600);
await click(A, '#pLeave'); await sleep(600);
await click(A, '#modeCard'); await sleep(200); await A.evaluate(() => document.querySelector('.mp-card[data-id="normal-1"]').click());
await click(B, '#modeCard'); await sleep(200); await B.evaluate(() => document.querySelector('.mp-card[data-id="normal-1"]').click()); await sleep(300);
await click(A, '#playBtn'); await click(B, '#playBtn');
await A.waitForFunction(() => !document.getElementById('searchOv').classList.contains('hidden'), { timeout: 15000 }).catch(() => {});
ok(await visible(A, '#searchOv'), 'PLAY alone starts matchmaking straight away (no Online button)');
await sleep(1000); await A.screenshot({ path: `${OUT}/searching.png` });
const matched = await A.waitForFunction(() => /MATCH FOUND/.test(document.getElementById('soNote').textContent) || (window.__game.mp && window.__game.mp.active), { timeout: 30000 }).then(() => true).catch(() => false);
ok(matched, 'two searching players are matched');
const racing = await A.waitForFunction(() => window.__game.mp && window.__game.mp.active && window.__game.state === 'playing', { timeout: 40000 }).then(() => true).catch(() => false);
ok(racing, 'the race starts and the search overlay closes', `overlayHidden=${!(await visible(A, '#searchOv'))}`);
const errs = [...logsA, ...logsB].filter((l) => !/favicon|Failed to load resource/.test(l));
ok(errs.length === 0, 'no console errors in either browser', errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(fail ? 1 : 0);
