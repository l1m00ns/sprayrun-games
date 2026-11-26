// The spec <-> mode card mapping is what made every online search look like Neon Rush.
//   node tools/mode-map.mjs
import { modeFromSpec } from '../src/modes.js';
let pass = 0, fail = 0;
const ok = (name, got, want) => { const good = got === want; good ? pass++ : fail++; console.log(`${good ? 'PASS' : 'FAIL'}  ${name}  got=${got} want=${want}`); };

ok('Normal Solo stays Normal Solo', modeFromSpec({ kind: 'normal', size: 1, mode: 'classic' }).id, 'normal-1');
ok('Neon keeps its own event card', modeFromSpec({ kind: 'normal', size: 1, mode: 'classic', event: 'neon' }).id, 'neonrush');
ok('Normal Duos stays Normal Duos', modeFromSpec({ kind: 'normal', size: 2, mode: 'classic' }).id, 'normal-2');
ok('Normal Trios stays Normal Trios', modeFromSpec({ kind: 'normal', size: 3, mode: 'classic' }).id, 'normal-3');
ok('Ranked Solo stays Ranked Solo', modeFromSpec({ kind: 'ranked', size: 1, mode: 'classic' }).id, 'ranked-1');
ok('Ranked Duos stays Ranked Duos', modeFromSpec({ kind: 'ranked', size: 2, mode: 'classic' }).id, 'ranked-2');
ok('Ranked Trios stays Ranked Trios', modeFromSpec({ kind: 'ranked', size: 3, mode: 'classic' }).id, 'ranked-3');
ok('missing fields fall back to Normal Solo', modeFromSpec({}).id, 'normal-1');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
