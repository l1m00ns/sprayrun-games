import * as THREE from 'three';
import { applyBend } from './bend.js';
import { makeSoftDot } from './textures.js';
import { fxLayer } from './materials.js';

const N = 900, RAIN = 260;
const CFG = {
  snow: { size: 0.17, fall: 2.3, wind: 0.6, count: 800, cols: ['#ffffff', '#e8f2ff'], blend: THREE.NormalBlending },
  petals: { size: 0.22, fall: 0.9, wind: 1.6, count: 160, cols: ['#ff8ac0', '#ffd23f', '#ffffff', '#ff9a4a'], blend: THREE.NormalBlending },
  dust: { size: 0.65, fall: 0.15, wind: 7.0, count: 260, cols: ['#e9c08a', '#d8a870'], blend: THREE.NormalBlending, opacity: 0.35 },
};

// Weather lives in a box around the camera: particles are recycled when they leave it.
// The world scrolls toward the camera, so everything also drifts at the run speed.
export class Weather {
  constructor(scene) {
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.ph = new Float32Array(N);
    for (let i = 0; i < N; i++) this.respawn(i, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.2, map: makeSoftDot(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    applyBend(this.mat);
    this.points = fxLayer(new THREE.Points(g, this.mat));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = g;

    // rain streaks
    this.rainMat = applyBend(new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.rain = fxLayer(new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 1.6, 0.022), this.rainMat, RAIN));
    this.rain.frustumCulled = false;
    this.rd = [];
    for (let i = 0; i < RAIN; i++) this.rd.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 16, z: -Math.random() * 70 + 8, v: 18 + Math.random() * 8 });
    this.dummy = new THREE.Object3D();
    scene.add(this.rain);

    this.type = 'none';
    this.want = 'none';
    this.level = 0;
  }

  respawn(i, any = false) {
    this.pos[i * 3] = (Math.random() - 0.5) * 34;
    this.pos[i * 3 + 1] = Math.random() * 15;
    this.pos[i * 3 + 2] = any ? 8 - Math.random() * 80 : -72;
    this.ph[i] = Math.random() * 6.28;
  }

  set(type) { this.want = type; }

  applyType(type) {
    this.type = type;
    const c = CFG[type];
    if (c) {
      this.mat.size = c.size; this.mat.blending = c.blend; this.mat.opacity = c.opacity ?? 0.95; this.mat.needsUpdate = true;
      const tmp = new THREE.Color();
      for (let i = 0; i < N; i++) { tmp.set(c.cols[i % c.cols.length]); this.col[i * 3] = tmp.r; this.col[i * 3 + 1] = tmp.g; this.col[i * 3 + 2] = tmp.b; }
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  update(dt, speed, camera, night) {
    // cross-fade between types
    const target = this.want === this.type ? 1 : 0;
    this.level += Math.sign(target - this.level) * Math.min(Math.abs(target - this.level), dt * 0.8);
    if (this.want !== this.type && this.level <= 0.001) { this.applyType(this.want); }
    const c = CFG[this.type];
    const lvl = this.type === 'none' || this.type === 'rain' ? 0 : this.level;
    const count = c ? Math.floor(Math.min(N, c.count) * lvl * (this.budget ?? 1)) : 0;
    this.geo.setDrawRange(0, count);
    if (c && count > 0) {
      const t = performance.now() * 0.001;
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        this.pos[k] += (Math.sin(t * 0.7 + this.ph[i]) * 0.5 + c.wind) * dt * (this.type === 'dust' ? 1 : 0.4) * (this.type === 'dust' ? 1 : (i % 2 ? 1 : -1));
        this.pos[k + 1] -= c.fall * dt * (0.7 + (i % 5) * 0.12);
        this.pos[k + 2] += speed * dt;
        if (this.pos[k + 1] < 0 || this.pos[k + 2] > 10 || Math.abs(this.pos[k]) > 18) this.respawn(i);
      }
      this.geo.attributes.position.needsUpdate = true;
    }
    // rain
    const rainOn = this.type === 'rain' ? this.level : 0;
    this.rainMat.opacity = 0.32 * rainOn;
    this.rain.visible = rainOn > 0.01;
    if (this.rain.visible) {
      const d = this.dummy, nRain = Math.floor(RAIN * (this.budget ?? 1));
      this.rain.count = nRain;
      for (let i = 0; i < nRain; i++) {
        const r = this.rd[i];
        r.y -= r.v * dt; r.z += speed * dt * 0.9;
        if (r.y < 0 || r.z > 10) { r.y = 14 + Math.random() * 4; r.z = -70 * Math.random() - 4; r.x = (Math.random() - 0.5) * 30; }
        d.position.set(r.x, r.y, r.z);
        d.rotation.set(0.1, 0, 0.08);
        d.updateMatrix();
        this.rain.setMatrixAt(i, d.matrix);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }
    void camera; void night;
  }
}
