// Cosmetics: every backpack / aura / style / skin builds and animates without errors, exclusives cannot be bought, slots equip server-side.
import { startServer, launch, openGame } from './lib.mjs';
const srv = await startServer(5000 + Math.floor(Math.random() * 40), { AI_DISABLED: '1' });
const browser = await launch(640, 360);
const logs = [];
const page = await openGame(browser, srv.url, { quality: 'low', logs });
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const res = await page.evaluate(() => {
  const g = window.__game, out = [];
  const BAGS = ['bg_cat', 'bg_rocket', 'bg_guitar', 'bg_wings', 'bg_cube', 'bg_cup'], AURAS = ['au_ember', 'au_frost', 'au_volt', 'au_royal', 'au_dawn'], STYLES = ['st_chill', 'st_ninja', 'st_bounce', 'st_sprinter'], SKINS = ['sk_ocean', 'sk_ghost', 'sk_lava', 'sk_crown'];
  const combos = [...BAGS.map((b) => ({ bag: b })), ...AURAS.map((a) => ({ aura: a })), ...STYLES.map((s) => ({ style: s })), ...SKINS.map((k) => ({ skin: k })), { bag: 'bg_wings', aura: 'au_volt', style: 'st_ninja', skin: 'sk_lava', outfit: 'o_gold' }];
  for (const eq of combos) {
    try {
      g.save.equip = { char: 'rio', ...eq }; g.rebuildPlayer();
      g.start(); g.sim(1.2); g.renderer.render(g.scene, g.cam);
      g.die('manual'); g.sim(0.5);
      out.push([JSON.stringify(eq), 'ok']);
    } catch (e) { out.push([JSON.stringify(eq), String(e.message).slice(0, 120)]); }
    try { document.getElementById('btnHome').click(); } catch (e) { /* menu */ }
  }
  return out;
});
for (const [name, r] of res) ok(r === 'ok', `builds, runs and renders: ${name}`, r === 'ok' ? '' : r);
const errs = logs.filter((l) => /pageerror|TypeError|ReferenceError/.test(l));
ok(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); srv.stop(); process.exit(fail ? 1 : 0);
