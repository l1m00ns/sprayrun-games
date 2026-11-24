// Shared player helpers (no dependency on the HTTP / WebSocket layers): public profile shape, strikes, kicks, bans.
import { q } from './db.mjs';
import { nowMs, levelOf, titleOf, newCareer, rankedMinSeconds, BADGES } from './catalog.mjs';

const TIERS = [[1900, 'Champion'], [1700, 'Diamond'], [1500, 'Platinum'], [1300, 'Gold'], [1100, 'Silver'], [0, 'Bronze']];
export const tierOf = (r) => TIERS.find(([min]) => r >= min)[1];

export const careerOf = (p) => { try { return { ...newCareer(), ...JSON.parse(p.career || '{}') }; } catch { return newCareer(); } };

export function profile(p, withRank = true) {
  const lv = levelOf(p.xp || 0);
  return {
    id: p.id, name: p.name, username: p.username || null, hasAccount: !!p.username,
    rating: Math.round(p.rating), tier: tierOf(p.rating), games: p.games, wins: p.wins,
    level: lv.level, xp: lv.xp, xpInto: lv.into, xpNeed: lv.need, title: titleOf(lv.level),
    ranked: { minSeconds: rankedMinSeconds(), played: Math.floor(careerOf(p).time), unlocked: careerOf(p).time >= rankedMinSeconds() },
    badges: (careerOf(p).badges || []).map((id) => ({ id, ...(BADGES[id] || { name: id }) })),
    banned: !!p.banned, kickedUntil: p.kicked_until > nowMs() ? p.kicked_until : 0, banReason: p.banned ? p.ban_reason || 'Violation of the fair-play policy' : null,
    rank: withRank && p.games > 0 && !p.banned ? q.ratingRank.get(p.rating).n + 1 : null,
  };
}

// ---- live connections per player id (filled by the WebSocket layer) so a kick can reach an open socket
export const sockets = new Map(); // pid -> Set<ws>
export function trackSocket(pid, ws) { if (!sockets.has(pid)) sockets.set(pid, new Set()); sockets.get(pid).add(ws); }
export function untrackSocket(pid, ws) { const s = sockets.get(pid); if (s) { s.delete(ws); if (!s.size) sockets.delete(pid); } }

// ---- sanctions ------------------------------------------------------------------------------------
// `evidence` is stored so a human (or the support AI on appeal) can review exactly why it happened.
export function recordEvent(pid, kind, detail, severity = 1) {
  return Number(q.addEvent.run(pid, kind, typeof detail === 'string' ? detail : JSON.stringify(detail), severity, nowMs()).lastInsertRowid);
}
export function kick(pid, reason, seconds = 600) {
  const until = nowMs() + seconds * 1000;
  q.kick.run(until, pid);
  for (const ws of sockets.get(pid) || []) {
    try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'kick', reason, until })); ws.close(4001, 'kicked'); } catch { /* already closed */ }
  }
  return until;
}
export function ban(pid, reason) {
  q.ban.run(reason, pid);
  q.bumpTokver.run(pid); // every existing session of that account stops working
  for (const ws of sockets.get(pid) || []) {
    try { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'kick', reason, banned: true })); ws.close(4002, 'banned'); } catch { /* already closed */ }
  }
}
// A strike with escalation: 2 strikes -> 10 min kick, 3 -> 1 h kick, 4+ -> ban. `kind` + `detail` are stored as evidence.
export function strike(pid, kind = 'violation', detail = '', severity = 1) {
  recordEvent(pid, kind, detail, severity);
  q.addStrike.run(pid);
  const p = q.getPlayer.get(pid);
  if (!p || p.banned) return p;
  if (p.strikes >= 4) ban(pid, `Repeated fair-play violations (${kind})`);
  else if (p.strikes === 3) kick(pid, `Fair-play violation detected (${kind})`, 3600);
  else if (p.strikes === 2) kick(pid, `Fair-play violation detected (${kind})`, 600);
  return q.getPlayer.get(pid);
}

// Is this player allowed to take part in online play right now? Returns null when fine, or a reason object.
export function accessProblem(p) {
  if (!p) return { error: 'unauthorized' };
  if (p.banned) return { error: 'banned', reason: p.ban_reason || 'Violation of the fair-play policy' };
  if (p.kicked_until > nowMs()) return { error: 'kicked', until: p.kicked_until, reason: 'Temporarily removed for a fair-play violation' };
  return null;
}
