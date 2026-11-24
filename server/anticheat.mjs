// Server-side validation of runs and live race telemetry.
//
// The game is client-simulated, so this is *statistical / physical plausibility* checking, not a
// deterministic replay: every claim is bounded by what the real game can physically produce
// (speed curve, score formula, coin density, human input rate) and tied to server-issued,
// single-use, time-stamped tickets. Violations are recorded as strikes; repeat offenders are
// shadow-banned from the boards and from ranked play.
import * as C from '../src/consts.js';

// Maximum distance reachable in `t` seconds: the real speed curve, plus a small tolerance.
export function maxDistAt(t) {
  return C.distAtTime(t) * 1.06 + 25;
}

// Highest leaderboard score for a given distance / coin count (multiplier-free "base" score, x2 with the pickup).
export function maxScore(dist, coins) {
  return dist * 0.9 * 2 * 1.05 + coins * 8 + 400;
}

// Flags that are physically impossible in the real game are HARD (straight to a strike); the rest are statistical (SOFT):
// the run is kept off the boards, and a strike is only given after the fair-play judge (AI, or its rule fallback) agrees.
export const HARD = new Set(['malformed', 'negative', 'time_ahead_of_server', 'dist_exceeds_speed_curve', 'score_exceeds_formula', 'coin_in_nocoin', 'absurd',
  'dist_ahead_of_clock', 'teleport', 'rewind', 'speed', 'score', 'altitude', 'x_bounds', 'x_jump', 'y_jump']);
export const classify = (flags) => flags.map((f) => ({ flag: f, hard: HARD.has(f) }));

export function validateRun(run, ticket, now) {
  const flags = [];
  const n = (v) => (Number.isFinite(v) ? v : NaN);
  const score = n(run.score), dist = n(run.dist), coins = n(run.coins), time = n(run.time);
  if ([score, dist, coins, time].some(Number.isNaN)) return ['malformed'];
  if (score < 0 || dist < 0 || coins < 0 || time < 0) flags.push('negative');
  if (time < 2) flags.push('too_short');
  const elapsed = (now - ticket.t0) / 1000;
  if (time > elapsed + 1.5) flags.push('time_ahead_of_server'); // finished faster than wall-clock time
  // (a game clock far BEHIND wall-clock is legitimate: pauses, slow machines run in slow motion)
  if (dist > maxDistAt(time)) flags.push('dist_exceeds_speed_curve');
  if (score > maxScore(dist, coins)) flags.push('score_exceeds_formula');
  if (coins > dist * 1.15 + time * 10 + 300) flags.push('coin_density');
  if (ticket.mode === 'nocoin' && coins > 0) flags.push('coin_in_nocoin');
  if (score > 4e6 || dist > 4e5) flags.push('absurd');

  const inp = run.input || {};
  const acts = n(inp.n), fast = n(inp.fast) || 0;
  if (Number.isNaN(acts) || acts < 0) flags.push('no_input_log');
  else {
    if (time > 5 && acts / time > 12) flags.push('input_rate_inhuman');
    if (acts > 8 && fast > Math.max(4, acts * 0.12)) flags.push('input_gap_inhuman'); // many <20 ms presses = macro
    if (dist > 250 && acts < 1) flags.push('no_input_but_far');
    const s = run.stats || {};
    const claimed = (s.jumps | 0) + (s.rolls | 0) + (s.lanes | 0) + (s.boards | 0);
    if (claimed > acts + 2) flags.push('stats_exceed_inputs');
  }
  return flags;
}

// Live telemetry during a race. Mutates `me.ac` (per-player tracker) and returns violation reasons.
export function checkLive(me, msg, now) {
  const ac = (me.ac ||= { t0: now, lastD: 0, lastT: now, violations: 0, reasons: [] });
  const out = [];
  const elapsed = (now - ac.t0) / 1000;
  if (msg.d > maxDistAt(elapsed)) out.push('dist_ahead_of_clock');
  const dt = Math.max((now - ac.lastT) / 1000, 0.001);
  if (msg.d - ac.lastD > C.SPEED_CAP * 1.25 * dt + 3) out.push('teleport');
  if (msg.d < ac.lastD - 1) out.push('rewind');
  if (msg.sp > C.SPEED_CAP * 1.12) out.push('speed');
  // Body position: the runner can never leave the three lanes, fly above the highest legal altitude, or jump sideways / vertically faster than the motor allows.
  if (Number.isFinite(msg.x)) {
    if (Math.abs(msg.x) > C.LANE_W + 0.9) out.push('x_bounds');
    if (ac.lastX !== undefined && Math.abs(msg.x - ac.lastX) > 70 * dt + 0.9) out.push('x_jump');
    ac.lastX = msg.x;
  }
  if (Number.isFinite(msg.y)) {
    if (msg.y > 11.5) out.push('altitude');
    if (ac.lastY !== undefined && Math.abs(msg.y - ac.lastY) > 60 * dt + 1.3) out.push('y_jump');
    ac.lastY = msg.y;
  }
  if (msg.s > maxScore(msg.d, msg.d * 1.2)) out.push('score');
  ac.lastD = Math.max(ac.lastD, msg.d);
  ac.lastT = now;
  if (out.length) { ac.violations += out.length; ac.reasons.push(...out); }
  return out;
}
