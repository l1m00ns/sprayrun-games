// Diagnostic: which request returns 401 on a cold start, and with which headers?
import { startServer, launch } from './lib.mjs';
const srv = await startServer(3700 + Math.floor(Math.random() * 50), { AI_DISABLED: '1' });
const browser = await launch(900, 560);
const page = await browser.newPage();
const seen = [];
page.on('request', (r) => { if (r.url().includes('/api/')) seen.push({ t: Date.now(), m: r.method(), u: r.url().replace(/^http:\/\/localhost:\d+/, ''), auth: !!r.headers()['authorization'] }); });
page.on('response', (r) => { if (r.url().includes('/api/')) { const e = seen.find((x) => r.url().endsWith(x.u) && x.s === undefined); if (e) e.s = r.status(); } });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('sprayrun.save.v1', JSON.stringify({ settings: { quality: 'low', weather: false, music: 0, sfx: 0 } })); } catch (e) { /* noop */ } });
await page.goto(srv.url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game && window.__game.state === 'menu', { timeout: 180000 });
await new Promise((r) => setTimeout(r, 6000));
const t0 = seen[0] ? seen[0].t : 0;
for (const e of seen) console.log(String(e.t - t0).padStart(6), e.m.padEnd(5), String(e.s).padEnd(4), e.auth ? 'AUTH' : 'noauth', e.u);
await browser.close(); srv.stop(); process.exit(0);
