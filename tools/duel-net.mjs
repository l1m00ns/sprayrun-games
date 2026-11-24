// Gold Rush duel, server side, with fake WebSocket clients: matchmaking -> race -> random warp -> arena -> validated shots,
// wall-walking / rate-hack detection (kick + forfeit), and the draw on timeout.
//   node tools/duel-net.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import WebSocket from 'ws';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 8794;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-duel-'));
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, AI_DISABLED: '1', DUEL_WARP_MS: '1200', DUEL_SECONDS: '7', DUEL_REWARP_MS: '1500' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
await new Promise((r) => setTimeout(r, 5000));

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const base = `http://localhost:${PORT}`;
const api = async (method, url, body, token) => { const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json() }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const guest = async (name) => (await api('POST', '/api/auth/guest', { name })).json;

function connect(tok, char) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const c = { ws, msgs: [], id: null, closed: false,
      wait(type, ms = 15000, pred = () => true) { return new Promise((res, rej) => { const find = () => c.msgs.find((m) => m.t === type && pred(m)); const f = find(); if (f) return res(f); const to = setTimeout(() => { clearInterval(iv); rej(new Error('timeout waiting ' + type)); }, ms); const iv = setInterval(() => { const g = find(); if (g) { clearTimeout(to); clearInterval(iv); res(g); } }, 15); }); },
      send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
    };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.msgs.push(m); if (m.t === 'hello') { c.id = m.id; ws.send(JSON.stringify({ t: 'auth', token: tok, char })); } });
    ws.on('close', () => { c.closed = true; });
    ws.on('open', () => resolve(c));
  });
}
// walk a body to (tx,tz) at a legal speed, sending 30 Hz claims
async function walkTo(c, from, tx, tz, yaw) {
  const dist = Math.hypot(tx - from.x, tz - from.z), n = Math.ceil(dist / 0.2);
  for (let i = 1; i <= n; i++) { c.send({ t: 'du', x: from.x + ((tx - from.x) * i) / n, y: 0, z: from.z + ((tz - from.z) * i) / n, yaw, pitch: 0 }); await sleep(38); }
}
async function match(a, b) { // both queue for the LTM, wait for the arena
  a.send({ t: 'dq', char: 'rio' }); b.send({ t: 'dq', char: 'nova' });
  const m = await a.wait('match', 15000);
  const dstart = await a.wait('duel', 25000, (x) => x.phase === 'start'); await b.wait('duel', 5000, (x) => x.phase === 'start');
  const live = await a.wait('duel', 8000, (x) => x.phase === 'live'); await b.wait('duel', 5000, (x) => x.phase === 'live');
  return { m, dstart, live };
}

try {
  const [A, B, C, D, E, F] = await Promise.all(['Ann', 'Ben', 'Cat', 'Dan', 'Eve', 'Fay'].map(guest));
  const [ca, cb] = await Promise.all([connect(A.token, 'rio'), connect(B.token, 'nova')]);
  await ca.wait('authed'); await cb.wait('authed');

  // ------------------------------------------------------------- match 1: honest duel, ends in a kill
  const t0 = Date.now();
  const m1 = await match(ca, cb);
  ok('duel queue pairs two players into an LTM match (unranked)', m1.m.ltm === 'goldrush' && m1.m.ranked === false && m1.m.players.length === 2);
  await ca.wait('warp', 1000).catch(() => null);
  ok('server warps the race into the arena at a random moment', ca.msgs.some((x) => x.t === 'warp') && cb.msgs.some((x) => x.t === 'warp'), `after ${(Date.now() - t0) / 1000}s`);
  ok('duel starts with spawns, a countdown and the duration', m1.dstart.players.length === 2 && m1.dstart.countdown === 3 && m1.dstart.duration === 7 && new Set(m1.dstart.players.map((p) => p.spawn)).size === 2);
  const sp = Object.fromEntries(m1.dstart.players.map((p) => [p.id, p.spawn]));
  const shooter = sp[ca.id] === 0 ? ca : cb, victim = shooter === ca ? cb : ca;
  const spawnOf = (c) => (sp[c.id] === 0 ? { x: 0, z: 13.8, yaw: 0 } : { x: 0, z: -13.8, yaw: Math.PI });
  await Promise.all([walkTo(shooter, spawnOf(shooter), 3.8, spawnOf(shooter).z, spawnOf(shooter).yaw), walkTo(victim, spawnOf(victim), 3.8, spawnOf(victim).z, spawnOf(victim).yaw)]);
  ok('legal movement is accepted (no corrections)', !ca.msgs.some((x) => x.t === 'dfix') && !cb.msgs.some((x) => x.t === 'dfix'));
  await sleep(300);
  const snap = ca.msgs.filter((x) => x.t === 'ds').pop();
  ok('server broadcasts authoritative snapshots (hp, ammo, positions)', snap && snap.ps.length === 2 && snap.ps.every((p) => p.hp === 100 && p.ammo === 7));
  // fire along the lane: shooter at z=+13.8 faces -Z (yaw 0) / the other faces +Z
  const dz = sp[shooter.id] === 0 ? -1 : 1, oz = spawnOf(shooter).z;
  shooter.send({ t: 'df', ox: 3.8, oy: 1.62, oz, dx: 0, dy: 0, dz });
  const h1 = await shooter.wait('dhit', 3000);
  ok('shot validated server-side: headshot = 72 damage', h1.part === 'head' && h1.dmg === 72 && h1.hp === 28 && h1.by === shooter.id, JSON.stringify(h1));
  shooter.send({ t: 'df', ox: 3.8, oy: 1.62, oz, dx: 0, dy: 0, dz }); // immediately again: faster than the weapon cadence
  await sleep(120);
  ok('firing faster than the weapon cadence is refused', shooter.msgs.filter((x) => x.t === 'dhit').length === 1);
  await sleep(350);
  shooter.send({ t: 'df', ox: 3.8, oy: 1.62, oz, dx: 0, dy: 0, dz });
  const h2 = await shooter.wait('dhit', 3000, (x) => x.kill);
  const end = await victim.wait('dend', 3000);
  ok('second hit kills; the duel ends with the shooter as winner', h2.kill && end.winner === shooter.id && end.reason === 'kill', JSON.stringify({ w: end.winner, r: end.reason }));
  const st = end.players.find((p) => p.id === shooter.id);
  ok('server counted shots, hits and headshots', st.shots === 2 && st.hits === 2 && st.head === 2, JSON.stringify(st));
  const winnerTok = shooter === ca ? A.token : B.token, loserTok = shooter === ca ? B.token : A.token;
  await sleep(200);
  ok('career updated: duel win, kills, xp', (await api('GET', '/api/career', null, winnerTok)).json.career.duelWins === 1 && (await api('GET', '/api/career', null, loserTok)).json.career.duelLosses === 1);
  // the race resumes: first win ever = profile badge (no boost)
  const rs1 = await shooter.wait('resume', 3000);
  ok('after the duel the race RESUMES; first win ever = badge, no boost', rs1.winner === shooter.id && rs1.first === true && rs1.boost === null, JSON.stringify(rs1));
  ok('winner profile now carries the Gold Eagle badge', (await api('GET', '/api/career', null, winnerTok)).json.badges.some((b) => b.id === 'gold_eagle'));
  // a second Gold Rush happens later in the same game (random moment); this time the win is a boost + second life
  const live2 = await shooter.wait('duel', 12000, (x) => x.phase === 'live' && x !== m1.live);
  await victim.wait('duel', 3000, (x) => x.phase === 'live' && x !== m1.live);
  ok('a second duel is triggered later in the same game', live2 && live2.endsAt > Date.now() - 1000);
  await Promise.all([walkTo(shooter, spawnOf(shooter), 3.8, spawnOf(shooter).z, spawnOf(shooter).yaw), walkTo(victim, spawnOf(victim), 3.8, spawnOf(victim).z, spawnOf(victim).yaw)]);
  await sleep(300); // let the opponent's last positions settle (the server rewinds targets by ~110 ms)
  for (let i = 0; i < 2; i++) { shooter.send({ t: 'df', ox: 3.8, oy: 1.62, oz, dx: 0, dy: 0, dz }); await sleep(420); }
  const rs2 = await shooter.wait('resume', 4000, (x) => x !== rs1);
  ok('later win = 8 s speed boost + second life + coins off 8 s', rs2.winner === shooter.id && rs2.first === false && rs2.boost && rs2.boost.sec === 8 && rs2.boost.secondLife === true && rs2.boost.noCoinsSec === 8, JSON.stringify(rs2.boost));
  ca.ws.close(); cb.ws.close();

  // ------------------------------------------------------------- match 2: wall hack is detected and kicked
  const [cc, cd] = await Promise.all([connect(C.token, 'rio'), connect(D.token, 'nova')]);
  await cc.wait('authed'); await cd.wait('authed');
  const m2 = await match(cc, cd);
  const sp2 = Object.fromEntries(m2.dstart.players.map((p) => [p.id, p.spawn]));
  const cheater = sp2[cc.id] === 0 ? cc : cd, honest = cheater === cc ? cd : cc;
  const cheaterTok = cheater === cc ? C.token : D.token;
  const cz = sp2[cheater.id] === 0 ? 13.8 : -13.8;
  for (let i = 0; i < 6 && !cheater.closed; i++) { cheater.send({ t: 'du', x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }); await sleep(45); } // standing inside the central wagon
  ok('walking through a wall is corrected (snap back)', cheater.msgs.some((x) => x.t === 'dfix'));
  const end2 = await honest.wait('dend', 4000);
  ok('wall-hacker forfeits: the honest player wins', end2.winner === honest.id && end2.reason === 'forfeit_cheat', JSON.stringify({ w: end2.winner, r: end2.reason }));
  await sleep(300);
  ok('wall-hacker is kicked off the server', cheater.msgs.some((x) => x.t === 'kick') && (await api('POST', '/api/run/start', { mode: 'classic' }, cheaterTok)).status === 403);
  ok('strike recorded with evidence', (await api('GET', '/api/me', null, cheaterTok)).json.player.kickedUntil > 0);
  ok('cheater earns no duel stats', (await api('GET', '/api/career', null, cheaterTok)).json.career.duelLosses === 0);
  cc.ws.close(); cd.ws.close();

  // ------------------------------------------------------------- match 3: speed hack
  const [ce, cf] = await Promise.all([connect(E.token, 'rio'), connect(F.token, 'nova')]);
  await ce.wait('authed'); await cf.wait('authed');
  const m3 = await match(ce, cf);
  const sp3 = Object.fromEntries(m3.dstart.players.map((p) => [p.id, p.spawn]));
  const speeder = sp3[ce.id] === 0 ? ce : cf, other = speeder === ce ? cf : ce;
  const z0 = sp3[speeder.id] === 0 ? 13.8 : -13.8;
  for (let i = 1; i <= 6 && !speeder.closed; i++) { speeder.send({ t: 'du', x: i * 3, y: 0, z: z0, yaw: 0, pitch: 0 }); await sleep(45); } // 3 m per 45 ms = 66 m/s
  const end3 = await other.wait('dend', 4000);
  ok('speed hack (66 m/s) is detected and forfeits the duel', end3.reason === 'forfeit_cheat' && end3.winner === other.id);
  ce.ws.close(); cf.ws.close();

  // ------------------------------------------------------------- match 4: nobody wins -> draw
  const [G, H] = await Promise.all([guest('Gil'), guest('Hal')]);
  const [cg, ch] = await Promise.all([connect(G.token, 'rio'), connect(H.token, 'nova')]);
  await cg.wait('authed'); await ch.wait('authed');
  await match(cg, ch);
  const draw = await cg.wait('dend', 12000);
  ok('time runs out with both alive: DRAW (no winner)', draw.winner === null && draw.reason === 'timeout');
  await sleep(200);
  ok('draw is recorded in the career', (await api('GET', '/api/career', null, G.token)).json.career.duelDraws === 1);
  cg.ws.close(); ch.ws.close();

  // ------------------------------------------------------------- lone player: no match -> practice bot message
  const [I] = await Promise.all([guest('Ivy')]);
  const ci = await connect(I.token, 'rio'); await ci.wait('authed');
  ci.send({ t: 'dq', char: 'rio' });
  await ci.wait('duel_nomatch', 14000);
  ok('lone player gets "no match" after ~9 s (client starts the bot duel)', true);
  ci.ws.close();
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.message); }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('server log tail:', log.split('\n').slice(-6).join(' | '));
server.kill();
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* sqlite file still locked on Windows */ }
process.exit(fail ? 1 : 0);
