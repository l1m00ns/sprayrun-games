import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as C from './consts.js';
import { mat, texMat, vcMat } from './materials.js';
import * as T from './textures.js';
import * as TT from './trainTex.js';
import { pick, randInt, chance, rand } from './util.js';

const LEN = C.CARRIAGE_LEN, W = C.TRAIN_W, BOT = C.TRAIN_BOTTOM, TOP = C.TRAIN_H, BH = TOP - BOT;
const cache = new Map();
const memo = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

// ------------------------------------------------------------------ helpers
function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const vcMerge = (list) => mergeGeometries(list.map(([geo, hex, fn]) => { if (fn) fn(geo); return paint(geo, hex); }));
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const SP = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
const at = (x, y, z) => (g) => g.translate(x, y, z);
const along = (g) => g.rotateX(Math.PI / 2); // cylinder axis y -> z
const side = (g) => g.rotateZ(Math.PI / 2); // cylinder axis y -> x
const both = (...fns) => (g) => fns.forEach((f) => f(g));

const part = (geo, mat2, cast = true) => ({ geo, mat: mat2, cast });

const underGeo = () => memo('under', () => {
  const l = [];
  for (const z of [2.3, LEN - 2.3]) {
    l.push([B(1.5, 0.3, 2.3), '#24252d', at(0, 0.42, -z)]);
    for (const sx of [-0.7, 0.7]) for (const dz of [-0.75, 0.75]) l.push([CY(0.38, 0.38, 0.12, 14), '#2f3038', both(side, at(sx, 0.38, -z + dz))]);
  }
  return vcMerge(l);
});
const roofDetGeo = () => memo('roofdet', () => {
  const l = [];
  for (const z of [2.2, 5.5, 8.8]) { l.push([B(0.9, 0.22, 1.5), '#aab0bb', at(0, TOP + 0.1, -z)]); l.push([B(0.7, 0.06, 1.2), '#7d838f', at(0, TOP + 0.24, -z)]); }
  return vcMerge(l);
});

function bodyBox(len = LEN) { return new THREE.BoxGeometry(W, BH, len, 4, 6, 18).translate(0, BOT + BH / 2, -len / 2); }

// Pull the ends of a box into a streamlined nose (front = +z end, back = -z end).
function nose(geo, front, back) {
  const p = geo.attributes.position, NL = 5.2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let s = 0;
    if (front) s = Math.max(s, (z + NL) / NL);
    if (back) s = Math.max(s, (-LEN + NL - z) / NL);
    s = Math.min(1, Math.max(0, s));
    if (s > 0) {
      const e = s * s * (3 - 2 * s);
      const t = (y - BOT) / BH;
      const top = TOP - 1.5 * e * e, bot = BOT + 0.45 * e;
      y = bot + t * (top - bot);
      x *= 1 - 0.66 * Math.pow(e, 1.4);
      const pull = 1.0 * Math.pow(Math.abs(x) / (W / 2), 2) * e;
      if (z > -LEN / 2) z -= pull; else z += pull;
      if (front && z > -LEN / 2) z = Math.min(z, 0); // never poke past the collision box
    }
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- materials
const dark = () => mat('#1c1c22');
const metroMats = (si, v) => memo(`metro${si}.${v}`, () => {
  const s = T.TRAIN_SCHEMES[si];
  const side2 = T.makeTrainSide(s, v), front = T.makeTrainFront(s);
  return [texMat(side2, { rim: true }), texMat(side2, { rim: true }), mat(s.roof, { rim: true }), dark(), texMat(front, { rim: true }), texMat(front, { rim: true })];
});

// ---------------------------------------------------------------- car types
function metro(si, v) {
  return memo(`car.metro${si}.${v}`, () => [part(bodyBox(), metroMats(si, v)), part(underGeo(), vcMat()), part(roofDetGeo(), vcMat())]);
}

function bullet(role, style, seed) {
  return memo(`car.bullet.${role}.${style}.${seed}`, () => {
    const pal = [['#e8eef8', '#2f6fe0'], ['#f2f4f6', '#e0453a'], ['#eef6f4', '#1fb59a'], ['#f4f0e6', '#7a46c7']][style % 4];
    const tex = TT.texBullet(pal[0], pal[1], seed);
    const g = bodyBox();
    nose(g, role === 'lead' || role === 'both', role === 'tail' || role === 'both');
    const glass = mat('#10243f', { rim: true });
    const sideM = texMat(tex, { rim: true }), roof = mat('#f1f4f8', { rim: true });
    return [part(g, [sideM, sideM, roof, dark(), glass, glass]), part(underGeo(), vcMat())];
  });
}

function maglev(role, style, seed) {
  return memo(`car.maglev.${role}.${style}.${seed}`, () => {
    const cols = [['#2bdcff', '#ff3dd0'], ['#ff3dd0', '#ffd23f'], ['#7dff6b', '#2bdcff']][style % 3];
    const tx = TT.texMaglev(cols[0], cols[1], seed);
    const g = bodyBox();
    nose(g, role === 'lead' || role === 'both', role === 'tail' || role === 'both');
    const m = texMat(tx.map, { emissive: 0xffffff, emissiveMap: tx.emissive, ei: 1.3, rim: true });
    const topM = mat('#141a33', { rim: true });
    const glow = mat(cols[0], { emissive: new THREE.Color(cols[0]), ei: 1.8 });
    const slab = new THREE.BoxGeometry(1.5, 0.08, LEN - 1.2).translate(0, BOT - 0.04, -LEN / 2);
    const front = mat(cols[1], { emissive: new THREE.Color(cols[1]), ei: 1.4 });
    return [part(g, [m, m, topM, topM, front, front]), part(slab, glow, false)];
  });
}

function loco(color, accent, num, withPlow) {
  return memo(`car.loco.${color}.${withPlow}`, () => {
    const len = withPlow ? LEN - 2.4 : LEN;
    const body = new RoundedBoxGeometry(W, BH, len, 3, 0.18).translate(0, BOT + BH / 2, -len / 2 - (withPlow ? 2.4 : 0));
    const tex = TT.texLoco(color, accent, num, num);
    const front = T.makeTrainFront({ body: color, roof: '#2a2d36', stripe: accent, skirt: '#1c1e26', windows: true, label: 'LOCO ' + num });
    const sideM = texMat(tex, { rim: true });
    const out = [part(body, [sideM, sideM, mat('#2a2d36', { rim: true }), dark(), withPlow ? dark() : texMat(front, { rim: true }), dark()])];
    const top = [];
    const z0 = withPlow ? -2.4 : 0;
    for (const z of [3.0, 5.4]) top.push([CY(0.55, 0.55, 0.14, 14), '#15171c', at(0, TOP + 0.07, z0 - z - 1)]);
    for (const z of [3.0, 5.4]) for (let k = 0; k < 4; k++) top.push([B(0.9, 0.04, 0.05), '#555a66', at(0, TOP + 0.16, z0 - z - 1 + (k - 1.5) * 0.18)]);
    top.push([CY(0.12, 0.12, 0.5, 8), '#c9a227', at(0.6, TOP + 0.25, z0 - 1.3)]);
    out.push(part(vcMerge(top), vcMat({ rim: true })));
    out.push(part(underGeo(), vcMat()));
    if (withPlow) {
      const wedge = new THREE.ConeGeometry(1.35, 2.4, 4);
      wedge.scale(0.72, 1, 1.25).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, 1.95, -1.2);
      const stripes = new THREE.ConeGeometry(1.38, 2.42, 4);
      void stripes;
      out.push(part(paint(wedge, '#ffb000'), vcMat({ rim: true })));
      const bar = vcMerge([[B(0.12, 2.2, 0.1), '#1a1a1a', at(0, 1.9, -0.25)], [B(1.6, 0.12, 0.1), '#1a1a1a', at(0, 1.3, -0.5)]]);
      out.push(part(bar, vcMat()));
    }
    return out;
  });
}

function steam(main) {
  return memo(`car.steam.${main}`, () => {
    const l = [
      [B(1.5, 0.5, LEN - 0.6), '#2a2d35', at(0, 0.8, -(LEN - 0.6) / 2 - 0.3)],
      [B(1.7, 0.12, 1.1), '#e0a010', both((g) => g.rotateX(-0.45), at(0, 0.75, -0.5))],
      [CY(0.95, 0.95, 1.5, 18), '#22252c', both(along, at(0, 2.75, -0.8))],
      [CY(0.88, 0.88, 0.1, 18), '#3b3f49', both(along, at(0, 2.75, -0.02))],
      [CY(0.2, 0.2, 0.12, 10), '#c9a227', both(along, at(0, 2.75, 0.03))],
      [CY(0.95, 0.95, 5.2, 18), main, both(along, at(0, 2.75, -4.2))],
      [CY(0.99, 0.99, 0.2, 18), '#c9a227', both(along, at(0, 2.75, -2.2))],
      [CY(0.99, 0.99, 0.2, 18), '#c9a227', both(along, at(0, 2.75, -4.1))],
      [CY(0.99, 0.99, 0.2, 18), '#c9a227', both(along, at(0, 2.75, -6.0))],
      [SP(0.4), '#c9a227', both((g) => g.scale(1, 0.8, 1), at(0, 3.72, -3.5))],
      [SP(0.3), '#c9a227', both((g) => g.scale(1, 0.8, 1), at(0, 3.72, -5.4))],
      [CY(0.2, 0.26, 1.0, 10), '#22252c', at(0, 3.9, -0.8)], [CY(0.42, 0.22, 0.26, 12), '#22252c', at(0, 4.52, -0.8)],
      // cab
      [B(0.12, 2.8, 3.6), main, at(-0.89, 2.3, -9.2)], [B(0.12, 2.8, 3.6), main, at(0.89, 2.3, -9.2)],
      [B(W, 2.8, 0.12), main, at(0, 2.3, -7.4)], [B(W + 0.3, 0.16, 4.2), '#2a2d35', at(0, TOP - 0.08, -9.1)],
      [B(W, 0.2, 3.7), '#2a2d35', at(0, 0.95, -9.2)],
      [B(0.13, 0.8, 1.1), '#0c1830', at(-0.9, 2.9, -8.6)], [B(0.13, 0.8, 1.1), '#0c1830', at(0.9, 2.9, -8.6)],
      [B(1.5, 0.5, 0.1), '#e0a010', at(0, 0.8, -LEN + 0.1)],
    ];
    for (const sx of [-0.86, 0.86]) {
      for (const z of [3.4, 5.2, 7.0]) { l.push([CY(0.78, 0.78, 0.14, 18), '#d83a2f', both(side, at(sx, 0.78, -z))]); l.push([CY(0.2, 0.2, 0.18, 8), '#2a2d35', both(side, at(sx, 0.78, -z))]); }
      l.push([CY(0.4, 0.4, 0.12, 12), '#2a2d35', both(side, at(sx, 0.4, -1.3))]);
      l.push([B(0.06, 0.1, 3.6), '#cfcfcf', at(sx * 1.15, 0.95, -5.2)]);
    }
    const lens = new THREE.Mesh();
    void lens;
    const lamp = mat('#fff6c0', { emissive: 0xffe9a0, ei: 1.6 });
    const lampGeo = both(along, at(0, 3.45, 0.02));
    const lg = CY(0.28, 0.28, 0.3, 14); lampGeo(lg);
    return [part(vcMerge(l), vcMat({ rim: true })), part(lg, lamp, false)];
  });
}

function tender() {
  return memo('car.tender', () => {
    const coal = new THREE.IcosahedronGeometry(1, 1).scale(0.88, 0.78, 4.9).translate(0, 2.95, -LEN / 2);
    return [part(vcMerge([
      [B(W, 1.9, LEN - 0.4), '#25282f', at(0, 1.55, -LEN / 2)], [B(W + 0.1, 0.12, LEN - 0.2), '#c9a227', at(0, 2.55, -LEN / 2)],
      [B(0.4, 0.4, 0.3), '#c9a227', at(0.4, 1.4, 0.05)],
    ]), vcMat({ rim: true })), part(paint(coal, '#17181c'), vcMat()), part(underGeo(), vcMat())];
  });
}

function tank(color) {
  return memo(`car.tank.${color}`, () => {
    const l = [
      [B(W - 0.1, 0.7, LEN - 0.2), '#2a2d35', at(0, 0.85, -LEN / 2)],
      [CY(0.95, 0.95, 9.4, 20), color, both(along, at(0, 2.75, -LEN / 2))],
      [SP(0.95, 14, 10), color, both((g) => g.scale(1, 1, 0.4), at(0, 2.75, -0.55))],
      [SP(0.95, 14, 10), color, both((g) => g.scale(1, 1, 0.4), at(0, 2.75, -LEN + 0.55))],
      [B(0.5, 0.06, 9), '#454955', at(0, TOP + 0.03, -LEN / 2)], [CY(0.32, 0.32, 0.26, 10), '#454955', at(0, TOP + 0.14, -LEN / 2)],
      [CY(0.97, 0.97, 0.32, 20), '#f4f4f4', both(along, at(0, 2.75, -LEN / 2))],
      [CY(0.975, 0.975, 0.1, 20), '#e63b2e', both(along, at(0, 2.75, -2.6))], [CY(0.975, 0.975, 0.1, 20), '#e63b2e', both(along, at(0, 2.75, -8.4))],
    ];
    return [part(vcMerge(l), vcMat({ rim: true })), part(underGeo(), vcMat())];
  });
}

function flat(seed) {
  return memo(`car.flat.${seed}`, () => {
    const cols = ['#d4572b', '#2f7fd0', '#e0b02a', '#3a9a5a', '#a23a8a', '#cf3a3a'];
    const labels = ['ZIPCO', 'BOLT', 'NOVA', 'SKYLINE', 'FIZZ', 'RAIL+'];
    const parts = [part(vcMerge([[B(W, 0.4, LEN), '#2a2d35', at(0, 0.9, -LEN / 2)]]), vcMat({ rim: true })), part(underGeo(), vcMat())];
    for (let i = 0; i < 2; i++) {
      const k = (seed + i * 3) % cols.length;
      const tex = TT.texContainer(cols[k], labels[k], seed + i);
      const sm = texMat(tex, { rim: true });
      const g = new THREE.BoxGeometry(W - 0.06, 2.5, 5.1).translate(0, 1.1 + 1.25, -(i ? 8.2 : 2.7));
      parts.push(part(g, [sm, sm, mat('#555a66', { rim: true }), dark(), sm, sm]));
    }
    return parts;
  });
}

function caboose() {
  return memo('car.caboose', () => {
    const tex = TT.texCaboose(3), sm = texMat(tex, { rim: true });
    const body = new THREE.BoxGeometry(W, BH, LEN).translate(0, BOT + BH / 2, -LEN / 2);
    const roof = mat('#5a1410', { rim: true });
    const cup = vcMerge([[B(1.3, 0.9, 1.8), '#c4332b', at(0, TOP + 0.45, -LEN / 2)], [B(1.4, 0.12, 2.0), '#5a1410', at(0, TOP + 0.95, -LEN / 2)], [B(1.0, 0.45, 0.06), '#1b2a44', at(0, TOP + 0.5, -LEN / 2 + 0.92)]]);
    const rail = vcMerge([[B(W, 0.08, 0.08), '#cfcfcf', at(0, 1.6, -LEN + 0.1)], [B(0.08, 1.0, 0.08), '#cfcfcf', at(-0.9, 1.1, -LEN + 0.1)], [B(0.08, 1.0, 0.08), '#cfcfcf', at(0.9, 1.1, -LEN + 0.1)]]);
    return [part(body, [sm, sm, roof, dark(), sm, sm]), part(cup, vcMat({ rim: true })), part(rail, vcMat()), part(underGeo(), vcMat())];
  });
}

function tram(style, role) {
  return memo(`car.tram.${style}.${role}`, () => {
    const pal = [['#1fb59a', '#ffd23f'], ['#ff5fa2', '#ffffff'], ['#ffa62b', '#2f7fd0']][style % 3];
    const stripe = T.makeStripeTexture(pal[0], pal[1]); stripe.repeat.set(6, 1);
    const roofM = texMat(stripe, { rim: true });
    const l = [
      [B(W, 0.3, LEN), '#a87440', at(0, 0.65, -LEN / 2)], [B(W + 0.04, 0.55, LEN), pal[0], at(0, 0.5, -LEN / 2)],
    ];
    for (const sx of [-0.88, 0.88]) for (let i = 0; i < 6; i++) l.push([B(0.1, 2.5, 0.1), '#f2f2f2', at(sx, 2.15, -0.4 - i * 2.04)]);
    for (let i = 0; i < 5; i++) for (const sx of [-0.45, 0.45]) { l.push([B(0.7, 0.14, 1.0), '#c88a50', at(sx, 1.15, -1.6 - i * 1.9)]); l.push([B(0.7, 0.7, 0.08), '#c88a50', at(sx, 1.5, -1.12 - i * 1.9)]); }
    if (role === 'lead') {
      l.push([B(W, 1.5, 0.2), pal[0], at(0, 1.6, -0.1)], [CY(0.3, 0.3, 0.22, 14), '#fff6c0', both(along, at(0, 1.9, 0.02))], [B(1.2, 0.5, 0.06), '#1b2a44', at(0, 2.5, 0.0)]);
    }
    const roof = new THREE.BoxGeometry(W + 0.2, 0.24, LEN).translate(0, TOP - 0.12, -LEN / 2);
    return [part(vcMerge(l), vcMat({ rim: true })), part(roof, [roofM, roofM, roofM, dark(), roofM, roofM]), part(underGeo(), vcMat())];
  });
}

function hopper(color) {
  return memo(`car.hopper.${color}`, () => {
    const l = [
      [B(W - 0.1, 0.45, LEN - 0.2), '#2a2d35', at(0, 0.85, -LEN / 2)],
      [B(W, 2.3, LEN - 0.6), color, at(0, 2.2, -LEN / 2)],
      [B(W + 0.06, 0.16, LEN - 0.4), '#1d1f26', at(0, 3.38, -LEN / 2)],
    ];
    for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) l.push([B(0.08, 2.2, 0.16), '#1f2229', at(sx * 0.97, 2.2, -0.8 - i * 1.15)]);
    for (const z of [2.7, 8.3]) l.push([B(1.2, 0.5, 1.4), '#1d1f26', at(0, 0.62, -z)]);
    const coal = (z) => new THREE.IcosahedronGeometry(1, 1).scale(0.82, 0.42, 2.4).translate(0, 3.3, z);
    return [part(vcMerge(l), vcMat({ rim: true })), part(paint(coal(-2.9), '#14151a'), vcMat()), part(paint(coal(-8.1), '#1a1b21'), vcMat()), part(underGeo(), vcMat())];
  });
}

function lumber() {
  return memo('car.lumber', () => {
    const l = [[B(W - 0.1, 0.4, LEN), '#2a2d35', at(0, 0.9, -LEN / 2)]];
    for (const z of [0.6, 3.7, 7.3, 10.4]) for (const sx of [-0.97, 0.97]) l.push([B(0.09, 2.6, 0.09), '#6b4a2c', at(sx, 2.2, -z)]);
    const logs = [];
    [3, 3, 2, 2].forEach((n, r) => {
      for (let k = 0; k < n; k++) {
        const x = (k - (n - 1) / 2) * 0.62, len = 9.4 + ((k * 7 + r * 3) % 5) * 0.2;
        logs.push([CY(0.29, 0.29, len, 10), ['#8a5a32', '#7a4c28', '#9a6a3a'][(k + r) % 3], both(along, at(x, 1.38 + r * 0.6, -LEN / 2))]);
      }
    });
    return [part(vcMerge(l), vcMat({ rim: true })), part(vcMerge(logs), vcMat({ rim: true })), part(underGeo(), vcMat())];
  });
}

function reefer() {
  return memo('car.reefer', () => {
    const sm = texMat(TT.texReefer(), { rim: true });
    const body = new THREE.BoxGeometry(W, BH, LEN).translate(0, BOT + BH / 2, -LEN / 2);
    const fans = vcMerge([[CY(0.32, 0.32, 0.12, 12), '#9aa3ad', at(0, TOP + 0.06, -3)], [CY(0.32, 0.32, 0.12, 12), '#9aa3ad', at(0, TOP + 0.06, -8)], [B(0.9, 0.1, 1.2), '#c8d0d8', at(0, TOP + 0.05, -5.5)]]);
    const end = mat('#dfe6ec', { rim: true });
    return [part(body, [sm, sm, mat('#e9eef3', { rim: true }), dark(), end, end]), part(fans, vcMat({ rim: true })), part(underGeo(), vcMat())];
  });
}

function livestock(color) {
  return memo(`car.livestock.${color}`, () => {
    const l = [[B(W - 0.1, 0.35, LEN), '#2a2d35', at(0, 0.9, -LEN / 2)], [B(W - 0.15, 2.4, LEN - 0.3), '#1b120c', at(0, 2.25, -LEN / 2)], [B(W + 0.1, 0.14, LEN + 0.1), '#4a3a2a', at(0, 3.62, -LEN / 2)]];
    for (const sx of [-1, 1]) for (let i = 0; i < 26; i++) l.push([B(0.07, 2.2, 0.2), i % 5 === 2 ? '#6a2a1c' : color, at(sx * 0.955, 2.25, -0.35 - i * 0.4)]);
    for (const sx of [-1, 1]) for (const y of [1.5, 2.25, 3.0]) l.push([B(0.08, 0.1, LEN - 0.4), '#3a2a1e', at(sx * 0.985, y, -LEN / 2)]);
    return [part(vcMerge(l), vcMat({ rim: true })), part(underGeo(), vcMat())];
  });
}

function electric(color, accent, num) {
  return memo(`car.electric.${color}`, () => {
    const base = loco(color, accent, num, false);
    const arm = (x, z, s) => [B(0.07, 1.25, 0.07), '#aab0bb', both((g) => g.rotateZ(s * 0.5), at(x, TOP + 0.65, z))];
    const panto = vcMerge([
      [B(1.5, 0.08, 0.1), '#1d1f26', at(0, TOP + 1.25, -5)], [B(1.3, 0.05, 0.5), '#c9a227', at(0, TOP + 1.3, -5)],
      arm(-0.35, -5.4, 1), arm(0.35, -5.4, -1), arm(-0.35, -4.6, 1), arm(0.35, -4.6, -1),
    ]);
    return [...base, part(panto, vcMat({ rim: true }))];
  });
}

function decker(i) {
  return memo(`car.decker.${i}`, () => {
    const pal = [['#e8eef8', '#2f6fe0'], ['#f2f4f6', '#d9453b'], ['#f4efe0', '#1f8a5a'], ['#e9e2f4', '#7a46c7']][i % 4];
    const sm = texMat(TT.texDecker(pal[0], pal[1], i + 4), { rim: true });
    const front = texMat(T.makeTrainFront(T.TRAIN_SCHEMES[i % 5]), { rim: true });
    return [part(bodyBox(), [sm, sm, mat('#e8ebef', { rim: true }), dark(), front, front]), part(underGeo(), vcMat()), part(roofDetGeo(), vcMat())];
  });
}

// ------------------------------------------------------------- consists
const FREIGHT_COLORS = ['#f2c02a', '#aeb6c2', '#2a2d35', '#d8452f'];
const FREIGHT = {
  city: [['tank', 3], ['flat', 3], ['boxcar', 3], ['tankcar', 2], ['hopper', 2], ['reefer', 2], ['livestock', 1], ['lumber', 1]],
  snow: [['hopper', 3], ['lumber', 3], ['reefer', 3], ['tank', 2], ['boxcar', 2], ['flat', 2], ['tankcar', 1]],
  tropic: [['livestock', 2], ['flat', 3], ['boxcar', 2], ['reefer', 2], ['tank', 2], ['lumber', 2]],
  desert: [['livestock', 3], ['hopper', 3], ['tank', 3], ['boxcar', 2], ['flat', 2], ['tankcar', 2]],
  neon: [['reefer', 2], ['flat', 3], ['tank', 2], ['boxcar', 2]],
};
function wpick(list) {
  let total = 0;
  for (const [, w] of list) total += w;
  let r = rand(0, total);
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[0][0];
}
function freightCar(biomeId) {
  switch (wpick(FREIGHT[biomeId] || FREIGHT.city)) {
    case 'tank': return tank(pick(FREIGHT_COLORS));
    case 'flat': return flat(randInt(0, 5));
    case 'boxcar': return metro(5, randInt(0, 1));
    case 'tankcar': return metro(6, randInt(0, 1));
    case 'hopper': return hopper(pick(['#6a7a8a', '#8a4a2a', '#4a5a6a', '#9a8a5a']));
    case 'reefer': return reefer();
    case 'livestock': return livestock(pick(['#a8553a', '#8a6a3a', '#7a4a2a']));
    default: return lumber();
  }
}

// Returns the list of car part-lists for a train of n cars, plus metadata.
export function consist(biomeId, n) {
  const fam = pick({
    city: ['metro', 'metro', 'decker', 'bullet', 'freight', 'freight', 'electric'],
    snow: ['freight', 'freight', 'plowtrain', 'bullet', 'metro', 'electric'],
    tropic: ['tram', 'tram', 'freight', 'bullet', 'metro', 'decker'],
    desert: ['freight', 'freight', 'freight', 'metro'],
    neon: ['maglev', 'maglev', 'bullet', 'metro', 'decker', 'electric'],
  }[biomeId] || ['metro']);
  const cars = [];
  let steamHead = false;
  const style = randInt(0, 3), seed = randInt(1, 3);
  const role = (i) => (n === 1 ? 'both' : i === 0 ? 'lead' : i === n - 1 ? 'tail' : 'mid');
  if (fam === 'metro') { const si = pick([0, 0, 1, 1, 2, 3, 4]), v = randInt(0, 1); for (let i = 0; i < n; i++) cars.push(metro(si, v)); }
  else if (fam === 'decker') { const k = randInt(0, 3); for (let i = 0; i < n; i++) cars.push(decker(k)); }
  else if (fam === 'bullet') { for (let i = 0; i < n; i++) cars.push(bullet(role(i), style, seed)); }
  else if (fam === 'maglev') { for (let i = 0; i < n; i++) cars.push(maglev(role(i), style, seed)); }
  else if (fam === 'tram') { const st = randInt(0, 2); for (let i = 0; i < n; i++) cars.push(tram(st, i === 0 ? 'lead' : 'mid')); }
  else if (fam === 'electric') {
    cars.push(electric(pick(['#2f6fe0', '#d8452f', '#1f8a5a', '#7a46c7']), pick(['#ffffff', '#ffd23f']), 8000 + seed * 37));
    const si = pick([0, 1, 2, 4]), v = randInt(0, 1);
    while (cars.length < n) cars.push(metro(si, v));
  } else {
    const head = fam === 'plowtrain' ? 'plow' : biomeId === 'neon' ? 'loco' : pick(['steam', 'steam', 'loco', 'electric']);
    if (head === 'steam') { cars.push(steam(pick(['#1f6f4a', '#a8322a', '#2a4f8a', '#2a2d35']))); steamHead = true; if (n > 1) cars.push(tender()); }
    else if (head === 'plow') cars.push(loco('#e0742a', '#ffd23f', 4200 + seed, true));
    else if (head === 'electric') cars.push(electric(pick(['#2f6fe0', '#d8452f', '#1f8a5a']), '#ffffff', 8100 + seed * 31));
    else cars.push(loco(pick(['#2f6fe0', '#d8452f', '#1f8a5a', '#f2b81c']), pick(['#ffffff', '#ffd23f', '#1a1a1a']), 1000 + seed * 111, false));
    while (cars.length < n) {
      const last = cars.length === n - 1 && n >= 3;
      cars.push(last ? caboose() : freightCar(biomeId));
    }
  }
  return { cars: cars.slice(0, n), steam: steamHead };
}

export function buildTrain(biomeId, n) {
  const { cars, steam: hasSteam } = consist(biomeId, n);
  const g = new THREE.Group();
  cars.forEach((parts, i) => {
    const z = -i * (LEN + C.CARRIAGE_GAP);
    for (const p of parts) {
      const m = new THREE.Mesh(p.geo, p.mat);
      m.castShadow = p.cast; m.receiveShadow = true; m.frustumCulled = false;
      m.position.z = z;
      g.add(m);
    }
    if (i < cars.length - 1) { // vestibule between cars
      const v = new THREE.Mesh(vest(), mat('#24252d'));
      v.position.z = z - LEN; v.frustumCulled = false; g.add(v);
    }
  });
  g.userData.steam = hasSteam;
  return g;
}
const vest = () => memo('vest', () => new THREE.BoxGeometry(W - 0.4, BH - 0.7, C.CARRIAGE_GAP + 0.1).translate(0, BOT + (BH - 0.7) / 2 + 0.1, -C.CARRIAGE_GAP / 2));
