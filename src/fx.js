import * as THREE from 'three';
import { applyBend } from './bend.js';
import * as T from './textures.js';
import { rand } from './util.js';
import { fxLayer } from './materials.js';

// Pooled point-sprite particle system with per-particle colour & life.
class Points {
  constructor(scene, max, size, blending, tex) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.n = 0;
    this.keep = 1; // particle budget: share of emissions that are actually spawned (graphics preset)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending, sizeAttenuation: true });
    applyBend(m);
    this.points = fxLayer(new THREE.Points(g, m));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = g;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b, grav = 0) {
    if (this.keep < 1 && Math.random() > this.keep) return;
    const i = this.n < this.max ? this.n++ : Math.floor(Math.random() * this.max);
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.base[k] = r; this.base[k + 1] = g; this.base[k + 2] = b;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav;
  }
  update(dt, scroll) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const k = i * 3, j = w * 3;
      const f = this.life[i] / this.maxLife[i];
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[j] = this.pos[k] + this.vel[k] * dt;
      this.pos[j + 1] = Math.max(0, this.pos[k + 1] + this.vel[k + 1] * dt);
      this.pos[j + 2] = this.pos[k + 2] + (this.vel[k + 2] + scroll) * dt;
      this.vel[j] = this.vel[k]; this.vel[j + 1] = this.vel[k + 1]; this.vel[j + 2] = this.vel[k + 2];
      this.base[j] = this.base[k]; this.base[j + 1] = this.base[k + 1]; this.base[j + 2] = this.base[k + 2];
      this.col[j] = this.base[j] * f; this.col[j + 1] = this.base[j + 1] * f; this.col[j + 2] = this.base[j + 2] * f;
      this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i]; this.grav[w] = this.grav[i];
      w++;
    }
    this.n = w;
    this.geo.setDrawRange(0, w);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

export class FX {
  setBudget(k) { for (const p of [this.sparks, this.dust, this.smoke]) p.keep = k; }
  constructor(scene) {
    const dot = T.makeSoftDot();
    this.sparks = new Points(scene, 400, 0.2, THREE.AdditiveBlending, dot);
    this.dust = new Points(scene, 300, 0.5, THREE.AdditiveBlending, dot);
    this.smoke = new Points(scene, 300, 0.9, THREE.AdditiveBlending, dot);
    // speed lines
    const N = 36;
    this.lineGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    this.lineMat = applyBend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
    this.lines = fxLayer(new THREE.InstancedMesh(this.lineGeo, this.lineMat, N));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.lineData = [];
    for (let i = 0; i < N; i++) this.lineData.push({ x: 0, y: 0, z: -rand(0, 60), len: rand(3, 9) });
    this.dummy = new THREE.Object3D();
    this.sx = 0;
  }

  coinBurst(x, y, z, gem = false) {
    const n = gem ? 16 : 9;
    for (let i = 0; i < n; i++) {
      this.sparks.emit(x, y, z, rand(-2.8, 2.8), rand(1.5, 5), rand(-1.5, 3), rand(0.3, 0.6), gem ? 0.4 : 1.0, gem ? 0.9 : 0.82, gem ? 1.0 : 0.25, 9);
    }
  }
  spray(x, y, z, hex) {
    const c = new THREE.Color(hex);
    for (let i = 0; i < 3; i++) this.sparks.emit(x, y, z, -rand(5, 8), rand(-0.7, 0.9), rand(-1.1, 1.1), rand(0.12, 0.24), c.r, c.g, c.b, 0);
  }
  sparkle(x, y, z) {
    this.sparks.emit(x + rand(-0.3, 0.3), y + rand(-0.3, 0.4), z, rand(-0.3, 0.3), rand(0.4, 1.2), rand(0, 1), rand(0.25, 0.5), 1.0, 0.95, 0.6, 0);
  }
  itemBurst(x, y, z, color) {
    const c = new THREE.Color(color);
    for (let i = 0; i < 26; i++) {
      this.sparks.emit(x, y, z, rand(-5, 5), rand(0, 6), rand(-4, 4), rand(0.4, 0.9), c.r, c.g, c.b, 6);
    }
  }
  landDust(x, z) {
    for (let i = 0; i < 9; i++) {
      this.dust.emit(x + rand(-0.3, 0.3), 0.1, z, rand(-1.8, 1.8), rand(0.3, 1.2), rand(-1, 3), rand(0.35, 0.7), 0.28, 0.27, 0.25, 1);
    }
  }
  runDust(x, z, speed) {
    this.dust.emit(x + rand(-0.15, 0.15), 0.08, z + 0.2, rand(-0.4, 0.4), rand(0.2, 0.7), rand(0, 1), rand(0.25, 0.45), 0.2, 0.19, 0.17, 0.5);
  }
  crashBurst(x, y, z) {
    for (let i = 0; i < 40; i++) {
      this.sparks.emit(x, y, z, rand(-7, 7), rand(1, 9), rand(-6, 4), rand(0.5, 1.2), 1, rand(0.3, 0.9), rand(0, 0.4), 14);
    }
    for (let i = 0; i < 14; i++) this.dust.emit(x, y * 0.5, z, rand(-3, 3), rand(0.5, 3), rand(-3, 3), rand(0.6, 1.2), 0.3, 0.29, 0.27, 0.5);
  }
  flame(x, y, z) {
    this.smoke.emit(x + rand(-0.08, 0.08), y, z + rand(-0.08, 0.08), rand(-0.5, 0.5), rand(-4, -2), rand(0, 1.5), rand(0.25, 0.45), 1.0, rand(0.45, 0.7), 0.1, 0);
  }
  boardTrail(x, y, z, hue) {
    const c = new THREE.Color().setHSL(hue, 1, 0.6);
    this.sparks.emit(x + rand(-0.25, 0.25), y, z + 0.6, rand(-0.3, 0.3), rand(-0.2, 0.6), rand(1, 3), rand(0.25, 0.55), c.r, c.g, c.b, 0);
  }
  magnetPulse(x, y, z) {
    this.sparks.emit(x + rand(-3, 3), y + rand(-1, 2), z - rand(1, 5), 0, 0, rand(5, 9), 0.3, 1, 0.3, 0.3, 0);
  }

  update(dt, speed, active, camera, boost) {
    this.sparks.update(dt, speed);
    this.dust.update(dt, speed);
    this.smoke.update(dt, speed);
    // speed lines: visible only at higher speeds
    const k = Math.max(0, Math.min(1, (speed - 22) / 14)) * (active ? 1 : 0) + (boost ? 0.6 : 0);
    this.lineMat.opacity = k * 0.35;
    const d = this.dummy;
    for (let i = 0; i < this.lineData.length; i++) {
      const l = this.lineData[i];
      l.z += (speed * 1.8) * dt;
      if (l.z - l.len > 12) {
        l.x = (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 4.4);
        l.y = rand(0.3, 3.2);
        l.z = -rand(30, 60); l.len = rand(3, 10);
      }
      d.position.set(l.x, l.y, l.z);
      d.scale.set(1, 1, l.len);
      d.updateMatrix();
      this.lines.setMatrixAt(i, d.matrix);
    }
    this.lines.instanceMatrix.needsUpdate = true;
  }

  clear() { this.sparks.clear(); this.dust.clear(); this.smoke.clear(); }
}
