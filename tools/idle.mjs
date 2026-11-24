// Does an unattended runner crash into the first obstacles? (sanity check for collisions)
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(3900 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(640, 360);
const page = await openGame(browser, srv.url, { quality: 'low' });
for (const map of ['city', 'snow']) {
  const r = await page.evaluate((m) => { const g = window.__game; g.save.tutorialDone = true; g.setMap(m); g.setBot(false); g.start(); return g.sim(40); }, map);
  console.log(map, JSON.stringify({ state: r.state, t: r.t, dist: r.dist, reason: r.reason }));
  await page.evaluate(() => { try { window.__game.die('manual'); } catch (e) { /* already over */ } });
  await new Promise((r2) => setTimeout(r2, 500));
  await page.evaluate(() => { const b = document.getElementById('btnHome'); if (b) b.click(); });
  await new Promise((r2) => setTimeout(r2, 800));
}
await browser.close(); srv.stop(); process.exit(0);
