// Security / fairness features: ranked play-time gate, VPN detection, duplicate accounts, appeals, stats.
//   node tools/security.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import WebSocket from 'ws';

const root = path.resolve(import.meta.dirname, '..');
const PORT = 8795;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-sec-'));
const env = { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, AI_DISABLED: '1', RANKED_MIN_MINUTES: '0.1', TEST_TRUST_IP_HEADER: '1', ADMIN_KEY: 'k', VPN_POLICY: 'block', APPEAL_AI_SLA_MS: '600000' };
const server = spawn(process.execPath, [path.join(root, 'server.mjs'), '--prod'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; });
await new Promise((r) => setTimeout(r, 7000)); // lets the Tor / VPN lists download

let pass = 0, fail = 0, skip = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const base = `http://localhost:${PORT}`;
const api = async (method, url, body, token, headers = {}) => { const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json() }; };
const admin = (method, url, body) => api(method, url, body, null, { 'X-Admin-Key': 'k' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const guest = async (name) => (await api('POST', '/api/auth/guest', { name })).json;

try {
  // ============================================================== VPN scoring (pure, no network)
  process.env.DATA_DIR = dataDir; process.env.IPINTEL_OFFLINE = '1';
  const { scoreIntel } = await import('../server/ipintel.mjs');
  const P = (o) => ({ provider: { isp: '', org: '', as: '', asname: '', cc: 'FR', tz: 'Europe/Paris', mobile: false, proxy: false, hosting: false, ...o } });
  const cases = [
    ['ProtonVPN is blocked as a brand, not a provider', P({ isp: 'Proton AG', org: 'Proton AG', as: 'AS209103 Proton AG', asname: 'PROTON-AG' }), true, 'ProtonVPN'],
    ['NordVPN (Tefincom) is blocked', P({ isp: 'Tefincom S.A.', org: 'NordVPN', as: 'AS136787 Tefincom', asname: 'TEFINCOM' }), true, 'NordVPN'],
    ['Mullvad (31173 Services) is blocked', P({ isp: '31173 Services AB', org: 'Mullvad VPN', as: 'AS39351 31173 Services AB' }), true, 'Mullvad'],
    ['a generic "VPN" network name is blocked', P({ isp: 'Acme Private VPN Ltd', org: 'Acme VPN' }), true, 'Generic VPN'],
    ['a real consumer ISP passes', P({ isp: 'Orange S.A.', org: 'Orange', as: 'AS3215 Orange S.A.' }), false, null],
    ['a mobile carrier passes', P({ isp: 'Bouygues Telecom', org: 'Bouygues Telecom', as: 'AS5410 Bouygues Telecom', mobile: true }), false, null],
    ['provider "hosting" flag blocks (datacenter, not a home line)', P({ isp: 'Some Cloud', hosting: true }), true, null],
    ['provider "proxy" flag blocks', P({ isp: 'Free SAS', proxy: true }), true, null],
    ['timezone mismatch alone never blocks', { provider: { isp: 'Free SAS', org: 'Free', as: 'AS12322 Free SAS', cc: 'FR', tz: 'Europe/Paris' } }, false, null],
  ];
  for (const [name, intel, shouldBlock, brand] of cases) {
    const r = scoreIntel('93.184.216.34', intel, name.includes('timezone') ? { tz: 'America/New_York' } : {});
    ok(name, r.block === shouldBlock && (brand === null || r.brand === brand), `class=${r.class} score=${r.score}${r.brand ? ' brand=' + r.brand : ''}`);
  }
  const hostHint = scoreIntel('93.184.216.34', P({ isp: 'Hetzner Online GmbH', org: 'Hetzner' }), {});
  ok('hosting-looking name alone is only suspicious (no block)', !hostHint.block && hostHint.class === 'suspicious', `score=${hostHint.score}`);

  // ============================================================== VPN gate end to end (real Tor exit list)
  const tor = await fetch('https://check.torproject.org/torbulkexitlist', { signal: AbortSignal.timeout(20000) }).then((r) => r.text()).catch(() => '');
  const torIp = tor.split('\n').find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
  if (!torIp) { skip++; console.log('SKIP  Tor gate (no network)'); }
  else {
    const g = await api('POST', '/api/auth/guest', { name: 'Torry' }, null, { 'X-Test-IP': torIp });
    ok('a real Tor exit node cannot create an account', g.status === 403 && g.json.error === 'vpn_blocked' && g.json.class === 'tor', JSON.stringify(g.json).slice(0, 120));
    await admin('POST', '/api/admin/vpn/allow', { ip: torIp, note: 'test' });
    const g2 = await api('POST', '/api/auth/guest', { name: 'Torry' }, null, { 'X-Test-IP': torIp });
    ok('an administrator can allow-list an address (false positives)', g2.status === 200);
    const st = (await admin('GET', '/api/admin/vpn')).json;
    ok('VPN engine status: lists loaded', st.torExits > 500 && st.vpnRanges > 1000 && st.datacenterRanges > 1000, `tor=${st.torExits} vpn=${st.vpnRanges} dc=${st.datacenterRanges}`);
  }
  ok('local addresses are never checked (development)', (await api('POST', '/api/auth/guest', { name: 'Local' })).status === 200);

  // ============================================================== ranked needs play time
  const A = await guest('Ann'), B = await guest('Ben');
  const connect = (tok) => new Promise((resolve) => { const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const c = { ws, msgs: [], wait(type, ms = 8000) { return new Promise((res, rej) => { const f = () => c.msgs.find((m) => m.t === type); if (f()) return res(f()); const to = setTimeout(() => { clearInterval(iv); rej(new Error('timeout ' + type)); }, ms); const iv = setInterval(() => { if (f()) { clearTimeout(to); clearInterval(iv); res(f()); } }, 20); }); }, send(o) { ws.send(JSON.stringify(o)); } }; ws.on('message', (d) => { const m = JSON.parse(d.toString()); c.msgs.push(m); if (m.t === 'hello') ws.send(JSON.stringify({ t: 'auth', token: tok })); }); ws.on('open', () => resolve(c)); });
  const ca = await connect(A.token); await ca.wait('authed');
  const me0 = (await api('GET', '/api/me', null, A.token)).json.player;
  ok('profile exposes the ranked gate', me0.ranked.unlocked === false && me0.ranked.minSeconds === 6, JSON.stringify(me0.ranked));
  ca.send({ t: 'rq', mode: 'classic', char: 'rio' });
  const lock = await ca.wait('err');
  ok('ranked queue refused until enough play time', lock.code === 'ranked_locked' && /Ranked unlocks/.test(lock.msg), lock.msg);
  const tk = await api('POST', '/api/run/start', { mode: 'classic', map: 'city' }, A.token);
  await sleep(6500);
  const fin = await api('POST', '/api/run/finish', { ticket: tk.json.ticket, score: 80, dist: 90, coins: 4, time: 7, stats: { jumps: 2, rolls: 1, lanes: 6, boards: 0 }, input: { n: 9, fast: 0 } }, A.token);
  ok('a valid run adds play time', fin.json.accepted === true);
  ca.msgs.length = 0; ca.send({ t: 'rq', mode: 'classic', char: 'rio' });
  ok('after enough play time the ranked queue opens', !!(await ca.wait('queued', 4000).catch(() => null)));
  ca.ws.close();

  // ============================================================== duplicate accounts + ban evasion
  const sig = { tz: 'Europe/Paris', lang: 'fr-FR', langs: 'fr-FR,fr,en', screen: '1920x1080', dpr: 1, cores: 8, mem: 8, platform: 'Win32', gpu: 'ANGLE (NVIDIA RTX)', canvas: 'abc123', audio: 'x1', fonts: 'a,b,c', touch: 0, ua: 'Mozilla/5.0 test', webdriver: false };
  const DID = 'did_' + 'a'.repeat(24);
  const C = await guest('Cleo'), D = await guest('Dan'), E = await guest('Eve');
  const rc = await api('POST', '/api/device', { did: DID, signals: sig }, C.token);
  ok('device report accepted', rc.status === 200 && rc.json.ok);
  await api('POST', '/api/device', { did: DID, signals: sig }, D.token);
  const links = (await admin('GET', '/api/admin/links?name=Dan')).json.links;
  ok('same device id on two accounts = strong link (score 100)', links.some((l) => l.name === 'Cleo' && l.score === 100 && l.signals.includes('device_id')), JSON.stringify(links.map((l) => [l.name, l.score])));
  await api('POST', '/api/device', { did: 'did_' + 'b'.repeat(24), signals: sig }, E.token); // other browser profile, same hardware + same network
  const links2 = (await admin('GET', '/api/admin/links?name=Eve')).json.links;
  ok('same fingerprint + same network = medium link (score 60)', links2.some((l) => l.score >= 60 && l.signals.includes('fingerprint')), JSON.stringify(links2.map((l) => [l.name, l.score, l.signals])));
  ok('alt-account events recorded as evidence', JSON.stringify((await admin('GET', '/api/admin/player?name=Dan')).json.events).includes('alt_account'));
  // ban evasion: the linked account gets banned, a fresh account appears on the same device
  await admin('POST', '/api/admin/ban', { pid: C.player.id, reason: 'test ban' });
  const F = await guest('Finn');
  const rf = await api('POST', '/api/device', { did: DID, signals: sig }, F.token);
  const fme = (await api('GET', '/api/me', null, F.token)).json.player;
  ok('new account on a banned account\'s device is restricted (ban evasion)', rf.json.restricted === true && fme.kickedUntil > 0, 'kickedUntil=' + fme.kickedUntil);
  ok('malformed device ids are rejected', (await api('POST', '/api/device', { did: 'x', signals: sig }, F.token)).status === 400);

  // ============================================================== appeals: 3 max, AI or human, trackable
  const G = await guest('Gus');
  const cheat = { score: 9999999, dist: 50000, coins: 90000, time: 600, stats: {}, input: { n: 0, fast: 0 } };
  for (let i = 0; i < 2; i++) { const t = await api('POST', '/api/run/start', { mode: 'classic' }, G.token); await sleep(1500); await api('POST', '/api/run/finish', { ticket: t.json.ticket, ...cheat }, G.token); await sleep(4200); }
  const gme = (await api('GET', '/api/me', null, G.token)).json;
  ok('two hard violations = temporary kick (sanction to contest)', gme.player.kickedUntil > 0);
  const lst0 = (await api('GET', '/api/appeals', null, G.token)).json;
  ok('appeals: eligible, 3 left, case with evidence', lst0.eligibility.ok && lst0.left === 3 && lst0.case.events.length >= 2, JSON.stringify({ left: lst0.left, ev: lst0.case.events.length }));
  ok('a statement is required', (await api('POST', '/api/appeals', { type: 'ai', message: 'no' }, G.token)).status === 400);
  const a1 = (await api('POST', '/api/appeals', { type: 'ai', message: 'I was not cheating, my connection lagged badly.' }, G.token)).json;
  ok('AI review is accepted and tracked', a1.ok && a1.appeal.type === 'ai' && /15 minutes/.test(a1.appeal.sla), a1.appeal && a1.appeal.status);
  let d1; for (let i = 0; i < 30; i++) { d1 = (await api('GET', `/api/appeals/${a1.appeal.id}`, null, G.token)).json; if (d1.status !== 'reviewing') break; await sleep(300); }
  ok('AI review answers fast: hard evidence on record -> sanction stands', d1.status === 'decided' && d1.decision === 'upheld', `${d1.status}/${d1.decision} in ${(d1.updated - d1.created)} ms`);
  ok('timeline shows every step (submitted, rules, decision)', ['submitted', 'rules', 'decided'].every((k) => d1.timeline.some((e) => e.kind === k)), d1.timeline.map((e) => e.kind).join(' > '));
  const a2 = (await api('POST', '/api/appeals', { type: 'human', message: 'Please have a person look at the recorded runs.' }, G.token)).json;
  ok('human review is queued with its 1-7 day window', a2.ok && a2.appeal.status === 'queued' && /1 to 7 days/.test(a2.appeal.sla));
  ok('only one appeal at a time', (await api('POST', '/api/appeals', { type: 'ai', message: 'second one at once please' }, G.token)).json.error === 'already_open');
  const q1 = (await admin('GET', '/api/admin/appeals')).json.appeals;
  ok('moderators see it in their queue with the case file', q1.some((x) => x.id === a2.appeal.id && x.case.events.length >= 2));
  await admin('POST', '/api/admin/appeals/decide', { id: a2.appeal.id, decision: 'overturned', note: 'Reviewed: network issue' });
  const gme2 = (await api('GET', '/api/me', null, G.token)).json;
  const d2 = (await api('GET', `/api/appeals/${a2.appeal.id}`, null, G.token)).json;
  ok('overturned: kick lifted, one strike removed, player can follow the decision', gme2.player.kickedUntil === 0 && d2.decision === 'overturned' && d2.timeline.some((e) => e.kind === 'human_review'));
  const a3 = (await api('POST', '/api/appeals', { type: 'ai', message: 'Third and last attempt, please check again.' }, G.token)).json;
  for (let i = 0; i < 30; i++) { const d = (await api('GET', `/api/appeals/${a3.appeal.id}`, null, G.token)).json; if (d.status !== 'reviewing') break; await sleep(300); }
  const a4 = await api('POST', '/api/appeals', { type: 'ai', message: 'A fourth one should be refused.' }, G.token);
  ok('maximum 3 appeals per account', a4.json.error === 'limit' || a4.json.error === 'no_sanction', a4.json.error);
  ok('the list shows all three with their status', (await api('GET', '/api/appeals', null, G.token)).json.appeals.length === 3);
  ok("nobody can read another player's appeal", (await api('GET', `/api/appeals/${a1.appeal.id}`, null, A.token)).status === 404);

  // ============================================================== statistics
  const st = (await api('GET', '/api/stats', null, A.token)).json;
  ok('player stats: 30-day series, totals, hour histogram, rating history', st.days.length === 30 && st.totals.runs >= 1 && st.hours.length === 24 && Array.isArray(st.rating) && st.byMode.classic.runs >= 1, `runs=${st.totals.runs} minutes=${st.totals.minutes}`);
  const gl = (await api('GET', '/api/stats/global')).json;
  ok('global stats are public', gl.players >= 6 && typeof gl.runsToday === 'number');
} catch (e) { fail++; console.log('FAIL  unexpected error:', e.stack.split('\n').slice(0, 3).join(' | ')); }
console.log(`\n${pass} passed, ${fail} failed${skip ? `, ${skip} skipped` : ''}`);
if (fail) console.log('server log tail:', log.split('\n').slice(-6).join(' | '));
server.kill();
try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* sqlite file still locked on Windows */ }
process.exit(fail ? 1 : 0);
