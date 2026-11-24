// Anti-VPN / IP intelligence. Layers (each adds to a score; >= 60 blocks):
//   1. Tor exit list (check.torproject.org, refreshed hourly)                         +100
//   2. Public VPN CIDR list (X4BNet/lists_vpn) and datacenter CIDR list               +90 / +60
//   3. Provider lookup (ip-api.com or its pro endpoint): proxy / hosting flags, ASN, ISP, org, timezone   +80 / +70
//   4. Brand rule: the ISP / org / ASN name is a VPN BRAND (ProtonVPN, NordVPN, Mullvad ...), not a real access provider   +90
//   5. Soft: hosting-company wording, client timezone != IP timezone                  +30 / +15
// Real consumer ISPs and mobile carriers pass. Private / loopback addresses are never checked (local dev).
// Honest limits: residential-proxy networks and brand-new VPN servers can slip through; a provider outage fails OPEN
// (the player is not blocked, the event is marked "unknown"). Policy: VPN_POLICY=block (default) | flag | off.
import './env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { DATA_DIR, db } from './db.mjs';
import { hashId } from './auth.mjs';

const now = () => Date.now();
export const policy = () => (process.env.VPN_POLICY || 'block').toLowerCase();

// ------------------------------------------------------------------------------------------ addresses
export function normalizeIp(ip) {
  ip = String(ip || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}
export function isPrivateIp(ip) {
  ip = normalizeIp(ip);
  if (!ip || ip === '::1' || ip === '?') return true;
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127); }
  return /^(fc|fd|fe80)/i.test(ip);
}
const ip2n = (ip) => ip.split('.').reduce((n, x) => n * 256 + Number(x), 0);
export const ip24 = (ip) => { ip = normalizeIp(ip); return net.isIPv4(ip) ? ip.split('.').slice(0, 3).join('.') : ip.split(':').slice(0, 4).join(':'); };

// ------------------------------------------------------------------------------------------ lists
const lists = { tor: { set: new Set(), at: 0 }, vpn: { r: [], at: 0 }, dc: { r: [], at: 0 }, errors: {} };
const SOURCES = {
  vpn: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
  dc: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt',
  tor: 'https://check.torproject.org/torbulkexitlist',
};
function parseCidrs(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d+)/.exec(line.trim());
    if (!m) continue;
    const start = ip2n(m[1]), size = 2 ** (32 - Number(m[2]));
    out.push([start, start + size - 1]);
  }
  out.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of out) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1] + 1) l[1] = Math.max(l[1], r[1]); else merged.push(r); }
  return merged;
}
const inRanges = (ranges, n) => { let lo = 0, hi = ranges.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; const r = ranges[mid]; if (n < r[0]) hi = mid - 1; else if (n > r[1]) lo = mid + 1; else return true; } return false; };
async function refreshList(key, ttl) {
  const file = path.join(DATA_DIR, `iplist_${key}.txt`);
  let text = null;
  try { if (fs.existsSync(file) && now() - fs.statSync(file).mtimeMs < ttl) text = fs.readFileSync(file, 'utf8'); } catch { /* re-download */ }
  if (text === null) {
    try {
      const r = await fetch(SOURCES[key], { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      text = await r.text(); fs.writeFileSync(file, text); delete lists.errors[key];
    } catch (e) { lists.errors[key] = String(e.message); try { text = fs.readFileSync(file, 'utf8'); } catch { return; } } // stale copy beats no copy
  }
  if (key === 'tor') { lists.tor.set = new Set(text.split('\n').map((x) => x.trim()).filter((x) => net.isIP(x))); lists.tor.at = now(); }
  else { lists[key].r = parseCidrs(text); lists[key].at = now(); }
}
export async function warmLists() {
  if (process.env.IPINTEL_OFFLINE) return;
  await Promise.all([refreshList('tor', 3600e3), refreshList('vpn', 24 * 3600e3), refreshList('dc', 24 * 3600e3)]);
}
if (!process.env.IPINTEL_OFFLINE && process.env.NODE_ENV !== 'test') { warmLists().catch(() => {}); setInterval(() => warmLists().catch(() => {}), 3600e3).unref(); }

// ------------------------------------------------------------------------------------------ rules
const BRANDS = [
  ['ProtonVPN', /proton ?(vpn|ag)?\b|protonvpn|\bproton\b/i], ['NordVPN', /nord ?vpn|tefincom|nordsec/i], ['Mullvad', /mullvad|31173 services/i], ['ExpressVPN', /express ?vpn|express vpn|kape technologies/i],
  ['Surfshark', /surfshark/i], ['CyberGhost', /cyber ?ghost/i], ['Private Internet Access', /private internet access|\bpia\b/i], ['Windscribe', /windscribe/i], ['IVPN', /\bivpn\b|privatelayer/i],
  ['hide.me', /hide\.me|eVenturi/i], ['TunnelBear', /tunnel ?bear/i], ['Hotspot Shield', /hotspot ?shield|anchorfree|pango/i], ['VyprVPN', /vypr ?vpn|golden frog/i], ['TorGuard', /tor ?guard/i],
  ['AirVPN', /air ?vpn/i], ['PureVPN', /pure ?vpn/i], ['IPVanish', /ip ?vanish/i], ['HideMyAss', /hide ?my ?ass|\bhma\b/i], ['Astrill', /astrill/i], ['Perfect Privacy', /perfect[- ]privacy/i],
  ['CactusVPN', /cactus ?vpn/i], ['StrongVPN', /strong ?vpn/i], ['KeepSolid', /keepsolid|vpn unlimited/i], ['Urban VPN', /urban ?vpn/i], ['Psiphon', /psiphon/i], ['Lantern', /\blantern\b/i],
  ['Speedify', /speedify|connectify/i], ['Atlas VPN', /atlas ?vpn/i], ['Betternet', /betternet/i], ['ZenMate', /zen ?mate/i], ['Ovpn', /\bovpn\b/i], ['PrivadoVPN', /privado ?vpn/i],
  ['Generic VPN', /\bvpn\b|virtual private network/i], ['Generic proxy', /\bproxy\b|anonymi[sz]er|\bsocks\b/i], ['Tor', /tor (project|exit|relay)/i],
];
const HOSTING_HINT = /(m247|datacamp|cdn77|leaseweb|\bovh\b|hetzner|digitalocean|linode|vultr|choopa|amazon|\baws\b|google (cloud|llc)|microsoft|azure|oracle|contabo|scaleway|ionos|hostinger|hosting|datacenter|data center|colocation|\bvps\b|dedicated|quadranet|psychz|frantech|zenlayer|packet ?host|serverius|cloud)/i;

// ------------------------------------------------------------------------------------------ provider
const bucket = { n: 0, t: 0 };
const cache = new Map(); // ipHash -> { at, intel }
db.exec('CREATE TABLE IF NOT EXISTS ip_intel (h TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ip_allow (h TEXT PRIMARY KEY, note TEXT, at INTEGER NOT NULL);');
const getRow = db.prepare('SELECT data, at FROM ip_intel WHERE h = ?'), putRow = db.prepare('INSERT INTO ip_intel (h, data, at) VALUES (?, ?, ?) ON CONFLICT(h) DO UPDATE SET data = excluded.data, at = excluded.at');
const allowed = db.prepare('SELECT 1 AS ok FROM ip_allow WHERE h = ?');
export const allowIp = (ip, note = '') => { db.prepare('INSERT OR REPLACE INTO ip_allow (h, note, at) VALUES (?, ?, ?)').run(hashId(normalizeIp(ip)), note.slice(0, 80), now()); cache.clear(); };

async function lookup(ip) {
  if (process.env.IPINTEL_OFFLINE) return null;
  const t = now();
  if (t - bucket.t > 60000) { bucket.t = t; bucket.n = 0; }
  if (++bucket.n > 38) return null; // stay under the free tier's 45 requests / minute
  const key = process.env.IPAPI_KEY;
  const fields = 'status,message,country,countryCode,timezone,isp,org,as,asname,mobile,proxy,hosting,query';
  const url = key ? `https://pro.ip-api.com/json/${ip}?key=${key}&fields=${fields}` : `http://ip-api.com/json/${ip}?fields=${fields}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    return j && j.status === 'success' ? j : null;
  } catch { return null; }
}

// ------------------------------------------------------------------------------------------ main check
// opts.tz: the timezone reported by the client (soft signal only)
export async function check(rawIp, opts = {}) {
  const ip = normalizeIp(rawIp);
  const h = hashId(ip);
  const base = { ipHash: h, ip24: hashId(ip24(ip)) };
  if (policy() === 'off' || isPrivateIp(ip) || process.env.IPINTEL_OFFLINE === 'allow') return { ...base, class: 'local', block: false, score: 0, reasons: [] };
  if (allowed.get(h)) return { ...base, class: 'allowlisted', block: false, score: 0, reasons: ['allowlisted by an administrator'] };
  const hit = cache.get(h);
  let intel = hit && now() - hit.at < 6 * 3600e3 ? hit.intel : null;
  if (!intel) {
    const row = getRow.get(h);
    if (row && now() - row.at < 24 * 3600e3) { try { intel = JSON.parse(row.data); } catch { intel = null; } }
  }
  if (!intel) {
    const p = await lookup(ip);
    intel = { provider: p ? { isp: p.isp, org: p.org, as: p.as, asname: p.asname, cc: p.countryCode, tz: p.timezone, mobile: !!p.mobile, proxy: !!p.proxy, hosting: !!p.hosting } : null };
    if (p) putRow.run(h, JSON.stringify(intel), now());
  }
  cache.set(h, { at: now(), intel });
  return { ...base, ...scoreIntel(ip, intel, opts) };
}

// Pure scoring (no network): used by check() and by the unit tests.
export function scoreIntel(ip, intel, opts = {}) {
  const P = (intel && intel.provider) || {};
  const reasons = []; let score = 0, cls = P.mobile ? 'mobile' : intel && intel.provider ? 'residential' : 'unknown', brand = null;
  const add = (pts, why, c) => { score += pts; reasons.push(why); if (c) cls = c; };
  if (net.isIPv4(ip)) {
    const n = ip2n(ip);
    if (lists.tor.set.has(ip)) add(100, 'Tor exit node', 'tor');
    if (inRanges(lists.vpn.r, n)) add(90, 'listed in the public VPN address ranges', 'vpn');
    if (inRanges(lists.dc.r, n)) add(60, 'datacenter address range (not a home connection)', 'hosting');
  }
  if (P.proxy) add(80, 'provider flags this address as a proxy / VPN', cls === 'tor' || cls === 'vpn' ? cls : 'proxy');
  if (P.hosting) add(70, 'provider flags this address as hosting / datacenter', cls === 'tor' || cls === 'vpn' || cls === 'proxy' ? cls : 'hosting');
  const text = `${P.isp || ''} ${P.org || ''} ${P.asname || ''} ${P.as || ''}`;
  for (const [name, re] of BRANDS) if (text.trim() && re.test(text)) { brand = name; add(90, `the network belongs to a VPN brand (${name}), not to a real access provider`, 'vpn'); break; }
  if (!brand && !P.hosting && text.trim() && HOSTING_HINT.test(text)) add(30, 'the network name looks like a hosting company');
  if (opts.tz && P.tz && opts.tz !== P.tz && !/^(Etc|UTC)/.test(opts.tz)) add(15, `device timezone (${opts.tz}) differs from the IP location (${P.tz})`);
  const block = score >= 60 && policy() === 'block';
  return { class: score >= 60 ? cls : (score >= 30 ? 'suspicious' : cls), block, score, reasons, brand, asn: P.as || null, org: P.org || P.isp || null, isp: P.isp || null, country: P.cc || null, tz: P.tz || null, mobile: !!P.mobile, known: !!(intel && intel.provider) };
}

// What the API says to a blocked player. Never reveals thresholds.
export const blockedReply = (r) => ({ error: 'vpn_blocked', message: 'A VPN, proxy or datacenter connection was detected. Turn it off to play online (offline play still works).', class: r.class, brand: r.brand || null });

export const intelStatus = () => ({ policy: policy(), torExits: lists.tor.set.size, vpnRanges: lists.vpn.r.length, datacenterRanges: lists.dc.r.length, refreshed: { tor: lists.tor.at, vpn: lists.vpn.at, dc: lists.dc.at }, errors: lists.errors, provider: process.env.IPAPI_KEY ? 'ip-api pro' : 'ip-api free', cached: cache.size });
// exported for tests
export const _test = { BRANDS, HOSTING_HINT, parseCidrs, inRanges, lists };
