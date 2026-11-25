// Private messages between friends, blocking and reporting.
//  - only friends can write to each other; a block removes the friendship and silences the other side everywhere (messages,
//    friend requests, party invitations)
//  - 1-300 characters, control characters stripped, a light word filter, rate limits and duplicate suppression
//  - messages are pushed live over the WebSocket and stored (90 days); unread counters per conversation
//  - every message can be reported: the report keeps the message and the 5 before it as context for a moderator
import { db, q } from './db.mjs';
import { sockets } from './players.mjs';
import { isFriend, removeFriend, isBlocked } from './social.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS dms (id INTEGER PRIMARY KEY AUTOINCREMENT, a TEXT NOT NULL, b TEXT NOT NULL, from_id TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL, read_at INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS dms_pair ON dms (a, b, id);
CREATE INDEX IF NOT EXISTS dms_unread ON dms (b, read_at);
CREATE TABLE IF NOT EXISTS dm_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT NOT NULL, target TEXT NOT NULL, msg_id INTEGER, reason TEXT, context TEXT, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open');
`);
const st = {
  add: db.prepare('INSERT INTO dms (a, b, from_id, text, created) VALUES (?, ?, ?, ?, ?)'),
  page: db.prepare('SELECT id, from_id, text, created, read_at FROM dms WHERE a = ? AND b = ? AND id < ? ORDER BY id DESC LIMIT ?'),
  markRead: db.prepare('UPDATE dms SET read_at = ? WHERE a = ? AND b = ? AND from_id != ? AND read_at = 0'),
  convs: db.prepare('SELECT a, b, MAX(id) AS last FROM dms WHERE a = ? OR b = ? GROUP BY a, b ORDER BY last DESC LIMIT 60'),
  one: db.prepare('SELECT * FROM dms WHERE id = ?'),
  unread: db.prepare('SELECT COUNT(*) AS n FROM dms WHERE a = ? AND b = ? AND from_id != ? AND read_at = 0'),
  unreadAll: db.prepare('SELECT COUNT(*) AS n FROM dms WHERE (a = ? OR b = ?) AND from_id != ? AND read_at = 0'),
  lastBy: db.prepare('SELECT text, created FROM dms WHERE from_id = ? ORDER BY id DESC LIMIT 1'),
  countSince: db.prepare('SELECT COUNT(*) AS n FROM dms WHERE from_id = ? AND created > ?'),
  block: db.prepare('INSERT OR IGNORE INTO blocks (a, b, created) VALUES (?, ?, ?)'),
  unblock: db.prepare('DELETE FROM blocks WHERE a = ? AND b = ?'),
  blocks: db.prepare('SELECT b AS pid, created FROM blocks WHERE a = ? ORDER BY created DESC'),
  report: db.prepare('INSERT INTO dm_reports (reporter, target, msg_id, reason, context, created) VALUES (?, ?, ?, ?, ?, ?)'),
  reports: db.prepare('SELECT COUNT(*) AS n FROM dm_reports WHERE reporter = ? AND created > ?'),
  purge: db.prepare('DELETE FROM dms WHERE created < ?'),
};
const now = () => Date.now();
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

// ---- text hygiene
const BAD = /\b(f+u+c+k+\w*|sh[i1]+t+\w*|b[i1]tch\w*|n[i1]gg\w+|f[a4]gg?[o0]t\w*|c[u]nt\w*|retard\w*|kys)\b/gi;
export function cleanText(s) {
  let t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
  t = t.replace(BAD, (m) => '*'.repeat(Math.min(m.length, 6)));
  return t;
}

// ---- sending
const recent = new Map(); // pid -> [timestamps] (burst limiter)
export function send(me, toId, text) {
  const body = cleanText(text);
  if (!body) return { ok: false, error: 'empty', message: 'Write something first' };
  if (toId === me.id) return { ok: false, error: 'self', message: 'You cannot message yourself' };
  const target = q.getPlayer.get(toId);
  if (!target || target.banned) return { ok: false, error: 'not_found', message: 'Player not found' };
  if (isBlocked(me.id, toId)) return { ok: false, error: 'blocked', message: 'You cannot message this player' };
  if (!isFriend(me.id, toId)) return { ok: false, error: 'not_friends', message: 'You can only message friends' };
  if (me.banned) return { ok: false, error: 'banned', message: 'Messaging is disabled for this account' };
  const t = now(), a = (recent.get(me.id) || []).filter((x) => t - x < 10000);
  if (a.length >= 6) return { ok: false, error: 'rate', message: 'Slow down a little' };
  if (st.countSince.get(me.id, t - 3600e3).n >= 200) return { ok: false, error: 'rate', message: 'Message limit reached, try again later' };
  const last = st.lastBy.get(me.id);
  if (last && last.text === body && t - last.created < 30000) return { ok: false, error: 'duplicate', message: 'You just sent that' };
  a.push(t); recent.set(me.id, a);
  const [x, y] = pair(me.id, toId);
  const id = Number(st.add.run(x, y, me.id, body, t).lastInsertRowid);
  const msg = { id, from: me.id, text: body, at: t };
  const push = { t: 'dm', id, from: { id: me.id, name: me.name }, to: toId, text: body, at: t };
  for (const set of [sockets.get(toId), sockets.get(me.id)]) if (set) for (const ws of set) if (ws.readyState === 1) ws.send(JSON.stringify(push));
  return { ok: true, message: msg };
}

// ---- reading
export function conversations(me) {
  const out = [];
  for (const r of st.convs.all(me.id, me.id)) {
    const other = r.a === me.id ? r.b : r.a;
    if (isBlocked(me.id, other)) continue;
    const p = q.getPlayer.get(other);
    if (!p) continue;
    const m = st.one.get(r.last);
    out.push({ with: { id: p.id, name: p.name, online: sockets.has(p.id) }, last: { text: m.text, at: m.created, mine: m.from_id === me.id }, unread: st.unread.get(r.a, r.b, me.id).n, friend: isFriend(me.id, other) });
  }
  return { conversations: out, unread: st.unreadAll.get(me.id, me.id, me.id).n };
}
export function history(me, withId, before) {
  if (isBlocked(me.id, withId)) return { ok: false, error: 'blocked' };
  const [x, y] = pair(me.id, withId);
  const rows = st.page.all(x, y, before > 0 ? Number(before) : 9e15, 50).reverse();
  st.markRead.run(now(), x, y, me.id);
  return { ok: true, messages: rows.map((r) => ({ id: r.id, from: r.from_id, text: r.text, at: r.created })), more: rows.length === 50 };
}
export function markRead(me, withId) { const [x, y] = pair(me.id, withId); st.markRead.run(now(), x, y, me.id); return { ok: true }; }

// ---- blocking / reporting
export function block(me, id) {
  if (id === me.id || !q.getPlayer.get(id)) return { ok: false, error: 'not_found' };
  st.block.run(me.id, id, now());
  removeFriend(me, id); // blocking ends the friendship and any pending request
  return { ok: true };
}
export const unblock = (me, id) => { st.unblock.run(me.id, id); return { ok: true }; };
export function blockList(me) { return { blocks: st.blocks.all(me.id).map((r) => { const p = q.getPlayer.get(r.pid); return p ? { id: p.id, name: p.name } : null; }).filter(Boolean) }; }
export function report(me, targetId, msgId, reason) {
  if (st.reports.get(me.id, now() - 86400e3).n >= 10) return { ok: false, error: 'rate', message: 'Too many reports today' };
  const target = q.getPlayer.get(targetId);
  if (!target) return { ok: false, error: 'not_found' };
  const [x, y] = pair(me.id, targetId);
  const ctx = st.page.all(x, y, Number(msgId) > 0 ? Number(msgId) + 1 : 9e15, 6).reverse().map((r) => ({ from: r.from_id, text: r.text, at: r.created }));
  st.report.run(me.id, targetId, Number(msgId) || null, String(reason || '').slice(0, 200), JSON.stringify(ctx), now());
  return { ok: true };
}
export const purgeOld = () => st.purge.run(now() - 90 * 86400e3);
export function deleteAllFor(pid) { db.prepare('DELETE FROM dms WHERE a = ? OR b = ?').run(pid, pid); db.prepare('DELETE FROM blocks WHERE a = ? OR b = ?').run(pid, pid); }
export function exportFor(pid) {
  return {
    messages: db.prepare('SELECT from_id, text, created FROM dms WHERE a = ? OR b = ? ORDER BY id').all(pid, pid),
    blocks: db.prepare('SELECT b AS blocked, created FROM blocks WHERE a = ?').all(pid),
  };
}
const t0 = setInterval(() => { try { purgeOld(); } catch { /* db closing */ } }, 6 * 3600e3); t0.unref();
