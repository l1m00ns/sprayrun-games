// Friends, parties and team matches, server side, with fake WebSocket clients.
//   friend requests (username + friend code), accept / decline / remove, presence
//   parties: create, invite (friends only), join, leave, kick, leader-only rules, size limits
//   matchmaking: normal Duos 2v2 and Trios 3v3 (a party always on the same team), ranked Duos with Elo, cancel, solo FFA
//   team results: team score = sum, winner, rating changes
//   node tools/social.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import WebSocket from 'ws';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 8796;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-social-'));
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, AI_DISABLED: '1', RANKED_MIN_MINUTES: '0', RANKED_MIN_WAIT_MS: '500' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
await new Promise((r) => setTimeout(r, 5000));

let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const base = `http://localhost:${PORT}`;
const api = async (method, url, body, token) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = {}; // name -> { token, id, ws }
async function user(name, username) {
  let g = (await api('POST', '/api/auth/guest', { name })).json;
  if (username) { const r = await api('POST', '/api/auth/register', { guest: g.token, username, password: 'secret123', name }); if (r.json.token) g = r.json; }
  T[name] = { token: g.token, id: g.player.id, name };
  return T[name];
}
function connect(u) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    const c = { ws, msgs: [], id: null, closed: false,
      wait(type, ms = 15000, pred = () => true) { return new Promise((res, rej) => { const find = () => c.msgs.find((m) => m.t === type && pred(m)); const f = find(); if (f) return res(f); const to = setTimeout(() => { clearInterval(iv); rej(new Error('timeout waiting ' + type)); }, ms); const iv = setInterval(() => { const g = find(); if (g) { clearTimeout(to); clearInterval(iv); res(g); } }, 15); }); },
      last(type) { return [...c.msgs].reverse().find((m) => m.t === type); },
      send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
      clear() { c.msgs.length = 0; },
    };
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.msgs.push(m); if (m.t === 'hello') { c.id = m.id; ws.send(JSON.stringify({ t: 'auth', token: u.token, char: 'rio' })); } });
    ws.on('close', () => { c.closed = true; });
    ws.on('open', async () => { u.ws = c; await c.wait('authed', 8000).catch(() => {}); resolve(c); });
  });
}
const A = (u, m, x) => api(m, x.url, x.body, u.token);
const freshQueueFlush = async () => { await sleep(150); };

try {
  // ------------------------------------------------------------------------------------------------ friends
  const ana = await user('Ana', 'ana_run'), ben = await user('Ben', 'ben_run'), cat = await user('Cat', 'cat_run'), dan = await user('Dan', 'dan_run');
  const eli = await user('Eli'), fay = await user('Fay'); // guests (friend code only)
  const list0 = (await api('GET', '/api/friends', null, ana.token)).json;
  ok('friend list starts empty with a friend code', Array.isArray(list0.friends) && list0.friends.length === 0 && /^[A-Z2-9]{6}$/.test(list0.code), JSON.stringify(list0).slice(0, 80));
  let r = await api('POST', '/api/friends/request', { name: 'nobody_here' }, ana.token);
  ok('unknown username is refused', r.status === 400 && r.json.error === 'not_found');
  r = await api('POST', '/api/friends/request', { name: 'ana_run' }, ana.token);
  ok('cannot friend yourself', r.status === 400 && r.json.error === 'self');
  r = await api('POST', '/api/friends/request', { name: 'ben_run' }, ana.token);
  ok('friend request by username', r.status === 200 && r.json.status === 'sent');
  r = await api('POST', '/api/friends/request', { name: 'ben_run' }, ana.token);
  ok('duplicate request refused', r.status === 400 && r.json.error === 'pending');
  const benList = (await api('GET', '/api/friends', null, ben.token)).json;
  ok('request shows up as incoming', benList.incoming.length === 1 && benList.incoming[0].name === 'Ana');
  r = await api('POST', '/api/friends/respond', { id: ana.id, accept: true }, ben.token);
  ok('accepting makes both sides friends', r.status === 200 && (await api('GET', '/api/friends', null, ana.token)).json.friends.some((f) => f.name === 'Ben') && (await api('GET', '/api/friends', null, ben.token)).json.friends.some((f) => f.name === 'Ana'));
  // a guest adds by friend code; mutual request auto-accepts
  const eliCode = (await api('GET', '/api/friends', null, eli.token)).json.code;
  r = await api('POST', '/api/friends/request', { name: eliCode.toLowerCase() }, cat.token);
  ok('guests can be added with their friend code', r.status === 200);
  r = await api('POST', '/api/friends/request', { name: 'cat_run' }, eli.token);
  ok('a request in both directions auto-accepts', r.status === 200 && r.json.status === 'accepted');
  r = await api('POST', '/api/friends/request', { name: 'dan_run' }, cat.token);
  await api('POST', '/api/friends/respond', { id: cat.id, accept: false }, dan.token);
  ok('declined request leaves no relation', (await api('GET', '/api/friends', null, cat.token)).json.outgoing.length === 0);
  r = await api('POST', '/api/friends/remove', { id: eli.id }, cat.token);
  ok('removing a friend works both ways', r.status === 200 && (await api('GET', '/api/friends', null, eli.token)).json.friends.length === 0);
  ok('friends endpoints need a session', (await api('GET', '/api/friends')).status === 401);

  // ---------------------------------------------------------------------------------------------- presence + party
  for (const u of [ana, ben, cat, dan, eli, fay]) await connect(u);
  await api('POST', '/api/friends/request', { name: 'cat_run' }, ana.token); await api('POST', '/api/friends/respond', { id: ana.id, accept: true }, cat.token);
  await api('POST', '/api/friends/request', { name: 'dan_run' }, ana.token); await api('POST', '/api/friends/respond', { id: ana.id, accept: true }, dan.token);
  const fl = (await api('GET', '/api/friends', null, ana.token)).json.friends;
  ok('online friends are shown as online', fl.length === 3 && fl.every((f) => f.presence === 'lobby'), JSON.stringify(fl.map((f) => f.presence)));
  ana.ws.clear(); ben.ws.clear();
  ana.ws.send({ t: 'p_invite', id: eli.id }); // not a friend any more
  ok('only friends can be invited', (await ana.ws.wait('party_err', 4000)).msg.includes('friends'));
  ana.ws.send({ t: 'p_invite', id: ben.id });
  const inv = await ben.ws.wait('party_invite', 4000);
  ok('invitation reaches the friend', inv.from.name === 'Ana');
  ben.ws.send({ t: 'p_join', id: inv.id });
  const pv = await ben.ws.wait('party', 4000, (m) => m.members.length === 2);
  ok('joining makes a party of 2 with Ana as leader', pv.leader === ana.id && pv.members.length === 2);
  fay.ws.send({ t: 'p_join', id: inv.id });
  ok('a stranger cannot join without an invitation', (await fay.ws.wait('party_err', 4000)).msg.includes('invitation'));
  ben.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 2, mode: 'classic' } });
  ok('only the leader changes the mode', (await ben.ws.wait('party_err', 4000)).msg.includes('leader'));
  ana.ws.send({ t: 'p_invite', id: cat.id }); const inv2 = await cat.ws.wait('party_invite', 4000); cat.ws.send({ t: 'p_join', id: inv2.id });
  await ana.ws.wait('party', 4000, (m) => m.members.length === 3);
  ana.ws.send({ t: 'p_invite', id: dan.id });
  ok('a party holds at most 3', (await ana.ws.wait('party_err', 4000, (m) => /full/i.test(m.msg))).msg.includes('full'));
  ana.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 2, mode: 'classic' } });
  await ana.ws.wait('party', 4000, (m) => m.spec.size === 2);
  ana.ws.clear(); ana.ws.send({ t: 'p_play' });
  ok('3 players cannot queue for Duos', (await ana.ws.wait('party_err', 4000)).msg.includes('Too many'));
  ana.ws.send({ t: 'p_kick', id: cat.id });
  await cat.ws.wait('party_gone', 4000);
  ok('the leader can remove a player', true);
  ben.ws.send({ t: 'p_leave' }); await ben.ws.wait('party_gone', 4000);
  const afterLeave = await ana.ws.wait('party', 4000, (m) => m.members.length === 1);
  ok('leaving shrinks the party', afterLeave.members[0].id === ana.id);

  // ------------------------------------------------------------------------------------------- normal Duos 2v2
  // party Ana+Ben vs party Cat+Dan, both queue as groups
  await api('POST', '/api/friends/request', { name: 'dan_run' }, cat.token); await api('POST', '/api/friends/respond', { id: cat.id, accept: true }, dan.token);
  for (const [lead, mate] of [[ana, ben], [cat, dan]]) {
    lead.ws.send({ t: 'p_invite', id: mate.id }); const iv = await mate.ws.wait('party_invite', 4000, (m) => m.from.id === lead.id); mate.ws.send({ t: 'p_join', id: iv.id });
    await lead.ws.wait('party', 4000, (m) => m.members.length === 2);
  }
  for (const u of [ana, ben, cat, dan]) u.ws.clear();
  ana.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 2, mode: 'classic' } });
  cat.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 2, mode: 'classic' } });
  await sleep(200);
  ana.ws.send({ t: 'p_play' });
  ok('the whole party is told the search started', !!(await ben.ws.wait('tq_queued', 4000)) && !!(await ana.ws.wait('party', 4000, (m) => m.state === 'queued')));
  ana.ws.send({ t: 'p_cancel' });
  ok('the leader can cancel the search', !!(await ben.ws.wait('tq_cancelled', 4000)));
  ana.ws.clear(); ben.ws.clear();
  ana.ws.send({ t: 'p_play' }); cat.ws.send({ t: 'p_play' });
  const m2 = await ana.ws.wait('match', 15000);
  ok('Duos: two parties are matched 2v2', m2.size === 2 && m2.teams.length === 2 && m2.teams[0].length === 2 && m2.teams[1].length === 2 && !m2.ranked);
  const sideOf = (m, name) => m.teams.findIndex((t) => t.some((p) => p.name === name));
  ok('a party always lands on the same team', sideOf(m2, 'Ana') === sideOf(m2, 'Ben') && sideOf(m2, 'Cat') === sideOf(m2, 'Dan') && sideOf(m2, 'Ana') !== sideOf(m2, 'Cat'));
  const start = await ana.ws.wait('start', 8000);
  ok('the race starts for everyone', !!start && !!(await dan.ws.wait('start', 8000)));
  const room = ana.ws.last('room');
  ok('the room snapshot carries the teams', room.teamMode && room.players.every((p) => p.team === 0 || p.team === 1));
  // team scores: Ana's team gets more points; everyone dies
  const scores = { Ana: 900, Ben: 700, Cat: 800, Dan: 400 }, dist = { Ana: 900, Ben: 700, Cat: 800, Dan: 400 };
  await sleep(3200); // after the countdown
  for (const u of [ana, ben, cat, dan]) u.ws.send({ t: 'dead', d: dist[u.name] / 10, s: scores[u.name] / 10 });
  const res = await ana.ws.wait('results', 8000);
  const teamA = sideOf(m2, 'Ana'), sA = res.teams[teamA].score, sB = res.teams[1 - teamA].score;
  ok('team score is the sum of its runners', res.teamMode && sA > sB && sA === Math.floor(90) + Math.floor(70) && sB === Math.floor(80) + Math.floor(40), JSON.stringify(res.teams));
  ok('the winning team is announced', res.winner === teamA);
  const pv2 = await ana.ws.wait('party', 4000, (m) => m.state === 'idle');
  ok('parties go back to idle after the match', !!pv2);

  // ------------------------------------------------------------------------------------------- ranked Duos + Elo
  for (const u of [ana, ben, cat, dan]) u.ws.clear();
  ana.ws.send({ t: 'p_spec', spec: { kind: 'ranked', size: 2, mode: 'classic' } }); cat.ws.send({ t: 'p_spec', spec: { kind: 'ranked', size: 2, mode: 'classic' } });
  await sleep(200); ana.ws.send({ t: 'p_play' }); cat.ws.send({ t: 'p_play' });
  const mr = await ben.ws.wait('match', 15000);
  ok('ranked Duos match two parties 2v2 with ratings', mr.ranked && mr.teams[0].length === 2 && mr.teams.flat().every((p) => p.rating != null));
  await ana.ws.wait('start', 8000); await sleep(3200);
  for (const u of [ana, ben, cat, dan]) u.ws.send({ t: 'dead', d: 50, s: u.name === 'Ana' || u.name === 'Ben' ? 100 : 40 });
  const rt = await ana.ws.wait('rating', 8000);
  const rtDan = await dan.ws.wait('rating', 8000);
  ok('winners gain rating, losers lose it', rt.delta > 0 && rtDan.delta < 0 && rt.team === true, `${rt.delta} / ${rtDan.delta}`);
  const lad = (await api('GET', '/api/me', null, ana.token)).json.player.ladders;
  ok('each ladder keeps its own rating: Duos has 1 game and is provisional', lad && lad.duos.games === 1 && lad.duos.provisional === true && lad.solo.games === 0 && lad.trios.games === 0, JSON.stringify(lad && lad.duos));
  ok('a provisional ladder moves faster than a settled one', rt.delta >= 24, `delta=${rt.delta}`);
  const deep = await (await fetch(base + '/api/health?deep=1')).json();
  ok('deep health reports the database, version and uptime', deep.ok && deep.db.ok && /^2\.\d+\.\d+-/.test(deep.version) && deep.uptime_s >= 0, JSON.stringify(deep).slice(0, 120));


  // ------------------------------------------------------------------------------------- trios, solo FFA, mixed groups
  const names = ['Gus', 'Hal', 'Ivy', 'Jon', 'Kim', 'Lea'], us = [];
  for (const n of names) us.push(await user(n));
  for (const u of us) await connect(u);
  for (const u of us) { u.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 3, mode: 'classic' } }); }
  await sleep(200);
  for (const u of us.slice(0, 5)) u.ws.send({ t: 'p_play' });
  await sleep(1500);
  ok('5 players are not enough for a 3v3', !us[0].ws.msgs.some((m) => m.t === 'match'));
  us[5].ws.send({ t: 'p_play' });
  const m3 = await us[0].ws.wait('match', 15000);
  ok('Trios: six solo players are split 3v3', m3.size === 3 && m3.teams[0].length === 3 && m3.teams[1].length === 3);
  // a duo + a solo can fill a trio team
  for (const u of us) u.ws.send({ t: 'p_leave' });
  await sleep(500);
  // solo free-for-all (normal, size 1)
  const solo = await user('Mia'), solo2 = await user('Noa');
  await connect(solo); await connect(solo2);
  for (const u of [solo, solo2]) u.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 1, mode: 'classic' } });
  await sleep(200); solo.ws.send({ t: 'p_play' }); solo2.ws.send({ t: 'p_play' });
  const mf = await solo.ws.wait('match', 15000);
  ok('Normal Solo: two players are matched in a free-for-all', !mf.ranked && mf.players.length === 2 && !mf.teams);

  // ------------------------------------------- queue again after a finished match (PLAY used to do nothing)
  const rae = await user('Rae'), sol = await user('Sol');
  await connect(rae); await connect(sol);
  for (const u of [rae, sol]) { u.ws.send({ t: 'p_spec', spec: { kind: 'ranked', size: 1, mode: 'classic' } }); }
  await sleep(200); rae.ws.send({ t: 'p_play' }); sol.ws.send({ t: 'p_play' });
  const rm1 = await rae.ws.wait('match', 15000);
  ok('Ranked Solo queues and starts', rm1.ranked && rm1.players.length === 2);
  await rae.ws.wait('start', 8000); await sleep(3200);
  rae.ws.send({ t: 'dead', d: 20, s: 20 }); sol.ws.send({ t: 'dead', d: 10, s: 10 });
  await rae.ws.wait('results', 8000);
  for (const u of [rae, sol]) u.ws.clear();
  for (const u of [rae, sol]) { u.ws.send({ t: 'p_spec', spec: { kind: 'ranked', size: 1, mode: 'classic' } }); }
  await sleep(200); rae.ws.send({ t: 'p_play' }); sol.ws.send({ t: 'p_play' });
  const rm2 = await rae.ws.wait('match', 15000).catch(() => null);
  ok('PLAY works again after a finished ranked match', !!rm2 && rm2.ranked && rm2.players.length === 2);

  // --------------------------------------------------------------- Neon Rush online (LTM queue, neon map, event)
  const nea = await user('Nea'), neo = await user('Neo');
  await connect(nea); await connect(neo);
  for (const u of [nea, neo]) u.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 1, mode: 'classic', event: 'neon' } });
  await sleep(200); nea.ws.send({ t: 'p_play' }); neo.ws.send({ t: 'p_play' });
  const mn = await nea.ws.wait('match', 15000);
  ok('Neon Rush is playable online', mn.map === 'neon' && mn.ltm === 'neon' && mn.players.length === 2);
  const sn = await nea.ws.wait('start', 8000);
  ok('the Neon Rush event reaches every runner', sn.ltm === 'neon' && sn.map === 'neon');
  // disconnecting while queued cancels the group
  const p1 = await user('Pia'), p2 = await user('Quin');
  await connect(p1); await connect(p2);
  await api('POST', '/api/friends/request', { name: (await api('GET', '/api/friends', null, p2.token)).json.code }, p1.token);
  await api('POST', '/api/friends/respond', { id: p1.id, accept: true }, p2.token);
  p1.ws.send({ t: 'p_invite', id: p2.id }); const iv3 = await p2.ws.wait('party_invite', 4000, (m) => m.from.id === p1.id); p2.ws.send({ t: 'p_join', id: iv3.id });
  await p1.ws.wait('party', 4000, (m) => m.members.length === 2);
  p1.ws.send({ t: 'p_spec', spec: { kind: 'normal', size: 2, mode: 'classic' } }); await sleep(200); p1.ws.send({ t: 'p_play' });
  await p2.ws.wait('tq_queued', 4000);
  p2.ws.ws.close();
  const gone = await p1.ws.wait('tq_cancelled', 6000).then(() => true).catch(() => false);
  ok('a member disconnecting cancels the group search', gone);
  const stillP = await p1.ws.wait('party', 4000, (m) => m.members.length === 1 && m.state === 'idle').then(() => true).catch(() => false);
  ok('the party shrinks and goes back to idle', stillP);

  // ----------------------------------------------------------------------------------------------- private messages
  const ana2 = T.Ana, ben2 = T.Ben, eli2 = T.Eli;
  r = await api('POST', `/api/dm/${ben2.id}`, { text: '  hello   Ben  ' }, ana2.token);
  ok('friends can message each other', r.status === 200 && r.json.message.text === 'hello Ben', JSON.stringify(r.json).slice(0, 80));
  const live = await ben2.ws.wait('dm', 4000, (m) => m.text === 'hello Ben').catch(() => null);
  ok('the message is pushed live to the recipient', !!live && live.from.name === 'Ana', `closed=${ben2.ws.closed} ready=${ben2.ws.ws.readyState} last=${ben2.ws.msgs.slice(-3).map((m) => m.t).join(',')}`);
  r = await api('GET', '/api/dm', null, ben2.token);
  ok('the conversation list shows the unread count', r.json.unread === 1 && r.json.conversations[0].unread === 1 && r.json.conversations[0].with.name === 'Ana');
  r = await api('GET', `/api/dm/${ana2.id}`, null, ben2.token);
  ok('opening a conversation returns the history and marks it read', r.json.messages.length === 1 && (await api('GET', '/api/dm', null, ben2.token)).json.unread === 0);
  r = await api('POST', `/api/dm/${eli2.id}`, { text: 'hi stranger' }, ana2.token);
  ok('only friends can be messaged', r.status === 400 && r.json.error === 'not_friends');
  r = await api('POST', `/api/dm/${ben2.id}`, { text: 'hello Ben' }, ana2.token);
  ok('an identical message is refused for a moment', r.status === 400 && r.json.error === 'duplicate');
  r = await api('POST', `/api/dm/${ben2.id}`, { text: 'what the fuck' }, ana2.token);
  ok('the word filter masks insults', r.status === 200 && !/fuck/i.test(r.json.message.text) && /\*+/.test(r.json.message.text), r.json.message && r.json.message.text);
  let limited = 0;
  for (let i = 0; i < 9; i++) { const x = await api('POST', `/api/dm/${ben2.id}`, { text: 'spam ' + i }, ana2.token); if (x.status === 429) limited++; }
  ok('flooding is rate limited', limited >= 1, `limited=${limited}`);
  r = await api('POST', '/api/dm/report', { id: ana2.id, msg: 1, reason: 'insults' }, ben2.token);
  ok('a message can be reported', r.status === 200);
  r = await api('POST', '/api/block', { id: ana2.id }, ben2.token);
  ok('blocking works and ends the friendship', r.status === 200 && (await api('GET', '/api/friends', null, ben2.token)).json.friends.every((f) => f.name !== 'Ana'));
  r = await api('POST', `/api/dm/${ben2.id}`, { text: 'are you there' }, ana2.token);
  ok('a blocked player cannot message', r.status === 400);
  r = await api('POST', '/api/friends/request', { name: 'ben_run' }, ana2.token);
  ok('a blocked player cannot send a friend request', r.status === 400);

  // ----------------------------------------------------------------------------------------------------- data rights + legal
  for (const pth of ['/terms', '/privacy']) { const pr = await fetch(base + pth); const html = await pr.text(); ok(`${pth} page is served`, pr.status === 200 && /Reverse Surfers/.test(html) && html.length > 3000, `${pr.status} ${html.length}b`); }
  const zed = await user('Zed', 'zed_run');
  await api('POST', '/api/friends/request', { name: 'cat_run' }, zed.token); await api('POST', '/api/friends/respond', { id: zed.id, accept: true }, T.Cat.token);
  await api('POST', `/api/dm/${T.Cat.id}`, { text: 'hi cat' }, zed.token);
  const ex = await api('GET', '/api/me/export', null, zed.token);
  ok('export returns my data without credential material', ex.status === 200 && ex.json.profile.name === 'Zed' && !('pass_hash' in ex.json.profile) && ex.json.messages.messages.length === 1 && ex.json.friends.length >= 1, Object.keys(ex.json).join(',').slice(0, 90));
  let dl = await api('POST', '/api/me/delete', { password: 'wrong-password' }, zed.token);
  ok('deleting needs the right password', dl.status === 400 && dl.json.error === 'bad_credentials');
  dl = await api('POST', '/api/me/delete', { password: 'secret123' }, zed.token);
  ok('account deletion succeeds', dl.status === 200 && dl.json.ok);
  const lg = await api('POST', '/api/auth/login', { username: 'zed_run', password: 'secret123' });
  ok('the deleted account can no longer sign in', lg.status !== 200);
  ok('the session token stops working', (await api('GET', '/api/me', null, zed.token)).status === 401);
  ok('friends no longer list the deleted player', (await api('GET', '/api/friends', null, T.Cat.token)).json.friends.every((f) => f.name !== 'Zed'));
  const g2 = await user('Guesty');
  dl = await api('POST', '/api/me/delete', { confirm: 'nope' }, g2.token);
  ok('a guest must type DELETE', dl.status === 400 && dl.json.error === 'confirm');
  ok('...and can then delete', (await api('POST', '/api/me/delete', { confirm: 'delete' }, g2.token)).status === 200);
} catch (e) { ok('no unexpected error', false, String(e && e.message)); }

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('server log tail:', log.split('\n').slice(-8).join(' | ').slice(0, 800));
server.kill(); setTimeout(() => process.exit(fail ? 1 : 0), 300);
