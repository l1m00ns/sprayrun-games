// Device + network fingerprints and duplicate-account (multi-account / ban-evasion) detection.
// The client sends a rich set of signals; the server stores keyed HASHES of identifiers (never a raw IP) plus coarse
// attributes, then scores how strongly two accounts are linked:
//   same persistent device id  100  (the same browser profile)
//   same fingerprint + same /24 network  60
//   same fingerprint  35  |  same IP  20 (a shared household or school is NOT proof)  |  same /24  5
// Policy: strong links are flagged and kept for review; a link to a SUSPENDED account is treated as ban evasion (kick +
// event for a moderator, never an automatic ban); linked accounts are never matched against each other in ranked.
import crypto from 'node:crypto';
import { db } from './db.mjs';
import { hashId } from './auth.mjs';
import { nowMs } from './catalog.mjs';
import { recordEvent, kick } from './players.mjs';

db.exec(`CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT NOT NULL, did TEXT NOT NULL, fp TEXT NOT NULL, ip_hash TEXT, ip24 TEXT, asn TEXT, country TEXT, tz TEXT, lang TEXT,
  ua TEXT, gpu TEXT, screen TEXT, cores INTEGER, mem REAL, platform TEXT, webdriver INTEGER NOT NULL DEFAULT 0, vpn_class TEXT, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, seen INTEGER NOT NULL DEFAULT 1,
  UNIQUE (pid, did, fp));
CREATE INDEX IF NOT EXISTS idx_dev_did ON devices(did); CREATE INDEX IF NOT EXISTS idx_dev_fp ON devices(fp); CREATE INDEX IF NOT EXISTS idx_dev_ip ON devices(ip_hash); CREATE INDEX IF NOT EXISTS idx_dev_ip24 ON devices(ip24); CREATE INDEX IF NOT EXISTS idx_dev_pid ON devices(pid);`);
const upsert = db.prepare(`INSERT INTO devices (pid, did, fp, ip_hash, ip24, asn, country, tz, lang, ua, gpu, screen, cores, mem, platform, webdriver, vpn_class, first_seen, last_seen)
  VALUES (@pid, @did, @fp, @ip_hash, @ip24, @asn, @country, @tz, @lang, @ua, @gpu, @screen, @cores, @mem, @platform, @webdriver, @vpn_class, @now, @now)
  ON CONFLICT(pid, did, fp) DO UPDATE SET ip_hash = excluded.ip_hash, ip24 = excluded.ip24, asn = excluded.asn, country = excluded.country, tz = excluded.tz, vpn_class = excluded.vpn_class, last_seen = excluded.last_seen, seen = seen + 1`);
const ofPid = db.prepare('SELECT * FROM devices WHERE pid = ?');
const sharing = db.prepare('SELECT DISTINCT pid, did, fp, ip_hash, ip24 FROM devices WHERE pid != ? AND (did = ? OR fp = ? OR ip_hash = ? OR ip24 = ?) LIMIT 400');
const countDid = db.prepare('SELECT COUNT(DISTINCT pid) AS n FROM devices WHERE did = ?');
const playerRow = db.prepare('SELECT id, name, banned, strikes, created FROM players WHERE id = ?');

const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
export const validDid = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(d);

// Collect + store one device report. `d` comes from the client (untrusted, sanitised here); `intel` is the server's own IP check.
export function recordDevice(pid, d, intel) {
  if (!d || !validDid(d.did)) return { ok: false, error: 'bad_device' };
  const s = d.signals || {};
  const fpSource = [s.platform, s.screen, s.cores, s.mem, s.gpu, s.canvas, s.tz, s.langs, s.fonts, s.audio, s.touch, s.dpr].map((x) => clip(x, 80)).join('|');
  const fp = crypto.createHash('sha256').update(fpSource).digest('hex').slice(0, 32);
  upsert.run({
    pid, did: d.did, fp, ip_hash: intel.ipHash, ip24: intel.ip24, asn: clip(intel.asn, 40), country: clip(intel.country, 3), tz: clip(s.tz, 40), lang: clip(s.lang, 16),
    ua: hashId(clip(s.ua, 300)), gpu: clip(s.gpu, 80), screen: clip(s.screen, 24), cores: Number(s.cores) | 0, mem: Number(s.mem) || 0, platform: clip(s.platform, 24),
    webdriver: s.webdriver ? 1 : 0, vpn_class: clip(intel.class, 12), now: nowMs(),
  });
  return { ok: true, fp };
}

// All accounts linked to `pid`, strongest first. Each entry lists WHY (so a moderator can judge the evidence).
export function links(pid) {
  const mine = ofPid.all(pid);
  const out = new Map();
  for (const m of mine) {
    for (const o of sharing.all(pid, m.did, m.fp, m.ip_hash || '-', m.ip24 || '-')) {
      const e = out.get(o.pid) || { pid: o.pid, score: 0, signals: new Set() };
      if (o.did === m.did) { e.signals.add('device_id'); e.score = Math.max(e.score, 100); }
      if (o.fp === m.fp) { e.signals.add('fingerprint'); e.score = Math.max(e.score, o.ip24 === m.ip24 ? 60 : 35); }
      if (o.ip_hash && o.ip_hash === m.ip_hash) { e.signals.add('same_ip'); e.score = Math.max(e.score, 20); }
      else if (o.ip24 && o.ip24 === m.ip24) { e.signals.add('same_network'); e.score = Math.max(e.score, 5); }
      out.set(o.pid, e);
    }
  }
  return [...out.values()].map((e) => { const p = playerRow.get(e.pid) || {}; return { pid: e.pid, name: p.name, banned: !!p.banned, strikes: p.strikes || 0, score: e.score, signals: [...e.signals] }; }).sort((a, b) => b.score - a.score);
}

export const accountsOnDevice = (did) => (validDid(did) ? countDid.get(did).n : 0);
// pids that must never be matched against `pid` in ranked (same person boosting / colluding)
export const collusionSet = (pid) => new Set(links(pid).filter((l) => l.score >= 60).map((l) => l.pid));

// After a report: raise events, detect ban evasion. Returns a summary for the response / admin tools.
export function assess(pid) {
  const ls = links(pid);
  const strong = ls.filter((l) => l.score >= 60);
  const evasion = strong.find((l) => l.banned);
  const seen = new Set(db.prepare("SELECT detail FROM ac_events WHERE pid = ? AND kind IN ('alt_account','ban_evasion')").all(pid).map((r) => r.detail));
  for (const l of strong) {
    const key = JSON.stringify({ other: l.pid, signals: l.signals });
    if (!seen.has(key)) recordEvent(pid, l.banned ? 'ban_evasion' : 'alt_account', key, l.banned ? 3 : 1);
  }
  let restricted = false;
  if (evasion) { kick(pid, 'This device is linked to a suspended account.', 3600); restricted = true; }
  return { linked: ls.length, strong: strong.length, evasion: !!evasion, restricted };
}
