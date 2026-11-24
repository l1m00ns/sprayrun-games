import * as THREE from 'three';
import { applyBend } from './bend.js';

// Cel-shading: a hard-stepped light ramp shared by every lit material.
let ramp = null;
export function toonRamp() {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([88, 150, 214, 255]), 4, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

const cache = new Map();

// Toon material cached by colour + options. `rim` adds a soft fresnel highlight (characters, trains).
export function mat(color, o = {}) {
  const key = `${color}|${o.emissive ?? ''}|${o.ei ?? 0}|${o.rim ? 1 : 0}|${o.vc ? 1 : 0}|${o.side ?? 0}`;
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonRamp(),
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.ei ?? 0,
    vertexColors: !!o.vc,
    side: o.side ?? THREE.FrontSide,
  });
  m.userData.rim = !!o.rim;
  applyBend(m);
  cache.set(key, m);
  return m;
}

// Vertex-coloured toon material (props merged from several coloured parts).
export function vcMat(o = {}) {
  return mat(0xffffff, { vc: true, rim: o.rim, emissive: o.emissive, ei: o.ei, side: o.side });
}

export function texMat(map, o = {}) {
  const m = new THREE.MeshToonMaterial({
    map,
    gradientMap: toonRamp(),
    emissive: o.emissive ?? 0x000000,
    emissiveMap: o.emissiveMap ?? null,
    emissiveIntensity: o.ei ?? 0,
    transparent: !!o.transparent,
    alphaTest: o.alphaTest ?? 0,
    side: o.side ?? THREE.FrontSide,
    color: o.color ?? 0xffffff,
  });
  m.userData.rim = !!o.rim;
  applyBend(m);
  return m;
}

export function basicMat(color, o = {}) {
  const m = new THREE.MeshBasicMaterial({
    color,
    map: o.map ?? null,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    blending: o.blending ?? THREE.NormalBlending,
    depthWrite: o.depthWrite ?? true,
    side: o.side ?? THREE.FrontSide,
    fog: o.fog ?? true,
  });
  applyBend(m);
  return m;
}

// Translucent version of a toon material, used for other players' ghosts.
export function ghostMat(color, opacity = 0.55) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), transparent: true, opacity, depthWrite: false });
  applyBend(m);
  return m;
}

// Objects on layer 1 are drawn normally but skipped by the outline/normal pass
// (sky, particles, glow sprites, alpha-tested fences...).
export function fxLayer(obj) {
  obj.traverse((o) => o.layers.set(1));
  return obj;
}

export function shadowify(obj, cast = true, receive = false) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
      o.frustumCulled = false;
    }
  });
  return obj;
}
