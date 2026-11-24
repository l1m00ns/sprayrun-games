// Screenshot helper: node tools/debug.mjs <outDir> "<js snippet run in the page>" <name> [waitMs] [quality]
import path from 'node:path';
import { startServer, launch, openGame } from './lib.mjs';

const [out, snippet = '', name = 'dbg', wait = '1500', quality = 'high'] = process.argv.slice(2);
const srv = await startServer(3020 + Math.floor(Math.random() * 60));
const browser = await launch();
const logs = [];
const page = await openGame(browser, srv.url, { quality, logs });
await new Promise((r) => setTimeout(r, 800));
if (snippet) {
  const res = await page.evaluate(snippet);
  if (res !== undefined) logs.push('[result] ' + JSON.stringify(res));
}
await new Promise((r) => setTimeout(r, Number(wait)));
await page.screenshot({ path: path.join(out, `${name}.png`) });
console.log(logs.join('\n') || 'ok');
await browser.close();
srv.stop();
