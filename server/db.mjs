// SQLite persistence (node:sqlite, no native build needed). One file = the whole game's cloud: accounts, wallet,
// inventory, cloud saves, runs, matches, support tickets, anti-cheat evidence. WAL mode, migrations are additive.
import './env.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Keep the database of earlier versions (sprayrun.db) when it exists.
const legacyDb = path.join(DATA_DIR, 'sprayrun.db');
const defaultDb = fs.existsSync(legacyDb) ? legacyDb : path.join(DATA_DIR, 'reversesurfers.db');
export const db = new DatabaseSync(process.env.DB_FILE || defaultDb);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL,
  rating REAL NOT NULL DEFAULT 1000, games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0, leaves INTEGER NOT NULL DEFAULT 0, last_run INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, mode TEXT NOT NULL, map TEXT, daily INTEGER NOT NULL DEFAULT 0, dkey INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL, dist INTEGER NOT NULL, coins INTEGER NOT NULL, time REAL NOT NULL, created INTEGER NOT NULL, flagged INTEGER NOT NULL DEFAULT 0, flags TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_board ON runs(mode, flagged, score DESC);
CREATE INDEX IF NOT EXISTS idx_runs_pid ON runs(pid, created);
CREATE INDEX IF NOT EXISTS idx_runs_daily ON runs(daily, dkey, flagged, score DESC);
CREATE TABLE IF NOT EXISTS tickets (nonce TEXT PRIMARY KEY, pid TEXT NOT NULL, created INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, map TEXT, mode TEXT, seed INTEGER, ranked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS match_players (
  match_id INTEGER NOT NULL, pid TEXT NOT NULL, name TEXT, score INTEGER, dist INTEGER, place INTEGER, before REAL, after REAL, dq INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS saves (pid TEXT PRIMARY KEY, ver INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', updated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, item TEXT NOT NULL, price INTEGER NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_purchases_pid ON purchases(pid, ts);
CREATE TABLE IF NOT EXISTS advent_claims (pid TEXT NOT NULL, year INTEGER NOT NULL, day INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (pid, year, day));
CREATE TABLE IF NOT EXISTS code_claims (code TEXT PRIMARY KEY, pid TEXT NOT NULL UNIQUE, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS event_claims (pid TEXT NOT NULL, event TEXT NOT NULL, year INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (pid, event, year));
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, subject TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'open', created INTEGER NOT NULL, updated INTEGER NOT NULL, ai_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_tickets_pid ON support_tickets(pid, updated);
CREATE TABLE IF NOT EXISTS support_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, ticket INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_msgs_ticket ON support_msgs(ticket, id);
CREATE TABLE IF NOT EXISTS ac_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT, severity INTEGER NOT NULL DEFAULT 1,
  ts INTEGER NOT NULL, verdict TEXT, action TEXT
);
CREATE INDEX IF NOT EXISTS idx_ac_pid ON ac_events(pid, ts);
CREATE TABLE IF NOT EXISTS duels (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, a TEXT, b TEXT, winner TEXT, reason TEXT, a_hp REAL, b_hp REAL, a_hits INTEGER, b_hits INTEGER
);
`);

function addCol(table, col, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
}
addCol('players', 'username', 'TEXT');
addCol('players', 'pass_hash', 'TEXT');
addCol('players', 'pass_salt', 'TEXT');
addCol('players', 'wallet', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'xp', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'inv', "TEXT NOT NULL DEFAULT ''");
addCol('players', 'career', "TEXT NOT NULL DEFAULT '{}'");
addCol('players', 'tokver', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'kicked_until', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'ban_reason', 'TEXT');
addCol('players', 'last_seen', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'imported', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'earned_day', 'INTEGER NOT NULL DEFAULT 0'); // coins credited today (daily earning cap)
addCol('players', 'earned_key', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'premium', 'INTEGER NOT NULL DEFAULT 0');
addCol('players', 'premium_since', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_players_username ON players(username COLLATE NOCASE) WHERE username IS NOT NULL');

const st = (sql) => db.prepare(sql);
export const q = {
  addPlayer: st('INSERT INTO players (id, name, created) VALUES (?, ?, ?)'),
  getPlayer: st('SELECT * FROM players WHERE id = ?'),
  getByUsername: st('SELECT * FROM players WHERE username = ? COLLATE NOCASE'),
  setCredentials: st('UPDATE players SET username = ?, pass_hash = ?, pass_salt = ?, name = ? WHERE id = ?'),
  setPassword: st('UPDATE players SET pass_hash = ?, pass_salt = ?, tokver = tokver + 1 WHERE id = ?'),
  bumpTokver: st('UPDATE players SET tokver = tokver + 1 WHERE id = ?'),
  rename: st('UPDATE players SET name = ? WHERE id = ?'),
  setRating: st('UPDATE players SET rating = ?, games = games + 1, wins = wins + ? WHERE id = ?'),
  addStrike: st('UPDATE players SET strikes = strikes + 1 WHERE id = ?'),
  ban: st('UPDATE players SET banned = 1, ban_reason = ? WHERE id = ?'),
  unban: st('UPDATE players SET banned = 0, strikes = 0, ban_reason = NULL, kicked_until = 0 WHERE id = ?'),
  kick: st('UPDATE players SET kicked_until = ? WHERE id = ?'),
  addLeave: st('UPDATE players SET leaves = leaves + 1 WHERE id = ?'),
  touchRun: st('UPDATE players SET last_run = ? WHERE id = ?'),
  touchSeen: st('UPDATE players SET last_seen = ? WHERE id = ?'),
  setInv: st('UPDATE players SET inv = ?, wallet = ?, imported = ? WHERE id = ?'),
  setProgress: st('UPDATE players SET xp = ?, career = ?, wallet = ?, inv = ?, earned_day = ?, earned_key = ? WHERE id = ?'),
  getSave: st('SELECT * FROM saves WHERE pid = ?'),
  putSave: st('INSERT INTO saves (pid, ver, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(pid) DO UPDATE SET ver = excluded.ver, data = excluded.data, updated = excluded.updated'),
  addPurchase: st('INSERT INTO purchases (pid, item, price, ts) VALUES (?, ?, ?, ?)'),
  recentPurchases: st('SELECT item, price, ts FROM purchases WHERE pid = ? ORDER BY id DESC LIMIT ?'),
  getClaim: st('SELECT * FROM advent_claims WHERE pid = ? AND year = ? AND day = ?'),
  addClaim: st('INSERT INTO advent_claims (pid, year, day, ts) VALUES (?, ?, ?, ?)'),
  claims: st('SELECT day FROM advent_claims WHERE pid = ? AND year = ?'),
  codeByCode: st('SELECT * FROM code_claims WHERE code = ?'),
  codeByPid: st('SELECT * FROM code_claims WHERE pid = ?'),
  claimCode: st('INSERT INTO code_claims (code, pid, ts) VALUES (?, ?, ?)'),
  setPremium: st('UPDATE players SET premium = 1, premium_since = ? WHERE id = ?'),
  eventClaim: st('SELECT * FROM event_claims WHERE pid = ? AND event = ? AND year = ?'),
  claimEvent: st('INSERT INTO event_claims (pid, event, year, ts) VALUES (?, ?, ?, ?)'),
  addTicket: st('INSERT INTO tickets (nonce, pid, created) VALUES (?, ?, ?)'),
  getTicket: st('SELECT * FROM tickets WHERE nonce = ?'),
  useTicket: st('UPDATE tickets SET used = 1 WHERE nonce = ? AND used = 0'),
  purgeTickets: st('DELETE FROM tickets WHERE created < ?'),
  addRun: st('INSERT INTO runs (pid, mode, map, daily, dkey, score, dist, coins, time, created, flagged, flags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  runsLastDay: st('SELECT COUNT(*) AS n FROM runs WHERE pid = ? AND created > ?'),
  recentRuns: st('SELECT mode, map, score, dist, coins, time, created, flagged, flags FROM runs WHERE pid = ? ORDER BY id DESC LIMIT ?'),
  flaggedRuns: st('SELECT mode, score, dist, coins, time, created, flags FROM runs WHERE pid = ? AND flagged = 1 ORDER BY id DESC LIMIT ?'),
  addMatch: st('INSERT INTO matches (created, map, mode, seed, ranked) VALUES (?, ?, ?, ?, ?)'),
  addMatchPlayer: st('INSERT INTO match_players (match_id, pid, name, score, dist, place, before, after, dq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  recentMatches: st(`SELECT m.created, m.map, m.mode, mp.score, mp.dist, mp.place, mp.before, mp.after, mp.dq,
      (SELECT COUNT(*) FROM match_players x WHERE x.match_id = m.id) AS players
    FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.pid = ? ORDER BY m.id DESC LIMIT ?`),
  boardMode: st(`SELECT p.name AS name, p.id AS pid, p.premium AS premium, MAX(r.score) AS score, r.dist AS dist, r.time AS time, r.created AS created
    FROM runs r JOIN players p ON p.id = r.pid
    WHERE r.mode = ? AND r.daily = 0 AND r.flagged = 0 AND p.banned = 0 AND r.created >= ?
    GROUP BY r.pid ORDER BY score DESC LIMIT ?`),
  boardDaily: st(`SELECT p.name AS name, p.id AS pid, p.premium AS premium, MAX(r.score) AS score, r.dist AS dist, r.time AS time, r.created AS created
    FROM runs r JOIN players p ON p.id = r.pid
    WHERE r.daily = 1 AND r.dkey = ? AND r.flagged = 0 AND p.banned = 0
    GROUP BY r.pid ORDER BY score DESC LIMIT ?`),
  // Players who never made an account still get their own board: a guest is a real player with a real score.
  boardGuests: st(`SELECT p.name AS name, p.id AS pid, p.premium AS premium, MAX(r.score) AS score, r.dist AS dist, r.time AS time, r.created AS created
    FROM runs r JOIN players p ON p.id = r.pid
    WHERE r.mode = 'classic' AND r.daily = 0 AND r.flagged = 0 AND p.banned = 0 AND p.username IS NULL
    GROUP BY r.pid ORDER BY score DESC LIMIT ?`),
  boardRanked: st('SELECT name, id AS pid, premium, rating AS score, games, wins FROM players WHERE games > 0 AND banned = 0 ORDER BY rating DESC LIMIT ?'),
  myBestMode: st('SELECT MAX(score) AS s FROM runs WHERE pid = ? AND mode = ? AND daily = 0 AND flagged = 0 AND created >= ?'),
  betterModeCount: st(`SELECT COUNT(*) AS n FROM (SELECT MAX(r.score) AS s FROM runs r JOIN players p ON p.id = r.pid
    WHERE r.mode = ? AND r.daily = 0 AND r.flagged = 0 AND p.banned = 0 AND r.created >= ? GROUP BY r.pid) WHERE s > ?`),
  ratingRank: st('SELECT COUNT(*) AS n FROM players WHERE games > 0 AND banned = 0 AND rating > ?'),
  addEvent: st('INSERT INTO ac_events (pid, kind, detail, severity, ts) VALUES (?, ?, ?, ?, ?)'),
  setEventVerdict: st('UPDATE ac_events SET verdict = ?, action = ? WHERE id = ?'),
  events: st('SELECT id, kind, detail, severity, ts, verdict, action FROM ac_events WHERE pid = ? ORDER BY id DESC LIMIT ?'),
  eventsSince: st('SELECT COUNT(*) AS n, COALESCE(SUM(severity), 0) AS sev FROM ac_events WHERE pid = ? AND ts > ?'),
  newTicketRow: st('INSERT INTO support_tickets (pid, subject, category, status, created, updated) VALUES (?, ?, ?, ?, ?, ?)'),
  getTicketRow: st('SELECT * FROM support_tickets WHERE id = ?'),
  ticketsOf: st('SELECT * FROM support_tickets WHERE pid = ? ORDER BY updated DESC LIMIT 30'),
  openTicketCount: st("SELECT COUNT(*) AS n FROM support_tickets WHERE pid = ? AND status != 'closed'"),
  setTicket: st('UPDATE support_tickets SET status = ?, category = ?, ai_summary = ?, updated = ? WHERE id = ?'),
  touchTicket: st('UPDATE support_tickets SET updated = ? WHERE id = ?'),
  escalated: st("SELECT t.*, p.name AS pname FROM support_tickets t JOIN players p ON p.id = t.pid WHERE t.status = 'escalated' ORDER BY t.updated DESC LIMIT 50"),
  addMsg: st('INSERT INTO support_msgs (ticket, role, text, created) VALUES (?, ?, ?, ?)'),
  msgsOf: st('SELECT id, role, text, created FROM support_msgs WHERE ticket = ? ORDER BY id ASC LIMIT 200'),
  addDuel: st('INSERT INTO duels (created, a, b, winner, reason, a_hp, b_hp, a_hits, b_hits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  publicProfile: st('SELECT id, name, created, rating, games, wins, xp, career, banned, premium, premium_since FROM players WHERE id = ?'),
  profileByName: st('SELECT id FROM players WHERE name = ? COLLATE NOCASE AND banned = 0 ORDER BY games DESC LIMIT 1'),
};

// Run several statements atomically.
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
