// REST routes added in backend v2: accounts, cloud save, shop, advent, events, career/profile, updates, support, admin.
import { q } from './db.mjs';
import { reply, readJson, authPlayer, clientIp } from './http.mjs';
import { register, login, changePassword, signOutEverywhere, getCloud, putCloud, nameProblem, cleanName } from './accounts.mjs';
import { shopView, buy, equip, claimAdvent, adventView, claimEventGift, importLocal, stateOf, invOf } from './economy.mjs';
import { profile, careerOf, accessProblem, ban, kick, sockets } from './players.mjs';
import { eventStatus, allEvents, ltmStatus, nowMs, ACHIEVEMENTS, levelOf, titleOf, COSMETICS, RUNNERS, dailyInfo } from './catalog.mjs';
import { UPDATES } from './updates.mjs';
import { aiStatus } from './ai.mjs';
import * as support from './support.mjs';
import * as appeals from './appeals.mjs';
import * as devices from './devices.mjs';
import * as social from './social.mjs';
import * as messages from './messages.mjs';
import * as privacy from './privacy.mjs';
import * as tournaments from './tournaments.mjs';
import * as ipintel from './ipintel.mjs';
import { redeem } from './codes.mjs';
import { playerStats, globalStats } from './stats.mjs';
import { rankedMinSeconds, BADGES } from './catalog.mjs';

const full = (p) => ({ player: profile(p), ...stateOf(p), appeals: { open: !!appeals.list(p.id).appeals.find((a) => a.status !== 'decided'), left: appeals.list(p.id).left } });

// Returns true when the request was handled here.
export async function routeV2(req, res, url, me, route) {
  // ---------------------------------------------------------------- device fingerprint + network check
  if (route === 'POST /api/device') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 4096);
    const intel = await ipintel.check(clientIp(req), { tz: body && body.signals && body.signals.tz });
    const r = devices.recordDevice(me.id, body, intel);
    if (!r.ok) { reply(res, 400, r); return true; }
    const a = devices.assess(me.id);
    reply(res, 200, { ok: true, network: { class: intel.class, blocked: intel.block, brand: intel.brand || null }, restricted: a.restricted });
    return true;
  }
  if (route === 'GET /api/vpn') { const r = await ipintel.check(clientIp(req)); reply(res, 200, { blocked: r.block, class: r.class, brand: r.brand || null, country: r.country || null }); return true; }

  // ------------------------------------------------------------------------------- appeals / stats
  if (route === 'GET /api/appeals') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } reply(res, 200, { ...appeals.list(me.id), eligibility: appeals.eligibility(me), case: appeals.caseOf(me) }); return true; }
  if (route === 'POST /api/appeals') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 3000);
    const r = appeals.file(me, body);
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }
  {
    const am = /^\/api\/appeals\/(\d+)$/.exec(url.pathname);
    if (am && req.method === 'GET') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } const d = appeals.detail(me.id, am[1]); if (d) reply(res, 200, d); else reply(res, 404, { error: 'not_found' }); return true; }
  }
  if (route === 'GET /api/stats') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } reply(res, 200, playerStats(me.id)); return true; }
  if (route === 'GET /api/stats/global') { reply(res, 200, globalStats(0)); return true; }

  // ------------------------------------------------------------------------------------- accounts
  if (route === 'POST /api/auth/register') {
    const body = await readJson(req, 4096);
    if (body.did && devices.accountsOnDevice(body.did) >= 3 && !(me && me.username)) { reply(res, 403, { error: 'too_many_accounts', message: 'This device already has the maximum number of accounts.' }); return true; }
    const r = register({ guest: me, username: body.username, password: body.password, name: body.name, ip: clientIp(req) });
    if (!r.ok) { reply(res, r.error === 'rate_limited' ? 429 : 400, r); return true; }
    let imported = null;
    if (r.upgraded && body.local) imported = importLocal(r.player.id, body.local);
    const p = q.getPlayer.get(r.player.id);
    reply(res, 200, { ok: true, token: r.token, upgraded: r.upgraded, imported: imported && imported.ok ? imported.coins : null, ...full(p) });
    return true;
  }
  if (route === 'POST /api/auth/login') {
    const body = await readJson(req, 2048);
    const r = login({ username: body.username, password: body.password, ip: clientIp(req) });
    if (!r.ok) { reply(res, r.error === 'rate_limited' ? 429 : 401, r); return true; }
    reply(res, 200, { ok: true, token: r.token, ...full(r.player), cloud: getCloud(r.player.id) });
    return true;
  }
  if (route === 'POST /api/auth/password') {
    if (!me || !me.username) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 2048);
    const r = changePassword(me, body.old, body.new);
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }
  if (route === 'POST /api/auth/signout-all') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    reply(res, 200, { ok: true, token: signOutEverywhere(me) });
    return true;
  }

  // ---------------------------------------------------------------------------------- me / profile
  if (route === 'GET /api/me') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    reply(res, 200, { ...full(me), daily: dailyInfo(), events: { ...allEvents(), ltm: ltmStatus() }, serverTime: nowMs() });
    return true;
  }
  if (route === 'POST /api/me') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 1024);
    const name = cleanName(body.name);
    const np = nameProblem(name);
    if (np || name.length < 2) { reply(res, 400, { error: 'bad_name', message: np || 'At least 2 characters' }); return true; }
    q.rename.run(name, me.id);
    reply(res, 200, full(q.getPlayer.get(me.id)));
    return true;
  }
  if (route === 'POST /api/codes/redeem') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 600);
    const r = redeem(me.id, body.code);
    if (!r.ok) { reply(res, 400, r); return true; }
    reply(res, 200, { ...r, ...full(q.getPlayer.get(me.id)) });
    return true;
  }
  if (route === 'GET /api/career') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    reply(res, 200, careerView(me));
    return true;
  }
  if (route === 'GET /api/profile') {
    const name = String(url.searchParams.get('name') || '');
    const row = name ? q.profileByName.get(name) : null;
    if (!row) { reply(res, 404, { error: 'not_found' }); return true; }
    reply(res, 200, publicProfile(q.getPlayer.get(row.id)));
    return true;
  }

  // ---------------------------------------------------------------------------------------- shop
  if (route === 'GET /api/shop') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } reply(res, 200, { ...shopView(me), events: allEvents() }); return true; }
  if (route === 'POST /api/shop/buy') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 512);
    const r = buy(me.id, body.item);
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }
  if (route === 'POST /api/shop/equip') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 512);
    const r = equip(me.id, body.slot, body.id ?? null);
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }

  // ------------------------------------------------------------------------ events / advent / updates
  if (route === 'GET /api/events') {
    const events = allEvents();
    if (me) for (const e of Object.values(events)) e.claimed = !!q.eventClaim.get(me.id, e.id, e.year);
    reply(res, 200, { ...events, ltm: ltmStatus(), serverTime: nowMs() });
    return true;
  }
  if (route === 'POST /api/events/claim') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 256);
    const r = claimEventGift(me.id, String(body.event || ''));
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }
  if (route === 'GET /api/advent') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } reply(res, 200, { ...adventView(me.id), serverTime: nowMs() }); return true; }
  if (route === 'POST /api/advent/claim') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const body = await readJson(req, 256);
    const r = claimAdvent(me.id, body.day);
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }
  if (route === 'GET /api/updates') { reply(res, 200, { updates: UPDATES }); return true; }

  // ------------------------------------------------------------------------------------ cloud save
  if (route === 'GET /api/save') { if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; } reply(res, 200, getCloud(me.id)); return true; }
  if (route === 'PUT /api/save') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    if (!me.username) { reply(res, 403, { error: 'account_required', message: 'Create an account to enable cloud sync' }); return true; }
    const body = await readJson(req, 24000);
    const r = putCloud(me.id, body.ver, body.data);
    reply(res, r.ok ? 200 : r.error === 'conflict' ? 409 : 400, r);
    return true;
  }

  // ------------------------------------------------------------------------------------------ friends
  if (route.startsWith('GET /api/friends') || route.startsWith('POST /api/friends')) {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    if (route === 'GET /api/friends') { reply(res, 200, social.listFriends(me)); return true; }
    const body = await readJson(req, 1024);
    let r = null;
    if (route === 'POST /api/friends/request') r = social.sendRequest(me, body.name);
    else if (route === 'POST /api/friends/respond') r = social.respond(me, String(body.id || ''), !!body.accept);
    else if (route === 'POST /api/friends/remove') r = social.removeFriend(me, String(body.id || ''));
    if (r) { reply(res, r.ok ? 200 : 400, r); return true; }
  }

  // ----------------------------------------------------------------------------------------- tournaments
  if (route === 'GET /api/tournaments') { reply(res, 200, tournaments.overview(me)); return true; }
  { const tm = /^\/api\/tournaments\/([a-z0-9-]{6,24})$/.exec(url.pathname); if (tm && req.method === 'GET') { const d = tournaments.leaderboard(tm[1], me); if (d) reply(res, 200, d); else reply(res, 404, { error: 'not_found' }); return true; } }
  // ---------------------------------------------------------------------------------------- data rights
  if (route === 'GET /api/me/export' || route === 'POST /api/me/delete') {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    if (route === 'GET /api/me/export') {
      res.setHeader('Content-Disposition', 'attachment; filename="reverse-surfers-my-data.json"');
      reply(res, 200, privacy.exportData(me.id));
      return true;
    }
    const body = await readJson(req, 600);
    const r = privacy.deleteAccount(me.id, body);
    if (r.ok) { const set = sockets.get(me.id); if (set) for (const ws of [...set]) try { ws.close(4000, 'account deleted'); } catch { /* closing */ } }
    reply(res, r.ok ? 200 : 400, r);
    return true;
  }

  // ------------------------------------------------------------------------------------ private messages
  if (route.startsWith('GET /api/dm') || route.startsWith('POST /api/dm') || route.startsWith('GET /api/blocks') || route.startsWith('POST /api/block') || route.startsWith('POST /api/unblock')) {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    if (route === 'GET /api/dm') { reply(res, 200, messages.conversations(me)); return true; }
    if (route === 'GET /api/blocks') { reply(res, 200, messages.blockList(me)); return true; }
    const dm = /^\/api\/dm\/([A-Za-z0-9-]{8,64})$/.exec(url.pathname);
    if (dm && req.method === 'GET') { const r = messages.history(me, dm[1], Number(url.searchParams.get('before')) || 0); reply(res, r.ok ? 200 : 403, r); return true; }
    if (dm && req.method === 'POST') { const body = await readJson(req, 1500); const r = messages.send(me, dm[1], body.text); reply(res, r.ok ? 200 : r.error === 'rate' ? 429 : 400, r); return true; }
    if (route === 'POST /api/dm/read') { const body = await readJson(req, 300); reply(res, 200, messages.markRead(me, String(body.id || ''))); return true; }
    if (route === 'POST /api/dm/report') { const body = await readJson(req, 600); const r = messages.report(me, String(body.id || ''), body.msg, body.reason); reply(res, r.ok ? 200 : 400, r); return true; }
    if (route === 'POST /api/block') { const body = await readJson(req, 300); const r = messages.block(me, String(body.id || '')); reply(res, r.ok ? 200 : 400, r); return true; }
    if (route === 'POST /api/unblock') { const body = await readJson(req, 300); reply(res, 200, messages.unblock(me, String(body.id || ''))); return true; }
  }

  // ---------------------------------------------------------------------------------------- support
  if (route.startsWith('GET /api/support') || route.startsWith('POST /api/support')) {
    if (!me) { reply(res, 401, { error: 'unauthorized' }); return true; }
    const path = url.pathname;
    if (route === 'GET /api/support/status') { const a = aiStatus(); reply(res, 200, { ai: a.live, panel: a.panel }); return true; }
    if (route === 'GET /api/support/tickets') { reply(res, 200, { tickets: support.listTickets(me) }); return true; }
    if (route === 'POST /api/support/tickets') {
      const body = await readJson(req, 4096);
      const r = await support.openTicket(me, body);
      reply(res, r.ok ? 200 : 400, r);
      return true;
    }
    let m;
    if ((m = /^\/api\/support\/tickets\/(\d+)$/.exec(path)) && req.method === 'GET') {
      const t = support.getTicket(me, m[1]);
      if (!t) reply(res, 404, { error: 'not_found' }); else reply(res, 200, t);
      return true;
    }
    if ((m = /^\/api\/support\/tickets\/(\d+)\/(messages|close|escalate)$/.exec(path)) && req.method === 'POST') {
      let r;
      if (m[2] === 'messages') r = await support.sendMessage(me, m[1], (await readJson(req, 4096)).text);
      else if (m[2] === 'close') r = support.closeTicket(me, m[1]);
      else r = support.escalateTicket(me, m[1]);
      reply(res, r.ok ? 200 : 400, r);
      return true;
    }
  }

  // ------------------------------------------------------------------------------- admin (humans)
  if (url.pathname.startsWith('/api/admin/')) {
    if (!support.adminOk(req)) { reply(res, 403, { error: 'forbidden' }); return true; }
    if (route === 'GET /api/admin/ai') { reply(res, 200, aiStatus()); return true; }
    if (route === 'GET /api/admin/appeals') { reply(res, 200, { appeals: appeals.queue() }); return true; }
    if (route === 'POST /api/admin/appeals/decide') { const b = await readJson(req, 2000); const r = appeals.humanDecide(b.id, b.decision, b.note); reply(res, r.ok ? 200 : 400, r); return true; }
    if (route === 'GET /api/admin/links') { const row = q.profileByName.get(String(url.searchParams.get('name') || '')); if (!row) { reply(res, 404, { error: 'not_found' }); return true; } reply(res, 200, { links: devices.links(row.id) }); return true; }
    if (route === 'GET /api/admin/vpn') { reply(res, 200, ipintel.intelStatus()); return true; }
    if (route === 'POST /api/admin/vpn/allow') { const b = await readJson(req, 500); ipintel.allowIp(String(b.ip || ''), String(b.note || '')); reply(res, 200, { ok: true }); return true; }
    if (route === 'GET /api/admin/queue') { reply(res, 200, { tickets: support.adminQueue() }); return true; }
    if (route === 'GET /api/admin/player') {
      const row = q.profileByName.get(String(url.searchParams.get('name') || ''));
      if (!row) { reply(res, 404, { error: 'not_found' }); return true; }
      const p = q.getPlayer.get(row.id);
      reply(res, 200, { player: profile(p), strikes: p.strikes, events: q.events.all(p.id, 30), flaggedRuns: q.flaggedRuns.all(p.id, 10), purchases: q.recentPurchases.all(p.id, 20) });
      return true;
    }
    const body = req.method === 'POST' ? await readJson(req, 4096) : {};
    if (route === 'POST /api/admin/reply') { reply(res, 200, support.adminReply(body.ticket, body.text, !!body.resolve)); return true; }
    if (route === 'POST /api/admin/unban') { q.unban.run(String(body.pid)); reply(res, 200, { ok: true }); return true; }
    if (route === 'POST /api/admin/ban') { ban(String(body.pid), 'Moderator: ' + String(body.reason || 'Fair-play violation').slice(0, 110)); reply(res, 200, { ok: true }); return true; }
    if (route === 'POST /api/admin/kick') { kick(String(body.pid), String(body.reason || 'Removed by a moderator').slice(0, 120), Math.min(86400, Number(body.seconds) || 600)); reply(res, 200, { ok: true }); return true; }
  }
  return false;
}

// ----------------------------------------------------------------------------------- views
function careerView(p) {
  const c = careerOf(p);
  const lv = levelOf(p.xp);
  return {
    player: profile(p), career: c, level: lv, title: titleOf(lv.level),
    achievements: ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, desc: a.desc, reward: a.reward, done: c.ach.includes(a.id) })),
    recentRuns: q.recentRuns.all(p.id, 12).map((r) => ({ mode: r.mode, map: r.map, score: r.score, dist: r.dist, coins: r.coins, time: r.time, at: r.created, flagged: r.flagged === 1, revived: r.flagged === 2 })),
    matches: q.recentMatches.all(p.id, 12).map((m) => ({ at: m.created, map: m.map, mode: m.mode, score: m.score, place: m.place, players: m.players, before: Math.round(m.before), after: Math.round(m.after), dq: !!m.dq })),
    equipped: invOf(p).equip, badges: (c.badges || []).map((id) => ({ id, ...(BADGES[id] || { name: id }) })), ranked: { minSeconds: rankedMinSeconds(), played: Math.floor(c.time) },
  };
}
function publicProfile(p) {
  const c = careerOf(p);
  const lv = levelOf(p.xp);
  return {
    name: p.name, since: p.created, level: lv.level, title: titleOf(lv.level), rating: Math.round(p.rating), tier: profile(p, false).tier, games: p.games, wins: p.wins, premium: !!p.premium,
    stats: { runs: c.runs, dist: c.dist, bestScore: c.bestScore, bestDist: c.bestDist, rankedWins: c.rankedWins, duelWins: c.duelWins, achievements: c.ach.length },
    equipped: invOf(p).equip, badges: (c.badges || []).map((id) => ({ id, ...(BADGES[id] || { name: id }) })),
  };
}
void accessProblem; void COSMETICS; void RUNNERS;
