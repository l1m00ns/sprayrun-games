// Where the game talks to its backend. Same origin by default (`npm start` serves UI + API + WebSocket on one port).
// To use a separate backend (Render, Railway...), set ONE of:
//   - NEXT_PUBLIC_BACKEND_URL (+ optional NEXT_PUBLIC_WS_URL) in the front-end's .env / hosting settings. Baked in at BUILD time.
//   - public/config.js  ->  window.__RS_CONFIG__ = { backendUrl: 'https://...', wsUrl: '' }. Read at RUN time, no rebuild needed.
// The runtime file wins over the build-time value. Invalid values are ignored with a console warning.

// Next.js only inlines the literal expressions `process.env.NEXT_PUBLIC_X`, hence the explicit reads.
const BUILD = (() => {
  try { return { backend: process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND || '', ws: process.env.NEXT_PUBLIC_WS_URL || '' }; } catch { return { backend: '', ws: '' }; }
})();
const runtime = () => (typeof window !== 'undefined' && window.__RS_CONFIG__) || {};

const warned = new Set();
const warn = (name, v, why) => { const k = name + v; if (warned.has(k)) return; warned.add(k); console.warn(`[config] ${name}="${v}" ignored: ${why}`); };

function clean(v, name, protos) {
  v = String(v || '').trim();
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { warn(name, v, 'not a valid URL (include https://)'); return ''; }
  if (!protos.includes(u.protocol)) { warn(name, v, `expected ${protos.join(' or ')}`); return ''; }
  return v.replace(/\/+$/, '');
}
const cleanHttp = (v, name) => clean(v, name, ['http:', 'https:']);
const cleanWs = (v, name) => { const c = clean(v, name, ['ws:', 'wss:']); return c && !/^wss?:\/\/[^/]+\/./.test(c) ? `${c}/ws` : c; };

export const backendUrl = () => cleanHttp(runtime().backendUrl, 'backendUrl') || cleanHttp(BUILD.backend, 'NEXT_PUBLIC_BACKEND_URL');
export const httpBase = () => backendUrl() || location.origin;

export function wsUrl() {
  const explicit = cleanWs(runtime().wsUrl, 'wsUrl') || cleanWs(BUILD.ws, 'NEXT_PUBLIC_WS_URL');
  if (explicit) return explicit;
  const b = backendUrl();
  if (b) return `${b.replace(/^http/, 'ws')}/ws`; // http -> ws, https -> wss
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function configSource() {
  if (cleanHttp(runtime().backendUrl, 'backendUrl')) return 'runtime (public/config.js)';
  if (cleanHttp(BUILD.backend, 'NEXT_PUBLIC_BACKEND_URL')) return 'build (NEXT_PUBLIC_BACKEND_URL)';
  return 'same origin';
}

// A https page cannot call a plain-http backend (mixed content is blocked by the browser): say so once, clearly.
export function checkConfig() {
  if (typeof location === 'undefined') return;
  const b = backendUrl();
  if (b && location.protocol === 'https:' && b.startsWith('http:') && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(b)) {
    console.warn(`[config] this page is https but the backend is ${b}: browsers block that. Use an https:// backend URL.`);
  }
}
