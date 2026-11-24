// Smoke test of the Next.js production server: UI renders, engine boots, API + realtime answer on the same port.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const out = process.argv[2];
const root = path.resolve(import.meta.dirname, '..');
const PORT = 3011;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-next-'));
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
for (let i = 0; i < 40 && !/localhost/.test(log); i++) await new Promise((r) => setTimeout(r, 250));
ok('server started', /Reverse Surfers \(production\)/.test(log), log.trim().split('\n').pop());

const health = await fetch(`http://localhost:${PORT}/api/health`).then((r) => r.json()).catch(() => null);
ok('REST API on the same port', health && health.ok === true);
const html = await fetch(`http://localhost:${PORT}/`).then((r) => r.text());
ok('server-rendered React markup (ids + Tailwind CSS link)', html.includes('id="playBtn"') && html.includes('.css'));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1100,640'], defaultViewport: { width: 1100, height: 640 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 120000 }).then(() => ok('engine boots inside the Next page', true)).catch(() => ok('engine boots inside the Next page', false));
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: path.join(out, 'next_menu.png') });
const fonts = await page.evaluate(() => document.fonts.check('20px "Lilita One"'));
ok('Lilita One font loaded from /fonts', fonts);
const wsOk = await page.evaluate(() => new Promise((res) => { const ws = new WebSocket(`ws://${location.host}/ws`); ws.onmessage = (e) => { res(JSON.parse(e.data).t === 'hello'); ws.close(); }; ws.onerror = () => res(false); setTimeout(() => res(false), 5000); }));
ok('WebSocket on the same port', wsOk);
const r = await page.evaluate(() => { const g = window.__game; g.start(); g.setBot(true); return g.sim(25); });
ok('bot plays 25 s inside the Next build', r.state === 'playing' && r.dist > 300, JSON.stringify({ dist: r.dist, coins: r.coins, speed: r.speed }));
await new Promise((res) => setTimeout(res, 1500));
await page.screenshot({ path: path.join(out, 'next_run.png') });
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close(); server.kill();
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* locked */ }
