import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Low-poly scenery props, each merged into ONE vertex-coloured geometry so a whole forest
// of them is a single InstancedMesh draw call.
function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function merge(parts) {
  const geos = parts.map(([geo, hex, fn]) => { const g = geo; if (fn) fn(g); return paint(g, hex); });
  return mergeGeometries(geos);
}
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sph = (r, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs);
const T = (x, y, z) => (g) => g.translate(x, y, z);
const chain = (...fns) => (g) => fns.forEach((f) => f(g));

export function pine(snow = false) {
  const g = '#2f7d4a', g2 = '#3b9356', s = '#f2f7fb';
  const parts = [[cyl(0.22, 0.3, 1.4, 6), '#6b4a2c', T(0, 0.7, 0)]];
  const tiers = [[1.9, 2.0, 1.5], [1.45, 1.8, 2.7], [1.0, 1.6, 3.8]];
  tiers.forEach(([r, h, y], i) => {
    parts.push([cone(r, h, 8), i % 2 ? g2 : g, T(0, y, 0)]);
    if (snow) parts.push([cone(r * 0.8, h * 0.62, 8), s, T(0, y + h * 0.2, 0)]);
  });
  return merge(parts);
}

export function palm() {
  const parts = [];
  // curved trunk: stacked tilted segments
  let x = 0, y = 0;
  for (let i = 0; i < 7; i++) {
    const seg = cyl(0.2 - i * 0.012, 0.23 - i * 0.012, 0.9, 6);
    const tx = x, ty = y + 0.45;
    parts.push([seg, i % 2 ? '#a9794a' : '#bb8a58', chain((gg) => gg.rotateZ(-0.07 * i), T(tx, ty, 0))]);
    x += Math.sin(0.07 * i) * 0.9 * 0.5 + 0.04 * i; y += 0.88;
  }
  const topX = x, topY = y;
  parts.push([sph(0.32), '#6b4a2c', T(topX, topY, 0)]);
  // fronds
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = cone(0.34, 3.0, 4);
    parts.push([leaf, i % 2 ? '#2f9a3a' : '#43b84a', chain(
      (gg) => gg.scale(1, 1, 0.22), (gg) => gg.translate(0, 1.5, 0), (gg) => gg.rotateZ(Math.PI / 2 + 0.55),
      (gg) => gg.rotateY(a), T(topX, topY + 0.1, 0))]);
  }
  for (let i = 0; i < 3; i++) parts.push([sph(0.17), '#6a4a1f', T(topX + Math.cos(i * 2.1) * 0.3, topY - 0.25, Math.sin(i * 2.1) * 0.3)]);
  return merge(parts);
}

export function cactus() {
  const gcol = '#3b9a4a';
  return merge([
    [cyl(0.4, 0.45, 3.4, 8), gcol, T(0, 1.7, 0)], [sph(0.4), gcol, T(0, 3.4, 0)],
    [cyl(0.22, 0.22, 1.1, 7), gcol, chain((g) => g.rotateZ(Math.PI / 2), T(0.75, 1.9, 0))],
    [cyl(0.22, 0.22, 1.2, 7), gcol, T(1.3, 2.5, 0)], [sph(0.22), gcol, T(1.3, 3.1, 0)],
    [cyl(0.2, 0.2, 0.9, 7), gcol, chain((g) => g.rotateZ(Math.PI / 2), T(-0.65, 1.4, 0))],
    [cyl(0.2, 0.2, 1.0, 7), gcol, T(-1.1, 1.9, 0)], [sph(0.2), gcol, T(-1.1, 2.4, 0)],
    [sph(0.13), '#ff5fa2', T(0, 3.78, 0)],
  ]);
}

export function rock(tone = '#8a8f99', snow = false) {
  const parts = [[new THREE.DodecahedronGeometry(1, 0), tone, chain((g) => g.scale(1.3, 0.8, 1), T(0, 0.6, 0))],
    [new THREE.DodecahedronGeometry(0.6, 0), tone, chain((g) => g.scale(1, 0.8, 1), T(1.1, 0.35, 0.3))]];
  if (snow) parts.push([new THREE.DodecahedronGeometry(0.85, 0), '#f4f8fc', chain((g) => g.scale(1.15, 0.45, 0.9), T(0, 1.05, 0))]);
  return merge(parts);
}

export function mesa() {
  const bands = ['#b8542c', '#cf6a3a', '#e08850', '#c25a30', '#d77a46'];
  const parts = [];
  let y = 0;
  bands.forEach((c, i) => {
    const h = 2.2 + (i % 2) * 0.8;
    const r0 = 4.6 - i * 0.28, r1 = 4.6 - (i + 1) * 0.28;
    parts.push([cyl(r1, r0, h, 9), c, T(0, y + h / 2, 0)]);
    y += h;
  });
  parts.push([cyl(3.2, 3.3, 0.25, 9), '#e6a870', T(0, y + 0.1, 0)]);
  return merge(parts);
}

export function mountain() {
  return merge([
    [cone(16, 24, 7), '#5f7188', T(0, 12, 0)],
    [cone(7.2, 10.5, 7), '#ffffff', T(0, 19.0, 0)],
    [cone(11, 15, 6), '#6c7f96', T(10, 7.5, 3)],
    [cone(5, 6.5, 6), '#ffffff', T(10, 12.2, 3)],
  ]);
}

export function cabin() {
  const parts = [
    [box(4.2, 2.6, 3.4), '#8d5a34', T(0, 1.3, 0)],
    [box(4.4, 0.18, 3.6), '#5d3a1e', T(0, 0.1, 0)],
    [box(0.7, 1.7, 0.7), '#6b6b72', T(1.3, 3.2, -0.6)],
    [box(0.9, 0.2, 0.9), '#f4f8fc', T(1.3, 4.1, -0.6)],
    [box(0.9, 1.5, 0.12), '#4a2a14', T(-0.9, 0.85, 1.72)],
  ];
  // gabled roof (two slabs)
  parts.push([box(4.9, 0.28, 2.3), '#f4f8fc', chain((g) => g.rotateZ(0.0), (g) => g.rotateX(0.62), T(0, 3.25, 0.9))]);
  parts.push([box(4.9, 0.28, 2.3), '#f4f8fc', chain((g) => g.rotateX(-0.62), T(0, 3.25, -0.9))]);
  parts.push([box(4.9, 0.12, 2.5), '#5d3a1e', chain((g) => g.rotateX(0.62), T(0, 3.08, 0.9))]);
  parts.push([box(4.9, 0.12, 2.5), '#5d3a1e', chain((g) => g.rotateX(-0.62), T(0, 3.08, -0.9))]);
  return merge(parts);
}
export function cabinGlow() {
  return merge([[box(0.9, 0.8, 0.1), '#ffd98a', T(0.9, 1.5, 1.72)], [box(0.9, 0.8, 0.1), '#ffd98a', T(-1.8, 1.5, 1.72)]]);
}

export function hut() {
  return merge([
    [cyl(1.7, 1.8, 2.2, 10), '#d9b27a', T(0, 1.1, 0)],
    [cone(2.5, 2.2, 10), '#b98c3a', T(0, 3.2, 0)],
    [cone(0.35, 0.6, 6), '#8a5a22', T(0, 4.5, 0)],
    [box(0.8, 1.4, 0.15), '#5d3a1e', T(0, 0.75, 1.75)],
    [cyl(0.12, 0.12, 2.6, 6), '#8a5a22', T(-1.9, 1.3, 1.2)], [cyl(0.12, 0.12, 2.6, 6), '#8a5a22', T(1.9, 1.3, 1.2)],
  ]);
}

export function tiki() {
  return merge([[cyl(0.09, 0.12, 2.2, 6), '#7a4a22', T(0, 1.1, 0)], [cyl(0.28, 0.18, 0.3, 8), '#4a2a10', T(0, 2.3, 0)]]);
}
export function tikiFlame() {
  return merge([[cone(0.2, 0.6, 6), '#ffb347', T(0, 2.75, 0)], [cone(0.12, 0.45, 6), '#fff2a0', T(0, 2.7, 0)]]);
}

export function umbrella() {
  const cols = ['#ff3d71', '#ffffff'];
  const parts = [[cyl(0.04, 0.04, 2.3, 5), '#e8e8e8', T(0, 1.15, 0)]];
  for (let i = 0; i < 8; i++) {
    parts.push([new THREE.ConeGeometry(1.35, 0.6, 8, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), cols[i % 2], T(0, 2.3, 0)]);
  }
  return merge(parts);
}

export function snowman() {
  return merge([
    [sph(0.8, 10, 8), '#f6fafd', T(0, 0.75, 0)], [sph(0.58, 10, 8), '#f6fafd', T(0, 1.8, 0)], [sph(0.4, 10, 8), '#f6fafd', T(0, 2.55, 0)],
    [cone(0.07, 0.4, 5), '#ff8a1f', chain((g) => g.rotateX(Math.PI / 2), T(0, 2.55, -0.45))],
    [sph(0.05), '#111', T(-0.14, 2.65, -0.36)], [sph(0.05), '#111', T(0.14, 2.65, -0.36)],
    [cyl(0.3, 0.3, 0.3, 8), '#2a2a3a', T(0, 3.0, 0)], [cyl(0.42, 0.42, 0.06, 8), '#2a2a3a', T(0, 2.85, 0)],
    [box(0.9, 0.12, 0.35), '#e8453c', T(0, 2.2, -0.05)],
  ]);
}

export function surfboard() {
  return merge([[sph(0.5, 8, 6), '#29d6ff', chain((g) => g.scale(0.5, 3.2, 0.12), T(0, 1.7, 0))], [box(0.1, 2.6, 0.05), '#ffffff', T(0, 1.7, -0.07)]]);
}

export function lantern() {
  return merge([[box(0.5, 0.7, 0.5), '#ff3d3d', T(0, 0, 0)], [box(0.55, 0.1, 0.55), '#2a1a10', T(0, 0.4, 0)], [box(0.55, 0.1, 0.55), '#2a1a10', T(0, -0.4, 0)]]);
}

export function pipe() {
  return merge([[cyl(0.28, 0.28, 6, 8), '#6b7280', T(0, 3, 0)], [cyl(0.4, 0.4, 0.5, 8), '#4b5160', T(0, 0.3, 0)]]);
}

export function windmill() {
  return merge([
    [cyl(0.5, 0.9, 7, 7), '#8a6a4a', T(0, 3.5, 0)], [cone(1.1, 1.2, 7), '#5a3a22', T(0, 7.5, 0)],
    ...[0, 1, 2, 3].map((i) => [box(0.25, 4.6, 0.08), '#e8d8b8', chain((g) => g.translate(0, 2.3, 0), (g) => g.rotateZ((i * Math.PI) / 2 + 0.4), T(0, 6.6, -0.8))]),
  ]);
}

export const mergeColored = merge;
