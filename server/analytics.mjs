// Product analytics for the backend: sessions, visits, runs, matches, performance and retention.
//
// Privacy: an IP is stored on the session row so abuse and VPN reuse can be investigated, then erased after
// ANALYTICS_IP_DAYS (30 by default). Raw events keep only a hashed session id. Everything is deleted after
// ANALYTICS_RETENTION_DAYS (90). The admin dashboard is the only reader and requires ADMIN_KEY.
import crypto from 'node:crypto';
import { db } from './db.mjs';

db.exec(`
CREATE TABLE IF NOT EXISTS an_sessions (
  sid TEXT PRIMARY KEY, pid TEXT, ip TEXT, ua TEXT, ref TEXT,
  first INTEGER NOT NULL, last INTEGER NOT NULL, beats INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0,
  path TEXT, screen TEXT, lang TEXT, tz TEXT, device TEXT
);
CREATE INDEX IF NOT EXISTS ix_an_sessions_first ON an_sessions(first);
CREATE INDEX IF NOT EXISTS ix_an_sessions_last ON an_sessions(last);
CREATE TABLE IF NOT EXISTS an_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL, pid TEXT, name TEXT NOT NULL, path TEXT,
  map TEXT, mode TEXT, quality TEXT, meta TEXT, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_an_events_at ON an_events(at);
CREATE INDEX IF NOT EXISTS ix_an_events_name ON an_events(name, at);
CREATE TABLE IF NOT EXISTS an_perf (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT, pid TEXT, at INTEGER NOT NULL,
  fps REAL, low1 REAL, ms REAL, preset TEXT, gpu TEXT, screen TEXT, dpr REAL, map TEXT
);
CREATE INDEX IF NOT EXISTS ix_an_perf_at ON an_perf(at);
`);

const DAY = 86400000;
const KEEP = Math.max(1, Number(process.env.ANALYTICS_RETENTION_DAYS) || 90);
const IP_KEEP = Math.max(1, Number(process.env.ANALYTICS_IP_DAYS) || 30);
const MAX_EVENTS = Math.max(1, Number(process.env.ANALYTICS_MAX_EVENTS) || 120); // per IP per minute

const S = {
  getSession: db.prepare('SELECT sid, pid FROM an_sessions WHERE sid = ?'),
  addSession: db.prepare(`INSERT INTO an_sessions (sid, pid, ip, ua, ref, first, last, beats, views, path, screen, lang, tz, device)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  touch: db.prepare(`UPDATE an_sessions SET last = ?, pid = COALESCE(?, pid), path = COALESCE(?, path), screen = COALESCE(?, screen),
    lang = COALESCE(?, lang), tz = COALESCE(?, tz), device = COALESCE(?, device), views = views + ?, beats = beats + ? WHERE sid = ?`),
  event: db.prepare('INSERT INTO an_events (sid, pid, name, path, map, mode, quality, meta, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  perf: db.prepare('INSERT INTO an_perf (sid, pid, at, fps, low1, ms, preset, gpu, screen, dpr, map) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  sweepEvents: db.prepare('DELETE FROM an_events WHERE at < ?'),
  sweepPerf: db.prepare('DELETE FROM an_perf WHERE at < ?'),
  sweepSessions: db.prepare('DELETE FROM an_sessions WHERE last < ?'),
  scrubIps: db.prepare('UPDATE an_sessions SET ip = NULL WHERE ip IS NOT NULL AND first < ?'),

  totals: db.prepare(`SELECT COUNT(*) sessions, COALESCE(SUM(views), 0) views,
    COALESCE(SUM(CASE WHEN beats <= 1 THEN 1 ELSE 0 END), 0) bounce,
    COALESCE(AVG(CASE WHEN last > first THEN last - first END), 0) / 1000 avgSec
    FROM an_sessions WHERE first >= ?`),
  events: db.prepare('SELECT COUNT(*) n FROM an_events WHERE at >= ?'),
  activePlayers: db.prepare('SELECT COUNT(DISTINCT sid) n FROM an_events WHERE at >= ?'),
  newSessions: db.prepare('SELECT COUNT(*) n FROM an_sessions WHERE first >= ?'),
  sessionDays: db.prepare(`SELECT strftime('%Y-%m-%d', first / 1000, 'unixepoch') day, COUNT(*) n FROM an_sessions WHERE first >= ? GROUP BY day`),
  eventDays: db.prepare(`SELECT strftime('%Y-%m-%d', at / 1000, 'unixepoch') day, COUNT(DISTINCT sid) players, COUNT(*) events,
    COALESCE(SUM(CASE WHEN name = 'run_start' THEN 1 ELSE 0 END), 0) runs,
    COALESCE(SUM(CASE WHEN name = 'match_start' THEN 1 ELSE 0 END), 0) matches
    FROM an_events WHERE at >= ? GROUP BY day`),
  activeDayPairs: db.prepare(`SELECT DISTINCT sid, strftime('%Y-%m-%d', at / 1000, 'unixepoch') day FROM an_events WHERE at >= ?`),
  hourly: db.prepare('SELECT CAST((at - ?) / 3600000 AS INTEGER) h, COUNT(*) n FROM an_events WHERE at >= ? GROUP BY h'),
  topMaps: db.prepare(`SELECT COALESCE(map, '?') k, COUNT(*) n FROM an_events WHERE name = 'run_start' AND at >= ? GROUP BY k ORDER BY n DESC LIMIT 8`),
  topModes: db.prepare(`SELECT COALESCE(mode, '?') k, COUNT(*) n FROM an_events WHERE name = 'run_start' AND at >= ? GROUP BY k ORDER BY n DESC LIMIT 8`),
  paths: db.prepare(`SELECT COALESCE(path, '/') k, COUNT(*) n FROM an_sessions WHERE first >= ? GROUP BY k ORDER BY n DESC LIMIT 8`),
  refs: db.prepare(`SELECT ref k, COUNT(*) n FROM an_sessions WHERE first >= ? AND ref IS NOT NULL AND ref <> '' GROUP BY k ORDER BY n DESC LIMIT 8`),
  devices: db.prepare(`SELECT COALESCE(device, '?') k, COUNT(*) n FROM an_sessions WHERE first >= ? GROUP BY k ORDER BY n DESC LIMIT 8`),
  langs: db.prepare(`SELECT COALESCE(lang, '?') k, COUNT(*) n FROM an_sessions WHERE first >= ? GROUP BY k ORDER BY n DESC LIMIT 8`),
  recent: db.prepare('SELECT name, path, map, mode, quality, meta, at FROM an_events ORDER BY id DESC LIMIT 40'),
  recentSessions: db.prepare('SELECT sid, pid, ip, ua, ref, first, last, beats, views, path, device, lang FROM an_sessions ORDER BY last DESC LIMIT 30'),
  lastAt: db.prepare('SELECT COALESCE(MAX(at), 0) n FROM an_events'),
  perfAll: db.prepare(`SELECT COUNT(*) n, COALESCE(AVG(fps), 0) fps, COALESCE(AVG(low1), 0) low1, COALESCE(AVG(ms), 0) ms FROM an_perf WHERE at >= ?`),
  perfByPreset: db.prepare(`SELECT COALESCE(preset, '?') preset, COUNT(*) n, AVG(fps) fps, AVG(low1) low1, AVG(ms) ms
    FROM an_perf WHERE at >= ? GROUP BY preset ORDER BY n DESC`),
  perfByMap: db.prepare(`SELECT COALESCE(map, '?') map, COUNT(*) n, AVG(fps) fps FROM an_perf WHERE at >= ? GROUP BY map ORDER BY n DESC LIMIT 8`),
};

// ---- helpers -------------------------------------------------------------------------------------
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) : '');
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 0; };
const nameOk = (s) => /^[a-z][a-z0-9_]{0,31}$/.test(s);
const anon = (ip, ua) => crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 16);

const rate = new Map();
function allowed(ip) {
  const t = Date.now();
  let b = rate.get(ip);
  if (!b || t - b.t > 60000) { b = { t, n: 0 }; rate.set(ip, b); }
  b.n++;
  if (rate.size > 8000) for (const [k, v] of rate) if (t - v.t > 120000) rate.delete(k);
  return b.n <= MAX_EVENTS;
}

function sweep() {
  const now = Date.now(), cut = now - KEEP * DAY;
  S.sweepEvents.run(cut); S.sweepPerf.run(cut); S.sweepSessions.run(cut);
  S.scrubIps.run(now - IP_KEEP * DAY); // keep the session for retention, drop the address
}
sweep();
setInterval(sweep, 6 * 3600000).unref();

// ---- ingestion -----------------------------------------------------------------------------------
// body: { sid, name, path, map, mode, quality, meta, perf: {fps,low1,ms,preset,gpu,screen,dpr,map} }
// ctx:  { ip, ua, ref }
export function track(body = {}, ctx = {}) {
  const ip = str(ctx.ip, 80) || '?';
  if (!allowed(ip)) return { ok: false, error: 'rate' };
  const now = Date.now();
  const ua = str(ctx.ua, 300);
  const ref = str(ctx.ref, 300);
  const sid = str(body.sid, 40) || anon(ip, ua);
  const pid = str(body.pid, 40) || null;
  const path = str(body.path, 120) || null;
  const screen = str(body.screen, 40) || null;
  const lang = str(body.lang, 12) || null;
  const tz = str(body.tz, 40) || null;
  const device = str(body.device, 20) || null;
  const name = nameOk(body.name) ? body.name : 'unknown';
  const map = str(body.map, 24) || null;
  const mode = str(body.mode, 20) || null;
  const quality = str(body.quality, 16) || null;
  let meta = null;
  if (body.meta && typeof body.meta === 'object') { try { meta = JSON.stringify(body.meta).slice(0, 2000); } catch { meta = null; } }

  const seen = S.getSession.get(sid);
  const visit = name === 'visit' ? 1 : 0;
  if (!seen) S.addSession.run(sid, pid, ip, ua, ref, now, now, 0, visit, path, screen, lang, tz, device);
  else S.touch.run(now, pid, path, screen, lang, tz, device, visit, name === 'beat' ? 1 : 0, sid);

  S.event.run(sid, pid, name, path, map, mode, quality, meta, now);

  const p = body.perf;
  if (name === 'perf' && p && typeof p === 'object') {
    S.perf.run(sid, pid, now, num(p.fps, 0, 1000), num(p.low1, 0, 1000), num(p.ms, 0, 10000),
      str(p.preset, 16) || '?', str(p.gpu, 120) || null, screen, num(p.dpr, 0, 8) || null, map);
  }
  return { ok: true, sid };
}

// ---- reporting -----------------------------------------------------------------------------------
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
function dayList(days) {
  const out = [], d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) out.push(new Date(d.getTime() - i * DAY).toISOString().slice(0, 10));
  return out;
}

export function summary(days = 14, ctx = {}) {
  days = Math.max(1, Math.min(90, Math.round(Number(days) || 14)));
  const now = Date.now(), since = now - days * DAY;
  const t = S.totals.get(since) || {};
  const sessions = t.sessions || 0;
  const events = (S.events.get(since) || {}).n || 0;
  const active = (S.activePlayers.get(since) || {}).n || 0;
  const fresh = (S.newSessions.get(since) || {}).n || 0;

  const sd = new Map(S.sessionDays.all(since).map((r) => [r.day, r.n]));
  const ed = new Map(S.eventDays.all(since).map((r) => [r.day, r]));
  const daily = dayList(days).map((day) => {
    const e = ed.get(day) || {};
    return { day, sessions: sd.get(day) || 0, players: e.players || 0, events: e.events || 0, runs: e.runs || 0, matches: e.matches || 0 };
  });

  // Retention: of the sessions active on a day, how many come back the next day / within 7 days.
  const pairs = S.activeDayPairs.all(now - (days + 9) * DAY);
  const bySid = new Map();
  for (const r of pairs) { if (!bySid.has(r.sid)) bySid.set(r.sid, new Set()); bySid.get(r.sid).add(r.day); }
  const daysArr = dayList(days).slice(0, -1);
  const ret = daysArr.map((day, idx) => {
    const next = new Date(Date.parse(day + 'T00:00:00Z') + DAY).toISOString().slice(0, 10);
    const week = new Set(Array.from({ length: 7 }, (_, k) => new Date(Date.parse(day + 'T00:00:00Z') + (k + 1) * DAY).toISOString().slice(0, 10)));
    let base = 0, d1 = 0, d7 = 0;
    for (const set of bySid.values()) {
      if (!set.has(day)) continue;
      base++;
      if (set.has(next)) d1++;
      for (const w of week) if (set.has(w)) { d7++; break; }
    }
    return { day, base, d1: pct(d1, base), d7: pct(d7, base), i: idx };
  });
  const retDays = ret.filter((r) => r.base > 0);
  const d1 = retDays.length ? Math.round((retDays.reduce((s, r) => s + r.d1, 0) / retDays.length) * 10) / 10 : 0;
  const d7 = retDays.length ? Math.round((retDays.reduce((s, r) => s + r.d7, 0) / retDays.length) * 10) / 10 : 0;

  const since24 = now - DAY;
  const hourly = Array.from({ length: 24 }, (_, h) => ({ h, n: 0 }));
  for (const r of S.hourly.all(since24, since24)) if (r.h >= 0 && r.h < 24) hourly[r.h].n = r.n;

  const perfAll = S.perfAll.get(since) || {};
  const list = (rows) => rows.map((r) => ({ k: r.k, n: r.n }));
  return {
    ok: true, days, generatedAt: now, online: Math.max(0, Number(ctx.online) || 0), lastEventAt: (S.lastAt.get() || {}).n || 0,
    totals: {
      sessions, players: active, newSessions: fresh, events, views: t.views || 0,
      bounce: pct(t.bounce || 0, sessions), avgSession: Math.round(t.avgSec || 0),
      runs: daily.reduce((s, d) => s + d.runs, 0), matches: daily.reduce((s, d) => s + d.matches, 0),
    },
    retention: { d1, d7, days: ret.filter((r) => r.base > 0).map(({ day, base, d1: a, d7: b }) => ({ day, base, d1: a, d7: b })) },
    daily, hourly,
    maps: list(S.topMaps.all(since)), modes: list(S.topModes.all(since)),
    paths: list(S.paths.all(since)), refs: list(S.refs.all(since)),
    devices: list(S.devices.all(since)), langs: list(S.langs.all(since)),
    perf: {
      overall: { n: perfAll.n || 0, fps: Math.round((perfAll.fps || 0) * 10) / 10, low1: Math.round((perfAll.low1 || 0) * 10) / 10, ms: Math.round((perfAll.ms || 0) * 10) / 10 },
      presets: S.perfByPreset.all(since).map((r) => ({ preset: r.preset, n: r.n, fps: Math.round((r.fps || 0) * 10) / 10, low1: Math.round((r.low1 || 0) * 10) / 10 })),
      maps: S.perfByMap.all(since).map((r) => ({ map: r.map, n: r.n, fps: Math.round((r.fps || 0) * 10) / 10 })),
    },
    recent: S.recent.all().map((r) => ({ ...r, meta: r.meta ? (() => { try { return JSON.parse(r.meta); } catch { return r.meta; } })() : null })),
    sessions: S.recentSessions.all().map((r) => ({ ...r, sid: r.sid.slice(0, 10), ip: r.ip || null })),
  };
}

export const stats = () => {
  const t = S.totals.get(Date.now() - DAY) || {};
  return { sessions24h: t.sessions || 0, events24h: (S.events.get(Date.now() - DAY) || {}).n || 0 };
};
