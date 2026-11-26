// Automatic tournaments (score attack): nobody has to sign up, every valid Classic run played inside the window counts, the best one
// is your score. The schedule is computed from the UTC clock, so there is nothing to create or forget:
//   Daily Sprint  every day 17:00 - 19:00 UTC
//   Weekly Cup    Saturday 16:00 UTC -> Sunday 22:00 UTC
// When a window closes the server settles it once (idempotent): coins for the top 10 and exclusive cosmetics that cannot be bought.
import { db, q } from './db.mjs';
import { nowMs } from './catalog.mjs';
import { grantCosmetics } from './economy.mjs';
import { tierOf } from './players.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS tournament_done (tid TEXT PRIMARY KEY, settled INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tournament_rewards (tid TEXT NOT NULL, pid TEXT NOT NULL, rank INTEGER NOT NULL, score INTEGER NOT NULL, coins INTEGER NOT NULL DEFAULT 0, items TEXT NOT NULL DEFAULT '[]', seen INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tid, pid));
`);
const st = {
  board: db.prepare("SELECT pid, MAX(score) AS score, MAX(dist) AS dist FROM runs WHERE mode = 'classic' AND flagged = 0 AND daily = 0 AND created >= ? AND created < ? GROUP BY pid ORDER BY score DESC, MIN(created) ASC LIMIT ?"),
  mine: db.prepare("SELECT MAX(score) AS score FROM runs WHERE mode = 'classic' AND flagged = 0 AND daily = 0 AND created >= ? AND created < ? AND pid = ?"),
  above: db.prepare("SELECT COUNT(*) AS n FROM (SELECT pid, MAX(score) AS s FROM runs WHERE mode = 'classic' AND flagged = 0 AND daily = 0 AND created >= ? AND created < ? GROUP BY pid) WHERE s > ?"),
  entrants: db.prepare("SELECT COUNT(DISTINCT pid) AS n FROM runs WHERE mode = 'classic' AND flagged = 0 AND daily = 0 AND created >= ? AND created < ?"),
  done: db.prepare('SELECT 1 FROM tournament_done WHERE tid = ?'),
  markDone: db.prepare('INSERT OR IGNORE INTO tournament_done (tid, settled) VALUES (?, ?)'),
  reward: db.prepare('INSERT OR IGNORE INTO tournament_rewards (tid, pid, rank, score, coins, items) VALUES (?, ?, ?, ?, ?, ?)'),
  unseen: db.prepare('SELECT * FROM tournament_rewards WHERE pid = ? AND seen = 0'),
  seen: db.prepare('UPDATE tournament_rewards SET seen = 1 WHERE pid = ? AND tid = ?'),
  anyPlayer: db.prepare('SELECT id, wallet FROM players WHERE id = ?'),
};
const H = 3600e3, D = 24 * H;
const day0 = (t) => Math.floor(t / D) * D;
const isoWeek = (t) => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const y = d.getUTCFullYear(); return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / D + 1) / 7)).padStart(2, '0')}`; };

export const KINDS = {
  daily: { name: 'Daily Sprint', blurb: 'Best Classic run between 17:00 and 19:00 UTC.', rewards: [{ rank: 1, cos: ['au_dawn'], coins: 600 }, { rank: 2, coins: 300 }, { rank: 3, coins: 200 }, { rank: 10, coins: 100 }] },
  weekly: { name: 'Weekly Cup', blurb: 'Best Classic run from Saturday 16:00 to Sunday 22:00 UTC.', rewards: [{ rank: 1, cos: ['bg_cup', 'au_royal', 'sk_crown'], coins: 3000 }, { rank: 3, cos: ['au_royal'], coins: 1500 }, { rank: 10, coins: 500 }] },
};
// The windows around "now": the one running, the next one, and the last finished one of each kind.
export function windows(t = nowMs()) {
  const out = [];
  for (let i = -1; i <= 1; i++) { const s = day0(t) + i * D + 17 * H; out.push({ kind: 'daily', id: `daily-${new Date(s).toISOString().slice(0, 10)}`, start: s, end: s + 2 * H }); }
  const dow = new Date(t).getUTCDay(), toSat = (6 - dow + 7) % 7; // days until Saturday
  const sat = day0(t) + toSat * D + 16 * H;
  for (const s of [sat - 7 * D, sat, sat + 7 * D]) out.push({ kind: 'weekly', id: `weekly-${isoWeek(s)}`, start: s, end: s + 30 * H });
  return out.map((w) => ({ ...w, state: t < w.start ? 'upcoming' : t < w.end ? 'live' : 'ended', name: KINDS[w.kind].name })).sort((a, b) => a.start - b.start);
}
const find = (id) => windows().concat(windows(nowMs() - 8 * D)).find((w) => w.id === id) || null;

const prizeFor = (kind, rank) => { let best = null; for (const r of KINDS[kind].rewards) if (rank <= r.rank && (!best || r.rank < best.rank)) best = r; return best; };
export function rewardPreview(kind) { return KINDS[kind].rewards.map((r) => ({ top: r.rank, cos: r.cos || [], coins: r.coins || 0 })); }

// Pays a finished tournament exactly once.
export function settle(w) {
  if (w.state !== 'ended' || st.done.get(w.id)) return false;
  const rows = st.board.all(w.start, w.end, 10);
  // one reward row per (tournament, player) is the "already paid" marker: re-running after a crash never pays twice
  rows.forEach((r, i) => {
    const rank = i + 1, prize = prizeFor(w.kind, rank);
    if (!prize) return;
    const ins = st.reward.run(w.id, r.pid, rank, r.score, prize.coins || 0, JSON.stringify(prize.cos || []));
    if (Number(ins.changes) === 0) return;
    if (prize.cos) grantCosmetics(r.pid, prize.cos);
    if (prize.coins) db.prepare('UPDATE players SET wallet = wallet + ? WHERE id = ?').run(prize.coins, r.pid);
  });
  st.markDone.run(w.id, nowMs());
  return true;
}
export function settleAll() { let n = 0; for (const w of windows().concat(windows(nowMs() - D), windows(nowMs() - 7 * D))) if (settle(w)) n++; return n; }

export function leaderboard(id, me) {
  const w = find(id);
  if (!w) return null;
  const rows = st.board.all(w.start, Math.min(w.end, nowMs() + 1), 50).map((r, i) => { const p = q.getPlayer.get(r.pid); return { rank: i + 1, name: p ? p.name : 'Deleted player', tier: p ? tierOf(p.rating) : '', score: r.score, dist: r.dist, me: !!me && r.pid === me.id, prize: prizeFor(w.kind, i + 1) ? { cos: prizeFor(w.kind, i + 1).cos || [], coins: prizeFor(w.kind, i + 1).coins || 0 } : null }; });
  return { ...w, rows, entrants: st.entrants.get(w.start, w.end).n };
}
export function overview(me) {
  settleAll();
  const t = nowMs(), list = windows(t).filter((w) => w.state !== 'ended' || t - w.end < 6 * H).map((w) => {
    const base = { id: w.id, kind: w.kind, name: w.name, blurb: KINDS[w.kind].blurb, start: w.start, end: w.end, state: w.state, rewards: rewardPreview(w.kind) };
    if (me && w.state !== 'upcoming') { const s = st.mine.get(w.start, Math.min(w.end, t + 1), me.id).score; if (s != null) base.mine = { score: s, rank: st.above.get(w.start, Math.min(w.end, t + 1), s).n + 1 }; }
    return base;
  });
  const unseen = me ? st.unseen.all(me.id).map((r) => ({ tid: r.tid, name: (find(r.tid) || {}).name || 'Tournament', rank: r.rank, score: r.score, coins: r.coins, items: JSON.parse(r.items) })) : [];
  if (me) for (const r of unseen) st.seen.run(me.id, r.tid);
  return { now: t, tournaments: list, rewards: unseen };
}
const timer = setInterval(() => { try { settleAll(); } catch { /* db closing */ } }, 60e3); timer.unref();
export const removeFor = (pid) => db.prepare('DELETE FROM tournament_rewards WHERE pid = ?').run(pid);
