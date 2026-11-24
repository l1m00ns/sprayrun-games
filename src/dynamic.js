import * as THREE from 'three';
import * as C from './consts.js';
import { mat, vcMat, basicMat, fxLayer } from './materials.js';
import { mergeColored } from './props.js';
import { terrainY } from './biomes.js';
import { rand, randInt, chance, pick } from './util.js';

// Moving / animated scenery. Everything registers a per-frame callback on its segment (seg.anims),
// so it lives and dies with the segment and stays deterministic (seeded placement).
const L = C.SEG_LEN;
const cache = new Map();
const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const at = (x, y, z) => (g) => g.translate(x, y, z);
const mesh = (geo, m) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; return o; };
const NEON = ['#ff3dd0', '#2bdcff', '#ffd23f', '#7dff6b', '#a98bff'];
const ADD = THREE.AdditiveBlending;
const glow = (color, op) => basicMat(color, { transparent: true, opacity: op, blending: ADD, depthWrite: false, fog: false });

// ------------------------------------------------------------------ bridges with traffic
const BRIDGE = { city: '#8f9096', snow: '#5d6572', tropic: '#9a6a3a', desert: '#c28a55', neon: '#1b1f3c' };
function carGeo(color) {
  return memo('car.' + color, () => mergeColored([[B(1.1, 0.6, 2.2), color, at(0, 0.45, 0)], [B(0.95, 0.5, 1.1), '#2a3550', at(0, 0.95, -0.1)], [B(1.14, 0.15, 2.24), '#15151b', at(0, 0.2, 0)]]));
}
const lightsGeo = () => memo('car.lights', () => mergeColored([[B(0.16, 0.14, 0.05), '#fff2b0', at(-0.35, 0.5, 1.1)], [B(0.16, 0.14, 0.05), '#fff2b0', at(0.35, 0.5, 1.1)], [B(0.16, 0.14, 0.05), '#ff3030', at(-0.35, 0.5, -1.1)], [B(0.16, 0.14, 0.05), '#ff3030', at(0.35, 0.5, -1.1)]]));

function bridge(seg, id) {
  const col = BRIDGE[id];
  const g = new THREE.Group();
  g.position.z = -rand(14, L - 14);
  const body = memo('bridge.' + id, () => {
    const parts = [
      [B(14.8, 1.0, 6.6), col, at(0, 10.4, 0)],
      [B(14.8, 0.5, 0.5), '#3a3d46', at(0, 9.65, -2.6)], [B(14.8, 0.5, 0.5), '#3a3d46', at(0, 9.65, 2.6)],
      [B(14.8, 0.8, 0.22), '#d8dadf', at(0, 11.3, -3.2)], [B(14.8, 0.8, 0.22), '#d8dadf', at(0, 11.3, 3.2)],
    ];
    for (const sx of [-6.5, 6.5]) for (const sz of [-1.9, 1.9]) parts.push([B(1.3, 10.4, 1.3), col, at(sx, 5.2, sz)]);
    for (let i = -6; i <= 6; i++) parts.push([B(0.7, 0.04, 0.12), '#ffd23f', at(i * 1.1, 10.92, 0)]);
    return mergeColored(parts);
  });
  g.add(mesh(body, vcMat({ rim: true })));
  if (id === 'neon') { const strip = mesh(B(14.8, 0.12, 0.12), mat('#ff3dd0', { emissive: 0xff3dd0, ei: 1.6 })); strip.position.set(0, 9.85, 0); g.add(strip); }
  const lightMat = mat('#ffffff', { vc: true, emissive: 0xffffff, ei: 1.0 });
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? 1 : -1;
    const car = new THREE.Group();
    car.add(mesh(carGeo(pick(['#d8452f', '#2f6fe0', '#f2b81c', '#1f8a5a', '#e8e8ee', '#7a46c7'])), vcMat({ rim: true })));
    car.add(mesh(lightsGeo(), lightMat));
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.position.set(0, 10.9, dir * 1.2);
    g.add(car);
    const sp = 4 + rand(0, 4), ph = rand(0, 26);
    seg.anims.push((dt, t) => { car.position.x = dir * (((t * sp + ph) % 26) - 13); });
  }
  seg.add(g);
}

// ------------------------------------------------------------------ ferris wheel
function ferris(seg, side, neon) {
  const R = 12;
  const g = new THREE.Group();
  g.position.set(side * rand(48, 56), 24, -rand(10, L - 10));
  const ringMat = neon ? mat('#ff3dd0', { emissive: 0xff3dd0, ei: 1.4 }) : vcMat({ rim: true });
  const ring = new THREE.TorusGeometry(R, 0.32, 6, 44).rotateY(Math.PI / 2);
  const spokes = [];
  for (let i = 0; i < 8; i++) spokes.push([B(0.18, R * 2, 0.18), neon ? '#2bdcff' : '#e8e8ee', (gg) => gg.rotateX((i * Math.PI) / 8)]);
  const wheel = new THREE.Group();
  const rm = mesh(ring, neon ? ringMat : mat('#e8e8ee'));
  wheel.add(rm);
  wheel.add(mesh(mergeColored(spokes), neon ? mat('#ffffff', { vc: true, emissive: 0x2bdcff, ei: 0.9 }) : vcMat()));
  const cabins = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cab = mesh(memo('cabin', () => mergeColored([[B(1.5, 1.2, 1.5), '#ff5d5d', at(0, -0.9, 0)], [B(1.7, 0.2, 1.7), '#ffd23f', at(0, -0.2, 0)]])), vcMat({ rim: true }));
    cab.position.set(0, Math.cos(a) * R, Math.sin(a) * R);
    wheel.add(cab); cabins.push(cab);
  }
  g.add(wheel);
  g.add(mesh(mergeColored([[B(1.2, 24, 1.2), '#8a8f99', (gg) => { gg.rotateX(0.18); gg.translate(0, -12, 3); }], [B(1.2, 24, 1.2), '#8a8f99', (gg) => { gg.rotateX(-0.18); gg.translate(0, -12, -3); }]]), vcMat()));
  const ph = rand(0, 6), sp = 0.12;
  seg.anims.push((dt, t) => { wheel.rotation.x = t * sp + ph; for (const c of cabins) c.rotation.x = -wheel.rotation.x; });
  seg.add(g);
}

// ------------------------------------------------------------------ desert
function windmill(seg, side) {
  const x = side * rand(12, 22), z = -rand(8, L - 8);
  const g = new THREE.Group();
  g.position.set(x, terrainY('desert', x, seg.index * L - z), z);
  g.rotation.y = -side * Math.PI / 2;
  g.scale.setScalar(1.25);
  g.add(mesh(memo('wm.tower', () => mergeColored([[CY(0.5, 0.9, 7, 7), '#8a6a4a', at(0, 3.5, 0)], [new THREE.ConeGeometry(1.1, 1.2, 7), '#5a3a22', at(0, 7.5, 0)]])), vcMat({ rim: true })));
  const blades = mesh(memo('wm.blades', () => mergeColored([0, 1, 2, 3].map((i) => [B(0.28, 4.8, 0.08), i % 2 ? '#f1e6cc' : '#e0d2b0', (gg) => { gg.translate(0, 2.4, 0); gg.rotateZ((i * Math.PI) / 2); }]))), vcMat());
  blades.position.set(0, 6.6, -0.8);
  g.add(blades);
  const ph = rand(0, 6), sp = 0.9 + rand(0, 0.8);
  seg.anims.push((dt, t) => { blades.rotation.z = t * sp + ph; });
  seg.add(g);
}
function pumpjack(seg, side) {
  const x = side * rand(11, 24), z = -rand(8, L - 8);
  const g = new THREE.Group();
  g.position.set(x, terrainY('desert', x, seg.index * L - z), z);
  g.rotation.y = -side * Math.PI / 2;
  g.scale.setScalar(1.3);
  g.add(mesh(memo('pj.base', () => mergeColored([[B(3.2, 0.3, 1.2), '#3a3d46', at(0, 0.15, 0)], [B(0.14, 3.2, 0.14), '#cf5a2a', (gg) => { gg.rotateZ(0.42); gg.translate(-0.7, 1.7, 0.4); }], [B(0.14, 3.2, 0.14), '#cf5a2a', (gg) => { gg.rotateZ(-0.42); gg.translate(0.7, 1.7, 0.4); }], [B(0.14, 3.2, 0.14), '#cf5a2a', (gg) => { gg.rotateZ(0.42); gg.translate(-0.7, 1.7, -0.4); }], [B(0.14, 3.2, 0.14), '#cf5a2a', (gg) => { gg.rotateZ(-0.42); gg.translate(0.7, 1.7, -0.4); }], [B(0.12, 1.4, 0.12), '#2a2d35', at(1.6, 0.9, 0)]])), vcMat({ rim: true })));
  const beam = mesh(memo('pj.beam', () => mergeColored([[B(4.2, 0.3, 0.4), '#e06a2a', at(0, 0, 0)], [B(0.8, 0.9, 0.42), '#e06a2a', at(2.2, -0.1, 0)], [B(0.9, 0.9, 0.5), '#3a3d46', at(-2.0, -0.45, 0)]])), vcMat({ rim: true }));
  beam.position.set(0, 3.2, 0);
  g.add(beam);
  const ph = rand(0, 6);
  seg.anims.push((dt, t) => { beam.rotation.z = Math.sin(t * 1.5 + ph) * 0.26; });
  seg.add(g);
}
function tumbleweed(seg, side) {
  const m = mesh(memo('tw', () => { const g = new THREE.IcosahedronGeometry(0.7, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(i * 12.9) * 0.18; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } return mergeColored([[g, '#b89a5a']]); }), vcMat());
  const x = side * rand(9.5, 16);
  const ph = rand(0, L + 60), v = 11 + rand(0, 6);
  seg.anims.push((dt, t) => { const z = -L - 10 + ((t * v + ph) % (L + 60)); m.position.set(x, 0.65 + Math.abs(Math.sin(t * 6 + ph)) * 0.35, z); m.rotation.x = -t * v / 0.7; });
  seg.add(m);
}

// ------------------------------------------------------------------ snow: ski lift
function skilift(seg, side) {
  const x = side * rand(15.5, 18);
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  const pyl = memo('sl.pylon', () => mergeColored([[CY(0.22, 0.3, 9, 8), '#6b7280', at(0, 4.5, 0)], [B(2.4, 0.2, 0.3), '#4b5160', at(0, 9, 0)]]));
  for (const z of [-8, -30, -52]) { const p = mesh(pyl, vcMat({ rim: true })); p.position.set(0, terrainY('snow', x, seg.index * L - z), z); g.add(p); }
  const cable = mesh(B(0.06, 0.06, L), mat('#222')); cable.position.set(0.0, 9.0, -L / 2); g.add(cable);
  const cab = memo('sl.cab', () => mergeColored([[B(1.3, 1.1, 1.0), '#e8453c', at(0, -1.1, 0)], [B(1.0, 0.5, 1.02), '#9fd8ff', at(0, -0.9, 0)], [B(0.06, 1.0, 0.06), '#222', at(0, -0.3, 0)]]));
  for (let i = 0; i < 3; i++) {
    const c = mesh(cab, vcMat({ rim: true }));
    c.position.set(0, 9, 0); g.add(c);
    const ph = (i * L) / 3, sp = 5 + rand(0, 1);
    seg.anims.push((dt, t) => { c.position.z = -((t * sp + ph) % L); c.rotation.z = Math.sin(t * 1.7 + i) * 0.06; });
  }
  seg.add(g);
}

// ------------------------------------------------------------------ tropics
function sailboat(seg) {
  const g = new THREE.Group();
  const x = -rand(30, 75);
  g.position.set(x, -1.3, -rand(6, L - 6));
  const hull = mesh(memo('sb.hull', () => mergeColored([[B(1.3, 0.55, 3.6), '#f4efe2', at(0, 0.3, 0)], [B(1.34, 0.12, 3.64), '#d84a4a', at(0, 0.55, 0)], [new THREE.ConeGeometry(0.65, 1.2, 4), '#f4efe2', (gg) => { gg.rotateX(Math.PI / 2); gg.rotateY(Math.PI / 4); gg.translate(0, 0.3, -2.3); }], [B(0.9, 0.45, 1.2), '#8a5a2a', at(0, 0.8, 0.4)], [CY(0.05, 0.05, 6, 6), '#8a8f99', at(0, 3.3, -0.4)]])), vcMat({ rim: true }));
  g.add(hull);
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0, 5.2); shape.lineTo(2.4, 0.6); shape.closePath();
  const sail = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false }).rotateY(Math.PI / 2).translate(0, 0.6, -0.1), mat(pick(['#ffffff', '#ffb347', '#ff7ab8', '#7ad7ff'])));
  seg.own.push(sail.geometry);
  g.add(sail);
  g.scale.setScalar(1.5);
  const ph = rand(0, 6), v = 1.2 + rand(0, 1.5), z0 = g.position.z;
  seg.anims.push((dt, t) => { g.position.y = -1.3 + Math.sin(t * 1.3 + ph) * 0.12; g.rotation.z = Math.sin(t * 1.0 + ph) * 0.07; g.rotation.x = Math.sin(t * 0.8 + ph) * 0.04; g.position.z = z0 + Math.sin(t * 0.2 * v + ph) * 6; });
  seg.add(g);
}
function lighthouse(seg) {
  const x = rand(32, 46), z = -rand(10, L - 10);
  const g = new THREE.Group();
  g.position.set(x, terrainY('tropic', x, seg.index * L - z), z);
  const parts = [];
  for (let i = 0; i < 5; i++) parts.push([CY(1.5 - i * 0.12, 1.62 - i * 0.12, 2.6, 14), i % 2 ? '#e8453c' : '#f6f2ea', at(0, 1.3 + i * 2.6, 0)]);
  parts.push([CY(1.5, 1.2, 0.3, 14), '#2a2d35', at(0, 13.2, 0)], [new THREE.ConeGeometry(1.3, 1.4, 14), '#e8453c', at(0, 15.9, 0)]);
  g.add(mesh(mergeColored(parts), vcMat({ rim: true })));
  const lamp = mesh(CY(0.9, 0.9, 1.5, 12), mat('#fff6c0', { emissive: 0xffe9a0, ei: 1.8 })); lamp.position.y = 14.2; g.add(lamp);
  const beams = new THREE.Group(); beams.position.y = 14.2;
  for (const s of [1, -1]) { const b = mesh(new THREE.ConeGeometry(2.2, 40, 12, 1, true).translate(0, -20, 0).rotateZ(Math.PI / 2 * s), glow('#fff4b0', 0.22)); b.position.x = 0; beams.add(b); }
  fxLayer(beams);
  g.add(beams);
  const ph = rand(0, 6);
  seg.anims.push((dt, t) => { beams.rotation.y = t * 0.9 + ph; });
  g.scale.setScalar(1.4);
  seg.add(g);
}
function volcano(seg) {
  const x = rand(80, 96), z = -rand(10, L - 10);
  const g = new THREE.Group();
  g.position.set(x, terrainY('tropic', x, seg.index * L - z) - 1, z);
  const cone = new THREE.ConeGeometry(22, 30, 12, 6, true);
  const p = cone.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = (p.getY(i) + 15) / 30; c.set('#3d322f').lerp(new THREE.Color('#ff5a1f'), Math.pow(Math.max(0, k - 0.72) / 0.28, 1.6)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = mesh(cone, vcMat()); m.position.y = 15; g.add(m);
  const lava = mesh(CY(2.6, 2.6, 0.4, 14), mat('#ff6a2a', { emissive: 0xff5a1f, ei: 1.6 })); lava.position.y = 29.6; g.add(lava);
  seg.own.push(cone);
  seg.smokers.push({ x, y: 36, z });
  seg.add(g);
}

// ------------------------------------------------------------------ neon
function hovercar(seg) {
  const g = new THREE.Group();
  const col = pick(NEON);
  g.add(mesh(memo('hv.body', () => mergeColored([[B(1.5, 0.5, 3.2), '#20243f', at(0, 0, 0)], [B(1.0, 0.45, 1.3), '#10142a', at(0, 0.4, -0.3)], [B(1.6, 0.1, 3.3), '#0a0c1c', at(0, -0.3, 0)]])), vcMat({ rim: true })));
  g.add(mesh(B(1.4, 0.06, 3.0), mat(col, { emissive: new THREE.Color(col), ei: 1.8 })).translateY(-0.4));
  const under = mesh(new THREE.PlaneGeometry(2.6, 4.2), glow(col, 0.45)); under.rotation.x = -Math.PI / 2; under.position.y = -0.55; fxLayer(under); g.add(under);
  const hl = mesh(B(1.1, 0.12, 0.06), mat('#ffffff', { emissive: 0xffffff, ei: 2 })); hl.position.set(0, 0.0, 1.62); g.add(hl);
  const x = (chance(0.5) ? -1 : 1) * rand(8, 22), y = rand(15, 36), v = 16 + rand(0, 14), ph = rand(0, 300);
  g.position.set(x, y, 0);
  seg.anims.push((dt, t) => { g.position.z = -L - 30 + ((t * v + ph) % (L + 120)); g.position.y = y + Math.sin(t * 1.4 + ph) * 0.6; g.rotation.z = Math.sin(t * 0.9 + ph) * 0.08; });
  seg.add(g);
}
function searchlight(seg, side) {
  const g = new THREE.Group();
  g.position.set(side * rand(16, 28), 0, -rand(8, L - 8));
  const beam = mesh(new THREE.ConeGeometry(3.4, 90, 14, 1, true).translate(0, 45, 0), glow(pick(['#9fe8ff', '#ff9ae8', '#fff2a0']), 0.16));
  beam.rotation.z = side * 0.35;
  fxLayer(beam);
  g.add(beam);
  const ph = rand(0, 6), sp = 0.4 + rand(0, 0.5);
  seg.anims.push((dt, t) => { g.rotation.y = t * sp + ph; });
  seg.add(g);
}

export function addDynamic(seg, id) {
  if (chance(id === 'tropic' ? 0.2 : 0.3)) bridge(seg, id);
  for (const side of [-1, 1]) {
    if (id === 'city' && chance(0.1)) ferris(seg, side, false);
    if (id === 'neon' && chance(0.12)) ferris(seg, side, true);
    if (id === 'desert') { if (chance(0.3)) windmill(seg, side); if (chance(0.35)) pumpjack(seg, side); if (chance(0.45)) tumbleweed(seg, side); }
    if (id === 'snow' && chance(0.4)) skilift(seg, side);
    if (id === 'tropic' && side < 0) { if (chance(0.6)) sailboat(seg); if (chance(0.35)) sailboat(seg); }
    if (id === 'tropic' && side > 0) { if (chance(0.14)) lighthouse(seg); if (chance(0.1)) volcano(seg); }
    if (id === 'neon') { if (chance(0.5)) hovercar(seg); if (chance(0.3)) searchlight(seg, side); }
  }
}
void randInt;
