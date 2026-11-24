// Headless gameplay simulation: node tools/sim.mjs <runs> <seconds> [map] [mode]
import { startServer, launch, openGame } from './lib.mjs';

const [runs = '3', seconds = '120', map = 'city', mode = 'classic'] = process.argv.slice(2);
const srv = await startServer(3100 + Math.floor(Math.random() * 60));
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url + '?bot=1', { quality: 'low', logs });
for (let i = 0; i < Number(runs); i++) {
  const res = await page.evaluate((secs, first, mp, md) => {
    const g = window.__game;
    g.save.settings.mode = md;
    if (first) { g.setMap(mp); g.start(); } else g.restart();
    return g.sim(secs);
  }, Number(seconds), i === 0, map, mode);
  console.log(`run ${i}:`, JSON.stringify(res));
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
srv.stop();
