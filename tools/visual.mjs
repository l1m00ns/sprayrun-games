// Visual snapshots for review: loading screen, menu (hero close-up), tropic gameplay, HUD, secret menu opened with the key left of 1.
import { startServer, launch } from './lib.mjs';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer(4400 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(1280, 720);
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'high', music: 0, sfx: 0, lang: 'en', autoRes: false, weather: true }, onboarded: true })); localStorage.setItem('rs.secret.unlocked', '1'); } catch (e) { /* noop */ } });
await page.goto(srv.url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the loading screen, shown again over the finished menu at 55 % so it can be inspected
await page.evaluate(() => { const l = document.getElementById('loading'); l.classList.remove('hidden'); document.getElementById('loadBar').style.clipPath = 'inset(0 45% 0 0)'; document.getElementById('loadPct').textContent = '55%'; document.getElementById('loadTxt').textContent = 'Laying the tracks…'; document.getElementById('loadTip').textContent = 'Trains are solid walls: change lanes, or fly over them with the Jetpack.'; });
await sleep(700); await page.screenshot({ path: `${OUT}/loading.png` });
await page.evaluate(() => document.getElementById('loading').classList.add('hidden'));
await sleep(1500); await page.screenshot({ path: `${OUT}/menu.png` });
await page.evaluate(() => { const g = window.__game; g.save.tutorialDone = true; g.setMap('tropic'); g.start(); });
await sleep(7000); await page.screenshot({ path: `${OUT}/tropic.png` });
await page.keyboard.press('Backquote'); await sleep(800); await page.screenshot({ path: `${OUT}/secret.png` });
await page.keyboard.press('Backquote'); await sleep(400);
await page.evaluate(() => { const g = window.__game; g.P.inv = 0; const w = g.world, seg = w.segs[0]; w.placeTrain(seg, g.P.target, -9 - seg.z, 2, false, 'tropic', 0); });
await sleep(1200); await page.screenshot({ path: `${OUT}/crash.png` });
console.log('done');
await browser.close(); srv.stop(); process.exit(0);
