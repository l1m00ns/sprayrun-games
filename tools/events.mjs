// Seasonal events: Easter window, free gift once per account/occurrence, other events closed, cosmetic in inventory.
//   node tools/events.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-events-'));
process.env.AI_DISABLED = '1';
process.env.TEST_NOW = '2026-04-05T12:00:00Z'; // inside Egg Hunt, outside Halloween and Winter Fest
const { allEvents } = await import('../server/catalog.mjs');
const { claimEventGift } = await import('../server/economy.mjs');
const { q } = await import('../server/db.mjs');
const { profile } = await import('../server/players.mjs');

let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const ev = allEvents();
ok(ev.easter && ev.easter.active, 'Egg Hunt is live in April');
ok(ev.halloween && !ev.halloween.active, 'Haunted Rails is closed in April');
ok(ev.winterfest && !ev.winterfest.active, 'Winter Fest is closed in April');
ok(ev.easter.gift && ev.easter.gift.cos === 'o_bunny', 'the Easter gift is the Bunny Hop outfit');

const now = Date.now();
q.addPlayer.run('e1', 'EggHunter', now);
q.setCredentials.run('egghunter', 'hash', 'salt', 'EggHunter', 'e1');
const r1 = claimEventGift('e1', 'easter');
ok(r1.ok && r1.reward.cos === 'o_bunny', 'a live event gift is granted once');
const inv = JSON.parse(q.getPlayer.get('e1').inv);
ok(inv.cos.includes('o_bunny'), 'the gift cosmetic is in the inventory');
const r2 = claimEventGift('e1', 'easter');
ok(!r2.ok && r2.error === 'already_claimed', 'the same gift cannot be claimed twice');
const r3 = claimEventGift('e1', 'halloween');
ok(!r3.ok && r3.error === 'event_not_active', 'a closed event cannot be claimed');
ok(profile(q.getPlayer.get('e1')).premium === false, 'an event gift does not grant premium');

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* SQLite file still open on Windows */ }
process.exit(fail ? 1 : 0);
