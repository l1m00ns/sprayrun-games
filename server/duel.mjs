// Gold Rush Duel, server side. The server is authoritative for health, ammo, fire rate and every hit; clients only claim
// where they are and where they shoot. Every claim is validated with the SAME rules the client uses (src/arena.js).
//   - movement: speed, flying, falling, altitude, arena bounds, walking through walls  -> snap back + violation
//   - shots: cadence, ammo, reload, origin near the shooter, hit-scan against a lag-compensated target position
//   - 4 hard violations = strike + kick + forfeit (the opponent wins)
import { A, SPAWNS, newBody, validateMove, hitscan, damageFor, eyeOf } from '../src/arena.js';
import { q } from './db.mjs';
import { strike, kick, recordEvent } from './players.mjs';
import { bumpCareer, addXp } from './economy.mjs';

const COUNTDOWN_MS = 3000;
const LAG_COMP_MS = 110;
const DURATION = Number(process.env.DUEL_SECONDS) || A.DURATION; // DUEL_SECONDS shortens duels for tests
const now = () => Date.now();
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function startDuel(room, io) {
  const list = [...room.players.values()].filter((p) => p.ws.readyState === 1);
  if (list.length !== 2) return false;
  room.state = 'duel';
  const duel = room.duel = { phase: 'countdown', t0: now(), liveAt: now() + COUNTDOWN_MS, endsAt: 0, over: false, players: new Map(), lastSnap: 0 };
  list.forEach((p, i) => {
    duel.players.set(p.id, { id: p.id, pid: p.pid, name: p.name, char: p.char, ws: p.ws, spawn: i, body: newBody(SPAWNS[i]), hp: A.HP, ammo: A.GUN.mag, reloadUntil: 0, lastShot: 0, lastUpd: now(), hist: [], viol: 0, reasons: [], wallStreak: 0, shots: 0, hits: 0, head: 0, dmg: 0, kills: 0 });
  });
  io.broadcast(room, { t: 'duel', phase: 'start', countdown: COUNTDOWN_MS / 1000, duration: DURATION, players: [...duel.players.values()].map((p) => ({ id: p.id, name: p.name, char: p.char, spawn: p.spawn })) });
  return true;
}

// ---- movement claim: { x, y, z, yaw, pitch }
export function onMove(room, ws, msg, t, io) {
  const duel = room.duel, p = duel && duel.players.get(ws.id);
  if (!p || duel.phase !== 'live' || p.hp <= 0 || duel.over) return;
  if (t - p.lastUpd < 12) return; // client sends ~30 Hz; ignore bursts
  const next = { x: num(msg.x), y: num(msg.y), z: num(msg.z), yaw: num(msg.yaw), pitch: Math.max(-1.55, Math.min(1.55, num(msg.pitch))) };
  const dt = Math.min((t - p.lastUpd) / 1000, 0.25);
  const bad = validateMove(p.body, next, dt);
  p.lastUpd = t;
  if (bad.length) {
    p.viol += bad.length; p.reasons.push(...bad);
    if (bad.includes('duel_wall')) p.wallStreak++;
    io.send(p.ws, { t: 'dfix', x: p.body.x, y: p.body.y, z: p.body.z }); // snap back to the last legal spot
    if (p.viol >= 4 || p.wallStreak >= 3) cheatKick(room, p, io);
    return;
  }
  p.wallStreak = 0;
  Object.assign(p.body, next);
  p.hist.push({ t, x: next.x, y: next.y, z: next.z });
  if (p.hist.length > 20) p.hist.shift();
}

// ---- shot claim: { ox, oy, oz, dx, dy, dz }
export function onFire(room, ws, msg, t, io) {
  const duel = room.duel, p = duel && duel.players.get(ws.id);
  if (!p || duel.phase !== 'live' || p.hp <= 0 || duel.over) return;
  const foe = [...duel.players.values()].find((x) => x !== p);
  if (t < p.reloadUntil) return;
  if (p.ammo <= 0) { p.reloadUntil = t + A.GUN.reload * 1000; return; }
  if (t - p.lastShot < A.GUN.interval * 1000 * 0.86) { // faster than the weapon can fire
    p.viol++; p.reasons.push('duel_rate');
    if (p.viol >= 4) cheatKick(room, p, io);
    return;
  }
  let d = { x: num(msg.dx), y: num(msg.dy), z: num(msg.dz) };
  const len = Math.hypot(d.x, d.y, d.z);
  if (!(len > 0.5 && len < 1.5)) return;
  d = { x: d.x / len, y: d.y / len, z: d.z / len };
  const eye = eyeOf(p.body);
  let o = { x: num(msg.ox, eye.x), y: num(msg.oy, eye.y), z: num(msg.oz, eye.z) };
  if (Math.hypot(o.x - eye.x, o.y - eye.y, o.z - eye.z) > 1.2) { p.viol++; p.reasons.push('duel_origin'); o = eye; } // shooting from somewhere you are not
  p.lastShot = t; p.ammo--; p.shots++;
  if (p.ammo === 0) p.reloadUntil = t + A.GUN.reload * 1000;
  io.broadcast(room, { t: 'dfire', id: p.id, ammo: p.ammo }, null);
  // lag compensation: the shooter saw the opponent about LAG_COMP_MS ago
  let tp = foe.body;
  const want = t - LAG_COMP_MS;
  for (let i = foe.hist.length - 1; i >= 0; i--) if (foe.hist[i].t <= want) { tp = foe.hist[i]; break; }
  if (foe.hp <= 0) return;
  const hit = hitscan(o, d, tp);
  if (!hit) return;
  const dmg = damageFor(hit.part);
  foe.hp = Math.max(0, foe.hp - dmg);
  p.hits++; p.dmg += dmg; if (hit.part === 'head') p.head++;
  const kill = foe.hp <= 0;
  if (kill) p.kills++;
  io.broadcast(room, { t: 'dhit', by: p.id, victim: foe.id, part: hit.part, dmg, hp: foe.hp, kill }, null);
  if (kill) endDuel(room, p.id, 'kill', io);
}

export function onReload(room, ws, t) {
  const duel = room.duel, p = duel && duel.players.get(ws.id);
  if (!p || duel.phase !== 'live' || p.hp <= 0 || p.ammo >= A.GUN.mag || t < p.reloadUntil) return;
  p.reloadUntil = t + A.GUN.reload * 1000;
  p.ammo = A.GUN.mag; // the magazine is refilled when the animation ends; shots are refused until then
}

function cheatKick(room, p, io) {
  const duel = room.duel;
  if (!duel || duel.over) return;
  const why = [...new Set(p.reasons)].join('+');
  const foe = [...duel.players.values()].find((x) => x !== p);
  if (p.ws.readyState === 1) io.send(p.ws, { t: 'err', msg: 'Removed from the duel: impossible movement or firing' });
  endDuel(room, foe.id, 'forfeit_cheat', io);
  if (p.pid) { strike(p.pid, 'duel:' + why, { viol: p.viol, body: p.body }, 2); kick(p.pid, `Impossible movement or firing detected in a duel (${why})`, 900); }
}

export function onLeave(room, wsId, io) {
  const duel = room.duel;
  if (!duel || duel.over) return;
  const p = duel.players.get(wsId);
  if (!p) return;
  const foe = [...duel.players.values()].find((x) => x !== p);
  endDuel(room, foe ? foe.id : null, 'forfeit', io);
}

// Called every ~50 ms for rooms in the duel phase.
export function tickDuel(room, t, io) {
  const duel = room.duel;
  if (!duel || duel.over) return;
  if (duel.phase === 'countdown' && t >= duel.liveAt) {
    duel.phase = 'live'; duel.endsAt = t + DURATION * 1000;
    for (const p of duel.players.values()) p.lastUpd = t;
    io.broadcast(room, { t: 'duel', phase: 'live', endsAt: duel.endsAt });
  }
  if (duel.phase === 'live' && t >= duel.endsAt) { endDuel(room, null, 'timeout', io); return; }
  if (t - duel.lastSnap >= 50) {
    duel.lastSnap = t;
    const ps = [...duel.players.values()].map((p) => ({ id: p.id, x: +p.body.x.toFixed(2), y: +p.body.y.toFixed(2), z: +p.body.z.toFixed(2), yaw: +p.body.yaw.toFixed(3), pitch: +p.body.pitch.toFixed(3), hp: p.hp, ammo: p.ammo, rl: p.reloadUntil > t ? 1 : 0 }));
    io.broadcast(room, { t: 'ds', ps, q: t }, null);
  }
}

export function endDuel(room, winnerId, reason, io) {
  const duel = room.duel;
  if (!duel || duel.over) return;
  duel.over = true; duel.phase = 'over';
  room.state = 'results';
  const ps = [...duel.players.values()];
  const stat = (p) => ({ id: p.id, name: p.name, hp: p.hp, shots: p.shots, hits: p.hits, head: p.head, dmg: Math.round(p.dmg), kills: p.kills });
  io.broadcast(room, { t: 'dend', winner: winnerId, reason, players: ps.map(stat) }, null);
  const [a, b] = ps;
  try { q.addDuel.run(now(), a && a.pid, b && b.pid, (ps.find((p) => p.id === winnerId) || {}).pid || null, reason, a ? a.hp : 0, b ? b.hp : 0, a ? a.hits : 0, b ? b.hits : 0); } catch { /* history is best effort */ }
  if (reason !== 'forfeit_cheat' || true) {
    for (const p of ps) {
      if (!p.pid) continue;
      const won = p.id === winnerId, lost = winnerId !== null && !won, cheated = reason === 'forfeit_cheat' && lost;
      if (cheated) continue; // no stats / xp for the cheater
      bumpCareer(p.pid, (c) => { if (won) c.duelWins++; else if (lost) c.duelLosses++; else c.duelDraws++; c.duelKills += p.kills; });
      addXp(p.pid, won ? 90 : winnerId === null ? 45 : 30);
    }
  }
  // soft statistical signal: near-perfect accuracy with mostly headshots over a meaningful sample
  for (const p of ps) {
    if (p.pid && p.shots >= 6 && p.hits / p.shots > 0.92 && p.head / Math.max(1, p.hits) > 0.8) { recordEvent(p.pid, 'duel_aim', JSON.stringify(stat(p)), 1); if (io.onSoftFlag) io.onSoftFlag(p, stat(p)); }
  }
}
