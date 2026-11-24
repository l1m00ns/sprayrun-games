import * as THREE from 'three';
import { applyBend } from './bend.js';
import { fxLayer } from './materials.js';

// Flocks of birds crossing the sky: one InstancedMesh, wings flap by scaling a flat "V".
const PROFILE = {
  city: { n: 18, color: 0x2b2f3a, size: 1.0, y: [14, 40], speed: 7 },
  snow: { n: 12, color: 0x3a3f4d, size: 1.3, y: [16, 42], speed: 6 },
  tropic: { n: 24, color: 0xffffff, size: 1.1, y: [12, 36], speed: 8 },
  desert: { n: 10, color: 0x2a2018, size: 1.9, y: [22, 52], speed: 5 },
  neon: { n: 0, color: 0xffffff, size: 1, y: [20, 40], speed: 6 },
};
const MAX = 26;

export class Birds {
  constructor(scene) {
    const g = new THREE.BufferGeometry();
    // flat V seen from above: body + two wings (raised by the flap scale on Y)
    const v = new Float32Array([
      0, 0, 0.5, -1.1, 0.3, -0.2, -0.45, 0, -0.5,
      0, 0, 0.5, 1.1, 0.3, -0.2, 0.45, 0, -0.5,
      -0.12, 0, 0.5, 0.12, 0, 0.5, 0, 0, -0.55,
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    this.mat = applyBend(new THREE.MeshBasicMaterial({ color: 0x2b2f3a, side: THREE.DoubleSide, fog: true }));
    this.mesh = fxLayer(new THREE.InstancedMesh(g, this.mat, MAX));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.birds = [];
    this.dummy = new THREE.Object3D();
    this.cfg = PROFILE.city;
    this.setBiome('city');
  }
  setBiome(id) {
    this.cfg = PROFILE[id] || PROFILE.city;
    this.mat.color.set(this.cfg.color);
    this.birds = [];
    for (let i = 0; i < this.cfg.n; i++) this.birds.push(this.spawn(true));
    this.mesh.count = this.cfg.n;
  }
  spawn(any) {
    const c = this.cfg;
    return { x: (Math.random() - 0.5) * 120, y: c.y[0] + Math.random() * (c.y[1] - c.y[0]), z: any ? 10 - Math.random() * 180 : -170, vx: (Math.random() - 0.5) * 6, ph: Math.random() * 6.3, sc: c.size * (0.8 + Math.random() * 0.5) };
  }
  update(dt, speed, t) {
    const c = this.cfg, d = this.dummy;
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.z += (speed - c.speed) * dt; // the world scrolls toward us; the bird flies away from us
      b.x += b.vx * dt;
      if (b.z > 14 || Math.abs(b.x) > 70) Object.assign(b, this.spawn(false));
      d.position.set(b.x, b.y + Math.sin(t * 0.8 + b.ph) * 1.2, b.z);
      d.rotation.set(0, Math.atan2(-b.vx, c.speed), Math.sin(t * 0.7 + b.ph) * 0.12);
      d.scale.set(b.sc, b.sc * (0.2 + Math.abs(Math.sin(t * 7 + b.ph)) * 1.1), b.sc);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
