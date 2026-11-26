// Reverse Surfers backend core: REST API + realtime (WebSocket) for rooms, ranked matchmaking and live race telemetry.
import { WebSocketServer } from 'ws';
import { db, q } from './db.mjs';
import { sign, verify, nonce, uuid } from './auth.mjs';
import { validateRun, checkLive, classify, maxDistAt, maxScore } from './anticheat.mjs';
import { reply, readJson, authPlayer, clientIp, originAllowed } from './http.mjs';
import { profile, careerOf, tierOf as tierOfRating, strike as strikeP, accessProblem, trackSocket, untrackSocket, recordEvent, kick, sockets, tagOf } from './players.mjs';
import { routeV2 } from './routes.mjs';
import { applyRun, bumpCareer, addXp, invOf } from './economy.mjs';
import { issueToken, cleanName as cleanNameAcc } from './accounts.mjs';
import { judge } from './ai.mjs';
import * as duelMod from './duel.mjs';
import * as ipintel from './ipintel.mjs';
import { collusionSet } from './devices.mjs';
import { nowMs, dayKey, dailyInfo, rankedMinSeconds } from './catalog.mjs';
import * as social from './social.mjs';
import * as analytics from './analytics.mjs';
import crypto from 'node:crypto';
import * as mmr from './mmr.mjs';
import { log, startMaintenance, deepHealth } from './ops.mjs';

const MAPS = ['city', 'snow', 'tropic', 'desert', 'neon'];
const ROOM_MAPS = new Set([...MAPS, 'tour']);
const ANIMS = new Set(['run', 'jump', 'roll', 'board', 'jet', 'stumble', 'crash']);
const MODES = new Set(['classic', 'nocoin']);
const MAX_PLAYERS = 8;
const RANKED_MIN_WAIT = Number(process.env.RANKED_MIN_WAIT_MS) || 8000;
export const tierOf = tierOfRating;

const clamp = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : 0));
const sameSecret = (given, want) => { const a = Buffer.from(String(given || '')), b = Buffer.from(String(want || '')); return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b); };
const cleanName = cleanNameAcc;
// Account-less players always get an identifiable pseudonym: no "Player" / "Runner" pile-up on the boards.
// A name someone explicitly picks is kept; the default placeholder names are replaced by a unique random one.
const GUEST_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLACEHOLDER = /^(runner|player|guest|surfer|anonymous|anon)$/i;
function guestName(wanted) {
  const w = cleanName(wanted || '');
  if (w && w.length >= 2 && !PLACEHOLDER.test(w)) return w;
  for (let i = 0; i < 40; i++) {
    let n = 'Runner-';
    for (let k = 0; k < 4; k++) n += GUEST_ABC[Math.floor(Math.random() * GUEST_ABC.length)];
    if (!q.profileByName.get(n)) return n;
  }
  return `Runner-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
const cleanChar = (s) => (typeof s === 'string' && /^[a-z]{2,8}$/.test(s) ? s : 'kit');
const now = () => Date.now();

// ---------------------------------------------------------------------------------- REST
const buckets = new Map();
function limited(ip) {
  const t = now();
  const b = buckets.get(ip) || { n: 0, t };
  if (t - b.t > 60000) { b.n = 0; b.t = t; }
  b.n++;
  buckets.set(ip, b);
  return b.n > 400;
}
setInterval(() => { const t = now(); for (const [k, b] of buckets) if (t - b.t > 120000) buckets.delete(k); q.purgeTickets.run(t - 6 * 3600 * 1000); }, 60000).unref();

// Online access is refused to VPN / proxy / Tor / datacenter connections (see ipintel.mjs).
const VPN_GATED = new Set(['POST /api/auth/guest', 'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/run/start', 'POST /api/run/finish']);

// Returns true when the request was handled.
export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) return false;
  if (req.method === 'OPTIONS') { reply(res, 204, {}); return true; }
  const ip = clientIp(req);
  if (limited(ip)) { reply(res, 429, { error: 'rate_limited' }); return true; }
  try {
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /api/health') {
      if (url.searchParams.get('deep')) { const h = deepHealth({ time: now(), online: wss ? wss.clients.size : 0, rooms: rooms.size, queued: tq.length + queues.classic.length + queues.nocoin.length + queues.duel.length }); reply(res, h.ok ? 200 : 503, h); return true; }
      reply(res, 200, { ok: true, time: now(), online: wss ? wss.clients.size : 0 });
      return true;
    }

    // Public product analytics: the game posts visits, runs, matches and performance samples here.
    if (route === 'POST /api/analytics/event') {
      const body = await readJson(req);
      const r = analytics.track(body, { ip, ua: req.headers['user-agent'], ref: req.headers.referer });
      reply(res, r.ok ? 200 : 429, r);
      return true;
    }
    // Dashboard data: ADMIN_KEY only, constant-time comparison, never cached.
    if (route === 'GET /api/analytics/summary') {
      const want = process.env.ADMIN_KEY || '';
      if (!sameSecret(req.headers['x-admin-key'] || url.searchParams.get('key'), want)) {
        reply(res, 403, { error: 'forbidden', message: 'Send the ADMIN_KEY in X-Admin-Key.' });
        return true;
      }
      reply(res, 200, analytics.summary(url.searchParams.get('days'), { online: wss ? wss.clients.size : 0 }));
      return true;
    }

    if (VPN_GATED.has(route)) {
      const v = await ipintel.check(ip);
      if (v.block) { reply(res, 403, ipintel.blockedReply(v)); return true; }
    }

    if (route === 'POST /api/auth/guest') {
      const body = await readJson(req);
      const id = uuid();
      q.addPlayer.run(id, guestName(body.name), now());
      const p = q.getPlayer.get(id);
      reply(res, 200, { token: issueToken(p), player: profile(p, false) });
      return true;
    }

    const me = authPlayer(req);
    if (await routeV2(req, res, url, me, route)) return true;

    if (route === 'GET /api/leaderboard') {
      const board = url.searchParams.get('board') || 'classic';
      const period = url.searchParams.get('period') || 'all';
      const limit = clamp(Number(url.searchParams.get('limit')) || 50, 1, 100);
      const since = period === 'day' ? now() - 86400000 : period === 'week' ? now() - 7 * 86400000 : 0;
      let rows;
      if (board === 'ranked') rows = q.boardRanked.all(limit).map((r, i) => ({ rank: i + 1, name: r.name, tag: tagOf(r.pid), premium: !!r.premium, score: Math.round(r.score), tier: tierOf(r.score), games: r.games, wins: r.wins }));
      else if (board === 'daily') rows = q.boardDaily.all(dailyInfo().key, limit).map((r, i) => ({ rank: i + 1, name: r.name, tag: tagOf(r.pid), premium: !!r.premium, score: r.score, dist: r.dist, time: r.time }));
      else if (board === 'guest') rows = q.boardGuests.all(limit).map((r, i) => ({ rank: i + 1, name: r.name, tag: tagOf(r.pid), premium: !!r.premium, score: r.score, dist: r.dist, time: r.time }));
      else if (MODES.has(board)) rows = q.boardMode.all(board, since, limit).map((r, i) => ({ rank: i + 1, name: r.name, tag: tagOf(r.pid), premium: !!r.premium, score: r.score, dist: r.dist, time: r.time }));
      else { reply(res, 400, { error: 'bad_board' }); return true; }
      const out = { board, period, rows, you: null };
      if (me) {
        if (board === 'ranked') out.you = { score: Math.round(me.rating), rank: me.games > 0 ? q.ratingRank.get(me.rating).n + 1 : null };
        else if (board === 'guest') { const b = q.myBestMode.get(me.id, 'classic', 0).s; out.you = b == null ? null : { score: b, rank: q.betterModeCount.get('classic', 0, b).n + 1, guest: !me.username }; }
        else if (MODES.has(board)) { const b = q.myBestMode.get(me.id, board, since).s; out.you = b == null ? null : { score: b, rank: q.betterModeCount.get(board, since, b).n + 1 }; }
      }
      reply(res, 200, out);
      return true;
    }

    if (route === 'POST /api/run/start') {
      if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
      const prob = accessProblem(me);
      if (prob) { reply(res, 403, prob); return true; }
      const body = await readJson(req);
      const mode = MODES.has(body.mode) ? body.mode : 'classic';
      const daily = !!body.daily;
      const d = dailyInfo();
      const n = nonce();
      q.addTicket.run(n, me.id, now());
      const t = { pid: me.id, mode, daily, dkey: daily ? d.key : 0, map: daily ? d.map : (ROOM_MAPS.has(body.map) ? body.map : 'city'), t0: now(), n };
      reply(res, 200, { ticket: sign(t), t0: t.t0 });
      return true;
    }

    if (route === 'POST /api/run/finish') {
      if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
      const body = await readJson(req);
      const t = verify(body.ticket);
      if (!t || t.pid !== me.id) { reply(res, 400, { error: 'bad_ticket' }); return true; }
      const rec = q.getTicket.get(t.n);
      if (!rec || rec.used) { reply(res, 400, { error: 'ticket_used' }); return true; }
      if (now() - t.t0 > 40 * 60 * 1000) { reply(res, 400, { error: 'ticket_expired' }); return true; }
      q.useTicket.run(t.n);
      const flags = [];
      if (now() - me.last_run < 4000) flags.push('rate');
      if (q.runsLastDay.get(me.id, now() - 86400000).n > 400) flags.push('too_many_runs');
      flags.push(...validateRun(body, t, now()));
      // flagged: 1 = rejected by fair play, 2 = valid but not eligible for leaderboards (revived run), 0 = fully valid
      const revived = Math.max(0, Math.floor(Number(body.stats && body.stats.revives) || 0)) > 0;
      const flagged = flags.length > 0 || me.banned || me.kicked_until > now() ? 1 : revived ? 2 : 0;
      q.touchRun.run(now(), me.id);
      q.addRun.run(me.id, t.mode, t.map, t.daily ? 1 : 0, t.dkey, Math.floor(clamp(body.score, 0, 1e9)), Math.floor(clamp(body.dist, 0, 1e7)), Math.floor(clamp(body.coins, 0, 1e7)), clamp(body.time, 0, 1e5), now(), flagged, flags.join(','));
      if (flagged === 1) reviewFlags(me.id, flags, body, t);
      const since = 0;
      let rank = null, reward = null;
      if (flagged === 0 && !t.daily) rank = q.betterModeCount.get(t.mode, since, Math.floor(body.score)).n + 1;
      if (flagged !== 1) reward = applyRun(me.id, body, t); // wallet, xp, career and achievements: only for validated runs
      reply(res, 200, { ok: true, accepted: flagged !== 1, ranked: flagged === 0, flags, rank, reward, player: profile(q.getPlayer.get(me.id)) });
      return true;
    }

    reply(res, 404, { error: 'not_found' });
  } catch (e) {
    // a malformed or oversized body is the client's fault (400); anything else is OUR bug: log it with an id and say so (500)
    const bad = e instanceof SyntaxError || (e && e.message === 'too large');
    if (bad) reply(res, 400, { error: 'bad_request' });
    else { const id = nonce().slice(0, 8); log('error', 'unhandled api error', { id, route: `${req.method} ${url.pathname}`, err: String(e && e.stack ? e.stack : e).slice(0, 800) }); reply(res, 500, { error: 'server_error', id }); }
  }
  return true;
}

const strike = (pid, kind = 'violation', detail = '', severity = 1) => strikeP(pid, kind, detail, severity);

// Flag review: hard flags are physically impossible values -> strike at once. Soft flags only get a strike when the
// fair-play judge (AI with a rule fallback) agrees that the evidence is more than a skilled / throttled player.
function reviewFlags(pid, flags, body, ticket) {
  const cls = classify(flags);
  const hard = cls.filter((f) => f.hard);
  const detail = { flags: flags.join(','), score: body.score, dist: body.dist, coins: body.coins, time: body.time, mode: ticket.mode };
  if (hard.length) { strike(pid, 'run:' + hard.map((f) => f.flag).join('+'), detail, 2); return; }
  const evId = recordEvent(pid, 'run_soft', detail, 1);
  const p = q.getPlayer.get(pid);
  const ceiling = { maxDist: Math.round(maxDistAt(body.time)), maxScore: Math.round(maxScore(body.dist, body.coins)) };
  judge({ kind: 'run', flags: cls, run: { score: body.score, dist: body.dist, coins: body.coins, time: body.time, stats: body.stats, input: body.input, mode: ticket.mode }, ceiling, account: { ageDays: Math.floor((now() - p.created) / 86400000), games: p.games, strikes: p.strikes } }, { pid })
    .then((v) => {
      q.setEventVerdict.run(JSON.stringify({ verdict: v.verdict, confidence: v.confidence, reasons: v.reasons, summary: v.summary, source: v.source, rounds: v.rounds, votes: v.votes, tokens: v.tokens, cached: !!v.cached }), v.recommended_action, evId);
      if ((v.verdict === 'cheating' && v.confidence !== 'low') || v.recommended_action === 'strike' || v.recommended_action === 'kick') strike(pid, 'judge:' + v.verdict, v.summary, 1);
    }).catch(() => { /* judge failures never affect the player */ });
}

// ----------------------------------------------------------------------------- Elo / ranking
export function eloDeltas(list) {
  // list: [{pid, rating, games, place}] ; returns Map pid -> delta (pairwise Elo, K scaled by experience)
  const out = new Map(), n = list.length;
  for (const a of list) {
    let sum = 0;
    for (const b of list) {
      if (a === b) continue;
      const E = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
      const S = a.place < b.place ? 1 : a.place > b.place ? 0 : 0.5;
      sum += S - E;
    }
    const K = a.games < 30 ? 40 : 28;
    out.set(a.pid, Math.round(((K / (n - 1)) * sum * 2) * 10) / 10);
  }
  return out;
}

// ------------------------------------------------------------------------------ realtime
const rooms = new Map();
const queues = { classic: [], nocoin: [], duel: [] };
let wss = null;
let nextId = 1;

const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
const broadcast = (room, obj, except) => { for (const p of room.players.values()) if (p.ws !== except) send(p.ws, obj); };
function roomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; if (!rooms.has(c)) return c; }
}
function snapshot(room) {
  return {
    t: 'room', code: room.code, host: room.host, map: room.map, state: room.state, pub: room.pub, ranked: room.ranked, ltm: room.ltm || null, mode: room.mode,
    teamMode: !!room.teamMode, size: room.size || 0,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, premium: !!p.premium, eq: p.eq || null, team: p.team == null ? null : p.team, ready: p.ready, alive: p.alive, d: Math.floor(p.d), s: Math.floor(p.s), rating: p.rating, tier: p.rating == null ? null : tierOf(p.rating) })),
  };
}
const pushRoom = (room) => broadcast(room, snapshot(room));
// what the duel module needs from this file
const dio = { send, broadcast: (room, obj, except) => broadcast(room, obj, except || undefined), onSoftFlag: (p, st) => reviewDuelAim(p.pid, st), afterResume: (room) => checkFinish(room) };
function reviewDuelAim(pid, st) {
  const p = q.getPlayer.get(pid);
  if (!p) return;
  const evId = recordEvent(pid, 'duel_soft', st, 1);
  judge({ kind: 'duel', flags: [{ flag: 'aim_stats', hard: false }], duel: { shots: st.shots, hits: st.hits, head: st.head, dmg: st.dmg }, account: { ageDays: Math.floor((now() - p.created) / 86400000), games: p.games, strikes: p.strikes } }, { pid })
    .then((v) => {
      q.setEventVerdict.run(JSON.stringify({ verdict: v.verdict, confidence: v.confidence, reasons: v.reasons, source: v.source, rounds: v.rounds, votes: v.votes }), v.recommended_action, evId);
      if (v.verdict === 'cheating' && v.confidence === 'high') strike(pid, 'judge:duel_aim', v.summary, 1);
    }).catch(() => { /* never affects the player */ });
}

function newRoom(opts = {}) {
  const r = { code: roomCode(), host: null, map: 'city', mode: 'classic', state: 'lobby', pub: false, ranked: false, players: new Map(), startedAt: 0, seed: 0, matchId: 0, ...opts };
  rooms.set(r.code, r);
  return r;
}

function addToRoom(ws, room, msg) {
  leaveAll(ws);
  ws.room = room;
  const p = ws.player;
  room.players.set(ws.id, { ws, id: ws.id, pid: p ? p.id : null, name: p ? p.name : cleanName(msg && msg.name), char: cleanChar(msg && msg.char), premium: !!(p && p.premium), eq: p ? invOf(p).equip : null, rating: p ? p.rating : null, ready: false, alive: true, d: 0, s: 0, last: 0, ac: null });
  if (!room.host) room.host = ws.id;
  if (room.state === 'results') room.state = 'lobby';
}

function leaveAll(ws) {
  dequeue(ws);
  const room = ws.room;
  if (!room) return;
  if (room.duel && !room.duel.over) duelMod.onLeave(room, ws.id, dio);
  const me = room.players.get(ws.id);
  ws.room = null;
  if (me && room.state === 'running' && me.alive) {
    me.alive = false; me.left = true; // leaving a live race counts as a loss in ranked
    if (room.ranked && me.pid) q.addLeave.run(me.pid);
    broadcast(room, { t: 'dead', id: ws.id, d: me.d, s: me.s });
  }
  if (room.state === 'running') { me && (me.ws = { readyState: 3 }); } else room.players.delete(ws.id);
  const live = [...room.players.values()].filter((p) => p.ws.readyState === 1);
  if (live.length === 0) { rooms.delete(room.code); return; }
  if (room.host === ws.id) room.host = live[0].id;
  broadcast(room, { t: 'left', id: ws.id });
  pushRoom(room);
  checkFinish(room);
}

function checkFinish(room) {
  if (room.state !== 'running') return;
  // Gold Rush guarantee: the duel happens at least once per game. If somebody crashed before the first warp, warp NOW.
  if (room.ltm && !room.duelCount && !room.duel && !room.warping) {
    const conn = [...room.players.values()].filter((p) => p.ws.readyState === 1);
    if (conn.length === 2 && conn.some((p) => !p.alive)) { room.warpAt = Math.min(room.warpAt || Infinity, now() + 300); return; }
  }
  const alive = [...room.players.values()].filter((p) => p.alive);
  if (alive.length === 0 || now() - room.startedAt > 8 * 60 * 1000) finish(room);
}

function finish(room) {
  if (room.teamMode) return finishTeams(room);
  room.state = 'results';
  const all = [...room.players.values()];
  for (const p of all) { // final plausibility check on what each player claims
    if (!p.dq && p.ac) {
      const bad = checkLive(p, { d: p.d, s: p.s, sp: 0 }, now());
      if (bad.includes('score') || bad.includes('dist_ahead_of_clock')) { p.dq = true; if (p.pid) strike(p.pid, 'race_final:' + bad.join('+'), { d: p.d, s: p.s }, 2); }
    }
  }
  const ranked = all.sort((a, b) => (a.dq ? 1 : 0) - (b.dq ? 1 : 0) || b.s - a.s || b.d - a.d);
  ranked.forEach((p, i) => { p.place = i + 1; });
  broadcast(room, { t: 'results', ranking: ranked.map((p) => ({ id: p.id, name: p.name, char: p.char, d: Math.floor(p.d), s: Math.floor(p.s), dq: !!p.dq })), ranked: room.ranked });
  if (room.ranked) settleRanked(room, ranked);
  pushRoom(room);
  setTimeout(() => { if (room.state === 'results' && [...room.players.values()].every((p) => p.ws.readyState !== 1)) rooms.delete(room.code); }, 60000).unref();
}

function settleRanked(room, ranked) {
  const humans = ranked.filter((p) => p.pid);
  if (humans.length < 2) return;
  const rows = humans.map((p) => { const row = q.getPlayer.get(p.pid); return { pid: p.pid, rating: row.rating, games: row.games, place: p.place }; });
  const deltas = eloDeltas(rows);
  const matchId = Number(q.addMatch.run(now(), room.map, room.mode, room.seed, 1).lastInsertRowid);
  for (const p of humans) {
    const row = rows.find((r) => r.pid === p.pid);
    let delta = deltas.get(p.pid);
    if (p.dq) delta = Math.min(delta, -25);
    if (p.left) delta -= 6;
    const after = Math.max(0, row.rating + delta);
    q.setRating.run(after, p.place === 1 && !p.dq ? 1 : 0, p.pid);
    if (!p.dq) { bumpCareer(p.pid, (c) => { c.rankedGames++; if (p.place === 1) c.rankedWins++; }); addXp(p.pid, 40 + (p.place === 1 ? 60 : 0)); }
    q.addMatchPlayer.run(matchId, p.pid, p.name, Math.floor(p.s), Math.floor(p.d), p.place, row.rating, after, p.dq ? 1 : 0);
    send(p.ws, { t: 'rating', before: Math.round(row.rating), after: Math.round(after), delta: Math.round(delta * 10) / 10, place: p.place, tier: tierOf(after), dq: !!p.dq });
  }
}

// ---- matchmaking ----------------------------------------------------------------------------
const QUICK_ELO = 30; // same MMR: pair at once, no waiting for a fourth runner
const QUICK_WAIT = 3; // otherwise a few seconds to find a closer opponent, then go anyway
const searchWindow = (e, t) => Math.min(50 + ((t - e.joined) / 1000) * 30, 900); // widens as you wait
function dequeue(ws) {
  for (const k of Object.keys(queues)) queues[k] = queues[k].filter((e) => e.ws !== ws);
  for (let i = tq.length - 1; i >= 0; i--) { // a member of a waiting group leaves: the whole group stops searching
    const e = tq[i];
    if (!e.wsList.includes(ws)) continue;
    tq.splice(i, 1);
    for (const w of e.wsList) send(w, { t: 'tq_cancelled' });
    if (e.party) social.setPartyState(e.party, 'idle');
  }
}
function enqueue(ws, mode) {
  if (!ws.player || ws.player.banned) { send(ws, { t: 'err', msg: ws.player ? 'Ranked is disabled for this account' : 'Sign in first' }); return false; }
  if (mode !== 'duel') { // ranked ladders: a minimum amount of real playing time first
    const have = careerOf(q.getPlayer.get(ws.player.id)).time, need = rankedMinSeconds();
    if (have < need) { send(ws, { t: 'err', code: 'ranked_locked', msg: `Ranked unlocks after ${Math.max(1, Math.ceil(need / 60))} minutes of play (${Math.max(1, Math.ceil((need - have) / 60))} min to go).`, need, have: Math.floor(have) }); return false; }
  }
  leaveAll(ws);
  queues[mode].push({ ws, joined: now(), rating: ws.player.rating, mode, pid: ws.player.id, links: collusionSet(ws.player.id) });
  send(ws, { t: 'queued', mode, rating: Math.round(ws.player.rating), tier: tierOf(ws.player.rating) });
  return true;
}
// Elo-first pairing: for each waiting player we look at the CLOSEST rating first (not at who arrived first), and
// pair instantly when it is within QUICK_ELO. Only if nobody that close is waiting do we let the window widen with time.
function matchTick() {
  const t = now();
  matchTeams(t);
  for (const mode of Object.keys(queues)) {
    const list = queues[mode].filter((e) => e.ws.readyState === 1).sort((a, b) => a.rating - b.rating);
    queues[mode] = list;
    const used = new Set();
    const full = mode === 'duel' ? 2 : 4;
    for (const a of list) {
      if (used.has(a)) continue;
      const candidates = list
        .filter((b) => b !== a && !used.has(b) && !a.links.has(b.pid) && !b.links.has(a.pid))
        .sort((x, y) => Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating));
      const group = [a];
      for (const b of candidates) {
        if (group.length >= full) break;
        const w = Math.min(searchWindow(a, t), searchWindow(b, t));
        if (Math.abs(a.rating - b.rating) > w) continue;
        if (!group.every((g) => Math.abs(g.rating - b.rating) <= Math.min(w, searchWindow(g, t)))) continue; // same person / device never together
        group.push(b);
      }
      const close = group.some((g) => g !== a && Math.abs(g.rating - a.rating) <= QUICK_ELO);
      const waited = (t - a.joined) / 1000;
      const go = group.length >= 2 && (group.length === full || close || waited >= QUICK_WAIT || mode === 'duel');
      if (go) { for (const g of group) used.add(g); startRankedMatch(group, mode); }
      else for (const g of group) send(g.ws, { t: 'searching', waited: Math.floor((t - g.joined) / 1000), range: Math.round(searchWindow(g, t)), found: group.length });
    }
    queues[mode] = queues[mode].filter((e) => !used.has(e));
    if (mode === 'duel') queues.duel = queues.duel.filter((e) => { if (t - e.joined > 12000) { send(e.ws, { t: 'duel_nomatch' }); return false; } return true; }); // nobody to fight: the client starts a practice duel
  }
}
function startRankedMatch(group, mode) {
  const isDuel = mode === 'duel';
  const room = newRoom({ ranked: !isDuel, ltm: isDuel ? 'goldrush' : null, mode: isDuel ? 'classic' : mode, map: MAPS[Math.floor(Math.random() * MAPS.length)], state: 'lobby' });
  for (const g of group) addToRoom(g.ws, room, { char: g.ws.char });
  pushRoom(room);
  broadcast(room, { t: 'match', code: room.code, map: room.map, mode: room.mode, ranked: !isDuel, ltm: room.ltm, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, rating: Math.round(p.rating), tier: tierOf(p.rating) })) });
  setTimeout(() => startRace(room, 3), 3500).unref();
}
function startRace(room, countdown = 3) {
  if (room.state !== 'lobby' || room.players.size === 0) return;
  room.state = 'running'; room.startedAt = now() + countdown * 1000;
  room.seed = Math.floor(Math.random() * 2 ** 31);
  if (room.ltm) { room.warpAt = room.startedAt + (Number(process.env.DUEL_WARP_MS) || 25000 + Math.random() * 35000); room.duel = null; room.overAt = 0; room.warping = false; } // the track warps into the arena at a random moment
  for (const p of room.players.values()) { p.alive = true; p.d = 0; p.s = 0; p.ready = false; p.dq = false; p.ac = null; p.left = false; }
  broadcast(room, { t: 'start', seed: room.seed, map: room.map, mode: room.mode, ranked: room.ranked, countdown });
  pushRoom(room);
}

// ---- teams: normal / ranked Duos and Trios (2 teams of N), normal Solo (free for all) ---------------------------------
// A queue entry is a GROUP (a whole party, or one player). A party always lands on the same team.
const tq = [];
const specKey = (s) => `${s.kind}:${s.size}:${s.mode}`;
const avgRating = (list) => list.reduce((s, e) => s + e.rating * e.wsList.length, 0) / Math.max(1, list.reduce((s, e) => s + e.wsList.length, 0));
function enqueueGroup(wsList, spec, partyId) {
  const members = wsList.filter((w) => w.player && w.readyState === 1);
  if (!members.length) return { ok: false, msg: 'Nobody to queue' };
  for (const ws of members) {
    if (ws.player.banned) return { ok: false, msg: 'An account in this group cannot queue' };
    if (spec.kind === 'ranked') {
      const have = careerOf(q.getPlayer.get(ws.player.id)).time, need = rankedMinSeconds();
      if (have < need) return { ok: false, code: 'ranked_locked', msg: `${ws.player.name}: ranked unlocks after ${Math.max(1, Math.ceil(need / 60))} minutes of play (${Math.max(1, Math.ceil((need - have) / 60))} min to go)` };
    }
  }
  if (spec.kind === 'ranked' && spec.size === 1) { const ok = enqueue(members[0], spec.mode); return { ok }; } // the classic ranked ladder (free for all, Elo by place)
  for (const ws of members) leaveAll(ws);
  const links = new Set(); for (const ws of members) for (const l of collusionSet(ws.player.id)) links.add(l);
  const bucket = mmr.bucketOf(spec), g = mmr.groupRating(members.map((w) => mmr.get(w.player.id, bucket)));
  if (spec.kind === 'ranked' && g.spread > mmr.MAX_SPREAD) return { ok: false, msg: `Ranks are too far apart for ranked (max ${mmr.MAX_SPREAD} points between teammates)` };
  const rating = g.rating;
  tq.push({ id: partyId || `s${nextId++}`, party: partyId || null, wsList: members, spec, bucket, joined: now(), rating, sigma: g.sigma, links });
  for (const ws of members) send(ws, { t: 'tq_queued', spec, size: members.length, party: !!partyId, rating: Math.round(rating), tier: tierOf(rating) });
  return { ok: true };
}
function dequeueGroup(id, wsList = []) {
  const i = tq.findIndex((e) => e.id === id);
  if (i >= 0) { const [e] = tq.splice(i, 1); for (const w of e.wsList) send(w, { t: 'tq_cancelled' }); }
  for (const ws of wsList) { for (const k of Object.keys(queues)) { const had = queues[k].some((e) => e.ws === ws); queues[k] = queues[k].filter((e) => e.ws !== ws); if (had) send(ws, { t: 'queue_cancelled' }); } }
}
const inMatch = (pid) => { const set = sockets.get(pid); if (set) for (const ws of set) if (ws.room && (ws.room.state === 'running' || (ws.room.state === 'lobby' && ws.room.teamMode))) return true; return false; };
social.init({ send, enqueueGroup, dequeueGroup, inMatch });

// every way to pick entries whose sizes add up to N (optionally containing `must`)
function subsets(items, N, must) {
  const out = [];
  (function rec(i, picked, sum) {
    if (out.length > 80) return;
    if (sum === N) { if (!must || picked.includes(must)) out.push(picked.slice()); return; }
    if (i >= items.length || sum > N) return;
    picked.push(items[i]); rec(i + 1, picked, sum + items[i].wsList.length); picked.pop();
    rec(i + 1, picked, sum);
  })(0, [], 0);
  return out;
}
const linkedAcross = (A, B) => A.some((a) => a.wsList.some((x) => { const l = collusionSet(x.player.id); return B.some((b) => b.wsList.some((y) => l.has(y.player.id))); }));
// Closest team first: of every legal pairing we keep the one whose average MMR is nearest. An exact match starts at
// once; otherwise the window widens with the wait (and with rating uncertainty).
function findTeams(pool, seed, N, t, ranked) {
  let best = null, bestDiff = Infinity;
  for (const A of subsets(pool, N, seed)) {
    const rest = pool.filter((e) => !A.includes(e));
    for (const B of subsets(rest, N)) {
      if (linkedAcross(A, B)) continue; // the same person / device on both sides is never matched (normal too)
      const diff = Math.abs(avgRating(A) - avgRating(B));
      if (!ranked) { if (diff < bestDiff) { best = [A, B]; bestDiff = diff; } continue; } // normal: closest teams, no widening
      const waited = Math.max(...[...A, ...B].map((e) => t - e.joined)), unsure = Math.max(...[...A, ...B].map((e) => e.sigma || 0));
      const win = Math.min(50 + (waited / 1000) * 30 + (unsure - mmr.SIGMA_FLOOR) * 0.35, 900);
      if (diff > win) continue;
      if (diff < bestDiff) { best = [A, B]; bestDiff = diff; }
    }
  }
  return best;
}
function matchTeams(t) {
  for (let i = tq.length - 1; i >= 0; i--) { tq[i].wsList = tq[i].wsList.filter((w) => w.readyState === 1); if (!tq[i].wsList.length) tq.splice(i, 1); }
  const byKey = new Map();
  for (const e of tq) { const k = specKey(e.spec); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(e); }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.joined - b.joined);
    const spec = list[0].spec, N = spec.size;
    if (N === 1) { // normal solo: a free-for-all of up to 4; two players with the same MMR start at once
      const close = list.length >= 2 && Math.abs(list[0].rating - list[1].rating) <= QUICK_ELO;
      if (list.length >= 4 || (list.length >= 2 && (close || t - list[0].joined >= 2500))) startFFA(list.slice(0, 4), spec);
      else for (const e of list) for (const ws of e.wsList) send(ws, { t: 'tq_searching', waited: Math.floor((t - e.joined) / 1000), found: list.length, need: 2 });
      continue;
    }
    const used = new Set();
    for (const a of list) {
      if (used.has(a)) continue;
      const pool = list.filter((e) => !used.has(e));
      const teams = findTeams(pool, a, N, t, spec.kind === 'ranked');
      if (teams) { teams.flat().forEach((e) => used.add(e)); startTeamMatch(teams, spec); }
      else for (const ws of a.wsList) send(ws, { t: 'tq_searching', waited: Math.floor((t - a.joined) / 1000), found: pool.reduce((s, e) => s + e.wsList.length, 0), need: N * 2 });
    }
  }
}
const takeFromQueue = (entries) => { for (const e of entries) { const i = tq.indexOf(e); if (i >= 0) tq.splice(i, 1); } };
function startFFA(entries, spec) {
  takeFromQueue(entries);
  const room = newRoom({ ranked: false, mode: spec.mode, map: MAPS[Math.floor(Math.random() * MAPS.length)], state: 'lobby' });
  for (const e of entries) { for (const ws of e.wsList) addToRoom(ws, room, { char: ws.char }); if (e.party) social.setPartyState(e.party, 'ingame'); }
  pushRoom(room);
  broadcast(room, { t: 'match', code: room.code, map: room.map, mode: room.mode, ranked: false, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, rating: p.rating == null ? null : Math.round(p.rating), tier: p.rating == null ? null : tierOf(p.rating) })) });
  setTimeout(() => startRace(room, 3), 3500).unref();
}
function startTeamMatch(teams, spec) {
  takeFromQueue(teams.flat());
  const room = newRoom({ ranked: spec.kind === 'ranked', mode: spec.mode, map: MAPS[Math.floor(Math.random() * MAPS.length)], state: 'lobby', teamMode: true, size: spec.size });
  teams.forEach((team, ti) => { for (const e of team) { for (const ws of e.wsList) { addToRoom(ws, room, { char: ws.char }); room.players.get(ws.id).team = ti; } if (e.party) social.setPartyState(e.party, 'ingame'); } });
  pushRoom(room);
  const side = (ti) => [...room.players.values()].filter((p) => p.team === ti).map((p) => ({ id: p.id, name: p.name, rating: p.rating == null ? null : Math.round(p.rating), tier: p.rating == null ? null : tierOf(p.rating) }));
  broadcast(room, { t: 'match', code: room.code, map: room.map, mode: room.mode, ranked: room.ranked, size: spec.size, teams: [side(0), side(1)], players: [...side(0), ...side(1)] });
  setTimeout(() => startRace(room, 3), 3500).unref();
}
function finishTeams(room) {
  room.state = 'results';
  const all = [...room.players.values()];
  for (const p of all) { // same final plausibility check as a solo race
    if (!p.dq && p.ac) {
      const bad = checkLive(p, { d: p.d, s: p.s, sp: 0 }, now());
      if (bad.includes('score') || bad.includes('dist_ahead_of_clock')) { p.dq = true; if (p.pid) strike(p.pid, 'race_final:' + bad.join('+'), { d: p.d, s: p.s }, 2); }
    }
  }
  const score = [0, 0], dist = [0, 0];
  for (const p of all) if (!p.dq) { score[p.team] += Math.floor(p.s); dist[p.team] += Math.floor(p.d); }
  const winner = score[0] === score[1] ? -1 : score[0] > score[1] ? 0 : 1;
  for (const p of all) p.place = winner === -1 || p.team === winner ? 1 : 2;
  const ranking = all.slice().sort((a, b) => a.place - b.place || b.s - a.s);
  broadcast(room, { t: 'results', teamMode: true, winner, teams: [0, 1].map((ti) => ({ team: ti, score: score[ti], dist: dist[ti] })), ranking: ranking.map((p) => ({ id: p.id, name: p.name, char: p.char, team: p.team, d: Math.floor(p.d), s: Math.floor(p.s), dq: !!p.dq })), ranked: room.ranked });
  const humans = all.filter((p) => p.pid);
  if (room.ranked && humans.length >= 2) {
    const bucket = room.size === 3 ? 'trios' : 'duos';
    const rows = new Map(humans.map((p) => [p.pid, mmr.get(p.pid, bucket)]));
    const avg = [0, 1].map((ti) => { const m = humans.filter((p) => p.team === ti); return m.reduce((s, p) => s + rows.get(p.pid).rating, 0) / Math.max(1, m.length); });
    const matchId = Number(q.addMatch.run(now(), room.map, room.mode, room.seed, 1).lastInsertRowid);
    for (const p of humans) {
      const row = rows.get(p.pid), E = 1 / (1 + 10 ** ((avg[1 - p.team] - avg[p.team]) / 400)), S = winner === -1 ? 0.5 : p.team === winner ? 1 : 0, K = mmr.kFactor(row);
      let delta = Math.round(K * (S - E) * 10) / 10;
      if (p.dq) delta = Math.min(delta, -25);
      if (p.left) delta -= 6;
      const after = Math.max(0, row.rating + delta);
      mmr.apply(p.pid, bucket, after - row.rating, S === 1 && !p.dq);
      if (!p.dq) { bumpCareer(p.pid, (c) => { c.rankedGames++; if (S === 1) c.rankedWins++; }); addXp(p.pid, 40 + (S === 1 ? 60 : 0)); }
      q.addMatchPlayer.run(matchId, p.pid, p.name, Math.floor(p.s), Math.floor(p.d), p.place, row.rating, after, p.dq ? 1 : 0);
      send(p.ws, { t: 'rating', before: Math.round(row.rating), after: Math.round(after), delta: Math.round(delta * 10) / 10, place: p.place, tier: tierOf(after), dq: !!p.dq, team: true });
    }
  } else if (!room.ranked) for (const p of humans) if (!p.dq) addXp(p.pid, 15 + (p.team === winner ? 25 : 0));
  const seen = new Set();
  for (const p of humans) { const party = social.partyOf(p.pid); if (party && !seen.has(party.id)) { seen.add(party.id); social.setPartyState(party.id, 'idle'); } }
  pushRoom(room);
  setTimeout(() => { if (room.state === 'results' && [...room.players.values()].every((p) => p.ws.readyState !== 1)) rooms.delete(room.code); }, 60000).unref();
}

// ---- websocket ------------------------------------------------------------------------------
export const wsClients = () => (wss ? [...wss.clients] : []);
export function attachWs(server) {
  startMaintenance();
  wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (!(req.url || '').startsWith('/ws')) return; // let other handlers (Next dev HMR) deal with their own upgrades
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin)) { // CORS_ORIGIN restricts which sites may open a socket (same-origin pages are always fine)
      let same = false; try { same = new URL(origin).host === req.headers.host; } catch { /* malformed Origin */ }
      if (!same) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    }
    socket.setNoDelay(true); // no Nagle batching: lowest possible latency
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  // A bug in one timer tick must never take the whole game server down: log it and carry on with the next tick.
  const guarded = (name, fn) => () => { try { fn(); } catch (e) { console.error(`[${name}]`, e && e.stack ? e.stack : e); } };
  setInterval(guarded('matchTick', matchTick), 500).unref();
  setInterval(guarded('ltmTick', ltmTick), 50).unref();
  setInterval(guarded('heartbeat', () => { for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); } for (const r of rooms.values()) checkFinish(r); }), 15000).unref();

  wss.on('connection', (ws, req) => {
    ws.ip = clientIp(req);
    ipintel.check(ws.ip).then((v) => { ws.vpn = v; if (v.block) { send(ws, { t: 'err', code: 'vpn_blocked', msg: ipintel.blockedReply(v).message }); setTimeout(() => { try { ws.close(4003, 'vpn'); } catch { /* closed */ } }, 400); } }).catch(() => {});
    ws.id = nextId++; ws.room = null; ws.player = null; ws.isAlive = true; ws.rate = { n: 0, t: now(), over: 0 };
    send(ws, { t: 'hello', id: ws.id });
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      const t = now();
      if (t - ws.rate.t > 1000) { ws.rate.t = t; ws.rate.n = 0; }
      if (t - ws.rate.t > 1000) { if (ws.rate.n <= 90) ws.rate.over = 0; }
      if (++ws.rate.n > 90) { if (ws.rate.n === 91 && ++ws.rate.over > 5) { try { ws.close(1008, 'flood'); } catch { /* closing */ } } return; } // sustained flooding: drop the connection
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      onMessage(ws, msg, t);
    });
    ws.on('close', () => { if (ws.player) untrackSocket(ws.player.id, ws); social.onClose(ws); leaveAll(ws); });
    ws.on('error', () => { if (ws.player) untrackSocket(ws.player.id, ws); social.onClose(ws); leaveAll(ws); });
  });
}

// Gold Rush: random warp from the race into the arena, then the duel loop.
function ltmTick() {
  const t = now();
  for (const room of rooms.values()) {
    if (room.ltm !== 'goldrush') continue;
    if (room.state === 'running' && !room.duel && !room.warping && room.warpAt && t >= room.warpAt) {
      const conn = [...room.players.values()].filter((p) => p.ws.readyState === 1);
      const guaranteed = !room.duelCount; // the first one happens even if somebody already crashed
      if (conn.length === 2 && (guaranteed || conn.every((p) => p.alive))) {
        room.warping = true; room.raceResumable = true;
        broadcast(room, { t: 'warp', in: 2.5 });
        setTimeout(() => { room.warping = false; if (room.state === 'running' && !room.duel) duelMod.startDuel(room, dio); }, 2500).unref();
      } else room.warpAt = conn.length < 2 ? 0 : t + 20000; // try again a little later
    }
    if (room.duel) {
      duelMod.tickDuel(room, t, dio);
      const d = room.duel; // tickDuel can end the duel by timeout; the race then RESUMES and room.duel is cleared
      if (d && d.over) { room.overAt ||= t; if (t - room.overAt > 40000) rooms.delete(room.code); }
    }
  }
}

function onMessage(ws, msg, t) {
  if (msg.t === 'ping') { send(ws, { t: 'pong', c: clamp(msg.c, 0, 1e15), s: t }); return; }
  if (ws.vpn && ws.vpn.block) return; // blocked network: nothing else is processed
  if (msg.t === 'auth') {
    const tok = verify(msg.token);
    const p = tok && q.getPlayer.get(tok.pid);
    if (!p || (p.tokver | 0) !== (tok.v | 0)) { send(ws, { t: 'err', msg: 'Invalid session' }); return; }
    const prob = accessProblem(p);
    if (prob) { send(ws, { t: 'kick', reason: prob.reason, until: prob.until || 0, banned: prob.error === 'banned' }); return; }
    if (ws.player && ws.player.id !== p.id) untrackSocket(ws.player.id, ws);
    ws.player = p; ws.char = cleanChar(msg.char);
    trackSocket(p.id, ws);
    send(ws, { t: 'authed', player: profile(p) });
    social.onAuth(ws);
    return;
  }
  if (social.onMessage(ws, msg)) return; // parties (p_*)
  const room = ws.room;
  const me = room && room.players.get(ws.id);
  switch (msg.t) {
    case 'rq': { ws.char = cleanChar(msg.char); enqueue(ws, MODES.has(msg.mode) ? msg.mode : 'classic'); break; }
    case 'dq': { ws.char = cleanChar(msg.char); enqueue(ws, 'duel'); break; }
    case 'du': if (room && room.duel) duelMod.onMove(room, ws, msg, t, dio); break;
    case 'df': if (room && room.duel) duelMod.onFire(room, ws, msg, t, dio); break;
    case 'dr': if (room && room.duel) duelMod.onReload(room, ws, t); break;
    case 'rc': dequeue(ws); send(ws, { t: 'queue_cancelled' }); break;
    case 'quick': {
      let target = [...rooms.values()].find((r) => r.pub && !r.ranked && r.state === 'lobby' && r.players.size < MAX_PLAYERS);
      if (!target) target = newRoom({ pub: true });
      if (target.players.size >= MAX_PLAYERS) { send(ws, { t: 'err', msg: 'Room is full' }); break; }
      addToRoom(ws, target, msg); pushRoom(target);
      break;
    }
    case 'create': { const r = newRoom(); addToRoom(ws, r, msg); pushRoom(r); break; }
    case 'join': {
      const r = rooms.get(String(msg.code || '').toUpperCase().slice(0, 4));
      if (!r || r.ranked) { send(ws, { t: 'err', msg: 'Room not found' }); break; }
      if (r.players.size >= MAX_PLAYERS) { send(ws, { t: 'err', msg: 'Room is full' }); break; }
      if (r.state === 'running') { send(ws, { t: 'err', msg: 'Race already started' }); break; }
      addToRoom(ws, r, msg); pushRoom(r);
      break;
    }
    case 'ready': if (me && room.state === 'lobby' && !room.ranked) { me.ready = !!msg.v; pushRoom(room); } break;
    case 'map': if (me && room.host === ws.id && room.state === 'lobby' && !room.ranked && ROOM_MAPS.has(msg.map)) { room.map = msg.map; pushRoom(room); } break;
    case 'mode': if (me && room.host === ws.id && room.state === 'lobby' && !room.ranked && MODES.has(msg.mode)) { room.mode = msg.mode; pushRoom(room); } break;
    case 'start': if (me && room.host === ws.id && room.state === 'lobby' && !room.ranked) startRace(room, 3); break;
    case 'st':
      if (me && room.state === 'running' && !room.duel && me.alive && t - me.last > 25 && t >= room.startedAt - 200) {
        me.last = t;
        const m = { d: clamp(msg.d, 0, 1e6), s: clamp(msg.s, 0, 1e9), sp: clamp(msg.sp, 0, 80), x: Number(msg.x), y: Number(msg.y) };
        if (!me.ac) me.ac = { t0: room.startedAt, lastD: 0, lastT: t, violations: 0, reasons: [] };
        const bad = checkLive(me, m, t);
        if (bad.length && me.ac.violations >= 4 && !me.dq) { // too many impossible updates: disqualify, strike with evidence, kick
          me.dq = true; me.alive = false;
          const why = [...new Set(me.ac.reasons)].join('+');
          broadcast(room, { t: 'dead', id: ws.id, d: me.d, s: me.s });
          send(ws, { t: 'err', msg: 'Disqualified: impossible telemetry' }); // before the kick closes the socket
          if (me.pid) { strike(me.pid, 'live:' + why, { d: m.d, s: m.s, x: m.x, y: m.y, n: me.ac.violations }, 2); kick(me.pid, `Impossible movement detected (${why})`, 600); }
          checkFinish(room); break;
        }
        if (bad.length) break; // drop impossible samples instead of relaying them
        me.d = m.d; me.s = m.s;
        broadcast(room, { t: 'st', id: ws.id, d: m.d, s: m.s, x: clamp(msg.x, -4, 4), y: clamp(msg.y, -1, 14), sp: m.sp, a: ANIMS.has(msg.a) ? msg.a : 'run', q: t }, ws);
      }
      break;
    case 'dead':
      if (me && room.state === 'running' && me.alive) {
        me.alive = false; me.d = Math.max(me.d, clamp(msg.d, 0, 1e6)); me.s = Math.max(me.s, clamp(msg.s, 0, 1e9));
        broadcast(room, { t: 'dead', id: ws.id, d: me.d, s: me.s });
        pushRoom(room); checkFinish(room);
      }
      break;
    case 'lobby': if (me && room.host === ws.id && room.state === 'results' && !room.ranked) { room.state = 'lobby'; for (const p of room.players.values()) { p.ready = false; p.alive = true; } pushRoom(room); } break;
    case 'leave': leaveAll(ws); break;
    default: break;
  }
}

export const stats = () => ({ ...social.stats(), teamQueue: tq.length, rooms: rooms.size, queued: queues.classic.length + queues.nocoin.length + queues.duel.length, clients: wss ? wss.clients.size : 0 });
void db;
