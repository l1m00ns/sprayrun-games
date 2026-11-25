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

// ---- scenery added in 2.1: skyline landmarks (city / neon), arctic and beach details, desert settlements
export function waterTower() {
  const legs = [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].map(([x, z]) => [cyl(0.12, 0.12, 6.4, 5), '#3f4551', T(x, 3.2, z)]);
  return merge([
    ...legs,
    [box(2.6, 0.12, 0.12), '#3f4551', T(0, 2.2, -1.1)], [box(2.6, 0.12, 0.12), '#3f4551', T(0, 2.2, 1.1)], [box(0.12, 0.12, 2.6), '#3f4551', T(-1.1, 4.4, 0)], [box(0.12, 0.12, 2.6), '#3f4551', T(1.1, 4.4, 0)],
    [cyl(1.7, 1.7, 2.8, 14), '#a06f48', T(0, 7.8, 0)], [cyl(1.78, 1.78, 0.14, 14), '#2e323c', T(0, 6.7, 0)], [cyl(1.78, 1.78, 0.14, 14), '#2e323c', T(0, 8.9, 0)],
    [cone(1.95, 1.2, 14), '#6e4a30', T(0, 9.9, 0)],
  ]);
}
export function crane() {
  return merge([
    [box(0.8, 24, 0.8), '#f2b81c', T(0, 12, 0)], [box(1.1, 1.6, 1.1), '#d99a0c', T(0, 24.4, 0)],
    [box(17, 0.6, 0.7), '#f2b81c', T(4.5, 25.4, 0)], [box(6, 0.6, 0.7), '#f2b81c', T(-5.2, 25.4, 0)], [box(2, 1.6, 1.4), '#3d4452', T(-6.4, 24.4, 0)],
    [box(0.9, 1.4, 1.1), '#fff', T(0.6, 24.7, 0.9)], [box(0.08, 7, 0.08), '#222a35', T(11, 21.5, 0)], [box(0.5, 0.6, 0.5), '#222a35', T(11, 17.8, 0)],
    [cone(0.5, 3, 4), '#f2b81c', T(0, 27.4, 0)],
  ]);
}
export function radioTower() {
  const bands = [0, 1, 2, 3, 4, 5].map((i) => [cyl(0.1 + (5 - i) * 0.03, 0.14 + (5 - i) * 0.04, 3, 4), i % 2 ? '#ff4a3a' : '#f4f4f4', T(0, 1.5 + i * 3, 0)]);
  return merge([...bands, ...[0, 1, 2, 3].map((i) => [box(1.6 - i * 0.3, 0.08, 0.08), '#f4f4f4', T(0, 3.4 + i * 4, 0)]), [sph(0.4, 6, 4), '#2e323c', T(0, 19.2, 0)]]);
}
export function beacon() { return merge([[sph(0.32, 6, 5), '#ff3030', T(0, 0, 0)]]); }
export function billboardPost() { return merge([[cyl(0.18, 0.2, 7.5, 6), '#3f4551', T(-2.2, 3.75, 0)], [cyl(0.18, 0.2, 7.5, 6), '#3f4551', T(2.2, 3.75, 0)], [box(6.4, 3.4, 0.3), '#161922', T(0, 8.4, 0)]]); }
export function billboardGlow() { return merge([[box(5.8, 2.8, 0.1), '#ffffff', T(0, 8.4, -0.2)]]); }
export function igloo() {
  return merge([[sph(2.1, 14, 9), '#eef6fc', chain((g) => g.scale(1, 0.72, 1), T(0, 0, 0))], [box(1.1, 1.0, 1.4), '#dfeaf4', T(0, 0.45, -1.8)], [box(0.8, 0.8, 0.5), '#18202e', T(0, 0.42, -2.45)],
    ...[0.5, 1.1, 1.6].map((y, i) => [cyl(2.1 - i * 0.55 + 0.02, 2.1 - i * 0.55 + 0.02, 0.05, 14), '#c5d6e6', T(0, y * 0.72, 0)])]);
}
export function iceCrystal() {
  return merge([[cone(0.5, 3.2, 5), '#aee2ff', T(0, 1.6, 0)], [cone(0.38, 2.2, 5), '#8fd0f5', chain((g) => g.rotateZ(0.35), T(0.7, 1.0, 0.2))], [cone(0.32, 1.7, 5), '#c9efff', chain((g) => g.rotateZ(-0.4), T(-0.65, 0.8, -0.1))]]);
}
export function lifeguard() {
  return merge([...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => [cyl(0.09, 0.11, 2.4, 5), '#f4f4f4', T(x, 1.2, z)]),
    [box(2.2, 0.15, 2.2), '#f4f4f4', T(0, 2.45, 0)], [box(1.7, 1.2, 1.7), '#e8453c', T(0, 3.1, 0)], [cone(1.6, 0.9, 4), '#f4f4f4', chain((g) => g.rotateY(Math.PI / 4), T(0, 4.15, 0))], [box(0.5, 2.5, 0.08), '#e8d8b8', chain((g) => g.rotateX(0.3), T(0, 1.2, -1.3))]]);
}
export function buoy() {
  return merge([[cyl(0.55, 0.65, 0.5, 10), '#e8453c', T(0, 0.25, 0)], [cyl(0.55, 0.55, 0.3, 10), '#fff', T(0, 0.65, 0)], [cyl(0.5, 0.45, 0.3, 10), '#e8453c', T(0, 0.95, 0)], [cyl(0.05, 0.05, 1.3, 5), '#2e323c', T(0, 1.8, 0)], [sph(0.14, 5, 4), '#ffd23f', T(0, 2.5, 0)]]);
}
export function oilTank() {
  return merge([[cyl(1.7, 1.7, 3.2, 14), '#cfc8b6', T(0, 1.6, 0)], [cyl(1.74, 1.74, 0.3, 14), '#9a3f2b', T(0, 1.0, 0)], [cyl(1.74, 1.74, 0.3, 14), '#9a3f2b', T(0, 2.4, 0)], [cone(1.75, 0.5, 14), '#a8a291', T(0, 3.45, 0)], [box(0.12, 3.2, 0.5), '#3f4551', T(1.75, 1.6, 0)]]);
}
export function adobe() {
  return merge([[box(4.4, 2.6, 3.4), '#c98e5a', T(0, 1.3, 0)], [box(4.7, 0.3, 3.7), '#b57a48', T(0, 2.75, 0)], [box(0.9, 1.6, 0.1), '#5a3a22', T(0.6, 0.8, -1.75)], [box(0.9, 0.7, 0.1), '#2a1c12', T(-1.2, 1.5, -1.75)],
    ...[-1.7, -0.6, 0.5, 1.6].map((x) => [cyl(0.09, 0.09, 0.9, 5), '#6a4a2e', chain((g) => g.rotateZ(Math.PI / 2), T(x, 2.35, -1.8))])]);
}

// ---- Palm Bay (tropic) set
export function pier() {
  const planks = [];
  for (let i = 0; i < 20; i++) planks.push([box(0.9, 0.06, 3.1), i % 2 ? '#a27548' : '#b98857', T(-9.5 + i, 0.16, 0)]);
  const posts = [];
  for (let i = 0; i < 6; i++) for (const z of [-1.4, 1.4]) posts.push([cyl(0.16, 0.18, 3.4, 6), '#5b3d24', T(-9 + i * 3.6, -1.2, z)]);
  return merge([[box(20, 0.2, 3.2), '#7a5632', T(0, 0.02, 0)], ...planks, ...posts, [box(20, 0.08, 0.1), '#5b3d24', T(0, 0.75, -1.5)], [box(20, 0.08, 0.1), '#5b3d24', T(0, 0.75, 1.5)],
    ...[0, 1, 2, 3, 4, 5].flatMap((i) => [[cyl(0.07, 0.07, 0.8, 5), '#5b3d24', T(-9 + i * 3.6, 0.5, -1.5)], [cyl(0.07, 0.07, 0.8, 5), '#5b3d24', T(-9 + i * 3.6, 0.5, 1.5)]])]);
}
export function tikiBar() {
  return merge([
    ...[[-1.7, -1.0], [1.7, -1.0], [-1.7, 1.0], [1.7, 1.0]].map(([x, z]) => [cyl(0.13, 0.15, 2.8, 6), '#6b4a2c', T(x, 1.4, z)]),
    [box(3.6, 1.0, 0.9), '#8a5a34', T(0, 0.5, -0.9)], [box(3.8, 0.14, 1.1), '#c79a5e', T(0, 1.05, -0.9)], [box(3.2, 0.9, 0.12), '#5a3a22', T(0, 1.7, 1.0)],
    ...[0, 1, 2, 3, 4].map((i) => [cyl(0.3, 0.3, 0.1, 8), '#c79a5e', T(-1.4 + i * 0.7, 0.7, 0.4)]), ...[0, 1, 2, 3, 4].map((i) => [cyl(0.06, 0.06, 0.7, 5), '#5b3d24', T(-1.4 + i * 0.7, 0.35, 0.4)]),
    [cone(2.9, 1.3, 8), '#caa45a', T(0, 3.45, 0)], [cyl(2.7, 2.9, 0.3, 8), '#b88f4a', T(0, 2.85, 0)], [sph(0.16, 6, 4), '#ffb347', T(-1.2, 1.3, -0.9)], [cyl(0.1, 0.1, 0.45, 6), '#2e8b57', T(0.4, 1.35, -0.9)], [cyl(0.1, 0.1, 0.45, 6), '#e8453c', T(0.8, 1.35, -0.9)],
  ]);
}
export function volleyNet() {
  return merge([[cyl(0.07, 0.08, 2.5, 6), '#d8dde4', T(-2.6, 1.25, 0)], [cyl(0.07, 0.08, 2.5, 6), '#d8dde4', T(2.6, 1.25, 0)], [box(5.2, 0.9, 0.03), '#f2f5f8', T(0, 1.95, 0)], [box(5.2, 0.1, 0.05), '#e8453c', T(0, 2.45, 0)], [box(5.2, 0.06, 0.05), '#fff', T(0, 1.55, 0)],
    [sph(0.28, 8, 6), '#fff6d8', T(1.6, 0.28, 1.3)]]);
}
export function towel() {
  return merge([[box(1.1, 0.05, 2.3), '#ff5a6a', T(0, 0.03, 0)], [box(1.12, 0.055, 0.3), '#fff', T(0, 0.04, -0.55)], [box(1.12, 0.055, 0.3), '#fff', T(0, 0.04, 0.25)], [sph(0.22, 7, 5), '#ffd9b3', chain((g) => g.scale(1.2, 0.5, 1), T(0, 0.12, -0.95))]]);
}
export function sandcastle() {
  return merge([[cyl(1.0, 1.25, 0.8, 10), '#e8cf93', T(0, 0.4, 0)], [cyl(0.45, 0.55, 1.3, 8), '#ecd49c', T(0, 1.4, 0)], [cyl(0.55, 0.45, 0.2, 8), '#e0c283', T(0, 2.1, 0)],
    ...[0, 1, 2, 3, 4, 5].map((i) => [box(0.18, 0.22, 0.18), '#e0c283', T(Math.cos((i / 6) * Math.PI * 2) * 0.46, 2.3, Math.sin((i / 6) * Math.PI * 2) * 0.46)]), [cyl(0.02, 0.02, 0.7, 4), '#fff', T(0, 2.7, 0)], [box(0.34, 0.22, 0.02), '#e8453c', T(0.18, 2.9, 0)]]);
}
export function canoe() {
  return merge([[sph(1, 10, 6), '#b5683a', chain((g) => g.scale(3.0, 0.42, 0.78), T(0, 0.28, 0))], [sph(1, 10, 6), '#5a3118', chain((g) => g.scale(2.7, 0.3, 0.6), T(0, 0.4, 0))], [box(0.14, 0.16, 1.5), '#8a5a34', T(0.4, 0.5, 0)], [box(0.14, 0.16, 1.5), '#8a5a34', T(-0.7, 0.5, 0)],
    [box(0.1, 1.6, 0.1), '#d9b27a', chain((g) => g.rotateZ(1.2), T(0.2, 0.7, 0.9))], [box(0.45, 0.04, 0.2), '#d9b27a', chain((g) => g.rotateZ(1.2), T(-0.4, 0.2, 0.9))]]);
}
export function hibiscus() {
  return merge([[sph(0.9, 7, 5), '#2f8f43', chain((g) => g.scale(1.2, 0.85, 1.1), T(0, 0.65, 0))], ...[[0.5, 1.0, 0.4], [-0.6, 0.9, 0.3], [0.1, 1.25, -0.3], [-0.2, 0.7, 0.8], [0.8, 0.7, -0.4]].map(([x, y, z], i) => [sph(0.17, 5, 4), i % 2 ? '#ff4f81' : '#ff9a3c', T(x, y, z)])]);
}
export function coconuts() {
  return merge([...[[0, 0, 0], [0.45, 0, 0.1], [0.2, 0.35, 0.05], [-0.3, 0, 0.3]].map(([x, y, z]) => [sph(0.28, 7, 5), '#6a4426', T(x, 0.28 + y, z)]), [cone(0.5, 0.15, 6), '#2f8f43', chain((g) => g.rotateZ(1.4), T(0.9, 0.12, 0.2))]]);
}

export const mergeColored = merge;
