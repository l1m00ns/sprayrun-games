// Optional practice rival: a translucent "bot ghost" that runs the same track at a human pace, changes lane to
// avoid walls and never collides, scores or counts as a player. Off by default (Settings > Gameplay > Practice ghost).
import * as THREE from 'three';
import * as C from './consts.js';
import { buildCharacter, poseCharacter, CHAR_SCALE } from './characters.js';
import { dressed } from './cosmetics.js';

function makeTag(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '30px "Lilita One", sans-serif';
  x.textAlign = 'center';
  x.lineWidth = 8; x.strokeStyle = 'rgba(10,16,48,.9)'; x.strokeText(text, 128, 44);
  x.fillStyle = '#c9a7ff'; x.fillText(text, 128, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  m.frustumCulled = false; m.renderOrder = 5;
  return m;
}

export class Rival {
  constructor(scene, def) {
    this.scene = scene;
    this.ch = buildCharacter(dressed(def, {}), CHAR_SCALE, { ghost: true });
    this.ch.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.tag = makeTag('BOT GHOST');
    scene.add(this.ch.root, this.tag);
    this.d = 24; this.lane = 1; this.x = C.LANES[1]; this.t = 0; this.speed = 26;
  }
  blocked(world, lane, z) {
    const lx = C.LANES[lane];
    for (const seg of world.segs) {
      for (const s of seg.solids) {
        if (s.kind === 'low' || s.kind === 'over' || s.kind === 'ramp') continue;
        if (Math.abs(lx - s.x) > s.hw + 0.8) continue;
        const z0 = seg.z + s.lz0 + (s.off || 0), z1 = seg.z + s.lz1 + (s.off || 0);
        if (z1 < z - 13 || z0 > z - 2) continue; // the wall is ahead of the ghost, not behind it
        return true;
      }
    }
    return false;
  }
  update(dt, run, world, speed, camera) {
    this.t += dt;
    const pace = 0.97 + Math.sin(this.t * 0.55) * 0.035;
    this.speed = Math.max(8, speed * pace);
    this.d += this.speed * dt;
    let z = -(this.d - run.dist);
    if (z < -140) { this.d = run.dist + 100; z = -100; } // never out of sight for long
    if (z > 18) { this.d = run.dist - 4; z = 4; } // and never lost behind the camera
    if (this.blocked(world, this.lane, z)) {
      const opts = [this.lane - 1, this.lane + 1, 1].filter((l) => l >= 0 && l <= 2 && l !== this.lane && !this.blocked(world, l, z));
      if (opts.length) this.lane = opts[0];
    }
    this.x += (C.LANES[this.lane] - this.x) * Math.min(1, dt * 14);
    const vis = z > -145 && z < 16;
    this.ch.root.visible = vis; this.tag.visible = vis;
    if (!vis) return;
    this.ch.root.position.set(this.x, 0, z);
    poseCharacter(this.ch, { state: 'run', speed: this.speed, vy: 0, vx: 0, rollP: (this.t * 1.6) % 1, crashT: 0 }, dt);
    this.tag.position.set(this.x, 2.55, z);
    if (camera) this.tag.quaternion.copy(camera.quaternion);
  }
  dispose() {
    this.scene.remove(this.ch.root, this.tag);
    if (this.tag.material.map) this.tag.material.map.dispose();
    this.tag.material.dispose(); this.tag.geometry.dispose();
  }
}
