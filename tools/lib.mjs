// Shared helpers for the test tools: start the production server on a free port and drive Chrome against it.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export const root = path.resolve(import.meta.dirname, '..');
export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export async function startServer(port, env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-'));
  const proc = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 80 && !/localhost/.test(log); i++) await new Promise((r) => setTimeout(r, 250));
  if (!/localhost/.test(log)) throw new Error('server did not start (did you run `npm run build`?)\n' + log);
  return {
    url: `http://localhost:${port}`,
    log: () => log,
    stop() { proc.kill(); try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* sqlite file still locked on Windows */ } },
  };
}

export const launch = (w = 1100, h = 640) => puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${w},${h}`],
  defaultViewport: { width: w, height: h },
});

export async function openGame(browser, url, { quality = 'low', logs = [], settings = {} } = {}) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.evaluateOnNewDocument((s) => {
    try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: s })); } catch (e) { /* noop */ }
  }, { quality, weather: quality !== 'low', music: 0, sfx: 0, ...settings });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
  return page;
}
