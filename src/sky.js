import * as THREE from 'three';
import * as T from './textures.js';
import * as BT from './biomeTex.js';
import { BIOMES, BIOME_ORDER } from './biomes.js';
import { fxLayer } from './materials.js';

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always at far plane
}`;
const skyFrag = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uNight;
uniform float uTime;
uniform float uAurora;
uniform float uFlash;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  col = mix(col, uHorizon, smoothstep(0.0, -0.3, d.y) * 0.8);
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(s, 600.0) * 3.0 + pow(s, 24.0) * 0.28 + pow(s, 6.0) * 0.1) * (1.0 - uNight * 0.55);
  if (uNight > 0.05 && d.y > 0.02) {
    vec2 g = floor(vec2(atan(d.x, d.z) * 90.0, d.y * 160.0));
    float r = hash(g);
    float star = step(0.9965, r) * (0.6 + 0.4 * sin(uTime * 2.0 + r * 60.0));
    col += vec3(star) * uNight * smoothstep(0.02, 0.35, d.y);
  }
  if (uAurora > 0.01 && d.y > 0.05) {
    float a = atan(d.x, d.z);
    float wave = sin(a * 5.0 + uTime * 0.25 + sin(a * 2.0 + uTime * 0.13) * 2.0) * 0.5 + 0.5;
    float band = smoothstep(0.1, 0.32, d.y) * (1.0 - smoothstep(0.38, 0.75, d.y)) * (0.35 + 0.65 * wave);
    float rays = 0.6 + 0.4 * sin(a * 40.0 + uTime * 0.6);
    vec3 ac = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.3, 0.62, d.y));
    col += ac * band * rays * uAurora * 0.75;
  }
  col += vec3(0.62, 0.7, 1.0) * uFlash * (0.5 + 0.5 * smoothstep(-0.1, 0.6, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.uniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(-0.45, 0.8, -0.4) }, uSunCol: { value: new THREE.Color() },
      uNight: { value: 0 }, uTime: { value: 0 }, uAurora: { value: 0 }, uFlash: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 20),
      new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false })
    );
    dome.frustumCulled = false; dome.renderOrder = -10;
    this.group.add(dome);

    this.rings = {};
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.ringFor('city'), transparent: true, depthWrite: false, fog: false, color: 0x8aa0c0, side: THREE.BackSide });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, 110, 48, 1, true), this.skyMat);
    ring.position.y = 40; ring.renderOrder = -9; ring.frustumCulled = false;
    this.ring = ring;
    this.group.add(ring);

    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshBasicMaterial({ map: T.makeCloudTexture(i + 3), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
      const c = new THREE.Mesh(new THREE.PlaneGeometry(220, 80), m);
      const a = (i / 9) * Math.PI * 2;
      c.position.set(Math.sin(a) * 380, 90 + Math.random() * 90, -Math.cos(a) * 380);
      c.lookAt(0, c.position.y, 0);
      c.renderOrder = -8; c.frustumCulled = false;
      c.userData.a = a; c.userData.r = 380;
      this.clouds.push(c);
      this.group.add(c);
    }
    fxLayer(this.group); // sky is never part of the outline pass
    this.tmp = new THREE.Color();
    this.cloudK = 1;
  }

  ringFor(id) {
    if (!this.rings[id]) { const t = BT.makeRing(id); t.repeat.set(3, 1); this.rings[id] = t; }
    return this.rings[id];
  }

  setBiome(id) {
    this.skyMat.map = this.ringFor(id);
    this.skyMat.needsUpdate = true;
    this.cloudK = id === 'neon' ? 0.15 : id === 'desert' ? 0.45 : 1;
  }

  setTheme(theme, time) {
    const u = this.uniforms;
    u.uTop.value.set(theme.top); u.uHorizon.value.set(theme.horizon); u.uSunCol.value.set(theme.sun);
    u.uNight.value = theme.night; u.uTime.value = time; u.uAurora.value = theme.aurora || 0;
    u.uSunDir.value.set(theme.sunDir[0], theme.sunDir[1], -theme.sunDir[2] * 1.2).normalize();
    this.skyMat.color.set(theme.horizon).lerp(this.tmp.set(theme.top), 0.35).multiplyScalar(0.55);
    for (const c of this.clouds) {
      c.material.color.set(theme.horizon).lerp(this.tmp.set(0xffffff), 0.55 * (1 - theme.night * 0.8));
      c.material.opacity = (0.9 - theme.night * 0.55) * this.cloudK;
    }
  }

  update(camera, dt) {
    this.group.position.copy(camera.position);
    this.ring.rotation.y += dt * 0.0006;
    for (const c of this.clouds) {
      c.userData.a += dt * 0.003;
      const a = c.userData.a;
      c.position.x = Math.sin(a) * c.userData.r;
      c.position.z = -Math.cos(a) * c.userData.r;
      c.lookAt(0, c.position.y, 0);
    }
  }
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const mixCol = (a, b, t) => { _c1.set(a); _c2.set(b); return _c1.lerp(_c2, t).getHex(); };
export function blendTheme(a, b, t) {
  return {
    top: mixCol(a.top, b.top, t), horizon: mixCol(a.horizon, b.horizon, t), fog: mixCol(a.fog, b.fog, t),
    sun: mixCol(a.sun, b.sun, t), sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiSky: mixCol(a.hemiSky, b.hemiSky, t), hemiGround: mixCol(a.hemiGround, b.hemiGround, t), hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
    night: a.night + (b.night - a.night) * t, aurora: (a.aurora || 0) + ((b.aurora || 0) - (a.aurora || 0)) * t,
    sunDir: a.sunDir.map((v, i) => v + (b.sunDir[i] - v) * t),
  };
}

// Time-of-day theme for a biome: day -> sunset -> night over distance, each phase 1400 m.
export function dayTheme(themes, dist, startPhase = 0) {
  const PH = 1400, BL = 350, n = themes.length;
  const p = dist / PH + startPhase;
  const i = Math.floor(p), f = p - i;
  const a = themes[i % n], b = themes[(i + 1) % n];
  const blendStart = 1 - BL / PH;
  if (f < blendStart) return a;
  const t = (f - blendStart) / (1 - blendStart);
  return blendTheme(a, b, t * t * (3 - 2 * t));
}

// Theme for the current moment: time of day inside biome A, cross-faded toward biome B by tb.
export function themeAt(dist, idA = 'city', idB = idA, tb = 0, startPhase = 0) {
  const a = dayTheme(BIOMES[idA].themes, dist, startPhase);
  if (idA === idB || tb <= 0) return a;
  return blendTheme(a, dayTheme(BIOMES[idB].themes, dist, startPhase), tb);
}
export { BIOME_ORDER };
