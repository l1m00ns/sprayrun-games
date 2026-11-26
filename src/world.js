import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as C from './consts.js';
import { mat, texMat, basicMat, toonRamp, fxLayer } from './materials.js';
import { applyBend } from './bend.js';
import * as T from './textures.js';
import { rand, randInt, pick, chance, clamp, R, withSeed } from './util.js';
import { BIOMES, BIOME_ORDER, TOUR_SEGS, initBiomes, decorSnow, decorTropic, decorDesert, decorExtras, setYard } from './biomes.js';
import * as BT from './biomeTex.js';
import { addDynamic } from './dynamic.js';
import { buildTrain } from './trains.js';
import { getModel } from './models.js';

let A = null; // shared assets (geometries, materials, textures)
const L = C.SEG_LEN;
const WALL_COL = { city: '#8a8a86', snow: '#6f7b8b', tropic: '#d4b27a', desert: '#b9763f', neon: '#0f1226' };
const CAP_COL = { city: '#b3b3ad', snow: '#f4f8fc', tropic: '#8a5a32', desert: '#e0a870', neon: '#2b3260' };

// ------------------------------------------------------------------ coin models
function colorGeo(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { fn(c, pos.getX(i), pos.getY(i), pos.getZ(i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
// A chunky minted coin: raised rim, recessed face, embossed star on both sides.
function buildCoinGeo() {
  const prof = [[0, 0.06], [0.36, 0.06], [0.395, 0.1], [0.5, 0.1], [0.545, 0.06], [0.545, -0.06], [0.5, -0.1], [0.395, -0.1], [0.36, -0.06], [0, -0.06]].map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = new THREE.LatheGeometry(prof, 32).rotateX(Math.PI / 2);
  const body = colorGeo(lathe, (c, x, y) => { const r = Math.hypot(x, y); c.set(r > 0.385 ? '#ffd24a' : '#f2a90f'); });
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.11 : 0.27; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const front = new THREE.ExtrudeGeometry(star, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }).translate(0, 0, 0.055);
  const back = front.clone().rotateY(Math.PI);
  const paintStar = (g) => colorGeo(g, (c) => c.set('#fff1a6'));
  return mergeGeometries([body, paintStar(front), paintStar(back)]);
}
function buildGemGeo() {
  const g = new THREE.OctahedronGeometry(0.5, 0).scale(0.78, 1.15, 0.78);
  return colorGeo(g, (c, x, y) => c.set(y > 0.1 ? '#9ff3ff' : y > -0.1 ? '#3fd0ff' : '#1f86e8'));
}

export function initWorldAssets() {
  A = {};
  A.groundGeo = new THREE.PlaneGeometry(9.4, L, 4, 24).rotateX(-Math.PI / 2).translate(0, 0, -L / 2);
  A.outerGeo = new THREE.PlaneGeometry(100, L, 10, 24).rotateX(-Math.PI / 2).translate(0, -0.45, -L / 2);
  A.outerMat = mat('#4c4b52');
  A.outerMatNeon = mat('#10131f');

  const rails = [];
  for (const lx of C.LANES) {
    for (const sx of [-0.55, 0.55]) {
      rails.push(new THREE.BoxGeometry(0.11, 0.17, L, 1, 1, 24).translate(lx + sx, 0.12, -L / 2));
      rails.push(new THREE.BoxGeometry(0.2, 0.04, L, 1, 1, 24).translate(lx + sx, 0.04, -L / 2));
    }
  }
  A.railGeo = mergeGeometries(rails);
  A.railMat = mat('#9aa1ad');

  A.wallBox = new THREE.BoxGeometry(0.7, 2.6, L, 1, 1, 24).translate(0, 0.7, -L / 2);
  A.wallCap = new THREE.BoxGeometry(0.98, 0.14, L, 1, 1, 24).translate(0, 2.07, -L / 2);
  A.wallMats = {}; A.capMats = {};
  for (const id of BIOME_ORDER) { A.wallMats[id] = mat(WALL_COL[id]); A.capMats[id] = mat(CAP_COL[id]); }
  A.wallPlaneL = new THREE.PlaneGeometry(L, 2.0, 24, 1).rotateY(Math.PI / 2).translate(0, 1.0, -L / 2);
  A.wallPlaneR = new THREE.PlaneGeometry(L, 2.0, 24, 1).rotateY(-Math.PI / 2).translate(0, 1.0, -L / 2);
  const ft = T.makeFenceTexture();
  ft.repeat.set(L / 1.4, 1);
  A.fenceMat = texMat(ft, { transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  A.fenceGeo = new THREE.PlaneGeometry(L, 1.4, 24, 1).rotateY(Math.PI / 2).translate(0, 2.84, -L / 2);
  const posts = [];
  for (let z = 0; z <= L; z += 4.05) posts.push(new THREE.BoxGeometry(0.1, 1.5, 0.1).translate(0, 2.8, -z));
  A.postGeo = mergeGeometries(posts);
  A.postMat = mat('#59606b');

  // city facades
  A.facades = [];
  for (let style = 0; style < 5; style++) {
    for (let seed = 1; seed <= 2; seed++) {
      const f = T.makeFacade(style, seed);
      A.facades.push({ mat: texMat(f.map, { emissive: 0xffffff, emissiveMap: f.emissive, ei: 0 }), tileW: f.cols * 2.5, tileH: f.rows * 3.3 });
    }
  }
  A.roofMat = mat('#585a64');
  A.propMat = mat('#8b8f99');
  A.tankMat = mat('#8a5a3a');
  A.billboardMats = [0, 1, 2, 3].map((i) => texMat(T.makeBillboardTexture(i), { emissive: 0xffffff, ei: 0 }));
  A.billboardGeo = new THREE.PlaneGeometry(6, 3);
  A.billboardFrame = mat('#22232b');

  A.lampPole = mergeGeometries([
    new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8).translate(0, 2.1, 0),
    new THREE.BoxGeometry(1.5, 0.08, 0.1).translate(-0.7, 4.15, 0),
  ]);
  A.lampHead = new RoundedBoxGeometry(0.5, 0.12, 0.26, 2, 0.04).translate(-1.35, 4.08, 0);
  A.lampPoleMat = mat('#4a4f5a');
  A.lampMat = mat('#fff4d0', { emissive: 0xffe6a0, ei: 0.3 });

  A.gantryGeo = mergeGeometries([
    new THREE.BoxGeometry(0.25, 8.4, 0.25).translate(-5.3, 4.2, 0), new THREE.BoxGeometry(0.25, 8.4, 0.25).translate(5.3, 4.2, 0),
    new THREE.BoxGeometry(10.9, 0.3, 0.3).translate(0, 8.2, 0), new THREE.BoxGeometry(10.9, 0.18, 0.18).translate(0, 7.4, 0),
    new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(-3.7, 7.8, 0), new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(0, 7.8, 0), new THREE.BoxGeometry(0.1, 0.8, 0.1).translate(3.7, 7.8, 0),
  ]);
  A.signalGeo = new THREE.SphereGeometry(0.16, 10, 8);
  A.signalBoxGeo = new THREE.BoxGeometry(0.5, 0.95, 0.3);
  A.signalGreen = mat('#33ff77', { emissive: 0x33ff77, ei: 1.5 });
  A.signalRed = mat('#ff4444', { emissive: 0xff3333, ei: 1.5 });
  A.signalBoxMat = mat('#1b1c22');

  // ramp
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(C.RAMP_LEN, C.TRAIN_H); shape.lineTo(C.RAMP_LEN, 0); shape.closePath();
  A.rampGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.95, 0, 0);
  const hz = T.makeStripeTexture('#ffd23f', '#1d1d22'); hz.repeat.set(0.35, 0.35);
  A.rampMats = [texMat(hz), mat('#7c828e')];
  const rampLen = Math.hypot(C.RAMP_LEN, C.TRAIN_H);
  A.rampStripGeo = new THREE.BoxGeometry(0.12, 0.05, rampLen).translate(0, 0, -rampLen / 2);
  A.rampStripMat = mat('#ffd23f', { emissive: 0xffa800, ei: 0.2 });
  A.rampAngle = Math.atan2(C.TRAIN_H, C.RAMP_LEN);

  // low barrier
  const bt = T.makeStripeTexture('#e8453c', '#f7f7f7'); bt.repeat.set(2, 0.5);
  A.barrierBoardMat = texMat(bt);
  A.barrierBoards = mergeGeometries([new THREE.BoxGeometry(1.9, 0.22, 0.1).translate(0, 0.9, 0), new THREE.BoxGeometry(1.9, 0.22, 0.1).translate(0, 0.58, 0)]);
  A.barrierLegs = mergeGeometries([
    new THREE.BoxGeometry(0.1, 1.0, 0.1).translate(-0.8, 0.5, 0), new THREE.BoxGeometry(0.1, 1.0, 0.1).translate(0.8, 0.5, 0),
    new THREE.BoxGeometry(0.1, 0.1, 0.8).translate(-0.8, 0.05, 0), new THREE.BoxGeometry(0.1, 0.1, 0.8).translate(0.8, 0.05, 0),
  ]);
  A.barrierLegMat = mat('#c8ccd4');
  A.barrierLight = new THREE.SphereGeometry(0.1, 10, 8).translate(0, 1.1, 0);
  A.barrierLightMat = mat('#ffa21a', { emissive: 0xff8a00, ei: 1.2 });

  // overhead
  const ot = T.makeStripeTexture('#ffd23f', '#1d1d22'); ot.repeat.set(2, 0.6);
  A.overSlabMat = texMat(ot);
  A.overSlabGeo = new THREE.BoxGeometry(1.95, C.OVERHEAD_H, 1.3).translate(0, C.OVERHEAD_BOTTOM + C.OVERHEAD_H / 2, 0);
  const ph = C.OVERHEAD_BOTTOM + C.OVERHEAD_H;
  A.overPostGeo = mergeGeometries([-0.9, 0.9].flatMap((x) => [-0.55, 0.55].map((z) => new THREE.BoxGeometry(0.14, ph, 0.14).translate(x, ph / 2, z))));
  A.overPostMat = mat('#aeb4c0');

  // container (static lane blocker)
  const ctex = T.makeTrainSide(T.TRAIN_SCHEMES[5], 1);
  A.containerMats = [
    [texMat(ctex), texMat(ctex), mat('#7b5b45'), mat('#1c1c22'), mat('#8b4a26'), mat('#8b4a26')],
    [texMat(ctex, { color: 0x7fb3ff }), texMat(ctex, { color: 0x7fb3ff }), mat('#44505e'), mat('#1c1c22'), mat('#355f8a'), mat('#355f8a')],
  ];

  // coins, items
  A.coinGeo = buildCoinGeo();
  A.coinMat = mat('#ffffff', { vc: true, emissive: 0xb86e00, ei: 0.55, rim: true });
  A.gemGeo = buildGemGeo();
  A.gemMat = mat('#ffffff', { vc: true, emissive: 0x1a8aff, ei: 0.7, rim: true });
  A.itemMats = {};
  for (const k of Object.keys(C.POWERUPS)) {
    A.itemMats[k] = { face: texMat(T.makeIconTexture(k, C.POWERUPS[k].color), { emissive: 0xffffff, ei: 0, transparent: true }), side: mat(C.POWERUPS[k].color, { emissive: C.POWERUPS[k].color, ei: 0.6 }) };
  }
  A.itemGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.12, 36);
  A.glowTex = T.makeGlowTexture();
  const chest = mergeGeometries([
    new THREE.BoxGeometry(0.95, 0.55, 0.65).translate(0, -0.1, 0), new THREE.BoxGeometry(1.0, 0.22, 0.7).translate(0, 0.28, 0),
    new THREE.BoxGeometry(1.02, 0.6, 0.12).translate(0, 0, 0.0), new THREE.BoxGeometry(0.16, 0.7, 0.72).translate(0, 0.08, 0),
  ].map((g, i) => { const c = new THREE.Color(i < 2 ? '#8a4a1e' : '#ffd23f'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; }));
  const chestModel = getModel('chest'); // Blender-authored chest when available
  A.chestGeo = chestModel ? chestModel.clone().translate(0, -0.45, 0).scale(1.15, 1.15, 1.15) : chest;
  A.chestMat = mat('#ffffff', { vc: true, emissive: 0x442200, ei: 0.4 });

  initBiomes(A);
  // side tracks (rail yards): gravel + sleepers strip and two rails
  const yardTex = BT.makeYardTexture();
  yardTex.repeat.set(1, L / 3.6);
  const tint = { city: 0xffffff, snow: 0xdfe8ff, tropic: 0xfff0d0, desert: 0xffd9a8, neon: 0x7a80b8 };
  A.yardMats = {};
  for (const id of BIOME_ORDER) A.yardMats[id] = texMat(yardTex, { color: tint[id] });
  A.yardGeo = new THREE.PlaneGeometry(5.2, L, 2, 24).rotateX(-Math.PI / 2).translate(0, 0.02, -L / 2);
  // dashed lane boundaries: exact 2.2 m lanes, readable at speed without competing with the coins
  A.laneGeo = new THREE.BoxGeometry(0.055, 0.012, 1.35);
  A.laneMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });
  A.yardRailGeo = mergeGeometries([-0.75, 0.75].map((x) => new THREE.BoxGeometry(0.1, 0.15, L, 1, 1, 24).translate(x, 0.1, -L / 2)));
  A.nightMats = [...A.facades.map((f) => f.mat), ...A.neonFacades.map((f) => f.mat)];
}

export function setNight(n) {
  if (!A) return;
  for (const f of A.facades) f.mat.emissiveIntensity = n * 0.9;
  A.lampMat.emissiveIntensity = 0.25 + n * 3.0;
  for (const m of A.billboardMats) m.emissiveIntensity = 0.12 + n * 0.9;
  for (const m of A.glowMats) m.emissiveIntensity = 0.15 + n * 1.4;
  A.waterMat.emissiveIntensity = 0.25 * (1 - n);
}
export function tickWorldAssets(t) { if (A) A.waterTex.offset.set(t * 0.03, t * 0.05); }

// -------------------------------------------------------------- obstacles
function mesh(geo, m, cast = true, receive = false) {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = cast; o.receiveShadow = receive; o.frustumCulled = false;
  return o;
}
function makeRamp() {
  const g = new THREE.Group();
  g.add(mesh(A.rampGeo, A.rampMats, true, true));
  for (const sx of [-0.93, 0.93]) { const s = mesh(A.rampStripGeo, A.rampStripMat, false, false); s.position.set(sx, 0.02, 0); s.rotation.x = A.rampAngle; g.add(s); }
  return g;
}
function makeLow() {
  const g = new THREE.Group();
  g.add(mesh(A.barrierBoards, A.barrierBoardMat)); g.add(mesh(A.barrierLegs, A.barrierLegMat)); g.add(mesh(A.barrierLight, A.barrierLightMat, false));
  return g;
}
function makeOver() {
  const g = new THREE.Group();
  g.add(mesh(A.overSlabGeo, A.overSlabMat)); g.add(mesh(A.overPostGeo, A.overPostMat));
  return g;
}
function makeContainer(len, variant) {
  const g = new THREE.Group();
  const h = C.TRAIN_H / 2;
  for (let i = 0; i < 2; i++) {
    const m = mesh(new THREE.BoxGeometry(C.TRAIN_W, h, len).translate(0, h / 2 + i * h, -len / 2), A.containerMats[(variant + i) % 2], true, true);
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------- segment
class Segment {
  constructor() {
    this.group = new THREE.Group();
    this.z = 0;
    this.index = 0;
    this.biome = 'city';
    this.solids = [];
    this.own = [];
    this.anims = []; // per-frame animation callbacks (dt, worldTime)
    this.smokers = []; // chimneys: {x, y, z} in segment space
  }
  add(obj) { this.group.add(obj); return obj; }

  scenery(biome, index) {
    this.biome = biome.id;
    const id = biome.id;
    const bio = A.bio[id];
    const yard = { '-1': chance(0.42) && !(id === 'tropic'), 1: chance(0.42) }; // rail yards beside the main line
    this.add(mesh(A.groundGeo, bio.groundMat, false, true));
    if (id === 'city') this.add(mesh(A.outerGeo, A.outerMat, false, true));
    else if (id === 'neon') this.add(mesh(A.outerGeo, A.outerMatNeon, false, true));
    this.add(mesh(A.railGeo, A.railMat, false, true));
    { // lane dividers between the three lanes (x = -1.1 and +1.1), dashes every 4 m
      const n = 2 * Math.ceil(L / 4), dashes = new THREE.InstancedMesh(A.laneGeo, A.laneMat, n), d = new THREE.Object3D();
      let k = 0;
      for (const x of [-C.LANE_W / 2, C.LANE_W / 2]) for (let z = -1; z > -L; z -= 4) { d.position.set(x, 0.016, z); d.updateMatrix(); dashes.setMatrixAt(k++, d.matrix); }
      dashes.count = k; dashes.frustumCulled = false; dashes.castShadow = false; this.add(dashes);
    }

    for (const side of [-1, 1]) {
      const wallX = side * 5.05;
      const w = mesh(A.wallBox, A.wallMats[id], false, true); w.position.x = wallX; this.add(w);
      const cap = mesh(A.wallCap, A.capMats[id], false, true); cap.position.x = wallX; this.add(cap);
      const plane = mesh(side < 0 ? A.wallPlaneL : A.wallPlaneR, pick(bio.walls), false, true); plane.position.x = side * 4.69; this.add(plane);
      if ((id === 'city' && chance(0.65)) || id === 'neon' || (id === 'snow' && chance(0.3))) {
        const f = mesh(A.fenceGeo, A.fenceMat, false, false); f.position.x = side * 4.9; fxLayer(f); this.add(f);
        const p = mesh(A.postGeo, A.postMat, false, false); p.position.x = side * 4.9; this.add(p);
      }
      if (biome.lamps) {
        for (const z of [-12, -44]) {
          const pole = mesh(A.lampPole, A.lampPoleMat, false, false); pole.position.set(side * 4.95, 2.0, z); if (side > 0) pole.scale.x = -1; this.add(pole);
          const head = mesh(A.lampHead, A.lampMat, false, false); head.position.set(side * 4.95, 2.0, z); if (side > 0) head.scale.x = -1; this.add(head);
        }
      }
      if (id === 'city' || id === 'neon') {
        const facades = id === 'neon' ? A.neonFacades : A.facades;
        this.buildings(side, facades, yard[side] ? 15.5 : 8.0, 9, 15, 8, 15, 9, 30, id === 'neon');
        this.buildings(side, facades, 26, 12, 22, 18, 34, 24, 70, id === 'neon');
      }
      if (id === 'neon') {
        const tube = mesh(A.neonGeo, A.neonTubeMats[(index + (side > 0 ? 1 : 0)) % 4], false, false);
        tube.position.set(side * 4.6, 2.35, 0); fxLayer(tube); this.add(tube);
      }
    }
    setYard(yard);
    if (id === 'snow') decorSnow(this, A, index);
    else if (id === 'tropic') decorTropic(this, A, index);
    else if (id === 'desert') decorDesert(this, A, index);
    decorExtras(this, A, id, index);
    for (const side of [-1, 1]) if (yard[side]) this.railYard(side, id);
    addDynamic(this, id);

    if (biome.gantry && chance(0.7)) {
      const gz = -rand(14, L - 14);
      const g = mesh(A.gantryGeo, A.postMat, false, false); g.position.z = gz; this.add(g);
      for (const x of [-3.7, 0, 3.7]) {
        const b = mesh(A.signalBoxGeo, A.signalBoxMat, false, false); b.position.set(x, 7.1, gz); this.add(b);
        const s = mesh(A.signalGeo, chance(0.6) ? A.signalGreen : A.signalRed, false, false); s.position.set(x, 7.3, gz + 0.17); this.add(s);
      }
    }
  }

  // Side tracks with parked wagons (static, like a real yard) and sometimes a train rolling by.
  railYard(side, biome) {
    const decorate = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); return g; };
    const track = (x) => {
      const gnd = mesh(A.yardGeo, A.yardMats[biome], false, true); gnd.position.x = x; this.add(gnd);
      const rl = mesh(A.railGeo === A.yardRailGeo ? A.yardRailGeo : A.yardRailGeo, A.railMat, false, true); rl.position.x = x; this.add(rl);
    };
    const px = side * 9.4;
    track(px);
    let z = -rand(2, 8);
    while (z > -L + 14) {
      if (chance(0.8)) {
        const n = randInt(1, 3), len = n * C.CARRIAGE_LEN + (n - 1) * C.CARRIAGE_GAP;
        if (z - len < -L + 2) break;
        const g = decorate(buildTrain(biome, n));
        const flip = chance(0.5);
        g.position.set(px, 0, flip ? z - len : z);
        if (flip) g.rotation.y = Math.PI;
        this.add(g);
        if (g.userData.steam) this.smokers.push({ x: px, y: 4.6, z: flip ? z - len + 0.8 : z - 0.8 });
        z -= len + rand(2.5, 9);
      } else z -= rand(8, 20);
    }
    if (chance(0.45)) { // a train rolling by on the outer track
      const ox = side * 13.7;
      track(ox);
      const n = randInt(2, 3), len = n * C.CARRIAGE_LEN + (n - 1) * C.CARRIAGE_GAP;
      const g = decorate(buildTrain(biome, n));
      g.position.set(ox, 0, -L - len);
      this.add(g);
      const v = 16 + rand(0, 12), phase = rand(0, L + len + 90), span = L + len + 90;
      this.anims.push((dt, t) => { g.position.z = -L - len - 10 + ((t * v + phase) % span); });
    }
  }

  buildings(side, facades, xBase, wMin, wMax, hMin, hMax, dMin, dMax, neon) {
    let z = 0;
    while (z > -L) {
      const w = rand(wMin, wMax), d = rand(dMin, Math.min(dMax, dMin + 8)), h = rand(hMin, hMax) * (neon ? 1.35 : 1);
      const x = side * (xBase + d / 2 + rand(0, 2.5));
      const fa = pick(facades);
      const geo = new THREE.BoxGeometry(d, h, w);
      const uv = geo.attributes.uv;
      const ox = rand(0, 1), oy = rand(0, 1);
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        let su = 1, sv = 1;
        if (face < 2) { su = w / fa.tileW; sv = h / fa.tileH; } else if (face >= 4) { su = d / fa.tileW; sv = h / fa.tileH; }
        if (face < 2 || face >= 4) uv.setXY(i, uv.getX(i) * su + ox, uv.getY(i) * sv + oy);
      }
      const m = mesh(geo, [fa.mat, fa.mat, A.roofMat, A.roofMat, fa.mat, fa.mat], false, false);
      m.position.set(x, h / 2 - 0.2, z - w / 2);
      this.own.push(geo); this.add(m);
      if (xBase < 20 && !neon && chance(0.6)) {
        const p = mesh(new THREE.BoxGeometry(rand(1.5, 3), rand(0.8, 1.6), rand(1.5, 3)), A.propMat, false, false);
        p.position.set(x + rand(-d / 4, d / 4), h - 0.2 + p.geometry.parameters.height / 2, z - w / 2 + rand(-w / 4, w / 4));
        this.own.push(p.geometry); this.add(p);
        if (chance(0.4)) {
          const tank = mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.0, 12), A.tankMat, false, false);
          tank.position.set(x + rand(-d / 4, d / 4), h - 0.2 + 1.0 + 1.2, z - w / 2); this.own.push(tank.geometry); this.add(tank);
          const leg = mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), A.propMat, false, false);
          leg.position.set(tank.position.x, h - 0.2 + 0.6, tank.position.z); this.own.push(leg.geometry); this.add(leg);
        }
      }
      if (xBase < 20 && chance(neon ? 0.55 : 0.28)) {
        const faceX = x - side * (d / 2 + 0.06);
        const bb = mesh(neon ? new THREE.PlaneGeometry(5.5, 2.1) : A.billboardGeo, neon ? pick(A.neonSigns) : pick(A.billboardMats), false, false);
        if (neon) this.own.push(bb.geometry);
        bb.position.set(faceX, Math.min(h - 3, rand(6, neon ? 20 : 12)), z - w / 2);
        bb.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        this.add(bb);
        if (!neon) {
          const fr = mesh(new THREE.BoxGeometry(0.2, 3.3, 6.3), A.billboardFrame, false, false);
          fr.position.set(faceX + side * 0.12, bb.position.y, bb.position.z); this.own.push(fr.geometry); this.add(fr);
        }
      }
      z -= w + rand(0.4, 3);
    }
  }

  addSolid(s) { s.seg = this; this.solids.push(s); }

  dispose() {
    this.anims.length = 0; this.smokers.length = 0;
    this.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    for (const g of this.own) g.dispose();
    this.own.length = 0;
    this.solids.length = 0;
    this.group.clear();
  }
}

// --------------------------------------------------------------- coin field
export class CoinField {
  constructor(scene, capacity = 1800) {
    this.cap = capacity;
    this.mesh = new THREE.InstancedMesh(A.coinGeo, A.coinMat, capacity);
    this.gem = new THREE.InstancedMesh(A.gemGeo, A.gemMat, 240);
    this.col = new THREE.Color();
    for (const m of [this.mesh, this.gem]) {
      m.frustumCulled = false; m.castShadow = true; m.count = 0;
      m.setColorAt(0, this.col.set(1, 1, 1)); // allocate the per-instance colour buffer (used by the cursed tint)
      scene.add(m);
    }
    this.list = [];
    this.dummy = new THREE.Object3D();
    this.noCoin = false;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; this.gem.count = 0; }
  add(x, y, z, v = 1) { if (this.list.length < this.cap) this.list.push({ x, y, z, v, mag: false, off: (x * 7.3 + z * 3.1) % 6.28 }); }
  // Generation places coins and obstacles in the same pass, so a coin line could end up inside a train that was
  // placed next to it. Called once per segment with the index where that segment's coins start: every coin whose
  // centre is inside a solid is dropped, so nothing is ever visually buried in a wall.
  prune(from, seg) {
    const list = this.list;
    for (let i = list.length - 1; i >= from; i--) {
      const c = list[i];
      if (c.z < seg.z - 70 || c.z > seg.z + 1) continue;
      for (const s of seg.solids) {
        if (s.kind === 'over' || s.kind === 'ramp') continue; // coins above/under a bar are reachable
        if (Math.abs(c.x - s.x) > s.hw + 0.28) continue;
        const z0 = seg.z + s.lz0 + (s.off || 0), z1 = seg.z + s.lz1 + (s.off || 0);
        if (c.z < z0 - 0.3 || c.z > z1 + 0.3) continue;
        if (c.y > s.yMin - 0.25 && c.y < s.yMax - 0.45) { list.splice(i, 1); break; }
      }
    }
  }
  update(dt, speed, p, magnet, time, onCollect, onSparkle) {
    const d = this.dummy, list = this.list;
    const tint = this.noCoin ? this.col.setRGB(1, 0.18, 0.22) : this.col.setRGB(1, 1, 1);
    A.coinMat.emissiveIntensity = (this.noCoin ? 0.2 : 0.5) + 0.25 * Math.sin(time * 5);
    let w = 0, wc = 0, wg = 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      c.z += speed * dt;
      if (magnet && !c.mag && !this.noCoin) {
        const dx = c.x - p.x, dy = c.y - (p.y + 0.9), dz = c.z;
        if (dx * dx + dy * dy + dz * dz < magnet * magnet && dz < 3) c.mag = true;
      }
      if (c.mag) {
        const k = Math.min(1, dt * 14);
        c.x += (p.x - c.x) * k; c.y += (p.y + 0.9 - c.y) * k; c.z += (0 - c.z) * k;
        if (onSparkle && c.z < -4 && Math.random() < dt * 30) onSparkle(c);
      }
      const rad = c.v > 1 ? 0.9 : 0.8;
      if (Math.abs(c.x - p.x) < rad && Math.abs(c.z) < 1.0 && Math.abs(c.y - (p.y + p.h * 0.5)) < p.h * 0.5 + 0.6) { onCollect(c); continue; }
      if (c.z > 1.4) continue;
      if (c.z < -170) { list[w++] = c; continue; } // still ahead: keep it, but do not submit it to the GPU yet
      const bob = Math.sin(time * 3 + c.off) * 0.07;
      d.position.set(c.x, c.y + bob, c.z);
      d.rotation.set(0, time * (c.v > 1 ? 2.2 : 3.2) + c.off, 0);
      d.scale.setScalar(c.v > 1 ? 1.0 + Math.sin(time * 6 + c.off) * 0.06 : 1);
      d.updateMatrix();
      const target = c.v > 1 ? this.gem : this.mesh;
      const idx = c.v > 1 ? wg++ : wc++;
      target.setMatrixAt(idx, d.matrix);
      if (this.noCoin) target.setColorAt(idx, tint);
      list[w++] = c;
    }
    list.length = w;
    this.mesh.count = wc; this.gem.count = wg;
    this.mesh.instanceMatrix.needsUpdate = true; this.gem.instanceMatrix.needsUpdate = true;
    if (this.noCoin) { if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; if (this.gem.instanceColor) this.gem.instanceColor.needsUpdate = true; }
    if (onSparkle && w && Math.random() < dt * 9) {
      const c = list[(Math.random() * w) | 0];
      if (c.z > -45 && c.z < -7) onSparkle(c);
    }
  }
}

// --------------------------------------------------------------- item field
export class ItemField {
  constructor(scene) { this.scene = scene; this.list = []; }
  clear() { for (const it of this.list) this.scene.remove(it.group); this.list.length = 0; }
  add(type, x, y, z) {
    const g = new THREE.Group();
    const holder = new THREE.Group();
    let col = '#ffd23f';
    if (type === 'box') {
      const m = mesh(A.chestGeo, A.chestMat, true, false); holder.add(m); col = '#ffb347';
    } else {
      const m = A.itemMats[type];
      const disc = mesh(A.itemGeo, [m.side, m.face, m.face], true, false);
      disc.rotation.x = Math.PI / 2; holder.add(disc); col = C.POWERUPS[type].color;
    }
    g.add(holder);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), basicMat(col, { map: A.glowTex, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.frustumCulled = false; fxLayer(glow);
    g.add(glow);
    g.position.set(x, y, z);
    this.scene.add(g);
    this.list.push({ type, group: g, holder, glow, x, y, z, t: Math.random() * 6 });
  }
  update(dt, speed, p, camera, time, onCollect) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      it.z += speed * dt; it.t += dt;
      it.holder.rotation.y = it.t * 2.4;
      it.group.position.set(it.x, it.y + Math.sin(it.t * 3) * 0.12, it.z);
      it.glow.quaternion.copy(camera.quaternion);
      if (Math.abs(it.x - p.x) < 1.0 && Math.abs(it.z) < 1.2 && Math.abs(it.y - (p.y + p.h * 0.5)) < p.h * 0.5 + 0.9) {
        onCollect(it);
        this.scene.remove(it.group); this.list.splice(i, 1); continue;
      }
      if (it.z > 2.5) { this.scene.remove(it.group); this.list.splice(i, 1); }
    }
  }
}


// -------------------------------------------------------------------- world
export class World {
  constructor(scene) {
    this.scene = scene;
    this.playerHW = C.PLAYER_HW; // refreshed from the rendered runner's torso (see main.js)
    this.root = new THREE.Group();
    scene.add(this.root);
    this.segs = [];
    this.coins = new CoinField(scene);
    this.items = new ItemField(scene);
    this.gen = { sinceItem: 0 };
    this.dist = 0;
    this.speedHint = C.SPEED_START;
    this.mode = { kind: 'fixed', id: 'city' };
    this.seed = 1;
    this.nextIndex = 0;
    this.onSmoke = null;
    this.onTrainMove = null;
    this.t = 0;
    this.noCoin = false;
    this.noObstacles = false; // Explore mode: scenery only
    this.staticTrains = false; // multiplayer: all moving trains stay put so every client sees identical obstacles
    this.genZ = 0; // world z of the segment being generated (coins and items live in player-relative space)
  }

  setNoCoin(v) { this.noCoin = !!v; this.coins.noCoin = !!v; }

  // Oncoming trains in range: lets the HUD warn the player which lane to watch.
  warnings() {
    const out = [];
    for (const seg of this.segs) for (const o of seg.solids) {
      if (!o.vz) continue;
      const d = -(seg.z + o.lz1 + o.off);
      if (d > -2 && d < 150) out.push({ lane: Math.round(o.x / C.LANE_W) + 1, d, started: o.started });
    }
    return out;
  }

  setMode(kind, id = 'city') { this.mode = { kind, id }; }
  setSeed(seed) { this.seed = seed >>> 0; }

  biomeForIndex(i) {
    if (this.mode.kind === 'tour') return BIOMES[BIOME_ORDER[Math.floor(Math.max(0, i) / TOUR_SEGS) % BIOME_ORDER.length]];
    return BIOMES[this.mode.id] || BIOMES.city;
  }

  // Biome info for the player's current distance: current, next, and cross-fade amount.
  biomeState(dist) {
    if (this.mode.kind !== 'tour') return { a: this.mode.id, b: this.mode.id, t: 0 };
    const idx = Math.floor((dist + 0.3 * L) / L);
    const k = Math.floor(idx / TOUR_SEGS);
    const a = BIOME_ORDER[k % BIOME_ORDER.length], b = BIOME_ORDER[(k + 1) % BIOME_ORDER.length];
    const boundary = (k + 1) * TOUR_SEGS * L - 0.3 * L;
    const left = boundary - dist;
    const t = clamp(1 - (left - 30) / 230, 0, 1);
    return { a, b, t: t * t * (3 - 2 * t) };
  }

  clearSegs() {
    for (const s of this.segs) { this.root.remove(s.group); s.dispose(); }
    this.segs.length = 0;
  }

  reset({ calm = true } = {}) {
    this.clearSegs();
    this.coins.clear(); this.items.clear();
    this.gen = { sinceItem: 0 };
    this.nextIndex = 0;
    let z = L * 0.3;
    for (let i = 0; i < C.NUM_SEGS; i++) { this.spawnSeg(z, calm || i < 1); z -= L; }
  }

  startRun() {
    this.coins.clear(); this.items.clear();
    this.gen = { sinceItem: 0 };
    const keep = this.segs.slice(0, 1);
    for (const s of this.segs.slice(1)) { this.root.remove(s.group); s.dispose(); }
    this.segs = keep;
    this.nextIndex = keep[0].index + 1;
    let z = keep[0].z - L;
    for (let i = 1; i < C.NUM_SEGS; i++) { this.spawnSeg(z, false); z -= L; }
    this.dist = 0;
  }

  spawnSeg(z, calm) {
    const s = new Segment();
    s.z = z; s.group.position.z = z;
    s.index = this.nextIndex++;
    const biome = this.biomeForIndex(s.index);
    // Obstacles are stored segment-local, but coins/items are stored in player space: they need the segment's z added,
    // otherwise every coin line of every segment spawned right in front of the runner (the "coins never appear" bug).
    this.genZ = s.z;
    const coinMark = this.coins.list.length;
    withSeed(this.seed, s.index, () => {
      s.scenery(biome, s.index);
      if (!calm && !this.noObstacles) this.generate(s);
    });
    this.genZ = 0;
    this.root.add(s.group);
    this.segs.push(s);
    // A coin line can start slightly in front of its own segment, which means a train generated in the next
    // segment can later surround it. Scan the new segment against every coin, not only the ones it just made.
    if (this.coins.list.length > coinMark) for (const seg of this.segs) this.coins.prune(0, seg);
    return s;
  }

  update(dt, speed) {
    this.dist += speed * dt;
    this.speedHint = speed;
    this.t += dt;
    const dz = speed * dt;
    for (const s of this.segs) {
      s.z += dz; s.group.position.z = s.z;
      for (const fn of s.anims) fn(dt, this.t);
      if (this.onSmoke) for (const sm of s.smokers) { const wz = s.z + sm.z; if (wz < 8 && wz > -110 && Math.random() < dt * 10) this.onSmoke(sm.x, sm.y, wz); }
      for (const o of s.solids) {
        if (o.vz) {
          const d = -(s.z + o.lz1 + o.off);
          if (o.headlight) o.headlight.material.opacity = o.started ? 0.55 + 0.45 * Math.sin(this.t * 16) : 0.22 + 0.2 * Math.sin(this.t * 5);
          if (!this.staticTrains && !o.started && d < (o.trigger || 38) && d > 0) { o.started = true; if (this.onTrainMove) this.onTrainMove(o, d); }
          if (o.started && !this.staticTrains) { o.off += o.vz * dt; o.obj.position.z = o.baseZ + o.off; }
        }
        if (o.steam && this.onSmoke) {
          const wz = s.z + o.lz1 + (o.off || 0) - 0.8;
          if (wz < 8 && wz > -110 && Math.random() < dt * 14) this.onSmoke(o.x, 4.6, wz);
        }
      }
    }
    while (this.segs.length && this.segs[0].z - L > 16) {
      const old = this.segs.shift();
      this.root.remove(old.group); old.dispose();
      const far = this.segs[this.segs.length - 1];
      this.spawnSeg(far.z - L, false);
    }
  }

  // Remove obstacles within `dist` ahead (used when reviving).
  clearAhead(dist) {
    for (const s of this.segs) {
      s.solids = s.solids.filter((o) => {
        const zf = -(s.z + o.lz1 + (o.off || 0)), zb = -(s.z + o.lz0 + (o.off || 0));
        if (zb > -8 && zf < dist) { if (o.obj) o.obj.visible = false; return false; }
        return true;
      });
    }
  }

  // `sweep` is how far the world moved this frame. A fast train can cross the whole collision band between two
  // frames; without this the runner passed straight through it. Only lethal solids (trains, containers) are swept:
  // barriers must not be landed on early.
  probe(px, py, ph, frontDepth, sweep = 0, vy = 0) {
    let ground = 0, hit = null;
    const HD = 0.3, travel = Math.min(Math.max(sweep || 0, 0), 8);
    for (const seg of this.segs) {
      const sz = seg.z;
      if (sz - L > 30 || sz < -60) continue;
      for (const s of seg.solids) {
        const off = s.off || 0;
        const zMax = sz + s.lz1 + off, zMin = sz + s.lz0 + off;
        const zPad = s.lethal ? travel : 0;
        if (zMax < -HD - zPad || zMin > HD) continue;
        const adx = Math.abs(px - s.x);
        if (adx >= (this.playerHW || C.PLAYER_HW) + s.hw) continue;
        let top = s.yMax;
        if (s.ramp) {
          const f = clamp((zMax - 0) / (zMax - zMin), 0, 1);
          top = s.yMax * f;
          if (adx < 0.6) { ground = Math.max(ground, top); continue; }
        }
        // falling onto a roof is a landing, with a little extra reach for the corners (no more roof-edge deaths)
        if (s.walkable && py >= top - C.STEP_TOL - (vy <= 0 ? 0.16 : 0)) { ground = Math.max(ground, top); continue; }
        if (s.solidTop && py >= top - 0.04 && py < top + 0.8) { // a wall you cannot stand on: coming down onto the roof is a crash (the band is deep enough not to be skipped in one frame)
          if (!hit || !hit.front) hit = { solid: s, front: true, lethal: true, kind: s.kind };
          continue;
        }
        if (py + ph > s.yMin + 0.03 && py < top - (s.walkable ? C.STEP_TOL : 0.04)) {
          const depth = zMax + HD;
          const front = depth < frontDepth + (s.vz ? s.vz * 0.03 : 0);
          if (!hit || (front && !hit.front)) hit = { solid: s, front, lethal: s.lethal && front, kind: s.kind };
        }
      }
    }
    return { ground, hit };
  }

  // ------------------------------------------------------------- generation
  generate(seg) {
    const dist = Math.max(0, seg.index * L - L * 0.7);
    const d = clamp(dist / 4500, 0, 1);
    const speed = C.speedAtDist(dist);
    const h = clamp((dist - 4500) / 6000, 0, 1); // second difficulty tier: after ~4.5 km everything keeps tightening
    const gap = Math.max(9.5, speed * (0.8 - 0.26 * d - 0.08 * h)); // room for two lane changes; shrinks as the run goes on
    this.hard = h;
    let z = -9;
    const end = -L + 6;
    let hardStreak = 0;
    const biome = seg.biome;
    while (z > end) {
      let ev = this.pickEvent(d, hardStreak), vz = 0;
      if (ev === 'moving') {
        // reserve the road the oncoming train will cover once it starts moving
        vz = 11 + d * 6;
        const need = vz * 50 / (speed + vz) + 4; // road it covers after it starts moving, beyond the normal gap
        const zz = z - Math.max(0, need - gap);
        if (zz - 12 < -L) ev = 'low'; else z = zz;
      }
      const span = this.place(seg, ev, z, d, biome, vz);
      hardStreak = ev === 'coins' || ev === 'rest' ? 0 : hardStreak + 1;
      z -= span + gap + rand(0, 5 * (1 - d * 0.6));
    }
  }

  pickEvent(d, hardStreak) {
    const h = this.hard || 0;
    const table = [
      ['coins', 22 - d * 14 - h * 4 + hardStreak * 6], ['rest', 3 + hardStreak * 4], ['low', 20 - d * 4], ['over', 16 - d * 3],
      ['mixed', 8 + d * 24 + h * 8], ['train', 14 + d * 26], ['container', d > 0.18 ? 6 + d * 12 : 0], ['moving', d > 0.02 ? 12 + d * 26 + h * 6 : 0],
      ['corridor', d > 0.08 ? 6 + d * 38 + h * 16 : 0], // trains side by side with a free path (and barriers on it): slalom, gauntlets
    ];
    let total = 0;
    for (const t of table) total += t[1];
    let r = R.f() * total;
    for (const t of table) { r -= t[1]; if (r <= 0) return t[0]; }
    return 'coins';
  }

  // In No Coin mode only standalone coin lines (`free`) are kept: they never share a lane with an obstacle,
  // so a lane without coins is always available.
  addCoin(x, y, z, v = 1) { this.coins.add(x, y, z + this.genZ, v); }
  coinLine(x, y, z0, n, spacing = 1.8, free = false) { if (this.noCoin && !free) return; for (let i = 0; i < n; i++) this.addCoin(x, y, z0 - i * spacing); }
  coinArc(x, z0, n, spacing, base, h) {
    if (this.noCoin) return;
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.addCoin(x, base + Math.sin(t * Math.PI) * h, z0 - i * spacing); }
  }

  maybeItem(x, y, z, p = 0.22) {
    this.gen.sinceItem++;
    if (this.gen.sinceItem < 4 || !chance(p)) return false;
    this.gen.sinceItem = 0;
    const w = [['magnet', this.noCoin ? 0 : 3], ['jetpack', this.noCoin ? 0 : 2], ['sneakers', 3], ['mult', 3], ['box', 1.4]];
    let tot = 0; for (const a of w) tot += a[1];
    let r = R.f() * tot, type = 'magnet';
    for (const a of w) { r -= a[1]; if (r <= 0) { type = a[0]; break; } }
    this.items.add(type, x, y, z + this.genZ);
    return true;
  }

  // Carriages that still fit between z and the end of this segment (a train must not run into the next segment's first obstacles).
  fitCars(z) { return Math.max(1, Math.floor((z + L - 3 + C.CARRIAGE_GAP) / (C.CARRIAGE_LEN + C.CARRIAGE_GAP))); }

  // Trains on every lane that is not part of a free path. The path wanders one lane at a time (both lanes are open while it
  // moves, so it can always be followed) and, on straight stretches, holds a barrier: jump or roll while the lanes beside are walls.
  placeCorridor(seg, z, d, biome) {
    const U = C.CARRIAGE_LEN + C.CARRIAGE_GAP;
    const n = Math.min(this.fitCars(z), 2 + Math.floor(d * 2.4) + (chance(0.35) ? 1 : 0), 4);
    if (n < 2) { this.placeLow(seg, randInt(0, 2), z); return 4; }
    const free = [], barrier = [], bt = chance(0.5) ? 'low' : 'over'; // one barrier type per corridor: low then over (or the reverse) 0.3 s apart cannot be done at speed
    let cur = randInt(0, 2), straight = 0;
    const startLane = cur;
    for (let u = 0; u < n; u++) {
      if (u < n - 1 && chance(0.28 + d * 0.4)) {
        const nxt = cur === 1 ? (chance(0.5) ? 0 : 2) : 1;
        free.push([cur, nxt]); barrier.push(null); cur = nxt; straight = 0;
      } else {
        free.push([cur]);
        barrier.push(straight >= 1 && chance(0.2 + d * 0.5) ? bt : null); // never right after a lane change
        straight++;
      }
    }
    for (let l = 0; l < 3; l++) {
      for (let u = 0; u < n;) {
        if (free[u].includes(l)) { u++; continue; }
        let e = u; while (e < n && !free[e].includes(l)) e++;
        this.placeTrain(seg, l, z - u * U, e - u, false, biome, 0);
        u = e;
      }
    }
    for (let u = 0; u < n; u++) {
      const l = free[u][free[u].length - 1], zu = z - u * U;
      if (barrier[u] === 'low') this.placeLow(seg, l, zu - U / 2); else if (barrier[u] === 'over') this.placeOver(seg, l, zu - U / 2);
      else if (free[u].length === 1) this.coinLine(C.LANES[l], 1.0, zu - 1.5, 5, 1.8);
    }
    this.maybeItem(C.LANES[startLane], 1.4, z - 4, 0.25);
    return n * U;
  }

  // Removes solids near the player (hoverboard crash: the shockwave must not leave the runner standing inside a train).
  clearLane(x, ahead) {
    for (const s of this.segs) {
      s.solids = s.solids.filter((o) => {
        if (Math.abs(o.x - x) > 0.8) return true;
        const zf = -(s.z + o.lz1 + (o.off || 0)), zb = -(s.z + o.lz0 + (o.off || 0));
        if (zb > -4 && zf < ahead) { if (o.obj) o.obj.visible = false; return false; }
        return true;
      });
    }
  }
  removeSolid(solid) {
    for (const s of this.segs) {
      const i = s.solids.indexOf(solid);
      if (i >= 0) { s.solids.splice(i, 1); if (solid.obj) solid.obj.visible = false; return true; }
    }
    return false;
  }

  placeLow(seg, lane, z, yBase = 0) {
    const m = makeLow(); m.position.set(C.LANES[lane], yBase, z); seg.add(m);
    seg.addSolid({ kind: 'low', obj: m, x: C.LANES[lane], hw: 0.95, lz0: z - 0.35, lz1: z + 0.35, yMin: yBase, yMax: yBase + C.LOW_H, walkable: true, lethal: false });
  }
  placeOver(seg, lane, z) {
    const m = makeOver(); m.position.set(C.LANES[lane], 0, z); seg.add(m);
    seg.addSolid({ kind: 'over', obj: m, x: C.LANES[lane], hw: 0.95, lz0: z - 0.65, lz1: z + 0.65, yMin: C.OVERHEAD_BOTTOM, yMax: C.OVERHEAD_BOTTOM + C.OVERHEAD_H, walkable: false, lethal: false });
  }
  // Bounds straight from the rendered model, not from hand-written numbers: a longer car, a wider container or a
  // chunkier nose gets the hitbox it actually shows. Decorative roof gear is capped at the playable body height.
  modelBounds(obj, { maxHw = 1.2, maxY = C.TRAIN_H, inset = 0.035 } = {}) {
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj);
    const hw = Math.max(0.05, Math.min(maxHw, (b.max.x - b.min.x) / 2) - inset);
    return { x: (b.min.x + b.max.x) / 2, hw, lz0: b.min.z + inset, lz1: b.max.z - inset, yMin: Math.max(0, b.min.y + inset), yMax: Math.min(maxY, b.max.y) };
  }
  placeContainer(seg, lane, z, len) {
    const m = makeContainer(len, randInt(0, 1)); m.position.set(C.LANES[lane], 0, z);
    const b = this.modelBounds(m, { maxHw: C.TRAIN_W / 2 }); // before adding to the segment: bounds are segment-local
    b.lz1 = Math.min(b.lz1, z); // a container starts exactly at its model origin; no invisible front lip
    seg.add(m);
    m.children.forEach((c) => seg.own.push(c.geometry));
    seg.addSolid({ kind: 'container', obj: m, ...b, walkable: C.ROOF_LAND, solidTop: !C.ROOF_LAND, lethal: true });
  }
  placeTrain(seg, lane, z, carriages, ramp, biome, vz = 0) {
    if (this.staticTrains) vz = 0;
    const TRIGGER = 50;
    const x = C.LANES[lane];
    let zt = z;
    ramp = ramp && C.ROOF_RUN;
    if (ramp) {
      const r = makeRamp(); r.position.set(x, 0, z); seg.add(r);
      seg.addSolid({ kind: 'ramp', obj: r, ramp: true, x, hw: 0.95, lz0: z - C.RAMP_LEN, lz1: z, yMin: 0, yMax: C.TRAIN_H, walkable: true, lethal: false });
      zt = z - C.RAMP_LEN;
    }
    const t = buildTrain(biome, carriages);
    t.position.set(x, 0, zt);
    const len = carriages * C.CARRIAGE_LEN + (carriages - 1) * C.CARRIAGE_GAP;
    const bounds = this.modelBounds(t, { maxHw: C.TRAIN_W / 2 }); // before seg.add and the headlight: segment-local, playable height
    bounds.lz1 = Math.min(bounds.lz1, zt); // square front: no decorative lip becomes an invisible wall
    seg.add(t);
    let headlight = null;
    if (vz) {
      headlight = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), basicMat('#fff2b0', { map: A.glowTex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
      headlight.position.set(0, 1.9, 0.4); headlight.frustumCulled = false; fxLayer(headlight); t.add(headlight);
      seg.own.push(headlight.geometry);
    }
    seg.addSolid({ kind: 'train', obj: t, baseZ: zt, off: 0, vz, trigger: vz ? TRIGGER : 0, headlight, started: false, steam: !!t.userData.steam, ...bounds, walkable: C.ROOF_LAND, solidTop: !C.ROOF_LAND, lethal: true });
    // no roof coin line: the roof is a landing pad, not a second lane to farm
    return { zt, len };
  }

  place(seg, ev, z, d, biome, vz = 0) {
    const lanes = [0, 1, 2];
    const shuffled = () => lanes.slice().sort(() => R.f() - 0.5);
    switch (ev) {
      case 'coins': {
        const n = randInt(8, 15), lane = pick(lanes);
        if (chance(0.3)) {
          const l2 = clamp(lane + (chance(0.5) ? 1 : -1), 0, 2);
          for (let i = 0; i < n; i++) this.addCoin(C.LANES[Math.floor(i / 4) % 2 ? l2 : lane], 1.0, z - i * 1.8);
        } else { this.coinLine(C.LANES[lane], 1.0, z, n, 1.8, true); this.maybeItem(C.LANES[lane], 1.4, z - n * 0.9, 0.2); }
        return n * 1.8;
      }
      case 'rest': {
        const lane = pick(lanes), n = randInt(16, 24);
        this.coinLine(C.LANES[lane], 1.0, z, n, 1.8, true);
        if (chance(0.65)) this.addCoin(C.LANES[lane], 1.0, z - n * 1.8 - 1.2, 5); // gem worth 5
        this.maybeItem(C.LANES[lane], 1.4, z - n * 0.9, 0.3);
        return n * 1.8;
      }
      case 'low': {
        let count = 1;
        if (chance(0.25 + d * 0.5)) count = 2;
        if (d > 0.4 && chance(0.18)) count = 3;
        const set = shuffled().slice(0, count);
        for (const l of set) this.placeLow(seg, l, z);
        this.coinArc(C.LANES[set[0]], z + 4, 8, 1.0, 1.0, 1.3);
        return 4;
      }
      case 'over': {
        let count = 1;
        if (chance(0.25 + d * 0.4)) count = 2;
        if (d > 0.5 && chance(0.15)) count = 3;
        const set = shuffled().slice(0, count);
        for (const l of set) this.placeOver(seg, l, z);
        this.coinLine(C.LANES[set[0]], 0.6, z + 3, 6, 1.0);
        return 4;
      }
      case 'mixed': {
        const kinds = ['none', 'low', 'over', 'low', 'over', 'container', 'none'];
        let ks = lanes.map(() => pick(kinds));
        if (ks.every((k) => k === 'container' || k === 'none') && ks.includes('container')) ks[randInt(0, 2)] = pick(['low', 'over']);
        if (ks.filter((k) => k === 'container').length > 1) { let seen = false; ks = ks.map((k) => { if (k === 'container') { if (seen) return 'low'; seen = true; } return k; }); }
        let span = 4;
        ks.forEach((k, l) => {
          if (k === 'low') this.placeLow(seg, l, z); else if (k === 'over') this.placeOver(seg, l, z);
          else if (k === 'container') { const len = randInt(5, 7); this.placeContainer(seg, l, z, len); span = Math.max(span, len); }
        });
        const free = ks.findIndex((k) => k === 'none');
        if (free >= 0) this.coinLine(C.LANES[free], 1.0, z + 3, 7);
        return span;
      }
      case 'container': {
        const len = randInt(5, 8), nl = chance(0.3 + d * 0.3) ? 2 : 1;
        const set = shuffled().slice(0, nl);
        for (const l of set) this.placeContainer(seg, l, z, len);
        const free = lanes.filter((l) => !set.includes(l)), fl = pick(free);
        this.coinLine(C.LANES[fl], 1.0, z + 2, Math.floor(len * 1.2), 1.4);
        if (free.length > 1 && chance(0.5)) this.placeLow(seg, free.find((l) => l !== fl), z - len * 0.5);
        return len + 1;
      }
      case 'moving': {
        const lane = pick(lanes);
        const fit = this.fitCars(z);
        const cars = clamp(randInt(1 + (d > 0.2 ? 1 : 0), 2 + Math.floor(d * 2.6 + (this.hard || 0))), 1, fit); // oncoming trains get longer as the run goes on
        const r = this.placeTrain(seg, lane, z, cars, false, biome, vz || 12);
        const free = lanes.filter((l) => l !== lane);
        this.coinLine(C.LANES[pick(free)], 1.0, z + 2, 8, 1.6);
        return z - (r.zt - r.len);
      }
      case 'corridor': return this.placeCorridor(seg, z, d, biome);
      case 'train': {
        const nl = d > 0.25 && chance(0.35 + d * 0.3) ? 2 : 1;
        const set = shuffled().slice(0, nl);
        const carriages = clamp(randInt(1 + (d > 0.25 ? 1 : 0), 2 + Math.floor(d * 2.6)), 1, this.fitCars(z));
        let span = 0, rampLane = -1;
        for (const l of set) {
          const ramp = C.ROOF_RUN && rampLane < 0 && chance(0.6);
          const k = nl === 2 && chance(0.5) ? Math.max(1, carriages - 1) : carriages;
          const r = this.placeTrain(seg, l, z, k, ramp, biome);
          span = Math.max(span, z - (r.zt - r.len));
          if (ramp) {
            rampLane = l;
            this.coinLine(C.LANES[l], C.TRAIN_H + 0.95, r.zt - 0.8, Math.floor(r.len / 1.7), 1.7);
            if (chance(0.35)) this.maybeItem(C.LANES[l], C.TRAIN_H + 1.1, r.zt - r.len * 0.6, 0.6);
            if (d > 0.5 && chance(0.4) && r.len > 14) this.placeLow(seg, l, r.zt - r.len * 0.65, C.TRAIN_H);
          }
        }
        const free = lanes.filter((l) => !set.includes(l));
        if (free.length) {
          const fl = pick(free);
          let zz = z - 4, any = false;
          while (zz > z - span + 3 && chance(0.55 + d * 0.3)) {
            if (chance(0.5)) this.placeLow(seg, fl, zz); else this.placeOver(seg, fl, zz);
            any = true; zz -= rand(9, 13);
          }
          if (!any) this.coinLine(C.LANES[fl], 1.0, z - 2, Math.floor(span / 1.8));
        }
        return span;
      }
    }
    return 6;
  }
}
