// Analytics storage: ingestion, session aggregation, performance samples and retention shape. In-process, no browser.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-an-'));
const A = await import('../server/analytics.mjs');
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('PASS ', name, extra); } else { fail++; console.log('FAIL ', name, extra); } };

const ctx = { ip: '203.0.113.5', ua: 'Mozilla/5.0 test', ref: 'https://example.com/' };
A.track({ sid: 's1', name: 'visit', path: '/', screen: '1280x720@1', lang: 'fr', tz: 'Europe/Paris', device: 'desktop' }, ctx);
A.track({ sid: 's1', name: 'beat' }, ctx);
A.track({ sid: 's1', name: 'run_start', path: '/', map: 'city', mode: 'classic', quality: 'high' }, ctx);
A.track({ sid: 's1', name: 'run_end', path: '/', map: 'city', mode: 'classic', meta: { score: 1000, dist: 500 } }, ctx);
A.track({ sid: 's1', name: 'perf', perf: { fps: 60, low1: 55, ms: 16.7, preset: 'high', gpu: 'RTX 3060', dpr: 1 } }, ctx);
A.track({ sid: 's2', name: 'visit', path: '/?ref=test' }, { ip: '198.51.100.9', ua: 'other', ref: '' });

const d = A.summary(7, { online: 3 });
ok(d.totals.sessions === 2, 'two sessions recorded', JSON.stringify(d.totals));
ok(d.totals.players === 2, 'two distinct players', String(d.totals.players));
ok(d.totals.runs === 1 && d.totals.events === 6, 'runs and events counted', `${d.totals.runs}/${d.totals.events}`);
ok(d.daily.at(-1).runs === 1 && d.daily.at(-1).players === 2, 'daily bucket of today', JSON.stringify(d.daily.at(-1)));
ok(d.maps[0] && d.maps[0].k === 'city' && d.maps[0].n === 1, 'top map', JSON.stringify(d.maps[0]));
ok(d.perf.overall.n === 1 && Math.round(d.perf.overall.fps) === 60, 'performance sample aggregated', JSON.stringify(d.perf.overall));
ok(d.perf.presets.some((p) => p.preset === 'high' && p.n === 1), 'performance by preset');
ok(d.online === 3, 'live count passed through');
ok(d.sessions.length === 2 && d.sessions.some((s) => s.ip === '203.0.113.5'), 'recent sessions keep the IP for moderation');
ok(d.retention && typeof d.retention.d1 === 'number', 'retention is computed', JSON.stringify(d.retention.d1));

// A bad name or oversized payload never crashes the ingestion.
A.track({ sid: 's3', name: 'NOT A NAME', meta: { x: 'y'.repeat(5000) } }, { ip: '192.0.2.7', ua: '' });
const d2 = A.summary(1);
ok(d2.totals.events === 7, 'unknown event names are stored as "unknown" and do not throw', String(d2.totals.events));

// Per-IP flood protection.
let accepted = 0;
for (let i = 0; i < 140; i++) { const r = A.track({ sid: 'flood', name: 'beat' }, { ip: '192.0.2.99', ua: 'flood' }); if (r.ok) accepted++; }
ok(accepted < 140, 'a flood from one IP is capped', `accepted=${accepted}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
