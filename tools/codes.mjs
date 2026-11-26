// Premium codes: validity, one code per account, one account per code, every cosmetic granted, premium profile.
//   node tools/codes.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-codes-'));
process.env.AI_DISABLED = '1';
const { q } = await import('../server/db.mjs');
const { redeem, codeList, normalizeCode } = await import('../server/codes.mjs');
const { COSMETICS } = await import('../server/catalog.mjs');
const { profile } = await import('../server/players.mjs');

let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };
const codes = codeList();
ok(codes.length === 100, '100 codes are loaded', String(codes.length));
ok(new Set(codes.map(normalizeCode)).size === 100, 'all codes are unique');
const now = Date.now();
const mk = (id, username) => { q.addPlayer.run(id, username, now); q.setCredentials.run(username, 'hash', 'salt', username, id); return q.getPlayer.get(id); };
mk('p1', 'premium_one'); mk('p2', 'premium_two'); mk('p3', 'premium_three');

const bad = redeem('p1', 'NOPE-0000-0000');
ok(!bad.ok && bad.error === 'bad_code', 'an invalid code is refused');

const r1 = redeem('p1', codes[0].toLowerCase().replace(/-/g, ' '));
ok(r1.ok && r1.premium && r1.granted === Object.keys(COSMETICS).length, 'first code grants every cosmetic and premium', `granted=${r1.granted}`);
const p1 = q.getPlayer.get('p1');
ok(!!p1.premium && p1.premium_since > 0, 'premium flag is stored');
ok(profile(p1).premium === true, 'profile exposes the premium badge');
const inv = JSON.parse(p1.inv);
ok(Object.keys(COSMETICS).every((id) => inv.cos.includes(id)), 'all cosmetics are in the inventory');

const again = redeem('p1', codes[1]);
ok(!again.ok && again.error === 'already_redeemed', 'an account can only redeem one code');

const used = redeem('p2', codes[0]);
ok(!used.ok && used.error === 'used_code', 'a code cannot be used twice globally');

const r2 = redeem('p2', codes[1]);
ok(r2.ok, 'a different account can redeem a different code');

const guestId = 'p4';
q.addPlayer.run(guestId, 'Guest', now);
const guest = redeem(guestId, codes[2]);
ok(!guest.ok && guest.error === 'account_required', 'guests must create an account first');

const bad3 = redeem('p3', codes[3]);
ok(bad3.ok, 'a third account redeems a third code');

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { /* SQLite still holds the file on Windows; the temp folder is harmless */ }
process.exit(fail ? 1 : 0);
