// End-to-end multiplayer test: starts the server, opens two browsers, creates/joins a room,
// races, and checks that both players share the same seeded track and see each other.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';

const out = process.argv[2];
const PORT = 8791;
const root = path.resolve(import.meta.dirname, '..');
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let srvLog = '';
server.stdout.on('data', (d) => { srvLog += d; });
server.stderr.on('data', (d) => { srvLog += d; });
await new Promise((r) => setTimeout(r, 5000));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=520,300'],
  defaultViewport: { width: 520, height: 300 },
});
const logs = [];
const open = async (tag) => {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${tag} ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${tag} pageerror] ${e.message}`));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 90000 });
  await page.evaluate(() => { const q = document.getElementById('setQuality'); q.value = 'low'; q.dispatchEvent(new Event('change')); });
  return page;
};
const A = await open('A');
const B = await open('B');
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

// A creates a room
await A.evaluate(() => { document.getElementById('btnOnline').click(); document.getElementById('lobName').value = 'Alice'; document.getElementById('btnCreate').click(); });
await A.waitForFunction(() => document.getElementById('lobRoom').style.display !== 'none' && document.getElementById('lobRoomCode').textContent.length === 4, { timeout: 45000 });
const code = await A.evaluate(() => document.getElementById('lobRoomCode').textContent);
ok('room created', /^[A-Z]{4}$/.test(code), code);

// B joins by code
await B.evaluate((c) => { document.getElementById('btnOnline').click(); document.getElementById('lobName').value = 'Bob'; document.getElementById('lobCode').value = c; document.getElementById('btnJoin').click(); }, code);
try { await B.waitForFunction(() => document.getElementById('lobRoom').style.display !== 'none', { timeout: 45000 }); } catch (e) { console.log('B diag:', JSON.stringify(await B.evaluate(() => ({ err: document.getElementById('lobErr').textContent, conn: window.__game.net.connected, code: document.getElementById('lobCode').value, room: !!window.__game.mp.room })))); console.log(logs.join(String.fromCharCode(10))); console.log('server:', srvLog); process.exit(1); }
await A.waitForFunction(() => window.__game.mp.players.size === 2, { timeout: 10000 });
ok('both players in lobby', true);
await A.screenshot({ path: path.join(out, 'mp_lobby.png') });

// B readies, A (host) starts and picks a map first
await A.evaluate(() => { const s = document.getElementById('lobMap'); s.value = 'snow'; s.dispatchEvent(new Event('change')); });
await new Promise((r) => setTimeout(r, 300));
await B.evaluate(() => document.getElementById('btnReady').click());
await new Promise((r) => setTimeout(r, 300));
await A.evaluate(() => document.getElementById('btnStartRace').click());

await Promise.all([A, B].map((p) => p.waitForFunction(() => window.__game.state === 'playing' && window.__game.mp.running, { timeout: 30000 })));
ok('race started on both clients', true);
const maps = await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.world.mode.id + '/' + window.__game.world.seed)));
ok('same map and seed', maps[0] === maps[1] && maps[0].startsWith('snow/'), maps.join(' | '));
const sig = (p) => p.evaluate(() => JSON.stringify(window.__game.world.segs.slice(1, 4).map((s) => s.solids.map((o) => `${o.kind}:${Math.round(o.x)}:${Math.round(o.lz0)}`))));
const sigs = await Promise.all([A, B].map(sig));
ok('identical obstacle layout (seeded world)', sigs[0] === sigs[1] && sigs[0].length > 20);

// let both run (bots) and look for ghosts
await Promise.all([A, B].map((p) => p.evaluate(() => window.__game.setBot(true))));
await new Promise((r) => setTimeout(r, 9000));
const seen = await A.evaluate(() => { const g = window.__game, others = [...g.mp.players.values()].filter((p) => p.id !== g.net.id); return { others: others.length, seen: others.every((o) => o.seen), d: others.map((o) => Math.round(o.d)), ghosts: g.mp.ghosts.size, myDist: Math.round(g.run.dist) }; });
ok('A receives live state from B', seen.others === 1 && seen.seen && seen.d[0] > 0, JSON.stringify(seen));
ok('ghost spawned for B', seen.ghosts === 1);
await A.screenshot({ path: path.join(out, 'mp_race_A.png') });

// B dies deliberately -> A should see it, then A dies -> results
await B.evaluate(() => { const g = window.__game; g.setBot(false); g.P.inv = 0; g.run.speed = 40; });
await B.waitForFunction(() => window.__game.state === 'over' || window.__game.state === 'dying', { timeout: 60000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 2500));
const bOut = await A.evaluate(() => [...window.__game.mp.players.values()].filter((p) => p.id !== window.__game.net.id).map((p) => p.alive));
console.log('B alive flag seen by A:', JSON.stringify(bOut));
await A.evaluate(() => { const g = window.__game; g.setBot(false); g.run.speed = 40; });
await Promise.all([A, B].map((p) => p.waitForFunction(() => document.getElementById('mpTitle').textContent !== 'RACE OVER' && !document.getElementById('mpres').classList.contains('hidden') && window.__game.mp.results, { timeout: 90000 }).catch(() => null)));
const res = await A.evaluate(() => ({ title: document.getElementById('mpTitle').textContent, rows: document.getElementById('mpRank').children.length, results: !!window.__game.mp.results }));
ok('results screen after everyone is out', res.results && res.rows === 2, JSON.stringify(res));
await A.screenshot({ path: path.join(out, 'mp_results.png') });

console.log(logs.length ? logs.join('\n') : 'no console errors');
console.log('server:', srvLog.trim().split('\n').pop());
await browser.close();
server.kill();
