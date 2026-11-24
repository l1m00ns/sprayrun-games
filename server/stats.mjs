// Player statistics (charts in the Career page) and a few public global numbers.
import { db, q } from './db.mjs';
import { careerOf } from './players.mjs';
import { nowMs, levelOf } from './catalog.mjs';

const day = (t) => new Date(t).toISOString().slice(0, 10);
const runsOf = db.prepare('SELECT mode, map, score, dist, coins, time, created, flagged, daily FROM runs WHERE pid = ? AND flagged != 1 ORDER BY created DESC LIMIT 1000');
const ratingHist = db.prepare('SELECT m.created AS t, mp.before AS b, mp.after AS a, mp.place AS place FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.pid = ? ORDER BY m.id ASC LIMIT 200');
const duelRows = db.prepare('SELECT created, a, b, winner, reason FROM duels WHERE a = ? OR b = ? ORDER BY id DESC LIMIT 100');

export function playerStats(pid) {
  const p = q.getPlayer.get(pid);
  const career = careerOf(p);
  const runs = runsOf.all(pid);
  const today = Date.parse(day(nowMs()));
  // last 30 days, one bucket per UTC day
  const days = Array.from({ length: 30 }, (_, i) => { const t = today - (29 - i) * 86400e3; return { d: day(t), runs: 0, minutes: 0, best: 0, coins: 0, dist: 0 }; });
  const idx = new Map(days.map((d, i) => [d.d, i]));
  const byMode = {}, byMap = {}, hours = Array(24).fill(0), buckets = Array(10).fill(0);
  let bestScore = 0, sumScore = 0, sumDist = 0, sumTime = 0;
  for (const r of runs) {
    const k = idx.get(day(r.created));
    if (k !== undefined) { const d = days[k]; d.runs++; d.minutes += r.time / 60; d.best = Math.max(d.best, r.score); d.coins += r.coins; d.dist += r.dist; }
    const m = (byMode[r.mode] ||= { runs: 0, best: 0, sum: 0, minutes: 0 }); m.runs++; m.best = Math.max(m.best, r.score); m.sum += r.score; m.minutes += r.time / 60;
    const mp = (byMap[r.map || '?'] ||= { runs: 0, best: 0, sum: 0, dist: 0 }); mp.runs++; mp.best = Math.max(mp.best, r.score); mp.sum += r.score; mp.dist += r.dist;
    hours[new Date(r.created).getUTCHours()]++;
    bestScore = Math.max(bestScore, r.score); sumScore += r.score; sumDist += r.dist; sumTime += r.time;
  }
  const maxS = Math.max(1, bestScore);
  for (const r of runs) buckets[Math.min(9, Math.floor((r.score / maxS) * 10))]++;
  for (const m of Object.values(byMode)) { m.avg = Math.round(m.sum / m.runs); m.minutes = Math.round(m.minutes); delete m.sum; }
  for (const m of Object.values(byMap)) { m.avg = Math.round(m.sum / m.runs); m.dist = Math.round(m.dist); delete m.sum; }
  for (const d of days) { d.minutes = Math.round(d.minutes * 10) / 10; }
  // streak of consecutive active days ending today (or yesterday)
  let streak = 0; for (let i = 29; i >= 0; i--) { if (days[i].runs > 0) streak++; else if (i === 29) continue; else break; }
  const rating = [{ t: p.created, r: 1000 }].concat(ratingHist.all(pid).map((r) => ({ t: r.t, r: Math.round(r.a), place: r.place })));
  const wins = duelRows.all(pid, pid).map((d) => ({ t: d.created, result: d.winner === pid ? 'win' : d.winner ? 'loss' : 'draw', reason: d.reason }));
  const lv = levelOf(p.xp);
  return {
    totals: { runs: career.runs, minutes: Math.round(career.time / 60), dist: career.dist, coins: career.coins, bestScore: career.bestScore, avgScore: runs.length ? Math.round(sumScore / runs.length) : 0, avgDist: runs.length ? Math.round(sumDist / runs.length) : 0, avgRunSec: runs.length ? Math.round(sumTime / runs.length) : 0, level: lv.level },
    days, byMode, byMap, hours, scoreBuckets: buckets.map((n, i) => ({ from: Math.round((i / 10) * maxS), n })), streak, rating,
    ranked: { games: p.games, wins: p.wins, rating: Math.round(p.rating) },
    duel: { wins: career.duelWins, losses: career.duelLosses, draws: career.duelDraws, kills: career.duelKills, recent: wins.slice(0, 12) },
  };
}

export function globalStats(online = 0) {
  const one = (sql, ...a) => db.prepare(sql).get(...a).n;
  const since = nowMs() - 86400e3;
  return {
    players: one('SELECT COUNT(*) AS n FROM players'), accounts: one('SELECT COUNT(*) AS n FROM players WHERE username IS NOT NULL'), online,
    runsToday: one('SELECT COUNT(*) AS n FROM runs WHERE created > ? AND flagged != 1', since), runsTotal: one('SELECT COUNT(*) AS n FROM runs WHERE flagged != 1'),
    rankedMatches: one('SELECT COUNT(*) AS n FROM matches WHERE ranked = 1'), duels: one('SELECT COUNT(*) AS n FROM duels'),
    rejectedRuns: one('SELECT COUNT(*) AS n FROM runs WHERE flagged = 1'), at: nowMs(),
  };
}
