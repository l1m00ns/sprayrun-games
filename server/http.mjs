// Small HTTP helpers shared by the REST routes.
import { q } from './db.mjs';
import { verify } from './auth.mjs';
import { nowMs } from './catalog.mjs';

// CORS_ORIGIN = the front-end's address(es), comma separated (e.g. https://my-game.vercel.app). Default "*" (any site may call the API).
export const ALLOWED_ORIGINS = () => (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
export function corsOrigin(origin) {
  const list = ALLOWED_ORIGINS();
  if (list.includes('*')) return '*';
  return origin && list.includes(origin) ? origin : list[0];
}
// WebSocket handshakes are not covered by CORS: this is the same check, applied to the Origin header of /ws.
export function originAllowed(origin) {
  const list = ALLOWED_ORIGINS();
  if (list.includes('*') || !origin) return true; // non-browser clients (tests, tools) send no Origin
  return list.includes(String(origin).replace(/\/+$/, ''));
}

export function reply(res, code, obj) {
  const origin = corsOrigin(res.req && res.req.headers && res.req.headers.origin);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(origin !== '*' ? { Vary: 'Origin' } : {}),
  });
  res.end(JSON.stringify(obj));
}

export function readJson(req, max = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Banned / kicked accounts can still sign in (to read the reason and contact support) - the play endpoints check access separately.
export function authPlayer(req) {
  const h = req.headers.authorization || '';
  const tok = verify(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!tok || !tok.pid) return null;
  const p = q.getPlayer.get(tok.pid);
  if (!p || (p.tokver | 0) !== (tok.v | 0)) return null; // password change / "sign out everywhere" / ban revoke old tokens
  if (nowMs() - p.last_seen > 60000) q.touchSeen.run(nowMs(), p.id);
  return p;
}

export const clientIp = (req) => (process.env.TEST_TRUST_IP_HEADER && req.headers['x-test-ip'] ? String(req.headers['x-test-ip']) : (process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?');
