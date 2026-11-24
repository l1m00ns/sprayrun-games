// Browser test of the solo online flow: auto account, ticketed run, score submission, leaderboard tab.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const out = process.argv[2];
const root = path.resolve(import.meta.dirname, '..');
const PORT = 8794;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-on-'));
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=480,270'], defaultViewport: { width: 480, height: 270 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const ok = (n, c, x = '') => console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`);
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'low', weather: false, music: 0, sfx: 0, lang: 'en' }, onboarded: true })); } catch (e) { /* noop */ } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 90000 });
await page.waitForFunction(() => !/Offline/.test(document.getElementById('mOnline').textContent), { timeout: 40000 }).catch(() => {});
const pill = await page.evaluate(() => document.getElementById('mOnline').textContent);
ok('account created automatically (menu shows the player)', /Runner/.test(pill), pill);

await page.evaluate(() => { const g = window.__game; g.start(); g.setBot(true); });
await page.waitForFunction(() => window.__game.run.t > 7, { timeout: 120000 });
const t = await page.evaluate(() => ({ dist: Math.floor(window.__game.run.dist), tm: window.__game.run.t.toFixed(1) }));
await page.evaluate(() => { const g = window.__game; g.setBot(false); g.die('crash'); });
await page.waitForFunction(() => !document.getElementById('over').classList.contains('hidden'), { timeout: 60000 });
await page.waitForFunction(() => !/Submitting/.test(document.getElementById('oOnline').textContent) && document.getElementById('oOnline').textContent.length > 0, { timeout: 30000 }).catch(() => {});
const sub = await page.evaluate(() => document.getElementById('oOnline').textContent);
ok('score submitted and accepted', /Leaderboard/.test(sub), `${sub}  (run ${t.dist} m / ${t.tm}s)`);
await page.screenshot({ path: path.join(out, 'online_over.png') });

await page.evaluate(() => { document.getElementById('btnHome').click(); });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { document.getElementById('btnOnline').click(); });
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: path.join(out, 'online_play.png') });
await page.evaluate(() => document.getElementById('tabBtnBoard').click());
await new Promise((r) => setTimeout(r, 1500));
const rows = await page.evaluate(() => document.getElementById('boardRows').innerText);
ok('leaderboard tab shows the run', /Runner/.test(rows), rows.replace(/\n/g, ' | ').slice(0, 90));
await page.screenshot({ path: path.join(out, 'online_board.png') });
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close(); server.kill();
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* locked */ }
