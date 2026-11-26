import * as THREE from 'three';
import * as C from './consts.js';
import { mat, vcMat, texMat, basicMat } from './materials.js';
import * as P from './props.js';
import * as BT from './biomeTex.js';
import { mk, toTex } from './textures.js';
import { rand, randInt, pick, chance } from './util.js';

const L = C.SEG_LEN;

// ------------------------------------------------------------- definitions
const T3 = (a, b, c) => [a, b, c];
export const BIOMES = {
  city: {
    id: 'city', name: 'Rail Yard', desc: 'Graffiti walls, glass towers and a busy skyline.', weather: 'none', accent: '#ffd23f',
    fog: [70, 250], themes: C.THEMES, gantry: true, lamps: true,
  },
  snow: {
    id: 'snow', name: 'Frostline', desc: 'Snowy peaks, pine forests, cabins and northern lights.', weather: 'snow', accent: '#9ad7ff',
    fog: [45, 200], gantry: true, lamps: true,
    themes: T3(
      { top: 0x6fa8e8, horizon: 0xe8f2fc, fog: 0xdbe8f5, sun: 0xfff6e0, sunI: 2.4, hemiSky: 0xcfe3fa, hemiGround: 0xaab8c8, hemiI: 1.4, night: 0, aurora: 0, sunDir: [-0.45, 0.8, 0.4] },
      { top: 0x56478f, horizon: 0xffb6a0, fog: 0xe9b9b0, sun: 0xffc090, sunI: 2.0, hemiSky: 0xffd6c8, hemiGround: 0x7a7490, hemiI: 1.1, night: 0.35, aurora: 0.2, sunDir: [-0.7, 0.35, 0.3] },
      { top: 0x040a22, horizon: 0x1d3a6a, fog: 0x16284f, sun: 0xa8c4ff, sunI: 1.0, hemiSky: 0x5a78c0, hemiGround: 0x2a3050, hemiI: 0.95, night: 1, aurora: 1, sunDir: [-0.3, 0.9, 0.2] },
    ),
  },
  tropic: {
    id: 'tropic', name: 'Palm Bay', desc: 'Turquoise sea, beach huts, palms and tiki torches.', weather: 'petals', accent: '#29e0c0',
    fog: [80, 280], gantry: false, lamps: false,
    themes: T3(
      { top: 0x1fa3ff, horizon: 0xbdf3ff, fog: 0xbdeaf5, sun: 0xfff3c8, sunI: 2.8, hemiSky: 0xcff4ff, hemiGround: 0x9a8a5a, hemiI: 1.3, night: 0, aurora: 0, sunDir: [-0.4, 0.85, 0.35] },
      { top: 0x7a2f8f, horizon: 0xff8a5a, fog: 0xf79a74, sun: 0xffa060, sunI: 2.2, hemiSky: 0xffc08a, hemiGround: 0x6a4a50, hemiI: 1.0, night: 0.4, aurora: 0, sunDir: [-0.7, 0.3, 0.3] },
      { top: 0x0a0828, horizon: 0x3a2a78, fog: 0x251a5a, sun: 0xb8a8ff, sunI: 1.0, hemiSky: 0x6a5ab8, hemiGround: 0x2a2040, hemiI: 0.85, night: 1, aurora: 0, sunDir: [-0.3, 0.9, 0.2] },
    ),
  },
  desert: {
    id: 'desert', name: 'Dune Express', desc: 'Red mesas, cacti and a scorching sun.', weather: 'dust', accent: '#ff9a4a',
    fog: [70, 260], gantry: false, lamps: true,
    themes: T3(
      { top: 0x3f8fe0, horizon: 0xffe2b0, fog: 0xf2d3a2, sun: 0xfff0c8, sunI: 3.0, hemiSky: 0xffe6c0, hemiGround: 0xa86a3a, hemiI: 1.25, night: 0, aurora: 0, sunDir: [-0.4, 0.85, 0.4] },
      { top: 0x6a2a5a, horizon: 0xff7a3a, fog: 0xe8793f, sun: 0xff9a50, sunI: 2.4, hemiSky: 0xffb070, hemiGround: 0x6a3a2a, hemiI: 1.0, night: 0.35, aurora: 0, sunDir: [-0.7, 0.3, 0.3] },
      { top: 0x050a2a, horizon: 0x2a3a78, fog: 0x1c2656, sun: 0xc8d4ff, sunI: 1.2, hemiSky: 0x5a6ab8, hemiGround: 0x3a2a30, hemiI: 0.85, night: 1, aurora: 0, sunDir: [-0.3, 0.9, 0.2] },
    ),
  },
  neon: {
    id: 'neon', name: 'Neon District', desc: 'Rain-soaked cyber city that never sleeps.', weather: 'rain', accent: '#ff3dd0',
    fog: [35, 190], gantry: true, lamps: false, neon: true,
    themes: T3(
      { top: 0x1a0a4a, horizon: 0xff3dd0, fog: 0x3a1a6a, sun: 0xff8af0, sunI: 1.3, hemiSky: 0x8a6aff, hemiGround: 0x201040, hemiI: 1.0, night: 0.85, aurora: 0, sunDir: [-0.4, 0.5, 0.3] },
      { top: 0x050a30, horizon: 0x2bdcff, fog: 0x0f2a5a, sun: 0x8ad8ff, sunI: 1.2, hemiSky: 0x5a8aff, hemiGround: 0x101a40, hemiI: 0.95, night: 1, aurora: 0, sunDir: [-0.3, 0.7, 0.2] },
      { top: 0x0a0420, horizon: 0x9b2bff, fog: 0x2a0f58, sun: 0xd08aff, sunI: 1.2, hemiSky: 0x8a5aff, hemiGround: 0x180a38, hemiI: 0.95, night: 1, aurora: 0, sunDir: [-0.3, 0.8, 0.2] },
    ),
  },
};
export const BIOME_ORDER = ['city', 'snow', 'tropic', 'desert', 'neon'];
export const TOUR_SEGS = 17; // ~1100 m per biome in World Tour

// ------------------------------------------------------------------ assets
export function initBiomes(A) {
  A.bio = {};
  for (const id of BIOME_ORDER) {
    const g = BT.makeGround(id);
    g.repeat.set(1, 6);
    A.bio[id] = {
      groundMat: texMat(g, {}),
      walls: [1, 2, 3, 4].map((i) => texMat(BT.makeWall(id, i), {})),
    };
  }
  A.vc = vcMat();
  A.vcRim = vcMat({ rim: true });
  A.glowMat = mat('#ffd98a', { emissive: 0xffcf70, ei: 1.0 });
  A.tikiGlowMat = mat('#ffb347', { emissive: 0xff9a2a, ei: 1.2 });
  A.glowMats = [A.glowMat, A.tikiGlowMat];

  A.props = {
    pine: P.pine(false), pineSnow: P.pine(true), palm: P.palm(), cactus: P.cactus(),
    rockGrey: P.rock('#8a8f99'), rockSnow: P.rock('#7d8a99', true), rockSand: P.rock('#b98a58'), rockRed: P.rock('#a4553a'),
    mesa: P.mesa(), mountain: P.mountain(), cabin: P.cabin(), cabinGlow: P.cabinGlow(), hut: P.hut(),
    tiki: P.tiki(), tikiFlame: P.tikiFlame(), umbrella: P.umbrella(), snowman: P.snowman(), surfboard: P.surfboard(),
    windmill: P.windmill(), pipe: P.pipe(),
    waterTower: P.waterTower(), crane: P.crane(), radioTower: P.radioTower(), beacon: P.beacon(), billboardPost: P.billboardPost(), billboardGlow: P.billboardGlow(),
    igloo: P.igloo(), iceCrystal: P.iceCrystal(), lifeguard: P.lifeguard(), buoy: P.buoy(), oilTank: P.oilTank(), adobe: P.adobe(),
    pier: P.pier(), tikiBar: P.tikiBar(), volleyNet: P.volleyNet(), towel: P.towel(), sandcastle: P.sandcastle(), canoe: P.canoe(), hibiscus: P.hibiscus(), coconuts: P.coconuts(),
  };
  A.beaconMat = mat('#ff3030', { emissive: 0xff2020, ei: 1.4 });
  A.signMats = ['#ff3dd0', '#2bdcff', '#ffd23f'].map((c) => mat(c, { emissive: new THREE.Color(c), ei: 1.3 }));
  A.umbrellaMat = mat('#ffffff', { vc: true, side: THREE.DoubleSide });

  // water
  const [c, ctx] = mk(256, 256);
  ctx.fillStyle = '#1fc8d8'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(10,120,160,0.35)'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, i * 16 + 8 + Math.sin(x * 0.07 + i) * 4);
    ctx.stroke();
  }
  A.waterTex = toTex(c, { repeat: true });
  A.waterTex.repeat.set(12, 6);
  A.waterMat = texMat(A.waterTex, { emissive: 0x0a5a6a, ei: 0.25 });
  const [wc, wctx] = mk(256, 256); // sun glitter: soft bright specks that drift against the main waves
  for (let i = 0; i < 260; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 1 + Math.random() * 2.6; const g = wctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); wctx.fillStyle = g; wctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); }
  A.glitterTex = toTex(wc, { repeat: true }); A.glitterTex.repeat.set(9, 5);
  A.glitterMat = basicMat('#ffffff', { map: A.glitterTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const [fc, fctx] = mk(64, 256); // foam: a wavy white band fading out towards the sea
  const fg = fctx.createLinearGradient(0, 0, 64, 0); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.55, 'rgba(255,255,255,0.95)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
  fctx.fillStyle = fg; for (let y = 0; y < 256; y += 4) { const w = 18 + Math.sin(y * 0.09) * 7 + Math.sin(y * 0.23) * 4; fctx.fillRect(32 - w, y, w * 2, 4); }
  fctx.globalCompositeOperation = 'destination-in'; fctx.fillStyle = fg; fctx.fillRect(0, 0, 64, 256);
  A.foamTex = toTex(fc, {});
  A.foamMat = basicMat('#ffffff', { map: A.foamTex, transparent: true, opacity: 0.8, depthWrite: false });

  // neon
  A.neonFacades = [1, 2, 3, 4, 5, 6].map((s) => {
    const f = BT.makeNeonFacade(s);
    return { mat: texMat(f.map, { emissive: 0xffffff, emissiveMap: f.emissive, ei: 1.1 }), tileW: f.cols * 2.5, tileH: f.rows * 3.3 };
  });
  const signs = [['RAMEN', '#ff3dd0'], ['ARCADE', '#2bdcff'], ['HOTEL', '#ffd23f'], ['BAR', '#7dff6b'], ['DISCO', '#a98bff'], ['NOODLE', '#ff8a3d']];
  A.neonSigns = signs.map(([t, col]) => texMat(BT.makeNeonSign(t, col), { emissive: 0xffffff, emissiveMap: BT.makeNeonSign(t, col), ei: 1.0 }));
  A.neonTubeMats = ['#ff3dd0', '#2bdcff', '#ffd23f', '#7dff6b'].map((c2) => mat(c2, { emissive: new THREE.Color(c2), ei: 1.6 }));
  A.neonGeo = new THREE.BoxGeometry(0.16, 0.16, L, 1, 1, 24).translate(0, 0, -L / 2);
}

// ----------------------------------------------------------------- terrain
function sstep(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
export function terrainY(id, x, zg) {
  const ax = Math.abs(x);
  const n = Math.sin(zg * 0.021 + x * 0.04) * 0.5 + Math.sin(zg * 0.043 - x * 0.025 + 1.7) * 0.35 + Math.sin(zg * 0.0071 + x * 0.011) * 0.6;
  const edge = sstep(12, 46, ax);
  switch (id) {
    case 'snow': return -0.45 + edge * (n + 0.9) * 5.5 + sstep(10, 20, ax) * 0.5;
    case 'desert': return -0.45 + edge * (n + 1.0) * 3.0 + sstep(9, 18, ax) * Math.sin(zg * 0.09 + x * 0.1) * 0.5;
    case 'tropic':
      if (x < 0) return -0.45 - sstep(10, 22, ax) * 2.2 + (ax > 24 ? 0 : 0);
      return -0.45 + edge * (n + 0.9) * 4.0 + sstep(9, 14, ax) * 0.3;
    default: return -0.45;
  }
}
function terrainColor(id, x, y, zg, out) {
  const n = (Math.sin(zg * 0.31 + x * 0.2) + Math.sin(zg * 0.13 - x * 0.37)) * 0.5;
  if (id === 'snow') out.set(y > 2.5 ? '#ffffff' : '#eaf1f8').lerp(new THREE.Color('#c4d3e6'), Math.max(0, n * 0.4));
  else if (id === 'desert') out.set('#dca468').lerp(new THREE.Color('#bf7f46'), 0.5 + n * 0.5 * 0.7);
  else if (id === 'tropic') {
    if (x < 0) out.set(y < -1.5 ? '#1fb8c8' : y < -0.9 ? '#7fe0d8' : '#f2dfae');
    else out.set(Math.abs(x) < 13 ? '#f0dca8' : '#58b848').lerp(new THREE.Color('#3f9a3a'), Math.max(0, n * 0.5));
  } else out.set('#4c4b52');
  return out;
}
export function addTerrain(seg, id, index) {
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(76, L, 19, 24);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + 38) / 76; // 0..1
      const x = side * (5.6 + u * 76);
      const zl = pos.getZ(i) - L / 2; // local z in [-L, 0]
      const zg = index * L - zl;
      const y = terrainY(id, x, zg);
      pos.setXYZ(i, x, y, zl);
      terrainColor(id, x, y, zg, c);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.deleteAttribute('uv');
    const m = new THREE.Mesh(geo, vcMat());
    m.receiveShadow = true; m.frustumCulled = false;
    seg.own.push(geo);
    seg.add(m);
  }
}

// -------------------------------------------------------------- scattering
function instanced(seg, geo, material, items, opts = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, material, items.length);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  items.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z);
    d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    d.scale.set(it.sx ?? it.s ?? 1, it.sy ?? it.s ?? 1, it.sz ?? it.s ?? 1);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    if (opts.tint) { col.setHSL(opts.tint[0] + (Math.random() - 0.5) * 0.04, opts.tint[1], opts.tint[2] + (Math.random() - 0.5) * 0.18); m.setColorAt(i, col.set(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.35)); }
  });
  m.castShadow = !!opts.cast;
  m.frustumCulled = false;
  seg.add(m);
  return m;
}

let YARD = {};
export function setYard(y) { YARD = y || {}; }
function scatter(id, index, side, n, xMin, xMax, sMin, sMax, extra) {
  const out = [];
  const lo = YARD[side] ? Math.max(xMin, 15.2) : xMin, hi = Math.max(xMax, lo + 1);
  for (let i = 0; i < n; i++) {
    const x = side * rand(lo, hi);
    const zl = -rand(0, L);
    const zg = index * L - zl;
    const s = rand(sMin, sMax);
    out.push({ x, z: zl, y: terrainY(id, x, zg) - 0.05, s, ry: rand(0, Math.PI * 2), ...(extra ? extra() : {}) });
  }
  return out;
}

// ------------------------------------------------------------------ decor
export function decorSnow(seg, A, index) {
  addTerrain(seg, 'snow', index);
  for (const side of [-1, 1]) {
    instanced(seg, A.props.pine, A.vc, scatter('snow', index, side, 12, 6.8, 30, 0.9, 1.9), { tint: [0.4, 0, 0.5] });
    instanced(seg, A.props.pineSnow, A.vc, scatter('snow', index, side, 14, 6.8, 34, 0.9, 2.1));
    instanced(seg, A.props.rockSnow, A.vc, scatter('snow', index, side, 4, 6.6, 20, 0.7, 1.8));
    const cabins = scatter('snow', index, side, 1, 9, 15, 1.0, 1.25, () => ({ ry: side * Math.PI / 2 }));
    instanced(seg, A.props.cabin, A.vc, cabins);
    instanced(seg, A.props.cabinGlow, A.glowMat, cabins);
    for (const c of cabins) seg.smokers.push({ x: c.x, y: c.y + 4.6 * c.s, z: c.z });
    if (chance(0.6)) instanced(seg, A.props.snowman, A.vc, scatter('snow', index, side, 1, 6.6, 8, 0.9, 1.2, () => ({ ry: side * Math.PI / 2 })));
    if (chance(0.5)) instanced(seg, A.props.mountain, A.vc, scatter('snow', index, side, 1, 62, 100, 1.2, 2.3));
  }
}

export function decorTropic(seg, A, index) {
  addTerrain(seg, 'tropic', index);
  // --- sea: two layers of light moving against each other, a foam line that breathes in and out, sun glitter
  const water = new THREE.Mesh(new THREE.PlaneGeometry(110, L, 4, 24).rotateX(-Math.PI / 2).translate(-77, -1.35, -L / 2), A.waterMat);
  water.frustumCulled = false; seg.own.push(water.geometry); seg.add(water);
  const glitter = new THREE.Mesh(new THREE.PlaneGeometry(110, L, 1, 1).rotateX(-Math.PI / 2).translate(-77, -1.3, -L / 2), A.glitterMat);
  glitter.frustumCulled = false; seg.own.push(glitter.geometry); seg.add(glitter);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(3.4, L, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -L / 2), A.foamMat);
  foam.position.set(-15.2, -1.28, 0); foam.frustumCulled = false; seg.own.push(foam.geometry); seg.add(foam);
  const ph = index * 1.7;
  seg.anims.push((dt, t) => {
    A.waterTex.offset.set(t * 0.018, t * 0.03); A.glitterTex.offset.set(-t * 0.022, t * 0.011);
    foam.position.x = -15.4 + Math.sin(t * 0.9 + ph) * 0.7; A.foamMat.opacity = 0.55 + 0.3 * Math.sin(t * 0.9 + ph + 1.2);
  });
  // --- palms: dense on the land side, leaning ones on the beach, young ones near the water
  const lean = () => ({ rz: (Math.random() - 0.5) * 0.28, rx: (Math.random() - 0.5) * 0.2 });
  instanced(seg, A.props.palm, A.vc, scatter('tropic', index, 1, 20, 6.8, 34, 0.9, 1.6, lean), { tint: [0.3, 0, 0.5] });
  instanced(seg, A.props.palm, A.vc, scatter('tropic', index, -1, 7, 6.8, 13, 0.8, 1.4, lean));
  instanced(seg, A.props.hibiscus, A.vc, scatter('tropic', index, 1, 9, 6.6, 20, 0.8, 1.4));
  instanced(seg, A.props.coconuts, A.vc, scatter('tropic', index, -1, 3, 6.6, 12, 0.9, 1.2));
  instanced(seg, A.props.hut, A.vc, scatter('tropic', index, 1, 1, 9, 16, 1.0, 1.3, () => ({ ry: -Math.PI / 2 })));
  instanced(seg, A.props.umbrella, A.umbrellaMat, scatter('tropic', index, -1, 4, 7, 12, 0.9, 1.2));
  instanced(seg, A.props.surfboard, A.vc, scatter('tropic', index, -1, 4, 6.8, 11, 0.9, 1.1, lean));
  instanced(seg, A.props.rockSand, A.vc, scatter('tropic', index, 1, 5, 6.8, 22, 0.6, 1.4));
  // --- beach life
  instanced(seg, A.props.towel, A.vc, scatter('tropic', index, -1, 3, 6.8, 12, 0.9, 1.1));
  if (chance(0.45)) instanced(seg, A.props.sandcastle, A.vc, scatter('tropic', index, -1, 1, 7, 11, 0.7, 1.1));
  if (chance(0.35)) instanced(seg, A.props.volleyNet, A.vc, scatter('tropic', index, -1, 1, 8, 12, 1.0, 1.1, () => ({ ry: Math.PI / 2 })));
  if (chance(0.4)) instanced(seg, A.props.lifeguard, A.vc, scatter('tropic', index, -1, 1, 9, 13, 1.0, 1.15, () => ({ ry: Math.PI / 2 })));
  if (chance(0.4)) instanced(seg, A.props.tikiBar, A.vc, scatter('tropic', index, 1, 1, 9, 14, 1.0, 1.2, () => ({ ry: -Math.PI / 2 })));
  if (chance(0.5)) instanced(seg, A.props.canoe, A.vc, scatter('tropic', index, -1, 1, 10, 13, 0.9, 1.2, () => ({ ry: Math.PI / 2 + (Math.random() - 0.5) * 0.4 })));
  // --- in the water: a pier, buoys bobbing, a lighthouse-style horizon
  if (chance(0.4)) { const z = -rand(14, L - 14), it = { x: -25, z, y: -0.55, s: 1, ry: 0 }; instanced(seg, A.props.pier, A.vc, [it]); }
  const buoys = [0, 1, 2].map(() => ({ x: -rand(20, 46), z: -rand(4, L - 4), y: -1.25, s: rand(0.9, 1.4) }));
  const buoyMesh = instanced(seg, A.props.buoy, A.vc, buoys);
  if (buoyMesh) {
    const d = new THREE.Object3D();
    seg.anims.push((dt, t) => { buoys.forEach((b2, i) => { d.position.set(b2.x, b2.y + Math.sin(t * 1.6 + i * 2 + ph) * 0.12, b2.z); d.rotation.set(Math.sin(t * 1.3 + i) * 0.1, 0, Math.cos(t * 1.1 + i) * 0.1); d.scale.setScalar(b2.s); d.updateMatrix(); buoyMesh.setMatrixAt(i, d.matrix); }); buoyMesh.instanceMatrix.needsUpdate = true; });
  }
  // --- tiki torches along both walls
  for (const side of [-1, 1]) {
    const items = [];
    for (let z = -6; z > -L; z -= 12) items.push({ x: side * 5.05, y: 2.0, z, s: 1 });
    instanced(seg, A.props.tiki, A.vc, items);
    instanced(seg, A.props.tikiFlame, A.tikiGlowMat, items);
  }
  if (chance(0.4)) instanced(seg, A.props.mountain, A.vc, scatter('tropic', index, 1, 1, 70, 110, 1.0, 1.8).map((i2) => ({ ...i2, s: i2.s })));
}

// Skyline landmarks, arctic and desert details (the tropic has its own set above)
export function decorExtras(seg, A, id, index) {
  const blink = () => seg.anims.push((dt, t) => { A.beaconMat.emissiveIntensity = Math.sin(t * 3.2) > 0.3 ? 1.6 : 0.15; });
  if (id === 'city' || id === 'neon') {
    for (const side of [-1, 1]) {
      if (chance(id === 'neon' ? 0.55 : 0.4)) {
        const cr = scatter(id, index, side, 1, 58, 92, 1.5, 2.2, () => ({ ry: rand(-0.4, 0.4) + (side > 0 ? Math.PI : 0), y: 0 }));
        instanced(seg, A.props.crane, A.vc, cr);
        instanced(seg, A.props.beacon, A.beaconMat, cr.map((c) => ({ x: c.x, y: 27.4 * c.s, z: c.z, s: c.s * 1.3 }))); blink();
      }
      if (chance(0.45)) {
        const rt = scatter(id, index, side, 1, 50, 90, 2.0, 3.0, () => ({ y: 0 }));
        instanced(seg, A.props.radioTower, A.vc, rt);
        instanced(seg, A.props.beacon, A.beaconMat, rt.map((c) => ({ x: c.x, y: 19.6 * c.s, z: c.z, s: c.s * 1.2 }))); blink();
      }
      if (chance(0.5)) instanced(seg, A.props.waterTower, A.vc, scatter(id, index, side, 1, 36, 62, 1.1, 1.7, () => ({ y: 0 })));
      if (id === 'neon' && chance(0.7)) {
        const bb = scatter(id, index, side, 1, 40, 70, 1.4, 2.0, () => ({ ry: side > 0 ? Math.PI * 0.62 : -Math.PI * 0.62, y: 0 }));
        instanced(seg, A.props.billboardPost, A.vc, bb);
        instanced(seg, A.props.billboardGlow, A.signMats[(index + (side > 0 ? 1 : 0)) % 3], bb);
      }
    }
  } else if (id === 'snow') {
    for (const side of [-1, 1]) {
      if (chance(0.45)) instanced(seg, A.props.igloo, A.vc, scatter('snow', index, side, 1, 10, 17, 0.9, 1.3, () => ({ ry: side * Math.PI / 2 })));
      instanced(seg, A.props.iceCrystal, A.vc, scatter('snow', index, side, 3, 8, 26, 0.8, 1.7));
    }
  } else if (id === 'desert') {
    for (const side of [-1, 1]) {
      if (chance(0.6)) instanced(seg, A.props.adobe, A.vc, scatter('desert', index, side, 1, 11, 20, 1.0, 1.4, () => ({ ry: side * Math.PI / 2 })));
      if (chance(0.4)) instanced(seg, A.props.oilTank, A.vc, scatter('desert', index, side, 1, 18, 42, 1.0, 1.6));
    }
  }
  // A landmark every few segments, far outside the walls: each map gets a silhouette you can name at a glance.
  if (index % 7 === 3) {
    const side = index % 14 === 3 ? -1 : 1;
    if (id === 'tropic') {
      instanced(seg, A.props.palm, A.vc, scatter('tropic', index, side, 2, 28, 40, 2.6, 3.4, () => ({ y: -1.2, rz: (Math.random() - 0.5) * 0.16 })));
      if (chance(0.55)) instanced(seg, A.props.pier, A.vc, [{ x: side * 33, y: -0.55, z: -rand(14, L - 14), s: 1.9, ry: side * Math.PI / 2 }]);
    } else if (id === 'snow') {
      instanced(seg, A.props.mountain, A.vc, scatter('snow', index, side, 1, 48, 80, 3.0, 4.2));
      instanced(seg, A.props.iceCrystal, A.vc, scatter('snow', index, side, 3, 20, 34, 1.8, 2.8));
    } else if (id === 'desert') {
      instanced(seg, A.props.mesa, A.vc, scatter('desert', index, side, 1, 40, 80, 2.6, 3.8));
    } else {
      const bb = scatter(id, index, side, 1, 32, 56, 2.4, 3.2, () => ({ ry: side > 0 ? Math.PI * 0.62 : -Math.PI * 0.62, y: 0 }));
      instanced(seg, A.props.billboardPost, A.vc, bb);
      instanced(seg, A.props.billboardGlow, id === 'neon' ? A.signMats[index % 3] : A.billboardMats[index % A.billboardMats.length], bb);
    }
  }
}

export function decorDesert(seg, A, index) {
  addTerrain(seg, 'desert', index);
  for (const side of [-1, 1]) {
    instanced(seg, A.props.cactus, A.vc, scatter('desert', index, side, 6, 7, 30, 0.8, 1.7), { tint: [0.33, 0, 0.5] });
    instanced(seg, A.props.rockRed, A.vc, scatter('desert', index, side, 7, 6.8, 36, 0.8, 2.4));
    instanced(seg, A.props.rockSand, A.vc, scatter('desert', index, side, 5, 6.8, 26, 0.7, 1.6));
    if (chance(0.7)) instanced(seg, A.props.mesa, A.vc, scatter('desert', index, side, 1 + (chance(0.5) ? 1 : 0), 34, 90, 1.0, 2.0));
  }
}

export function biomeById(id) { return BIOMES[id] || BIOMES.city; }
