// Gold Rush Duel: arena geometry + movement + hit-scan, shared by the client (prediction, feedback) and the SERVER
// (validation, authoritative hits). Pure functions, no three.js: the exact same rules run on both sides.
// Conventions: Y is up, yaw 0 looks toward -Z, pitch > 0 looks up.

export const A = {
  R: 17.5, // playable radius (the visible wall stands at R)
  PR: 0.38, // player radius
  EYE: 1.62, HEIGHT: 1.82,
  SPEED: 6.4, JUMP_V: 6.9, GRAVITY: 21,
  HP: 100, DURATION: 120,
  GUN: { mag: 7, interval: 0.32, reload: 1.75, body: 34, head: 72, legs: 22, range: 90 },
  STEP: 0.35, // can walk onto ledges this high
};

// Axis-aligned cover blocks: centre x,z, half sizes hx,hz, height h. Point-symmetric so the arena is fair for both spawns.
const half = [
  { id: 'wagon', x: 0, z: 0, hx: 1.0, hz: 3.4, h: 2.7 },
  { id: 'crateA', x: 5.5, z: 4.0, hx: 1.1, hz: 1.1, h: 1.6 },
  { id: 'wall', x: -5.0, z: 5.0, hx: 2.2, hz: 0.35, h: 0.95 },
  { id: 'pillar', x: 9.0, z: -1.0, hx: 0.7, hz: 0.7, h: 4.0 },
  { id: 'stack', x: 9.5, z: 8.0, hx: 1.3, hz: 1.3, h: 1.6 },
  { id: 'barrel', x: 2.5, z: 8.5, hx: 0.5, hz: 0.5, h: 1.1 },
];
export const COVER = [];
for (const b of half) { COVER.push({ ...b }); if (b.id !== 'wagon') COVER.push({ ...b, id: b.id + '2', x: -b.x, z: -b.z }); }
COVER[0].id = 'wagon';

export const SPAWNS = [{ x: 0, z: 13.8, yaw: 0 }, { x: 0, z: -13.8, yaw: Math.PI }];

export const newBody = (s) => ({ x: s.x, y: 0, z: s.z, vy: 0, yaw: s.yaw, pitch: 0, ground: true });

// ----- footprint helpers
const overlapBox = (b, x, z, r) => {
  const dx = Math.max(Math.abs(x - b.x) - b.hx, 0), dz = Math.max(Math.abs(z - b.z) - b.hz, 0);
  return Math.hypot(dx, dz) < r;
};
// ground height under (x,z) for a body whose feet are at y (can step up small ledges, stand on low walls)
export function groundAt(x, z, y) {
  let g = 0;
  for (const b of COVER) if (b.h <= y + A.STEP && overlapBox(b, x, z, A.PR * 0.6)) g = Math.max(g, b.h);
  return g;
}
// push a circle out of every block that is taller than the feet (can't walk through it)
export function resolveXZ(p, feetY) {
  for (let it = 0; it < 3; it++) {
    for (const b of COVER) {
      if (b.h <= feetY + A.STEP) continue; // walkable ledge, not a wall
      const cx = Math.min(Math.max(p.x, b.x - b.hx), b.x + b.hx), cz = Math.min(Math.max(p.z, b.z - b.hz), b.z + b.hz);
      let dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d >= A.PR) continue;
      if (d < 1e-6) { // centre inside the box: leave through the nearest face
        const ox = b.hx - Math.abs(p.x - b.x), oz = b.hz - Math.abs(p.z - b.z);
        if (ox < oz) p.x = b.x + Math.sign(p.x - b.x || 1) * (b.hx + A.PR); else p.z = b.z + Math.sign(p.z - b.z || 1) * (b.hz + A.PR);
      } else { p.x = cx + (dx / d) * A.PR; p.z = cz + (dz / d) * A.PR; }
    }
  }
  const rr = Math.hypot(p.x, p.z), lim = A.R - A.PR;
  if (rr > lim) { p.x *= lim / rr; p.z *= lim / rr; }
}
// how deep the position is inside solid geometry (server: > 0.18 means walking through a wall)
export function penetration(p, feetY) {
  let worst = Math.max(0, Math.hypot(p.x, p.z) - (A.R - A.PR));
  for (const b of COVER) {
    if (b.h <= feetY + A.STEP) continue;
    const cx = Math.min(Math.max(p.x, b.x - b.hx), b.x + b.hx), cz = Math.min(Math.max(p.z, b.z - b.hz), b.z + b.hz);
    const d = Math.hypot(p.x - cx, p.z - cz);
    if (d < A.PR) worst = Math.max(worst, A.PR - d + (d < 1e-6 ? 0.5 : 0));
  }
  return worst;
}

// One movement step. input: { fx, fz (local move, -1..1: fz>0 forward), jump }. Used by the client for prediction.
export function step(p, input, dt) {
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  // forward = (-sin, -cos) with yaw 0 looking at -Z ; right = (cos, -sin)
  let mx = -sin * input.fz + cos * input.fx, mz = -cos * input.fz - sin * input.fx;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const k = p.ground ? 1 : 0.55; // limited air control
  p.x += mx * A.SPEED * k * dt; p.z += mz * A.SPEED * k * dt;
  if (input.jump && p.ground) { p.vy = A.JUMP_V; p.ground = false; }
  p.vy -= A.GRAVITY * dt;
  p.y += p.vy * dt;
  resolveXZ(p, p.y);
  const g = groundAt(p.x, p.z, p.y);
  if (p.y <= g) { p.y = g; p.vy = 0; p.ground = true; } else p.ground = false;
  return p;
}

// ----- ray casting (slab method). o = origin {x,y,z}, d = unit direction.
function rayBox(o, d, b, y0, y1) {
  let t0 = 0, t1 = 1e9;
  const axes = [['x', b.x - b.hx, b.x + b.hx], ['y', y0, y1], ['z', b.z - b.hz, b.z + b.hz]];
  for (const [k, lo, hi] of axes) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) return null; continue; }
    let a = (lo - o[k]) / d[k], c = (hi - o[k]) / d[k];
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0;
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : (-b + Math.sqrt(disc) >= 0 ? 0 : null);
}
// vertical capsule-ish body part tests for a player standing at (x,y,z)
export function rayPlayer(o, d, t) {
  let best = null;
  const test = (part, tt) => { if (tt !== null && (best === null || tt < best.t)) best = { part, t: tt }; };
  test('head', raySphere(o, d, { x: t.x, y: t.y + 1.62, z: t.z }, 0.24));
  // torso: box-ish cylinder approximated by 3 spheres + AABB between 0.55 and 1.4
  const body = rayBox(o, d, { x: t.x, z: t.z, hx: 0.34, hz: 0.28 }, t.y + 0.55, t.y + 1.42);
  test('body', body);
  const legs = rayBox(o, d, { x: t.x, z: t.z, hx: 0.3, hz: 0.24 }, t.y, t.y + 0.55);
  test('legs', legs);
  return best;
}
// nearest blocker along the ray (cover or the outer wall). Returns distance or Infinity.
export function rayWorld(o, d, maxT = A.GUN.range) {
  let best = maxT;
  for (const b of COVER) { const t = rayBox(o, d, b, 0, b.h); if (t !== null && t < best) best = t; }
  // outer wall: solve |p.xz| = R
  const a = d.x * d.x + d.z * d.z, bb = 2 * (o.x * d.x + o.z * d.z), c = o.x * o.x + o.z * o.z - A.R * A.R;
  if (a > 1e-9) { const disc = bb * bb - 4 * a * c; if (disc >= 0) { const t = (-bb + Math.sqrt(disc)) / (2 * a); if (t > 0 && t < best) best = t; } }
  if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) best = t; } // floor
  return best;
}
// full shot: does a ray from o along d hit `target` before hitting the world? -> { part, t } | null
export function hitscan(o, d, target) {
  const hit = rayPlayer(o, d, target);
  if (!hit) return null;
  return hit.t < rayWorld(o, d) ? hit : null;
}
export const damageFor = (part) => A.GUN[part] ?? A.GUN.body;

export const dirFrom = (yaw, pitch) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
export const eyeOf = (p) => ({ x: p.x, y: p.y + A.EYE, z: p.z });

// Server-side plausibility of a claimed body state versus the previous one (dt seconds apart).
export function validateMove(prev, next, dt) {
  const out = [];
  dt = Math.max(dt, 0.001);
  const dist = Math.hypot(next.x - prev.x, next.z - prev.z);
  if (dist > A.SPEED * 1.3 * dt + 0.45) out.push('duel_speed');
  if (next.y - prev.y > A.JUMP_V * 1.25 * dt + 0.4) out.push('duel_fly');
  if (prev.y - next.y > 30 * dt + 0.5) out.push('duel_fall');
  if (next.y > 4.2 || next.y < -0.05) out.push('duel_altitude');
  if (Math.hypot(next.x, next.z) > A.R - A.PR + 0.25) out.push('duel_bounds');
  if (penetration(next, next.y) > 0.2) out.push('duel_wall');
  return out;
}
