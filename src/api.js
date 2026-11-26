// Client for the Reverse Surfers backend (REST). Every call fails soft: the game stays fully playable offline.
import { save, persist } from './save.js';
import { collect, deviceId } from './device.js';

export const online = { vpn: null, token: null, player: null, ticket: null, submitted: false, ping: null, wallet: 0, inv: null, events: null, serverOffset: 0, sanction: null };

// Backend address: same origin by default; NEXT_PUBLIC_BACKEND_URL or public/config.js point it elsewhere (see config.js).
import { httpBase, checkConfig } from './config.js';
export { httpBase, wsUrl, backendUrl, configSource } from './config.js';

export async function call(method, path, body, auth = true, timeout = 6000) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(httpBase() + path, {
      method, signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(auth && online.token ? { Authorization: 'Bearer ' + online.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    if (r.status === 403 && (json.error === 'banned' || json.error === 'kicked')) online.sanction = json; // surfaced by the UI as a native dialog
    if (r.status === 403 && json.error === 'vpn_blocked') online.vpn = json; else if (r.ok && online.vpn) online.vpn = null;
    return { status: r.status, json };
  } catch (e) { return null; } finally { clearTimeout(to); }
}

export async function health() { const r = await call('GET', '/api/health', null, false, 2500); return !!(r && r.status === 200); }

function adopt(j) { // take over the server's view of the player (profile + wallet + inventory)
  if (j.player) online.player = j.player;
  if (j.wallet !== undefined) online.wallet = j.wallet;
  if (j.inv) online.inv = j.inv;
  if (j.events) online.events = j.events;
  if (j.serverTime) online.serverOffset = j.serverTime - Date.now();
}
export const serverNow = () => Date.now() + online.serverOffset;

// Resume the saved session, or create a guest. Returns the player profile (or null when the server is unreachable).
export async function ensureAccount(name) {
  if (online.player) return online.player;
  if (save.account && save.account.token) {
    online.token = save.account.token;
    const r = await call('GET', '/api/me');
    if (r && r.status === 200) { adopt(r.json); return online.player; }
    if (!r) return null; // unreachable: keep the token for next time
    online.token = null; save.account = null; // token revoked (password change / ban): start fresh
  }
  const r = await call('POST', '/api/auth/guest', { name }, false);
  if (r && r.status === 200) { online.token = r.json.token; online.player = r.json.player; save.account = { token: online.token }; persist(); await refreshMe(); }
  return online.player;
}
export async function refreshMe() { const r = await call('GET', '/api/me'); if (r && r.status === 200) adopt(r.json); return online.player; }
export async function rename(name) { const r = await call('POST', '/api/me', { name }); if (r && r.status === 200) adopt(r.json); return r; }
export async function leaderboard(board, period) { const r = await call('GET', `/api/leaderboard?board=${board}&period=${period}&limit=50`); return r && r.status === 200 ? r.json : null; }
export async function startTicket(mode, daily, map) { const r = await call('POST', '/api/run/start', { mode, daily, map }); return r && r.status === 200 ? r.json : null; }
export async function finishRun(payload) {
  const r = await call('POST', '/api/run/finish', payload, true, 9000);
  if (r && r.json) { if (r.json.player) online.player = r.json.player; if (r.json.reward) { online.wallet = r.json.reward.wallet; online.inv = r.json.reward.inv; } }
  return r ? r.json : null;
}

// ---- accounts + cloud save
function adoptAuth(r) { if (r && r.status === 200 && r.json.token) { online.token = r.json.token; online.player = r.json.player; adopt(r.json); save.account = { token: online.token }; persist(); } return r; }
export const register = async (username, password, name) => adoptAuth(await call('POST', '/api/auth/register', { did: deviceId(), username, password, name, local: { coins: save.coins, boards: save.boards, upgrades: save.upgrades, unlocked: save.unlocked } }));
export const login = async (username, password) => adoptAuth(await call('POST', '/api/auth/login', { username, password }, false));
export async function logout() { online.token = null; online.player = null; online.wallet = 0; online.inv = null; save.account = null; persist(); }
export const changePassword = async (old, nw) => { const r = await call('POST', '/api/auth/password', { old, new: nw }); if (r && r.status === 200) { online.token = r.json.token; save.account = { token: online.token }; persist(); } return r; };
export const signOutEverywhere = async () => { const r = await call('POST', '/api/auth/signout-all'); if (r && r.status === 200) { online.token = r.json.token; save.account = { token: online.token }; persist(); } return r; };
export const getCloud = () => call('GET', '/api/save');
export const putCloud = (ver, data) => call('PUT', '/api/save', { ver, data });

// ---- shop / economy / progression
export async function shop() { const r = await call('GET', '/api/shop'); if (r && r.status === 200) adopt(r.json); return r && r.status === 200 ? r.json : null; }
export async function buy(item) { const r = await call('POST', '/api/shop/buy', { item }); if (r && r.json && r.json.ok) adopt(r.json); return r; }
export async function equip(slot, id) { const r = await call('POST', '/api/shop/equip', { slot, id }); if (r && r.json && r.json.ok) adopt(r.json); return r; }
export const career = async () => { const r = await call('GET', '/api/career'); return r && r.status === 200 ? r.json : null; };
export const profileByName = async (name) => { const r = await call('GET', '/api/profile?name=' + encodeURIComponent(name)); return r && r.status === 200 ? r.json : null; };
export const events = async () => { const r = await call('GET', '/api/events', null, false); if (r && r.status === 200) { online.events = r.json; online.serverOffset = r.json.serverTime - Date.now(); return r.json; } return null; };
export const advent = async () => { const r = await call('GET', '/api/advent'); if (r && r.status === 200) { online.serverOffset = r.json.serverTime - Date.now(); return r.json; } return null; };
export async function claimAdvent(day) { const r = await call('POST', '/api/advent/claim', { day }); if (r && r.json && r.json.ok) adopt(r.json); return r; }
export const tournaments = async () => { const r = await call('GET', '/api/tournaments'); return r && r.status === 200 ? r.json : null; };
export const tournament = async (id) => { const r = await call('GET', '/api/tournaments/' + encodeURIComponent(id)); return r && r.status === 200 ? r.json : null; };
export const updates = async () => { const r = await call('GET', '/api/updates', null, false); return r && r.status === 200 ? r.json.updates : null; };

// ---- support
export const supportTickets = async () => { const r = await call('GET', '/api/support/tickets'); return r && r.status === 200 ? r.json.tickets : null; };
export const supportTicket = async (id) => { const r = await call('GET', '/api/support/tickets/' + id); return r && r.status === 200 ? r.json : null; };
export const supportOpen = (subject, message, category) => call('POST', '/api/support/tickets', { subject, message, category }, true, 70000);
export const supportSend = (id, text) => call('POST', `/api/support/tickets/${id}/messages`, { text }, true, 70000);
export const supportClose = (id) => call('POST', `/api/support/tickets/${id}/close`);
export const supportEscalate = (id) => call('POST', `/api/support/tickets/${id}/escalate`);

// ---- fair play: device report, appeals, statistics
let lastDevice = 0;
export async function reportDevice(force = false) {
  if (!online.token || (!force && Date.now() - lastDevice < 6 * 3600e3)) return null;
  lastDevice = Date.now();
  const d = await collect();
  const r = await call('POST', '/api/device', d, true, 15000);
  return r && r.json;
}
export const appeals = async () => { const r = await call('GET', '/api/appeals'); return r && r.status === 200 ? r.json : null; };
export const appealDetail = async (id) => { const r = await call('GET', '/api/appeals/' + id); return r && r.status === 200 ? r.json : null; };
export const fileAppeal = (type, message) => call('POST', '/api/appeals', { type, message }, true, 15000);
export const stats = async () => { const r = await call('GET', '/api/stats'); return r && r.status === 200 ? r.json : null; };

if (typeof window !== "undefined") checkConfig();
