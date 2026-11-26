// Gold Rush Duel client: the walled arena, the first-person Gold Eagle, the opponent (bot or a real player) and the HUD.
// Movement + hit-scan rules come from arena.js (identical on the server). In online duels the server decides every hit.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { A, COVER, SPAWNS, newBody, step, hitscan, rayWorld, dirFrom, eyeOf, damageFor } from './arena.js';
import { buildCharacter, poseCharacter, CHARACTERS } from './characters.js';
import { bend } from './bend.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const $ = (id) => document.getElementById(id);
const smooth = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);
function concrete(g, w, h, base = '#4a4f63') {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3200; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rnd(0.02, 0.07)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 3)); }
}
const floorTex = () => canvasTex(1024, 1024, (g, w, h) => {
  concrete(g, w, h, '#3a3f55');
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.moveTo(0, (i * h) / 8); g.lineTo(w, (i * h) / 8); g.stroke(); }
  g.strokeStyle = '#f2b51d'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, w * 0.31, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(242,181,29,.9)'; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.save(); g.translate(w / 2 + Math.cos(a) * w * 0.39, h / 2 + Math.sin(a) * h * 0.39); g.rotate(a); g.fillRect(-10, -3, 20, 6); g.restore(); }
});
const wallTex = () => canvasTex(2048, 256, (g, w, h) => {
  concrete(g, w, h, '#33384d');
  const cols = ['#ff3d7f', '#29d6ff', '#ffd23f', '#9b5cff', '#42e07a', '#ff8a1f'];
  for (let i = 0; i < 26; i++) { // bubble-letter blobs and drips, abstract on purpose
    const x = rnd(0, w), y = rnd(50, 200), c = cols[i % cols.length];
    g.fillStyle = c; g.strokeStyle = '#0b0f24'; g.lineWidth = 7;
    g.beginPath(); g.ellipse(x, y, rnd(26, 70), rnd(22, 44), rnd(-0.4, 0.4), 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x - 12, y - 10, 10, 6, -0.5, 0, Math.PI * 2); g.fill();
    if (i % 3 === 0) { g.fillStyle = c; g.fillRect(x - 3, y + 30, 6, rnd(20, 70)); }
  }
  g.fillStyle = '#f2b51d'; g.fillRect(0, h - 22, w, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, w, 14);
  for (let i = 0; i < w; i += 64) { g.fillStyle = i % 128 ? '#f2b51d' : '#15182a'; g.fillRect(i, h - 10, 32, 10); }
});
const crateTex = (col) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = col; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.1)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 4), rnd(1, 4)); }
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
  g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.moveTo(w - 10, 10); g.lineTo(10, h - 10); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 8);
});
const forceTex = () => canvasTex(512, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6) { g.fillStyle = `rgba(80,220,255,${0.05 + 0.1 * ((y / 6) % 2)})`; g.fillRect(0, y, w, 2); }
  for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(120,240,255,.3)'; g.fillRect(x, 0, 2, h); }
  const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(120,240,255,.7)'); gr.addColorStop(0.25, 'rgba(120,240,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, [6, 1]);
const flashTex = () => canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 60); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,200,80,.85)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64); g.fillStyle = 'rgba(255,240,180,.9)';
  for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -60); g.lineTo(-5, -60); g.closePath(); g.fill(); }
});
const eagleTex = () => canvasTex(512, 128, (g, w, h) => { // engraved slide: an original stylised eagle head + wordmark
  g.fillStyle = '#f2b51d'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7a4d00'; g.lineWidth = 3; g.fillStyle = '#c98a0a';
  g.beginPath(); g.moveTo(40, 96); g.quadraticCurveTo(30, 40, 78, 24); g.quadraticCurveTo(104, 14, 120, 34); g.lineTo(150, 44); g.lineTo(122, 52); g.quadraticCurveTo(116, 80, 90, 98); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#4a2c00'; g.beginPath(); g.arc(98, 38, 4, 0, 7); g.fill();
  g.font = 'bold 40px Lilita One, Impact, sans-serif'; g.fillStyle = '#5a3500'; g.textAlign = 'left'; g.fillText('GOLD EAGLE', 176, 66);
  g.font = 'bold 20px sans-serif'; g.fillStyle = '#7a4d00'; g.fillText('REVERSE SURFERS  *  MK-I  *  .50', 176, 100);
  g.strokeStyle = '#7a4d00'; g.lineWidth = 2; g.strokeRect(160, 20, 332, 94);
});
const gripTex = () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#1b1812'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,200,80,.35)'; g.lineWidth = 2; for (let i = -h; i < w + h; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); } });

// ------------------------------------------------------------------------------------------- Gold Eagle
let ENV = null;
function goldMats(simple) {
  const env = simple ? null : ENV;
  return {
    gold: new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0xc8901a, metalness: 1, roughness: 0.42, envMap: env, envMapIntensity: 1.1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x24242a, metalness: 0.9, roughness: 0.35, envMap: env, envMapIntensity: 1 }),
    grip: new THREE.MeshStandardMaterial({ map: gripTex(), metalness: 0.2, roughness: 0.8 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  };
}
export function buildGoldEagle(simple = false) {
  const M = goldMats(simple);
  const gun = new THREE.Group(), slide = new THREE.Group(), body = new THREE.Group();
  gun.add(body, slide);
  const rb = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, simple ? 1 : 3, r), m);
  const put = (mesh, parent, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); mesh.castShadow = false; return mesh; };
  // slide (moves on recoil): top block, rear serrations, sights, ejection port, engraved sides
  put(rb(0.064, 0.056, 0.31, 0.012, M.gold), slide, 0, 0.036, -0.045);
  put(rb(0.052, 0.014, 0.28, 0.005, M.dark), slide, 0, 0.07, -0.05);
  for (let i = 0; i < 6; i++) { put(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.046, 0.004), M.dark), slide, 0, 0.036, 0.085 + i * 0.011); }
  put(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.016, 0.012), M.steel), slide, 0, 0.082, -0.19); // front post
  put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.01), M.steel), slide, -0.018, 0.08, 0.1); // rear notch L
  put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.01), M.steel), slide, 0.018, 0.08, 0.1); // rear notch R
  put(new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.05), M.steel), slide, 0.033, 0.045, 0.01); // ejection port
  put(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.01), M.glow), slide, 0, 0.083, -0.19); // tritium dot
  if (!simple) {
    const eagle = eagleTex();
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshStandardMaterial({ map: eagle, metalness: 1, roughness: 0.28, envMap: ENV, envMapIntensity: 1.2 })); p.position.set(sx * 0.0325, 0.034, -0.07); p.rotation.y = sx * Math.PI / 2; if (sx < 0) p.scale.x = -1; slide.add(p); }
  }
  // barrel + muzzle ring (static)
  put(new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.07, 14), M.steel), body, 0, 0.034, -0.215).rotation.x = Math.PI / 2;
  put(new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 8, 16), M.dark), body, 0, 0.034, -0.252);
  // frame, dust cover, grip, trigger guard, trigger, hammer, magazine
  put(rb(0.056, 0.05, 0.26, 0.01, M.dark), body, 0, -0.004, -0.04);
  put(rb(0.05, 0.135, 0.075, 0.014, M.grip), body, 0, -0.09, 0.085).rotation.x = -0.26;
  for (const sx of [-1, 1]) { const p = put(rb(0.006, 0.12, 0.06, 0.003, M.gold), body, sx * 0.027, -0.088, 0.083); p.rotation.x = -0.26; }
  const tg = new THREE.Group(); body.add(tg); tg.position.set(0, -0.045, -0.02);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.075), M.dark), tg, 0, -0.018, 0.0);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.008), M.dark), tg, 0, -0.002, -0.036);
  put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.028, 0.008), M.dark), tg, 0, -0.002, 0.034);
  const trigger = put(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.008), M.steel), body, 0, -0.04, 0.0);
  const hammer = put(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.026, 0.012), M.steel), body, 0, 0.062, 0.115);
  const mag = put(rb(0.04, 0.05, 0.06, 0.006, M.steel), body, 0, -0.172, 0.108);
  mag.rotation.x = -0.26;
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.034, -0.262); body.add(muzzle);
  const eject = new THREE.Object3D(); eject.position.set(0.04, 0.046, 0.0); slide.add(eject);
  return { gun, slide, body, mag, hammer, trigger, muzzle, eject };
}

// ------------------------------------------------------------------------------------------- the arena
function buildArena(renderer, low = false) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a1c);
  scene.fog = new THREE.Fog(0x0a0f2a, 30, 82);
  const hemi = new THREE.HemisphereLight(0x8fa8ff, 0x35283f, 0.75); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d0, 1.9); key.position.set(-10, 26, 8); key.target.position.set(0, 0, 0);
  key.castShadow = renderer.shadowMap.enabled; key.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
  scene.add(key, key.target);
  const matS = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, envMap: ENV, envMapIntensity: 0.25, ...o });

  // floor + gold ring + spawn pads + logo decal
  const floor = new THREE.Mesh(new THREE.CircleGeometry(A.R + 0.6, 96), matS({ map: floorTex(), roughness: 0.62 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const pad = (z, col) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.35, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z); scene.add(m); const d = new THREE.Mesh(new THREE.CircleGeometry(0.88, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16 })); d.rotation.x = -Math.PI / 2; d.position.set(0, 0.015, z); scene.add(d); };
  pad(SPAWNS[0].z, 0x29d6ff); pad(SPAWNS[1].z, 0xff3d7f);
  new THREE.TextureLoader().load('/logo.png', (t) => { t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2; m.position.set(-5.3, 0.03, 0.2); scene.add(m); });

  // outer wall (concrete graffiti) + gold coping + force field + stars
  const wallH = 3.6;
  const wt = wallTex(); wt.repeat.set(2, 1); wt.wrapS = THREE.RepeatWrapping;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(A.R + 0.5, A.R + 0.5, wallH, 96, 1, true), matS({ map: wt, side: THREE.BackSide, roughness: 0.8 }));
  wall.position.y = wallH / 2; wall.receiveShadow = true; scene.add(wall);
  const coping = new THREE.Mesh(new THREE.TorusGeometry(A.R + 0.5, 0.16, 10, 96), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.25, envMap: ENV, emissive: 0x6a4300, emissiveIntensity: 0.5 }));
  coping.rotation.x = Math.PI / 2; coping.position.y = wallH; scene.add(coping);
  const ft = forceTex();
  const force = new THREE.Mesh(new THREE.CylinderGeometry(A.R + 0.45, A.R + 0.45, 7, 96, 1, true), new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  force.position.y = wallH + 3.5; scene.add(force);
  const stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 500 }, () => { const a = Math.random() * 6.28, e = Math.random() * 1.2 + 0.25, r = 160; return new THREE.Vector3(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); })), new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false }));
  scene.add(stars);

  // bleachers with an instanced crowd behind the field of force
  const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.5, 3, 6), new THREE.MeshStandardMaterial({ roughness: 0.9 }), low ? 120 : 360);
  const dummy = new THREE.Object3D(), col = new THREE.Color(), seeds = [];
  const palette = ['#ff3d7f', '#29d6ff', '#ffd23f', '#9b5cff', '#42e07a', '#ff8a1f', '#e8e8f0', '#ff5a5a'];
  let n = 0;
  const crowdMax = low ? 120 : 360;
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 120 && n < crowdMax; i++) {
    const a = (i / 120) * Math.PI * 2 + tier * 0.03, r = A.R + 3.4 + tier * 1.9;
    dummy.position.set(Math.cos(a) * r, 2.6 + tier * 1.4, Math.sin(a) * r); dummy.rotation.set(0, -a - Math.PI / 2, 0); dummy.updateMatrix();
    crowd.setMatrixAt(n, dummy.matrix); crowd.setColorAt(n, col.set(palette[(Math.random() * palette.length) | 0])); seeds.push({ x: dummy.position.x, y: dummy.position.y, z: dummy.position.z, a, ph: Math.random() * 6.28 }); n++;
  }
  scene.add(crowd);
  for (let tier = 0; tier < 3; tier++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(A.R + 5 + tier * 1.9, A.R + 3.2 + tier * 1.9, 0.8, 80, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1d33, side: THREE.DoubleSide, roughness: 1 })); st.position.y = 2.0 + tier * 1.4; scene.add(st); }

  // floodlight towers (visible lamps + two real spot lights)
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, x = Math.cos(a) * (A.R + 2.2), z = Math.sin(a) * (A.R + 2.2);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 13, 8), matS({ color: 0x2a2d44 })); post.position.set(x, 6.5, z); scene.add(post);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.5), matS({ color: 0x15172a })); head.position.set(x, 13, z); head.lookAt(0, 4, 0); scene.add(head);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.75), lampMat); lamp.position.set(x * 0.985, 13, z * 0.985); lamp.lookAt(0, 4, 0); scene.add(lamp);
    if (!low) { const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    cone.position.set(x * 0.55, 6.6, z * 0.55); cone.lookAt(0, 0, 0); cone.rotateX(Math.PI / 2); scene.add(cone); }
    if (!low && i % 3 === 0) { const sp = new THREE.SpotLight(0xd8e6ff, 38, 60, 0.7, 0.6, 1.2); sp.position.set(x, 13, z); sp.target.position.set(0, 0, 0); scene.add(sp, sp.target); }
  }

  // cover: wagon, crates, low wall, pillars, barrels
  const coverMeshes = [];
  for (const b of COVER) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
    const id = b.id.replace('2', '');
    if (id === 'wagon') {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.h - 0.55, b.hz * 2), matS({ color: 0x8e2a3a, roughness: 0.55, metalness: 0.2 })); hull.position.y = 0.55 + (b.h - 0.55) / 2; g.add(hull);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.04, 0.22, b.hz * 2 + 0.04), matS({ color: 0xf2b51d, metalness: 0.6 })); strip.position.y = 1.35; g.add(strip);
      const base = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 - 0.1, 0.55, b.hz * 2 - 0.2), matS({ color: 0x15172a })); base.position.y = 0.28; g.add(base);
      for (let i = -2; i <= 2; i++) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ color: 0xffe08a })); w.position.set(sx * (b.hx + 0.02), 1.95, i * 1.3); w.rotation.y = sx * Math.PI / 2; g.add(w); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.08, 0.14, b.hz * 2 + 0.08), matS({ color: 0x3a3f55 })); roof.position.y = b.h - 0.07; g.add(roof);
    } else if (id === 'crateA' || id === 'stack') {
      const cols = ['#c0703a', '#2f7fd0', '#3aa86a']; const t = crateTex(cols[(Math.abs(b.x) | 0) % 3]);
      const lv = id === 'stack' ? 2 : 1, hh = b.h / lv;
      for (let i = 0; i < lv; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, hh, b.hz * 2), matS({ map: t })); m.position.y = hh * (i + 0.5); g.add(m); }
    } else if (id === 'wall') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.h, b.hz * 2), matS({ map: floorTex(), color: 0xb9bfd8 })); m.position.y = b.h / 2; g.add(m);
      const t = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.06, 0.1, b.hz * 2 + 0.06), matS({ color: 0xf2b51d, metalness: 0.6 })); t.position.y = b.h; g.add(t);
    } else if (id === 'pillar') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, b.h, b.hz * 2), matS({ color: 0x4a5070 })); m.position.y = b.h / 2; g.add(m);
      const band = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.05, 0.12, b.hz * 2 + 0.05), new THREE.MeshBasicMaterial({ color: 0x29f0ff })); band.position.y = b.h * 0.7; g.add(band);
      const top = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2 + 0.05, 0.12, b.hz * 2 + 0.05), new THREE.MeshBasicMaterial({ color: 0xff3d7f })); top.position.y = b.h - 0.06; g.add(top);
    } else {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(b.hx, b.hx, b.h, 16), matS({ color: 0xd9822b, metalness: 0.4, roughness: 0.5 })); m.position.y = b.h / 2; g.add(m);
      const r = new THREE.Mesh(new THREE.TorusGeometry(b.hx + 0.005, 0.03, 6, 20), matS({ color: 0x15172a })); r.rotation.x = Math.PI / 2; r.position.y = b.h * 0.3; g.add(r); const r2 = r.clone(); r2.position.y = b.h * 0.75; g.add(r2);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g); coverMeshes.push(g);
  }

  // drifting dust motes
  const dust = new THREE.Points(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, () => new THREE.Vector3(rnd(-16, 16), rnd(0.2, 7), rnd(-16, 16)))), new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.07, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(dust);
  const flashLight = new THREE.PointLight(0xffc860, 0, 14, 2); scene.add(flashLight);
  return {
    scene, flashLight, force, crowd,
    update(time) {
      ft.offset.x = time * 0.04; dust.rotation.y = time * 0.02; dust.position.y = Math.sin(time * 0.3) * 0.2;
      if (!low) for (let i = 0; i < seeds.length; i += 1) { if ((i + (time * 8 | 0)) % 3) continue; const s = seeds[i]; dummy.position.set(s.x, s.y + Math.max(0, Math.sin(time * 5 + s.ph)) * 0.22, s.z); dummy.rotation.set(0, -s.a - Math.PI / 2, 0); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); }
      if (!low) crowd.instanceMatrix.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------------------------------- practice bot
const LEVELS = {
  dummy: { react: 99, err: 0, turn: 0, fire: 99, strafe: 0, head: 0 },
  easy: { react: 1.15, err: 0.16, turn: 1.7, fire: 0.85, strafe: 0.4, head: 0.04 },
  normal: { react: 0.62, err: 0.085, turn: 2.9, fire: 0.6, strafe: 0.65, head: 0.1 },
  hard: { react: 0.3, err: 0.035, turn: 4.8, fire: 0.42, strafe: 0.9, head: 0.24 },
  pro: { react: 0.16, err: 0.014, turn: 7.5, fire: 0.34, strafe: 1.1, head: 0.45 },
};
function makeBot(spawn, level) {
  const L = LEVELS[level] || LEVELS.normal;
  return { body: newBody(spawn), L, hp: A.HP, ammo: A.GUN.mag, reloadT: 0, lastShot: -9, seenT: 0, strafeDir: 1, strafeT: 0, jumpT: rnd(2, 5), aimYaw: spawn.yaw, aimPitch: 0, wander: 0 };
}
function botThink(bot, me, dt, t, fire) {
  const b = bot.body, L = bot.L;
  const eye = eyeOf(b), tgt = { x: me.x, y: me.y + 1.2, z: me.z };
  const dx = tgt.x - eye.x, dy = tgt.y - eye.y, dz = tgt.z - eye.z, dist = Math.hypot(dx, dy, dz);
  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  const los = rayWorld(eye, dir, dist) >= dist - 0.3;
  bot.seenT = los ? bot.seenT + dt : 0;
  // desired aim with error and a little lead on the target's movement
  const lead = clamp(dist / 60, 0, 0.3);
  const aimYaw = Math.atan2(-(dx + (me.vx || 0) * lead), -(dz + (me.vz || 0) * lead));
  const aimPitch = Math.atan2(dy, Math.hypot(dx, dz)) + 0.08;
  const turn = L.turn * dt;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  bot.aimYaw += clamp(wrap(aimYaw - bot.aimYaw), -turn, turn);
  bot.aimPitch += clamp(aimPitch - bot.aimPitch, -turn, turn);
  b.yaw = bot.aimYaw; b.pitch = bot.aimPitch;
  // movement: strafe at mid range, push forward when far, flank when the line of sight is blocked
  bot.strafeT -= dt; if (bot.strafeT <= 0) { bot.strafeDir = Math.random() < 0.5 ? -1 : 1; bot.strafeT = rnd(0.7, 1.8); }
  let fz = 0, fx = L.strafe ? bot.strafeDir * L.strafe : 0;
  if (!los) { fz = 0.6; fx = bot.strafeDir; } else if (dist > 14) fz = 0.7; else if (dist < 7) fz = -0.7;
  bot.jumpT -= dt;
  const jump = bot.jumpT <= 0 && L.strafe > 0.7; if (jump) bot.jumpT = rnd(2.5, 6);
  if (L.strafe) step(b, { fx: clamp(fx, -1, 1), fz, jump }, dt);
  // shooting
  bot.reloadT = Math.max(0, bot.reloadT - dt);
  if (bot.ammo <= 0 && bot.reloadT <= 0) { bot.reloadT = A.GUN.reload; bot.ammo = A.GUN.mag; }
  const err = Math.abs(wrap(aimYaw - bot.aimYaw)) + Math.abs(aimPitch - bot.aimPitch);
  if (los && bot.seenT > L.react && bot.reloadT <= 0 && bot.ammo > 0 && t - bot.lastShot > L.fire && err < 0.12 + L.err) {
    bot.lastShot = t; bot.ammo--;
    const spread = L.err * (Math.random() * 2 - 1), spreadP = L.err * (Math.random() * 2 - 1);
    fire(dirFrom(b.yaw + spread, b.pitch + spreadP), eye, L);
  }
}

// ------------------------------------------------------------------------------------------- controller
export function createDuel(ctx) {
  const { renderer, canvas, save, cheats, audio } = ctx;
  let arena = null, vmScene = null, vmCam = null, cam = null, gun = null, flashSprite = null, avatar = null, nameTag = null, tagCtx = null, hitbox = null;
  const D = { active: false, phase: 'idle', online: false, t: 0, liveT: 0, endsAt: 0, me: null, foe: null, foeSnap: [], keys: new Set(), yaw: 0, pitch: 0, recoil: 0, kickY: 0, kickP: 0, slideZ: 0, reload: 0, ads: 0, bob: 0, sway: { x: 0, y: 0 }, shells: [], mags: [], dmgNums: [], lastShot: -9, stats: { shots: 0, hits: 0, head: 0, dmg: 0 }, sendT: 0, bot: null, resultSent: false, hurtT: 0, shake: 0, focusMsg: false };
  let savedBend = null;

  function ensureBuilt() {
    if (arena) return;
    const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    arena = buildArena(renderer, save.settings.quality === 'low' || save.settings.quality === 'potato');
    cam = new THREE.PerspectiveCamera(90, 1, 0.05, 220); arena.scene.add(cam);
    vmScene = new THREE.Scene(); vmCam = new THREE.PerspectiveCamera(52, 1, 0.01, 4);
    vmScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6a4d20, 1.1)); const dl = new THREE.DirectionalLight(0xfff0d0, 2.4); dl.position.set(-1, 2, 1.5); vmScene.add(dl);
    const wl = new THREE.PointLight(0xffd070, 0.8, 3); wl.position.set(0.4, 0.2, 0.2); vmScene.add(wl);
    vmScene.environment = ENV; vmScene.environmentIntensity = 0.9;
    gun = buildGoldEagle(false); vmScene.add(vmCam); gun.root = new THREE.Group(); gun.root.add(gun.gun); vmCam.add(gun.root);
    flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); flashSprite.scale.setScalar(0.22); gun.muzzle.add(flashSprite);
    gun.slide.position.z = 0;
    gun.spare = gun.mag.clone(); gun.spare.visible = false; gun.body.add(gun.spare);
    resize();
    const lockEl = $('dLock');
    if (lockEl) lockEl.onclick = () => { canvas.requestPointerLock && canvas.requestPointerLock(); };
  }
  function resize() { if (!cam) return; const a = window.innerWidth / window.innerHeight; cam.aspect = a; cam.updateProjectionMatrix(); vmCam.aspect = a; vmCam.updateProjectionMatrix(); }

  // ---- opponent avatar
  function buildAvatar(charId) {
    if (avatar) { arena.scene.remove(avatar.root); avatar = null; }
    const def = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[1];
    avatar = buildCharacter(def);
    const g = buildGoldEagle(true).gun; g.scale.setScalar(1.35); g.rotation.x = -Math.PI / 2; g.position.set(0, -0.3, 0);
    avatar.rig.foreR.add(g);
    avatar.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    arena.scene.add(avatar.root);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; tagCtx = c.getContext('2d');
    nameTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); nameTag.scale.set(1.5, 0.375, 1); nameTag.renderOrder = 10; arena.scene.add(nameTag);
    if (hitbox) { arena.scene.remove(hitbox); hitbox = null; }
    if (cheats.duelHitbox) { hitbox = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: 0xff3030, wireframe: true }); const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), m); h.position.y = 1.62; const bd = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.87, 0.56), m); bd.position.y = 0.985; const lg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.48), m); lg.position.y = 0.275; hitbox.add(h, bd, lg); arena.scene.add(hitbox); }
  }
  function drawTag(name, hp) {
    tagCtx.clearRect(0, 0, 256, 64); tagCtx.fillStyle = 'rgba(8,12,34,.75)'; tagCtx.fillRect(6, 4, 244, 56);
    tagCtx.font = 'bold 26px Lilita One, sans-serif'; tagCtx.fillStyle = '#fff'; tagCtx.textAlign = 'center'; tagCtx.fillText(name.slice(0, 14), 128, 30);
    tagCtx.fillStyle = 'rgba(255,255,255,.2)'; tagCtx.fillRect(18, 40, 220, 10); tagCtx.fillStyle = hp > 50 ? '#42e07a' : hp > 25 ? '#ffd23f' : '#ff4d5e'; tagCtx.fillRect(18, 40, 2.2 * Math.max(0, hp), 10);
    nameTag.material.map.needsUpdate = true;
  }

  // ---- input
  const onKey = (e) => {
    if (!D.active) return;
    const k = e.key.toLowerCase();
    if (e.type === 'keydown') {
      D.keys.add(k);
      if (k === 'r') startReload();
      if (k === ' ') e.preventDefault();
    } else D.keys.delete(k);
  };
  const onMove = (e) => {
    if (!D.active || document.pointerLockElement !== canvas || D.phase === 'over') return;
    const s = 0.0022 * (save.settings.mouseSens || 1) * (1 - D.ads * 0.45);
    D.yaw -= e.movementX * s; D.pitch = clamp(D.pitch - e.movementY * s * (save.settings.invertY ? -1 : 1), -1.45, 1.45);
    D.sway.x = clamp(D.sway.x + e.movementX * 0.00018, -0.03, 0.03); D.sway.y = clamp(D.sway.y + e.movementY * 0.00018, -0.03, 0.03);
  };
  const onDown = (e) => {
    if (!D.active) return;
    // The click that grabs the pointer must also fire: being sent back to "click to aim" felt like the gun was dead.
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock && canvas.requestPointerLock();
    if (e.button === 0) { D.firing = true; if (D.phase === 'live') tryFire(); }
    if (e.button === 2) D.aim = true;
  };
  const onUp = (e) => { if (e.button === 0) D.firing = false; if (e.button === 2) D.aim = false; };
  const onCtx = (e) => { if (D.active) e.preventDefault(); };
  const onLock = () => { $('dLock').classList.toggle('hidden', !D.active || document.pointerLockElement === canvas || D.phase === 'over'); };
  function bind(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('keydown', onKey); window[f]('keyup', onKey); window[f]('mousemove', onMove); canvas[f]('mousedown', onDown); window[f]('mouseup', onUp); canvas[f]('contextmenu', onCtx); document[f]('pointerlockchange', onLock); window[f]('resize', resize);
  }

  // ---- shooting
  function startReload() {
    if (D.reload > 0 || D.me.ammo >= A.GUN.mag || D.phase !== 'live' || D.me.hp <= 0) return;
    D.reload = 0.0001; D.reloadClicks = 0;
    if (D.online) ctx.send({ t: 'dr' });
  }
  function muzzleFlash() {
    flashSprite.material.opacity = 1; flashSprite.scale.setScalar(rnd(0.18, 0.3)); flashSprite.material.rotation = Math.random() * 6; D.flashT = 0.05;
    arena.flashLight.intensity = 7; D.lightT = 0.06;
  }
  function ejectShell() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.3 }));
    gun.eject.getWorldPosition(m.position); vmScene.add(m);
    D.shells.push({ m, v: new THREE.Vector3(rnd(0.8, 1.4), rnd(0.8, 1.4), rnd(0.2, 0.6)), spin: new THREE.Vector3(rnd(-12, 12), rnd(-12, 12), rnd(-12, 12)), life: 0.9 });
  }
  function tryFire() {
    if (D.phase !== 'live' || D.me.hp <= 0) return;
    D.crossKick = 1;
    const rate = A.GUN.interval / (cheats.duelRate || 1);
    if (D.t - D.lastShot < rate || D.reload > 0) return;
    if (D.me.ammo <= 0) { if (D.t - D.lastShot > 0.25) { audio.sfx.empty(); startReload(); D.lastShot = D.t; } return; }
    D.lastShot = D.t; if (!cheats.duelInfAmmo) D.me.ammo--; else D.me.ammo = A.GUN.mag;
    D.stats.shots++;
    // recoil + effects (client prediction: instant)
    D.recoil = 1; D.slideZ = 1; D.kickP += 0.05 * (1 - D.ads * 0.4); D.kickY += rnd(-0.012, 0.012); D.shake = 0.5;
    muzzleFlash(); ejectShell(); audio.sfx.gunshot(false);
    const spread = (D.me.moving ? 0.012 : 0.004) * (1 - D.ads * 0.6);
    const o = eyeOf(D.me.body), d = dirFrom(D.yaw + rnd(-spread, spread), D.pitch + D.kickP * 0.3 + rnd(-spread, spread));
    if (D.online) ctx.send({ t: 'df', ox: +o.x.toFixed(2), oy: +o.y.toFixed(2), oz: +o.z.toFixed(2), dx: +d.x.toFixed(4), dy: +d.y.toFixed(4), dz: +d.z.toFixed(4) });
    else {
      const hit = hitscan(o, d, D.foe.body);
      if (hit && D.foe.hp > 0) {
        let part = hit.part; const hy = o.y + d.y * hit.t - D.foe.body.y;
        if (cheats.duelBigHead && part === 'body' && hy > 1.2) part = 'head';
        applyHit('me', part, o, d, hit.t);
      } else if (!hit) { const t = rayWorld(o, d, 60); sparks(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t, 0xffd070, 5); }
    }
  }
  function sparks(x, y, z, color, n) {
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, y, z); arena.scene.add(m); D.sparks = D.sparks || []; D.sparks.push({ m, v: new THREE.Vector3(rnd(-2, 2), rnd(0.5, 3), rnd(-2, 2)), life: 0.45 }); }
  }
  function damageNumber(x, y, z, text, color) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 44px Lilita One, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#0b0f24'; g.strokeText(text, 64, 46); g.fillStyle = color; g.fillText(text, 64, 46);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(0.9, 0.45, 1); s.position.set(x, y, z); s.renderOrder = 11; arena.scene.add(s); D.dmgNums.push({ s, life: 0.9 });
  }
  // `who` = who dealt the damage. Offline: resolved locally. Online: called from the server's dhit events.
  function applyHit(who, part, o, d, tt, dmgOverride, hpAfter) {
    const dmg = dmgOverride ?? damageFor(part) * (cheats.duelBigHead && part === 'head' ? 1 : 1);
    if (who === 'me') {
      D.foe.hp = hpAfter ?? Math.max(0, D.foe.hp - dmg);
      D.stats.hits++; D.stats.dmg += dmg; if (part === 'head') D.stats.head++;
      audio.sfx.hitmark(part === 'head'); hitMarker(part === 'head', D.foe.hp <= 0);
      const fb = D.foe.body; damageNumber(fb.x, fb.y + (part === 'head' ? 1.95 : 1.4), fb.z, String(dmg), part === 'head' ? '#ffd23f' : '#ffffff');
      sparks(fb.x, fb.y + (part === 'head' ? 1.62 : 1.0), fb.z, 0xffe9a0, 8);
      if (D.foe.hp <= 0 && !D.online) finish('win', 'kill');
    } else {
      if (cheats.duelGod) return;
      D.me.hp = hpAfter ?? Math.max(0, D.me.hp - dmg); D.hurtT = 0.6; D.shake = 0.8; audio.sfx.hurt();
      const el = $('dHurt'); el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 220);
      if (D.me.hp <= 0 && !D.online) finish('lose', 'kill');
    }
  }
  function hitMarker(head, kill) { const el = $('dHit'); el.className = `on ${head ? 'head' : ''} ${kill ? 'kill' : ''}`; clearTimeout(hitMarker.t); hitMarker.t = setTimeout(() => { el.className = ''; }, 160); }
  function feed(msg) { const f = document.createElement('div'); f.textContent = msg; $('dFeed').appendChild(f); setTimeout(() => f.remove(), 4000); }

  // ---- match flow
  function start(opts) {
    ensureBuilt();
    D.online = !!opts.online; D.t = 0; D.phase = 'countdown'; D.resultSent = false; D.active = true; D.firing = D.aim = false; D.reload = 0; D.shells.length = 0; D.dmgNums.length = 0; D.foeSnap = [];
    D.stats = { shots: 0, hits: 0, head: 0, dmg: 0 }; D.recoil = D.slideZ = D.kickP = D.kickY = 0; D.mode = opts.mode || 'practice';
    D.deadWho = null; D.deadT = 0; D.result = null; D.lastTag = -1; D.localEnd = 0; D.hurtT = 0; D.shake = 0; D.aim = false;
    const si = opts.spawn || 0, spawn = SPAWNS[si], foeSpawn = SPAWNS[1 - si];
    D.me = { body: newBody(spawn), hp: A.HP, ammo: A.GUN.mag, name: opts.meName || 'YOU', moving: false, vx: 0, vz: 0 };
    D.foe = { body: newBody(foeSpawn), hp: A.HP, ammo: A.GUN.mag, name: opts.foeName || 'RIVAL', vx: 0, vz: 0, alive: true, yaw: foeSpawn.yaw, pitch: 0 };
    D.yaw = spawn.yaw; D.pitch = 0;
    D.bot = D.online ? null : makeBot(foeSpawn, cheats.duelBot || opts.level || save.settings.duelBot || 'easy');
    buildAvatar(opts.foeChar);
    avatar.root.rotation.x = 0; avatar.root.visible = true; drawTag(D.foe.name, 100);
    cam.fov = save.settings.duelFov || 90; cam.updateProjectionMatrix();
    savedBend = bend.uBend.value.clone(); bend.uBend.value.set(0, 0); // no curved-horizon bend inside the arena
    bind(true);
    $('duelhud').classList.remove('hidden');
    $('dMeName').textContent = D.me.name; $('dFoeName').textContent = D.foe.name;
    $('dCross').className = save.settings.crosshair || 'cross'; $('dCross').style.setProperty('--cc', save.settings.crossColor || '#42e07a');
    $('dFeed').innerHTML = ''; hud();
    D.liveT = opts.liveIn ?? 3; D.cd = -1;
    $('dLock').classList.toggle('hidden', document.pointerLockElement === canvas);
  }
  function goLive(endsAt) { D.phase = 'live'; D.endsAt = endsAt ?? (D.t + A.DURATION); $('dMsg').textContent = 'FIGHT!'; setTimeout(() => { if (D.phase === 'live') $('dMsg').textContent = ''; }, 900); audio.sfx.beep(1320); }
  function finish(result, reason) {
    if (D.phase === 'over') return;
    D.phase = 'over'; D.firing = false;
    if (document.exitPointerLock) document.exitPointerLock();
    if (result === 'lose' || result === 'win') { const dead = result === 'win' ? 'foe' : 'me'; D.deadWho = dead; D.deadT = 0; }
    D.result = { result, reason, stats: { ...D.stats, acc: D.stats.shots ? Math.round((D.stats.hits / D.stats.shots) * 100) : 0 }, hp: Math.round(D.me.hp), foeHp: Math.round(D.foe.hp), online: D.online };
    setTimeout(() => { if (D.active) ctx.onEnd(D.result); }, cheats.duelSlowKill ? 2600 : 1700);
  }
  function stop() {
    if (!D.active) return;
    D.active = false; D.phase = 'idle'; bind(false); D.keys.clear();
    if (document.exitPointerLock) document.exitPointerLock();
    $('duelhud').classList.add('hidden');
    if (savedBend) bend.uBend.value.copy(savedBend);
    if (avatar) avatar.root.visible = false;
    arena.flashLight.intensity = 0;
  }
  function hud() {
    $('dMeBar').style.width = `${D.me.hp}%`; $('dFoeBar').style.width = `${D.foe.hp}%`;
    $('dHpNum').textContent = Math.ceil(D.me.hp); $('dHpBar').style.width = `${D.me.hp}%`; $('dHpBar').className = D.me.hp > 50 ? '' : D.me.hp > 25 ? 'mid' : 'low';
    $('dAmmoNum').textContent = D.reload > 0 ? '--' : D.me.ammo; $('dAmmoHint').textContent = D.reload > 0 ? 'RELOADING' : D.me.ammo === 0 ? 'PRESS R' : '';
    const left = Math.max(0, D.phase === 'countdown' ? A.DURATION : Math.ceil(D.endsAt - D.t));
    $('dTimer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; $('dTimer').classList.toggle('low', left <= 15 && D.phase === 'live');
  }

  // ---- network events (online)
  function onNet(type, m) {
    if (!D.active) return;
    if (type === 'ds') {
      for (const p of m.ps) {
        if (p.id === ctx.myId()) { D.me.hp = p.hp; if (D.reload <= 0 && Math.abs(p.ammo - D.me.ammo) > 0) D.me.ammo = p.ammo; }
        else { D.foe.hp = p.hp; D.foeSnap.push({ t: performance.now(), x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, rl: p.rl }); if (D.foeSnap.length > 12) D.foeSnap.shift(); }
      }
    } else if (type === 'dfire') { if (m.id !== ctx.myId()) { audio.sfx.gunshot(true); D.foeFlashT = 0.08; } }
    else if (type === 'dhit') {
      const mine = m.by === ctx.myId();
      if (mine) { D.foe.hp = m.hp; D.stats.hits++; D.stats.dmg += m.dmg; if (m.part === 'head') D.stats.head++; audio.sfx.hitmark(m.part === 'head'); hitMarker(m.part === 'head', m.kill); const fb = D.foe.body; damageNumber(fb.x, fb.y + (m.part === 'head' ? 1.95 : 1.4), fb.z, String(m.dmg), m.part === 'head' ? '#ffd23f' : '#fff'); sparks(fb.x, fb.y + 1.2, fb.z, 0xffe9a0, 8); }
      else if (m.victim === ctx.myId()) { applyHit('foe', m.part, null, null, 0, m.dmg, m.hp); }
    } else if (type === 'dfix') { Object.assign(D.me.body, { x: m.x, y: m.y, z: m.z, vy: 0 }); }
    else if (type === 'duel' && m.phase === 'live') { goLive(null); D.serverEnds = m.endsAt; D.localEnd = performance.now() + (m.endsAt - ctx.serverNow()); }
    else if (type === 'dend') { const mine = m.players.find((p) => p.id === ctx.myId()); const res = m.winner == null ? 'draw' : m.winner === ctx.myId() ? 'win' : 'lose'; const st = mine || {}; D.stats = { shots: st.shots ?? D.stats.shots, hits: st.hits ?? D.stats.hits, head: st.head ?? D.stats.head, dmg: st.dmg ?? D.stats.dmg }; finish(res, m.reason); }
  }

  // ---- per-frame update
  function update(dt) {
    if (!D.active) return;
    D.t += dt;
    const me = D.me, b = me.body;
    arena.update(D.t);
    if (D.phase === 'countdown') {
      const left = Math.ceil(D.liveT - D.t);
      if (left !== D.cd && left > 0) { D.cd = left; $('dMsg').textContent = String(left); audio.sfx.beep(660 + (3 - left) * 110); }
      if (!D.online && D.t >= D.liveT) goLive(null);
    }
    if (D.online && D.phase === 'live' && D.localEnd) D.endsAt = D.t + Math.max(0, (D.localEnd - performance.now()) / 1000);
    // --- player movement
    const live = D.phase === 'live' && me.hp > 0;
    const k = D.keys;
    const fz = live ? ((k.has('w') || k.has('z') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)) : 0;
    const fx = live ? ((k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('q') || k.has('arrowleft') ? 1 : 0)) : 0;
    b.yaw = D.yaw; b.pitch = D.pitch;
    const px = b.x, pz = b.z;
    step(b, { fx, fz, jump: live && k.has(' ') }, dt);
    me.vx = (b.x - px) / dt; me.vz = (b.z - pz) / dt; me.moving = Math.hypot(me.vx, me.vz) > 0.5;
    D.bob += dt * (me.moving && b.ground ? 9 : 0);
    // --- shooting / reload / aim
    D.ads = damp(D.ads, live && D.aim && D.reload <= 0 ? 1 : 0, 14, dt);
    D.crossKick = Math.max(0, (D.crossKick || 0) - dt * 6);
    { // the crosshair tightens when aiming, opens when moving or right after a shot
      const el = $('dCross');
      if (el) el.style.setProperty('--cs', String(1 + (1 - D.ads) * 0.12 + (D.crossKick || 0) * 0.45 + Math.min(0.2, Math.hypot(me.vx || 0, me.vz || 0) * 0.012)));
    }
    if (live && D.firing) tryFire();
    if (D.reload > 0) {
      D.reload += dt / A.GUN.reload;
      const r = D.reload;
      if (r > 0.22 && D.reloadClicks === 0) { D.reloadClicks = 1; audio.sfx.reloadClick(0); dropMag(); }
      if (r > 0.62 && D.reloadClicks === 1) { D.reloadClicks = 2; audio.sfx.reloadClick(1); }
      if (r > 0.86 && D.reloadClicks === 2) { D.reloadClicks = 3; audio.sfx.reloadClick(2); }
      if (r >= 1) { D.reload = 0; D.me.ammo = A.GUN.mag; }
    }
    // --- bot (offline)
    if (D.bot && D.phase === 'live') {
      D.bot.body.pitch = D.bot.body.pitch; botThink(D.bot, { x: b.x, y: b.y, z: b.z, vx: me.vx, vz: me.vz }, dt, D.t, (dir, eye, L) => {
        audio.sfx.gunshot(true);
        const hit = hitscan(eye, dir, b);
        if (hit && me.hp > 0) { let part = hit.part; if (part === 'body' && Math.random() < L.head) part = 'head'; applyHit('foe', part, eye, dir, hit.t); }
      });
      D.foe.body = D.bot.body; D.foe.ammo = D.bot.ammo; // D.foe.hp is the single source of truth (damage is applied there)
    }
    if (D.phase === 'live' && !D.online && D.t >= D.endsAt) finish('draw', 'timeout');
    // --- network send (30 Hz)
    D.sendT += dt;
    if (D.online && D.phase === 'live' && D.sendT >= 1 / 30) { D.sendT = 0; ctx.send({ t: 'du', x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), yaw: +D.yaw.toFixed(3), pitch: +D.pitch.toFixed(3) }); }
    // --- opponent avatar
    if (D.online && D.foeSnap.length) { // interpolate 100 ms behind the newest snapshot
      const want = performance.now() - 100; let a = D.foeSnap[0], c = D.foeSnap[D.foeSnap.length - 1];
      for (let i = 0; i < D.foeSnap.length - 1; i++) if (D.foeSnap[i].t <= want && D.foeSnap[i + 1].t >= want) { a = D.foeSnap[i]; c = D.foeSnap[i + 1]; break; }
      const kk = c.t === a.t ? 1 : clamp((want - a.t) / (c.t - a.t), 0, 1);
      const fb = D.foe.body; const ox = fb.x, oz = fb.z;
      fb.x = lerp(a.x, c.x, kk); fb.y = lerp(a.y, c.y, kk); fb.z = lerp(a.z, c.z, kk); fb.yaw = c.yaw; fb.pitch = c.pitch;
      D.foe.vx = (fb.x - ox) / dt; D.foe.vz = (fb.z - oz) / dt;
    } else if (D.bot) { const fb = D.foe.body; D.foe.vx = (fb.x - (D.foe.px ?? fb.x)) / dt; D.foe.vz = (fb.z - (D.foe.pz ?? fb.z)) / dt; D.foe.px = fb.x; D.foe.pz = fb.z; }
    const fb = D.foe.body;
    avatar.root.position.set(fb.x, fb.y, fb.z);
    avatar.root.rotation.y = fb.yaw;
    const sp = Math.hypot(D.foe.vx || 0, D.foe.vz || 0);
    if (D.deadWho === 'foe') { D.deadT += dt; avatar.root.rotation.x = -Math.min(1.4, D.deadT * 3); poseCharacter(avatar, { state: 'crash', speed: 0, crashT: D.deadT }, dt); }
    else {
      poseCharacter(avatar, { state: sp > 1 ? 'run' : 'idle', speed: Math.min(sp, 6.4) * 1.6, vx: 0, vy: 0 }, dt);
      avatar.rig.armR.rotation.x = Math.PI / 2 + fb.pitch; avatar.rig.armR.rotation.z = -0.05; avatar.rig.foreR.rotation.x = 0;
    }
    nameTag.position.set(fb.x, fb.y + 2.35, fb.z);
    if (D.lastTag !== Math.ceil(D.foe.hp)) { D.lastTag = Math.ceil(D.foe.hp); drawTag(D.foe.name, D.foe.hp); }
    if (hitbox) hitbox.position.set(fb.x, fb.y, fb.z);
    if (D.deadWho === 'me') D.deadT += dt;
    // --- camera + viewmodel
    D.kickP = damp(D.kickP, 0, 9, dt); D.kickY = damp(D.kickY, 0, 9, dt); D.shake = damp(D.shake, 0, 7, dt); D.hurtT = Math.max(0, D.hurtT - dt);
    const eyeH = A.EYE + Math.sin(D.bob) * 0.035 * (b.ground ? 1 : 0) - (D.deadWho === 'me' ? Math.min(1.2, D.deadT * 2) : 0);
    cam.position.set(b.x + (Math.random() - 0.5) * D.shake * 0.01, b.y + eyeH, b.z);
    cam.rotation.order = 'YXZ'; cam.rotation.y = D.yaw + D.kickY; cam.rotation.x = D.pitch + D.kickP; cam.rotation.z = (D.deadWho === 'me' ? Math.min(1.1, D.deadT * 2) : 0) + Math.sin(D.bob * 0.5) * 0.004;
    const baseFov = save.settings.duelFov || 90; const fovT = lerp(baseFov, baseFov * 0.62, D.ads) + (D.hurtT > 0 ? -2 : 0);
    if (Math.abs(cam.fov - fovT) > 0.05) { cam.fov = fovT; cam.updateProjectionMatrix(); }
    updateGun(dt);
    // particles
    for (let i = D.shells.length - 1; i >= 0; i--) { const s = D.shells[i]; s.life -= dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt * 0.35); s.m.rotation.x += s.spin.x * dt; s.m.rotation.z += s.spin.z * dt; if (s.life <= 0) { vmScene.remove(s.m); D.shells.splice(i, 1); } }
    for (let i = D.mags.length - 1; i >= 0; i--) { const s = D.mags[i]; s.life -= dt; s.v.y -= 5 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += 3 * dt; if (s.life <= 0) { vmScene.remove(s.m); D.mags.splice(i, 1); } }
    for (let i = (D.sparks || []).length - 1; i >= 0; i--) { const s = D.sparks[i]; s.life -= dt; s.v.y -= 7 * dt; s.m.position.addScaledVector(s.v, dt); s.m.material.opacity = Math.max(0, s.life * 2.2); s.m.lookAt(cam.position); if (s.life <= 0) { arena.scene.remove(s.m); D.sparks.splice(i, 1); } }
    for (let i = D.dmgNums.length - 1; i >= 0; i--) { const s = D.dmgNums[i]; s.life -= dt; s.s.position.y += dt * 0.9; s.s.material.opacity = Math.min(1, s.life * 2); if (s.life <= 0) { arena.scene.remove(s.s); D.dmgNums.splice(i, 1); } }
    if (D.flashT > 0) { D.flashT -= dt; if (D.flashT <= 0) flashSprite.material.opacity = 0; }
    if (D.lightT > 0) { D.lightT -= dt; arena.flashLight.intensity = Math.max(0, D.lightT * 110); arena.flashLight.position.copy(cam.position).addScaledVector(new THREE.Vector3(0, 0, -1).applyEuler(cam.rotation), 1.2); }
    hud();
  }
  function dropMag() {
    const m = gun.mag.clone(); gun.mag.getWorldPosition(m.position); m.quaternion.copy(vmCam.quaternion);
    vmScene.add(m); D.mags.push({ m, v: new THREE.Vector3(rnd(-0.1, 0.1), -0.2, 0.15), life: 0.7 }); gun.mag.visible = false;
    setTimeout(() => { if (gun) gun.mag.visible = true; }, 520);
  }
  function updateGun(dt) {
    const g = gun.root, t = D.t;
    D.recoil = damp(D.recoil, 0, 16, dt); D.slideZ = damp(D.slideZ, 0, 20, dt);
    D.sway.x = damp(D.sway.x, 0, 8, dt); D.sway.y = damp(D.sway.y, 0, 8, dt);
    const ads = D.ads, bobX = Math.cos(D.bob * 0.5) * 0.008 * (1 - ads), bobY = Math.abs(Math.sin(D.bob)) * 0.012 * (1 - ads);
    const breathe = Math.sin(t * 1.6) * 0.0018, dead = D.deadWho === 'me' ? Math.min(1, D.deadT * 1.5) : 0;
    // hip (0.20,-0.21,-0.42) -> ADS (0,-0.095,-0.34): sights lined up with the crosshair
    let x = lerp(0.2, 0.0, ads) + bobX - D.sway.x, y = lerp(-0.215, -0.092, ads) - bobY + breathe + D.sway.y - dead * 0.4, z = lerp(-0.42, -0.34, ads) + D.recoil * 0.055;
    let rx = D.recoil * 0.16 + D.sway.y * 1.5, ry = -D.sway.x * 1.5 - 0.05 * (1 - ads), rz = 0;
    if (D.reload > 0) { // reload: tilt away, mag out, mag in, slide release
      const r = D.reload, a = smooth(clamp(r / 0.2, 0, 1)) * (1 - smooth(clamp((r - 0.8) / 0.2, 0, 1)));
      y -= 0.06 * a; x += 0.04 * a; rz = -0.55 * a; rx -= 0.35 * a; ry += 0.25 * a;
      gun.mag.position.y = -0.172 - (r > 0.22 && r < 0.62 ? 0.12 : 0); gun.mag.visible = !(r > 0.2 && r < 0.5);
      if (r > 0.5 && r < 0.66) { gun.mag.visible = true; gun.mag.position.y = -0.172 - 0.12 * (1 - smooth((r - 0.5) / 0.16)); }
      if (r > 0.86) gun.slide.position.z = 0;
    } else { gun.mag.position.y = -0.172; gun.mag.visible = true; }
    g.position.set(x, y, z); g.rotation.set(rx, ry, rz);
    const emptySlide = D.me.ammo === 0 && D.reload <= 0 ? 0.04 : 0;
    gun.slide.position.z = D.slideZ * 0.05 + emptySlide;
    gun.hammer.rotation.x = -D.slideZ * 0.6; gun.trigger.position.z = D.firing ? 0.006 : 0;
  }

  function render() {
    if (!D.active) return;
    renderer.autoClear = true; renderer.render(arena.scene, cam);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = true;
  }
  return { start, stop, update, render, goLive, onNet, resize, get active() { return D.active; }, get phase() { return D.phase; }, get state() { return D; }, requestLock: () => canvas.requestPointerLock && canvas.requestPointerLock() };
}
