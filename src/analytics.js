// Client side of the product analytics. Sends a visit, a heartbeat, run/match events and performance samples to
// the backend, which stores them in SQLite and shows them at /analytics. Nothing is sent when the player turns
// "Usage analytics" off in Settings, and nothing is sent while offline. Failures are always silent.
import { httpBase } from './config.js';
import { save } from './save.js';
import { online } from './api.js';

const SID_KEY = 'rs.analytics.sid';
const on = () => save.settings.telemetry !== false && navigator.onLine !== false;
let sid = '';
try {
  sid = sessionStorage.getItem(SID_KEY) || '';
  if (!sid) { sid = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`).slice(0, 36); sessionStorage.setItem(SID_KEY, sid); }
} catch { sid = `t${Date.now().toString(36)}`; }

const base = () => {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* older browser */ }
  return {
    sid, pid: (online.player && online.player.id) || null,
    path: location.pathname + location.search,
    screen: `${window.innerWidth}x${window.innerHeight}@${(window.devicePixelRatio || 1).toFixed(2)}`,
    lang: (document.documentElement.lang || navigator.language || '').slice(0, 12),
    tz, device: (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'touch' : 'desktop',
  };
};

function post(payload, beacon = false) {
  if (!on()) return;
  const url = httpBase() + '/api/analytics/event';
  try {
    const txt = JSON.stringify(payload);
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(url, new Blob([txt], { type: 'application/json' })); return; }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: txt, keepalive: true }).catch(() => { /* never blocks the game */ });
  } catch { /* storage/serialisation issue: ignore */ }
}

export function trackEvent(name, data = {}) {
  if (!on()) return;
  const b = base();
  post({
    ...b, name, map: data.map || null, mode: data.mode || null, quality: data.quality || save.settings.quality || null,
    meta: data.meta || null,
  });
}

// summary is { fps, ms, low1 }; extra carries the startup measurement or the map.
export function trackPerf(summary, preset, gpu, map = null, extra = null) {
  if (!on() || !summary || !Number.isFinite(summary.fps)) return;
  const b = base();
  post({
    ...b, name: 'perf', map,
    perf: { fps: summary.fps, ms: summary.ms, low1: summary.low1, preset: preset || save.settings.quality, gpu: gpu || '', dpr: window.devicePixelRatio || 1 },
    meta: extra || null,
  });
}

let timer = null;
export function initAnalytics() {
  if (!on()) return;
  trackEvent('visit', { meta: { ref: document.referrer || null, w: window.screen && window.screen.width, h: window.screen && window.screen.height } });
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) trackEvent('beat'); }, 25000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { const b = base(); post({ ...b, name: 'beat' }, true); }
  });
  window.addEventListener('pagehide', () => { const b = base(); post({ ...b, name: 'beat' }, true); });
}
