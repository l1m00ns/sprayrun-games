// Accounts: username + password (scrypt), guest -> account upgrade, token issue / revocation, cloud save with versioning.
import { q, tx } from './db.mjs';
import { sign, uuid, hashPassword, checkPassword } from './auth.mjs';
import { nowMs } from './catalog.mjs';

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const RESERVED = /^(admin|administrator|support|staff|moderator|mod|system|root|reverse|reversesurfers|anticheat|server|null|undefined)$/i;
const BAD_WORDS = /(fuck|shit|nigg|fag|rape|nazi|hitler|cunt|bitch)/i;

export const cleanName = (s) => String(s ?? 'Runner').replace(/[^\p{L}\p{N} _\-.!]/gu, '').trim().slice(0, 14) || 'Runner';
export function nameProblem(name) {
  if (BAD_WORDS.test(name)) return 'That name is not allowed';
  if (RESERVED.test(name.replace(/\s+/g, ''))) return 'That name is reserved';
  return null;
}

export const issueToken = (p) => sign({ pid: p.id, iat: nowMs(), v: p.tokver | 0 });

// ---- brute-force protection (per username and per ip)
const fails = new Map(); // key -> { n, t }
function throttled(key) { const f = fails.get(key); return !!f && f.n >= 8 && nowMs() - f.t < 10 * 60 * 1000; }
function failed(key) { const f = fails.get(key) || { n: 0, t: nowMs() }; if (nowMs() - f.t > 10 * 60 * 1000) { f.n = 0; } f.n++; f.t = nowMs(); fails.set(key, f); }
setInterval(() => { for (const [k, f] of fails) if (nowMs() - f.t > 15 * 60 * 1000) fails.delete(k); }, 60000).unref();

export function register({ guest, username, password, name, ip }) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!USERNAME_RE.test(username)) return { ok: false, error: 'bad_username', message: 'Username: 3-16 letters, digits or _' };
  if (RESERVED.test(username) || BAD_WORDS.test(username)) return { ok: false, error: 'bad_username', message: 'That username is not allowed' };
  if (password.length < 8 || password.length > 72) return { ok: false, error: 'bad_password', message: 'Password: 8 to 72 characters' };
  if (password.toLowerCase() === username.toLowerCase()) return { ok: false, error: 'bad_password', message: 'Password must differ from the username' };
  if (throttled('ip:' + ip + ':reg')) return { ok: false, error: 'rate_limited' };
  failed('ip:' + ip + ':reg'); // registrations count against the same bucket: 8 / 10 min / ip
  const display = cleanName(name || username);
  const np = nameProblem(display);
  if (np) return { ok: false, error: 'bad_name', message: np };
  return tx(() => {
    if (q.getByUsername.get(username)) return { ok: false, error: 'username_taken', message: 'That username is already taken' };
    const { hash, salt } = hashPassword(password);
    let pid;
    if (guest && !guest.username) { pid = guest.id; q.setCredentials.run(username, hash, salt, display, pid); }
    else { pid = uuid(); q.addPlayer.run(pid, display, nowMs()); q.setCredentials.run(username, hash, salt, display, pid); }
    const p = q.getPlayer.get(pid);
    return { ok: true, player: p, token: issueToken(p), upgraded: !!(guest && !guest.username) };
  });
}

export function login({ username, password, ip }) {
  username = String(username || '').trim();
  const kU = 'user:' + username.toLowerCase(), kI = 'ip:' + ip + ':login';
  if (throttled(kU) || throttled(kI)) return { ok: false, error: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' };
  const p = USERNAME_RE.test(username) ? q.getByUsername.get(username) : null;
  // always run a hash so timing doesn't reveal whether the username exists
  const good = p ? checkPassword(String(password || ''), p.pass_hash, p.pass_salt) : (hashPassword('x'), false);
  if (!good) { failed(kU); failed(kI); return { ok: false, error: 'bad_credentials', message: 'Wrong username or password' }; }
  fails.delete(kU);
  return { ok: true, player: p, token: issueToken(p) };
}

export function changePassword(p, oldPw, newPw) {
  if (!checkPassword(String(oldPw || ''), p.pass_hash, p.pass_salt)) return { ok: false, error: 'bad_credentials', message: 'Current password is wrong' };
  if (String(newPw).length < 8 || String(newPw).length > 72) return { ok: false, error: 'bad_password', message: 'Password: 8 to 72 characters' };
  const { hash, salt } = hashPassword(newPw);
  q.setPassword.run(hash, salt, p.id); // bumps tokver: every other session is signed out
  return { ok: true, token: issueToken(q.getPlayer.get(p.id)) };
}
export function signOutEverywhere(p) { q.bumpTokver.run(p.id); return issueToken(q.getPlayer.get(p.id)); }

// ------------------------------------------------------------------------------------- cloud save
// The cloud save carries preferences and non-economy progress. Coins, boards, upgrades and unlocks live in the
// server wallet/inventory and are stripped from anything a client uploads.
const BLOCKED = new Set(['coins', 'boards', 'upgrades', 'unlocked', 'account', 'wallet', 'inv', 'xp']);
function clean(v, depth = 0) {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') return v.slice(0, 200);
  if (depth > 3) return undefined;
  if (Array.isArray(v)) return v.slice(0, 40).map((x) => clean(x, depth + 1)).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const o = {};
    let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (BLOCKED.has(k) || !/^[A-Za-z0-9_]{1,32}$/.test(k) || ++n > 80) continue;
      const c = clean(x, depth + 1);
      if (c !== undefined) o[k] = c;
    }
    return o;
  }
  return undefined;
}
export const sanitizeSave = (data) => clean(data && typeof data === 'object' ? data : {});

export function getCloud(pid) {
  const r = q.getSave.get(pid);
  return r ? { ver: r.ver, data: JSON.parse(r.data), updated: r.updated } : { ver: 0, data: null, updated: 0 };
}
export function putCloud(pid, ver, data) {
  const clean = sanitizeSave(data);
  const json = JSON.stringify(clean);
  if (json.length > 20000) return { ok: false, error: 'too_large' };
  return tx(() => {
    const cur = q.getSave.get(pid);
    const curVer = cur ? cur.ver : 0;
    if (Number(ver) !== curVer) return { ok: false, error: 'conflict', ver: curVer, data: cur ? JSON.parse(cur.data) : null };
    q.putSave.run(pid, curVer + 1, json, nowMs());
    return { ok: true, ver: curVer + 1 };
  });
}
