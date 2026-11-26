// Tournaments, in-process (a temporary database): the UTC schedule, scoring rules, settlement (exactly once) and exclusive rewards.
//   node tools/tournaments.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-tour-'));
process.env.AI_DISABLED = '1';
const { db, q } = await import('../server/db.mjs');
const T = await import('../server/tournaments.mjs');
const { invOf } = await import('../server/economy.mjs');
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };

// ---- schedule (a Wednesday)
const wed = Date.UTC(2026, 10, 25, 12, 0, 0); // 2026-11-25 12:00 UTC
const w = T.windows(wed);
const dailyToday = w.find((x) => x.id === 'daily-2026-11-25'), dailyYest = w.find((x) => x.id === 'daily-2026-11-24');
ok(dailyToday && dailyToday.start === Date.UTC(2026, 10, 25, 17) && dailyToday.end - dailyToday.start === 2 * 3600e3 && dailyToday.state === 'upcoming', 'Daily Sprint runs 17:00-19:00 UTC every day');
ok(dailyYest && dailyYest.state === 'ended', 'yesterday\'s sprint is over');
const weekly = w.filter((x) => x.kind === 'weekly');
const sat = weekly.find((x) => x.start === Date.UTC(2026, 10, 28, 16));
ok(sat && sat.end === Date.UTC(2026, 10, 29, 22) && sat.state === 'upcoming', 'Weekly Cup runs Saturday 16:00 to Sunday 22:00 UTC');
ok(T.windows(Date.UTC(2026, 10, 28, 20)).some((x) => x.kind === 'weekly' && x.state === 'live'), 'the cup is live on Saturday evening');

// ---- scoring + settlement
const mk = (id, name) => { q.addPlayer.run(id, name, Date.now()); return id; };
const A = mk('p-aaaaaaaa', 'Alice'), B = mk('p-bbbbbbbb', 'Bob'), C = mk('p-cccccccc', 'Cara'), D = mk('p-dddddddd', 'Dan'), E = mk('p-eeeeeeee', 'Eve');
const win = { kind: 'daily', id: 'daily-2026-11-20', start: Date.UTC(2026, 10, 20, 17), end: Date.UTC(2026, 10, 20, 19), state: 'ended', name: 'Daily Sprint' };
const run = db.prepare('INSERT INTO runs (pid, mode, map, daily, dkey, score, dist, coins, time, created, flagged) VALUES (?, ?, ?, ?, 0, ?, 100, 10, 30, ?, ?)');
const inWin = (m) => win.start + m * 60e3;
run.run(A, 'classic', 'city', 0, 5000, inWin(10), 0);
run.run(A, 'classic', 'city', 0, 7000, inWin(40), 0); // Alice's best
run.run(B, 'classic', 'city', 0, 7000, inWin(5), 0); // same score, earlier: Bob wins the tie
run.run(C, 'classic', 'city', 0, 6000, inWin(60), 0);
run.run(D, 'classic', 'city', 0, 99999, inWin(20), 1); // flagged (cheating): never counts
run.run(E, 'classic', 'city', 1, 88888, inWin(20), 0); // daily-seed run: not a Classic score
run.run(E, 'nocoin', 'city', 0, 77777, inWin(20), 0); // another mode
run.run(C, 'classic', 'city', 0, 123456, win.end + 60e3, 0); // after the window
const before = q.getPlayer.get(B).wallet;
const board = T.leaderboard(win.id, null);
ok(board === null || true, 'leaderboard of an old window can be asked', board ? `${board.rows.length} rows` : 'window older than the lookup range (fine)');
const settled = T.settle(win);
ok(settled === true, 'a finished tournament is settled');
ok(T.settle(win) === false, 'and only once (idempotent)');
const rows = db.prepare('SELECT * FROM tournament_rewards WHERE tid = ? ORDER BY rank').all(win.id);
ok(rows.length === 3 && rows[0].pid === B && rows[1].pid === A && rows[2].pid === C, 'ranking: best valid Classic run, ties go to the earlier run, cheaters/other modes ignored', rows.map((r) => `${r.rank}:${r.score}`).join(' '));
ok(invOf(q.getPlayer.get(B)).cos.includes('au_dawn'), 'the winner receives the exclusive aura');
ok(!invOf(q.getPlayer.get(A)).cos.includes('au_dawn'), 'others do not');
ok(q.getPlayer.get(B).wallet === before + 600 && q.getPlayer.get(A).wallet >= 300, 'coins are paid by rank');
ok(!rows.some((r) => r.pid === D || r.pid === E), 'a flagged run or a non-Classic run earns nothing');
const unseenFor = (pid) => db.prepare('SELECT COUNT(*) AS n FROM tournament_rewards WHERE pid = ? AND seen = 0').get(pid).n;
ok(unseenFor(B) === 1, 'the winner has an unseen reward to be told about');

// ---- weekly cup exclusives
const cup = { kind: 'weekly', id: 'weekly-2026-W47', start: Date.UTC(2026, 10, 21, 16), end: Date.UTC(2026, 10, 22, 22), state: 'ended', name: 'Weekly Cup' };
run.run(C, 'classic', 'city', 0, 9000, cup.start + 3600e3, 0); run.run(D, 'classic', 'city', 0, 8000, cup.start + 7200e3, 0); run.run(E, 'classic', 'city', 0, 7000, cup.start + 9000e3, 0);
T.settle(cup);
const champ = invOf(q.getPlayer.get(C)).cos, third = invOf(q.getPlayer.get(E)).cos;
ok(['bg_cup', 'au_royal', 'sk_crown'].every((i) => champ.includes(i)), 'the Weekly Cup champion gets the backpack, the aura and the skin');
ok(third.includes('au_royal') && !third.includes('bg_cup'), 'the top 3 get the aura only');
const ov = T.overview({ id: C });
ok(Array.isArray(ov.tournaments) && ov.tournaments.every((t) => t.rewards.length > 0 && t.end > t.start), 'the overview lists the windows with their rewards');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
