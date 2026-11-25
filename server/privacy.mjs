// Data rights: export everything we hold about a player (GDPR art. 15/20) and delete the account (art. 17).
//
// Deletion removes the profile, progress, purchases, friends, messages and support history. Two things are deliberately kept, and the
// Privacy Policy says so: (1) leaderboard / match rows are anonymised ("Deleted player"), not removed, so other players' results do not
// change; (2) for an account that was sanctioned (strikes or a ban) the irreversible device hashes stay, otherwise deleting an account
// would be a way to erase a ban.
import { db, q } from './db.mjs';
import * as messages from './messages.mjs';
import { checkPassword } from './auth.mjs';

const all = (sql, ...a) => db.prepare(sql).all(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const tableExists = (n) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(n);

export function exportData(pid) {
  const p = q.getPlayer.get(pid);
  if (!p) return null;
  const { pass_hash, pass_salt, ...profile } = p; // never export credential material
  const rows = (t, col = 'pid') => (tableExists(t) ? all(`SELECT * FROM ${t} WHERE ${col} = ?`, pid) : []);
  const tickets = rows('support_tickets');
  return {
    exportedAt: new Date().toISOString(), format: 'reverse-surfers-data-export/1',
    profile,
    save: rows('saves'), runs: rows('runs'), purchases: rows('purchases'), adventClaims: rows('advent_claims'),
    matches: rows('match_players'),
    friends: tableExists('friends') ? all('SELECT a, b, status, created FROM friends WHERE a = ? OR b = ?', pid, pid) : [],
    messages: messages.exportFor(pid),
    support: tickets.map((t) => ({ ...t, messages: all('SELECT role, text, created FROM support_msgs WHERE ticket = ? ORDER BY id', t.id) })),
    appeals: rows('appeals'),
    devices: rows('devices').map((d) => ({ firstSeen: d.first_seen, lastSeen: d.last_seen, country: d.country, tz: d.tz, lang: d.lang, platform: d.platform, note: 'identifiers are stored only as irreversible hashes' })),
    fairPlayEvents: rows('ac_events').map((e) => ({ kind: e.kind, severity: e.severity, ts: e.ts })),
  };
}

// password: required for accounts with a username; guests confirm with the word DELETE
export function deleteAccount(pid, { password, confirm } = {}) {
  const p = q.getPlayer.get(pid);
  if (!p) return { ok: false, error: 'not_found' };
  if (p.username) { if (!checkPassword(String(password || ''), p.pass_hash, p.pass_salt)) return { ok: false, error: 'bad_credentials', message: 'Wrong password' }; }
  else if (String(confirm || '').toUpperCase() !== 'DELETE') return { ok: false, error: 'confirm', message: 'Type DELETE to confirm' };
  const sanctioned = !!p.banned || (p.strikes | 0) > 0;
  db.exec('BEGIN');
  try {
    messages.deleteAllFor(pid);
    run('DELETE FROM friends WHERE a = ? OR b = ?', pid, pid);
    run('DELETE FROM friend_codes WHERE pid = ?', pid);
    for (const t of ['saves', 'purchases', 'advent_claims', 'runs', 'tickets']) if (tableExists(t)) run(`DELETE FROM ${t} WHERE pid = ?`, pid);
    if (tableExists('support_tickets')) { run('DELETE FROM support_msgs WHERE ticket IN (SELECT id FROM support_tickets WHERE pid = ?)', pid); run('DELETE FROM support_tickets WHERE pid = ?', pid); }
    if (tableExists('appeals')) { run('DELETE FROM appeal_events WHERE appeal IN (SELECT id FROM appeals WHERE pid = ?)', pid); run('DELETE FROM appeals WHERE pid = ?', pid); }
    if (tableExists('match_players')) run("UPDATE match_players SET name = 'Deleted player', pid = 'deleted' WHERE pid = ?", pid);
    if (!sanctioned) { if (tableExists('devices')) run('DELETE FROM devices WHERE pid = ?', pid); if (tableExists('ac_events')) run('DELETE FROM ac_events WHERE pid = ?', pid); run('DELETE FROM players WHERE id = ?', pid); }
    else { // keep only what prevents ban evasion; the visible identity is erased
      run("UPDATE players SET name = 'Deleted player', username = NULL, pass_hash = NULL, pass_salt = NULL, tokver = tokver + 1 WHERE id = ?", pid);
    }
    db.exec('COMMIT');
  } catch (e) { try { db.exec('ROLLBACK'); } catch { /* none */ } return { ok: false, error: 'failed', message: 'Deletion failed, nothing was changed' }; }
  return { ok: true, kept: sanctioned ? 'fair-play record' : null };
}
