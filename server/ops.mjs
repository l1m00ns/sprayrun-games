// Operations: structured logs, database maintenance (busy timeout, WAL checkpoints, daily backups), graceful shutdown,
// HTTP timeouts and a deep health report. Nothing here changes game rules.
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR } from './db.mjs';
import { BACKEND_FULL_VERSION } from './version.mjs';

const startedAt = Date.now();
export function log(level, msg, data = {}) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

let maintenanceOn = false;
export function startMaintenance() {
  if (maintenanceOn) return; maintenanceOn = true;
  try { db.exec('PRAGMA busy_timeout = 5000'); } catch { /* old sqlite */ }
  const checkpoint = () => { try { db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch (e) { log('error', 'wal checkpoint failed', { err: String(e && e.message) }); } };
  const backup = () => { // one consistent copy a day, the last 7 are kept (set DATA_DIR on a persistent disk to benefit from them)
    try {
      const dir = path.join(DATA_DIR, 'backups'); fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `rs-${new Date().toISOString().slice(0, 10)}.db`);
      if (!fs.existsSync(file)) { db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); log('info', 'backup written', { file }); }
      for (const old of fs.readdirSync(dir).filter((x) => /^rs-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort().slice(0, -7)) fs.rmSync(path.join(dir, old), { force: true });
    } catch (e) { log('error', 'backup failed', { err: String(e && e.message) }); }
  };
  for (const [fn, every, first] of [[checkpoint, 600e3, 60e3], [backup, 6 * 3600e3, 45e3]]) { setTimeout(fn, first).unref(); setInterval(fn, every).unref(); }
}

// Same limits everywhere a Node HTTP server is created (slow-loris protection; keep-alive above common proxy idle timeouts).
export function hardenServer(server) { server.headersTimeout = 20000; server.requestTimeout = 30000; server.keepAliveTimeout = 65000; server.maxRequestsPerSocket = 0; }

let closing = false;
export function installShutdown(server, clients) {
  const stop = (sig) => {
    if (closing) return; closing = true;
    log('info', 'shutting down', { sig });
    try { server.close(); } catch { /* not listening */ }
    for (const ws of clients()) { try { ws.send(JSON.stringify({ t: 'server_restart' })); ws.close(1012, 'restart'); } catch { /* already gone */ } } // clients reconnect on their own
    try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* closing */ }
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
export const isClosing = () => closing;

export function deepHealth(extra = {}) {
  let dbOk = false, dbMs = -1;
  try { const t = performance.now(); dbOk = db.prepare('SELECT 1 AS x').get().x === 1; dbMs = Math.round((performance.now() - t) * 100) / 100; } catch { /* reported below */ }
  const mem = process.memoryUsage();
  return { ok: dbOk && !closing, db: { ok: dbOk, ms: dbMs }, version: BACKEND_FULL_VERSION, uptime_s: Math.round((Date.now() - startedAt) / 1000), memory_mb: Math.round(mem.rss / 1048576), node: process.version, closing, ...extra };
}
