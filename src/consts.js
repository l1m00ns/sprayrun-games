export const LANE_W = 2.2;
export const LANES = [-LANE_W, 0, LANE_W];
export const SEG_LEN = 64.8; // 6 ground-texture tiles of 10.8 units
export const NUM_SEGS = 6;

// ---------------------------------------------------------------------------------------------
// Movement tuning. The reference numbers come from the game's published character-motor values
// (internal units where the player collider is 9.0 tall): Gravity -200, JumpHeight 20,
// JumpDiveVelocityY -90, fast dive -250, RollDuration 0.6 s, LaneChangeDuration 0.27 s,
// forgiving-jump window 0.15 s, speed 110 -> 220 linearly over 179 s, jetpack lane change 0.54 s.
// Lane width and train size are not in that data, so everything is converted with one scale:
// our player collider (PLAYER_H) stands for 9.0 internal units. Heights and speeds keep the real ratios.
// ---------------------------------------------------------------------------------------------
export const PLAYER_H = 1.45;
const S = PLAYER_H / 9.0; // our units per internal unit

export const GRAVITY = 200 * S; // 32.2
export const JUMP_H = 20 * S; // 3.22 (2.2 body heights)
export const JUMP_V = Math.sqrt(2 * GRAVITY * JUMP_H); // 14.4 -> 0.89 s in the air
export const JUMP_V_SNEAKERS = Math.sqrt(2 * GRAVITY * JUMP_H * 2.0); // "highjump" ability: x2 height
export const DIVE_V = -90 * S; // fast fall when pressing down in the air
export const FAST_DIVE_V = -250 * S;
export const COYOTE = 0.15; // GroundedTimeExtensionForForgivingJumps
export const ROLL_TIME = 0.6;
export const LANE_CHANGE = 0.27; // authentic motor value (the "classic" control feel)
export const LANE_CHANGE_SNAPPY = 0.13; // default: near-instant lane switches
export const JET_LANE_CHANGE = 0.54;
export const PLAYER_HW = 0.3;
export const PLAYER_H_ROLL = 0.65;
export const STEP_TOL = 0.42;

export const SPEED_START = 110 * S; // 17.7
export const SPEED_MAX = 220 * S; // 35.4
export const SPEED_RAMP_TIME = 179;
// The authentic ramp is linear up to SPEED_MAX at 179 s. It never stops there any more: the speed keeps climbing,
// smoothly, towards SPEED_CAP (x1.6) - so a long run keeps getting faster instead of plateauing.
export const SPEED_CAP = SPEED_MAX * 1.6;
const TAU = 240; // seconds: how quickly the extra speed builds after the linear ramp
export const speedAtTime = (t) => {
  t = Math.max(0, t);
  if (t <= SPEED_RAMP_TIME) return SPEED_START + (SPEED_MAX - SPEED_START) * (t / SPEED_RAMP_TIME);
  return SPEED_MAX + (SPEED_CAP - SPEED_MAX) * (1 - Math.exp(-(t - SPEED_RAMP_TIME) / TAU));
};
// Distance covered after `t` seconds at the nominal speed (exact integral of speedAtTime).
export function distAtTime(t) {
  t = Math.max(0, t);
  const a = (SPEED_MAX - SPEED_START) / SPEED_RAMP_TIME;
  const t1 = Math.min(t, SPEED_RAMP_TIME);
  let d = SPEED_START * t1 + 0.5 * a * t1 * t1;
  if (t > SPEED_RAMP_TIME) { const x = t - SPEED_RAMP_TIME, D = SPEED_CAP - SPEED_MAX; d += SPEED_MAX * x + D * (x - TAU * (1 - Math.exp(-x / TAU))); }
  return d;
}
// Nominal speed after having run `dist` metres (numeric inverse of distAtTime).
export function speedAtDist(dist) {
  let lo = 0, hi = 4000;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (distAtTime(mid) < dist) lo = mid; else hi = mid; }
  return speedAtTime((lo + hi) / 2);
}

export const CARRIAGE_LEN = 11;
export const CARRIAGE_GAP = 0.35;
export const TRAIN_W = 1.9;
export const TRAIN_BOTTOM = 0.5;
export const TRAIN_H = 3.7; // roof must stay above the jump apex (JUMP_H + STEP_TOL) so trains can't be hopped
// Trains and containers are solid walls: no ramps, nobody stands or runs on a roof. Landing on one (Super Sneakers) is a crash;
// the Jetpack flies above them. Flip to true to get the old roof-running back (ramps + roof coins).
export const ROOF_RUN = false;

export const LOW_H = 1.0;
export const OVERHEAD_BOTTOM = 1.15;
export const OVERHEAD_H = 2.35; // tall enough that a normal jump can't clear it: you have to roll

export const RAMP_LEN = 9;

export const POWERUPS = {
  magnet: { name: 'Magnet', base: 9, perLevel: 2.5, color: '#ff4d4d' },
  jetpack: { name: 'Jetpack', base: 5.5, perLevel: 1.1, color: '#ff9f1c' },
  sneakers: { name: 'Super Sneakers', base: 9, perLevel: 2.5, color: '#2ec4b6' },
  mult: { name: 'Double Score', base: 9, perLevel: 2.5, color: '#ffd23f' },
};

export const THEMES = [
  { name: 'day', top: 0x2f7ae5, horizon: 0xcfe9ff, fog: 0xcfe6f7, sun: 0xfff0d2, sunI: 2.6, hemiSky: 0xbfdcff, hemiGround: 0x7a6b5a, hemiI: 1.15, night: 0, sunDir: [-0.45, 0.8, 0.4] },
  { name: 'sunset', top: 0x4b3b9a, horizon: 0xffa56b, fog: 0xf0a47e, sun: 0xffb072, sunI: 2.2, hemiSky: 0xffcfa6, hemiGround: 0x5a4650, hemiI: 0.95, night: 0.4, sunDir: [-0.7, 0.35, 0.3] },
  { name: 'night', top: 0x050824, horizon: 0x2d3270, fog: 0x1b2050, sun: 0x9db2ff, sunI: 0.95, hemiSky: 0x4a5ab0, hemiGround: 0x1c1a34, hemiI: 0.8, night: 1, sunDir: [-0.3, 0.9, 0.2] },
];
