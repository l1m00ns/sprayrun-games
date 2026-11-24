// Visual check of the Blender-authored props inside the Next build (served over http so the GLB loads).
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const out = process.argv[2];
const root = path.resolve(import.meta.dirname, '..');
const PORT = 3012;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-mdl-'));
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 4000));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=900,520'], defaultViewport: { width: 900, height: 520 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const reqs = [];
page.on('response', (r) => { if (r.url().includes('props.glb')) reqs.push(r.status()); });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 120000 });
console.log(`${reqs[0] === 200 ? 'PASS' : 'FAIL'}  props.glb served (status ${reqs[0]})`);
await page.evaluate(() => { const g = window.__game; g.start(); g.setBot(false); g.P.inv = 9999; g.board(); g.world.items.add('box', 0, 1.4, -7); g.world.items.add('box', 2.2, 1.4, -13); g.sim(0.3); });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: path.join(out, 'models_board_chest.png') });
console.log(logs.length ? logs.join('\n') : 'no console errors');
await browser.close(); server.kill();
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* locked */ }
