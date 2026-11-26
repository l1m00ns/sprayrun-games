// Social layer: friends (persistent, REST) and parties (in-memory, WebSocket).
//
//  friends  - request by username or by friend code (guests have a code too), accept / decline / remove, live presence.
//  parties  - up to 3 players. The leader picks the mode (Normal / Ranked, Solo / Duos / Trios) and presses PLAY; the whole
//             party then queues as ONE group and always lands on the same team. Invitations are for friends only.
// core.mjs owns the sockets, queues and rooms and gives us the few hooks we need through init().
import crypto from 'node:crypto';
import { db, q } from './db.mjs';
import { sockets } from './players.mjs';
import { tierOf } from './players.mjs';
import { collusionSet } from './devices.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS friends (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (a, b));
CREATE INDEX IF NOT EXISTS friends_b ON friends (b);
CREATE TABLE IF NOT EXISTS friend_codes (code TEXT PRIMARY KEY, pid TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS blocks (a TEXT NOT NULL, b TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (a, b));
`);
const st = {
  codeOf: db.prepare('SELECT code FROM friend_codes WHERE pid = ?'),
  byCode: db.prepare('SELECT pid FROM friend_codes WHERE code = ?'),
  addCode: db.prepare('INSERT INTO friend_codes (code, pid) VALUES (?, ?)'),
  byUsername: db.prepare('SELECT * FROM players WHERE lower(username) = lower(?) LIMIT 1'),
  rel: db.prepare('SELECT * FROM friends WHERE a = ? AND b = ?'),
  add: db.prepare('INSERT OR REPLACE INTO friends (a, b, status, created) VALUES (?, ?, ?, ?)'),
  setStatus: db.prepare('UPDATE friends SET status = ? WHERE a = ? AND b = ?'),
  del: db.prepare('DELETE FROM friends WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)'),
  friends: db.prepare("SELECT b AS pid FROM friends WHERE a = ? AND status = 'accepted'"),
  incoming: db.prepare("SELECT a AS pid, created FROM friends WHERE b = ? AND status = 'pending' ORDER BY created DESC"),
  outgoing: db.prepare("SELECT b AS pid, created FROM friends WHERE a = ? AND status = 'pending' ORDER BY created DESC"),
  countFriends: db.prepare("SELECT COUNT(*) AS n FROM friends WHERE a = ? AND status = 'accepted'"),
  countOut: db.prepare("SELECT COUNT(*) AS n FROM friends WHERE a = ? AND status = 'pending'"),
};
const MAX_FRIENDS = 100, MAX_PENDING = 30;
const blockedQ = db.prepare('SELECT 1 FROM blocks WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)');
export const isBlocked = (x, y) => !!blockedQ.get(x, y, y, x); // a block works in both directions for requests, invitations and messages
const now = () => Date.now();
let hooks = { send: (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, enqueueGroup: () => ({ ok: false }), dequeueGroup: () => {}, inMatch: () => false };
export function init(h) { hooks = { ...hooks, ...h }; }
const send = (ws, o) => hooks.send(ws, o);

// ------------------------------------------------------------------------------------------------ friends
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function friendCode(pid) {
  const have = st.codeOf.get(pid);
  if (have) return have.code;
  for (let i = 0; i < 20; i++) {
    let c = ''; const b = crypto.randomBytes(6);
    for (let k = 0; k < 6; k++) c += CODE_ALPHA[b[k] % CODE_ALPHA.length];
    try { st.addCode.run(c, pid); return c; } catch { /* collision: try another */ }
  }
  return '------';
}
function findTarget(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^[A-Za-z2-9]{6}$/.test(s)) { const r = st.byCode.get(s.toUpperCase()); if (r) return q.getPlayer.get(r.pid); }
  return st.byUsername.get(s) || null;
}
const reqLog = new Map(); // pid -> timestamps of recent requests (anti-spam)
function spam(pid) {
  const t = now(), a = (reqLog.get(pid) || []).filter((x) => t - x < 3600e3);
  if (a.length >= 20) return true;
  a.push(t); reqLog.set(pid, a); return false;
}
const areFriends = (a, b) => { const r = st.rel.get(a, b); return !!(r && r.status === 'accepted'); };
export const isFriend = areFriends;

export function sendRequest(me, text) {
  const target = findTarget(text);
  if (!target) return { ok: false, error: 'not_found', message: 'No player with that username or friend code' };
  if (target.id === me.id) return { ok: false, error: 'self', message: 'That is you' };
  if (target.banned) return { ok: false, error: 'not_found', message: 'No player with that username or friend code' };
  if (isBlocked(me.id, target.id)) return { ok: false, error: 'not_found', message: 'No player with that username or friend code' };
  if (areFriends(me.id, target.id)) return { ok: false, error: 'already', message: 'Already friends' };
  const back = st.rel.get(target.id, me.id);
  if (back && back.status === 'pending') return respond(me, target.id, true); // they already asked you: that is a yes
  if (st.rel.get(me.id, target.id)) return { ok: false, error: 'pending', message: 'Request already sent' };
  if (spam(me.id)) return { ok: false, error: 'rate', message: 'Too many requests, try again later' };
  if (st.countOut.get(me.id).n >= MAX_PENDING) return { ok: false, error: 'limit', message: 'Too many pending requests' };
  if (st.countFriends.get(me.id).n >= MAX_FRIENDS) return { ok: false, error: 'limit', message: 'Friend list is full' };
  st.add.run(me.id, target.id, 'pending', now());
  pushToPlayer(target.id, { t: 'friend_req', from: { id: me.id, name: me.name } });
  return { ok: true, status: 'sent', name: target.name };
}
export function respond(me, fromId, accept) {
  const r = st.rel.get(fromId, me.id);
  if (!r || r.status !== 'pending') return { ok: false, error: 'not_found', message: 'No such request' };
  if (!accept) { st.del.run(fromId, me.id, me.id, fromId); return { ok: true, status: 'declined' }; }
  if (st.countFriends.get(me.id).n >= MAX_FRIENDS) return { ok: false, error: 'limit', message: 'Friend list is full' };
  st.setStatus.run('accepted', fromId, me.id);
  st.add.run(me.id, fromId, 'accepted', now());
  pushToPlayer(fromId, { t: 'friend_ok', who: { id: me.id, name: me.name } });
  return { ok: true, status: 'accepted' };
}
export function removeFriend(me, id) { st.del.run(me.id, id, id, me.id); return { ok: true }; }

function presenceOf(pid) {
  if (!sockets.has(pid)) return 'offline';
  const party = partyByPid.get(pid);
  if (hooks.inMatch(pid)) return 'match';
  if (party && party.state === 'queued') return 'queue';
  return 'lobby';
}
export function listFriends(me) {
  const card = (pid, extra = {}) => {
    const p = q.getPlayer.get(pid);
    if (!p) return null;
    const party = partyByPid.get(pid);
    return { id: p.id, name: p.name, premium: !!p.premium, rating: Math.round(p.rating), tier: tierOf(p.rating), presence: presenceOf(pid), partySize: party ? party.members.size : 0, joinable: !!party && party.members.size < PARTY_MAX && party.state === 'idle', ...extra };
  };
  const friends = st.friends.all(me.id).map((r) => card(r.pid)).filter(Boolean)
    .sort((a, b) => (a.presence === 'offline') - (b.presence === 'offline') || a.name.localeCompare(b.name));
  return {
    code: friendCode(me.id), friends,
    incoming: st.incoming.all(me.id).map((r) => card(r.pid, { at: r.created })).filter(Boolean),
    outgoing: st.outgoing.all(me.id).map((r) => card(r.pid, { at: r.created })).filter(Boolean),
  };
}
function pushToPlayer(pid, obj) { const set = sockets.get(pid); if (set) for (const ws of set) send(ws, obj); }
// Tell a player's friends that they came online / went offline.
export function notifyPresence(pid) {
  const state = presenceOf(pid);
  for (const r of st.friends.all(pid)) pushToPlayer(r.pid, { t: 'friend_presence', id: pid, presence: state });
}

// ------------------------------------------------------------------------------------------------ parties
export const PARTY_MAX = 3;
const parties = new Map(), partyByPid = new Map();
const invites = new Map(); // pid -> Map(partyId -> { from, at })
const codeGen = () => { for (;;) { let c = ''; for (let i = 0; i < 5; i++) c += CODE_ALPHA[crypto.randomInt(CODE_ALPHA.length)]; if (!parties.has(c)) return c; } };
export const partyOf = (pid) => partyByPid.get(pid) || null;

// What the leader may pick. kind: normal | ranked. size: 1 solo, 2 duos, 3 trios. mode: classic | nocoin.
export function cleanSpec(s) {
  const kind = s && s.kind === 'ranked' ? 'ranked' : 'normal';
  const size = [1, 2, 3].includes(Number(s && s.size)) ? Number(s.size) : 1;
  const mode = s && s.mode === 'nocoin' ? 'nocoin' : 'classic';
  return { kind, size, mode };
}
function view(party) {
  return {
    t: 'party', id: party.id, leader: party.leader, state: party.state, spec: party.spec, max: PARTY_MAX,
    members: [...party.members.values()].map((m) => { const p = q.getPlayer.get(m.pid); return { id: m.pid, name: m.name, char: m.char, premium: !!(p && p.premium), rating: p ? Math.round(p.rating) : 1000, tier: p ? tierOf(p.rating) : 'Bronze', online: m.ws.readyState === 1 }; }),
  };
}
export function pushParty(party) { const v = view(party); for (const m of party.members.values()) send(m.ws, v); }
function createParty(ws) {
  const p = ws.player;
  const party = { id: codeGen(), leader: p.id, members: new Map(), spec: { kind: 'normal', size: 3, mode: 'classic' }, state: 'idle', created: now() };
  party.members.set(p.id, { pid: p.id, name: p.name, char: ws.char || 'kit', ws });
  parties.set(party.id, party); partyByPid.set(p.id, party);
  return party;
}
function dropParty(party, reason = 'disbanded') {
  hooks.dequeueGroup(party.id, [...party.members.values()].map((m) => m.ws));
  for (const m of party.members.values()) { partyByPid.delete(m.pid); send(m.ws, { t: 'party_gone', reason }); }
  parties.delete(party.id);
}
export function leaveParty(ws, reason = 'left') {
  const p = ws.player; if (!p) return;
  const party = partyByPid.get(p.id);
  if (!party) return;
  const m = party.members.get(p.id);
  if (m && m.ws !== ws) return; // another tab of the same player: leave only through the socket the party is bound to
  hooks.dequeueGroup(party.id, [...party.members.values()].map((m) => m.ws));
  party.members.delete(p.id); partyByPid.delete(p.id);
  send(ws, { t: 'party_gone', reason });
  if (party.members.size === 0) { parties.delete(party.id); return; }
  if (party.leader === p.id) party.leader = [...party.members.keys()][0]; // the next member takes over
  party.state = party.state === 'queued' ? 'idle' : party.state;
  for (const o of party.members.values()) send(o.ws, { t: 'party_note', msg: `${p.name} left the party` });
  pushParty(party);
  notifyPresence(p.id);
}
export function setPartyState(partyId, state) { const party = parties.get(partyId); if (party) { party.state = state; pushParty(party); for (const m of party.members.values()) notifyPresence(m.pid); } }
export function onClose(ws) { if (ws.player) { leaveParty(ws, 'disconnected'); if (!sockets.has(ws.player.id)) notifyPresence(ws.player.id); } }
export function onAuth(ws) {
  notifyPresence(ws.player.id);
  const mine = invites.get(ws.player.id);
  if (mine) for (const [id, inv] of mine) if (parties.has(id) && now() - inv.at < 300e3) send(ws, { t: 'party_invite', id, from: inv.from, at: inv.at });
}

// WebSocket messages starting with "p_". Returns true when handled.
export function onMessage(ws, msg) {
  if (!String(msg.t).startsWith('p_')) return false;
  const me = ws.player;
  if (!me) { send(ws, { t: 'err', msg: 'Sign in first' }); return true; }
  if (me.banned) return true;
  let party = partyByPid.get(me.id);
  const err = (m) => send(ws, { t: 'party_err', msg: m });
  switch (msg.t) {
    case 'p_create': { if (hooks.inMatch(me.id)) { err('You are in a match'); break; } if (!party) party = createParty(ws); pushParty(party); break; }
    case 'p_invite': {
      if (hooks.inMatch(me.id)) { err('You are in a match'); break; }
      if (!party) party = createParty(ws);
      if (party.leader !== me.id) { err('Only the party leader can invite'); break; }
      const id = String(msg.id || '');
      if (!areFriends(me.id, id) || isBlocked(me.id, id)) { err('You can only invite friends'); break; }
      if (party.members.size >= PARTY_MAX) { err('The party is full'); break; }
      if (partyByPid.has(id)) { err('That player is already in a party'); break; }
      if (!sockets.has(id)) { err('That player is offline'); break; }
      const inv = invites.get(id) || new Map(); inv.set(party.id, { from: { id: me.id, name: me.name }, at: now() }); invites.set(id, inv);
      pushToPlayer(id, { t: 'party_invite', id: party.id, from: { id: me.id, name: me.name }, at: now() });
      send(ws, { t: 'party_note', msg: 'Invitation sent' });
      pushParty(party);
      break;
    }
    case 'p_join': {
      const target = parties.get(String(msg.id || '').toUpperCase());
      if (!target) { err('That party no longer exists'); break; }
      if (party) { err('Leave your party first'); break; }
      if (hooks.inMatch(me.id)) { err('You are in a match'); break; }
      const invited = invites.get(me.id) && invites.get(me.id).has(target.id);
      const leaderFriend = areFriends(me.id, target.leader);
      if (!invited && !leaderFriend) { err('You need an invitation'); break; }
      if (target.members.size >= PARTY_MAX) { err('The party is full'); break; }
      if (target.state !== 'idle') { err('The party is busy'); break; }
      target.members.set(me.id, { pid: me.id, name: me.name, char: ws.char || 'kit', ws }); partyByPid.set(me.id, target);
      const inv = invites.get(me.id); if (inv) { inv.delete(target.id); if (!inv.size) invites.delete(me.id); }
      for (const o of target.members.values()) if (o.pid !== me.id) send(o.ws, { t: 'party_note', msg: `${me.name} joined the party` });
      pushParty(target); notifyPresence(me.id);
      break;
    }
    case 'p_decline': { const inv = invites.get(me.id); if (inv) inv.delete(String(msg.id || '').toUpperCase()); break; }
    case 'p_leave': leaveParty(ws); break;
    case 'p_kick': {
      if (!party || party.leader !== me.id) { err('Only the leader can remove players'); break; }
      const m = party.members.get(String(msg.id || ''));
      if (!m || m.pid === me.id) break;
      hooks.dequeueGroup(party.id, [...party.members.values()].map((m) => m.ws));
      party.members.delete(m.pid); partyByPid.delete(m.pid); party.state = 'idle';
      send(m.ws, { t: 'party_gone', reason: 'kicked' });
      pushParty(party); notifyPresence(m.pid);
      break;
    }
    case 'p_char': if (party) { const m = party.members.get(me.id); if (m && /^[a-z]{2,8}$/.test(String(msg.char || ''))) { m.char = msg.char; ws.char = msg.char; pushParty(party); } } break;
    case 'p_spec': {
      if (!party) party = createParty(ws);
      if (party.leader !== me.id) { err('Only the party leader can change the mode'); break; }
      if (party.state !== 'idle') { err('Cancel the search first'); break; }
      party.spec = cleanSpec(msg.spec);
      pushParty(party);
      break;
    }
    case 'p_play': {
      if (!party) party = createParty(ws);
      if (party.leader !== me.id) { err('Only the party leader can start'); break; }
      if (party.state !== 'idle') break;
      const spec = party.spec;
      if (party.members.size > spec.size) { err(`Too many players for ${['', 'Solo', 'Duos', 'Trios'][spec.size]}`); break; }
      for (const m of party.members.values()) { if (m.ws.readyState !== 1) { err(`${m.name} is offline`); return true; } }
      if (spec.kind === 'ranked') { // linked accounts (same device) may never play together in ranked
        const ids = [...party.members.keys()];
        for (const a of ids) { const l = collusionSet(a); if (ids.some((b) => b !== a && l.has(b))) { err('Linked accounts cannot queue together in ranked'); return true; } }
      }
      const r = hooks.enqueueGroup([...party.members.values()].map((m) => m.ws), spec, party.id);
      if (!r.ok) { err(r.msg || 'Cannot queue right now'); break; }
      party.state = 'queued'; pushParty(party); notifyPresence(me.id);
      break;
    }
    case 'p_cancel': {
      if (!party) break;
      if (party.leader !== me.id) { err('Only the party leader can cancel'); break; }
      hooks.dequeueGroup(party.id, [...party.members.values()].map((m) => m.ws)); party.state = 'idle'; pushParty(party);
      break;
    }
    default: return false;
  }
  return true;
}

export const stats = () => ({ parties: parties.size });
