// Friendly responses for the paths a person (or a hosting platform) hits by hand: "/", "/health", "/api", unknown URLs.
// The game itself only uses /api/* and /ws; these exist so that opening the backend URL in a browser shows what it is
// instead of a bare {"error":"not_found"}.
import { reply } from './http.mjs';
import { BACKEND_FULL_VERSION } from './version.mjs';
import { analyticsPage } from './analytics-page.mjs';

const startedAt = Date.now();
const GROUPS = [
  ['Status', ['GET /api/health', 'GET /api/vpn', 'GET /api/events', 'GET /api/updates']],
  ['Accounts', ['POST /api/auth/guest', 'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/password', 'POST /api/auth/signout-all', 'GET /api/me', 'POST /api/me', 'GET|PUT /api/save']],
  ['Economy', ['GET /api/shop', 'POST /api/shop/buy', 'POST /api/shop/equip', 'GET /api/advent', 'POST /api/advent/claim', 'POST /api/codes/redeem']],
  ['Events', ['GET /api/events', 'POST /api/events/claim']],
  ['Runs and ranking', ['POST /api/run/start', 'POST /api/run/finish', 'GET /api/leaderboard', 'GET /api/profile', 'GET /api/career', 'GET /api/stats', 'GET /api/stats/global']],
  ['Support and appeals', ['GET|POST /api/support', 'GET /api/support/status', 'GET|POST /api/support/tickets', 'GET|POST /api/appeals']],
  ['Realtime', ['WebSocket /ws (ranked queue, rooms, Gold Rush duel)']],
  ['Analytics', ['POST /api/analytics/event', 'GET /api/analytics/summary (ADMIN_KEY)', 'GET /analytics (dashboard)']],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function info(host) {
  return {
    name: 'Reverse Surfers backend', status: 'ok', version: BACKEND_FULL_VERSION, uptime_s: Math.round((Date.now() - startedAt) / 1000),
    health: '/api/health', websocket: '/ws', cors_origin: process.env.CORS_ORIGIN || '*', host,
    endpoints: Object.fromEntries(GROUPS),
  };
}

function page(host) {
  const d = info(host);
  const rows = GROUPS.map(([g, list]) => `<h2>${esc(g)}</h2><ul>${list.map((e) => `<li><code>${esc(e)}</code></li>`).join('')}</ul>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reverse Surfers backend</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0e1117;color:#eceff4;font:16px/1.5 system-ui,Segoe UI,sans-serif}main{max-width:720px;margin:0 auto;padding:48px 20px}
h1{font-size:28px;margin:0 0 4px}p{color:#9aa2b1;margin:4px 0 24px}.ok{display:inline-flex;align-items:center;gap:8px;color:#7ee0a0}.ok i{width:8px;height:8px;border-radius:50%;background:#7ee0a0}
h2{font-size:13px;font-weight:600;color:#9aa2b1;margin:28px 0 8px}ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}code{display:block;padding:4px 10px;border-radius:8px;background:#171b24;border:1px solid #232834;font-size:13px}
a{color:#ffd23f}</style></head><body><main><span class="ok"><i></i>Running</span><h1>Reverse Surfers backend</h1>
<p>Version ${esc(d.version)}, up ${esc(d.uptime_s)} s. This server has no web page: the game talks to it under <code style="display:inline;padding:1px 6px">/api</code> and <code style="display:inline;padding:1px 6px">/ws</code>. <a href="/api/health">Check health</a> or <a href="/api">list the endpoints as JSON</a>.</p>${rows}</main></body></html>`;
}

// Returns true when the request was answered here.
export function landing(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const head = req.method === 'HEAD';
  if (req.method !== 'GET' && !head) return false;
  const host = req.headers.host || '';
  if (p === '/health' || p === '/healthz') { reply(res, 200, { ok: true }); return true; } // platform health checks (Render, Fly, Railway)
  if (p === '/api') { reply(res, 200, info(host)); return true; }
  if (p === '/analytics' || p === '/analytics.html') {
    // The page shell is public; the numbers require the ADMIN_KEY and are fetched from /api/analytics/summary.
    const html = analyticsPage();
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    });
    res.end(head ? undefined : html);
    return true;
  }
  if (p === '/favicon.ico') { res.writeHead(204); res.end(); return true; }
  if (p === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end(head ? undefined : 'User-agent: *\nDisallow: /api/\n'); return true; }
  if (p === '/') {
    if (String(req.headers.accept || '').includes('text/html')) {
      const html = page(host);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(head ? undefined : html);
    } else reply(res, 200, info(host));
    return true;
  }
  return false;
}

export function notFound(req, res) {
  reply(res, 404, { error: 'not_found', message: `No such path: ${req.method} ${String(req.url).split('?')[0]}`, hint: 'The API lives under /api (try GET /api/health). The realtime socket is /ws.' });
}
