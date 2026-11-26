// Matchmaking rating (MMR) per ladder: Solo (the classic player rating), Duos and Trios.
// Each ladder keeps a rating AND an uncertainty (sigma): a new or returning player moves fast and is matched widely, a settled
// player moves slowly. Rating starts from your Solo rating (so a strong player does not start Duos at 1000) and then lives on its own.
import { db, q } from './db.mjs';
import { tierOf, setLadderHook } from './players.mjs';

db.exec('CREATE TABLE IF NOT EXISTS mmr (pid TEXT NOT NULL, bucket TEXT NOT NULL, rating REAL NOT NULL, sigma REAL NOT NULL, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (pid, bucket))');
const st = {
  get: db.prepare('SELECT * FROM mmr WHERE pid = ? AND bucket = ?'),
  put: db.prepare('INSERT OR REPLACE INTO mmr (pid, bucket, rating, sigma, games, wins, last) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  all: db.prepare('SELECT bucket, rating, sigma, games, wins FROM mmr WHERE pid = ?'),
  del: db.prepare('DELETE FROM mmr WHERE pid = ?'),
};
export const SIGMA_START = 350, SIGMA_FLOOR = 70, PLACEMENT_GAMES = 5;
export const bucketOf = (spec) => (spec.size === 3 ? 'trios' : spec.size === 2 ? 'duos' : 'solo');
const now = () => Date.now();

// Uncertainty grows while you are away (about 25 per week, capped) so a returning player is not stuck at an old rating.
function aged(row, t = now()) {
  const weeks = Math.max(0, (t - (row.last || t)) / (7 * 86400e3));
  return { ...row, sigma: Math.min(SIGMA_START, row.sigma + weeks * 25) };
}
export function get(pid, bucket) {
  if (bucket === 'solo') { const p = q.getPlayer.get(pid); return p ? { pid, bucket, rating: p.rating, sigma: Math.max(SIGMA_FLOOR, SIGMA_START - (p.games | 0) * 25), games: p.games | 0, wins: p.wins | 0, last: p.last_run || now() } : null; }
  let r = st.get.get(pid, bucket);
  if (!r) { const p = q.getPlayer.get(pid); if (!p) return null; r = { pid, bucket, rating: p.rating, sigma: Math.min(SIGMA_START, 200 + (p.games < 10 ? 80 : 0)), games: 0, wins: 0, last: now() }; }
  return aged(r);
}
export const provisional = (row) => row.games < PLACEMENT_GAMES;
// How far a result moves the rating: big while the system is unsure about you, smaller as it learns (and double during placements).
export const kFactor = (row) => (16 + 28 * ((row.sigma - SIGMA_FLOOR) / (SIGMA_START - SIGMA_FLOOR))) * (provisional(row) ? 1.5 : 1);
export function apply(pid, bucket, delta, won) {
  if (bucket === 'solo') return; // the solo ladder is settled by the race code (players.rating)
  const r = get(pid, bucket);
  if (!r) return;
  st.put.run(pid, bucket, Math.max(0, r.rating + delta), Math.max(SIGMA_FLOOR, r.sigma * 0.9), r.games + 1, r.wins + (won ? 1 : 0), now());
}
export const all = (pid) => {
  const out = { solo: get(pid, 'solo'), duos: get(pid, 'duos'), trios: get(pid, 'trios') };
  const view = (r) => r && { rating: Math.round(r.rating), tier: tierOf(r.rating), games: r.games, wins: r.wins, provisional: provisional(r), sigma: Math.round(r.sigma) };
  return { solo: view(out.solo), duos: view(out.duos), trios: view(out.trios) };
};
export const removeFor = (pid) => st.del.run(pid);
setLadderHook(all);

// One rating for a whole party. A big gap between its members is dangerous in ranked (a carry plus a newcomer), so the
// strongest member counts for a quarter of the gap and ranked refuses gaps above MAX_SPREAD.
export const MAX_SPREAD = 600;
export function groupRating(members) {
  const rs = members.map((m) => m.rating), avg = rs.reduce((a, b) => a + b, 0) / rs.length, max = Math.max(...rs), min = Math.min(...rs);
  return { rating: avg + 0.25 * (max - avg), spread: max - min, sigma: members.reduce((s, m) => s + m.sigma, 0) / members.length };
}
